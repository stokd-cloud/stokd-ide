/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageKind, type Turn, type ResponsePart } from '../../common/state/sessionState.js';
import type { Thread } from './protocol/generated/v2/Thread.js';
import type { Turn as CodexTurn } from './protocol/generated/v2/Turn.js';
import { turnStateFromStatus } from './codexMapAppServerEvents.js';
import { threadItemToResponseParts } from './codexThreadItemFormatter.js';

/**
 * Reconstruct protocol {@link Turn}s from codex's `thread/read` response.
 *
 * Codex stores each conversation as a stream of {@link CodexTurn}, each
 * with an array of `ThreadItem`s. We collapse that into the agent
 * host's turn shape: each user message opens a turn; subsequent assistant
 * items become response parts on that turn until `turn/completed` closes it.
 *
 * Produces:
 *  - `userMessage` → opens a `Turn` with `message: { text }`
 *  - every other item → its normalized {@link ResponsePart}(s) via
 *    {@link threadItemToResponseParts}: `agentMessage` (text), `reasoning`
 *    (thinking), and `commandExecution`/`webSearch`/`fileChange`/`mcpToolCall`/
 *    `dynamicToolCall` (structured tool calls). Unsupported item kinds map to
 *    nothing.
 *
 * Shares the live mapper's tool-formatting kernel so restored sessions render
 * identically to active ones.
 */
export function replayThreadToTurns(thread: Thread): Turn[] {
	const turns: Turn[] = [];
	for (const codexTurn of thread.turns ?? []) {
		const turn = replayTurnToTurn(codexTurn);
		if (turn) {
			turns.push(turn);
		}
	}
	return turns;
}

function replayTurnToTurn(codexTurn: CodexTurn): Turn | undefined {
	let userText = '';
	const parts: ResponsePart[] = [];
	for (const item of codexTurn.items ?? []) {
		if (item.type === 'userMessage') {
			const collected: string[] = [];
			for (const c of item.content) {
				if (c.type === 'text') {
					collected.push(c.text);
				}
			}
			if (collected.length > 0) {
				userText = collected.join('\n\n');
			}
			continue;
		}
		// Every other item is collapsed into its normalized response part(s) by
		// the shared tool formatter (text/thinking/tool). Unsupported kinds
		// return nothing.
		parts.push(...threadItemToResponseParts(item));
	}
	// If we got nothing recognizable, drop the turn — there's nothing for
	// the UI to render.
	if (!userText && parts.length === 0) {
		return undefined;
	}
	return {
		id: codexTurn.id,
		message: { text: userText, origin: { kind: MessageKind.User } },
		responseParts: parts,
		usage: undefined,
		state: turnStateFromStatus(codexTurn.status),
	};
}
