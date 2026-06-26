/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * AC-P1.4 — A Gemini turn emits the **same normalized turn-lifecycle events as
 * Claude**, verified by a recorded-event test.
 *
 * The provider-agnostic contract is {@link turnLifecycleEventTypes}: the AC-P0.5
 * recorded-event test (in `common/test/agentCliProviderRegistry.spec.ts`) proves
 * a Claude-labeled emitter produces exactly that vocabulary for a normal turn.
 * This test reconstructs that Claude reference verbatim, drives a representative
 * Gemini turn through the REAL {@link GeminiAcpEventNormalizer}, and asserts the
 * Gemini turn normalizes into the same turn-lifecycle vocabulary Claude does —
 * both recorded through the shared {@link recordNormalizedEvents} primitive.
 *
 * "The same events" is asserted at the vocabulary level (not byte-for-byte
 * ordering): Claude's lifecycle is the canonical superset; a streamed Gemini
 * turn's distinct events are exactly the streaming subset of that lifecycle
 * (the ACP `session/update` stream has no native mid-turn channel for `usage`,
 * `title`, or `tool.subagent`, which Claude sources elsewhere), and every event
 * Gemini emits is one the Claude reference also produced — with no out-of-band
 * `error` / `permission.requested` events.
 */

import { describe, expect, it } from 'vitest';
import {
	normalizedEventTypes,
	recordNormalizedEvents,
	turnLifecycleEventTypes,
	type AgentCliProviderId,
	type IEventNormalizer,
	type NormalizedEvent,
} from '../../../common/agentCliProvider';
import { GeminiAcpEventNormalizer } from '../geminiAcpEvents';
import type { GeminiAcpSessionUpdate } from '../geminiAcpTypes';

// ---------------------------------------------------------------------------
// Claude reference — reconstructed verbatim from the AC-P0.5 fixture so the
// comparison is provider-to-provider, not provider-against-a-bare-constant.
// ---------------------------------------------------------------------------

/** A representative {@link NormalizedEvent} for each canonical turn-lifecycle type. */
function sampleEventOfType(type: NormalizedEvent['type']): NormalizedEvent {
	switch (type) {
		case 'assistant.textDelta':
			return { type, content: 'Hello' };
		case 'assistant.thinking':
			return { type, content: 'reasoning…' };
		case 'tool.start':
			return { type, toolCallId: 'tc1', toolName: 'Bash', input: { command: 'ls' } };
		case 'tool.complete':
			return { type, toolCallId: 'tc1', toolName: 'Bash' };
		case 'tool.terminal':
			return { type, toolCallId: 'tc2', toolName: 'Bash', command: 'ls -la', output: 'a\nb' };
		case 'tool.simple':
			return { type, toolCallId: 'tc3', toolName: 'Glob', description: 'Searching files' };
		case 'tool.subagent':
			return { type, toolCallId: 'tc4', toolName: 'Agent', agentDisplayName: 'Agent' };
		case 'edit':
			return { type, toolCallId: 'tc5', uris: [], editId: 'e1' };
		case 'usage':
			return { type, inputTokens: 10, outputTokens: 20 };
		case 'title':
			return { type, title: 'My session' };
		default:
			throw new Error(`sampleEventOfType: ${type} is not part of the turn lifecycle`);
	}
}

/**
 * The Claude reference emitter (the AC-P0.5 pattern): emits each scripted
 * normalized event verbatim but buffers the turn-final `title`, releasing it
 * only on {@link IEventNormalizer.flush}. Proves the recorder drains the
 * emitter at the turn boundary — the same contract the Gemini normalizer is
 * measured against.
 */
function makeClaudeReferenceNormalizer(): IEventNormalizer<NormalizedEvent> {
	let bufferedTitle: NormalizedEvent | undefined;
	return {
		providerId: 'claude' as AgentCliProviderId,
		normalize(event) {
			if (event.type === 'title') {
				bufferedTitle = event;
				return [];
			}
			return [event];
		},
		flush() {
			if (!bufferedTitle) {
				return [];
			}
			const out = [bufferedTitle];
			bufferedTitle = undefined;
			return out;
		},
	};
}

// ---------------------------------------------------------------------------
// Gemini turn — the ACP `session/update.update` payloads gemini-cli 0.47.0
// streams for one assistant turn that exercises every lifecycle phase the ACP
// stream can express: thinking, streamed text, an execute tool (→ terminal
// output), an edit tool (→ file change) and a read tool (→ simple detail).
// ---------------------------------------------------------------------------

const GEMINI_TURN: readonly GeminiAcpSessionUpdate[] = [
	{ sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'Planning.' } },
	{ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'On ' } },
	{ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'it.' } },
	{ sessionUpdate: 'tool_call', toolCallId: 't1', title: 'ls -la', kind: 'execute', status: 'pending', rawInput: { command: 'ls -la' } },
	{ sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed', content: [{ type: 'content', content: { type: 'text', text: 'a.ts\nb.ts' } }] },
	{ sessionUpdate: 'tool_call', toolCallId: 't2', title: 'Edit app.ts', kind: 'edit', status: 'in_progress', locations: [{ path: '/repo/app.ts' }] },
	{ sessionUpdate: 'tool_call_update', toolCallId: 't2', status: 'completed', content: [{ type: 'diff', path: '/repo/app.ts', newText: 'export const x = 1;\n' }] },
	{ sessionUpdate: 'tool_call', toolCallId: 't3', title: 'Read cfg', kind: 'read', status: 'pending', locations: [{ path: '/repo/cfg.json' }] },
	{ sessionUpdate: 'tool_call_update', toolCallId: 't3', status: 'completed' },
];

/**
 * The turn-lifecycle event types a streamed Gemini turn exercises — the subset
 * of Claude's canonical {@link turnLifecycleEventTypes} expressible over the ACP
 * `session/update` stream.
 */
const GEMINI_SHARED_CORE: ReadonlyArray<NormalizedEvent['type']> = [
	'assistant.textDelta',
	'assistant.thinking',
	'tool.start',
	'tool.complete',
	'tool.terminal',
	'tool.simple',
	'edit',
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Gemini normalized telemetry — same turn-lifecycle vocabulary as Claude (AC-P1.4)', () => {

	// Both providers' turns are recorded through the SAME recordNormalizedEvents
	// primitive: normalize() per raw event, then a trailing flush().
	const geminiRecorded = recordNormalizedEvents(new GeminiAcpEventNormalizer(), GEMINI_TURN);
	const geminiTypes = geminiRecorded.map(e => e.type);

	const claudeRecorded = recordNormalizedEvents(
		makeClaudeReferenceNormalizer(),
		turnLifecycleEventTypes.map(sampleEventOfType),
	);
	const claudeTypes = new Set(claudeRecorded.map(e => e.type));

	it('the Claude reference recording is the canonical turn-lifecycle vocabulary', () => {
		// Anchors the comparison: the reference emits exactly Claude's lifecycle,
		// with the turn-final `title` appearing only because flush() was drained.
		expect(claudeRecorded.map(e => e.type)).toEqual([...turnLifecycleEventTypes]);
		expect(claudeRecorded.at(-1)?.type).toBe('title');
	});

	it('every event a Gemini turn emits is a turn-lifecycle event Claude also emits', () => {
		expect(geminiRecorded.length).toBeGreaterThan(0);
		for (const ev of geminiRecorded) {
			expect(normalizedEventTypes).toContain(ev.type);    // a member of the vocabulary,
			expect(turnLifecycleEventTypes).toContain(ev.type); // ...specifically a lifecycle (not out-of-band) one,
			expect(claudeTypes).toContain(ev.type);             // ...that the Claude reference also produced.
		}
	});

	it('a normal Gemini turn emits no out-of-band events (error / permission.requested), like Claude', () => {
		expect(geminiTypes).not.toContain('error');
		expect(geminiTypes).not.toContain('permission.requested');
		// Claude's lifecycle excludes them too — parity holds on the exclusion.
		expect(claudeTypes.has('error')).toBe(false);
		expect(claudeTypes.has('permission.requested')).toBe(false);
	});

	it('the distinct events a Gemini turn emits equal the shared streaming core of Claude\'s lifecycle', () => {
		// Non-vacuous: the Gemini turn actually exercises text/thinking/tool/edit,
		// and the set it emits is exactly the streaming subset of Claude's lifecycle.
		expect(new Set(geminiTypes)).toEqual(new Set(GEMINI_SHARED_CORE));
		for (const type of GEMINI_SHARED_CORE) {
			expect(turnLifecycleEventTypes).toContain(type);
			expect(claudeTypes).toContain(type);
		}
	});

	it('maps each tool phase to the same normalized detail type Claude uses', () => {
		// execute → tool.start → tool.terminal → tool.complete
		expect(geminiTypes.slice(3, 6)).toEqual(['tool.start', 'tool.terminal', 'tool.complete']);
		// edit → tool.start → edit → tool.complete
		expect(geminiTypes.slice(6, 9)).toEqual(['tool.start', 'edit', 'tool.complete']);
		// read → tool.start → tool.simple → tool.complete
		expect(geminiTypes.slice(9, 12)).toEqual(['tool.start', 'tool.simple', 'tool.complete']);
	});

	it('the recorder captures the full turn through normalize(); the Gemini emitter buffers nothing', () => {
		// Gemini emits eagerly: flush() at the turn boundary yields nothing extra,
		// yet the whole turn is still recorded (the recorder drains flush() too).
		const normalizer = new GeminiAcpEventNormalizer();
		const viaNormalize: NormalizedEvent[] = [];
		for (const update of GEMINI_TURN) {
			viaNormalize.push(...normalizer.normalize(update));
		}
		expect(normalizer.flush()).toHaveLength(0);
		expect(viaNormalize.map(e => e.type)).toEqual(geminiTypes);
	});
});
