/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Minimal, hand-authored TypeScript view of the Agent Client Protocol (ACP)
 * wire surface that the pinned **gemini-cli `0.47.0`** agent emits in `--acp`
 * mode (ACP protocol version `1`). See
 * `src/vs/platform/agentHost/node/gemini/ACP-STEERING-SPIKE.md` for the pinned
 * handshake these shapes were derived from.
 *
 * IMPORTANT — relationship to AX-REPO-VENDORED-AHP-PROTOCOL:
 *  These are **not** code-generated. The vendored-protocol axiom forbids
 *  hand-editing *generated* files (e.g. the codex `protocol/generated/**`
 *  tree produced by `scripts/sync-agent-host-protocol.ts`); it does not apply
 *  to this hand-authored subset. If/when an ACP code-gen pipeline is
 *  introduced, its generated `ToolKind`/`SessionUpdate`/`ContentBlock` types
 *  supersede these and must not be hand-edited — at which point this module
 *  becomes a thin re-export. Until then this is the single source of truth for
 *  the ACP shapes the Gemini adapter consumes, deliberately narrowed to the
 *  fields the normalizer reads.
 */

// ---- Content blocks ------------------------------------------------------

/** A plain text content block (`{ type: 'text', text }`). */
export interface GeminiAcpTextContent {
	readonly type: 'text';
	readonly text: string;
}

/** A non-text content block (image / audio / resource link / resource). */
export interface GeminiAcpOtherContent {
	readonly type: 'image' | 'audio' | 'resource_link' | 'resource';
	readonly [key: string]: unknown;
}

/** ACP `ContentBlock` — only the text variant carries renderable assistant text. */
export type GeminiAcpContentBlock = GeminiAcpTextContent | GeminiAcpOtherContent;

// ---- Tool calls ----------------------------------------------------------

/**
 * ACP `ToolKind` — the high-level category an agent assigns to a tool call.
 * Drives how the normalizer renders the call (terminal vs. edit vs. simple).
 */
export type GeminiAcpToolKind =
	| 'read'
	| 'edit'
	| 'delete'
	| 'move'
	| 'search'
	| 'execute'
	| 'think'
	| 'fetch'
	| 'other';

/** ACP `ToolCallStatus`. */
export type GeminiAcpToolCallStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/** ACP `ToolCallLocation` — a file (and optional line) a tool call touches. */
export interface GeminiAcpToolCallLocation {
	readonly path: string;
	readonly line?: number;
}

/** An inline content entry on a tool call (`{ type: 'content', content }`). */
export interface GeminiAcpToolCallContentBlock {
	readonly type: 'content';
	readonly content: GeminiAcpContentBlock;
}

/** A diff entry on a tool call (`{ type: 'diff', path, oldText?, newText }`). */
export interface GeminiAcpToolCallDiff {
	readonly type: 'diff';
	readonly path: string;
	readonly oldText?: string | null;
	readonly newText: string;
}

/** A terminal-reference entry on a tool call (`{ type: 'terminal', terminalId }`). */
export interface GeminiAcpToolCallTerminalRef {
	readonly type: 'terminal';
	readonly terminalId: string;
}

/** ACP `ToolCallContent` union. */
export type GeminiAcpToolCallContent =
	| GeminiAcpToolCallContentBlock
	| GeminiAcpToolCallDiff
	| GeminiAcpToolCallTerminalRef;

// ---- session/update variants --------------------------------------------

/** `session/update` for a streamed assistant message text fragment. */
export interface GeminiAcpAgentMessageChunk {
	readonly sessionUpdate: 'agent_message_chunk';
	readonly content: GeminiAcpContentBlock;
}

/** `session/update` for a streamed assistant thinking / reasoning fragment. */
export interface GeminiAcpAgentThoughtChunk {
	readonly sessionUpdate: 'agent_thought_chunk';
	readonly content: GeminiAcpContentBlock;
}

/** `session/update` echoing a user message fragment (e.g. during replay). */
export interface GeminiAcpUserMessageChunk {
	readonly sessionUpdate: 'user_message_chunk';
	readonly content: GeminiAcpContentBlock;
}

/** `session/update` announcing a new tool call. */
export interface GeminiAcpToolCall {
	readonly sessionUpdate: 'tool_call';
	readonly toolCallId: string;
	readonly title: string;
	readonly kind?: GeminiAcpToolKind;
	readonly status?: GeminiAcpToolCallStatus;
	readonly content?: readonly GeminiAcpToolCallContent[];
	readonly locations?: readonly GeminiAcpToolCallLocation[];
	readonly rawInput?: unknown;
}

/** `session/update` updating an existing tool call (status, output, …). */
export interface GeminiAcpToolCallUpdate {
	readonly sessionUpdate: 'tool_call_update';
	readonly toolCallId: string;
	readonly status?: GeminiAcpToolCallStatus;
	readonly title?: string;
	readonly kind?: GeminiAcpToolKind;
	readonly content?: readonly GeminiAcpToolCallContent[];
	readonly locations?: readonly GeminiAcpToolCallLocation[];
	readonly rawOutput?: unknown;
}

/** A single entry in an agent plan (`plan` session update). */
export interface GeminiAcpPlanEntry {
	readonly content: string;
	readonly priority?: 'high' | 'medium' | 'low';
	readonly status?: 'pending' | 'in_progress' | 'completed';
}

/** `session/update` carrying the agent's current plan (display only). */
export interface GeminiAcpPlanUpdate {
	readonly sessionUpdate: 'plan';
	readonly entries: readonly GeminiAcpPlanEntry[];
}

/** `session/update` carrying the available slash commands (display only). */
export interface GeminiAcpAvailableCommandsUpdate {
	readonly sessionUpdate: 'available_commands_update';
	readonly availableCommands: readonly unknown[];
}

/** `session/update` carrying the agent's current permission/approval mode. */
export interface GeminiAcpCurrentModeUpdate {
	readonly sessionUpdate: 'current_mode_update';
	readonly currentModeId: string;
}

/**
 * The `update` payload of a `session/update` notification — the discriminated
 * union (on `sessionUpdate`) the Gemini ACP agent streams during both a live
 * turn and a `session/load` (history replay).
 */
export type GeminiAcpSessionUpdate =
	| GeminiAcpAgentMessageChunk
	| GeminiAcpAgentThoughtChunk
	| GeminiAcpUserMessageChunk
	| GeminiAcpToolCall
	| GeminiAcpToolCallUpdate
	| GeminiAcpPlanUpdate
	| GeminiAcpAvailableCommandsUpdate
	| GeminiAcpCurrentModeUpdate;

// ---- session modes -------------------------------------------------------

/**
 * An ACP `SessionMode` as advertised in the `session/new` result's
 * `modes.availableModes` — the **agent-declared** permission/approval modes.
 */
export interface GeminiAcpSessionMode {
	readonly id: string;
	readonly name: string;
	readonly description?: string | null;
}

// ---- type guards ---------------------------------------------------------

/** Narrow a content block to its text payload, or `undefined` for non-text. */
export function geminiAcpTextOf(content: GeminiAcpContentBlock | undefined): string | undefined {
	return content && content.type === 'text' ? content.text : undefined;
}
