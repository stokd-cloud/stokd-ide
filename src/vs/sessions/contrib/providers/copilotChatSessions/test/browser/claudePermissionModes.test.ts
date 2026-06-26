/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { IChatSessionProviderOptionItem, IChatSessionsService } from '../../../../../../workbench/contrib/chat/common/chatSessionsService.js';
import { ClaudeCodeSessionType, CopilotChatSessionsProvider, ICopilotChatSession } from '../../browser/copilotChatSessionsProvider.js';

// These settings gate the optional Auto / Bypass Claude permission modes.
const ALLOW_AUTO_PERMISSIONS_SETTING = 'github.copilot.chat.claudeAgent.allowAutoPermissions';
const ALLOW_BYPASS_PERMISSIONS_SETTING = 'github.copilot.chat.claudeAgent.allowDangerouslySkipPermissions';
const PERMISSION_MODE_OPTION_ID = 'permissionMode';

type SetOptionCall = { readonly optionId: string; readonly value: IChatSessionProviderOptionItem | string };

/**
 * Builds the Claude agent's permission ("approvals") modes that the Copilot
 * Chat sessions provider now declares directly (replacing the former Claude-
 * specific picker). The generic sessions-core permission-mode picker renders
 * whatever this provider returns from {@link CopilotChatSessionsProvider.getPermissionModes}.
 *
 * The provider methods only touch `getSession`, `configurationService`, and
 * `chatSessionsService`, so we exercise them against a prototype-backed
 * instance with those three members stubbed — no heavy session construction or
 * disposables required.
 */
function createProviderUnderTest(opts?: {
	session?: Partial<ICopilotChatSession>;
	config?: Record<string, boolean>;
	setSessionOption?: (resource: unknown, optionId: string, value: IChatSessionProviderOptionItem) => void;
}): CopilotChatSessionsProvider {
	const config = opts?.config ?? {};
	const configurationService = {
		getValue: (key: string) => config[key] ?? false,
	} as unknown as IConfigurationService;
	const chatSessionsService = {
		setSessionOption: opts?.setSessionOption ?? (() => true),
	} as unknown as IChatSessionsService;
	return Object.assign(Object.create(CopilotChatSessionsProvider.prototype), {
		configurationService,
		chatSessionsService,
		getSession: (_sessionId: string) => opts?.session,
	});
}

function claudeSession(opts?: {
	selectedOptions?: Map<string, IChatSessionProviderOptionItem>;
	setOptionCalls?: SetOptionCall[];
	withSetOption?: boolean;
}): Partial<ICopilotChatSession> {
	const calls = opts?.setOptionCalls;
	const session: Record<string, unknown> = {
		sessionType: ClaudeCodeSessionType.id,
		resource: { toString: () => 'claude:/session' },
		selectedOptions: opts?.selectedOptions ?? new Map<string, IChatSessionProviderOptionItem>(),
	};
	if (opts?.withSetOption !== false) {
		session.setOption = (optionId: string, value: IChatSessionProviderOptionItem | string) => {
			calls?.push({ optionId, value });
		};
	}
	return session as Partial<ICopilotChatSession>;
}

function nonClaudeSession(setOptionCalls?: SetOptionCall[]): Partial<ICopilotChatSession> {
	return {
		sessionType: 'copilot-cli',
		setOption: (optionId, value) => setOptionCalls?.push({ optionId, value }),
	} as Partial<ICopilotChatSession>;
}

suite('CopilotChatSessionsProvider permission modes', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('getPermissionModes returns the three base Claude modes for a Claude session', () => {
		const provider = createProviderUnderTest({ session: claudeSession() });
		assert.deepStrictEqual(
			provider.getPermissionModes('s').map(m => ({ id: m.id, label: m.label })),
			[
				{ id: 'default', label: 'Ask Before Edits' },
				{ id: 'acceptEdits', label: 'Edit Automatically' },
				{ id: 'plan', label: 'Plan Mode' },
			],
		);
	});

	test('getPermissionModes returns [] for a non-Claude session', () => {
		const provider = createProviderUnderTest({ session: nonClaudeSession() });
		assert.deepStrictEqual(provider.getPermissionModes('s'), []);
	});

	test('getPermissionModes returns [] when there is no session', () => {
		const provider = createProviderUnderTest({ session: undefined });
		assert.deepStrictEqual(provider.getPermissionModes('s'), []);
	});

	test('getPermissionModes appends Auto when the auto-permissions setting is enabled', () => {
		const provider = createProviderUnderTest({ session: claudeSession(), config: { [ALLOW_AUTO_PERMISSIONS_SETTING]: true } });
		assert.deepStrictEqual(
			provider.getPermissionModes('s').map(m => m.id),
			['default', 'acceptEdits', 'plan', 'auto'],
		);
	});

	test('getPermissionModes appends Bypass when the skip-permissions setting is enabled', () => {
		const provider = createProviderUnderTest({ session: claudeSession(), config: { [ALLOW_BYPASS_PERMISSIONS_SETTING]: true } });
		assert.deepStrictEqual(
			provider.getPermissionModes('s').map(m => m.id),
			['default', 'acceptEdits', 'plan', 'bypassPermissions'],
		);
	});

	test('getPermissionMode defaults to acceptEdits when nothing is persisted', () => {
		const provider = createProviderUnderTest({ session: claudeSession() });
		assert.strictEqual(provider.getPermissionMode('s'), 'acceptEdits');
	});

	test('getPermissionMode reflects the persisted permissionMode option', () => {
		const selectedOptions = new Map<string, IChatSessionProviderOptionItem>([
			[PERMISSION_MODE_OPTION_ID, { id: 'plan', name: 'Plan Mode' }],
		]);
		const provider = createProviderUnderTest({ session: claudeSession({ selectedOptions }) });
		assert.strictEqual(provider.getPermissionMode('s'), 'plan');
	});

	test('getPermissionMode is undefined for a non-Claude session', () => {
		const provider = createProviderUnderTest({ session: nonClaudeSession() });
		assert.strictEqual(provider.getPermissionMode('s'), undefined);
	});

	test('setPermissionMode writes the permissionMode option via the session', () => {
		const calls: SetOptionCall[] = [];
		const provider = createProviderUnderTest({ session: claudeSession({ setOptionCalls: calls }) });
		provider.setPermissionMode('s', 'default');
		assert.deepStrictEqual(calls, [{ optionId: PERMISSION_MODE_OPTION_ID, value: { id: 'default', name: 'Ask Before Edits' } }]);
	});

	test('setPermissionMode writes the bypass mode label when bypass is selected', () => {
		const calls: SetOptionCall[] = [];
		const provider = createProviderUnderTest({
			session: claudeSession({ setOptionCalls: calls }),
			config: { [ALLOW_BYPASS_PERMISSIONS_SETTING]: true },
		});
		provider.setPermissionMode('s', 'bypassPermissions');
		assert.deepStrictEqual(calls, [{ optionId: PERMISSION_MODE_OPTION_ID, value: { id: 'bypassPermissions', name: 'Bypass Permissions' } }]);
	});

	test('setPermissionMode falls back to chatSessionsService when the session has no setOption', () => {
		const calls: { readonly optionId: string; readonly value: IChatSessionProviderOptionItem }[] = [];
		const provider = createProviderUnderTest({
			session: claudeSession({ withSetOption: false }),
			setSessionOption: (_resource, optionId, value) => calls.push({ optionId, value }),
		});
		provider.setPermissionMode('s', 'plan');
		assert.deepStrictEqual(calls, [{ optionId: PERMISSION_MODE_OPTION_ID, value: { id: 'plan', name: 'Plan Mode' } }]);
	});

	test('setPermissionMode is a no-op for a non-Claude session', () => {
		const calls: SetOptionCall[] = [];
		const provider = createProviderUnderTest({ session: nonClaudeSession(calls) });
		provider.setPermissionMode('s', 'plan');
		assert.deepStrictEqual(calls, []);
	});
});
