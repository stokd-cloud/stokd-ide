/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../../nls.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { URI } from '../../../../../base/common/uri.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { foreground, listActiveSelectionForeground, registerColor, transparent } from '../../../../../platform/theme/common/colorRegistry.js';
import { getChatSessionType } from '../../common/model/chatUri.js';
import { isAgentHostTarget, SessionType } from '../../common/chatSessionsService.js';
import { agentSessionProviderRegistry } from './agentSessionProviderRegistry.js';
import { registerBuiltInAgentSessionProviders } from './agentSessionProviderBuiltins.js';

// Re-register the Claude, Copilot CLI (Background) and Codex built-in providers
// through the fork-owned registry at module load, so the redirected default
// branches below resolve them with no behavior change. Runs before any function
// here is called; see `agentSessionProviderBuiltins.ts`.
registerBuiltInAgentSessionProviders();

export enum AgentSessionProviders {
	Local = SessionType.Local,
	Background = SessionType.CopilotCLI,
	Cloud = SessionType.CopilotCloud,
	Claude = SessionType.ClaudeCode,
	Codex = SessionType.Codex,
	Growth = SessionType.Growth,
	AgentHostCopilot = SessionType.AgentHostCopilot,
}

/**
 * A session target is either a well-known {@link AgentSessionProviders} enum
 * value or a dynamic string for dynamically-registered providers (e.g. remote
 * agent hosts like `remote-{authority}-copilot`).
 * TODO@roblourens HACK
 */
export type AgentSessionTarget = AgentSessionProviders | (string & {});

export function isBuiltInAgentSessionProvider(provider: AgentSessionTarget): boolean {
	if (provider === AgentSessionProviders.Local ||
		provider === AgentSessionProviders.Cloud) {
		return true;
	}
	// Background (Copilot CLI) and Claude resolve via the registry.
	return agentSessionProviderRegistry.get(provider)?.isBuiltIn === true;
}

export function getAgentSessionProvider(sessionResource: URI | string): AgentSessionProviders | undefined {
	const type = URI.isUri(sessionResource) ? getChatSessionType(sessionResource) : sessionResource;
	switch (type) {
		case AgentSessionProviders.Local:
		case AgentSessionProviders.Cloud:
		case AgentSessionProviders.AgentHostCopilot:
			return type;
		default:
			// Background (Copilot CLI), Claude and Codex resolve via the registry,
			// as do fork-registered providers. Return the type string cast as
			// AgentSessionProviders — safe because AgentSessionProviders is a string
			// enum and all callers compare by value.
			return agentSessionProviderRegistry.has(type) ? (type as AgentSessionProviders) : undefined;
	}
}

export function getAgentSessionProviderName(provider: AgentSessionTarget): string {
	switch (provider) {
		case AgentSessionProviders.Local:
			return localize('chat.session.providerLabel.local', "Local");
		case AgentSessionProviders.Cloud:
			return localize('chat.session.providerLabel.cloud', "Cloud");
		case AgentSessionProviders.Growth:
			return 'Growth';
		case AgentSessionProviders.AgentHostCopilot:
			return localize('chat.session.providerLabel.agentHostCopilot', "Copilot CLI [Agent Host]");
		default:
			// Background (Copilot CLI), Claude and Codex resolve via the registry.
			return agentSessionProviderRegistry.get(provider)?.displayName ?? provider;
	}
}

export function getAgentSessionProviderIcon(provider: AgentSessionTarget): ThemeIcon {
	switch (provider) {
		case AgentSessionProviders.Local:
			return Codicon.vm;
		case AgentSessionProviders.Cloud:
			return Codicon.cloud;
		case AgentSessionProviders.Growth:
			return Codicon.lightbulb;
		case AgentSessionProviders.AgentHostCopilot:
			return Codicon.copilot;
		default:
			// Background (Copilot CLI → copilot), Claude (→ claude) and Codex
			// (→ openai) resolve via the registry.
			return agentSessionProviderRegistry.get(provider)?.icon ?? Codicon.extensions;
	}
}

export function isFirstPartyAgentSessionProvider(provider: AgentSessionTarget): boolean {
	switch (provider) {
		case AgentSessionProviders.Local:
		case AgentSessionProviders.Cloud:
		case AgentSessionProviders.AgentHostCopilot:
			return true;
		case AgentSessionProviders.Growth:
			return false;
		default:
			// Background (Copilot CLI → true), Claude (→ false) and Codex (→ false)
			// resolve via the registry.
			return agentSessionProviderRegistry.get(provider)?.isFirstParty ?? false;
	}
}

/**
 * Re-exported from `common/chatSessionsService.ts` so existing browser-layer
 * callers keep working without changing imports.
 */
export { isAgentHostTarget };

export function getAgentCanContinueIn(provider: AgentSessionTarget): boolean {
	switch (provider) {
		case AgentSessionProviders.Local:
		case AgentSessionProviders.Cloud:
			return true;
		case AgentSessionProviders.Growth:
		case AgentSessionProviders.AgentHostCopilot:
			return false;
		default:
			// Background (Copilot CLI → true), Claude (→ false) and Codex (→ false)
			// resolve via the registry.
			return agentSessionProviderRegistry.get(provider)?.canContinueIn ?? false;
	}
}

/**
 * Vendor family for a provider (e.g. `'anthropic'`, `'github'`, `'openai'`),
 * used for grouping/branding (per-family icons, family filters). Returns
 * `undefined` when the provider declares no family.
 *
 * This is the unified accessor for the family facet, kept parallel to the other
 * `getAgentSessionProvider*` resolvers so every facet surfaces from one place.
 * The hard-coded built-ins below never declared a vendor family; the
 * registry-backed providers — Background (Copilot CLI → `'github'`), Claude
 * (→ `'anthropic'`) and Codex (→ `'openai'`), plus any fork-registered
 * provider — resolve theirs from the descriptor via the `default` branch.
 */
export function getAgentSessionProviderFamily(provider: AgentSessionTarget): string | undefined {
	switch (provider) {
		case AgentSessionProviders.Local:
		case AgentSessionProviders.Cloud:
		case AgentSessionProviders.Growth:
		case AgentSessionProviders.AgentHostCopilot:
			return undefined;
		default:
			return agentSessionProviderRegistry.get(provider)?.family;
	}
}

export function getAgentSessionProviderDescription(provider: AgentSessionTarget): string {
	switch (provider) {
		case AgentSessionProviders.Local:
			return localize('chat.session.providerDescription.local', "Run tasks within VS Code chat. The agent iterates via chat and works interactively to implement changes on your main workspace.");
		case AgentSessionProviders.Cloud:
			return localize('chat.session.providerDescription.cloud', "Delegate tasks to the GitHub Copilot coding agent. The agent iterates via chat and works asynchronously in the cloud to implement changes and pull requests as needed.");
		case AgentSessionProviders.Growth:
			return localize('chat.session.providerDescription.growth', "Learn about Copilot features.");
		case AgentSessionProviders.AgentHostCopilot:
			return 'Run a Copilot SDK agent in a dedicated process.';
		default:
			// Background (Copilot CLI), Claude and Codex resolve via the registry;
			// other providers without a registered description preserve the
			// original ''.
			return agentSessionProviderRegistry.get(provider)?.description ?? '';
	}
}

export enum AgentSessionsViewerOrientation {
	Stacked = 1,
	SideBySide,
}

export enum AgentSessionsViewerPosition {
	Left = 1,
	Right,
}

export interface IAgentSessionsControl {

	readonly element: HTMLElement | undefined;

	refresh(): void;
	openFind(): void;

	reveal(sessionResource: URI): boolean;

	clearFocus(): void;
	hasFocusOrSelection(): boolean;

	resetSectionCollapseState(): void;
	collapseAllSections(): void;
}

export const agentSessionReadIndicatorForeground = registerColor(
	'agentSessionReadIndicator.foreground',
	{ dark: transparent(foreground, 0.2), light: transparent(foreground, 0.2), hcDark: null, hcLight: null },
	localize('agentSessionReadIndicatorForeground', "Foreground color for the read indicator in an agent session.")
);

export const agentSessionSelectedBadgeBorder = registerColor(
	'agentSessionSelectedBadge.border',
	{ dark: transparent(listActiveSelectionForeground, 0.3), light: transparent(listActiveSelectionForeground, 0.3), hcDark: foreground, hcLight: foreground },
	localize('agentSessionSelectedBadgeBorder', "Border color for the badges in selected agent session items.")
);

export const agentSessionSelectedUnfocusedBadgeBorder = registerColor(
	'agentSessionSelectedUnfocusedBadge.border',
	{ dark: transparent(foreground, 0.3), light: transparent(foreground, 0.3), hcDark: foreground, hcLight: foreground },
	localize('agentSessionSelectedUnfocusedBadgeBorder', "Border color for the badges in selected agent session items when the view is unfocused.")
);

export const AGENT_SESSION_RENAME_ACTION_ID = 'agentSession.rename';
export const AGENT_SESSION_DELETE_ACTION_ID = 'agentSession.delete';
