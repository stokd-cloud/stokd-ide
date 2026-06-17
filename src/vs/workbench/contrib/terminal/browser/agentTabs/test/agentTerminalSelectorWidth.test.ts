/*---------------------------------------------------------------------------------------------
 *  Copyright (c) stokd. Thin-patch fork — agent-aware terminal selector (AX-IDE-WEBVIEW-TERMINAL-SELECTOR).
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// DOM-free unit test for the selector-column width contract. The bug this guards: the view's
// layout() (called on every resize/visibility change) used to reset the selector to the default
// width every time, stomping the width the user had dragged. The controller must apply a width
// ONLY on the first layout and preserve it thereafter, persisting the user's sash drags.
//
// Run from source (no full build):
//   node --import tsx --test src/vs/workbench/contrib/terminal/browser/agentTabs/test/agentTerminalSelectorWidth.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	SelectorWidthController,
	clampSelectorWidth,
	resolveStoredSelectorWidth,
	SELECTOR_MIN_WIDTH,
	SELECTOR_DEFAULT_WIDTH,
	SELECTOR_MAX_WIDTH,
} from '../agentTerminalSelectorWidth.js';

test('resolveStoredSelectorWidth: returns a valid stored width, else the default', () => {
	assert.equal(resolveStoredSelectorWidth(300), 300);
	assert.equal(resolveStoredSelectorWidth(undefined), SELECTOR_DEFAULT_WIDTH);
	assert.equal(resolveStoredSelectorWidth(0), SELECTOR_DEFAULT_WIDTH);
	assert.equal(resolveStoredSelectorWidth(-10), SELECTOR_DEFAULT_WIDTH);
	assert.equal(resolveStoredSelectorWidth(Number.NaN), SELECTOR_DEFAULT_WIDTH);
});

test('clampSelectorWidth: honors an in-bounds width, caps at half the strip and at MAX', () => {
	// In bounds: honored as-is.
	assert.equal(clampSelectorWidth(300, 1000), 300);
	// Capped to half the total when the strip is narrow.
	assert.equal(clampSelectorWidth(300, 400), 200);
	// Never below MIN.
	assert.equal(clampSelectorWidth(10, 1000), SELECTOR_MIN_WIDTH);
	// Never above MAX even on a very wide strip.
	assert.equal(clampSelectorWidth(5000, 4000), SELECTOR_MAX_WIDTH);
});

test('SelectorWidthController: applies a width ONLY on the first layout, preserves it after (the fix)', () => {
	let stored: number | undefined = 300;
	const writes: number[] = [];
	const ctrl = new SelectorWidthController(() => stored, (w) => writes.push(w));

	// First layout restores the persisted, clamped width.
	assert.equal(ctrl.onLayout(1000), 300);
	// EVERY subsequent relayout (resize, visibility toggle, terminal added) must leave the size
	// alone — undefined means "don't resize", which is what stops the revert-to-default bug.
	assert.equal(ctrl.onLayout(1000), undefined);
	assert.equal(ctrl.onLayout(1200), undefined);
	assert.equal(ctrl.onLayout(800), undefined);
});

test('SelectorWidthController: a missing stored width falls back to the default on first layout', () => {
	const ctrl = new SelectorWidthController(() => undefined, () => { /* noop */ });
	assert.equal(ctrl.onLayout(1000), SELECTOR_DEFAULT_WIDTH);
});

test('SelectorWidthController: onSashChange persists the rounded width', () => {
	const writes: number[] = [];
	const ctrl = new SelectorWidthController(() => undefined, (w) => writes.push(w));
	ctrl.onSashChange(287.6);
	ctrl.onSashChange(0); // ignored — not a positive size
	ctrl.onSashChange(Number.NaN); // ignored
	assert.deepEqual(writes, [288]);
});

test('round-trip: a persisted drag is restored as the first-layout width', () => {
	let stored: number | undefined;
	const persist = (w: number) => { stored = w; };

	// Session 1: user drags the sash to 340.
	const first = new SelectorWidthController(() => stored, persist);
	first.onLayout(1200); // initial (default)
	first.onSashChange(340);
	assert.equal(stored, 340);

	// Session 2 (e.g. after reload): the persisted width is what the first layout restores.
	const second = new SelectorWidthController(() => stored, persist);
	assert.equal(second.onLayout(1200), 340);
});
