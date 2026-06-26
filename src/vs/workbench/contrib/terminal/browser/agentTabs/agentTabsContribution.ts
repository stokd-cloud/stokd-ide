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
				"Replaces the terminal tab list with an agent-aware selector that lists agent (chat tool-session) terminals alongside regular terminals. Experimental."
			),
			// P4 deprecation (work item 6.3): agent sessions now open in the Agents Window
			// chat by default (`#chat.agentSessions.defaultSurface#`). The agent-aware terminal
			// selector is RETAINED as an opt-in escape hatch (DN-1 / NG4 — terminal is never
			// removed), so in-flight terminal sessions keep working; this flag is superseded,
			// not deleted. The default stays `false`, so flag-off behavior remains byte-identical
			// to upstream (AX-TERMINAL-AGENT-TABS).
			markdownDeprecationMessage: localize(
				'terminal.integrated.agentTabs.enabled.deprecated',
				"Agent sessions now open in the Agents Window chat by default. The agent-aware terminal selector is retained as an opt-in escape hatch — set `#chat.agentSessions.defaultSurface#` to `terminal` to keep opening agent sessions in terminal tabs. This experimental flag is superseded and may be removed in a future release."
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
