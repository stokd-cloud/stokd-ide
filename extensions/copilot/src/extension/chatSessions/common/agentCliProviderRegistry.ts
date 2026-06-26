/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Fork-owned provider registry for the multi-provider LLM CLI chat panel.
 *
 * This module provides:
 *  1. {@link AgentCliProviderRegistry} — holds registered {@link IAgentCliProviderDescriptor}s.
 *  2. {@link applyRegistryToAgentService} — the shared registration base that maps
 *     descriptors onto the platform `IAgentService.registerProvider` seam, replacing
 *     the hand-copied DI blocks that claude-code/copilotcli currently duplicate in
 *     `agentHostMain.ts`.
 *
 * The registry itself is pure-data — no platform imports, no Node.js APIs.
 * It is testable with Vitest without platform coupling.
 *
 * Usage in agentHostMain.ts (eventual target):
 * ```ts
 * const registry = new AgentCliProviderRegistry();
 * registry.registerDescriptor(claudeProviderDescriptor);
 * registry.registerDescriptor(copilotCliProviderDescriptor);
 * applyRegistryToAgentService(registry, agentService, configService, agentFactory);
 * ```
 */

import type { AgentCliProviderId, IAgentCliProviderDescriptor, IAgentSecurityDescriptor } from './agentCliProvider';

// ---------------------------------------------------------------------------
// Minimal structural interfaces (no platform imports)
// ---------------------------------------------------------------------------

/**
 * Minimal interface for an `IAgent` compatible object as seen by the registry.
 * The registry never constructs agents itself — it delegates to {@link IAgentFactory}.
 * This interface is intentionally narrow so tests and alternative implementations
 * can provide simple fakes without wiring up the full platform DI container.
 */
export interface IAgentLike {
	readonly id: string;
}

/**
 * Factory that converts a descriptor into a concrete agent instance.
 *
 * Platform callers will implement this via `instantiationService.createInstance`.
 * Tests supply lightweight fakes.
 */
export interface IAgentFactory {
	createAgent(descriptor: IAgentCliProviderDescriptor): IAgentLike;
}

/**
 * Minimal interface for the platform `IAgentService`, scoped to the single
 * method the registry calls.  The real `AgentService.registerProvider` fulfils
 * this contract.
 */
export interface IAgentServiceLike {
	registerProvider(agent: IAgentLike): void;
}

/**
 * Minimal interface for reading VS Code configuration values.
 * The real `IConfigurationService.getValue(key)` fulfils this contract.
 */
export interface ISettingsServiceLike {
	getValue(settingId: string): unknown;
}

// ---------------------------------------------------------------------------
// Security-descriptor consistency
// ---------------------------------------------------------------------------

/**
 * Validate a provider's {@link IAgentSecurityDescriptor} for registry
 * consistency. Returns a human-readable rejection reason, or `undefined` when
 * the descriptor is consistent.
 *
 * Two invariants are enforced (AC-P0.4):
 *  1. **Loopback bind only** — the provider's transport MUST declare
 *     `bindPolicy: 'loopback'`. Any other value (e.g. `'lan'`, `'any'`) would
 *     expose the agent-host transport on a routable interface and is rejected.
 *  2. **Auth scheme present** — the provider MUST declare a non-empty
 *     `authScheme`. An absent or blank scheme means the transport would accept
 *     unauthenticated callers and is rejected as a "missing auth scheme".
 *
 * Pure and side-effect-free so it can be unit-tested directly and reused by any
 * registration sink, not just {@link AgentCliProviderRegistry.registerDescriptor}.
 */
export function validateSecurityDescriptor(security: IAgentSecurityDescriptor | undefined): string | undefined {
	if (!security) {
		return 'missing security descriptor';
	}
	if (security.bindPolicy !== 'loopback') {
		return `non-loopback bind policy: ${String(security.bindPolicy)}`;
	}
	if (typeof security.authScheme !== 'string' || security.authScheme.trim() === '') {
		return 'missing auth scheme';
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Registry of {@link IAgentCliProviderDescriptor}s.
 *
 * Descriptors are registered once at startup (typically in the extension's
 * activation path or the agent host's initialization sequence) and enumerated
 * by {@link applyRegistryToAgentService} to drive conditional provider registration.
 *
 * Thread-safety: not required — all mutations happen synchronously at startup.
 */
export class AgentCliProviderRegistry {
	private readonly _descriptors = new Map<AgentCliProviderId, IAgentCliProviderDescriptor>();

	/**
	 * Register a provider descriptor.
	 *
	 * Enforces registry consistency: the descriptor's
	 * {@link IAgentCliProviderDescriptor.security | security descriptor} must
	 * declare a loopback bind policy and a non-empty auth scheme
	 * (see {@link validateSecurityDescriptor}).
	 *
	 * @throws {Error} if a descriptor with the same id has already been registered.
	 * @throws {Error} if the descriptor's security descriptor is inconsistent
	 *   (non-loopback bind policy or missing auth scheme).
	 */
	registerDescriptor(descriptor: IAgentCliProviderDescriptor): void {
		if (this._descriptors.has(descriptor.id)) {
			throw new Error(
				`AgentCliProviderRegistry: provider already registered: ${descriptor.id}`,
			);
		}
		const reason = validateSecurityDescriptor(descriptor.security);
		if (reason) {
			throw new Error(
				`AgentCliProviderRegistry: provider ${descriptor.id} rejected — ${reason}`,
			);
		}
		this._descriptors.set(descriptor.id, descriptor);
	}

	/**
	 * Return the descriptor for a given provider id, or `undefined` if not registered.
	 */
	getDescriptor(id: AgentCliProviderId): IAgentCliProviderDescriptor | undefined {
		return this._descriptors.get(id);
	}

	/**
	 * Return all registered descriptors in insertion order.
	 */
	getDescriptors(): readonly IAgentCliProviderDescriptor[] {
		return [...this._descriptors.values()];
	}
}

// ---------------------------------------------------------------------------
// Shared registration base
// ---------------------------------------------------------------------------

/**
 * Shared registration base — the single function that replaces the hand-copied
 * per-provider DI blocks in `agentHostMain.ts`.
 *
 * For each descriptor in {@link registry}:
 *  1. Reads `descriptor.enabledSettingId` from {@link settings}.
 *  2. **Skips** the provider if the setting value is explicitly `false`.
 *     Any other value (`true`, `undefined`, a string, etc.) is treated as enabled.
 *  3. Calls `factory.createAgent(descriptor)` to produce the `IAgent` instance.
 *  4. Calls `agentService.registerProvider(agent)` to wire it into the platform.
 *
 * This function is pure (no side-effects beyond the two delegate calls) and is
 * tested in isolation via fakes.
 *
 * @param registry  - The populated descriptor registry.
 * @param agentService - The platform agent service (or a test fake).
 * @param settings  - Configuration accessor for enablement gate checks.
 * @param factory   - Factory that constructs concrete `IAgent` instances.
 */
export function applyRegistryToAgentService(
	registry: AgentCliProviderRegistry,
	agentService: IAgentServiceLike,
	settings: ISettingsServiceLike,
	factory: IAgentFactory,
): void {
	for (const descriptor of registry.getDescriptors()) {
		if (settings.getValue(descriptor.enabledSettingId) === false) {
			continue;
		}
		const agent = factory.createAgent(descriptor);
		agentService.registerProvider(agent);
	}
}

// ---------------------------------------------------------------------------
// Generated config entry shape
// ---------------------------------------------------------------------------

/**
 * Minimal descriptor for a generated per-provider enabled configuration entry.
 *
 * Callers pass the array returned by {@link generateProviderEnabledConfigs} to
 * the VS Code configuration registry (or a test assertion) to register the
 * per-provider `chat.agentHost.<id>Agent.enabled` settings automatically from
 * the descriptor list — without hand-writing each setting key.
 */
export interface IProviderEnabledConfigEntry {
	/** VS Code setting id (e.g. `'chat.agentHost.claudeAgent.enabled'`). */
	readonly settingId: string;
	/** Provider display name for localized descriptions. */
	readonly displayName: string;
	/**
	 * Whether the setting defaults to `true` or `false`.
	 * New providers **must** ship `false` (default-OFF kill switch).
	 */
	readonly defaultEnabled: boolean;
}

/**
 * Generate one {@link IProviderEnabledConfigEntry} per descriptor registered
 * in {@link registry}.
 *
 * The caller is responsible for registering the entries with the VS Code
 * configuration registry (or any other configuration sink). This function is
 * pure — no side-effects, no platform APIs.
 *
 * @param registry - The populated descriptor registry.
 * @returns Entries in insertion order, one per descriptor.
 */
export function generateProviderEnabledConfigs(
	registry: AgentCliProviderRegistry,
): readonly IProviderEnabledConfigEntry[] {
	return registry.getDescriptors().map(d => ({
		settingId: d.enabledSettingId,
		displayName: d.displayName,
		defaultEnabled: d.defaultEnabled,
	}));
}

// ---------------------------------------------------------------------------
// Generated command ID helpers
// ---------------------------------------------------------------------------

/**
 * Generate the VS Code command id for enabling a provider.
 *
 * Formula: `chat.agentHost.${id}Agent.enable`
 *
 * @example `providerEnableCommandId('claude')` → `'chat.agentHost.claudeAgent.enable'`
 */
export function providerEnableCommandId(id: AgentCliProviderId): string {
	return `chat.agentHost.${id}Agent.enable`;
}

/**
 * Generate the VS Code command id for disabling a provider.
 *
 * Formula: `chat.agentHost.${id}Agent.disable`
 *
 * @example `providerDisableCommandId('claude')` → `'chat.agentHost.claudeAgent.disable'`
 */
export function providerDisableCommandId(id: AgentCliProviderId): string {
	return `chat.agentHost.${id}Agent.disable`;
}

/** Trailing suffix every enabled-gate setting id carries (e.g. `chat.agentHost.claudeAgent.enabled`). */
const ENABLED_SETTING_SUFFIX = '.enabled';

/**
 * Derive a provider command id from its enabled-gate setting id.
 *
 * The enabled setting ends in `.enabled`; the command is the same key with the
 * `.enabled` suffix replaced by `.${action}` — so
 * `chat.agentHost.claudeAgent.enabled` yields `chat.agentHost.claudeAgent.enable`
 * (action `'enable'`) or `…disable` (action `'disable'`). When the setting id does
 * not end in `.enabled`, the action is appended verbatim.
 *
 * Deriving the command id from the setting id (rather than re-computing it from
 * the provider id) keeps the command in lockstep with the actual setting a
 * descriptor declares, even when a descriptor overrides its `enabledSettingId`
 * to a non-canonical value.
 */
function providerCommandIdFromSettingId(enabledSettingId: string, action: 'enable' | 'disable'): string {
	const base = enabledSettingId.endsWith(ENABLED_SETTING_SUFFIX)
		? enabledSettingId.slice(0, -ENABLED_SETTING_SUFFIX.length)
		: enabledSettingId;
	return `${base}.${action}`;
}

/**
 * Derive the VS Code command id for **enabling** a provider from its
 * `descriptor.enabledSettingId`. See {@link providerCommandIdFromSettingId}.
 *
 * @example `providerEnableCommandIdFromSettingId('chat.agentHost.claudeAgent.enabled')`
 *          → `'chat.agentHost.claudeAgent.enable'`
 */
export function providerEnableCommandIdFromSettingId(enabledSettingId: string): string {
	return providerCommandIdFromSettingId(enabledSettingId, 'enable');
}

/**
 * Derive the VS Code command id for **disabling** a provider from its
 * `descriptor.enabledSettingId`. See {@link providerCommandIdFromSettingId}.
 *
 * @example `providerDisableCommandIdFromSettingId('chat.agentHost.codexAgent.enabled')`
 *          → `'chat.agentHost.codexAgent.disable'`
 */
export function providerDisableCommandIdFromSettingId(enabledSettingId: string): string {
	return providerCommandIdFromSettingId(enabledSettingId, 'disable');
}

/**
 * An auto-generated enable/disable command pair for one provider, derived from
 * the provider's {@link IAgentCliProviderDescriptor.enabledSettingId}.
 */
export interface IProviderEnabledCommandEntry {
	/** Provider id this command pair belongs to. */
	readonly providerId: AgentCliProviderId;
	/** Command id that turns the provider's enabled-gate setting on. */
	readonly enableCommandId: string;
	/** Command id that turns the provider's enabled-gate setting off. */
	readonly disableCommandId: string;
}

/**
 * Generate one {@link IProviderEnabledCommandEntry} per descriptor registered in
 * {@link registry}, deriving both command ids from each descriptor's
 * `enabledSettingId` (see {@link providerCommandIdFromSettingId}).
 *
 * This is the command-side twin of {@link generateProviderEnabledConfigs}: a new
 * provider gets its enable/disable commands for free from its descriptor, with
 * no per-provider command constant to hand-write. Pure — no side-effects, no
 * platform APIs; the caller registers the resulting ids with the VS Code command
 * registry (or any other sink).
 *
 * @param registry - The populated descriptor registry.
 * @returns Entries in insertion order, one per descriptor.
 */
export function generateProviderEnabledCommands(
	registry: AgentCliProviderRegistry,
): readonly IProviderEnabledCommandEntry[] {
	return registry.getDescriptors().map(d => ({
		providerId: d.id,
		enableCommandId: providerEnableCommandIdFromSettingId(d.enabledSettingId),
		disableCommandId: providerDisableCommandIdFromSettingId(d.enabledSettingId),
	}));
}
