/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Grok chat-panel model-catalog scoping.
 *
 * The Grok session's model picker must show **only** Grok models. Following the
 * same `targetChatSessionType` model-metadata mechanism Claude / Copilot CLI /
 * Gemini already use (DN-3), Grok scopes a shared model pool to its own session
 * type rather than introducing a new model-routing path.
 *
 * The workbench's `filterModelsForSession()` is the single source of truth for
 * picker scoping: for a session whose `sessionType` equals
 * {@link GROK_SESSION_TYPE}, it returns **only** models whose
 * `metadata.targetChatSessionType === 'grok'`. This module supplies the two pure
 * pieces the vscode-node registration needs — the session-type constant and the
 * tagger that stamps that type onto Grok model metadata — plus the matching
 * selector so the scoping is unit-testable without the workbench.
 */

/**
 * The chat session type id for the Grok provider. Used both as the provider id
 * passed to `lm.registerLanguageModelChatProvider(...)` and as the
 * `targetChatSessionType` stamped onto each Grok model so
 * `filterModelsForSession` scopes the picker to Grok-only.
 *
 * Mirrors the per-provider convention (`'claude-code'`, `'openai-codex'`,
 * `'gemini'`).
 */
export const GROK_SESSION_TYPE = 'grok' as const;

/** A model entry carrying the optional session-type scoping tag. */
export interface IGrokTaggableModel {
	readonly targetChatSessionType?: string;
}

/**
 * Stamp {@link GROK_SESSION_TYPE} onto a single model's metadata so the picker
 * scopes it to the Grok session. Returns a new object; the input is not mutated.
 */
export function withGrokSessionType<T extends object>(model: T): T & { readonly targetChatSessionType: typeof GROK_SESSION_TYPE } {
	return { ...model, targetChatSessionType: GROK_SESSION_TYPE };
}

/** {@link withGrokSessionType} applied across a model list. */
export function tagModelsForGrokSession<T extends object>(
	models: readonly T[],
): ReadonlyArray<T & { readonly targetChatSessionType: typeof GROK_SESSION_TYPE }> {
	return models.map(withGrokSessionType);
}

/**
 * Select **only** the Grok-scoped models out of a mixed pool — the pure mirror
 * of the workbench `filterModelsForSession` rule for the Grok session type.
 * Models targeting other session types (e.g. `'openai-codex'`, `'gemini'`) and
 * untargeted general-pool models are excluded.
 */
export function selectGrokSessionModels<T extends IGrokTaggableModel>(models: readonly T[]): T[] {
	return models.filter(model => model.targetChatSessionType === GROK_SESSION_TYPE);
}
