/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import {
	normalizedEventTypes,
	recordNormalizedEvents,
	type NormalizedEdit,
	type NormalizedAssistantTextDelta,
	type NormalizedAssistantThinking,
	type NormalizedEvent,
	type NormalizedToolSimple,
	type NormalizedToolStart,
	type NormalizedToolTerminal,
} from '../../../common/agentCliProvider';
import { GeminiAcpEventNormalizer } from '../geminiAcpEvents';
import type { GeminiAcpSessionUpdate } from '../geminiAcpTypes';

// A full assistant turn expressed as the ACP `session/update.update` payloads
// gemini-cli emits — used to verify BOTH a streamed live turn and a replayed
// history (loadSession replays the same `session/update` stream), per AC-P1.1.
const LIVE_TURN: readonly GeminiAcpSessionUpdate[] = [
	{ sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'Let me check.' } },
	{ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hello ' } },
	{ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'world' } },
	{ sessionUpdate: 'tool_call', toolCallId: 't1', title: 'ls -la', kind: 'execute', status: 'pending', rawInput: { command: 'ls -la' } },
	{ sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed', content: [{ type: 'content', content: { type: 'text', text: 'file1\nfile2' } }] },
	{ sessionUpdate: 'tool_call', toolCallId: 't2', title: 'Edit app.ts', kind: 'edit', status: 'in_progress', locations: [{ path: '/repo/app.ts' }] },
	{ sessionUpdate: 'tool_call_update', toolCallId: 't2', status: 'completed', content: [{ type: 'diff', path: '/repo/app.ts', newText: 'export const x = 1;\n' }] },
	{ sessionUpdate: 'tool_call', toolCallId: 't3', title: 'Read config', kind: 'read', status: 'pending', locations: [{ path: '/repo/cfg.json' }] },
	{ sessionUpdate: 'tool_call_update', toolCallId: 't3', status: 'completed' },
];

function run(updates: readonly GeminiAcpSessionUpdate[]): NormalizedEvent[] {
	return recordNormalizedEvents(new GeminiAcpEventNormalizer(), updates);
}

describe('GeminiAcpEventNormalizer — identity', () => {
	it('is the gemini provider normalizer', () => {
		expect(new GeminiAcpEventNormalizer().providerId).toBe('gemini');
	});

	it('only ever emits members of the normalized vocabulary', () => {
		for (const ev of run(LIVE_TURN)) {
			expect(normalizedEventTypes).toContain(ev.type);
		}
	});
});

describe('GeminiAcpEventNormalizer — streams a live turn incrementally (AC-P1.1)', () => {
	it('maps the full turn to the expected ordered normalized sequence', () => {
		const types = run(LIVE_TURN).map(e => e.type);
		expect(types).toEqual([
			'assistant.thinking',
			'assistant.textDelta',
			'assistant.textDelta',
			'tool.start',
			'tool.terminal',
			'tool.complete',
			'tool.start',
			'edit',
			'tool.complete',
			'tool.start',
			'tool.simple',
			'tool.complete',
		]);
	});

	it('surfaces thinking and assistant text deltas with their content', () => {
		const events = run(LIVE_TURN);
		expect((events[0] as NormalizedAssistantThinking).content).toBe('Let me check.');
		expect((events[1] as NormalizedAssistantTextDelta).content).toBe('Hello ');
		expect((events[2] as NormalizedAssistantTextDelta).content).toBe('world');
	});

	it('maps an execute tool to tool.start → tool.terminal with command + output', () => {
		const events = run(LIVE_TURN);
		const start = events[3] as NormalizedToolStart;
		expect(start.type).toBe('tool.start');
		expect(start.toolCallId).toBe('t1');
		expect(start.input).toEqual({ command: 'ls -la' });
		const terminal = events[4] as NormalizedToolTerminal;
		expect(terminal.type).toBe('tool.terminal');
		expect(terminal.command).toBe('ls -la');
		expect(terminal.output).toBe('file1\nfile2');
	});

	it('maps an edit tool to a normalized edit carrying the changed file URI', () => {
		const edit = run(LIVE_TURN).find(e => e.type === 'edit') as NormalizedEdit;
		expect(edit).toBeDefined();
		expect(edit.toolCallId).toBe('t2');
		expect(edit.editId).toBe('t2');
		expect(edit.uris).toHaveLength(1);
		expect(edit.uris[0].path).toBe('/repo/app.ts');
	});

	it('maps a read tool to a simple detail with its path', () => {
		const simple = run(LIVE_TURN).find(e => e.type === 'tool.simple') as NormalizedToolSimple;
		expect(simple.toolCallId).toBe('t3');
		expect(simple.description).toBe('Read config');
		expect(simple.detail).toBe('/repo/cfg.json');
	});

	it('marks a failed tool as an error on completion', () => {
		const events = run([
			{ sessionUpdate: 'tool_call', toolCallId: 'x', title: 'boom', kind: 'execute', status: 'pending', rawInput: { command: 'boom' } },
			{ sessionUpdate: 'tool_call_update', toolCallId: 'x', status: 'failed', content: [{ type: 'content', content: { type: 'text', text: 'nope' } }] },
		]);
		const complete = events.find(e => e.type === 'tool.complete');
		expect(complete).toBeDefined();
		expect((complete as { isError?: boolean }).isError).toBe(true);
	});
});

describe('GeminiAcpEventNormalizer — replays full history with thinking/tool parts (AC-P1.1)', () => {
	// loadSession replays a single already-`completed` tool_call (no separate
	// update). The normalizer must still produce start → detail → complete so a
	// restored session renders identically to a live one.
	it('expands an already-completed tool_call into start → detail → complete', () => {
		const types = run([
			{ sessionUpdate: 'tool_call', toolCallId: 'r1', title: 'grep foo', kind: 'search', status: 'completed', locations: [{ path: '/repo' }] },
		]).map(e => e.type);
		expect(types).toEqual(['tool.start', 'tool.simple', 'tool.complete']);
	});

	it('replays a completed execute tool with captured terminal output', () => {
		const events = run([
			{ sessionUpdate: 'tool_call', toolCallId: 'r2', title: 'npm test', kind: 'execute', status: 'completed', rawInput: { command: 'npm test' }, content: [{ type: 'content', content: { type: 'text', text: 'ok' } }] },
		]);
		const terminal = events.find(e => e.type === 'tool.terminal') as NormalizedToolTerminal;
		expect(terminal.command).toBe('npm test');
		expect(terminal.output).toBe('ok');
	});
});

describe('GeminiAcpEventNormalizer — ignores non-assistant updates', () => {
	it('drops user message chunks, plan, command-list and mode updates', () => {
		const events = run([
			{ sessionUpdate: 'user_message_chunk', content: { type: 'text', text: 'my prompt' } },
			{ sessionUpdate: 'plan', entries: [{ content: 'step', priority: 'high', status: 'pending' }] },
			{ sessionUpdate: 'available_commands_update', availableCommands: [] },
			{ sessionUpdate: 'current_mode_update', currentModeId: 'default' },
		]);
		expect(events).toHaveLength(0);
	});

	it('drops non-text content blocks in assistant chunks', () => {
		const events = run([
			{ sessionUpdate: 'agent_message_chunk', content: { type: 'image', mimeType: 'image/png', data: 'AAAA' } },
		]);
		expect(events).toHaveLength(0);
	});
});
