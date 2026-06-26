/*---------------------------------------------------------------------------------------------
 *  Copyright (c) stokd. Thin-patch fork — agent-aware terminal selector (AX-IDE-WEBVIEW-TERMINAL-SELECTOR).
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../../base/browser/dom.js';
import { getWindow } from '../../../../../base/browser/dom.js';
import { LayoutPriority, Orientation, Sizing, SplitView } from '../../../../../base/browser/ui/splitview/splitview.js';
import { Emitter } from '../../../../../base/common/event.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { Disposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { IOverlayWebview, IWebviewService, WebviewContentPurpose } from '../../../webview/browser/webview.js';
import { IWebviewViewService, WebviewView } from '../../../webviewView/browser/webviewViewService.js';
import { ITerminalConfigurationService, ITerminalGroupService, ITerminalService } from '../terminal.js';
import { ITerminalTabsView } from './ITerminalTabsView.js';
import { AgentTerminalHostController } from './agentTerminalHostController.js';
import { AgentTerminalActiveHighlightBridge } from './agentTerminalActiveHighlightBridge.js';
import { AgentTerminalWebviewHost, IHostWebviewView } from './agentTerminalWebviewHost.js';
import { SelectorWidthController, SELECTOR_MIN_WIDTH, SELECTOR_MAX_WIDTH, SELECTOR_WIDTH_STORAGE_KEY } from './agentTerminalSelectorWidth.js';

/** Matches the stock view's `CssClass.ViewIsVertical` so xterm lays out correctly in a side panel. */
const VIEW_IS_VERTICAL_CLASS = 'terminal-side-view';

/**
 * Px reserved along the strip's terminal-facing edge. Kept at 0 so the hosted dashboard sits flush
 * against the sash with no visible gap — the divider line is drawn by the webview (a 1px border on
 * its terminal-facing edge), and the SplitView sash is still grabbable from the terminal-body side.
 */
const SASH_RESERVE = 0;

/**
 * Replacement for `TerminalTabbedView`, created by `TerminalViewPane` when
 * `terminal.integrated.agentTabs.enabled` is on AND a resolver is registered for the designated host
 * view id (AX-IDE-WEBVIEW-TERMINAL-SELECTOR). The seam only ever constructs this when the webview is
 * available, so there is no native-list fallback here — the stock view is the fallback path.
 *
 * Plan B: the selector strip HOSTS the code-ext Sessions webview (`stokd.agentDashboard`'s dedicated
 * terminal-tabs view id) via the same `IWebviewViewService.resolve` machinery a sidebar
 * `WebviewViewPane` uses, instead of the fork re-drawing a native list. All selector UI/behavior
 * (rows, status, click-to-switch via `window.activateTerminalById`) lives in the code-ext webview;
 * the fork stays a thin enabler. xterm hosting (the live terminal body) is delegated to the
 * DOM-light, unit-tested `AgentTerminalHostController`, unchanged from the native-list version.
 */
export class AgentTerminalTabbedView extends Disposable implements ITerminalTabsView {

	private readonly _splitView: SplitView;
	private readonly _listContainer: HTMLElement;
	/** Inset child of the strip the overlay webview anchors to, leaving the sash edge exposed. */
	private _webviewAnchor: HTMLElement;
	private readonly _terminalContainer: HTMLElement;
	private readonly _host: AgentTerminalHostController;
	private readonly _webviewHost: AgentTerminalWebviewHost;
	private readonly _onDidChangeVisibility = this._register(new Emitter<boolean>());

	/** The hosted overlay webview, captured so layout()/visibility can drive it. */
	private _overlay: IOverlayWebview | undefined;

	private readonly _selectorIndex: number;

	private _width: number | undefined;
	private _height: number | undefined;

	/** Owns the selector column width: restores the persisted value once, preserves it across relayouts. */
	private readonly _widthController: SelectorWidthController;

	constructor(
		parentElement: HTMLElement,
		private readonly _designatedViewId: string,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@ITerminalGroupService private readonly _terminalGroupService: ITerminalGroupService,
		@ITerminalConfigurationService private readonly _terminalConfigurationService: ITerminalConfigurationService,
		@IWebviewService private readonly _webviewService: IWebviewService,
		@IWebviewViewService private readonly _webviewViewService: IWebviewViewService,
		@IInstantiationService _instantiationService: IInstantiationService,
		@IStorageService private readonly _storageService: IStorageService,
	) {
		super();

		this._widthController = new SelectorWidthController(
			() => this._storageService.getNumber(SELECTOR_WIDTH_STORAGE_KEY, StorageScope.PROFILE),
			(width) => this._storageService.store(SELECTOR_WIDTH_STORAGE_KEY, width, StorageScope.PROFILE, StorageTarget.USER),
		);

		// Host a live terminal: create the container and register it with the terminal service so
		// xterm has somewhere to render. Without this the panel is just a selector.
		this._host = new AgentTerminalHostController(
			this._terminalService,
			this._terminalGroupService,
			() => dom.$('.terminal-groups-container'),
		);
		this._terminalContainer = this._host.attach(parentElement);
		const terminalOuterContainer = dom.$('.terminal-outer-container');
		terminalOuterContainer.appendChild(this._terminalContainer);

		this._listContainer = dom.$('.agent-terminal-tabs-webview');
		// Fill the split-view cell: the SplitView wrapper is height:100% but this element has no
		// intrinsic height (its content — the hosted dashboard — is an overlay webview anchored to
		// it, not a DOM child), so without this it collapses to 0px and the dashboard is invisible.
		this._listContainer.style.width = '100%';
		this._listContainer.style.height = '100%';
		this._listContainer.style.position = 'relative';
		// Match the editor background so the reserved sash gap blends with the hosted dashboard
		// (which also uses the editor background), leaving only the single divider line below.
		this._listContainer.style.background = 'var(--vscode-editor-background)';

		// Keep xterm's vertical-layout class in sync with the panel orientation, like the stock view.
		this._register(this._terminalGroupService.onDidChangePanelOrientation((orientation) => {
			this._terminalContainer.classList.toggle(VIEW_IS_VERTICAL_CLASS, orientation === Orientation.VERTICAL);
		}));

		// Relayout the hosted terminal when the set of terminals changes (e.g. first terminal created).
		this._register(this._terminalGroupService.onDidChangeInstances(() => this._relayoutTerminal()));

		const selectorOnLeft = this._terminalConfigurationService.config.tabs.location !== 'right';
		this._selectorIndex = selectorOnLeft ? 0 : 1;
		const terminalIndex = selectorOnLeft ? 1 : 0;

		// Anchor the overlay webview to an inset child, leaving SASH_RESERVE px exposed on the strip's
		// terminal-facing edge (its right when the selector is on the left, else its left) so the
		// SplitView drag sash there stays visible and grabbable instead of being painted over.
		this._webviewAnchor = dom.append(this._listContainer, dom.$('.agent-terminal-tabs-webview-anchor'));
		this._webviewAnchor.style.position = 'absolute';
		this._webviewAnchor.style.top = '0';
		this._webviewAnchor.style.bottom = '0';
		this._webviewAnchor.style.setProperty(selectorOnLeft ? 'left' : 'right', '0');
		this._webviewAnchor.style.setProperty(selectorOnLeft ? 'right' : 'left', `${SASH_RESERVE}px`);

		this._splitView = new SplitView(parentElement, { orientation: Orientation.HORIZONTAL, proportionalLayout: false });
		this._register(toDisposable(() => this._splitView.dispose()));

		// Persist the user's chosen selector width whenever they drag the sash, so it survives
		// relayouts and reloads (the layout() path restores it once, then leaves it alone).
		this._register(this._splitView.onDidSashChange(() => {
			this._widthController.onSashChange(this._splitView.getViewSize(this._selectorIndex));
		}));

		const addSelector = () => this._splitView.addView({
			element: this._listContainer,
			layout: () => this._layoutWebview(),
			minimumSize: SELECTOR_MIN_WIDTH,
			maximumSize: SELECTOR_MAX_WIDTH,
			onDidChange: () => Disposable.None,
			priority: LayoutPriority.Low,
		}, Sizing.Distribute, this._selectorIndex);

		const addTerminal = () => this._splitView.addView({
			element: terminalOuterContainer,
			layout: width => this._host.layoutGroups(width, this._height ?? 0),
			minimumSize: 120,
			maximumSize: Number.POSITIVE_INFINITY,
			onDidChange: () => Disposable.None,
			priority: LayoutPriority.High,
		}, Sizing.Distribute, terminalIndex);

		// Add in ascending index order so the requested column placement is honored.
		if (selectorOnLeft) {
			addSelector();
			addTerminal();
		} else {
			addTerminal();
			addSelector();
		}

		// Host the code-ext Sessions webview in the selector strip. The seam already verified a
		// resolver exists for `_designatedViewId`, so this resolves the extension's provider into our
		// overlay; the dashboard renders here and drives terminal switching itself.
		this._webviewHost = this._register(new AgentTerminalWebviewHost(
			this._designatedViewId,
			this._webviewViewService,
			() => this._createWebviewView(),
			this._register(new CancellationTokenSource()).token,
		));
		this._webviewHost.attach();

		// Move the overlay's highlighted row in-process the instant the active terminal changes,
		// posting the active processId straight to the overlay as `selectRowExternalByPid` with zero
		// ext-host hops (AX-IDE-WEBVIEW-TERMINAL-SELECTOR). The ext-host `selectRowExternal` path stays
		// as an idempotent fallback. The post sink reads the live overlay each time, so a webview that
		// is later rebuilt still receives the highlight.
		const highlightBridge = new AgentTerminalActiveHighlightBridge(
			listener => this._terminalGroupService.onDidChangeActiveInstance(listener),
			message => { void this._overlay?.postMessage(message); },
		);
		this._register(toDisposable(() => highlightBridge.dispose()));
	}

	/** Build an overlay webview + the WebviewView the resolver fills, exposed via the host's IHostWebviewView. */
	private _createWebviewView(): IHostWebviewView {
		const overlay: IOverlayWebview = this._webviewService.createWebviewOverlay({
			origin: undefined,
			providedViewType: this._designatedViewId,
			title: undefined,
			options: { purpose: WebviewContentPurpose.WebviewView },
			contentOptions: {},
			extension: undefined,
		});
		this._overlay = overlay;
		overlay.claim(this, getWindow(this._listContainer), undefined);
		this._layoutWebview();

		const onDispose = this._register(new Emitter<void>());
		const self = this;
		const view: WebviewView & IHostWebviewView = {
			webview: overlay,
			onDidChangeVisibility: this._onDidChangeVisibility.event,
			onDispose: onDispose.event,
			get title(): string | undefined { return undefined; },
			set title(_v: string | undefined) { /* the strip has no title chrome */ },
			get description(): string | undefined { return undefined; },
			set description(_v: string | undefined) { /* no-op */ },
			get badge() { return undefined; },
			set badge(_v) { /* no-op */ },
			dispose: () => { onDispose.fire(); overlay.dispose(); if (self._overlay === overlay) { self._overlay = undefined; } },
			show: (preserveFocus: boolean) => { if (!preserveFocus) { overlay.focus(); } },
			// IHostWebviewView surface consumed by AgentTerminalWebviewHost:
			container: overlay.container,
			layout: () => self._layoutWebview(),
			setVisible: (visible: boolean) => {
				if (visible) { overlay.claim(self, getWindow(self._listContainer), undefined); } else { overlay.release(self); }
				self._onDidChangeVisibility.fire(visible);
			},
		};
		return view;
	}

	/** Position the hosted overlay webview over the selector strip element. */
	private _layoutWebview(): void {
		this._overlay?.setAnchorElement(this._webviewAnchor);
	}

	private _relayoutTerminal(): void {
		if (this._width === undefined || this._height === undefined) {
			return;
		}
		this._splitView.layout(this._width);
	}

	rerenderTabs(): void {
		// The selector is the hosted webview; it re-renders itself from realtime/session state.
		this._layoutWebview();
	}

	layout(width: number, height: number): void {
		this._width = width;
		this._height = height;
		// Lay out at the new size FIRST — with proportionalLayout:false this preserves each view's
		// current size and feeds the delta to the high-priority terminal, so the selector keeps the
		// width the user chose. Only apply an explicit selector width on the FIRST layout (restoring
		// the persisted value); never reset it to default on subsequent relayouts (the old bug).
		this._splitView.layout(width);
		const initialWidth = this._widthController.onLayout(width);
		if (initialWidth !== undefined) {
			this._splitView.resizeView(this._selectorIndex, initialWidth);
		}
		this._layoutWebview();
	}

	setEditable(_isEditing: boolean): void {
		// No inline-rename in this view; selection is handled inside the hosted webview.
	}

	focusTabs(): void {
		this._listContainer.focus();
	}

	focus(): void {
		const active = this._terminalGroupService.activeInstance;
		if (active) {
			active.focus();
			return;
		}
		this._listContainer.focus();
	}

	focusHover(): void {
		// Hover surface is owned by the hosted webview.
	}
}
