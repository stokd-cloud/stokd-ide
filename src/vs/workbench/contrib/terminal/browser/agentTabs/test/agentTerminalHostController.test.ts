/*---------------------------------------------------------------------------------------------
 *  Copyright (c) stokd. Thin-patch fork — agent-aware terminal selector (AX-TERMINAL-AGENT-TABS-HOSTS-LIVE-TERMINAL).
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// DOM-free unit test for the terminal-hosting controller that backs AgentTerminalTabbedView.
// It is the falsifiable core of AX-TERMINAL-AGENT-TABS-HOSTS-LIVE-TERMINAL: when the
// `terminal.integrated.agentTabs.enabled` flag is on, the replacement view MUST host a live
// terminal — i.e. create a terminal container, register it via ITerminalService.setContainers,
// activate (set-active + show-panel) the instance a selector row maps to, and lay out the groups.
// The Phase-2 skeleton did none of these, which bricked the integrated terminal.
//
// Run from source (no full build) exactly like the sibling model test:
//   node --import tsx --test src/vs/workbench/contrib/terminal/browser/agentTabs/test/agentTerminalHostController.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgentTerminalHostController } from '../agentTerminalHostController.js';

interface FakeInstance { readonly instanceId: number; }
interface FakeGroup { layoutCalls: Array<{ width: number; height: number }>; layout(width: number, height: number): void; }

function group(): FakeGroup {
	const g: FakeGroup = {
		layoutCalls: [],
		layout(width: number, height: number) { this.layoutCalls.push({ width, height }); },
	};
	return g;
}

function makeHosts(instances: FakeInstance[], groups: FakeGroup[]) {
	const calls = {
		setContainers: [] as Array<{ parent: unknown; container: unknown }>,
		activated: [] as FakeInstance[],
		showPanel: [] as Array<boolean | undefined>,
	};
	const terminalHost = {
		setContainers(parent: unknown, container: unknown) { calls.setContainers.push({ parent, container }); },
	};
	const groupHost = {
		get instances() { return instances; },
		get groups() { return groups; },
		setActiveInstance(instance: FakeInstance) { calls.activated.push(instance); },
		showPanel(focus?: boolean) { calls.showPanel.push(focus); return Promise.resolve(); },
	};
	return { terminalHost, groupHost, calls };
}

test('attach() creates a terminal container and registers it via setContainers exactly once', () => {
	const { terminalHost, groupHost, calls } = makeHosts([], []);
	const parent = { tag: 'parent' };
	const created = { tag: 'terminal-groups-container' };
	const controller = new AgentTerminalHostController(terminalHost as any, groupHost as any, () => created as any);

	const container = controller.attach(parent as any);

	assert.equal(calls.setContainers.length, 1, 'setContainers must be called exactly once');
	assert.equal(calls.setContainers[0].parent, parent, 'parent element is forwarded');
	assert.equal(calls.setContainers[0].container, created, 'the created terminal container is registered');
	assert.equal(container, created, 'attach returns the hosted terminal container');
	assert.equal(controller.container, created);
});

test('activate(id) for a known instance sets it active and shows the panel', () => {
	const inst = { instanceId: 7 };
	const { terminalHost, groupHost, calls } = makeHosts([{ instanceId: 3 }, inst], []);
	const controller = new AgentTerminalHostController(terminalHost as any, groupHost as any, () => ({}) as any);

	const ok = controller.activate(7);

	assert.equal(ok, true, 'activation of a known instance succeeds');
	assert.deepEqual(calls.activated, [inst], 'the resolved instance is set active');
	assert.deepEqual(calls.showPanel, [true], 'the panel is shown focused');
});

test('activate(id) for an unknown instance is a no-op and returns false', () => {
	const { terminalHost, groupHost, calls } = makeHosts([{ instanceId: 1 }], []);
	const controller = new AgentTerminalHostController(terminalHost as any, groupHost as any, () => ({}) as any);

	const ok = controller.activate(999);

	assert.equal(ok, false);
	assert.equal(calls.activated.length, 0, 'no instance is activated');
	assert.equal(calls.showPanel.length, 0, 'the panel is not shown');
});

test('layoutGroups(w,h) lays out every hosted terminal group with the given dimensions', () => {
	const g1 = group();
	const g2 = group();
	const { terminalHost, groupHost } = makeHosts([], [g1, g2]);
	const controller = new AgentTerminalHostController(terminalHost as any, groupHost as any, () => ({}) as any);

	controller.layoutGroups(640, 480);

	assert.deepEqual(g1.layoutCalls, [{ width: 640, height: 480 }]);
	assert.deepEqual(g2.layoutCalls, [{ width: 640, height: 480 }]);
});
