/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Codicon } from '../../../../../../base/common/codicons.js';
import { DisposableStore } from '../../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { IconContribution, getIconRegistry } from '../../../../../../platform/theme/common/iconRegistry.js';
import { geminiCodicon, grokCodicon } from '../../../browser/agentSessions/agentSessionProviderCodicons.js';
import { getAgentSessionProviderIcon } from '../../../browser/agentSessions/agentSessions.js';
import { registerAgentSessionProvider } from '../../../browser/agentSessions/agentSessionProviderRegistry.js';

// ---------------------------------------------------------------------------
// R7.1.3 — Per-family iconography resolves for Gemini/Grok via fork-registered
// codicons; non-enum providers show a proper icon, not a blank.
//
// The upstream codicon font only ships brand glyphs for Claude / OpenAI /
// Copilot. These fork-registered codicons default to an existing, guaranteed-
// renderable glyph so that the dynamically generated codicon stylesheet emits a
// real `.codicon-<id>:before { content: <glyph> }` rule for each family.
//
// Lives under test/common (not test/browser) because the module-under-test and
// `getAgentSessionProviderIcon` have a node-safe dependency graph (base/common,
// platform/common, nls only), so the fast node test runner can exercise it.
// ---------------------------------------------------------------------------
suite('AgentSessionProviderCodicons (R7.1.3)', () => {
	const disposables = new DisposableStore();

	teardown(() => disposables.clear());

	ensureNoDisposablesAreLeakedInTestSuite();

	/** Resolve a registered icon id to its concrete font character (following the defaults chain). */
	function resolvedFontCharacter(id: string): string | undefined {
		const registry = getIconRegistry();
		const contribution = registry.getIcon(id);
		if (!contribution) {
			return undefined;
		}
		return IconContribution.getDefinition(contribution, registry)?.fontCharacter;
	}

	test('registers stable per-family codicon ids for Gemini and Grok', () => {
		assert.strictEqual(geminiCodicon.id, 'gemini');
		assert.strictEqual(grokCodicon.id, 'grok');
	});

	test('Gemini/Grok codicons resolve to a real glyph (not a blank)', () => {
		const geminiChar = resolvedFontCharacter('gemini');
		const grokChar = resolvedFontCharacter('grok');

		assert.ok(geminiChar && geminiChar.length > 0,
			`gemini must resolve to a non-empty font character, got ${JSON.stringify(geminiChar)}`);
		assert.ok(grokChar && grokChar.length > 0,
			`grok must resolve to a non-empty font character, got ${JSON.stringify(grokChar)}`);

		// They inherit an existing, guaranteed-renderable glyph, so they can never render blank.
		assert.strictEqual(geminiChar, resolvedFontCharacter(Codicon.sparkle.id));
		assert.strictEqual(grokChar, resolvedFontCharacter(Codicon.zap.id));
	});

	test('getAgentSessionProviderIcon returns the per-family codicon for non-enum Gemini/Grok providers (not the blank extensions fallback)', () => {
		disposables.add(registerAgentSessionProvider('gemini', {
			displayName: 'Gemini',
			icon: geminiCodicon,
			isFirstParty: false,
			canContinueIn: false,
			isBuiltIn: true,
			family: 'google',
		}));
		disposables.add(registerAgentSessionProvider('grok', {
			displayName: 'Grok',
			icon: grokCodicon,
			isFirstParty: false,
			canContinueIn: false,
			isBuiltIn: true,
			family: 'xai',
		}));

		const resolvedGemini = getAgentSessionProviderIcon('gemini');
		const resolvedGrok = getAgentSessionProviderIcon('grok');

		assert.strictEqual(resolvedGemini.id, geminiCodicon.id);
		assert.strictEqual(resolvedGrok.id, grokCodicon.id);

		// Must not fall through to the generic blank fallback (Codicon.extensions).
		assert.notStrictEqual(resolvedGemini.id, Codicon.extensions.id);
		assert.notStrictEqual(resolvedGrok.id, Codicon.extensions.id);
	});
});
