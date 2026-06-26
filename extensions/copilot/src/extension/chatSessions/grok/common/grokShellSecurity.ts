/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Grok shell-security mitigation (DN-4).
 *
 * Grok's shell tool runs inside the vendor `grok` process — outside the agent host's
 * `commandAutoApprover` / sandbox engine. The mitigation (DN-4) is therefore a **default-deny**
 * auto-approve posture: every shell command requires an explicit per-command confirmation
 * (`permission.requested`), and shell is auto-approved **only** when the user has explicitly opted
 * into the bypass permission mode. Terminal-first is explicitly NOT used (DN-1).
 *
 * Pure decision functions (no Node.js / `vscode` imports) so the security contract is verifiable
 * without spawning grok — see `test/grokShellSecurity.spec.ts`. The adapter consults
 * {@link decideGrokShellPermission} before letting any Grok shell command run.
 */

import type { AgentCliPermissionMode } from '../../common/agentCliProvider';

/**
 * Default-deny: Grok shell commands are NOT auto-approved by default. A bypass requires the explicit
 * opt-in permission mode. Exported so the contract is a checkable constant, not an inline literal.
 */
export const GROK_SHELL_AUTO_APPROVE_DEFAULT = false;

/** The single permission mode that opts a Grok session into auto-approving shell commands. */
const GROK_BYPASS_MODE: AgentCliPermissionMode = 'bypassPermissions';

/** The decision for a Grok shell command: surface a permission prompt, or auto-approve it. */
export type GrokShellPermissionDecision = 'requirePermission' | 'autoApprove';

/**
 * Whether the given permission mode opts the Grok session into bypassing per-command shell
 * confirmation. Only the explicit {@link GROK_BYPASS_MODE} does; every other mode (default,
 * acceptEdits, plan, …) keeps the DN-4 default-deny posture.
 */
export function isGrokBypassEnabled(mode: AgentCliPermissionMode): boolean {
	return mode === GROK_BYPASS_MODE;
}

/**
 * Decide whether a Grok shell `command` may run under the current permission `mode`. Default-deny:
 * the command requires explicit per-command permission unless the user has opted into the bypass
 * mode. The command text is accepted for adapter logging/telemetry; the decision is mode-driven so
 * no command can ever auto-approve itself.
 */
export function decideGrokShellPermission(command: string, mode: AgentCliPermissionMode): GrokShellPermissionDecision {
	return isGrokBypassEnabled(mode) ? 'autoApprove' : 'requirePermission';
}
