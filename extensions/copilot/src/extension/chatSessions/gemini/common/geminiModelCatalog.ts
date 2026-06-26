/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Gemini chat-panel model-catalog scoping (DN-3).
 *
 * AC-P1.3 requires the Gemini session's model picker to show **only** Gemini
 * models. Following DN-3, Gemini reuses the existing BYOK Gemini
 * `LanguageModelChatProvider` and scopes it via the `targetChatSessionType`
 * model-metadata mechanism rather than introducing a new model-routing path.
 *
 * The workbench's `filterModelsForSession()` is the single source of truth for
 * picker scoping: for a session whose `sessionType` equals
 * {@link GEMINI_SESSION_TYPE}, it returns **only** models whose
 * `metadata.targetChatSessionType === 'gemini'`. This module supplies the two
 * pure pieces the vscode-node registration needs — the session-type constant
 * and the tagger that stamps that type onto Gemini model metadata — plus the
 * matching selector so the scoping is unit-testable without the workbench.
 */

/**
 * The chat session type id for the Gemini ACP provider. Used both as the
 * provider id passed to `lm.registerLanguageModelChatProvider(...)` and as the
 * `targetChatSessionType` stamped onto each Gemini model so
 * `filterModelsForSession` scopes the picker to Gemini-only.
 *
 * Mirrors the per-provider convention (`'claude-code'`, `'openai-codex'`).
 */
export const GEMINI_SESSION_TYPE = 'gemini' as const;

/** A model entry carrying the optional session-type scoping tag. */
export interface IGeminiTaggableModel {
	readonly targetChatSessionType?: string;
}

/**
 * Stamp {@link GEMINI_SESSION_TYPE} onto a single model's metadata so the
 * picker scopes it to the Gemini session. Returns a new object; the input is
 * not mutated.
 */
export function withGeminiSessionType<T extends object>(model: T): T & { readonly targetChatSessionType: typeof GEMINI_SESSION_TYPE } {
	return { ...model, targetChatSessionType: GEMINI_SESSION_TYPE };
}

/** {@link withGeminiSessionType} applied across a model list. */
export function tagModelsForGeminiSession<T extends object>(
	models: readonly T[],
): ReadonlyArray<T & { readonly targetChatSessionType: typeof GEMINI_SESSION_TYPE }> {
	return models.map(withGeminiSessionType);
}

/**
 * Select **only** the Gemini-scoped models out of a mixed pool — the pure
 * mirror of the workbench `filterModelsForSession` rule for the Gemini session
 * type. Models targeting other session types (e.g. `'openai-codex'`,
 * `'claude-code'`) and untargeted general-pool models are excluded.
 */
export function selectGeminiSessionModels<T extends IGeminiTaggableModel>(models: readonly T[]): T[] {
	return models.filter(model => model.targetChatSessionType === GEMINI_SESSION_TYPE);
}
