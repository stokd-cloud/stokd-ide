/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Fork-owned workbench-layer registry for agent session providers.
 *
 * This registry allows fork-added providers to be discovered by the existing
 * upstream functions in agentSessions.ts ({@link getAgentSessionProviderName},
 * {@link getAgentSessionProviderIcon}, etc.) without editing the upstream
 * switch/enum blocks for each new provider.
 *
 * The remaining built-in providers (Local, Cloud, Codex, Growth,
 * AgentHostCopilot) continue to be handled by their hard-coded switch cases
 * for minimal rebase conflict surface. Claude and Copilot CLI (Background) are
 * registered here as well — see `agentSessionProviderBuiltins.ts` — so their UI
 * descriptors live in fork-owned code and resolve through the redirected default
 * branches with no behavior change. New providers register here too.
 *
 * Usage:
 * ```ts
 * const disposable = registerAgentSessionProvider('mockAgent', {
 *   displayName: 'Mock Agent',
 *   icon: Codicon.zap,
 *   isFirstParty: false,
 *   canContinueIn: false,
 *   isBuiltIn: true,
 *   family: 'test',
 * });
 * // disposable.dispose() removes the entry (useful in tests)
 * ```
 */

import { IDisposable } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';

/**
 * UI-facing descriptor for a dynamically registered agent session provider.
 *
 * These fields parallel the hard-coded switch cases in agentSessions.ts and
 * are queried by the redirected default branches of those functions.
 */
export interface IAgentSessionProviderUIEntry {
	/** Human-readable display name shown in the picker and sessions list. */
	readonly displayName: string;
	/** Icon shown next to the provider in the picker and sessions list. */
	readonly icon: ThemeIcon;
	/**
	 * Whether this is a first-party (Microsoft/GitHub) provider.
	 * Controls which category group the provider appears in inside the picker.
	 */
	readonly isFirstParty: boolean;
	/**
	 * Whether sessions of this type support "Continue in…" delegation.
	 * Controls whether this provider appears in the "Continue in" suggestion widget.
	 */
	readonly canContinueIn: boolean;
	/**
	 * Whether this provider is treated as a built-in provider.
	 * Built-in providers are retained in the sessions list even when no
	 * extension-contribution entry exists for them.
	 */
	readonly isBuiltIn: boolean;
	/**
	 * Vendor family identifier for grouping and branding (e.g. `'anthropic'`,
	 * `'github'`, `'openai'`, `'test'`).
	 */
	readonly family?: string;
	/**
	 * Long-form description shown in the provider picker. Parallels the
	 * hard-coded cases in {@link getAgentSessionProviderDescription}; when
	 * omitted the redirected default branch resolves to an empty string,
	 * preserving the original behavior for providers that never had one.
	 */
	readonly description?: string;
}

class AgentSessionProviderRegistry {
	private readonly _map = new Map<string, IAgentSessionProviderUIEntry>();

	/**
	 * Register a provider descriptor. Returns a disposable that removes the
	 * entry when disposed — useful for test isolation.
	 *
	 * @throws {Error} if a descriptor with the same id is already registered.
	 */
	register(id: string, entry: IAgentSessionProviderUIEntry): IDisposable {
		if (this._map.has(id)) {
			throw new Error(`AgentSessionProviderRegistry: provider already registered: ${id}`);
		}
		this._map.set(id, entry);
		return { dispose: () => this._map.delete(id) };
	}

	/** Return the UI entry for the given provider id, or undefined. */
	get(id: string): IAgentSessionProviderUIEntry | undefined {
		return this._map.get(id);
	}

	/** Return whether the given provider id has been registered. */
	has(id: string): boolean {
		return this._map.has(id);
	}
}

/**
 * Global singleton registry for dynamically registered agent session providers.
 *
 * This is the single registry instance consumed by the redirected default
 * branches in agentSessions.ts.
 */
export const agentSessionProviderRegistry = new AgentSessionProviderRegistry();

/**
 * Convenience wrapper around {@link agentSessionProviderRegistry.register}.
 * Returns a disposable that removes the registration when disposed.
 */
export function registerAgentSessionProvider(id: string, entry: IAgentSessionProviderUIEntry): IDisposable {
	return agentSessionProviderRegistry.register(id, entry);
}
