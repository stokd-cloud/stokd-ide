/*---------------------------------------------------------------------------------------------
 *  Copyright (c) stokd. Thin-patch fork — agent-aware terminal selector (AX-IDE-WEBVIEW-TERMINAL-SELECTOR).
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// DOM-free unit test for the in-process active-highlight bridge that backs AgentTerminalTabbedView.
// It is the falsifiable core of AX-IDE-WEBVIEW-TERMINAL-SELECTOR: when the active terminal changes,
// the agent-tabs overlay webview's highlighted row MUST move on the SAME frame the terminal focuses,
// with zero extension-host hops. The bridge subscribes to the in-process active-instance event and
// posts the active terminal's processId straight to the overlay as 'selectRowExternalByPid'.
//
// Run from source (no full build) exactly like the sibling model test:
//   node --import tsx --test src/vs/workbench/contrib/terminal/browser/agentTabs/test/agentTerminalActiveHighlightBridge.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgentTerminalActiveHighlightBridge, IHighlightInstanceRef, IHighlightSubscription } from '../agentTerminalActiveHighlightBridge.js';

interface SelectRowMessage { readonly type: 'selectRowExternalByPid'; readonly pid: number | undefined; }

/** A fake event source that captures the listener so the test can fire it on demand. */
function makeSource() {
	const state: { listener?: (instance: IHighlightInstanceRef | undefined) => void; disposed: boolean } = { disposed: false };
	const subscription: IHighlightSubscription = { dispose() { state.disposed = true; } };
	const source = (listener: (instance: IHighlightInstanceRef | undefined) => void): IHighlightSubscription => {
		state.listener = listener;
		return subscription;
	};
	return { source, state };
}

test('AC1: posts selectRowExternalByPid with the active processId, and pid:undefined on clear', () => {
	const { source, state } = makeSource();
	const posts: SelectRowMessage[] = [];
	const bridge = new AgentTerminalActiveHighlightBridge(source, message => posts.push(message));

	state.listener!({ processId: 4242 });
	state.listener!(undefined);

	assert.deepEqual(posts, [
		{ type: 'selectRowExternalByPid', pid: 4242 },
		{ type: 'selectRowExternalByPid', pid: undefined },
	]);

	bridge.dispose();
});

test('AC2: dispose() unsubscribes and prevents further posts', () => {
	const { source, state } = makeSource();
	const posts: SelectRowMessage[] = [];
	const bridge = new AgentTerminalActiveHighlightBridge(source, message => posts.push(message));

	bridge.dispose();

	assert.equal(state.disposed, true, 'the subscription is disposed');

	// Even if the (now-removed) source were to fire, the bridge must not post.
	state.listener!({ processId: 99 });

	assert.deepEqual(posts, [], 'no posts occur after dispose');
});
