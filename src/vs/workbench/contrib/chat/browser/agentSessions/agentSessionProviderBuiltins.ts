/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../../base/common/codicons.js';
import { localize } from '../../../../../nls.js';
import { SessionType } from '../../common/chatSessionsService.js';
import { agentSessionProviderRegistry } from './agentSessionProviderRegistry.js';

/**
 * Fork-owned re-registration of the Claude, Copilot CLI (Background) and Codex
 * built-in agent session providers through {@link agentSessionProviderRegistry}.
 *
 * Historically these providers were resolved by hard-coded switch cases in
 * `agentSessions.ts`. To shrink the per-provider upstream switch surface (and to
 * prove the registry path works for first-class built-ins), their UI descriptors
 * now live here, in fork-owned code, and resolve through the redirected default
 * branches of the `getAgentSessionProvider*` functions. Claude and Copilot CLI
 * were moved here by work item 1.8; Codex by work item 2.2.
 *
 * **No behavior change.** Each descriptor below is byte-identical to the value
 * the original hard-coded case produced — same display name (Claude's and
 * Codex's are the literals `'Claude'` / `'Codex'`, not localized, exactly as
 * before), same icon, same first-party / continue-in / built-in flags, and the
 * same localized description under the same nls key. This is asserted by the
 * golden snapshot in
 * `test/common/agentSessions/agentSessionProviderRegistration.test.ts`.
 *
 * The provider ids are taken from {@link SessionType} (`AgentSessionProviders`
 * is a string enum aliasing the same values) so this module does **not** import
 * `agentSessions.ts`, avoiding a circular dependency: `agentSessions.ts` imports
 * and invokes {@link registerBuiltInAgentSessionProviders} at module load.
 */

let registered = false;

/**
 * Register the Claude, Copilot CLI and Codex built-in provider descriptors.
 * Idempotent: safe to call more than once (only the first call mutates the
 * registry), so a double module evaluation or an explicit test call cannot
 * throw on duplicate registration.
 */
export function registerBuiltInAgentSessionProviders(): void {
	if (registered) {
		return;
	}
	registered = true;

	// Copilot CLI — was `AgentSessionProviders.Background` (SessionType.CopilotCLI).
	agentSessionProviderRegistry.register(SessionType.CopilotCLI, {
		displayName: localize('chat.session.providerLabel.background', "Copilot CLI"),
		icon: Codicon.copilot,
		isFirstParty: true,
		canContinueIn: true,
		isBuiltIn: true,
		family: 'github',
		description: localize('chat.session.providerDescription.background', "Delegate tasks to a background agent running locally on your machine. The agent iterates via chat and works asynchronously in a Git worktree to implement changes isolated from your main workspace using the GitHub Copilot CLI."),
	});

	// Claude — was `AgentSessionProviders.Claude` (SessionType.ClaudeCode).
	// Note: the display name is the literal 'Claude' (never localized), matching
	// the original hard-coded case exactly.
	agentSessionProviderRegistry.register(SessionType.ClaudeCode, {
		displayName: 'Claude',
		icon: Codicon.claude,
		isFirstParty: false,
		canContinueIn: false,
		isBuiltIn: true,
		family: 'anthropic',
		description: localize('chat.session.providerDescription.claude', "Delegate tasks to the Claude Agent SDK using the Claude models included in your GitHub Copilot subscription. The agent iterates via chat and works interactively to implement changes on your main workspace."),
	});

	// Codex — was `AgentSessionProviders.Codex` (SessionType.Codex). The display
	// name is the literal 'Codex' (never localized), matching the original
	// hard-coded case exactly. Codex was NOT part of the original
	// `isBuiltInAgentSessionProvider` allow-list (Local, Background, Cloud,
	// Claude), so `isBuiltIn` is `false` here to preserve byte-identical
	// behavior — the agent host's Codex provider (codexAgent.ts) backs the
	// list/click/resume/steer/abort operations via its own AHP wiring
	// (createSession→thread/start, steer→turn/steer, abort→turn/interrupt,
	// resume→thread/resume).
	agentSessionProviderRegistry.register(SessionType.Codex, {
		displayName: 'Codex',
		icon: Codicon.openai,
		isFirstParty: false,
		canContinueIn: false,
		isBuiltIn: false,
		family: 'openai',
		description: localize('chat.session.providerDescription.codex', "Opens a new Codex session in the editor. Codex sessions can be managed from the chat sessions view."),
	});
}
