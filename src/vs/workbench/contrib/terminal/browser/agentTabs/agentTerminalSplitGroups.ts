/*---------------------------------------------------------------------------------------------
 *  Copyright (c) stokd. Thin-patch fork — agent-aware terminal selector (AX-CODEEXT-DASHBOARD-REFLECTS-REAL-SPLITS).
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Pure, DOM-free mapping of a terminal instance to the NATIVE split group it belongs to.
//
// A VS Code terminal "group" (ITerminalGroup) holds the instances rendered side-by-side in one
// split pane. The agent-tabs selector hosts the code-ext webview, which only sees the FLAT list of
// terminals (vscode.window.terminals) and therefore cannot tell which terminals are co-split. We
// surface that membership over the terminalTabGrouping proposed API by tagging each
// TerminalHandle with the id of its split group, derived here from ITerminalGroupService.groups.
//
// Only groups with TWO OR MORE instances are real splits; a single-instance group is just a
// terminal and gets no split id. The split-group id is the SMALLEST instanceId in the group, which
// is stable across relayouts and independent of array order.

/** Minimal instance ref — matched by its stable numeric id. */
export interface ISplitGroupMember {
	readonly instanceId: number;
}

/** Minimal terminal group — the instances it renders side-by-side. */
export interface ISplitGroupLike {
	readonly terminalInstances: readonly ISplitGroupMember[];
}

/**
 * Build instanceId -> splitGroupId for every terminal that is part of a real (>=2 member) native
 * split. Terminals not in a split are absent from the map.
 */
export function computeSplitGroupIds(groups: readonly ISplitGroupLike[] | undefined): Map<number, number> {
	const out = new Map<number, number>();
	for (const group of groups ?? []) {
		const ids = (group?.terminalInstances ?? [])
			.map(i => i?.instanceId)
			.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
		if (ids.length < 2) {
			continue; // a single-instance group is not a split
		}
		const splitId = Math.min(...ids);
		for (const id of ids) {
			out.set(id, splitId);
		}
	}
	return out;
}
