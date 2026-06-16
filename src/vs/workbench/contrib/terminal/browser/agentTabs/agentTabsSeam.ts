/*---------------------------------------------------------------------------------------------
 *  Copyright (c) stokd. Thin-patch fork — agent-aware terminal selector (AX-IDE-WEBVIEW-TERMINAL-SELECTOR).
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Pure seam decision: should {@link TerminalViewPane} create the agent-aware tabbed view (which
 * hosts the code-ext Sessions webview in the strip) instead of the stock `TerminalTabbedView`?
 *
 * The agent view is used ONLY when all three hold:
 *  - the `terminal.integrated.agentTabs.enabled` flag is on,
 *  - a webview view id is designated (via product.json `terminalTabsWebviewViewId`), and
 *  - an extension has registered a resolver for that view id (`IWebviewViewService.hasResolver`).
 *
 * If any is false the pane falls back to the stock view, which is byte-identical to upstream —
 * so a fork running without the Sessions extension never renders an empty/broken strip
 * (AX-IDE-WEBVIEW-TERMINAL-SELECTOR). Kept DOM-free and dependency-free so the gate is
 * unit-testable without a full VS Code build.
 */
export function shouldUseAgentTabs(opts: {
	readonly flagEnabled: boolean;
	readonly designatedViewId: string | undefined;
	readonly hasResolver: (viewType: string) => boolean;
}): boolean {
	const { flagEnabled, designatedViewId, hasResolver } = opts;
	if (!flagEnabled || !designatedViewId) {
		return false;
	}
	return hasResolver(designatedViewId);
}
