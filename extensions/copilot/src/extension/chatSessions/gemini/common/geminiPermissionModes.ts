/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Gemini permission ("approval") modes for the multi-provider chat panel.
 *
 * AC-P1.3 requires the permission picker to show **Gemini-declared** modes.
 * In ACP, the approval modes are not static: the agent advertises them in the
 * `session/new` result's `modes.availableModes` (see {@link GeminiAcpSessionMode}).
 * {@link mapAcpModesToGeminiPermissionModes} converts those agent-declared
 * modes into the picker shape, so the modes the user sees are exactly the ones
 * the running gemini-cli agent reports — falling back to
 * {@link DEFAULT_GEMINI_PERMISSION_MODES} only when the agent declares none.
 *
 * {@link GEMINI_DECLARED_PERMISSION_MODES} is the static, fork-mappable
 * superset the provider descriptor advertises up front (it is refined at
 * runtime from the agent's declared modes via
 * {@link narrowGeminiAcpModeToPermissionMode}).
 */

import type { AgentCliPermissionMode } from '../../common/agentCliProvider';
import type { GeminiAcpSessionMode } from './geminiAcpTypes';

/**
 * A permission mode in the shape the generic sessions-core permission-mode
 * picker consumes: a stable `id`, a human `label`, and an optional one-line
 * `description`. Kept structural (no `vscode`/`sessions` imports) so it is
 * unit-testable and layer-agnostic; the workbench picker reads exactly these
 * fields.
 */
export interface IGeminiPermissionMode {
	/** Stable identifier sent back to the ACP agent (`session/set_mode.modeId`). */
	readonly id: string;
	/** Human-readable label shown in the picker. */
	readonly label: string;
	/** Optional one-line description shown as the list item detail. */
	readonly description?: string;
}

/**
 * Picker modes used when the ACP agent declares no `availableModes`. Mirrors
 * gemini-cli's three baseline approval modes.
 */
export const DEFAULT_GEMINI_PERMISSION_MODES: readonly IGeminiPermissionMode[] = [
	{ id: 'default', label: 'Always ask', description: 'Prompt before file edits and shell commands' },
	{ id: 'auto_edit', label: 'Auto-accept edits', description: 'Apply file edits without asking; still confirm shell commands' },
	{ id: 'yolo', label: 'Accept all', description: 'Run edits and shell commands without asking' },
];

/**
 * The fork {@link AgentCliPermissionMode} superset the Gemini provider
 * descriptor advertises. The live picker is populated from the agent's
 * declared modes; this is the static declaration used by the descriptor and
 * the renderer to know which mode chips Gemini can ever present.
 */
export const GEMINI_DECLARED_PERMISSION_MODES: readonly AgentCliPermissionMode[] = [
	'default',
	'acceptEdits',
	'bypassPermissions',
];

/**
 * Map the agent-declared ACP modes (`session/new` → `modes.availableModes`)
 * into picker modes. Returns {@link DEFAULT_GEMINI_PERMISSION_MODES} when the
 * agent declares none (`undefined` or empty).
 */
export function mapAcpModesToGeminiPermissionModes(
	acpModes: readonly GeminiAcpSessionMode[] | undefined,
): readonly IGeminiPermissionMode[] {
	if (!acpModes || acpModes.length === 0) {
		return DEFAULT_GEMINI_PERMISSION_MODES;
	}
	return acpModes.map(mode => {
		const description = typeof mode.description === 'string' && mode.description.length > 0
			? mode.description
			: undefined;
		return description === undefined
			? { id: mode.id, label: mode.name }
			: { id: mode.id, label: mode.name, description };
	});
}

/**
 * Narrow a known gemini-cli ACP mode id to the fork
 * {@link AgentCliPermissionMode} union, or `undefined` for an unrecognized id.
 *
 * Tolerant of the naming variants gemini-cli has shipped (`auto_edit` /
 * `acceptEdits`, `yolo` / `bypassPermissions`) so a pin bump that renames a
 * mode still narrows correctly.
 */
export function narrowGeminiAcpModeToPermissionMode(acpModeId: string): AgentCliPermissionMode | undefined {
	switch (acpModeId) {
		case 'default':
			return 'default';
		case 'auto_edit':
		case 'autoEdit':
		case 'acceptEdits':
			return 'acceptEdits';
		case 'yolo':
		case 'bypassPermissions':
			return 'bypassPermissions';
		default:
			return undefined;
	}
}
