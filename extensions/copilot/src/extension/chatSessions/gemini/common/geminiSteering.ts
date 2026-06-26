/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Gemini steering — the machine-readable *label* and the *verifiable primitive* for the Gemini
 * provider's steering tier, set from the live-vs-resume spike (AC-P1.0,
 * `src/vs/platform/agentHost/node/gemini/ACP-STEERING-SPIKE.md`) and DN-4.
 *
 * The spike found that, against the pinned **gemini-cli 0.47.0** ACP agent, a second
 * `session/prompt` sent mid-turn does **not** inject into the running turn (no Tier-1 native
 * mid-flight injection) and does **not** queue — it **aborts and replaces** the in-flight turn:
 *  - E3 — the ACP receive loop dispatches the second prompt concurrently (no `await`); and
 *  - E4 — `session.prompt()` runs `this.pendingPrompt?.abort()` first, cancelling the in-flight turn; and
 *  - E5 — the pre-empted turn resolves with `stopReason: "cancelled"`.
 *
 * So Gemini steering is **Tier 2 — emulated, realized via ACP abort-and-replace**. This module
 * makes that tier a concrete, exported artifact instead of prose, so the descriptor's
 * `capabilities.steering: true` is unambiguously "emulated cancel-and-replace" (which DN-4
 * permits) and never reads as Claude-grade native injection:
 *
 *  - {@link GEMINI_STEERING} / {@link GEMINI_STEERING_TIER} — the label.
 *  - {@link buildGeminiSteeringRequests} — the abort-and-replace primitive `IAgent.setPendingMessages()`
 *    is built on: cancel the in-flight turn, then run the steering message as a fresh prompt.
 *  - {@link isPreemptedBySteering} — reconcile the pre-empted turn's `stopReason: "cancelled"` (E5)
 *    so the adapter treats it as a steering pre-emption, not a user-visible failure.
 *
 * Pure data + pure functions (no Node.js / `vscode` imports) so the steering contract is
 * unit-verifiable without spawning gemini-cli — see `test/geminiSteering.spec.ts`.
 */

import type { GeminiAcpContentBlock } from './geminiAcpTypes';
import { GEMINI_CLI_PINNED_VERSION } from './geminiProviderDescriptor';

// ---- Steering tier label -------------------------------------------------

/**
 * Steering tier for a provider.
 *
 *  - `'native'`   — true mid-flight injection into a continuing turn (Claude's `priority: 'now'`
 *    `SDKUserMessage` inside one `query()` iterable). Gemini is **not** this.
 *  - `'emulated'` — the adapter orchestrates steering on top of a coarser primitive (here, ACP
 *    abort-and-replace); the pre-empted turn ends rather than continues.
 */
export type GeminiSteeringTier = 'native' | 'emulated';

/** How emulated Gemini steering is realized — abort the in-flight turn, replace it with the new prompt. */
export type GeminiSteeringMechanism = 'acp-abort-and-replace';

/** The Gemini steering tier, fixed from the AC-P1.0 spike (Tier 2, emulated). */
export const GEMINI_STEERING_TIER: GeminiSteeringTier = 'emulated';

/**
 * Machine-readable steering label for the Gemini provider — the durable, testable encoding of the
 * spike verdict + DN-4, so downstream code (and the descriptor's `capabilities.steering`) can never
 * silently treat Gemini steering as native injection.
 */
export interface IGeminiSteeringLabel {
	/** The steering tier — `'emulated'` for Gemini (set from the AC-P1.0 spike). */
	readonly tier: GeminiSteeringTier;
	/** `false` — Gemini has no Tier-1 native mid-flight injection; the agent cancels, it does not continue the turn. */
	readonly native: boolean;
	/** How emulated steering is realized: ACP abort-and-replace. */
	readonly mechanism: GeminiSteeringMechanism;
	/** The gemini-cli version this tier is pinned to; a pin bump requires re-running the spike. */
	readonly pinnedVersion: string;
	/** The `stopReason` the pre-empted (cancelled) turn resolves with — spike E5. */
	readonly preemptedTurnStopReason: 'cancelled';
}

/** The Gemini steering label — emulated, ACP abort-and-replace, pinned to {@link GEMINI_CLI_PINNED_VERSION}. */
export const GEMINI_STEERING: IGeminiSteeringLabel = {
	tier: GEMINI_STEERING_TIER,
	native: false,
	mechanism: 'acp-abort-and-replace',
	pinnedVersion: GEMINI_CLI_PINNED_VERSION,
	preemptedTurnStopReason: 'cancelled',
};

// ---- Abort-and-replace primitive -----------------------------------------

/**
 * A single ACP JSON-RPC request the Gemini adapter sends to perform emulated steering. Narrowed to
 * the two methods the abort-and-replace primitive uses.
 */
export interface IGeminiAcpSteeringRequest {
	/** `session/cancel` aborts the in-flight turn; `session/prompt` runs the steering message as a fresh turn. */
	readonly method: 'session/cancel' | 'session/prompt';
	/** ACP request params (`{ sessionId }` for cancel; `{ sessionId, prompt }` for the replacement). */
	readonly params: Record<string, unknown>;
}

/**
 * Build the ACP request sequence that realizes emulated steering for Gemini: **abort-and-replace**.
 *
 * Per the spike, a fresh `session/prompt` alone already aborts the in-flight turn on 0.47.0 (the
 * agent's `prompt()` runs `pendingPrompt?.abort()` first — E4). This builder issues the **explicit**
 * two-step form DN-4 also sanctions — `session/cancel` then `session/prompt` — so the abort is
 * deterministic and not reliant on the bundle's abort-first behavior across pins. Either way the
 * pre-empted turn resolves `stopReason: "cancelled"` (E5); reconcile it with {@link isPreemptedBySteering}.
 *
 * This is the primitive `IAgent.setPendingMessages()` is built on for Gemini; it is intentionally a
 * pure request builder so the steering contract is verifiable without a live agent.
 *
 * @param sessionId The ACP session whose in-flight turn is being steered.
 * @param message   The steering message — a plain string (wrapped into one ACP text block) or
 *                  pre-built ACP content blocks forwarded verbatim.
 */
export function buildGeminiSteeringRequests(
	sessionId: string,
	message: string | readonly GeminiAcpContentBlock[],
): readonly IGeminiAcpSteeringRequest[] {
	const prompt: readonly GeminiAcpContentBlock[] =
		typeof message === 'string' ? [{ type: 'text', text: message }] : message;
	return [
		{ method: 'session/cancel', params: { sessionId } },
		{ method: 'session/prompt', params: { sessionId, prompt } },
	];
}

// ---- Pre-empted-turn reconciliation --------------------------------------

/**
 * Whether a turn's `stopReason` means it was **pre-empted by steering** rather than ending normally.
 *
 * Per spike E5, the turn the steering prompt aborts resolves with `stopReason: "cancelled"`. The
 * adapter uses this to reconcile that turn as a steering pre-emption (the next prompt supersedes it),
 * not a user-visible error or a clean completion.
 */
export function isPreemptedBySteering(stopReason: string | undefined): boolean {
	return stopReason === GEMINI_STEERING.preemptedTurnStopReason;
}
