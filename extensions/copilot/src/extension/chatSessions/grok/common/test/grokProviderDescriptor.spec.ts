/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import type { AgentCliPermissionMode } from '../../../common/agentCliProvider';
import { providerEnabledSettingId } from '../../../common/agentCliProvider';
import {
	AgentCliProviderRegistry,
	validateSecurityDescriptor,
} from '../../../common/agentCliProviderRegistry';
import {
	GROK_DECLARED_PERMISSION_MODES,
	GROK_PERMISSION_MODES,
} from '../grokPermissionModes';
import {
	GROK_SESSION_TYPE,
	selectGrokSessionModels,
	tagModelsForGrokSession,
	withGrokSessionType,
} from '../grokModelCatalog';
import {
	createGrokAdapter,
	grokProviderDescriptor,
	GROK_CLI_PINNED_VERSION,
	GROK_HEADLESS_SINGLE_FLAG,
	GROK_PROVIDER_ID,
	GROK_RESUME_FLAG,
} from '../grokProviderDescriptor';

// ---------------------------------------------------------------------------
// Provider descriptor (P3 4.2 — the provider can appear / be registered)
// ---------------------------------------------------------------------------

describe('grokProviderDescriptor', () => {
	it('pins the discovery-gate target: grok 0.2.51, headless + resume flags', () => {
		expect(GROK_CLI_PINNED_VERSION).toBe('0.2.51');
		expect(GROK_HEADLESS_SINGLE_FLAG).toBe('-p');
		expect(GROK_RESUME_FLAG).toBe('-r');
	});

	it('has the canonical grok identity', () => {
		expect(grokProviderDescriptor.id).toBe('grok');
		expect(GROK_PROVIDER_ID).toBe('grok');
		expect(grokProviderDescriptor.family).toBe('xai');
		expect(grokProviderDescriptor.displayName).toMatch(/grok/i);
	});

	it('runs in the agentHost layer over a spawned process (DN-2, spawn-per-turn)', () => {
		expect(grokProviderDescriptor.hostLayer).toBe('agentHost');
		expect(grokProviderDescriptor.transport).toBe('process');
	});

	it('sources models dynamically via BYOK (DN-3)', () => {
		expect(grokProviderDescriptor.models).toBe('dynamic');
	});

	it('declares emulated steering (DN-5 abort-and-resume) and reasoning', () => {
		expect(grokProviderDescriptor.capabilities.steering).toBe(true);
		expect(grokProviderDescriptor.capabilities.thinking).toBe(true);
	});

	it('binds loopback-only with a non-empty auth scheme and per-command prompts (DN-4)', () => {
		expect(grokProviderDescriptor.security.bindPolicy).toBe('loopback');
		expect(grokProviderDescriptor.security.authScheme.length).toBeGreaterThan(0);
		expect(grokProviderDescriptor.security.permissionPrompts).toBe(true);
		// Passes the registry consistency check (AC-P0.4).
		expect(validateSecurityDescriptor(grokProviderDescriptor.security)).toBeUndefined();
	});

	it('is a default-OFF new provider with the canonical enabled setting id', () => {
		expect(grokProviderDescriptor.defaultEnabled).toBe(false);
		expect(grokProviderDescriptor.enabledSettingId).toBe('chat.agentHost.grokAgent.enabled');
		expect(grokProviderDescriptor.enabledSettingId).toBe(providerEnabledSettingId(GROK_PROVIDER_ID));
	});

	it('is accepted by the AgentCliProviderRegistry', () => {
		const registry = new AgentCliProviderRegistry();
		expect(() => registry.registerDescriptor(grokProviderDescriptor)).not.toThrow();
		expect(registry.getDescriptor('grok')).toBe(grokProviderDescriptor);
	});
});

describe('createGrokAdapter', () => {
	it('pairs the descriptor with a grok-scoped normalizer', () => {
		const adapter = createGrokAdapter();
		expect(adapter.descriptor).toBe(grokProviderDescriptor);
		expect(adapter.normalizer.providerId).toBe('grok');
	});

	it('returns a fresh, independent normalizer each call (per-session state)', () => {
		expect(createGrokAdapter().normalizer).not.toBe(createGrokAdapter().normalizer);
	});
});

// ---------------------------------------------------------------------------
// Permission modes (DN-4 default-deny)
// ---------------------------------------------------------------------------

describe('grok permission modes (DN-4 default-deny)', () => {
	it('descriptor declares the fork-mappable grok permission-mode superset', () => {
		expect(grokProviderDescriptor.permissionModes).toEqual(GROK_DECLARED_PERMISSION_MODES);
		expect(grokProviderDescriptor.permissionModes).toContain<AgentCliPermissionMode>('default');
		expect(grokProviderDescriptor.permissionModes).toContain<AgentCliPermissionMode>('acceptEdits');
		expect(grokProviderDescriptor.permissionModes).toContain<AgentCliPermissionMode>('bypassPermissions');
	});

	it('defaults to confirm-everything — the DN-4 default-deny mode is first', () => {
		expect(GROK_PERMISSION_MODES[0].id).toBe('default');
		expect(GROK_PERMISSION_MODES[0].label).toMatch(/ask/i);
	});
});

// ---------------------------------------------------------------------------
// Model catalog (DN-3 targetChatSessionType scoping — only Grok models)
// ---------------------------------------------------------------------------

describe('grok model catalog (DN-3 targetChatSessionType scoping)', () => {
	it('tags a model with the grok session type', () => {
		const tagged = withGrokSessionType({ id: 'grok-build', name: 'Grok' });
		expect(tagged.targetChatSessionType).toBe('grok');
		expect(GROK_SESSION_TYPE).toBe('grok');
	});

	it('selects ONLY grok-tagged models out of a mixed pool', () => {
		const grokModels = tagModelsForGrokSession([{ id: 'grok-build', name: 'Grok' }]);
		const pool = [
			...grokModels,
			{ id: 'gpt-5', name: 'GPT-5', targetChatSessionType: 'openai-codex' },
			{ id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', targetChatSessionType: 'gemini' },
			{ id: 'general-model', name: 'General' }, // untargeted general-pool model
		];
		const selected = selectGrokSessionModels(pool);
		expect(selected.map(m => m.id)).toEqual(['grok-build']);
		expect(selected.every(m => m.targetChatSessionType === GROK_SESSION_TYPE)).toBe(true);
	});
});
