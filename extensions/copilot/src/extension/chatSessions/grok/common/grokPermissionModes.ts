/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Grok permission ("approval") modes for the multi-provider chat panel.
 *
 * Unlike the Gemini ACP agent (which advertises its approval modes at runtime),
 * Grok is a spawn-per-turn CLI, so its modes are static and fork-declared.
 *
 * DN-4 fixes Grok's **default** posture to *default-deny*: every shell command
 * and file edit is confirmed per-command before it runs. Auto-accepting edits
 * and bypassing all prompts are explicit opt-ins, never the default — the
 * `default` mode is intentionally first so a freshly-created Grok session asks
 * before acting. The per-command confirmation enforcement itself lives with the
 * spawn adapter (work item 4.3); this module is the declarative surface the
 * picker and the provider descriptor read.
 */

import type { AgentCliPermissionMode } from '../../common/agentCliProvider';

/**
 * A permission mode in the shape the generic sessions-core permission-mode
 * picker consumes: a stable `id`, a human `label`, and an optional one-line
 * `description`. Kept structural (no `vscode`/`sessions` imports) so it is
 * unit-testable and layer-agnostic.
 */
export interface IGrokPermissionMode {
	/** Stable identifier — a member of the fork {@link AgentCliPermissionMode} union. */
	readonly id: AgentCliPermissionMode;
	/** Human-readable label shown in the picker. */
	readonly label: string;
	/** Optional one-line description shown as the list item detail. */
	readonly description?: string;
}

/**
 * Grok's static picker modes. `default` (confirm everything) is first and is
 * the DN-4 default-deny posture; the remaining two are explicit opt-ins.
 */
export const GROK_PERMISSION_MODES: readonly IGrokPermissionMode[] = [
	{ id: 'default', label: 'Always ask', description: 'Confirm every shell command and file edit before it runs (DN-4 default-deny)' },
	{ id: 'acceptEdits', label: 'Auto-accept edits', description: 'Apply file edits without asking; still confirm every shell command' },
	{ id: 'bypassPermissions', label: 'Accept all', description: 'Run edits and shell commands without asking (opt-in; overrides DN-4 default-deny)' },
];

/**
 * The fork {@link AgentCliPermissionMode} superset the Grok provider descriptor
 * advertises, derived from {@link GROK_PERMISSION_MODES} so the picker and the
 * descriptor can never drift apart.
 */
export const GROK_DECLARED_PERMISSION_MODES: readonly AgentCliPermissionMode[] =
	GROK_PERMISSION_MODES.map(mode => mode.id);
