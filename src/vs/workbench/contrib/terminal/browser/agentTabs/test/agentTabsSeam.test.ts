/*---------------------------------------------------------------------------------------------
 *  Copyright (c) stokd. Thin-patch fork — agent-aware terminal selector (AX-IDE-WEBVIEW-TERMINAL-SELECTOR).
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// DOM-free unit test for the terminal-tabs seam decision (AX-IDE-WEBVIEW-TERMINAL-SELECTOR).
// shouldUseAgentTabs gates the agent view on flag + designated view id + a registered resolver.
// shouldRebuildTabsView is the regression guard for the activation race: code-ext registers its
// Sessions resolver on `onStartupFinished`, AFTER the terminal panel is first built, so the seam
// must re-evaluate when the resolver later appears and swap stock -> agent in place (no reload).
//
// Run from source (no full build), like the sibling tests:
//   node --import tsx --test src/vs/workbench/contrib/terminal/browser/agentTabs/test/agentTabsSeam.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldUseAgentTabs, shouldRebuildTabsView } from '../agentTabsSeam.js';

const VIEW_ID = 'stokd.agentDashboard.terminalTabs';
const hasResolverFor = (...ids: string[]) => (id: string) => ids.includes(id);
const noResolver = () => false;

test('shouldUseAgentTabs: true only when flag on AND view id set AND resolver registered', () => {
	assert.deepEqual(
		{
			allHold: shouldUseAgentTabs({ flagEnabled: true, designatedViewId: VIEW_ID, hasResolver: hasResolverFor(VIEW_ID) }),
			flagOff: shouldUseAgentTabs({ flagEnabled: false, designatedViewId: VIEW_ID, hasResolver: hasResolverFor(VIEW_ID) }),
			noViewId: shouldUseAgentTabs({ flagEnabled: true, designatedViewId: undefined, hasResolver: hasResolverFor(VIEW_ID) }),
			noResolver: shouldUseAgentTabs({ flagEnabled: true, designatedViewId: VIEW_ID, hasResolver: noResolver }),
			wrongResolver: shouldUseAgentTabs({ flagEnabled: true, designatedViewId: VIEW_ID, hasResolver: hasResolverFor('some.other.view') }),
		},
		{ allHold: true, flagOff: false, noViewId: false, noResolver: false, wrongResolver: false },
	);
});

test('shouldRebuildTabsView: rebuilds exactly on a decision flip; the activation race is covered', () => {
	const flagOn = { flagEnabled: true, designatedViewId: VIEW_ID } as const;
	assert.deepEqual(
		{
			// The bug: panel built before code-ext activated -> mounted stock (prevWasAgent=false);
			// resolver registers later -> must rebuild as the agent view.
			resolverAppearsAfterStockMount: shouldRebuildTabsView(false, { ...flagOn, hasResolver: hasResolverFor(VIEW_ID) }),
			// Resolver still absent -> nothing changed, do not churn.
			stillNoResolver: shouldRebuildTabsView(false, { ...flagOn, hasResolver: noResolver }),
			// Flag toggled off while agent view mounted -> rebuild back to stock.
			flagToggledOffWhileAgent: shouldRebuildTabsView(true, { flagEnabled: false, designatedViewId: VIEW_ID, hasResolver: hasResolverFor(VIEW_ID) }),
			// Already agent and resolver present -> no redundant rebuild.
			agentStaysAgent: shouldRebuildTabsView(true, { ...flagOn, hasResolver: hasResolverFor(VIEW_ID) }),
			// No view mounted yet -> first build is _createTabsView's job, not a rebuild.
			noViewMountedYet: shouldRebuildTabsView(undefined, { ...flagOn, hasResolver: hasResolverFor(VIEW_ID) }),
		},
		{
			resolverAppearsAfterStockMount: true,
			stillNoResolver: false,
			flagToggledOffWhileAgent: true,
			agentStaysAgent: false,
			noViewMountedYet: false,
		},
	);
});
