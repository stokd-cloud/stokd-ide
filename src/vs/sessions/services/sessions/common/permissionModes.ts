/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ISessionPermissionMode, ISessionsProvider } from './sessionsProvider.js';

/**
 * Provider-agnostic accessors for the optional permission-mode contract on
 * {@link ISessionsProvider}. The sessions-core permission-mode picker reads
 * modes exclusively through these helpers so it never depends on any specific
 * provider or agent: a provider that declares modes drives the picker; one
 * that does not is simply treated as having no modes.
 *
 * These are intentionally pure (no DOM, no services) so the contract behavior
 * can be unit-tested directly.
 */

/**
 * The permission modes a provider declares for a session, or `[]` when the
 * provider does not implement {@link ISessionsProvider.getPermissionModes}.
 */
export function getProviderPermissionModes(provider: ISessionsProvider | undefined, sessionId: string): readonly ISessionPermissionMode[] {
	return provider?.getPermissionModes?.(sessionId) ?? [];
}

/**
 * The id of the effective current permission mode for a session: the
 * provider's reported selection when available, otherwise the first declared
 * mode, otherwise `undefined` when the provider declares no modes.
 */
export function getProviderCurrentPermissionMode(provider: ISessionsProvider | undefined, sessionId: string): string | undefined {
	const modes = getProviderPermissionModes(provider, sessionId);
	if (modes.length === 0) {
		return undefined;
	}
	const current = provider?.getPermissionMode?.(sessionId);
	if (current !== undefined && modes.some(mode => mode.id === current)) {
		return current;
	}
	return modes[0].id;
}

/**
 * Whether a provider declares at least one permission mode for a session, i.e.
 * the generic permission-mode picker should be shown for it.
 */
export function providerHasPermissionModes(provider: ISessionsProvider | undefined, sessionId: string): boolean {
	return getProviderPermissionModes(provider, sessionId).length > 0;
}
