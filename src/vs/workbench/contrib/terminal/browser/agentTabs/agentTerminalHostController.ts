/*---------------------------------------------------------------------------------------------
 *  Copyright (c) stokd. Thin-patch fork — agent-aware terminal selector (AX-TERMINAL-AGENT-TABS-HOSTS-LIVE-TERMINAL).
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * The terminal-hosting core of {@link AgentTerminalTabbedView}.
 *
 * When `terminal.integrated.agentTabs.enabled` is on, the fork swaps the stock
 * `TerminalTabbedView` for the agent-aware view. That view MUST still do the one
 * thing the stock view does that actually makes the panel usable: register a DOM
 * container with the terminal service so xterm has somewhere to render, lay the
 * terminal groups out on resize, and focus the instance a selector row maps to.
 * The Phase-2 skeleton omitted all of this, which left only a list of labels and
 * bricked the integrated terminal (AX-TERMINAL-AGENT-TABS-HOSTS-LIVE-TERMINAL).
 *
 * This controller is deliberately DOM-light and dependency-free — the terminal
 * container is created by an injected factory and treated opaquely — so the
 * host wiring (the part that regressed) is unit-testable without a full VS Code
 * build, mirroring the pure-core convention of `agentTerminalSelectorRows.ts`.
 */

/** Minimal shape this controller needs from `ITerminalService`. */
export interface IHostTerminalService {
	setContainers(panelContainer: HTMLElement, terminalContainer: HTMLElement): void;
}

/** Minimal instance ref — matched against selector-row ids. */
export interface IHostInstanceRef {
	readonly instanceId: number;
}

/** Minimal terminal group — laid out on panel resize. */
export interface IHostTerminalGroup {
	layout(width: number, height: number): void;
}

/** Minimal shape this controller needs from `ITerminalGroupService`. */
export interface IHostTerminalGroupService {
	readonly instances: readonly IHostInstanceRef[];
	readonly groups: readonly IHostTerminalGroup[];
	setActiveInstance(instance: IHostInstanceRef): void;
	showPanel(focus?: boolean): Promise<void> | void;
}

export class AgentTerminalHostController {

	private _container: HTMLElement | undefined;
	/** The DOM element terminals render into, once {@link attach} has run. */
	get container(): HTMLElement | undefined { return this._container; }

	constructor(
		private readonly _terminalService: IHostTerminalService,
		private readonly _groupService: IHostTerminalGroupService,
		private readonly _createContainer: () => HTMLElement,
	) { }

	/**
	 * Create the terminal container and register it with the terminal service so
	 * xterm renders into the agent-tabs panel. Returns the hosted container so the
	 * view can place it in its split layout.
	 */
	attach(parentElement: HTMLElement): HTMLElement {
		const container = this._createContainer();
		this._container = container;
		this._terminalService.setContainers(parentElement, container);
		return container;
	}

	/**
	 * Focus the terminal a selector row maps to: resolve the instance by id, set it
	 * active and reveal the panel. Returns false (and is a no-op) for an unknown id.
	 */
	activate(instanceId: number): boolean {
		const instance = this._groupService.instances.find(i => i.instanceId === instanceId);
		if (!instance) {
			return false;
		}
		this._groupService.setActiveInstance(instance);
		void this._groupService.showPanel(true);
		return true;
	}

	/** Lay out every hosted terminal group — called from the view's `layout()`. */
	layoutGroups(width: number, height: number): void {
		for (const group of this._groupService.groups) {
			group.layout(width, height);
		}
	}
}
