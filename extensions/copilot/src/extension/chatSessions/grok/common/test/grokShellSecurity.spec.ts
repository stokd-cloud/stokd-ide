/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import type { AgentCliPermissionMode } from '../../../common/agentCliProvider';
import {
	decideGrokShellPermission,
	GROK_SHELL_AUTO_APPROVE_DEFAULT,
	isGrokBypassEnabled,
} from '../grokShellSecurity';

describe('grok security default-deny shell (DN-4)', () => {
	it('defaults shell auto-approve to OFF (default-deny)', () => {
		expect(GROK_SHELL_AUTO_APPROVE_DEFAULT).toBe(false);
	});

	it('requires per-command permission for a shell command in non-bypass modes', () => {
		expect(decideGrokShellPermission('rm -rf /', 'default')).toBe('requirePermission');
		expect(decideGrokShellPermission('ls', 'acceptEdits')).toBe('requirePermission');
	});

	it('only auto-approves shell when bypass is explicitly enabled (opt-in)', () => {
		expect(isGrokBypassEnabled('default')).toBe(false);
		expect(isGrokBypassEnabled('acceptEdits')).toBe(false);
		expect(isGrokBypassEnabled('bypassPermissions')).toBe(true);
		expect(decideGrokShellPermission('ls', 'bypassPermissions')).toBe('autoApprove');
	});

	it('never auto-approves a shell command without an explicit bypass mode', () => {
		const modes: AgentCliPermissionMode[] = ['default', 'acceptEdits', 'plan', 'dontAsk', 'auto', 'interactive'];
		for (const mode of modes) {
			expect(decideGrokShellPermission('any', mode)).toBe('requirePermission');
		}
	});
});
