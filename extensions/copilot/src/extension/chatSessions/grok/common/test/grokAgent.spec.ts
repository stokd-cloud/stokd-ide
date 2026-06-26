/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import { GROK_AGENT_REGISTRATION } from '../../node/grokAgentRegistration';

/**
 * AC-P3.2: Grok node adapter registration smoke test.
 *
 * Verifies that the `GROK_AGENT_REGISTRATION` constant exported by the node
 * adapter registration file carries the canonical provider id `'grok'`.
 * This is the minimum acceptance criterion for the node adapter seam: the
 * registration object must exist and must identify itself correctly before
 * any spawn / session-listing / steering behaviour is exercised.
 */

describe('GROK_AGENT_REGISTRATION (node adapter registration)', () => {
	it('exports a registration constant with providerId === "grok"', () => {
		expect(GROK_AGENT_REGISTRATION.providerId).toBe('grok');
	});

	it('references the canonical grok provider descriptor', () => {
		// The descriptor on the registration must carry the same stable id.
		expect(GROK_AGENT_REGISTRATION.descriptor.id).toBe('grok');
		expect(GROK_AGENT_REGISTRATION.descriptor.family).toBe('xai');
		expect(GROK_AGENT_REGISTRATION.descriptor.displayName).toMatch(/grok/i);
	});
});
