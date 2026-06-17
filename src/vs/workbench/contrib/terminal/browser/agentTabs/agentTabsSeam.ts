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

/**
 * Should {@link TerminalViewPane} tear down and rebuild its tabbed view? True only when the
 * agent-vs-stock decision has flipped relative to the view that is currently mounted
 * ({@link prevWasAgent}). This is the regression guard for the activation race: the code-ext
 * Sessions resolver registers on `onStartupFinished`, *after* the terminal panel is first built,
 * so the initial decision is `false` (stock); when the resolver later appears, `shouldUseAgentTabs`
 * flips to `true` and this returns `true` so the pane swaps to the agent view in place — no reload.
 * Returns `false` when nothing changed, so repeated config/resolver events don't churn the view.
 *
 * `prevWasAgent === undefined` means no view is mounted yet; rebuilding is left to the first
 * {@link TerminalViewPane}#_createTabsView call, so this returns `false` in that case.
 */
export function shouldRebuildTabsView(prevWasAgent: boolean | undefined, opts: {
	readonly flagEnabled: boolean;
	readonly designatedViewId: string | undefined;
	readonly hasResolver: (viewType: string) => boolean;
}): boolean {
	if (prevWasAgent === undefined) {
		return false;
	}
	return shouldUseAgentTabs(opts) !== prevWasAgent;
}
