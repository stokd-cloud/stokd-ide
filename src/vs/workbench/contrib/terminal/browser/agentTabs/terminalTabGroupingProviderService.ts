/*---------------------------------------------------------------------------------------------
 *  Copyright (c) stokd. Thin-patch fork — agent-aware terminal selector (AX-IDE-THIN-WRAPPER-TERMINAL-GROUPING).
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { IProvidedTabModel } from './agentTerminalSelectorRows.js';

export { IProvidedTabModel };

export const ITerminalTabGroupingProviderService = createDecorator<ITerminalTabGroupingProviderService>('terminalTabGroupingProviderService');

/**
 * In-renderer bridge between the api-layer mainThreadTerminalService (which owns the
 * extension-registered provider over RPC) and the agentTabs selector view (which renders the
 * model). Holds no policy — the model is whatever the extension supplied.
 */
export interface ITerminalTabGroupingProviderService {
	readonly _serviceBrand: undefined;
	/** Fires when the provided model or provider-presence changes. */
	readonly onDidChangeModel: Event<void>;
	/** True when an extension has registered a grouping provider. */
	hasProvider(): boolean;
	/** The latest extension-supplied model, or undefined when none/unprovided. */
	getModel(): IProvidedTabModel | undefined;

	/** Called by the api layer when a provider (un)registers. */
	setHasProvider(hasProvider: boolean): void;
	/** Called by the api layer when the extension supplies a fresh model. */
	setModel(model: IProvidedTabModel | undefined): void;
	/** Called by the api layer to install the activation handler (focus + notify extension). */
	setActivateHandler(handler: ((instanceId: number) => void) | undefined): void;
	/** Called by the selector view when the user picks a row. */
	activate(instanceId: number): void;
}

export class TerminalTabGroupingProviderService extends Disposable implements ITerminalTabGroupingProviderService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeModel = this._register(new Emitter<void>());
	readonly onDidChangeModel = this._onDidChangeModel.event;

	private _hasProvider = false;
	private _model: IProvidedTabModel | undefined;
	private _activateHandler: ((instanceId: number) => void) | undefined;

	hasProvider(): boolean {
		return this._hasProvider;
	}

	getModel(): IProvidedTabModel | undefined {
		return this._hasProvider ? this._model : undefined;
	}

	setHasProvider(hasProvider: boolean): void {
		if (this._hasProvider === hasProvider) {
			return;
		}
		this._hasProvider = hasProvider;
		if (!hasProvider) {
			this._model = undefined;
		}
		this._onDidChangeModel.fire();
	}

	setModel(model: IProvidedTabModel | undefined): void {
		this._model = model;
		this._onDidChangeModel.fire();
	}

	setActivateHandler(handler: ((instanceId: number) => void) | undefined): void {
		this._activateHandler = handler;
	}

	activate(instanceId: number): void {
		this._activateHandler?.(instanceId);
	}
}

registerSingleton(ITerminalTabGroupingProviderService, TerminalTabGroupingProviderService, InstantiationType.Delayed);
