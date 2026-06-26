/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Default launch surface for agent CLI providers (P4 — chat is the default for ALL providers).
 *
 * After P1–P3 proved the registry handles diverse transports, the default launch surface switches
 * from the terminal `agentTabs` path to an Agents Window **chat** session for *every* provider
 * (Claude, Copilot, Codex, Gemini, Grok, …). The terminal is retained but demoted to an explicit
 * opt-in escape hatch — DN-1: chat is the default for ALL; terminal is opt-in, never removed.
 *
 * The switch is gated behind a **revertible setting** ({@link AGENT_DEFAULT_SURFACE_SETTING_ID}):
 * a user can set it back to `'terminal'` to restore the old default with no rebuild. The "Open in
 * terminal" action always wins regardless of the default (the escape hatch).
 *
 * Pure data + pure functions (no imports) so the launch-surface contract is unit-verifiable
 * without the workbench — see `test/agentSessions/defaultLaunchSurface.test.ts`. The
 * `IConfigurationService` caller resolves {@link AGENT_DEFAULT_SURFACE_SETTING_ID} and passes the
 * value in; the decision itself never reaches into config.
 */

/** Where a provider's session opens by default: the Agents Window chat, or a terminal tab. */
export type AgentLaunchSurface = 'chat' | 'terminal';

/** P4: chat is the default launch surface for every provider. */
export const DEFAULT_AGENT_LAUNCH_SURFACE: AgentLaunchSurface = 'chat';

/**
 * The revertible setting that controls the default launch surface. Enum-valued
 * (`'chat'` | `'terminal'`), default `'chat'`. Setting it to `'terminal'` restores the pre-P4
 * default without a rebuild.
 */
export const AGENT_DEFAULT_SURFACE_SETTING_ID = 'chat.agentSessions.defaultSurface';

/** Inputs to a single launch-surface decision. */
export interface ILaunchSurfaceContext {
	/**
	 * The configured default surface (the resolved value of
	 * {@link AGENT_DEFAULT_SURFACE_SETTING_ID}); defaults to {@link DEFAULT_AGENT_LAUNCH_SURFACE}
	 * when unset.
	 */
	readonly configuredDefault?: AgentLaunchSurface;
	/**
	 * The user explicitly invoked the "Open in terminal" escape hatch for this launch — it always
	 * routes to the terminal regardless of the configured default (DN-1).
	 */
	readonly openInTerminal?: boolean;
}

/**
 * The default launch surface for a provider — `'chat'` for every provider unless the revertible
 * setting has been switched back to `'terminal'`. Provider-keyed so a future per-provider override
 * is a non-breaking change; today every provider resolves to the same configured default.
 */
export function getDefaultLaunchSurface(
	providerId: string,
	configuredDefault: AgentLaunchSurface = DEFAULT_AGENT_LAUNCH_SURFACE,
): AgentLaunchSurface {
	return configuredDefault;
}

/**
 * Resolve the launch surface for one launch, honoring the "Open in terminal" escape hatch. The
 * explicit terminal action always wins (the escape hatch is never removed, DN-1 / NG4); otherwise
 * the provider's configured default applies.
 */
export function getLaunchSurface(providerId: string, context: ILaunchSurfaceContext = {}): AgentLaunchSurface {
	if (context.openInTerminal) {
		return 'terminal';
	}
	return getDefaultLaunchSurface(providerId, context.configuredDefault);
}
