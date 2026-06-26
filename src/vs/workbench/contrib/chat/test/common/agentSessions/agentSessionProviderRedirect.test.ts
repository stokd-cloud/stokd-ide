/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Codicon } from '../../../../../../base/common/codicons.js';
import { DisposableStore } from '../../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { IconContribution, getIconRegistry } from '../../../../../../platform/theme/common/iconRegistry.js';
import { getAgentFamilyCodicon, geminiCodicon } from '../../../browser/agentSessions/agentSessionProviderCodicons.js';
import { agentSessionProviderRegistry, registerAgentSessionProvider } from '../../../browser/agentSessions/agentSessionProviderRegistry.js';
import {
	getAgentCanContinueIn,
	getAgentSessionProvider,
	getAgentSessionProviderDescription,
	getAgentSessionProviderIcon,
	getAgentSessionProviderName,
	isBuiltInAgentSessionProvider,
	isFirstPartyAgentSessionProvider,
} from '../../../browser/agentSessions/agentSessions.js';

// ---------------------------------------------------------------------------
// AC-P0.2 — A no-op test provider (`mockAgent`) registered ONLY through the
// fork-owned `agentSessionProviderRegistry` appears in the SESSIONS list and
// the session-type picker with a proper name, a fork-registered icon, and a
// family attribute — WITHOUT editing any upstream enum (`AgentSessionProviders`)
// or any of the `getAgentSessionProvider*` switch cases.
//
// This is the end-to-end proof for work item 1.4 (redirect the upstream
// switches/enum to the registry). It asserts the exact predicates each upstream
// surface uses to present a provider:
//
//   • SESSIONS list  — `agentSessionsModel.ts` retains a session whose provider
//     satisfies `isBuiltInAgentSessionProvider(providerType)` (or has a live
//     contribution). A registry-only built-in must pass this gate.
//   • Session-type picker — `sessionTargetPickerActionItem.ts` resolves each
//     item through `getAgentSessionProvider` → `getAgentSessionProviderName` /
//     `getAgentSessionProviderIcon`, and buckets it into a category via
//     `isFirstPartyAgentSessionProvider`.
//   • New-session gating — `chatSessions.contribution.ts#isAgentSessionProviderType`
//     additionally accepts any id present in `agentSessionProviderRegistry`.
//
// It also pins the *no-behavior-change* contract: a truly unknown id keeps the
// original fallback behavior (raw id name, generic `extensions` icon, not
// recognized, not built-in).
//
// Lives under test/common (not test/browser) because the modules under test have
// a node-safe dependency graph (base/common, platform/common, nls only), so the
// fast node test runner can exercise it — same placement as the sibling
// `agentSessionProviderRegistration.test.ts` and `agentSessionProviderCodicons.test.ts`.
// ---------------------------------------------------------------------------

suite('AgentSessionProvider registry redirect — new provider (AC-P0.2)', () => {

	const disposables = new DisposableStore();

	teardown(() => disposables.clear());

	ensureNoDisposablesAreLeakedInTestSuite();

	const MOCK_ID = 'mockAgent';
	const MOCK_NAME = 'Mock Agent (registry)';
	// Exercise a fork-registered, per-family icon (work items 1.2/1.3): the test
	// provider declares the `gemini` family and takes that family's fork-owned
	// codicon, proving a non-enum provider renders a real fork glyph rather than
	// falling through to the generic `extensions` fallback.
	const MOCK_FAMILY = 'gemini';

	/** Resolve a registered icon id to its concrete font character (following the defaults chain). */
	function resolvedFontCharacter(id: string): string | undefined {
		const registry = getIconRegistry();
		const contribution = registry.getIcon(id);
		return contribution ? IconContribution.getDefinition(contribution, registry)?.fontCharacter : undefined;
	}

	function registerMock() {
		const familyIcon = getAgentFamilyCodicon(MOCK_FAMILY);
		assert.ok(familyIcon, `expected a fork-registered codicon for family '${MOCK_FAMILY}'`);
		disposables.add(registerAgentSessionProvider(MOCK_ID, {
			displayName: MOCK_NAME,
			icon: familyIcon,
			isFirstParty: true,
			canContinueIn: true,
			isBuiltIn: true,
			family: MOCK_FAMILY,
		}));
		return familyIcon;
	}

	test('proper name: getAgentSessionProviderName returns the registry displayName, not the raw id', () => {
		registerMock();
		assert.strictEqual(getAgentSessionProviderName(MOCK_ID), MOCK_NAME);
	});

	test('fork-registered icon: getAgentSessionProviderIcon resolves the fork codicon and renders a real glyph', () => {
		const familyIcon = registerMock();

		const resolved = getAgentSessionProviderIcon(MOCK_ID);
		// Resolves to the fork-registered family codicon (Gemini), not the generic fallback.
		assert.strictEqual(resolved.id, geminiCodicon.id);
		assert.strictEqual(resolved.id, familyIcon.id);
		assert.notStrictEqual(resolved.id, Codicon.extensions.id);

		// The fork codicon emits a real, non-blank glyph through the icon registry's defaults chain.
		const glyph = resolvedFontCharacter(resolved.id);
		assert.ok(glyph && glyph.length > 0, `fork icon '${resolved.id}' must resolve to a non-empty glyph, got ${JSON.stringify(glyph)}`);
	});

	test('family filter: the family is carried through the registry and resolves a fork-registered family icon', () => {
		registerMock();

		// The family attribute survives registration so family-based grouping/branding can read it.
		assert.strictEqual(agentSessionProviderRegistry.get(MOCK_ID)?.family, MOCK_FAMILY);
		// The family maps to its fork-registered icon (the visible branding for the family).
		assert.strictEqual(getAgentFamilyCodicon(MOCK_FAMILY)?.id, geminiCodicon.id);
		// The picker category filter (first-party vs other) reflects the registry flag.
		assert.strictEqual(isFirstPartyAgentSessionProvider(MOCK_ID), true);
	});

	test('SESSIONS list gate: isBuiltInAgentSessionProvider returns the registry isBuiltIn flag', () => {
		registerMock();
		// This is the exact predicate agentSessionsModel.ts uses to retain a session in the list.
		assert.strictEqual(isBuiltInAgentSessionProvider(MOCK_ID), true);
	});

	test('picker recognition: getAgentSessionProvider returns the id and the registry reports the provider as known', () => {
		registerMock();
		assert.strictEqual(getAgentSessionProvider(MOCK_ID), MOCK_ID);
		// isAgentSessionProviderType() additionally accepts ids present in the registry.
		assert.strictEqual(agentSessionProviderRegistry.has(MOCK_ID), true);
	});

	test('continue-in: getAgentCanContinueIn returns the registry canContinueIn flag', () => {
		registerMock();
		assert.strictEqual(getAgentCanContinueIn(MOCK_ID), true);
	});

	test('description: getAgentSessionProviderDescription returns "" when none is registered (unchanged fallback)', () => {
		registerMock();
		assert.strictEqual(getAgentSessionProviderDescription(MOCK_ID), '');
	});

	test('no behavior change: an unregistered id keeps the original fallback behavior', () => {
		const UNKNOWN = 'totally-unknown-provider';
		assert.strictEqual(getAgentSessionProvider(UNKNOWN), undefined, 'unknown id is not recognized');
		assert.strictEqual(getAgentSessionProviderName(UNKNOWN), UNKNOWN, 'unknown id falls back to the raw id');
		assert.strictEqual(getAgentSessionProviderIcon(UNKNOWN).id, Codicon.extensions.id, 'unknown id falls back to the generic extensions icon');
		assert.strictEqual(isBuiltInAgentSessionProvider(UNKNOWN), false, 'unknown id is not built-in');
		assert.strictEqual(isFirstPartyAgentSessionProvider(UNKNOWN), false, 'unknown id is not first-party');
		assert.strictEqual(getAgentCanContinueIn(UNKNOWN), false, 'unknown id cannot continue-in');
		assert.strictEqual(getAgentSessionProviderDescription(UNKNOWN), '', 'unknown id has no description');
	});
});
