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
	createGeminiAdapter,
	geminiProviderDescriptor,
	GEMINI_ACP_DEPRECATED_FLAG,
	GEMINI_ACP_FLAG,
	GEMINI_ACP_PROTOCOL_VERSION,
	GEMINI_CLI_PINNED_VERSION,
	GEMINI_PROVIDER_ID,
} from '../geminiProviderDescriptor';
import {
	DEFAULT_GEMINI_PERMISSION_MODES,
	GEMINI_DECLARED_PERMISSION_MODES,
	mapAcpModesToGeminiPermissionModes,
	narrowGeminiAcpModeToPermissionMode,
} from '../geminiPermissionModes';
import {
	GEMINI_SESSION_TYPE,
	selectGeminiSessionModels,
	tagModelsForGeminiSession,
	withGeminiSessionType,
} from '../geminiModelCatalog';

// ---------------------------------------------------------------------------
// Provider descriptor (AC-P1.1 — the provider can appear / be registered)
// ---------------------------------------------------------------------------

describe('geminiProviderDescriptor', () => {
	it('pins the spike target: gemini-cli 0.47.0, ACP protocol v1, --acp flag', () => {
		expect(GEMINI_CLI_PINNED_VERSION).toBe('0.47.0');
		expect(GEMINI_ACP_PROTOCOL_VERSION).toBe(1);
		expect(GEMINI_ACP_FLAG).toBe('--acp');
		// Retained alias for older pins (spike Pinned target table).
		expect(GEMINI_ACP_DEPRECATED_FLAG).toBe('--experimental-acp');
	});

	it('has the canonical gemini identity', () => {
		expect(geminiProviderDescriptor.id).toBe('gemini');
		expect(GEMINI_PROVIDER_ID).toBe('gemini');
		expect(geminiProviderDescriptor.family).toBe('google');
		expect(geminiProviderDescriptor.displayName).toMatch(/gemini/i);
	});

	it('runs in the agentHost layer over a spawned process (DN-2)', () => {
		expect(geminiProviderDescriptor.hostLayer).toBe('agentHost');
		expect(geminiProviderDescriptor.transport).toBe('process');
	});

	it('sources models dynamically via BYOK (DN-3)', () => {
		expect(geminiProviderDescriptor.models).toBe('dynamic');
	});

	it('declares emulated steering (Tier 2, abort-and-replace, DN-4)', () => {
		// DN-4: steering may be `true` ONLY if treated as emulated cancel-and-replace.
		expect(geminiProviderDescriptor.capabilities.steering).toBe(true);
		expect(geminiProviderDescriptor.capabilities.thinking).toBe(true);
		expect(geminiProviderDescriptor.capabilities.imageAttachments).toBe(true);
	});

	it('binds loopback-only and authenticates with an apiKey scheme (DN-4 auth gate)', () => {
		expect(geminiProviderDescriptor.security.bindPolicy).toBe('loopback');
		expect(geminiProviderDescriptor.security.authScheme).toBe('apiKey');
		// Passes the registry consistency check (AC-P0.4).
		expect(validateSecurityDescriptor(geminiProviderDescriptor.security)).toBeUndefined();
	});

	it('is a default-OFF new provider with the canonical enabled setting id', () => {
		expect(geminiProviderDescriptor.defaultEnabled).toBe(false);
		expect(geminiProviderDescriptor.enabledSettingId).toBe('chat.agentHost.geminiAgent.enabled');
		expect(geminiProviderDescriptor.enabledSettingId).toBe(providerEnabledSettingId(GEMINI_PROVIDER_ID));
	});

	it('is accepted by the AgentCliProviderRegistry', () => {
		const registry = new AgentCliProviderRegistry();
		expect(() => registry.registerDescriptor(geminiProviderDescriptor)).not.toThrow();
		expect(registry.getDescriptor('gemini')).toBe(geminiProviderDescriptor);
	});
});

describe('createGeminiAdapter', () => {
	it('pairs the descriptor with a gemini-scoped normalizer', () => {
		const adapter = createGeminiAdapter();
		expect(adapter.descriptor).toBe(geminiProviderDescriptor);
		expect(adapter.normalizer.providerId).toBe('gemini');
	});

	it('returns a fresh, independent normalizer each call (per-session state)', () => {
		expect(createGeminiAdapter().normalizer).not.toBe(createGeminiAdapter().normalizer);
	});
});

// ---------------------------------------------------------------------------
// Permission modes (AC-P1.3 — permission picker shows Gemini-declared modes)
// ---------------------------------------------------------------------------

describe('gemini permission modes', () => {
	it('descriptor declares the fork-mappable Gemini permission-mode superset', () => {
		expect(geminiProviderDescriptor.permissionModes).toEqual(GEMINI_DECLARED_PERMISSION_MODES);
		expect(geminiProviderDescriptor.permissionModes).toContain<AgentCliPermissionMode>('default');
		expect(geminiProviderDescriptor.permissionModes).toContain<AgentCliPermissionMode>('acceptEdits');
		expect(geminiProviderDescriptor.permissionModes).toContain<AgentCliPermissionMode>('bypassPermissions');
	});

	it('maps the agent-declared ACP modes into picker modes (AC-P1.3 — Gemini-declared)', () => {
		const acpModes = [
			{ id: 'default', name: 'Always ask', description: 'Prompt before every action' },
			{ id: 'auto_edit', name: 'Auto-accept edits' },
			{ id: 'yolo', name: 'Accept all', description: null },
		];
		const picker = mapAcpModesToGeminiPermissionModes(acpModes);
		expect(picker.map(m => m.id)).toEqual(['default', 'auto_edit', 'yolo']);
		expect(picker[0].label).toBe('Always ask');
		expect(picker[0].description).toBe('Prompt before every action');
		// A null ACP description does not leak through as a description.
		expect(picker[2].description).toBeUndefined();
	});

	it('falls back to the default modes when the agent declares none', () => {
		expect(mapAcpModesToGeminiPermissionModes(undefined)).toEqual(DEFAULT_GEMINI_PERMISSION_MODES);
		expect(mapAcpModesToGeminiPermissionModes([])).toEqual(DEFAULT_GEMINI_PERMISSION_MODES);
		expect(DEFAULT_GEMINI_PERMISSION_MODES.length).toBeGreaterThan(0);
	});

	it('narrows known ACP mode ids to the fork permission-mode union', () => {
		expect(narrowGeminiAcpModeToPermissionMode('default')).toBe('default');
		expect(narrowGeminiAcpModeToPermissionMode('auto_edit')).toBe('acceptEdits');
		expect(narrowGeminiAcpModeToPermissionMode('acceptEdits')).toBe('acceptEdits');
		expect(narrowGeminiAcpModeToPermissionMode('yolo')).toBe('bypassPermissions');
		expect(narrowGeminiAcpModeToPermissionMode('bypassPermissions')).toBe('bypassPermissions');
		expect(narrowGeminiAcpModeToPermissionMode('made-up-mode')).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Model catalog (AC-P1.3 — model picker shows only Gemini models, DN-3)
// ---------------------------------------------------------------------------

describe('gemini model catalog (DN-3 targetChatSessionType scoping)', () => {
	it('tags a model with the gemini session type', () => {
		const tagged = withGeminiSessionType({ id: 'models/gemini-2.5-pro', name: 'Gemini 2.5 Pro' });
		expect(tagged.targetChatSessionType).toBe('gemini');
		expect(GEMINI_SESSION_TYPE).toBe('gemini');
	});

	it('selects ONLY gemini-tagged models out of a mixed pool (only Gemini models)', () => {
		const geminiModels = tagModelsForGeminiSession([
			{ id: 'models/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
			{ id: 'models/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
		]);
		const pool = [
			...geminiModels,
			{ id: 'gpt-5', name: 'GPT-5', targetChatSessionType: 'openai-codex' },
			{ id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', targetChatSessionType: 'claude-code' },
			{ id: 'general-model', name: 'General' }, // untargeted general-pool model
		];
		const selected = selectGeminiSessionModels(pool);
		expect(selected.map(m => m.id)).toEqual(['models/gemini-2.5-pro', 'models/gemini-2.5-flash']);
		// No non-Gemini model survives the scope.
		expect(selected.every(m => m.targetChatSessionType === GEMINI_SESSION_TYPE)).toBe(true);
	});
});
