/*---------------------------------------------------------------------------------------------
 *  Copyright (c) stokd. Thin-patch fork — agent-aware terminal selector (AX-IDE-WEBVIEW-TERMINAL-SELECTOR).
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// DOM-free unit test for the webview-hosting core of the agent terminal selector and the pure
// seam decision. Falsifiable core of AX-IDE-WEBVIEW-TERMINAL-SELECTOR: the fork hosts the
// code-ext Sessions webview in the terminal tabs strip via the webview-view service, but ONLY
// when a resolver is registered for the designated view id; otherwise the caller MUST fall back
// to the stock terminal tabs (look byte-identical to upstream). No live extension => no broken
// strip.
//
// Run from source (no full build) like the sibling controller test:
//   node --import tsx --test src/vs/workbench/contrib/terminal/browser/agentTabs/test/agentTerminalWebviewHost.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgentTerminalWebviewHost } from '../agentTerminalWebviewHost.js';
import { shouldUseAgentTabs } from '../agentTabsSeam.js';

interface FakeView { container: HTMLElement; layoutCalls: Array<{ w: number; h: number }>; visible: boolean[]; disposed: boolean; layout(w: number, h: number): void; setVisible(v: boolean): void; dispose(): void; }

function makeView(): FakeView {
	return {
		// Opaque to the controller (it never touches DOM); typed as HTMLElement to satisfy IHostWebviewView.
		container: { tag: 'webview-container' } as unknown as HTMLElement,
		layoutCalls: [],
		visible: [],
		disposed: false,
		layout(w: number, h: number) { this.layoutCalls.push({ w, h }); },
		setVisible(v: boolean) { this.visible.push(v); },
		dispose() { this.disposed = true; },
	};
}

function makeService(registered: string[]) {
	const resolved: Array<{ viewType: string; view: unknown }> = [];
	const service = {
		hasResolver(viewType: string) { return registered.includes(viewType); },
		resolve(viewType: string, view: unknown) { resolved.push({ viewType, view }); return Promise.resolve(); },
	};
	return { service, resolved };
}

const TOKEN = { isCancellationRequested: false };

// --- seam decision (drives stock vs agent view) ---

test('shouldUseAgentTabs: false when the flag is off', () => {
	assert.equal(shouldUseAgentTabs({ flagEnabled: false, designatedViewId: 'stokd.x', hasResolver: () => true }), false);
});

test('shouldUseAgentTabs: false when no view id is designated', () => {
	assert.equal(shouldUseAgentTabs({ flagEnabled: true, designatedViewId: undefined, hasResolver: () => true }), false);
});

test('shouldUseAgentTabs: false when the designated view has no resolver (fall back to stock)', () => {
	assert.equal(shouldUseAgentTabs({ flagEnabled: true, designatedViewId: 'stokd.x', hasResolver: () => false }), false);
});

test('shouldUseAgentTabs: true only when flag on AND id designated AND resolver present', () => {
	assert.equal(shouldUseAgentTabs({ flagEnabled: true, designatedViewId: 'stokd.x', hasResolver: (v) => v === 'stokd.x' }), true);
});

// --- webview host ---

test('isAvailable reflects whether a resolver is registered for the designated id', () => {
	const { service } = makeService(['stokd.dash']);
	const present = new AgentTerminalWebviewHost('stokd.dash', service as any, makeView, TOKEN as any);
	const absent = new AgentTerminalWebviewHost('stokd.missing', service as any, makeView, TOKEN as any);
	assert.equal(present.isAvailable, true);
	assert.equal(absent.isAvailable, false);
});

test('attach() resolves the designated view and returns its container when available', () => {
	const { service, resolved } = makeService(['stokd.dash']);
	const view = makeView();
	const host = new AgentTerminalWebviewHost('stokd.dash', service as any, () => view, TOKEN as any);

	const container = host.attach();

	assert.equal(container, view.container, 'attach returns the resolved webview container');
	assert.equal(host.container, view.container);
	assert.equal(resolved.length, 1, 'the designated view is resolved exactly once');
	assert.equal(resolved[0].viewType, 'stokd.dash');
	assert.equal(resolved[0].view, view, 'the created webview view is handed to the resolver');
});

test('attach() is a no-op returning undefined when no resolver is available (stock fallback)', () => {
	const { service, resolved } = makeService([]); // nothing registered
	let created = 0;
	const host = new AgentTerminalWebviewHost('stokd.dash', service as any, () => { created++; return makeView(); }, TOKEN as any);

	const container = host.attach();

	assert.equal(container, undefined, 'no container when unavailable');
	assert.equal(host.container, undefined);
	assert.equal(resolved.length, 0, 'resolve is never called without a resolver');
	assert.equal(created, 0, 'no webview view is created when unavailable');
});

test('layout/setVisible/dispose forward to the resolved view', () => {
	const { service } = makeService(['stokd.dash']);
	const view = makeView();
	const host = new AgentTerminalWebviewHost('stokd.dash', service as any, () => view, TOKEN as any);
	host.attach();

	host.layout(320, 240);
	host.setVisible(true);
	host.dispose();

	assert.deepEqual(view.layoutCalls, [{ w: 320, h: 240 }]);
	assert.deepEqual(view.visible, [true]);
	assert.equal(view.disposed, true);
	assert.equal(host.container, undefined, 'container is cleared after dispose');
});
