/*---------------------------------------------------------------------------------------------
 *  Copyright (c) stokd. Thin-patch fork — agent-aware terminal selector (AX-TERMINAL-AGENT-TABS).
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Pure, DOM-free, dependency-free row-building logic for the agent-aware terminal
 * selector. It has ZERO imports so it can be unit-tested in isolation without a
 * full VS Code build (`node --test`). The stateful model
 * ({@link AgentTerminalSelectorModel}) wires upstream events to this function;
 * all the merge/de-dupe/sectioning behavior lives here where it is testable.
 */

export type SelectorSection = 'Terminals' | 'Agents';

/** The minimal shape this module needs from an `ITerminalInstance`. */
export interface ISelectorInstanceRef {
	readonly instanceId: number;
}

export type AgentRunState = 'idle' | 'running' | 'awaiting-approval' | 'background';

export interface IAgentRowMeta {
	readonly sessionTitle: string;
	readonly runState: AgentRunState;
	readonly pendingApprovals: number;
	readonly isBackground: boolean;
}

export type SelectorRow<TInstance extends ISelectorInstanceRef = ISelectorInstanceRef> =
	| { readonly kind: 'group-header'; readonly section: SelectorSection; readonly count: number; readonly collapsed: boolean }
	| { readonly kind: 'terminal'; readonly instance: TInstance }
	| { readonly kind: 'agent'; readonly instance: TInstance; readonly meta: IAgentRowMeta };

export interface IAgentEntry<TInstance extends ISelectorInstanceRef> {
	readonly instance: TInstance;
	readonly meta: IAgentRowMeta;
}

export interface IMergeInput<TInstance extends ISelectorInstanceRef> {
	/** Human terminals — `ITerminalGroupService.instances`. */
	readonly terminals: readonly TInstance[];
	/** Agent (chat tool-session) terminals — from `ITerminalChatService`. */
	readonly agents: readonly IAgentEntry<TInstance>[];
	/** Per-section collapse state (headers always render; children hide when collapsed). */
	readonly collapsed?: { readonly terminals?: boolean; readonly agents?: boolean };
}

/**
 * Merge human terminals and agent terminals into a single, sectioned, de-duplicated
 * row list. Rules:
 *  - De-duplicate by `instanceId`.
 *  - An instance that is *both* a terminal and an agent is shown once, in the Agents
 *    section (agent identity wins — it carries more information).
 *  - Sections render in fixed order (Terminals, then Agents) and only when non-empty.
 *  - A collapsed section keeps its header (with the full count) but omits its rows.
 */
export function mergeSelectorRows<TInstance extends ISelectorInstanceRef>(
	input: IMergeInput<TInstance>
): SelectorRow<TInstance>[] {
	const agentIds = new Set<number>(input.agents.map(a => a.instance.instanceId));
	const seen = new Set<number>();
	const rows: SelectorRow<TInstance>[] = [];

	// Agents first claim their ids so a terminal that is also an agent is not double-counted.
	const agents: IAgentEntry<TInstance>[] = [];
	for (const a of input.agents) {
		if (seen.has(a.instance.instanceId)) {
			continue;
		}
		seen.add(a.instance.instanceId);
		agents.push(a);
	}

	const terminals: TInstance[] = [];
	for (const t of input.terminals) {
		if (agentIds.has(t.instanceId) || seen.has(t.instanceId)) {
			continue;
		}
		seen.add(t.instanceId);
		terminals.push(t);
	}

	if (terminals.length > 0) {
		const collapsed = input.collapsed?.terminals ?? false;
		rows.push({ kind: 'group-header', section: 'Terminals', count: terminals.length, collapsed });
		if (!collapsed) {
			for (const instance of terminals) {
				rows.push({ kind: 'terminal', instance });
			}
		}
	}

	if (agents.length > 0) {
		const collapsed = input.collapsed?.agents ?? false;
		rows.push({ kind: 'group-header', section: 'Agents', count: agents.length, collapsed });
		if (!collapsed) {
			for (const entry of agents) {
				rows.push({ kind: 'agent', instance: entry.instance, meta: entry.meta });
			}
		}
	}

	return rows;
}

// ===== Provider-driven (extension-supplied) N-section model =====
// When an extension registers a terminal tab grouping provider, the selector renders
// the provider's arbitrary, ordered sections instead of the built-in 2-section merge.
// These types + builder are kept here (pure, import-free) so they remain unit-testable.

export type ProvidedRunStatus = 'idle' | 'running' | 'attention';

export interface IProvidedTabGroup {
	readonly id: string;
	readonly label: string;
	readonly order?: number;
	readonly collapsed?: boolean;
}
export interface IProvidedTabItem {
	readonly id: number;
	readonly groupId: string;
	readonly label?: string;
	readonly description?: string;
	readonly status?: ProvidedRunStatus;
	readonly badge?: string;
}
export interface IProvidedTabModel {
	readonly groups: readonly IProvidedTabGroup[];
	readonly items: readonly IProvidedTabItem[];
}

export type ProvidedSelectorRow =
	| { readonly kind: 'group-header'; readonly sectionId: string; readonly label: string; readonly count: number; readonly collapsed: boolean }
	| { readonly kind: 'provided-item'; readonly id: number; readonly groupId: string; readonly label: string; readonly description?: string; readonly status?: ProvidedRunStatus; readonly badge?: string };

/**
 * Build a flat, sectioned row list from an extension-supplied model. Rules:
 *  - Sections render in ascending `order` (then declaration order); each shows its item count.
 *  - Items render under their assigned group, in model order; items whose `groupId` matches no
 *    group are dropped (the extension owns assignment). De-duplicated by id.
 *  - A collapsed section keeps its header (full count) but omits its items.
 *  - Empty sections still render a header (so the extension's section set is always visible).
 */
export function buildProvidedSelectorRows(model: IProvidedTabModel): ProvidedSelectorRow[] {
	const groups = [...model.groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	const groupIds = new Set(groups.map(g => g.id));
	const itemsByGroup = new Map<string, IProvidedTabItem[]>();
	const seen = new Set<number>();
	for (const item of model.items) {
		if (seen.has(item.id) || !groupIds.has(item.groupId)) {
			continue;
		}
		seen.add(item.id);
		const list = itemsByGroup.get(item.groupId);
		if (list) {
			list.push(item);
		} else {
			itemsByGroup.set(item.groupId, [item]);
		}
	}

	const rows: ProvidedSelectorRow[] = [];
	for (const group of groups) {
		const items = itemsByGroup.get(group.id) ?? [];
		const collapsed = group.collapsed ?? false;
		rows.push({ kind: 'group-header', sectionId: group.id, label: group.label, count: items.length, collapsed });
		if (!collapsed) {
			for (const item of items) {
				rows.push({
					kind: 'provided-item',
					id: item.id,
					groupId: item.groupId,
					label: item.label ?? `Terminal ${item.id}`,
					description: item.description,
					status: item.status,
					badge: item.badge,
				});
			}
		}
	}
	return rows;
}
