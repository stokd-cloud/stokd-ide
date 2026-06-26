/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { getProviderCurrentPermissionMode, getProviderPermissionModes, providerHasPermissionModes } from '../../common/permissionModes.js';
import { ISessionPermissionMode, ISessionsProvider } from '../../common/sessionsProvider.js';

const MODES: readonly ISessionPermissionMode[] = [
	{ id: 'default', label: 'Ask Before Edits' },
	{ id: 'acceptEdits', label: 'Edit Automatically' },
	{ id: 'plan', label: 'Plan Mode' },
];

/**
 * Builds an {@link ISessionsProvider}-shaped stub exposing only the optional
 * permission-mode members under test.
 */
function createProvider(opts: {
	modes?: readonly ISessionPermissionMode[];
	current?: string;
	declarePermissionModes?: boolean;
}): ISessionsProvider {
	const stub: Partial<ISessionsProvider> = {};
	if (opts.declarePermissionModes !== false) {
		stub.getPermissionModes = () => opts.modes ?? [];
		stub.getPermissionMode = () => opts.current;
	}
	return stub as ISessionsProvider;
}

suite('sessions permission modes contract', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('getProviderPermissionModes returns the provider-declared modes', () => {
		const provider = createProvider({ modes: MODES });
		assert.deepStrictEqual(getProviderPermissionModes(provider, 's').map(m => m.id), ['default', 'acceptEdits', 'plan']);
	});

	test('getProviderPermissionModes returns [] for an undefined provider', () => {
		assert.deepStrictEqual(getProviderPermissionModes(undefined, 's'), []);
	});

	test('getProviderPermissionModes returns [] when the provider does not implement the method', () => {
		const provider = createProvider({ declarePermissionModes: false });
		assert.deepStrictEqual(getProviderPermissionModes(provider, 's'), []);
	});

	test('providerHasPermissionModes reflects whether any mode is declared', () => {
		assert.strictEqual(providerHasPermissionModes(createProvider({ modes: MODES }), 's'), true);
		assert.strictEqual(providerHasPermissionModes(createProvider({ modes: [] }), 's'), false);
		assert.strictEqual(providerHasPermissionModes(createProvider({ declarePermissionModes: false }), 's'), false);
		assert.strictEqual(providerHasPermissionModes(undefined, 's'), false);
	});

	test('getProviderCurrentPermissionMode prefers a valid reported selection', () => {
		const provider = createProvider({ modes: MODES, current: 'plan' });
		assert.strictEqual(getProviderCurrentPermissionMode(provider, 's'), 'plan');
	});

	test('getProviderCurrentPermissionMode falls back to the first mode when none is selected', () => {
		const provider = createProvider({ modes: MODES, current: undefined });
		assert.strictEqual(getProviderCurrentPermissionMode(provider, 's'), 'default');
	});

	test('getProviderCurrentPermissionMode falls back to the first mode when the selection is unknown', () => {
		const provider = createProvider({ modes: MODES, current: 'not-a-real-mode' });
		assert.strictEqual(getProviderCurrentPermissionMode(provider, 's'), 'default');
	});

	test('getProviderCurrentPermissionMode is undefined when no modes are declared', () => {
		assert.strictEqual(getProviderCurrentPermissionMode(createProvider({ modes: [] }), 's'), undefined);
		assert.strictEqual(getProviderCurrentPermissionMode(undefined, 's'), undefined);
	});
});
