/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../base/browser/dom.js';
import { Gesture, EventType as TouchEventType } from '../../../../base/browser/touch.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { BaseActionViewItem } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable, DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { autorun, IObservable } from '../../../../base/common/observable.js';
import { localize, localize2 } from '../../../../nls.js';
import { IActionViewItemService } from '../../../../platform/actions/browser/actionViewItemService.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IActionListDelegate, IActionListItem, IActionListOptions } from '../../../../platform/actionWidget/browser/actionList.js';
import { ActionListItemKind } from '../../../../platform/actionWidget/browser/actionList.js';
import { IActionWidgetService } from '../../../../platform/actionWidget/browser/actionWidget.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../../workbench/common/contributions.js';
import { Menus } from '../../../browser/menus.js';
import { ActiveSessionHasPermissionModesContext } from '../../../common/contextkeys.js';
import { ISessionsProvidersService } from '../../../services/sessions/browser/sessionsProvidersService.js';
import { ISessionPermissionMode } from '../../../services/sessions/common/sessionsProvider.js';
import { getProviderCurrentPermissionMode, getProviderPermissionModes } from '../../../services/sessions/common/permissionModes.js';
import { ISession } from '../../../services/sessions/common/session.js';
import { IActiveSession } from '../../../services/sessions/common/sessionsManagement.js';
import { ISessionInputContext } from './sessionInputContext.js';
import { reportNewChatPickerClosed } from './newChatPickerTelemetry.js';

/**
 * Whether the active session's provider declares any permission ("approvals")
 * modes — i.e. whether the generic permission-mode picker should be shown.
 * Not reactive on its own; callers re-evaluate when the provider fires
 * {@link ISessionsProvider.onDidChangePermissionModes}.
 */
export function sessionHasPermissionModes(session: ISession | undefined, sessionsProvidersService: ISessionsProvidersService): boolean {
	if (!session) {
		return false;
	}
	return getProviderPermissionModes(sessionsProvidersService.getProvider(session.providerId), session.sessionId).length > 0;
}

/**
 * The sessions-core permission-mode picker. A single, provider-agnostic widget
 * that renders whatever modes the active session's provider declares via
 * {@link ISessionsProvider.getPermissionModes} and applies the user's choice
 * through {@link ISessionsProvider.setPermissionMode}. It replaces the previous
 * per-provider Claude pickers: every provider-specific notion of permission
 * modes now lives in the provider, while this widget knows nothing about any
 * particular agent.
 */
export class PermissionModePicker extends Disposable {

	private readonly _renderDisposables = this._register(new DisposableStore());
	private readonly _providerListener = this._register(new MutableDisposable());
	private _slotElement: HTMLElement | undefined;
	private _triggerElement: HTMLElement | undefined;
	private _currentModeId: string | undefined;

	constructor(
		private readonly _session: IObservable<IActiveSession | undefined>,
		@IActionWidgetService private readonly _actionWidgetService: IActionWidgetService,
		@ISessionsProvidersService private readonly _sessionsProvidersService: ISessionsProvidersService,
		@ITelemetryService private readonly _telemetryService: ITelemetryService,
	) {
		super();

		// When the active session changes, re-bind the provider's
		// change event (the available modes can change while a session is
		// active — e.g. a setting that gates extra modes is toggled, or an
		// agent-host session config finishes resolving) and refresh the trigger.
		this._register(autorun(reader => {
			const session = this._session.read(reader);
			const provider = session ? this._sessionsProvidersService.getProvider(session.providerId) : undefined;
			this._providerListener.value = provider?.onDidChangePermissionModes?.(() => this._update());
			this._update();
		}));
	}

	render(container: HTMLElement): HTMLElement {
		this._renderDisposables.clear();

		const slot = dom.append(container, dom.$('.sessions-chat-picker-slot.sessions-chat-permission-picker'));
		this._renderDisposables.add({ dispose: () => slot.remove() });
		this._slotElement = slot;

		const trigger = dom.append(slot, dom.$('a.action-label'));
		trigger.tabIndex = 0;
		trigger.role = 'button';
		this._triggerElement = trigger;

		this._renderDisposables.add(Gesture.addTarget(trigger));
		for (const eventType of [dom.EventType.CLICK, TouchEventType.Tap]) {
			this._renderDisposables.add(dom.addDisposableListener(trigger, eventType, (e) => {
				dom.EventHelper.stop(e, true);
				this._showPicker();
			}));
		}

		this._renderDisposables.add(dom.addDisposableListener(trigger, dom.EventType.KEY_DOWN, (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				dom.EventHelper.stop(e, true);
				this._showPicker();
			}
		}));

		this._update();
		return slot;
	}

	private _getProvider() {
		const session = this._session.get();
		return session ? this._sessionsProvidersService.getProvider(session.providerId) : undefined;
	}

	private _getModes(): readonly ISessionPermissionMode[] {
		const session = this._session.get();
		return session ? getProviderPermissionModes(this._getProvider(), session.sessionId) : [];
	}

	private _update(): void {
		if (!this._slotElement || !this._triggerElement) {
			return;
		}
		const session = this._session.get();
		const modes = this._getModes();
		// Hide the whole slot when the active session has no permission modes so
		// the chip leaves no empty gap in the picker row.
		if (!session || modes.length === 0) {
			this._slotElement.style.display = 'none';
			return;
		}
		this._slotElement.style.display = '';

		const currentId = getProviderCurrentPermissionMode(this._getProvider(), session.sessionId);
		this._currentModeId = currentId;
		const mode = modes.find(m => m.id === currentId) ?? modes[0];

		dom.clearNode(this._triggerElement);
		if (mode.icon) {
			dom.append(this._triggerElement, renderIcon(mode.icon));
		}
		const labelSpan = dom.append(this._triggerElement, dom.$('span.sessions-chat-dropdown-label'));
		labelSpan.textContent = mode.label;
		dom.append(this._triggerElement, renderIcon(Codicon.chevronDown));

		this._triggerElement.ariaLabel = localize('permissionModePicker.triggerAriaLabel', "Pick Permission Mode, {0}", mode.label);
	}

	private _showPicker(): void {
		if (!this._triggerElement || this._actionWidgetService.isVisible) {
			return;
		}

		const modes = this._getModes();
		if (modes.length === 0) {
			return;
		}

		const items: IActionListItem<ISessionPermissionMode>[] = modes.map(mode => ({
			kind: ActionListItemKind.Action,
			group: { title: '', icon: mode.icon },
			item: mode,
			label: mode.label,
			detail: mode.description,
			disabled: false,
		}));

		const triggerElement = this._triggerElement;
		const delegate: IActionListDelegate<ISessionPermissionMode> = {
			onSelect: (item) => {
				this._actionWidgetService.hide();
				this._selectMode(item);
			},
			onHide: () => { triggerElement.focus(); },
		};

		const listOptions: IActionListOptions = { minWidth: 255 };
		this._actionWidgetService.show<ISessionPermissionMode>(
			'sessionsPermissionModePicker',
			false,
			items,
			delegate,
			this._triggerElement,
			undefined,
			[],
			{
				getWidgetAriaLabel: () => localize('permissionModePicker.ariaLabel', "Permission Mode"),
			},
			listOptions,
		);
	}

	private _selectMode(mode: ISessionPermissionMode): void {
		const session = this._session.get();
		if (!session) {
			return;
		}
		const modes = this._getModes();
		const beforeId = this._currentModeId;
		const beforeLabel = modes.find(m => m.id === beforeId)?.label;
		reportNewChatPickerClosed(this._telemetryService, {
			id: 'NewChatPermissionModePicker',
			name: 'NewChatPermissionModePicker',
			optionIdBefore: beforeId,
			optionIdAfter: mode.id,
			optionLabelBefore: beforeLabel,
			optionLabelAfter: mode.label,
			isPII: false,
		});

		this._sessionsProvidersService.getProvider(session.providerId)?.setPermissionMode?.(session.sessionId, mode.id);
		this._currentModeId = mode.id;
		this._update();
	}
}

/**
 * Wraps a {@link PermissionModePicker} as a {@link BaseActionViewItem} so it
 * can be rendered by a {@link MenuWorkbenchToolBar}.
 */
export class PermissionModePickerActionViewItem extends BaseActionViewItem {
	constructor(private readonly picker: PermissionModePicker) {
		super(undefined, { id: '', label: '', enabled: true, class: undefined, tooltip: '', run: () => { } });
	}

	override render(container: HTMLElement): void {
		this.picker.render(container);
	}

	override dispose(): void {
		this.picker.dispose();
		super.dispose();
	}
}

// -- Action --

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'sessions.permissionModePicker',
			title: localize2('sessionsPermissionModePicker', "Permission Mode"),
			f1: false,
			menu: [{
				id: Menus.NewSessionControl,
				group: 'navigation',
				order: 1,
				when: ActiveSessionHasPermissionModesContext,
			}],
		});
	}
	override async run(): Promise<void> { /* handled by action view item */ }
});

// -- Action View Item Registration --

class PermissionModePickerContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.sessionsPermissionModePicker';

	constructor(
		@IActionViewItemService actionViewItemService: IActionViewItemService,
	) {
		super();
		this._register(actionViewItemService.register(
			Menus.NewSessionControl, 'sessions.permissionModePicker',
			(_action, _options, scopedInstantiationService) => {
				const { session } = scopedInstantiationService.invokeFunction(accessor => accessor.get(ISessionInputContext));
				const picker = scopedInstantiationService.createInstance(PermissionModePicker, session);
				return new PermissionModePickerActionViewItem(picker);
			},
		));
	}
}

registerWorkbenchContribution2(PermissionModePickerContribution.ID, PermissionModePickerContribution, WorkbenchPhase.AfterRestored);
