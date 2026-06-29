/*---------------------------------------------------------------------------------------------
 *  Copyright (c) stokd. Thin-patch fork — agent-aware terminal selector (AX-TERMINAL-AGENT-TABS).
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../../nls.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../../platform/configuration/common/configurationRegistry.js';

/**
 * Self-registering contribution for the agent-aware terminal selector.
 *
 * This module is pulled into the terminal module graph by a single one-line
 * import in `terminal.contribution.ts` (the only other sanctioned upstream edit
 * besides the seam — see SEAM_MANIFEST.md). It registers the experimental flag
 * that gates the whole feature. With the flag off (the default) the stock
 * `TerminalTabbedView` is created and behavior is byte-identical to upstream.
 */

export const TerminalAgentTabsSettingId = 'terminal.integrated.agentTabs.enabled';

/**
 * The webview view id the selector hosts in the terminal tabs strip
 * (AX-IDE-WEBVIEW-TERMINAL-SELECTOR). Defaults to the stokd Sessions dashboard's dedicated
 * terminal-tabs id; the selector falls back to the stock tabs whenever no extension has registered
 * a resolver for this id, so the default is safe even on builds without the Sessions extension.
 */
export const TerminalAgentTabsViewIdSettingId = 'terminal.integrated.agentTabs.viewId';

/** Default designated host view id — matches code-ext `AgentDashboardProvider.terminalTabsViewType`. */
export const DEFAULT_TERMINAL_AGENT_TABS_VIEW_ID = 'stokd.agentDashboard.terminalTabs';

/**
 * Controls how an **agent** row in the selector is displayed when activated: as the agent's
 * chat UI (`'chat'`, the default) rendered inline in the strip body, or as the agent's raw
 * terminal (`'terminal'`). Plain (non-agent) terminals always display as terminals. Lives in the
 * `terminal.integrated.agentTabs.*` namespace alongside the enable flag; supersedes the former
 * `chat.agentSessions.defaultSurface`. Read by the fork ({@link AGENT_DEFAULT_SURFACE_SETTING_ID})
 * and by the code-ext dashboard.
 */
export const TerminalAgentTabsSurfaceSettingId = 'terminal.integrated.agentTabs.agentSurface';

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'terminal',
	order: 100,
	title: localize('terminalIntegratedConfigurationTitle', "Integrated Terminal"),
	type: 'object',
	properties: {
		[TerminalAgentTabsSettingId]: {
			type: 'boolean',
			default: false,
			tags: ['experimental'],
			markdownDescription: localize(
				'terminal.integrated.agentTabs.enabled',
				"Replaces the terminal tab list with an agent-aware selector that lists agent (chat tool-session) terminals alongside regular terminals. Agent rows can render as chat or terminal — see `#terminal.integrated.agentTabs.agentSurface#`. Experimental."
			),
		},
		[TerminalAgentTabsSurfaceSettingId]: {
			type: 'string',
			enum: ['chat', 'terminal'],
			enumDescriptions: [
				localize('terminal.integrated.agentTabs.agentSurface.chat', "Activating an agent row shows the agent's chat UI inline in the strip body (the terminal keeps running underneath)."),
				localize('terminal.integrated.agentTabs.agentSurface.terminal', "Activating an agent row shows the agent's terminal."),
			],
			default: 'chat',
			tags: ['experimental'],
			markdownDescription: localize(
				'terminal.integrated.agentTabs.agentSurface',
				"How an agent row in the agent-aware selector is displayed when activated. `chat` (the default) renders the agent's chat UI inline in the strip body; `terminal` shows the agent's terminal. Plain terminals always display as terminals. Requires `#terminal.integrated.agentTabs.enabled#`."
			),
		},
		[TerminalAgentTabsViewIdSettingId]: {
			type: 'string',
			default: DEFAULT_TERMINAL_AGENT_TABS_VIEW_ID,
			tags: ['experimental'],
			markdownDescription: localize(
				'terminal.integrated.agentTabs.viewId',
				"The webview view id the agent-aware selector hosts in the terminal tabs strip. Falls back to the stock terminal tabs when no extension provides this view. Experimental."
			),
		},
	},
});
