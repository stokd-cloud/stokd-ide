/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { replayThreadToTurns } from '../../../node/codex/codexReplayMapper.js';
import { ResponsePartKind, ToolCallStatus, ToolResultContentType, TurnState, type ToolCallCompletedState, type ToolCallResponsePart } from '../../../common/state/sessionState.js';

suite('codexReplayMapper', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('empty thread → no turns', () => {
		const turns = replayThreadToTurns({ id: 'thr', turns: [] } as never);
		assert.deepStrictEqual(turns, []);
	});

	test('thread with one user/agent exchange → one Turn', () => {
		const turns = replayThreadToTurns({
			id: 'thr',
			turns: [{
				id: 'turn_a',
				items: [
					{ type: 'userMessage', id: 'u1', content: [{ type: 'text', text: 'hi', text_elements: [] }] },
					{ type: 'agentMessage', id: 'a1', text: 'hello back', phase: null, memoryCitation: null },
				],
				itemsView: { type: 'full' } as never,
				status: 'completed' as never,
				error: null,
				startedAt: null, completedAt: null, durationMs: null,
			}],
		} as never);
		assert.strictEqual(turns.length, 1);
		assert.strictEqual(turns[0].id, 'turn_a');
		assert.strictEqual(turns[0].message.text, 'hi');
		assert.strictEqual(turns[0].state, TurnState.Complete);
		assert.strictEqual(turns[0].responseParts.length, 1);
		const part = turns[0].responseParts[0];
		assert.strictEqual(part.kind, ResponsePartKind.Markdown);
		assert.strictEqual((part as { content: string }).content, 'hello back');
	});

	test('failed turn maps to TurnState.Error', () => {
		const turns = replayThreadToTurns({
			id: 'thr',
			turns: [{
				id: 'turn_a',
				items: [
					{ type: 'userMessage', id: 'u1', content: [{ type: 'text', text: 'q', text_elements: [] }] },
				],
				itemsView: { type: 'full' } as never,
				status: 'failed' as never,
				error: { message: 'oops' } as never,
				startedAt: null, completedAt: null, durationMs: null,
			}],
		} as never);
		assert.strictEqual(turns.length, 1);
		assert.strictEqual(turns[0].state, TurnState.Error);
	});

	test('turn with no recognizable items is dropped', () => {
		const turns = replayThreadToTurns({
			id: 'thr',
			turns: [{
				id: 'turn_a',
				items: [
					{ type: 'plan', id: 'p', text: 'planning' } as never,
				],
				itemsView: { type: 'full' } as never,
				status: 'completed' as never,
				error: null,
				startedAt: null, completedAt: null, durationMs: null,
			}],
		} as never);
		assert.deepStrictEqual(turns, []);
	});

	test('reasoning + tool + agent items replay as structured thinking/tool/text parts in order', () => {
		const turns = replayThreadToTurns({
			id: 'thr',
			turns: [{
				id: 'turn_a',
				items: [
					{ type: 'userMessage', id: 'u1', content: [{ type: 'text', text: 'do it', text_elements: [] }] },
					{ type: 'reasoning', id: 'r1', summary: ['planning the work'], content: [] },
					{
						type: 'commandExecution', id: 'cmd1', command: 'ls', cwd: '/tmp', processId: null,
						source: 'agent', status: 'completed', commandActions: [], aggregatedOutput: 'a.ts\n', exitCode: 0, durationMs: 4,
					},
					{ type: 'agentMessage', id: 'a1', text: 'done', phase: null, memoryCitation: null },
				],
				itemsView: { type: 'full' } as never,
				status: 'completed' as never,
				error: null, startedAt: null, completedAt: null, durationMs: null,
			}],
		} as never);
		assert.strictEqual(turns.length, 1);
		assert.strictEqual(turns[0].message.text, 'do it');
		const parts = turns[0].responseParts;
		assert.deepStrictEqual(parts.map(p => p.kind), [ResponsePartKind.Reasoning, ResponsePartKind.ToolCall, ResponsePartKind.Markdown]);
		assert.strictEqual((parts[0] as { content: string }).content, 'planning the work');
		const toolCall = (parts[1] as ToolCallResponsePart).toolCall as ToolCallCompletedState;
		assert.strictEqual(toolCall.status, ToolCallStatus.Completed);
		assert.strictEqual(toolCall.toolName, 'shell');
		assert.strictEqual(toolCall.pastTenseMessage, 'Ran `ls`');
		assert.deepStrictEqual(toolCall.content, [{ type: ToolResultContentType.Text, text: 'a.ts\n' }]);
		assert.strictEqual((parts[2] as { content: string }).content, 'done');
	});

	test('turn with only tool items (no user/agent text) is preserved', () => {
		const turns = replayThreadToTurns({
			id: 'thr',
			turns: [{
				id: 'turn_a',
				items: [
					{ type: 'webSearch', id: 'w1', query: 'q', action: { type: 'search', query: 'q', queries: null } },
				],
				itemsView: { type: 'full' } as never,
				status: 'completed' as never,
				error: null, startedAt: null, completedAt: null, durationMs: null,
			}],
		} as never);
		assert.strictEqual(turns.length, 1);
		assert.strictEqual(turns[0].responseParts.length, 1);
		assert.strictEqual(turns[0].responseParts[0].kind, ResponsePartKind.ToolCall);
	});

	test('multi-turn thread preserves order', () => {
		const turns = replayThreadToTurns({
			id: 'thr',
			turns: [
				{
					id: 't1',
					items: [
						{ type: 'userMessage', id: 'u', content: [{ type: 'text', text: 'first', text_elements: [] }] },
						{ type: 'agentMessage', id: 'a', text: 'one', phase: null, memoryCitation: null },
					],
					itemsView: { type: 'full' } as never,
					status: 'completed' as never,
					error: null, startedAt: null, completedAt: null, durationMs: null,
				},
				{
					id: 't2',
					items: [
						{ type: 'userMessage', id: 'u2', content: [{ type: 'text', text: 'second', text_elements: [] }] },
						{ type: 'agentMessage', id: 'a2', text: 'two', phase: null, memoryCitation: null },
					],
					itemsView: { type: 'full' } as never,
					status: 'completed' as never,
					error: null, startedAt: null, completedAt: null, durationMs: null,
				},
			],
		} as never);
		assert.deepStrictEqual(turns.map(t => t.id), ['t1', 't2']);
	});
});
