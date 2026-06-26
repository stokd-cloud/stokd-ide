/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { threadItemToResponseParts } from '../../../node/codex/codexThreadItemFormatter.js';
import { ResponsePartKind, ToolCallConfirmationReason, ToolCallStatus, ToolResultContentType, type ToolCallCompletedState, type ToolCallResponsePart } from '../../../common/state/sessionState.js';

function onlyToolCall(item: unknown): ToolCallCompletedState {
	const parts = threadItemToResponseParts(item as never);
	assert.strictEqual(parts.length, 1, 'expected a single response part');
	assert.strictEqual(parts[0].kind, ResponsePartKind.ToolCall);
	const toolCall = (parts[0] as ToolCallResponsePart).toolCall;
	assert.strictEqual(toolCall.status, ToolCallStatus.Completed);
	assert.ok(typeof toolCall.toolCallId === 'string' && toolCall.toolCallId.length > 0, 'toolCallId should be a non-empty string');
	return toolCall as ToolCallCompletedState;
}

suite('codexThreadItemFormatter', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('agentMessage → single markdown text part', () => {
		const parts = threadItemToResponseParts({ type: 'agentMessage', id: 'a', text: 'hello', phase: null, memoryCitation: null } as never);
		assert.strictEqual(parts.length, 1);
		assert.strictEqual(parts[0].kind, ResponsePartKind.Markdown);
		assert.strictEqual((parts[0] as { content: string }).content, 'hello');
		assert.ok(typeof (parts[0] as { id: string }).id === 'string' && (parts[0] as { id: string }).id.length > 0);
	});

	test('agentMessage with empty text → no parts', () => {
		assert.deepStrictEqual(threadItemToResponseParts({ type: 'agentMessage', id: 'a', text: '', phase: null, memoryCitation: null } as never), []);
	});

	test('reasoning → one thinking part per non-empty summary then content entry', () => {
		const parts = threadItemToResponseParts({ type: 'reasoning', id: 'r', summary: ['thinking a', '', 'thinking b'], content: ['raw c'] } as never);
		assert.deepStrictEqual(parts.map(p => p.kind), [ResponsePartKind.Reasoning, ResponsePartKind.Reasoning, ResponsePartKind.Reasoning]);
		assert.deepStrictEqual(parts.map(p => (p as { content: string }).content), ['thinking a', 'thinking b', 'raw c']);
		for (const p of parts) {
			assert.ok(typeof (p as { id: string }).id === 'string' && (p as { id: string }).id.length > 0);
		}
	});

	test('reasoning with no usable text → no parts', () => {
		assert.deepStrictEqual(threadItemToResponseParts({ type: 'reasoning', id: 'r', summary: ['', ''], content: [] } as never), []);
	});

	test('commandExecution (success) → completed shell tool call with output', () => {
		const toolCall = onlyToolCall({
			type: 'commandExecution', id: 'cmd', command: 'ls -la', cwd: '/tmp', processId: null,
			source: 'agent', status: 'completed', commandActions: [], aggregatedOutput: 'out\n', exitCode: 0, durationMs: 5,
		});
		assert.strictEqual(toolCall.toolName, 'shell');
		assert.strictEqual(toolCall.displayName, 'Run shell command');
		assert.strictEqual(toolCall.invocationMessage, 'ls -la');
		assert.strictEqual(toolCall.toolInput, 'ls -la');
		assert.strictEqual(toolCall.confirmed, ToolCallConfirmationReason.NotNeeded);
		assert.strictEqual(toolCall.success, true);
		assert.strictEqual(toolCall.pastTenseMessage, 'Ran `ls -la`');
		assert.deepStrictEqual(toolCall.content, [{ type: ToolResultContentType.Text, text: 'out\n' }]);
		assert.strictEqual(toolCall.error, undefined);
		assert.deepStrictEqual(toolCall._meta, { toolKind: 'terminal' });
	});

	test('commandExecution (non-zero exit) → failed shell tool call with error and no content', () => {
		const toolCall = onlyToolCall({
			type: 'commandExecution', id: 'cmd', command: 'false', cwd: '/tmp', processId: null,
			source: 'agent', status: 'completed', commandActions: [], aggregatedOutput: '', exitCode: 1, durationMs: 3,
		});
		assert.strictEqual(toolCall.success, false);
		assert.strictEqual(toolCall.pastTenseMessage, 'Ran `false` (exit 1)');
		assert.strictEqual(toolCall.content, undefined);
		assert.deepStrictEqual(toolCall.error, { message: 'Exit code 1' });
	});

	test('webSearch → completed search tool call', () => {
		const toolCall = onlyToolCall({
			type: 'webSearch', id: 'web', query: 'vscode tests', action: { type: 'search', query: 'vscode tests', queries: null },
		});
		assert.strictEqual(toolCall.toolName, 'web_search');
		assert.strictEqual(toolCall.displayName, 'Web search');
		assert.strictEqual(toolCall.invocationMessage, 'vscode tests');
		assert.strictEqual(toolCall.success, true);
		assert.strictEqual(toolCall.pastTenseMessage, 'Searched vscode tests');
		assert.strictEqual(toolCall.content, undefined);
		assert.deepStrictEqual(toolCall._meta, { toolKind: 'search' });
	});

	test('fileChange → completed file edit tool call with diff output', () => {
		const toolCall = onlyToolCall({
			type: 'fileChange', id: 'file', status: 'completed',
			changes: [{ path: 'src/a.ts', kind: { type: 'update', move_path: null }, diff: '@@ -1 +1 @@\n-old\n+new' }],
		});
		assert.strictEqual(toolCall.toolName, 'file_edit');
		assert.strictEqual(toolCall.displayName, 'Apply file changes');
		assert.strictEqual(toolCall.invocationMessage, 'update: src/a.ts');
		assert.strictEqual(toolCall.success, true);
		assert.strictEqual(toolCall.pastTenseMessage, 'Applied file changes');
		assert.deepStrictEqual(toolCall.content, [{ type: ToolResultContentType.Text, text: 'update: src/a.ts\n@@ -1 +1 @@\n-old\n+new' }]);
	});

	test('fileChange (failed patch) → failed file edit tool call', () => {
		const toolCall = onlyToolCall({
			type: 'fileChange', id: 'file', status: 'failed',
			changes: [{ path: 'src/a.ts', kind: { type: 'add' }, diff: '+hello' }],
		});
		assert.strictEqual(toolCall.success, false);
		assert.strictEqual(toolCall.pastTenseMessage, 'Failed to apply file changes');
		assert.deepStrictEqual(toolCall.error, { message: 'Patch failed' });
	});

	test('mcpToolCall → completed tool call namespaced by server.tool', () => {
		const toolCall = onlyToolCall({
			type: 'mcpToolCall', id: 'mcp', server: 'github', tool: 'search', status: 'completed',
			arguments: { query: 'vscode' }, mcpAppResourceUri: undefined, pluginId: null,
			result: { content: ['done'], structuredContent: { count: 1 }, _meta: null }, error: null, durationMs: 5,
		});
		assert.strictEqual(toolCall.toolName, 'github.search');
		assert.strictEqual(toolCall.displayName, 'search');
		assert.strictEqual(toolCall.invocationMessage, 'Calling github.search');
		assert.strictEqual(toolCall.toolInput, '{\n  "query": "vscode"\n}');
		assert.strictEqual(toolCall.success, true);
		assert.strictEqual(toolCall.pastTenseMessage, 'Called github.search');
		assert.deepStrictEqual(toolCall.content, [{ type: ToolResultContentType.Text, text: 'done\n{\n  "count": 1\n}' }]);
	});

	test('mcpToolCall (error) → failed tool call', () => {
		const toolCall = onlyToolCall({
			type: 'mcpToolCall', id: 'mcp', server: 'github', tool: 'search', status: 'failed',
			arguments: {}, mcpAppResourceUri: undefined, pluginId: null,
			result: null, error: { message: 'boom' }, durationMs: 1,
		});
		assert.strictEqual(toolCall.success, false);
		assert.strictEqual(toolCall.pastTenseMessage, 'Failed to call github.search');
		assert.deepStrictEqual(toolCall.content, [{ type: ToolResultContentType.Text, text: 'boom' }]);
		assert.deepStrictEqual(toolCall.error, { message: 'boom' });
	});

	test('dynamicToolCall → completed tool call namespaced by namespace.tool', () => {
		const toolCall = onlyToolCall({
			type: 'dynamicToolCall', id: 'dyn', namespace: 'client', tool: 'lookup', arguments: { symbol: 'A' }, status: 'completed',
			contentItems: [{ type: 'inputText', text: 'Found A' }], success: true, durationMs: 5,
		});
		assert.strictEqual(toolCall.toolName, 'client.lookup');
		assert.strictEqual(toolCall.displayName, 'lookup');
		assert.strictEqual(toolCall.invocationMessage, 'Calling client.lookup');
		assert.strictEqual(toolCall.toolInput, '{\n  "symbol": "A"\n}');
		assert.strictEqual(toolCall.success, true);
		assert.strictEqual(toolCall.pastTenseMessage, 'Called client.lookup');
		assert.deepStrictEqual(toolCall.content, [{ type: ToolResultContentType.Text, text: 'Found A' }]);
	});

	test('unsupported item types (plan, userMessage) → no parts', () => {
		assert.deepStrictEqual(threadItemToResponseParts({ type: 'plan', id: 'p', text: 'planning' } as never), []);
		assert.deepStrictEqual(threadItemToResponseParts({ type: 'userMessage', id: 'u', content: [{ type: 'text', text: 'hi', text_elements: [] }] } as never), []);
	});
});
