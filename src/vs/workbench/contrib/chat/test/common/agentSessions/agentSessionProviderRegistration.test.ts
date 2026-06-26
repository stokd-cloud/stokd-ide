/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Codicon } from '../../../../../../base/common/codicons.js';
import { localize } from '../../../../../../nls.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { SessionType } from '../../../common/chatSessionsService.js';
import { agentSessionProviderRegistry } from '../../../browser/agentSessions/agentSessionProviderRegistry.js';
import {
	AgentSessionProviders,
	getAgentCanContinueIn,
	getAgentSessionProvider,
	getAgentSessionProviderDescription,
	getAgentSessionProviderFamily,
	getAgentSessionProviderIcon,
	getAgentSessionProviderName,
	isBuiltInAgentSessionProvider,
	isFirstPartyAgentSessionProvider,
} from '../../../browser/agentSessions/agentSessions.js';

// ---------------------------------------------------------------------------
// AC-P0.1 / AC-P2.1 — Re-register the built-in providers through the registry
// with NO behavior change.
//
// Built-in providers Claude (`claude-code`), Copilot CLI / Background
// (`copilotcli`) and Codex (`openai-codex`) used to be resolved by hard-coded
// switch cases inside agentSessions.ts. Work items 1.8 (Claude + Copilot CLI)
// and 2.2 (Codex) move their UI descriptors into the fork-owned
// `agentSessionProviderRegistry`, so that the (now slimmer) default branches of
// the upstream switch functions resolve them from the registry.
//
// These tests are the byte-identical golden snapshot demanded by AC-P0.1 /
// AC-P2.1:
//   1. Claude, Copilot CLI and Codex MUST be present in the registry (the
//      observable proof that they are "re-registered through the registry").
//   2. Every public provider-resolution function MUST return values byte-
//      identical to the original hard-coded switch cases, for the whole
//      built-in session list (Local, Background, Cloud, Claude, Codex, Growth,
//      AgentHostCopilot).
//
// Lives under test/common (not test/browser) because agentSessions.js has a
// node-safe dependency graph (base/common, platform/common, nls only), so the
// fast node test runner can exercise it (same placement as the sibling
// agentSessionProviderCodicons.test.ts).
// ---------------------------------------------------------------------------

/**
 * The golden, byte-for-byte expected UI descriptor for every built-in session
 * provider, captured verbatim from the original hard-coded switch cases. These
 * literals ARE the snapshot — any drift fails the suite.
 */
interface IGoldenProviderRow {
	readonly provider: AgentSessionProviders;
	readonly name: string;
	readonly iconId: string;
	readonly isFirstParty: boolean;
	readonly canContinueIn: boolean;
	readonly isBuiltIn: boolean;
	readonly description: string;
	/**
	 * Expected vendor family surfaced by getAgentSessionProviderFamily(). The
	 * registry-backed providers (Background → 'github', Claude → 'anthropic',
	 * Codex → 'openai') carry a family; the hard-coded built-ins that never
	 * declared one resolve to `undefined`.
	 */
	readonly family: string | undefined;
	/** Expected result of getAgentSessionProvider() recognition (undefined === not recognized). */
	readonly recognized: AgentSessionProviders | undefined;
}

const GOLDEN: readonly IGoldenProviderRow[] = [
	{
		provider: AgentSessionProviders.Local,
		name: localize('chat.session.providerLabel.local', "Local"),
		iconId: Codicon.vm.id,
		isFirstParty: true,
		canContinueIn: true,
		isBuiltIn: true,
		description: localize('chat.session.providerDescription.local', "Run tasks within VS Code chat. The agent iterates via chat and works interactively to implement changes on your main workspace."),
		family: undefined,
		recognized: AgentSessionProviders.Local,
	},
	{
		// "Copilot CLI" — moved to the registry by this work item.
		provider: AgentSessionProviders.Background,
		name: localize('chat.session.providerLabel.background', "Copilot CLI"),
		iconId: Codicon.copilot.id,
		isFirstParty: true,
		canContinueIn: true,
		isBuiltIn: true,
		description: localize('chat.session.providerDescription.background', "Delegate tasks to a background agent running locally on your machine. The agent iterates via chat and works asynchronously in a Git worktree to implement changes isolated from your main workspace using the GitHub Copilot CLI."),
		family: 'github',
		recognized: AgentSessionProviders.Background,
	},
	{
		provider: AgentSessionProviders.Cloud,
		name: localize('chat.session.providerLabel.cloud', "Cloud"),
		iconId: Codicon.cloud.id,
		isFirstParty: true,
		canContinueIn: true,
		isBuiltIn: true,
		description: localize('chat.session.providerDescription.cloud', "Delegate tasks to the GitHub Copilot coding agent. The agent iterates via chat and works asynchronously in the cloud to implement changes and pull requests as needed."),
		family: undefined,
		recognized: AgentSessionProviders.Cloud,
	},
	{
		// "Claude" — moved to the registry by this work item.
		provider: AgentSessionProviders.Claude,
		name: 'Claude',
		iconId: Codicon.claude.id,
		isFirstParty: false,
		canContinueIn: false,
		isBuiltIn: true,
		description: localize('chat.session.providerDescription.claude', "Delegate tasks to the Claude Agent SDK using the Claude models included in your GitHub Copilot subscription. The agent iterates via chat and works interactively to implement changes on your main workspace."),
		family: 'anthropic',
		recognized: AgentSessionProviders.Claude,
	},
	{
		provider: AgentSessionProviders.Codex,
		name: 'Codex',
		iconId: Codicon.openai.id,
		isFirstParty: false,
		canContinueIn: false,
		isBuiltIn: false,
		description: localize('chat.session.providerDescription.codex', "Opens a new Codex session in the editor. Codex sessions can be managed from the chat sessions view."),
		family: 'openai',
		recognized: AgentSessionProviders.Codex,
	},
	{
		provider: AgentSessionProviders.Growth,
		name: 'Growth',
		iconId: Codicon.lightbulb.id,
		isFirstParty: false,
		canContinueIn: false,
		isBuiltIn: false,
		description: localize('chat.session.providerDescription.growth', "Learn about Copilot features."),
		family: undefined,
		// Growth is intentionally NOT recognized by getAgentSessionProvider().
		recognized: undefined,
	},
	{
		provider: AgentSessionProviders.AgentHostCopilot,
		name: localize('chat.session.providerLabel.agentHostCopilot', "Copilot CLI [Agent Host]"),
		iconId: Codicon.copilot.id,
		isFirstParty: true,
		canContinueIn: false,
		isBuiltIn: false,
		description: 'Run a Copilot SDK agent in a dedicated process.',
		family: undefined,
		recognized: AgentSessionProviders.AgentHostCopilot,
	},
];

suite('AgentSessionProvider built-in re-registration (AC-P0.1)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Claude is re-registered in the provider registry with a byte-identical descriptor', () => {
		const entry = agentSessionProviderRegistry.get(SessionType.ClaudeCode);
		assert.ok(entry, 'Claude (claude-code) must be present in the agent session provider registry');
		assert.strictEqual(entry.displayName, 'Claude');
		assert.strictEqual(entry.icon.id, Codicon.claude.id);
		assert.strictEqual(entry.isFirstParty, false);
		assert.strictEqual(entry.canContinueIn, false);
		assert.strictEqual(entry.isBuiltIn, true);
		assert.strictEqual(
			entry.description,
			localize('chat.session.providerDescription.claude', "Delegate tasks to the Claude Agent SDK using the Claude models included in your GitHub Copilot subscription. The agent iterates via chat and works interactively to implement changes on your main workspace."));
	});

	test('Copilot CLI (Background) is re-registered in the provider registry with a byte-identical descriptor', () => {
		const entry = agentSessionProviderRegistry.get(SessionType.CopilotCLI);
		assert.ok(entry, 'Copilot CLI (copilotcli) must be present in the agent session provider registry');
		assert.strictEqual(entry.displayName, localize('chat.session.providerLabel.background', "Copilot CLI"));
		assert.strictEqual(entry.icon.id, Codicon.copilot.id);
		assert.strictEqual(entry.isFirstParty, true);
		assert.strictEqual(entry.canContinueIn, true);
		assert.strictEqual(entry.isBuiltIn, true);
		assert.strictEqual(
			entry.description,
			localize('chat.session.providerDescription.background', "Delegate tasks to a background agent running locally on your machine. The agent iterates via chat and works asynchronously in a Git worktree to implement changes isolated from your main workspace using the GitHub Copilot CLI."));
	});

	test('Codex is re-registered in the provider registry with a byte-identical descriptor (AC-P2.1)', () => {
		const entry = agentSessionProviderRegistry.get(SessionType.Codex);
		assert.ok(entry, 'Codex (openai-codex) must be present in the agent session provider registry');
		assert.strictEqual(entry.displayName, 'Codex');
		assert.strictEqual(entry.icon.id, Codicon.openai.id);
		assert.strictEqual(entry.isFirstParty, false);
		assert.strictEqual(entry.canContinueIn, false);
		// Codex was NOT part of the original isBuiltInAgentSessionProvider list
		// (Local, Background, Cloud, Claude), so its descriptor carries
		// isBuiltIn: false to preserve byte-identical behavior.
		assert.strictEqual(entry.isBuiltIn, false);
		assert.strictEqual(entry.family, 'openai');
		assert.strictEqual(
			entry.description,
			localize('chat.session.providerDescription.codex', "Opens a new Codex session in the editor. Codex sessions can be managed from the chat sessions view."));
	});

	// -----------------------------------------------------------------------
	// AC-P2.3 — Codex appears consistently across name / icon / family /
	// first-party / continue-in (the half-wiring is reconciled).
	//
	// Codex was historically half-wired: it had inline cases in the name / icon /
	// first-party / continue-in switches but was missing from
	// isBuiltInAgentSessionProvider AND had no surfaced vendor family. Work item
	// 2.2 redirected the four switches through the registry; work item 2.4
	// reconciles the FIFTH facet — family — by giving it a unified accessor
	// (getAgentSessionProviderFamily) parallel to the other getters, so all five
	// facets now resolve Codex from one place with no inconsistency.
	// -----------------------------------------------------------------------
	test('Codex appears consistently across name/icon/family/first-party/continue-in (AC-P2.3)', () => {
		// All five facets resolve Codex from the same registry-backed path — the
		// enum value and the URI-derived string id agree.
		for (const codex of [AgentSessionProviders.Codex, SessionType.Codex] as const) {
			assert.strictEqual(getAgentSessionProviderName(codex), 'Codex', 'name');
			assert.strictEqual(getAgentSessionProviderIcon(codex).id, Codicon.openai.id, 'icon');
			assert.strictEqual(getAgentSessionProviderFamily(codex), 'openai', 'family');
			assert.strictEqual(isFirstPartyAgentSessionProvider(codex), false, 'first-party');
			assert.strictEqual(getAgentCanContinueIn(codex), false, 'continue-in');
		}

		// The family facet is no longer a dangling registry-only field: the public
		// accessor surfaces it, matching the descriptor exactly.
		assert.strictEqual(
			getAgentSessionProviderFamily(AgentSessionProviders.Codex),
			agentSessionProviderRegistry.get(SessionType.Codex)?.family,
			'family accessor must match the Codex registry descriptor');
	});

	test('golden snapshot: provider-resolution functions are byte-identical for the full built-in session list', () => {
		for (const row of GOLDEN) {
			assert.strictEqual(getAgentSessionProviderName(row.provider), row.name, `name mismatch for ${row.provider}`);
			assert.strictEqual(getAgentSessionProviderIcon(row.provider).id, row.iconId, `icon mismatch for ${row.provider}`);
			assert.strictEqual(isFirstPartyAgentSessionProvider(row.provider), row.isFirstParty, `isFirstParty mismatch for ${row.provider}`);
			assert.strictEqual(getAgentCanContinueIn(row.provider), row.canContinueIn, `canContinueIn mismatch for ${row.provider}`);
			assert.strictEqual(isBuiltInAgentSessionProvider(row.provider), row.isBuiltIn, `isBuiltIn mismatch for ${row.provider}`);
			assert.strictEqual(getAgentSessionProviderDescription(row.provider), row.description, `description mismatch for ${row.provider}`);
			assert.strictEqual(getAgentSessionProviderFamily(row.provider), row.family, `family mismatch for ${row.provider}`);
			assert.strictEqual(getAgentSessionProvider(row.provider), row.recognized, `recognition mismatch for ${row.provider}`);
		}
	});

	test('replayed session: Claude, Copilot CLI and Codex resolve identically from a URI-derived string id (registry path)', () => {
		// The session list and a replayed session both resolve providers from the
		// session-type string. Exercise that exact string-id path for the three
		// providers re-registered through the registry (Claude + Copilot CLI by
		// work item 1.8, Codex by work item 2.2).
		assert.strictEqual(getAgentSessionProvider(SessionType.ClaudeCode), AgentSessionProviders.Claude);
		assert.strictEqual(getAgentSessionProvider(SessionType.CopilotCLI), AgentSessionProviders.Background);
		assert.strictEqual(getAgentSessionProvider(SessionType.Codex), AgentSessionProviders.Codex);

		assert.strictEqual(getAgentSessionProviderName(SessionType.ClaudeCode), 'Claude');
		assert.strictEqual(getAgentSessionProviderName(SessionType.CopilotCLI), localize('chat.session.providerLabel.background', "Copilot CLI"));
		assert.strictEqual(getAgentSessionProviderName(SessionType.Codex), 'Codex');

		assert.strictEqual(getAgentSessionProviderIcon(SessionType.ClaudeCode).id, Codicon.claude.id);
		assert.strictEqual(getAgentSessionProviderIcon(SessionType.CopilotCLI).id, Codicon.copilot.id);
		assert.strictEqual(getAgentSessionProviderIcon(SessionType.Codex).id, Codicon.openai.id);
	});
});
