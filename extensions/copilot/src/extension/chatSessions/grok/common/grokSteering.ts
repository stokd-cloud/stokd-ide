/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Grok steering — the machine-readable *label* and the *verifiable primitive* for the Grok
 * provider's steering tier (DN-5).
 *
 * Grok is a **spawn-per-turn** CLI: a turn is a child `grok` process, and there is no live
 * mid-flight injection channel into a running turn. So Grok steering is **Tier 2 — emulated,
 * realized via spawn abort-and-resume**: abort the in-flight child (SIGTERM), then resume the same
 * session with the steering message as a fresh `grok -r <session-id>` turn. The session id is the
 * UUID-v7 that names the on-disk session dir (discovery gate Q3), so abort+resume reuses the exact
 * session the user was steering.
 *
 * This module makes that tier a concrete, exported artifact instead of prose, so the descriptor's
 * `capabilities.steering: true` is unambiguously "emulated abort-and-resume" (which DN-4 permits)
 * and never reads as Claude-grade native injection:
 *  - {@link GROK_STEERING} / {@link GROK_STEERING_TIER} — the label.
 *  - {@link buildGrokSteeringSpawn} — the abort-and-resume primitive `IAgent.setPendingMessages()`
 *    is built on: abort the in-flight spawn, then resume the session with the steering message.
 *  - {@link isAbortedBySteering} — reconcile the aborted child's termination signal so the adapter
 *    treats the pre-empted turn as a steering pre-emption, not a user-visible failure.
 *
 * Pure data + pure functions (no Node.js / `vscode` imports) so the steering contract is
 * unit-verifiable without spawning grok — see `test/grokSteering.spec.ts`.
 */

import { GROK_CLI_PINNED_VERSION, GROK_HEADLESS_SINGLE_FLAG, GROK_OUTPUT_FORMAT_FLAG, GROK_RESUME_FLAG } from './grokProviderDescriptor';

// ---- Steering tier label -------------------------------------------------

/**
 * Steering tier for a provider.
 *
 *  - `'native'`   — true mid-flight injection into a continuing turn (Claude's `priority: 'now'`).
 *    Grok is **not** this.
 *  - `'emulated'` — the adapter orchestrates steering on top of a coarser primitive (here, spawn
 *    abort-and-resume); the pre-empted turn ends rather than continues.
 */
export type GrokSteeringTier = 'native' | 'emulated';

/** How emulated Grok steering is realized — abort the in-flight spawn, resume the session. */
export type GrokSteeringMechanism = 'spawn-abort-and-resume';

/** The Grok steering tier — Tier 2, emulated (spawn-per-turn has no native injection). */
export const GROK_STEERING_TIER: GrokSteeringTier = 'emulated';

/** The signal used to abort the in-flight Grok child before resuming (graceful terminate). */
export const GROK_STEERING_ABORT_SIGNAL = 'SIGTERM';

/**
 * Machine-readable steering label for the Grok provider — the durable, testable encoding of DN-5,
 * so downstream code (and the descriptor's `capabilities.steering`) can never silently treat Grok
 * steering as native injection.
 */
export interface IGrokSteeringLabel {
	/** The steering tier — `'emulated'` for Grok (spawn-per-turn). */
	readonly tier: GrokSteeringTier;
	/** `false` — Grok has no native mid-flight injection; the adapter aborts + resumes. */
	readonly native: boolean;
	/** How emulated steering is realized: spawn abort-and-resume. */
	readonly mechanism: GrokSteeringMechanism;
	/** The grok CLI version this tier is pinned to (discovery gate). */
	readonly pinnedVersion: string;
	/** The signal the in-flight child is aborted with before the resume spawn. */
	readonly abortSignal: string;
}

/** The Grok steering label — emulated, spawn abort-and-resume, pinned to {@link GROK_CLI_PINNED_VERSION}. */
export const GROK_STEERING: IGrokSteeringLabel = {
	tier: GROK_STEERING_TIER,
	native: false,
	mechanism: 'spawn-abort-and-resume',
	pinnedVersion: GROK_CLI_PINNED_VERSION,
	abortSignal: GROK_STEERING_ABORT_SIGNAL,
};

// ---- Abort-and-resume primitive ------------------------------------------

/** The abort-then-resume spawn the Grok adapter performs for emulated steering. */
export interface IGrokSteeringSpawn {
	/** Abort the in-flight child before resuming (emulated steering = abort + resume). */
	readonly abortInFlight: true;
	/** The signal used to abort the in-flight child. */
	readonly abortSignal: string;
	/**
	 * The argv (args array — never a shell string, never `shell: true`) to resume the session with
	 * the steering message: `grok -r <sessionId> -p <message> --output-format streaming-json`.
	 */
	readonly resumeArgs: readonly string[];
}

/**
 * Build the abort-and-resume spawn that realizes emulated steering for Grok.
 *
 * The session id is the UUID-v7 that names the on-disk session dir; resuming with `-r <id>` reuses
 * the exact session the user was steering. The steering message is carried as a discrete `-p`
 * argv token (never concatenated into a shell command line) so there is no shell-injection surface
 * — §10.2 requires args arrays, never `shell: true`.
 *
 * This is the primitive `IAgent.setPendingMessages()` is built on for Grok; it is intentionally a
 * pure builder so the steering contract is verifiable without a live `grok` process.
 */
export function buildGrokSteeringSpawn(sessionId: string, message: string): IGrokSteeringSpawn {
	return {
		abortInFlight: true,
		abortSignal: GROK_STEERING_ABORT_SIGNAL,
		resumeArgs: [
			GROK_RESUME_FLAG,
			sessionId,
			GROK_HEADLESS_SINGLE_FLAG,
			message,
			GROK_OUTPUT_FORMAT_FLAG,
			'streaming-json',
		],
	};
}

// ---- Pre-empted-turn reconciliation --------------------------------------

/**
 * Whether a terminated child's signal means it was **aborted by steering** rather than failing on
 * its own. The adapter aborts the in-flight turn with {@link GROK_STEERING_ABORT_SIGNAL}; a child
 * that exits with that signal is a steering pre-emption (the resume spawn supersedes it), not a
 * user-visible error.
 */
export function isAbortedBySteering(signal: string | undefined): boolean {
	return signal === GROK_STEERING_ABORT_SIGNAL;
}
