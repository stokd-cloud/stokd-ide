/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * AC-P3.1 — Grok sessions replay/stream. The SAME normalizer serves both
 * directions: the `chat_history.jsonl` transcript (replay) and the
 * `events.jsonl` / `--output-format streaming-json` live stream (stream),
 * because grok's `type` discriminant value sets are disjoint.
 */

import { describe, expect, it } from 'vitest';
import {
	normalizedEventTypes,
	recordNormalizedEvents,
	type NormalizedAssistantTextDelta,
	type NormalizedAssistantThinking,
	type NormalizedEdit,
	type NormalizedEvent,
	type NormalizedPermissionRequested,
	type NormalizedToolSimple,
	type NormalizedToolStart,
	type NormalizedToolTerminal,
} from '../../../common/agentCliProvider';
import { GrokEventNormalizer } from '../grokStreamingEvents';
import type { GrokStreamRecord } from '../grokStreamTypes';

// A full assistant turn expressed as `chat_history.jsonl` transcript records —
// the replay source. The same normalizer renders the live event stream too
// (see the streaming describe block below).
const REPLAY_TURN: readonly GrokStreamRecord[] = [
	{ type: 'reasoning', text: 'Let me check.' },
	{ type: 'assistant', text: 'Hello ' },
	{ type: 'assistant', text: 'world' },
	{ type: 'backend_tool_call', id: 't1', name: 'shell', input: { command: 'ls -la' } },
	{ type: 'tool_result', id: 't1', output: 'file1\nfile2' },
	{ type: 'backend_tool_call', id: 't2', name: 'str_replace', input: { path: '/repo/app.ts' } },
	{ type: 'tool_result', id: 't2', is_error: false, locations: [{ path: '/repo/app.ts' }] },
	{ type: 'backend_tool_call', id: 't3', name: 'read_file', input: { path: '/repo/cfg.json' } },
	{ type: 'tool_result', id: 't3' },
];

function run(records: readonly GrokStreamRecord[]): NormalizedEvent[] {
	return recordNormalizedEvents(new GrokEventNormalizer(), records);
}

describe('GrokEventNormalizer — identity', () => {
	it('is the grok provider normalizer', () => {
		expect(new GrokEventNormalizer().providerId).toBe('grok');
	});

	it('only ever emits members of the normalized vocabulary', () => {
		for (const ev of run(REPLAY_TURN)) {
			expect(normalizedEventTypes).toContain(ev.type);
		}
	});
});

describe('GrokEventNormalizer — replays a full transcript (AC-P3.1)', () => {
	it('maps the full turn to the expected ordered normalized sequence', () => {
		expect(run(REPLAY_TURN).map(e => e.type)).toEqual([
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

	it('surfaces reasoning and assistant text with their content', () => {
		const events = run(REPLAY_TURN);
		expect((events[0] as NormalizedAssistantThinking).content).toBe('Let me check.');
		expect((events[1] as NormalizedAssistantTextDelta).content).toBe('Hello ');
		expect((events[2] as NormalizedAssistantTextDelta).content).toBe('world');
	});

	it('maps a shell tool to tool.start → tool.terminal with command + output', () => {
		const events = run(REPLAY_TURN);
		const start = events[3] as NormalizedToolStart;
		expect(start.toolCallId).toBe('t1');
		expect(start.input).toEqual({ command: 'ls -la' });
		const terminal = events[4] as NormalizedToolTerminal;
		expect(terminal.type).toBe('tool.terminal');
		expect(terminal.command).toBe('ls -la');
		expect(terminal.output).toBe('file1\nfile2');
	});

	it('maps an edit tool to a normalized edit carrying the changed file URI', () => {
		const edit = run(REPLAY_TURN).find(e => e.type === 'edit') as NormalizedEdit;
		expect(edit.toolCallId).toBe('t2');
		expect(edit.editId).toBe('t2');
		expect(edit.uris).toHaveLength(1);
		expect(edit.uris[0].path).toBe('/repo/app.ts');
	});

	it('maps a read tool to a simple detail with the path from its opening input', () => {
		const simple = run(REPLAY_TURN).find(e => e.type === 'tool.simple') as NormalizedToolSimple;
		expect(simple.toolCallId).toBe('t3');
		expect(simple.description).toBe('read_file');
		expect(simple.detail).toBe('/repo/cfg.json');
	});

	it('marks a failed tool result as an error on completion', () => {
		const events = run([
			{ type: 'backend_tool_call', id: 'x', name: 'shell', input: { command: 'boom' } },
			{ type: 'tool_result', id: 'x', is_error: true, output: 'nope' },
		]);
		const complete = events.find(e => e.type === 'tool.complete');
		expect((complete as { isError?: boolean }).isError).toBe(true);
	});
});

describe('GrokEventNormalizer — streams a live event stream identically (AC-P3.1)', () => {
	// events.jsonl / streaming-json: tool_started / tool_completed instead of
	// backend_tool_call / tool_result, but the SAME normalized output.
	const LIVE_TURN: readonly GrokStreamRecord[] = [
		{ type: 'turn_started' },
		{ type: 'first_token' },
		{ type: 'assistant', text: 'Working' },
		{ type: 'tool_started', id: 's1', name: 'bash', input: { command: 'npm test' } },
		{ type: 'tool_completed', id: 's1', output: 'ok', status: 'completed' },
		{ type: 'turn_ended' },
	];

	it('maps live tool events to the same start → terminal → complete shape', () => {
		const types = run(LIVE_TURN).map(e => e.type);
		expect(types).toEqual([
			'assistant.textDelta',
			'tool.start',
			'tool.terminal',
			'tool.complete',
		]);
		const terminal = run(LIVE_TURN).find(e => e.type === 'tool.terminal') as NormalizedToolTerminal;
		expect(terminal.command).toBe('npm test');
		expect(terminal.output).toBe('ok');
	});

	it('drops lifecycle / bookkeeping events (turn_*, first_token, mcp_*, phase_changed, loop_started)', () => {
		expect(run([
			{ type: 'turn_started' },
			{ type: 'loop_started' },
			{ type: 'first_token' },
			{ type: 'phase_changed' },
			{ type: 'mcp_init_completed' },
			{ type: 'permission_resolved' },
			{ type: 'turn_ended' },
		])).toHaveLength(0);
	});

	it('surfaces a permission_requested event as a normalized permission request', () => {
		const events = run([
			{ type: 'permission_requested', request_id: 'p1', kind: 'shell', description: 'Run rm -rf', tool_call_id: 's9' },
		]);
		expect(events).toHaveLength(1);
		const perm = events[0] as NormalizedPermissionRequested;
		expect(perm.type).toBe('permission.requested');
		expect(perm.requestId).toBe('p1');
		expect(perm.kind).toBe('shell');
		expect(perm.description).toBe('Run rm -rf');
		expect(perm.toolCallId).toBe('s9');
	});
});

describe('GrokEventNormalizer — ignores non-assistant transcript records', () => {
	it('drops user and system records', () => {
		expect(run([
			{ type: 'user', text: 'my prompt' },
			{ type: 'system', prompt: 'you are grok' },
		])).toHaveLength(0);
	});

	it('emits eagerly — flush() at the turn boundary yields nothing extra', () => {
		const normalizer = new GrokEventNormalizer();
		const viaNormalize: NormalizedEvent[] = [];
		for (const r of REPLAY_TURN) {
			viaNormalize.push(...normalizer.normalize(r));
		}
		expect(normalizer.flush()).toHaveLength(0);
		expect(viaNormalize.map(e => e.type)).toEqual(run(REPLAY_TURN).map(e => e.type));
	});
});
