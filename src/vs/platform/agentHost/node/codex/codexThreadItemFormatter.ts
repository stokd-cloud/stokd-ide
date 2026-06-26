/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { generateUuid } from '../../../../base/common/uuid.js';
import { ResponsePartKind, ToolCallConfirmationReason, ToolCallStatus, ToolResultContentType, type ResponsePart, type ToolCallCompletedState, type ToolResultContent } from '../../common/state/sessionState.js';
import { describeFileChange, describeWebSearch, dynamicToolOutput, fileChangeOutput, mcpToolOutput, toolInputText } from './codexMapAppServerEvents.js';
import type { ThreadItem } from './protocol/generated/v2/ThreadItem.js';

/**
 * Translate a single codex {@link ThreadItem} into the normalized response-part
 * vocabulary used by completed turns.
 *
 * This is the "tool formatter" half of the codex history builder: where the live
 * mapper (`codexMapAppServerEvents`) emits incremental {@link SessionAction}s
 * (start → delta → ready → complete) as events stream in, this collapses a
 * *finished* item — as found in a `thread/read` response — directly into the
 * terminal {@link ResponsePart}(s) the UI renders. It reuses the live mapper's
 * tool-formatting kernel (`describe*`/`*Output`) so restored sessions render
 * identically to active ones.
 *
 * Returns:
 *  - `agentMessage` → a single {@link MarkdownResponsePart} (text)
 *  - `reasoning` → one {@link ReasoningResponsePart} per non-empty summary then
 *    content entry (thinking)
 *  - `commandExecution`/`webSearch`/`fileChange`/`mcpToolCall`/`dynamicToolCall`
 *    → a {@link ToolCallResponsePart} carrying a {@link ToolCallCompletedState}
 *    (tool)
 *  - everything else (`userMessage`, `plan`, `hookPrompt`, image/review/compaction
 *    items, …) → `[]`. `userMessage` is consumed by the history builder to open
 *    the turn; the remaining kinds are not yet surfaced.
 */
export function threadItemToResponseParts(item: ThreadItem): ResponsePart[] {
	switch (item.type) {
		case 'agentMessage': {
			if (!item.text) {
				return [];
			}
			return [{ kind: ResponsePartKind.Markdown, id: generateUuid(), content: item.text }];
		}
		case 'reasoning': {
			const parts: ResponsePart[] = [];
			for (const summary of item.summary) {
				if (summary) {
					parts.push({ kind: ResponsePartKind.Reasoning, id: generateUuid(), content: summary });
				}
			}
			for (const content of item.content) {
				if (content) {
					parts.push({ kind: ResponsePartKind.Reasoning, id: generateUuid(), content });
				}
			}
			return parts;
		}
		case 'commandExecution': {
			const command = item.command ?? '';
			const success = item.status === 'completed' && (item.exitCode === 0 || item.exitCode === null);
			const exit = item.exitCode;
			const pastTense = success
				? `Ran \`${command}\``
				: exit !== null
					? `Ran \`${command}\` (exit ${exit})`
					: `Ran \`${command}\` (failed)`;
			return [completedToolCallPart({
				toolName: 'shell',
				displayName: 'Run shell command',
				invocationMessage: command,
				toolInput: command,
				success,
				pastTenseMessage: pastTense,
				output: item.aggregatedOutput ?? '',
				errorMessage: exit !== null ? `Exit code ${exit}` : 'Command failed',
				meta: { toolKind: 'terminal' },
			})];
		}
		case 'webSearch': {
			const query = describeWebSearch(item.query, item.action);
			return [completedToolCallPart({
				toolName: 'web_search',
				displayName: 'Web search',
				invocationMessage: query,
				toolInput: query,
				success: true,
				pastTenseMessage: `Searched ${query}`,
				meta: { toolKind: 'search' },
			})];
		}
		case 'fileChange': {
			const summary = describeFileChange(item.changes) || 'Apply file changes';
			const success = item.status === 'completed';
			return [completedToolCallPart({
				toolName: 'file_edit',
				displayName: 'Apply file changes',
				invocationMessage: summary,
				toolInput: summary,
				success,
				pastTenseMessage: success ? 'Applied file changes' : 'Failed to apply file changes',
				output: fileChangeOutput(item.changes),
				errorMessage: `Patch ${item.status}`,
			})];
		}
		case 'mcpToolCall': {
			const toolName = `${item.server}.${item.tool}`;
			const success = item.status === 'completed' && !item.error;
			return [completedToolCallPart({
				toolName,
				displayName: item.tool,
				invocationMessage: `Calling ${toolName}`,
				toolInput: toolInputText(item.arguments),
				success,
				pastTenseMessage: success ? `Called ${toolName}` : `Failed to call ${toolName}`,
				output: mcpToolOutput(item.result, item.error?.message),
				errorMessage: item.error?.message ?? `MCP tool ${item.status}`,
			})];
		}
		case 'dynamicToolCall': {
			const toolName = item.namespace ? `${item.namespace}.${item.tool}` : item.tool;
			const success = item.success === true || item.status === 'completed';
			return [completedToolCallPart({
				toolName,
				displayName: item.tool,
				invocationMessage: `Calling ${toolName}`,
				toolInput: toolInputText(item.arguments),
				success,
				pastTenseMessage: success ? `Called ${toolName}` : `Failed to call ${toolName}`,
				output: dynamicToolOutput(item.contentItems),
				errorMessage: `Dynamic tool ${item.status}`,
			})];
		}
		default:
			return [];
	}
}

interface ICompletedToolCallArgs {
	readonly toolName: string;
	readonly displayName: string;
	readonly invocationMessage: string;
	readonly toolInput: string;
	readonly success: boolean;
	readonly pastTenseMessage: string;
	/** Aggregated tool output; an empty string yields no result content. */
	readonly output?: string;
	/** Error message used only when `success` is false. */
	readonly errorMessage?: string;
	/** Provider-specific metadata (e.g. `{ toolKind: 'terminal' }`). */
	readonly meta?: Record<string, unknown>;
}

function completedToolCallPart(args: ICompletedToolCallArgs): ResponsePart {
	const content: ToolResultContent[] | undefined = args.output
		? [{ type: ToolResultContentType.Text, text: args.output }]
		: undefined;
	const toolCall: ToolCallCompletedState = {
		status: ToolCallStatus.Completed,
		toolCallId: generateUuid(),
		toolName: args.toolName,
		displayName: args.displayName,
		invocationMessage: args.invocationMessage,
		toolInput: args.toolInput,
		confirmed: ToolCallConfirmationReason.NotNeeded,
		success: args.success,
		pastTenseMessage: args.pastTenseMessage,
		...(content ? { content } : {}),
		...(args.success ? {} : { error: { message: args.errorMessage ?? 'Failed' } }),
		...(args.meta ? { _meta: args.meta } : {}),
	};
	return { kind: ResponsePartKind.ToolCall, toolCall };
}
