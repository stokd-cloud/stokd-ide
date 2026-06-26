/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize } from '../../../../../nls.js';
import { registerIcon } from '../../../../../platform/theme/common/iconRegistry.js';

/**
 * Per-family agent-provider codicons (fork-owned).
 *
 * The upstream codicon font ships brand glyphs for Claude (`Codicon.claude`),
 * OpenAI / Codex (`Codicon.openai`) and Copilot (`Codicon.copilot`), but **not**
 * for Gemini or Grok. Without a dedicated icon, a fork-added (non-enum) provider
 * falls through to the generic `Codicon.extensions` fallback in
 * {@link getAgentSessionProviderIcon}, and any brand-new id with no font glyph
 * would render as a blank box.
 *
 * Rather than editing the auto-generated `codiconsLibrary.ts` (off-limits) or
 * the base `codiconsDerived` block (widens the base rebase surface), we
 * fork-register dedicated, independently-themeable icon ids here and default
 * each to an existing, guaranteed-renderable glyph. This mirrors the upstream
 * pattern used by `aiCustomization/aiCustomizationIcons.ts` and keeps the change
 * inside the already fork-owned `agentSessions/` area (alongside
 * `agentSessionProviderRegistry.ts`).
 *
 * Because the codicon stylesheet is generated dynamically from the icon registry
 * (see `platform/theme/browser/iconsStyleSheet.ts`), each registered id emits a
 * real `.codicon-<id>:before { content: <glyph> }` rule resolved through the
 * defaults chain — so providers that use these icons always show a proper glyph,
 * never a blank box, regardless of import/load order.
 *
 * These are consumed as the `icon` of fork-registered agent session providers
 * (see {@link IAgentSessionProviderUIEntry} in `agentSessionProviderRegistry.ts`),
 * which `getAgentSessionProviderIcon` returns for non-enum providers.
 *
 * Glyph choices (key decision — reversible, one-line changes):
 *   - Gemini → `Codicon.sparkle` (Gemini's brand mark is a four-pointed sparkle).
 *   - Grok   → `Codicon.zap` (no codicon matches xAI's mark; a lightning bolt is
 *              distinct from sparkle and reads as an energetic AI assistant).
 */

/** Codicon for the Gemini (Google) agent family. Defaults to the `sparkle` glyph. */
export const geminiCodicon: ThemeIcon = registerIcon(
	'gemini',
	Codicon.sparkle,
	localize('agentProviderIcon.gemini', "Icon for the Gemini agent session provider.")
);

/** Codicon for the Grok (xAI) agent family. Defaults to the `zap` glyph. */
export const grokCodicon: ThemeIcon = registerIcon(
	'grok',
	Codicon.zap,
	localize('agentProviderIcon.grok', "Icon for the Grok agent session provider.")
);

/**
 * Lookup of fork-added agent vendor family → codicon, so provider registration
 * can resolve a per-family icon by family name without importing each constant.
 * Keys cover both the short family name and the vendor name used in
 * {@link IAgentSessionProviderUIEntry.family}.
 */
export const agentFamilyCodicons: ReadonlyMap<string, ThemeIcon> = new Map<string, ThemeIcon>([
	['gemini', geminiCodicon],
	['google', geminiCodicon],
	['grok', grokCodicon],
	['xai', grokCodicon],
]);

/**
 * Returns the fork-registered codicon for the given agent vendor family, or
 * `undefined` when no per-family icon is registered (caller decides the
 * fallback). The lookup is case-insensitive.
 */
export function getAgentFamilyCodicon(family: string | undefined): ThemeIcon | undefined {
	if (!family) {
		return undefined;
	}
	return agentFamilyCodicons.get(family.toLowerCase());
}
