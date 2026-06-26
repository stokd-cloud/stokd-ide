/*---------------------------------------------------------------------------------------------
 *  Copyright (c) stokd. Thin-patch fork — agent-aware terminal selector (AX-IDE-WEBVIEW-TERMINAL-SELECTOR).
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * The in-process active-highlight core of {@link AgentTerminalTabbedView}.
 *
 * The agent-tabs strip hosts a code-ext overlay webview whose highlighted row marks
 * the active terminal. Stock, that highlight only catches up after a 2-hop round trip
 * through the extension host (renderer `onDidChangeActiveInstance` → mainThread RPC →
 * ext-host provider → `overlay.postMessage`), so keyboard cycling visibly lags the
 * terminal that actually has focus (AX-IDE-WEBVIEW-TERMINAL-SELECTOR).
 *
 * This bridge closes that gap with zero ext-host hops: the IDE host already owns the
 * in-process `ITerminalGroupService.onDidChangeActiveInstance` event and each
 * `ITerminalInstance` exposes a synchronous `processId`. On every active-instance
 * change the bridge posts that processId straight to the overlay as
 * `selectRowExternalByPid` — processId being the one stable key both sides share (the
 * code-ext webview resolves its `term-N` rows → processId). The highlight therefore
 * moves on the same frame the terminal focuses; the ext-host `selectRowExternal` path
 * remains as an idempotent fallback.
 *
 * Like the sibling `agentTerminalHostController.ts`, this is deliberately DOM-light and
 * dependency-free — the event source and the post sink are injected as plain functions,
 * so the bridge is unit-testable without a full VS Code build.
 */

/** A disposable subscription handle, matching how a VS Code `Event` listener is released. */
export interface IHighlightSubscription {
	dispose(): void;
}

/** Minimal instance ref — the only field this bridge needs from `ITerminalInstance`. */
export interface IHighlightInstanceRef {
	readonly processId: number | undefined;
}

/** Adapts a VS Code `Event<ITerminalInstance | undefined>`: subscribe, get a disposable back. */
export type IHighlightEventSource = (listener: (instance: IHighlightInstanceRef | undefined) => void) => IHighlightSubscription;

/** Posts an external-select message to the overlay webview. */
export type IHighlightPostSink = (message: { readonly type: 'selectRowExternalByPid'; readonly pid: number | undefined }) => void;

export class AgentTerminalActiveHighlightBridge {

	private readonly _subscription: IHighlightSubscription;
	private _disposed = false;

	constructor(
		onDidChangeActiveInstance: IHighlightEventSource,
		private readonly _post: IHighlightPostSink,
	) {
		this._subscription = onDidChangeActiveInstance(instance => {
			if (this._disposed) {
				return;
			}
			this._post({ type: 'selectRowExternalByPid', pid: instance?.processId });
		});
	}

	/** Unsubscribe from the active-instance event and prevent any further posts. */
	dispose(): void {
		if (this._disposed) {
			return;
		}
		this._disposed = true;
		this._subscription.dispose();
	}
}
