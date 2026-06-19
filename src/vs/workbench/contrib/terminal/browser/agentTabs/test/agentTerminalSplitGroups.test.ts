/*---------------------------------------------------------------------------------------------
 *  Copyright (c) stokd. Thin-patch fork — agent-aware terminal selector (AX-CODEEXT-DASHBOARD-REFLECTS-REAL-SPLITS).
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// DOM-free unit test for native split-group detection. The bug this guards: the hosted webview
// selector only sees the flat terminal list and renders co-split terminals as separate rows; it
// must instead reflect the editor's REAL splits, which requires mapping each terminal instance to
// the split group it belongs to.
//
// Run from source (no full build):
//   node --import tsx --test src/vs/workbench/contrib/terminal/browser/agentTabs/test/agentTerminalSplitGroups.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSplitGroupIds } from '../agentTerminalSplitGroups.js';

const group = (...ids: number[]) => ({ terminalInstances: ids.map(instanceId => ({ instanceId })) });

test('a >=2-member group maps every member to the smallest instanceId', () => {
	const map = computeSplitGroupIds([group(7, 3, 9)]);
	assert.equal(map.get(7), 3);
	assert.equal(map.get(3), 3);
	assert.equal(map.get(9), 3);
	assert.equal(map.size, 3);
});

test('a single-instance group is NOT a split and yields no entries', () => {
	const map = computeSplitGroupIds([group(5)]);
	assert.equal(map.size, 0);
});

test('multiple split groups stay independent', () => {
	const map = computeSplitGroupIds([group(4, 2), group(10, 8), group(99)]);
	// group A -> 2
	assert.equal(map.get(4), 2);
	assert.equal(map.get(2), 2);
	// group B -> 8
	assert.equal(map.get(10), 8);
	assert.equal(map.get(8), 8);
	// the lone terminal (99) is absent
	assert.equal(map.has(99), false);
	assert.equal(map.size, 4);
});

test('empty / malformed input is handled', () => {
	assert.equal(computeSplitGroupIds(undefined).size, 0);
	assert.equal(computeSplitGroupIds([]).size, 0);
	assert.equal(computeSplitGroupIds([{ terminalInstances: [] }]).size, 0);
});
