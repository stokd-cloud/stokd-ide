/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'vscode' {

	// stokd thin-patch fork proposal: terminal tab grouping (AX-IDE-THIN-WRAPPER-TERMINAL-GROUPING).
	// Lets an extension (a) enumerate every terminal — including internal/agent (chat tool-session)
	// terminals it otherwise cannot see — by a stable numeric id, and (b) drive the native terminal
	// tab strip's sections + per-row decorations. Intentionally generic — no product-specific
	// vocabulary — and shaped to mirror terminalQuickFixProvider so it is straightforward to upstream.
	// https://github.com/microsoft/vscode/issues/ (proposal pending)

	/**
	 * A handle to any terminal (public or internal/agent), addressed by its stable numeric id so it
	 * can be grouped, decorated, and activated without needing a {@link Terminal} proxy (internal
	 * agent terminals do not have one).
	 */
	export interface TerminalHandle {
		/** Stable numeric terminal id (the same id used by {@link TerminalGroupItem.id}). */
		readonly id: number;
		readonly title: string;
		/** True for an internal/agent (chat tool-session) terminal; false for a regular terminal. */
		readonly isInternal: boolean;
		/** The chat tool-session id, if this terminal is backed by one. */
		readonly toolSessionId?: string;
		/** The chat session resource, if any (useful for deriving a display title). */
		readonly chatSessionUri?: Uri;
		/** Whether the terminal is a hidden/background (tool-driven) terminal. */
		readonly isBackground: boolean;
		/** Whether a command is currently running in the terminal. */
		readonly isRunning: boolean;
		/**
		 * Id of the native split group this terminal is co-rendered in, when it belongs to a split
		 * of two or more terminals. Undefined for an un-split terminal. Lets an extension reflect the
		 * editor's real terminal splits instead of a flat list.
		 */
		readonly splitGroupId?: number;
		/** OS process id, useful to join this handle to an extension's own {@link Terminal} proxy. */
		readonly processId?: number;
	}

	/**
	 * A row the provider assigns to a section and decorates, addressed by terminal id
	 * ({@link TerminalHandle.id}).
	 */
	export interface TerminalGroupItem {
		/** The terminal id this decoration applies to. */
		readonly id: number;
		/** Id of the {@link TerminalTabGroup section} this item belongs to. */
		groupId: string;
		label?: string;
		description?: string;
		/** Generic run status. The provider maps richer product semantics onto these three. */
		status?: 'idle' | 'running' | 'attention';
		badge?: string;
	}

	/** An ordered section in the terminal tab strip. */
	export interface TerminalTabGroup {
		readonly id: string;
		label: string;
		/** Lower sorts first. */
		order?: number;
		collapsed?: boolean;
	}

	/** The full sectioned model the provider returns: ordered sections + per-terminal assignment. */
	export interface TerminalTabGroupingModel {
		readonly groups: readonly TerminalTabGroup[];
		readonly items: readonly TerminalGroupItem[];
	}

	/**
	 * Drives the native terminal tab strip's sections and decorations. The host renders generically
	 * from whatever this returns; all grouping/classification policy lives in the extension.
	 */
	export interface TerminalTabGroupingProvider {
		/** Fire to ask the host to re-request the grouping model. */
		onDidChangeGroups?: Event<void>;
		/**
		 * Provide the sectioned model for the current set of terminals.
		 * @param terminals Every terminal (regular + internal/agent), each with a stable id.
		 * @param token Cancellation.
		 */
		provideTerminalGroups(
			terminals: readonly TerminalHandle[],
			token: CancellationToken
		): ProviderResult<TerminalTabGroupingModel>;
		/** The user selected a row; the extension decides what "activate" means for that id. */
		handleDidSelectTerminal?(id: number, token: CancellationToken): void;
	}

	export namespace window {
		/** Fires when the set of terminals (regular or internal/agent) changes. */
		export const onDidChangeTerminalHandles: Event<void>;
		/** Enumerate every terminal (regular + internal/agent) by handle. */
		export function getTerminalHandles(): readonly TerminalHandle[];
		/** Activate any terminal by id — works for internal/agent terminals too. */
		export function activateTerminalById(id: number, preserveFocus?: boolean): Thenable<void>;
		/**
		 * Register the provider that drives the terminal tab strip's sections + decorations.
		 * @returns A {@link Disposable} that unregisters the provider when disposed.
		 */
		export function registerTerminalTabGroupingProvider(provider: TerminalTabGroupingProvider): Disposable;
	}
}
