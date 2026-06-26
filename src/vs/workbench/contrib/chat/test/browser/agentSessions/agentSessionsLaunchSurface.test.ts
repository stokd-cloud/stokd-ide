/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { IAgentSession } from '../../../browser/agentSessions/agentSessionsModel.js';
import { resolveSessionSurface } from '../../../browser/agentSessions/agentSessionsOpener.js';

// ---------------------------------------------------------------------------
// AC-P4.4 — `getLaunchSurface` is wired in the session opener so the escape
// hatch (`openInTerminal: true`) and the revertible config setting both
// actually take effect. (agentTabs.escape)
// ---------------------------------------------------------------------------

suite('agentSessions opener launch surface wiring (agentTabs.escape)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	/** Minimal IAgentSession stub — resolveSessionSurface only reads providerType. */
	const session = (providerType: string): IAgentSession => ({ providerType } as IAgentSession);

	test('"Open in terminal" escape hatch always wins over configured default (agentTabs.escape)', () => {
		// chat configured, but explicit terminal action → terminal
		assert.strictEqual(resolveSessionSurface(session('grok'), { openInTerminal: true }, 'chat'), 'terminal');
		// terminal configured and explicit terminal action → still terminal
		assert.strictEqual(resolveSessionSurface(session('grok'), { openInTerminal: true }, 'terminal'), 'terminal');
		// escape hatch works for every provider
		assert.strictEqual(resolveSessionSurface(session('claude-code'), { openInTerminal: true }, 'chat'), 'terminal');
		assert.strictEqual(resolveSessionSurface(session('copilotcli'), { openInTerminal: true }), 'terminal');
	});

	test('default launch path respects the configured surface setting (agentTabs.escape)', () => {
		// No action flag: configured default applies
		assert.strictEqual(resolveSessionSurface(session('grok'), {}, 'terminal'), 'terminal');
		assert.strictEqual(resolveSessionSurface(session('grok'), {}, 'chat'), 'chat');
		// Unconfigured (undefined) falls back to the hard-wired P4 default: chat
		assert.strictEqual(resolveSessionSurface(session('grok')), 'chat');
		assert.strictEqual(resolveSessionSurface(session('grok'), undefined, undefined), 'chat');
	});

	test('"Open in terminal" action path is orthogonal to the config-based default (agentTabs.escape)', () => {
		// Chat is configured: explicit terminal action still routes to terminal (DN-1).
		assert.strictEqual(resolveSessionSurface(session('grok'), { openInTerminal: true }, 'chat'), 'terminal');
		// Terminal is configured: default path routes to terminal without the action.
		assert.strictEqual(resolveSessionSurface(session('grok'), {}, 'terminal'), 'terminal');
		// Chat is configured: default path routes to chat (no action, no override).
		assert.strictEqual(resolveSessionSurface(session('grok'), {}, 'chat'), 'chat');
	});
});
