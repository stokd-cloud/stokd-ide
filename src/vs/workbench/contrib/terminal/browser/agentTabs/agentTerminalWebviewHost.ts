/*---------------------------------------------------------------------------------------------
 *  Copyright (c) stokd. Thin-patch fork — agent-aware terminal selector (AX-IDE-WEBVIEW-TERMINAL-SELECTOR).
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * The webview-hosting core of {@link AgentTerminalTabbedView}.
 *
 * Plan B: instead of the fork re-drawing a plain-text selector list, it hosts the EXISTING
 * code-ext Sessions webview (`stokd.agentDashboard`'s dedicated terminal-tabs view id) directly in
 * the terminal tabs strip. We create an empty webview view and ask {@link IWebviewViewService} to
 * resolve it through the extension's registered provider — the same machinery a sidebar
 * `WebviewViewPane` uses — so all UI/logic stays in code-ext and the fork stays a thin enabler.
 *
 * Crucially, {@link attach} is a no-op when no resolver is registered for the designated view id:
 * the caller then falls back to the stock terminal tabs, so a fork without the Sessions extension
 * never shows an empty/broken strip (AX-IDE-WEBVIEW-TERMINAL-SELECTOR).
 *
 * DOM-light and dependency-free (the webview view is produced by an injected factory and treated
 * opaquely) so the host wiring is unit-testable without a full VS Code build, mirroring
 * {@link AgentTerminalHostController}.
 */

/** Minimal cancellation token (matches `CancellationToken`). */
export interface IHostCancellationToken {
	readonly isCancellationRequested: boolean;
}

/** Minimal webview view the host creates and hands to the resolver; container is placed in the strip. */
export interface IHostWebviewView {
	readonly container: HTMLElement;
	layout(width: number, height: number): void;
	setVisible(visible: boolean): void;
	dispose(): void;
}

/** Minimal shape this host needs from `IWebviewViewService`. */
export interface IHostWebviewViewService {
	/** True only when an extension has registered a resolver for `viewType`. */
	hasResolver(viewType: string): boolean;
	/** Fill the webview view via the registered resolver (queues until one registers). */
	resolve(viewType: string, webviewView: unknown, token: IHostCancellationToken): Promise<void>;
}

export class AgentTerminalWebviewHost {

	private _view: IHostWebviewView | undefined;
	/** The webview container the dashboard renders into, once {@link attach} has run. */
	get container(): HTMLElement | undefined { return this._view?.container; }

	constructor(
		private readonly _viewId: string,
		private readonly _webviewViewService: IHostWebviewViewService,
		private readonly _createWebviewView: () => IHostWebviewView,
		private readonly _token: IHostCancellationToken,
	) { }

	/** True when an extension has registered a resolver for the designated view id. */
	get isAvailable(): boolean {
		return !!this._viewId && this._webviewViewService.hasResolver(this._viewId);
	}

	/**
	 * Create the webview view and resolve it through the extension's provider, returning the
	 * container to place in the selector strip. Returns undefined (and creates nothing) when no
	 * resolver is available, so the caller falls back to the stock terminal tabs.
	 */
	attach(): HTMLElement | undefined {
		if (!this.isAvailable) {
			return undefined;
		}
		const view = this._createWebviewView();
		this._view = view;
		void this._webviewViewService.resolve(this._viewId, view, this._token);
		return view.container;
	}

	/** Lay out the hosted webview — called from the view's `layout()`. */
	layout(width: number, height: number): void {
		this._view?.layout(width, height);
	}

	/** Track strip visibility so the overlay webview can show/hide with the panel. */
	setVisible(visible: boolean): void {
		this._view?.setVisible(visible);
	}

	dispose(): void {
		this._view?.dispose();
		this._view = undefined;
	}
}
