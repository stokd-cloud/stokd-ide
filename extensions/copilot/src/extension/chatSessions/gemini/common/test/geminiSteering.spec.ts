/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Work item 3.3 — Verify Gemini steering per spike result (AC-P1.2).
 *
 * The live-vs-resume spike (AC-P1.0, `node/gemini/ACP-STEERING-SPIKE.md`) found that a second
 * `session/prompt` sent mid-turn does NOT inject into the running turn — it ABORTS-AND-REPLACES it
 * (the in-flight turn resolves `stopReason: "cancelled"`; the new prompt runs as a fresh turn).
 * So AC-P1.2's "otherwise" branch applies: emulated steering is **labeled** (a machine-readable
 * tier, not just prose) and **verified** (the abort-and-replace primitive + the `cancelled`
 * reconciliation the spike's E3/E4/E5 evidence describes). This is the verification.
 */

import { describe, expect, it } from 'vitest';
import type { GeminiAcpContentBlock } from '../geminiAcpTypes';
import {
	GEMINI_STEERING,
	GEMINI_STEERING_TIER,
	buildGeminiSteeringRequests,
	isPreemptedBySteering,
} from '../geminiSteering';
import { geminiProviderDescriptor, GEMINI_CLI_PINNED_VERSION } from '../geminiProviderDescriptor';

// ---------------------------------------------------------------------------
// Labeled — emulated (Tier 2, abort-and-replace), explicitly NOT native injection
// ---------------------------------------------------------------------------

describe('gemini steering — labeled emulated (AC-P1.2 / DN-4)', () => {
	it('labels steering as Tier 2 emulated — NOT Claude-grade native mid-flight injection', () => {
		expect(GEMINI_STEERING_TIER).toBe('emulated');
		expect(GEMINI_STEERING.tier).toBe('emulated');
		// The spike's whole point: the agent cancels (E4/E5), it does not inject into a continuing turn.
		expect(GEMINI_STEERING.native).toBe(false);
		expect(GEMINI_STEERING.mechanism).toBe('acp-abort-and-replace');
	});

	it('binds the label to the spike target gemini-cli 0.47.0 (re-run the spike on a pin bump)', () => {
		expect(GEMINI_STEERING.pinnedVersion).toBe('0.47.0');
		// Single source of truth: the steering pin tracks the descriptor pin.
		expect(GEMINI_STEERING.pinnedVersion).toBe(GEMINI_CLI_PINNED_VERSION);
	});

	it('keeps descriptor.capabilities.steering consistent with the emulated label (DN-4: true ONLY as emulated)', () => {
		// DN-4 permits steering:true only because it is emulated cancel-and-replace, not native injection.
		expect(geminiProviderDescriptor.capabilities.steering).toBe(true);
		expect(GEMINI_STEERING.native).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Verified — the abort-and-replace primitive (spike E3/E4: cancel the in-flight turn, replace it)
// ---------------------------------------------------------------------------

describe('gemini steering — verified abort-and-replace primitive (AC-P1.2 / spike E3–E5)', () => {
	it('emits cancel-then-prompt (abort-and-replace), NOT a single priority:now injection', () => {
		const reqs = buildGeminiSteeringRequests('sess-1', 'steer: do X instead');
		expect(reqs.map(r => r.method)).toEqual(['session/cancel', 'session/prompt']);
	});

	it('cancels the running turn first, then runs the steering message as a fresh prompt', () => {
		const reqs = buildGeminiSteeringRequests('sess-1', 'steer: do X instead');
		const cancelIdx = reqs.findIndex(r => r.method === 'session/cancel');
		const promptIdx = reqs.findIndex(r => r.method === 'session/prompt');
		// Cancel MUST precede the replacement prompt — that ordering IS the abort-and-replace.
		expect(cancelIdx).toBe(0);
		expect(promptIdx).toBe(1);
		expect(reqs[0].params).toEqual({ sessionId: 'sess-1' });
		expect(reqs[1].params.sessionId).toBe('sess-1');
		expect(reqs[1].params.prompt).toEqual([{ type: 'text', text: 'steer: do X instead' }]);
	});

	it('wraps a plain steering string into a single ACP text content block', () => {
		const reqs = buildGeminiSteeringRequests('s', 'hello');
		expect(reqs[1].params.prompt).toEqual([{ type: 'text', text: 'hello' }]);
	});

	it('forwards pre-built ACP content blocks verbatim as the replacement prompt', () => {
		const blocks: readonly GeminiAcpContentBlock[] = [
			{ type: 'text', text: 'a' },
			{ type: 'text', text: 'b' },
		];
		const reqs = buildGeminiSteeringRequests('s', blocks);
		expect(reqs[1].params.prompt).toEqual(blocks);
	});
});

// ---------------------------------------------------------------------------
// Verified — reconcile the pre-empted turn's stopReason (spike E5)
// ---------------------------------------------------------------------------

describe('gemini steering — verified cancelled-turn reconciliation (AC-P1.2 / spike E5)', () => {
	it('recognizes the pre-empted turn stopReason "cancelled" as a steering pre-emption', () => {
		expect(GEMINI_STEERING.preemptedTurnStopReason).toBe('cancelled');
		expect(isPreemptedBySteering('cancelled')).toBe(true);
	});

	it('does NOT mistake a normal turn end / limit / refusal / missing reason for a steering pre-emption', () => {
		expect(isPreemptedBySteering('end_turn')).toBe(false);
		expect(isPreemptedBySteering('max_tokens')).toBe(false);
		expect(isPreemptedBySteering('refusal')).toBe(false);
		expect(isPreemptedBySteering(undefined)).toBe(false);
		expect(isPreemptedBySteering('')).toBe(false);
	});
});
