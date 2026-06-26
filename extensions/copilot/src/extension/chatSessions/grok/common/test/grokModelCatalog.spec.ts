/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import {
	GROK_SESSION_TYPE,
	selectGrokSessionModels,
	tagModelsForGrokSession,
	withGrokSessionType,
} from '../grokModelCatalog';

describe('grok model catalog (targetChatSessionType scoping)', () => {
	it('tags a model with the grok session type', () => {
		const tagged = withGrokSessionType({ id: 'grok-build', name: 'Grok Build' });
		expect(tagged.targetChatSessionType).toBe('grok');
		expect(GROK_SESSION_TYPE).toBe('grok');
	});

	it('selects ONLY grok-tagged models out of a mixed pool', () => {
		const grokModels = tagModelsForGrokSession([
			{ id: 'grok-build', name: 'Grok Build' },
			{ id: 'grok-4', name: 'Grok 4' },
		]);
		const pool = [
			...grokModels,
			{ id: 'gpt-5', name: 'GPT-5', targetChatSessionType: 'openai-codex' },
			{ id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', targetChatSessionType: 'gemini' },
			{ id: 'general-model', name: 'General' }, // untargeted general-pool model
		];
		const selected = selectGrokSessionModels(pool);
		expect(selected.map(m => m.id)).toEqual(['grok-build', 'grok-4']);
		expect(selected.every(m => m.targetChatSessionType === GROK_SESSION_TYPE)).toBe(true);
	});

	it('does not mutate the input model when tagging', () => {
		const input = { id: 'grok-build', name: 'Grok Build' };
		withGrokSessionType(input);
		expect('targetChatSessionType' in input).toBe(false);
	});
});
