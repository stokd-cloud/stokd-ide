/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { URI, UriComponents } from '../../../../base/common/uri.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../platform/workspace/common/workspace.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IWorkbenchConfigurationService } from '../../../services/configuration/common/configuration.js';

/**
 * Command id consumed by the worktrees panel (code-ext extension) to switch the
 * Explorer root to another folder without reloading the window.
 */
export const SwitchRootFolderCommandId = 'stokd.workspace.switchRootFolder';

/**
 * Switch the workbench root to {@link arg}.
 *
 * When the window is a single-folder workspace, the root is re-rooted **in place**
 * via {@link IWorkbenchConfigurationService.reRootSingleFolderWorkspace} so the
 * extension host and any running processes (terminals, agents) survive. For
 * multi-root / empty windows there is no in-place equivalent, so we fall back to
 * opening the folder in the same window (which reloads, as `vscode.openFolder` does).
 *
 * @param arg the target folder, as an fsPath string or {@link UriComponents}.
 */
CommandsRegistry.registerCommand(SwitchRootFolderCommandId, async (accessor: ServicesAccessor, arg: string | UriComponents): Promise<void> => {
	const contextService = accessor.get(IWorkspaceContextService);
	const configurationService = accessor.get(IWorkbenchConfigurationService);
	const fileService = accessor.get(IFileService);
	const hostService = accessor.get(IHostService);
	const notificationService = accessor.get(INotificationService);
	const logService = accessor.get(ILogService);

	if (!arg) {
		throw new Error('stokd.workspace.switchRootFolder requires a folder argument');
	}
	const folder = typeof arg === 'string' ? URI.file(arg) : URI.revive(arg);

	try {
		const stat = await fileService.stat(folder);
		if (!stat.isDirectory) {
			notificationService.error(localize('switchRootFolder.notADirectory', "Cannot switch to '{0}' because it is not a folder.", folder.fsPath));
			return;
		}
	} catch (error) {
		logService.error('[switchRootFolder] failed to resolve target folder', error);
		notificationService.error(localize('switchRootFolder.notFound', "Cannot switch to '{0}' because it could not be found.", folder.fsPath));
		return;
	}

	// Single-folder window: re-root in place, keeping the session (and any running
	// agents/terminals) alive. Other window states have no in-place equivalent.
	if (contextService.getWorkbenchState() === WorkbenchState.FOLDER) {
		await configurationService.reRootSingleFolderWorkspace(folder);
		return;
	}

	await hostService.openWindow([{ folderUri: folder }], { forceReuseWindow: true });
});
