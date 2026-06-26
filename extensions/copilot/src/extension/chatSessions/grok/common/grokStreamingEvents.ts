/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Grok stream/replay normalizer — the "history builder / tool formatter" half of
 * the Grok adapter (AC-P3.1).
 *
 * It translates the grok record surface into the provider-agnostic
 * {@link NormalizedEvent} vocabulary the shared chat-panel renderer consumes.
 * The SAME normalizer serves both directions because grok's `type` discriminant
 * value sets are disjoint (see {@link GrokStreamRecord}):
 *  - **replay** — the `chat_history.jsonl` transcript (`assistant`, `reasoning`,
 *    `backend_tool_call`, `tool_result`, …); and
 *  - **stream** — the `events.jsonl` / `--output-format streaming-json` live
 *    event stream (`tool_started`, `tool_completed`, `permission_requested`,
 *    plus dropped lifecycle/bookkeeping events).
 *
 * Because both paths are the same normalizer, a restored session renders
 * identically to a live one.
 *
 * Tool-call mapping (by {@link grokToolKind}):
 *  - `execute` → `tool.start` then, on completion, `tool.terminal` (command +
 *    captured output) and `tool.complete`.
 *  - `edit`    → `tool.start` then, on completion, `edit` (changed file URIs)
 *    and `tool.complete`.
 *  - `simple`  → `tool.start` then, on completion, `tool.simple` (tool name +
 *    opening path) and `tool.complete`.
 *
 * The normalizer emits eagerly — every input record is fully mapped in
 * {@link normalize}, so {@link flush} never yields anything extra.
 */

import { URI } from '../../../../util/vs/base/common/uri';
import type {
	IEventNormalizer,
	NormalizedEvent,
} from '../../common/agentCliProvider';
import {
	grokTextOf,
	grokToolKind,
	type GrokStreamRecord,
	type GrokToolKind,
	type GrokToolLocation,
} from './grokStreamTypes';

/** Per-tool-call state retained between the opening call and its result. */
interface IGrokToolCallEntry {
	readonly toolName: string;
	readonly kind: GrokToolKind;
	/** Raw input captured at the opening call (carries `command` / `path`). */
	readonly input: Record<string, unknown>;
}

/** Read the renderable text off an assistant / reasoning record. */
function recordText(record: { readonly text?: string; readonly content?: unknown }): string | undefined {
	if (typeof record.text === 'string' && record.text.length > 0) {
		return record.text;
	}
	return grokTextOf(record.content as Parameters<typeof grokTextOf>[0]);
}

/** A string-valued field off a raw input object, or undefined. */
function inputString(input: Record<string, unknown> | undefined, key: string): string | undefined {
	const value = input?.[key];
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Collect, de-duplicated, the file URIs an edit tool call touched. */
function collectEditUris(
	locations: readonly GrokToolLocation[] | undefined,
	input: Record<string, unknown> | undefined,
): URI[] {
	const paths = new Set<string>();
	for (const location of locations ?? []) {
		if (location?.path) {
			paths.add(location.path);
		}
	}
	if (paths.size === 0) {
		const path = inputString(input, 'path');
		if (path) {
			paths.add(path);
		}
	}
	return [...paths].map(path => URI.file(path));
}

/**
 * Normalizes grok transcript records and live events into the shared
 * {@link NormalizedEvent} vocabulary.
 */
export class GrokEventNormalizer implements IEventNormalizer<GrokStreamRecord> {

	readonly providerId = 'grok';

	/** Open tool calls keyed by tool-call id, awaiting their result record. */
	private readonly _pending = new Map<string, IGrokToolCallEntry>();

	normalize(record: GrokStreamRecord): readonly NormalizedEvent[] {
		switch (record.type) {
			case 'reasoning': {
				const content = recordText(record);
				return content ? [{ type: 'assistant.thinking', content }] : [];
			}
			case 'assistant': {
				const content = recordText(record);
				return content ? [{ type: 'assistant.textDelta', content }] : [];
			}
			case 'backend_tool_call':
			case 'tool_started': {
				const toolCallId = record.id ?? record.tool_call_id;
				if (!toolCallId) {
					return [];
				}
				const toolName = record.name;
				const input = record.input ?? record.arguments ?? {};
				this._pending.set(toolCallId, { toolName, kind: grokToolKind(toolName), input });
				return [{ type: 'tool.start', toolCallId, toolName, input }];
			}
			case 'tool_result':
			case 'tool_completed': {
				const toolCallId = record.id ?? record.tool_call_id;
				if (!toolCallId) {
					return [];
				}
				const entry = this._pending.get(toolCallId);
				this._pending.delete(toolCallId);
				const toolName = entry?.toolName ?? record.name ?? '';
				const kind = entry?.kind ?? 'simple';
				const output = record.output ?? grokTextOf(record.content);
				const isError = record.is_error === true;

				const events: NormalizedEvent[] = [];
				if (kind === 'execute') {
					events.push({
						type: 'tool.terminal',
						toolCallId,
						toolName,
						command: inputString(entry?.input, 'command') ?? '',
						output,
					});
				} else if (kind === 'edit') {
					events.push({
						type: 'edit',
						toolCallId,
						editId: toolCallId,
						uris: collectEditUris(record.locations, entry?.input),
					});
				} else {
					events.push({
						type: 'tool.simple',
						toolCallId,
						toolName,
						description: toolName,
						detail: inputString(entry?.input, 'path'),
					});
				}
				events.push({ type: 'tool.complete', toolCallId, toolName, result: output, isError });
				return events;
			}
			case 'permission_requested': {
				return [{
					type: 'permission.requested',
					requestId: record.request_id ?? record.id ?? '',
					kind: record.kind ?? '',
					description: record.description ?? '',
					toolCallId: record.tool_call_id,
				}];
			}
			default:
				// user / system transcript records and turn_*/first_token/phase_changed/
				// loop_started/permission_resolved/mcp_* lifecycle events carry nothing
				// the assistant-turn vocabulary renders.
				return [];
		}
	}

	flush(): readonly NormalizedEvent[] {
		return [];
	}
}
