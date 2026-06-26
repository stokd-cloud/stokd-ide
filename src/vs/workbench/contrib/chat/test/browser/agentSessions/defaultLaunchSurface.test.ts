/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import {
	AGENT_DEFAULT_SURFACE_SETTING_ID,
	DEFAULT_AGENT_LAUNCH_SURFACE,
	getDefaultLaunchSurface,
	getLaunchSurface,
} from '../../../browser/agentSessions/defaultLaunchSurface.js';

// ---------------------------------------------------------------------------
// AC-P4.1 / AC-6.1 — chat is the default launch surface for ALL providers,
// behind a revertible setting; the "Open in terminal" escape hatch always
// routes to the terminal (DN-1). (default surface chat)
// ---------------------------------------------------------------------------

suite('agentSessions default surface — chat is the default for all providers (default surface chat)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const providers = ['claude-code', 'copilotcli', 'openai-codex', 'gemini', 'grok'];

	test('returns chat for every provider id by default (AC-6.1.a)', () => {
		for (const id of providers) {
			assert.strictEqual(getDefaultLaunchSurface(id), 'chat');
		}
		assert.strictEqual(DEFAULT_AGENT_LAUNCH_SURFACE, 'chat');
		assert.strictEqual(AGENT_DEFAULT_SURFACE_SETTING_ID, 'chat.agentSessions.defaultSurface');
	});

	test('revertible: a configured default of terminal returns terminal, no rebuild (AC-6.1.b)', () => {
		for (const id of providers) {
			assert.strictEqual(getDefaultLaunchSurface(id, 'terminal'), 'terminal');
		}
	});

	test('Open in terminal escape hatch always routes to terminal, even when chat is default (DN-1)', () => {
		assert.strictEqual(getLaunchSurface('grok', { openInTerminal: true }), 'terminal');
		assert.strictEqual(getLaunchSurface('grok', { configuredDefault: 'chat', openInTerminal: true }), 'terminal');
		// without the escape hatch, the configured default applies
		assert.strictEqual(getLaunchSurface('grok', {}), 'chat');
		assert.strictEqual(getLaunchSurface('grok', { configuredDefault: 'terminal' }), 'terminal');
	});
});
