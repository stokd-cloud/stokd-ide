/*---------------------------------------------------------------------------------------------
 *  Copyright (c) stokd. Thin-patch fork — agent-aware terminal selector (AX-IDE-WEBVIEW-TERMINAL-SELECTOR).
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Pure, DOM-free width logic for the agent-terminal selector column. Extracted so the
// "size once + persist the user's drag, never reset to default on relayout" contract is
// unit-testable without the SplitView/webview machinery.
//
// THE BUG THIS FIXES: the view's layout() — called on every panel/window resize and
// visibility change — used to call resizeView(selector, DEFAULT) unconditionally, stomping
// the width the user had dragged back to the default on every relayout. The controller below
// applies a width to the selector ONLY on the first layout (restoring the persisted value),
// and otherwise leaves the SplitView to preserve the current size; the user's drags are
// persisted via onSashChange.

/** Default + bounds for the selector column (mirrors TerminalTabsListSizes). */
export const SELECTOR_MIN_WIDTH = 46;
export const SELECTOR_DEFAULT_WIDTH = 220;
export const SELECTOR_MAX_WIDTH = 600;

/** Storage key for the user's chosen selector width (per profile, synced as a user setting). */
export const SELECTOR_WIDTH_STORAGE_KEY = 'stokd.agentTabs.selectorWidth';

/** A stored width is only honored when it is a finite, positive number; otherwise fall back to default. */
export function resolveStoredSelectorWidth(stored: number | undefined): number {
	return (typeof stored === 'number' && Number.isFinite(stored) && stored > 0)
		? stored
		: SELECTOR_DEFAULT_WIDTH;
}

/** Clamp a selector width into [MIN, min(MAX, floor(total/2))] so it never exceeds half the strip. */
export function clampSelectorWidth(width: number, totalWidth: number): number {
	const cap = Math.max(SELECTOR_MIN_WIDTH, Math.min(SELECTOR_MAX_WIDTH, Math.floor(totalWidth / 2)));
	const w = (Number.isFinite(width) && width > 0) ? width : SELECTOR_DEFAULT_WIDTH;
	return Math.max(SELECTOR_MIN_WIDTH, Math.min(w, cap));
}

/**
 * Owns the selector column's width across relayouts. `onLayout` returns a width to apply ONLY
 * on the first layout (the persisted/clamped value); every subsequent relayout returns
 * `undefined`, meaning "leave it — the SplitView already preserves the user's size". User sash
 * drags are persisted via `onSashChange`. Pure (storage is injected) so it is unit-testable.
 */
export class SelectorWidthController {
	private _applied = false;

	constructor(
		private readonly _read: () => number | undefined,
		private readonly _store: (width: number) => void,
	) { }

	/**
	 * @returns the clamped width to resize the selector to on the FIRST layout, or `undefined`
	 * on every later relayout (preserve the current size — this is the fix for the width revert).
	 */
	onLayout(totalWidth: number): number | undefined {
		if (this._applied) {
			return undefined;
		}
		this._applied = true;
		return clampSelectorWidth(resolveStoredSelectorWidth(this._read()), totalWidth);
	}

	/** Persist the selector width after a user sash drag. */
	onSashChange(currentSelectorWidth: number): void {
		if (Number.isFinite(currentSelectorWidth) && currentSelectorWidth > 0) {
			this._store(Math.round(currentSelectorWidth));
		}
	}
}
