/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import {
	buildGrokSteeringSpawn,
	GROK_STEERING,
	GROK_STEERING_ABORT_SIGNAL,
	GROK_STEERING_TIER,
	isAbortedBySteering,
} from '../grokSteering';

describe('grok steering emulated (spawn-abort-and-resume, DN-5)', () => {
	it('is labeled emulated, never native injection', () => {
		expect(GROK_STEERING_TIER).toBe('emulated');
		expect(GROK_STEERING.tier).toBe('emulated');
		expect(GROK_STEERING.native).toBe(false);
		expect(GROK_STEERING.mechanism).toBe('spawn-abort-and-resume');
		expect(GROK_STEERING.pinnedVersion).toBe('0.2.51');
	});

	it('builds an abort-then-resume spawn with -r <id> as an args-array (never a shell string)', () => {
		const spawn = buildGrokSteeringSpawn('019e-abc', 'change the plan');
		expect(spawn.abortInFlight).toBe(true);
		const i = spawn.resumeArgs.indexOf('-r');
		expect(i).toBeGreaterThanOrEqual(0);
		// the session id is its own adjacent argv token
		expect(spawn.resumeArgs[i + 1]).toBe('019e-abc');
		// the steering message is its own discrete token, not concatenated into a shell line
		expect(spawn.resumeArgs).toContain('change the plan');
		// no element is a packed shell command line (no &&, ||, ; operators)
		expect(spawn.resumeArgs.every(a => !/&&|\|\||;/.test(a))).toBe(true);
	});

	it('recognizes a steering-aborted turn so it is not surfaced as a failure', () => {
		expect(GROK_STEERING_ABORT_SIGNAL).toBe('SIGTERM');
		expect(isAbortedBySteering('SIGTERM')).toBe(true);
		expect(isAbortedBySteering('SIGKILL')).toBe(false);
		expect(isAbortedBySteering(undefined)).toBe(false);
	});
});
