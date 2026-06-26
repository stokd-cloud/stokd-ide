/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Gemini ACP event normalizer — the "history builder / tool formatter" half of
 * the Gemini adapter.
 *
 * It translates the ACP `session/update` stream the gemini-cli agent emits into
 * the provider-agnostic {@link NormalizedEvent} vocabulary the shared chat-panel
 * renderer consumes. The SAME normalizer serves both directions (AC-P1.1):
 *  - **live turn** — `session/prompt` streams `session/update` notifications
 *    incrementally as the turn runs; and
 *  - **history replay** — `session/load` replays the historical conversation by
 *    re-emitting the same `session/update` notifications (including tool calls
 *    that arrive already `completed`).
 *
 * Because both paths are the same event stream, one normalizer renders a
 * restored session identically to a live one.
 *
 * Tool-call mapping (by ACP {@link GeminiAcpToolKind}):
 *  - `execute` → `tool.start` then, on completion, `tool.terminal` (command +
 *    captured output) and `tool.complete`.
 *  - `edit`/`delete`/`move` (or any `diff` content) → `tool.start` then, on
 *    completion, `edit` (changed file URIs) and `tool.complete`.
 *  - everything else (`read`/`search`/`fetch`/`think`/`other`) → `tool.start`
 *    then, on completion, `tool.simple` (title + first path) and `tool.complete`.
 * A `tool_call` that arrives already terminal (replay) emits start → detail →
 * complete in one pass.
 */

import { URI } from '../../../../util/vs/base/common/uri';
import type {
	IEventNormalizer,
	NormalizedEvent,
} from '../../common/agentCliProvider';
import {
	geminiAcpTextOf,
	type GeminiAcpSessionUpdate,
	type GeminiAcpToolCall,
	type GeminiAcpToolCallContent,
	type GeminiAcpToolCallLocation,
	type GeminiAcpToolCallStatus,
	type GeminiAcpToolCallUpdate,
	type GeminiAcpToolKind,
} from './geminiAcpTypes';

/** Per-tool-call state retained between `tool_call` and `tool_call_update`. */
interface IToolCallEntry {
	readonly toolName: string;
	readonly kind: GeminiAcpToolKind;
	/** Shell command for `execute` kinds (from `rawInput.command` or the title). */
	readonly command?: string;
	/** Locations captured at start; an update may add more but never clears these. */
	readonly locations?: readonly GeminiAcpToolCallLocation[];
	/** Inline content captured at start (e.g. a `tool_call` that arrives terminal). */
	readonly content?: readonly GeminiAcpToolCallContent[];
	/** Whether the start event has already been emitted. */
	started: boolean;
	/** Whether the terminal (complete) detail has already been emitted. */
	finalized: boolean;
}

export class GeminiAcpEventNormalizer implements IEventNormalizer<GeminiAcpSessionUpdate> {

	readonly providerId = 'gemini';

	private readonly _toolCalls = new Map<string, IToolCallEntry>();

	normalize(update: GeminiAcpSessionUpdate): readonly NormalizedEvent[] {
		switch (update.sessionUpdate) {
			case 'agent_message_chunk': {
				const text = geminiAcpTextOf(update.content);
				return text ? [{ type: 'assistant.textDelta', content: text }] : [];
			}
			case 'agent_thought_chunk': {
				const text = geminiAcpTextOf(update.content);
				return text ? [{ type: 'assistant.thinking', content: text }] : [];
			}
			case 'tool_call':
				return this._onToolCall(update);
			case 'tool_call_update':
				return this._onToolCallUpdate(update);
			// user echoes, plan/command/mode displays are not part of the
			// assistant turn vocabulary — the renderer surfaces those elsewhere.
			case 'user_message_chunk':
			case 'plan':
			case 'available_commands_update':
			case 'current_mode_update':
				return [];
			default:
				return [];
		}
	}

	flush(): readonly NormalizedEvent[] {
		// All events are emitted eagerly; nothing is buffered across the turn.
		return [];
	}

	private _onToolCall(update: GeminiAcpToolCall): NormalizedEvent[] {
		const kind = update.kind ?? 'other';
		const toolName = update.title || kind;
		const command = kind === 'execute' ? (rawInputCommand(update.rawInput) ?? update.title) : undefined;
		const entry: IToolCallEntry = {
			toolName,
			kind,
			command,
			locations: update.locations,
			content: update.content,
			started: false,
			finalized: false,
		};
		this._toolCalls.set(update.toolCallId, entry);

		const events: NormalizedEvent[] = [];
		events.push(this._startEvent(update.toolCallId, entry, update.rawInput));
		entry.started = true;

		// Replay: a tool_call that arrives already terminal carries its own
		// content/locations and never gets a separate update — finalize now.
		if (isTerminal(update.status)) {
			events.push(...this._finalizeEvents(update.toolCallId, entry, update.status, update.content, update.locations));
		}
		return events;
	}

	private _onToolCallUpdate(update: GeminiAcpToolCallUpdate): NormalizedEvent[] {
		let entry = this._toolCalls.get(update.toolCallId);
		const events: NormalizedEvent[] = [];
		if (!entry) {
			// An update with no preceding tool_call (defensive): synthesize an
			// entry from the update itself and open the call.
			const kind = update.kind ?? 'other';
			entry = { toolName: update.title || kind, kind, started: false, finalized: false };
			this._toolCalls.set(update.toolCallId, entry);
		}
		if (!entry.started) {
			events.push(this._startEvent(update.toolCallId, entry, undefined));
			entry.started = true;
		}
		if (isTerminal(update.status)) {
			// An update may add content/locations but never clears those captured
			// at start (e.g. a read tool whose path arrived on the `tool_call`).
			const content = update.content ?? entry.content;
			const locations = update.locations ?? entry.locations;
			events.push(...this._finalizeEvents(update.toolCallId, entry, update.status, content, locations));
		}
		return events;
	}

	private _startEvent(toolCallId: string, entry: IToolCallEntry, rawInput: unknown): NormalizedEvent {
		return {
			type: 'tool.start',
			toolCallId,
			toolName: entry.toolName,
			input: asInputRecord(rawInput),
		};
	}

	/** Emit the terminal detail event(s) for a completed/failed tool call. */
	private _finalizeEvents(
		toolCallId: string,
		entry: IToolCallEntry,
		status: GeminiAcpToolCallStatus | undefined,
		content: readonly GeminiAcpToolCallContent[] | undefined,
		locations: readonly GeminiAcpToolCallLocation[] | undefined,
	): NormalizedEvent[] {
		if (entry.finalized) {
			return [];
		}
		entry.finalized = true;
		const isError = status === 'failed';
		const events: NormalizedEvent[] = [];

		if (entry.kind === 'execute') {
			events.push({
				type: 'tool.terminal',
				toolCallId,
				toolName: entry.toolName,
				command: entry.command ?? entry.toolName,
				output: collectText(content),
			});
		} else if (isEditKind(entry.kind, content)) {
			events.push({
				type: 'edit',
				toolCallId,
				uris: collectEditUris(content, locations),
				editId: toolCallId,
			});
		} else {
			events.push({
				type: 'tool.simple',
				toolCallId,
				toolName: entry.toolName,
				description: entry.toolName,
				detail: firstPath(locations),
			});
		}

		events.push({ type: 'tool.complete', toolCallId, toolName: entry.toolName, isError });
		return events;
	}
}

// ---- helpers -------------------------------------------------------------

function isTerminal(status: GeminiAcpToolCallStatus | undefined): boolean {
	return status === 'completed' || status === 'failed';
}

function isEditKind(kind: GeminiAcpToolKind, content: readonly GeminiAcpToolCallContent[] | undefined): boolean {
	if (kind === 'edit' || kind === 'delete' || kind === 'move') {
		return true;
	}
	return !!content?.some(entry => entry.type === 'diff');
}

/** Concatenate the text of every inline `content` entry on a tool call. */
function collectText(content: readonly GeminiAcpToolCallContent[] | undefined): string | undefined {
	if (!content) {
		return undefined;
	}
	const parts: string[] = [];
	for (const entry of content) {
		if (entry.type === 'content') {
			const text = geminiAcpTextOf(entry.content);
			if (text) {
				parts.push(text);
			}
		}
	}
	return parts.length > 0 ? parts.join('') : undefined;
}

/** Collect, de-duplicated, the file URIs an edit tool call touched. */
function collectEditUris(
	content: readonly GeminiAcpToolCallContent[] | undefined,
	locations: readonly GeminiAcpToolCallLocation[] | undefined,
): URI[] {
	const paths = new Set<string>();
	for (const loc of locations ?? []) {
		if (loc.path) {
			paths.add(loc.path);
		}
	}
	for (const entry of content ?? []) {
		if (entry.type === 'diff' && entry.path) {
			paths.add(entry.path);
		}
	}
	return [...paths].map(path => URI.file(path));
}

function firstPath(locations: readonly GeminiAcpToolCallLocation[] | undefined): string | undefined {
	return locations && locations.length > 0 ? locations[0].path : undefined;
}

/** Extract a `command` string from a tool call's `rawInput`, if present. */
function rawInputCommand(rawInput: unknown): string | undefined {
	if (rawInput && typeof rawInput === 'object' && 'command' in rawInput) {
		const command = (rawInput as { command?: unknown }).command;
		if (typeof command === 'string') {
			return command;
		}
	}
	return undefined;
}

/** Coerce arbitrary `rawInput` into the `Record<string, unknown>` the start event requires. */
function asInputRecord(rawInput: unknown): Record<string, unknown> {
	return rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput)
		? rawInput as Record<string, unknown>
		: {};
}
