/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Minimal, hand-authored TypeScript view of the grok on-disk + headless-stream
 * record surface the pinned **grok `0.2.51`** (build `f4f85a6492e`) emits.
 *
 * Two record families share a single `type` discriminant (their value sets are
 * disjoint), so one normalizer handles both directions — exactly like the
 * Gemini ACP `session/update` stream serves live + replay:
 *
 *  1. **transcript records** (`chat_history.jsonl`) — the **replay** source. Type
 *     vocabulary pinned by the discovery gate ({@link GROK_CHAT_RECORD_TYPES}):
 *     `system`, `user`, `assistant`, `reasoning`, `tool_result`,
 *     `backend_tool_call`. Format header `chat_format_version: 1`
 *     ({@link GROK_CHAT_FORMAT_VERSION}).
 *  2. **live events** (`events.jsonl` / `--output-format streaming-json`) — the
 *     **stream** source. Type vocabulary pinned by the gate
 *     ({@link GROK_EVENT_TYPES}): `turn_started`/`turn_ended`, `first_token`,
 *     `phase_changed`, `loop_started`, `tool_started`/`tool_completed`,
 *     `permission_requested`/`permission_resolved`, and the `mcp_*` lifecycle.
 *
 * IMPORTANT — relationship to AX-REPO-VENDORED-AHP-PROTOCOL: these are **not**
 * code-generated. The vendored-protocol axiom forbids hand-editing *generated*
 * files (the codex `protocol/generated/**` tree); it does not apply to this
 * hand-authored subset. The pinned vocabularies + `summary.json` key set are
 * frozen by `test/grokVersionContract.spec.ts` (mirroring codex's
 * `codexVersionContract.test.ts`, per DN-5). On a pin bump, re-run the discovery
 * gate and update both the consts here and that contract test.
 *
 * The shapes are deliberately narrowed to the fields the normalizer + listing
 * read; fields not yet consumed are admitted via the index signatures.
 */

// ---- Pinned vocabularies (frozen by grokVersionContract.spec.ts) ---------

/** `chat_history.jsonl` record `type`/`role` vocabulary (DN-5 discovery gate Q1). */
export const GROK_CHAT_RECORD_TYPES = [
	'system',
	'user',
	'assistant',
	'reasoning',
	'tool_result',
	'backend_tool_call',
] as const;

/** `events.jsonl` / `streaming-json` event `type` vocabulary (DN-5 discovery gate Q1). */
export const GROK_EVENT_TYPES = [
	'mcp_config_resolved',
	'mcp_server_starting',
	'mcp_server_connected',
	'mcp_server_failed',
	'mcp_init_completed',
	'turn_started',
	'turn_ended',
	'loop_started',
	'first_token',
	'phase_changed',
	'tool_started',
	'tool_completed',
	'permission_requested',
	'permission_resolved',
] as const;

/** `chat_history.jsonl` `chat_format_version` header pinned at this grok version. */
export const GROK_CHAT_FORMAT_VERSION = 1;

// ---- Content blocks ------------------------------------------------------

/** A plain text content block (`{ type: 'text', text }`). */
export interface GrokTextContent {
	readonly type: 'text';
	readonly text: string;
}

/** A non-text content block (image / resource / …). */
export interface GrokOtherContent {
	readonly type: Exclude<string, 'text'>;
	readonly [key: string]: unknown;
}

/** A single content block — only the text variant carries renderable text. */
export type GrokContentBlock = GrokTextContent | GrokOtherContent;

/** Where renderable text can live on a record: a string, one block, or many. */
export type GrokTextSource = string | GrokContentBlock | readonly GrokContentBlock[];

// ---- Transcript records (chat_history.jsonl) — replay --------------------

/** A streamed/full assistant message. Live `streaming-json` emits these incrementally. */
export interface GrokAssistantRecord {
	readonly type: 'assistant';
	readonly text?: string;
	readonly content?: GrokTextSource;
}

/** Assistant reasoning / extended thinking. */
export interface GrokReasoningRecord {
	readonly type: 'reasoning';
	readonly text?: string;
	readonly content?: GrokTextSource;
}

/** A user message echo (consumed by the renderer elsewhere — not a turn-lifecycle event). */
export interface GrokUserRecord {
	readonly type: 'user';
	readonly text?: string;
	readonly content?: GrokTextSource;
}

/** A system message (not surfaced in the assistant turn vocabulary). */
export interface GrokSystemRecord {
	readonly type: 'system';
	readonly [key: string]: unknown;
}

/** A tool invocation made by the model (opens a tool call during replay). */
export interface GrokBackendToolCallRecord {
	readonly type: 'backend_tool_call';
	readonly id?: string;
	readonly tool_call_id?: string;
	readonly name: string;
	readonly input?: Record<string, unknown>;
	readonly arguments?: Record<string, unknown>;
}

/** A tool result (closes a tool call during replay). */
export interface GrokToolResultRecord {
	readonly type: 'tool_result';
	readonly id?: string;
	readonly tool_call_id?: string;
	readonly name?: string;
	readonly output?: string;
	readonly content?: GrokTextSource;
	readonly is_error?: boolean;
	readonly locations?: readonly GrokToolLocation[];
}

// ---- Live events (events.jsonl / streaming-json) — stream ----------------

/** A tool call started (live analogue of {@link GrokBackendToolCallRecord}). */
export interface GrokToolStartedEvent {
	readonly type: 'tool_started';
	readonly ts?: string;
	readonly id?: string;
	readonly tool_call_id?: string;
	readonly name: string;
	readonly input?: Record<string, unknown>;
	readonly arguments?: Record<string, unknown>;
}

/** A tool call completed (live analogue of {@link GrokToolResultRecord}). */
export interface GrokToolCompletedEvent {
	readonly type: 'tool_completed';
	readonly ts?: string;
	readonly id?: string;
	readonly tool_call_id?: string;
	readonly name?: string;
	readonly output?: string;
	readonly content?: GrokTextSource;
	readonly is_error?: boolean;
	readonly status?: string;
	readonly locations?: readonly GrokToolLocation[];
}

/** A permission gate the user must resolve before the tool runs. */
export interface GrokPermissionRequestedEvent {
	readonly type: 'permission_requested';
	readonly ts?: string;
	readonly id?: string;
	readonly request_id?: string;
	readonly tool_call_id?: string;
	readonly description?: string;
	readonly kind?: string;
}

/**
 * Lifecycle / bookkeeping events that are not part of the rendered assistant
 * turn vocabulary (`turn_*`, `first_token`, `phase_changed`, `loop_started`,
 * `permission_resolved`, `mcp_*`). The normalizer drops these.
 */
export interface GrokLifecycleEvent {
	readonly type:
	| 'turn_started'
	| 'turn_ended'
	| 'loop_started'
	| 'first_token'
	| 'phase_changed'
	| 'permission_resolved'
	| 'mcp_config_resolved'
	| 'mcp_server_starting'
	| 'mcp_server_connected'
	| 'mcp_server_failed'
	| 'mcp_init_completed';
	readonly [key: string]: unknown;
}

/** A file (and optional line) a tool call touches. */
export interface GrokToolLocation {
	readonly path: string;
	readonly line?: number;
}

// ---- Unified record union ------------------------------------------------

/**
 * The discriminated union (on `type`) the {@link import('./grokStreamingEvents').GrokEventNormalizer}
 * consumes — transcript records (replay) and live events (stream) together,
 * because their `type` value sets are disjoint.
 */
export type GrokStreamRecord =
	| GrokAssistantRecord
	| GrokReasoningRecord
	| GrokUserRecord
	| GrokSystemRecord
	| GrokBackendToolCallRecord
	| GrokToolResultRecord
	| GrokToolStartedEvent
	| GrokToolCompletedEvent
	| GrokPermissionRequestedEvent
	| GrokLifecycleEvent;

// ---- summary.json (the session-list header) ------------------------------

/** `info` sub-object of {@link GrokSummaryJson}. */
export interface GrokSummaryInfo {
	readonly id: string;
	readonly cwd?: string;
}

/**
 * The `summary.json` header written once per session — the file-watch listing
 * source (DN-5). Narrowed to the fields a list row needs; the index signature
 * admits the rest.
 */
export interface GrokSummaryJson {
	readonly info: GrokSummaryInfo;
	readonly session_summary?: string;
	readonly generated_title?: string;
	readonly created_at?: string;
	readonly updated_at?: string;
	readonly last_active_at?: string;
	readonly num_messages?: number;
	readonly num_chat_messages?: number;
	readonly current_model_id?: string;
	readonly chat_format_version?: number;
	readonly head_branch?: string;
	readonly agent_name?: string;
	readonly [key: string]: unknown;
}

/**
 * The `summary.json` key set pinned at grok `0.2.51` (DN-5 discovery gate Q1).
 * Frozen by `grokVersionContract.spec.ts`; a pin bump that changes these keys
 * must re-run the discovery gate.
 */
export const GROK_SUMMARY_KEYS = [
	'info',
	'session_summary',
	'generated_title',
	'created_at',
	'updated_at',
	'last_active_at',
	'num_messages',
	'num_chat_messages',
	'current_model_id',
	'chat_format_version',
	'git_root_dir',
	'git_remotes',
	'head_commit',
	'head_branch',
	'agent_name',
	'request_id',
	'grok_home',
	'next_trace_turn',
] as const;

// ---- Helpers -------------------------------------------------------------

/**
 * Narrow a {@link GrokTextSource} to its rendered text, or `undefined` when
 * there is none (missing, empty, or non-text content). An array concatenates the
 * text of every text block.
 */
export function grokTextOf(content: GrokTextSource | undefined): string | undefined {
	if (content === undefined) {
		return undefined;
	}
	if (typeof content === 'string') {
		return content.length > 0 ? content : undefined;
	}
	if (Array.isArray(content)) {
		const parts: string[] = [];
		for (const block of content) {
			const text = grokTextOf(block);
			if (text) {
				parts.push(text);
			}
		}
		return parts.length > 0 ? parts.join('') : undefined;
	}
	const block = content as GrokContentBlock;
	return block.type === 'text' && block.text.length > 0 ? block.text : undefined;
}

/** The high-level kind a tool name maps to — drives terminal vs. edit vs. simple rendering. */
export type GrokToolKind = 'execute' | 'edit' | 'simple';

/**
 * Classify a grok tool name into a {@link GrokToolKind}. grok does not pin a
 * tool-`kind` field, so this is a name heuristic (refined on a pin bump): shell/
 * exec/command/terminal → `execute`; edit/write/patch/replace/create/delete/move
 * → `edit`; everything else → `simple`.
 */
export function grokToolKind(name: string): GrokToolKind {
	const n = name.toLowerCase();
	if (/(shell|bash|\bexec\b|execute|command|terminal|\brun\b|run_)/.test(n)) {
		return 'execute';
	}
	if (/(edit|write|patch|replace|create|delete|remove|\bmove\b|apply)/.test(n)) {
		return 'edit';
	}
	return 'simple';
}

/** A record that may carry a tool-call id under either alias grok uses. */
interface GrokToolCallIded {
	readonly id?: string;
	readonly tool_call_id?: string;
}

/** Read a record's tool-call id, accepting either the `id` or `tool_call_id` alias. */
export function grokToolCallId(record: GrokToolCallIded): string | undefined {
	return record.id ?? record.tool_call_id;
}
