/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import type {
	IAgentCliAdapter,
	IAgentCliProviderDescriptor,
	IEventNormalizer,
	NormalizedEvent,
} from '../agentCliProvider';
import {
	type AgentCliProviderId,
	normalizedEventTypes,
	providerEnabledSettingId,
} from '../agentCliProvider';

describe('agentCliProvider — type vocabulary', () => {
	it('normalizedEventTypes covers all expected event type strings', () => {
		const expected: ReadonlyArray<NormalizedEvent['type']> = [
			'assistant.textDelta',
			'assistant.thinking',
			'tool.start',
			'tool.complete',
			'tool.terminal',
			'tool.simple',
			'tool.subagent',
			'edit',
			'permission.requested',
			'usage',
			'title',
			'error',
		];
		expect(normalizedEventTypes).toEqual(expect.arrayContaining([...expected]));
		expect(normalizedEventTypes.length).toBe(expected.length);
	});

	it('discriminant narrows NormalizedEvent to the correct shape', () => {
		const events: NormalizedEvent[] = [
			{ type: 'assistant.textDelta', content: 'hello' },
			{ type: 'assistant.thinking', content: '<thinking>...</thinking>' },
			{ type: 'tool.start', toolCallId: 'tc1', toolName: 'Bash', input: { command: 'ls' } },
			{ type: 'tool.complete', toolCallId: 'tc1', toolName: 'Bash' },
			{ type: 'tool.terminal', toolCallId: 'tc2', toolName: 'Bash', command: 'ls -la' },
			{ type: 'tool.simple', toolCallId: 'tc3', toolName: 'Glob', description: 'Searching files' },
			{ type: 'tool.subagent', toolCallId: 'tc4', toolName: 'Agent' },
			{ type: 'edit', toolCallId: 'tc5', uris: [], editId: 'e1' },
			{ type: 'permission.requested', requestId: 'r1', description: 'Run shell command', kind: 'shell' },
			{ type: 'usage', inputTokens: 100, outputTokens: 200 },
			{ type: 'title', title: 'My session' },
			{ type: 'error', message: 'Something went wrong' },
		];

		for (const ev of events) {
			expect(normalizedEventTypes).toContain(ev.type);
		}
	});

	it('IAgentCliProviderDescriptor shape is structurally sound at runtime', () => {
		const descriptor: IAgentCliProviderDescriptor = {
			id: 'claude' as AgentCliProviderId,
			displayName: 'Claude Code',
			family: 'anthropic',
			hostLayer: 'agentHost',
			transport: 'sdk',
			auth: { protectedResources: ['https://api.github.com'] },
			sessionStore: 'sdk',
			models: 'dynamic',
			permissionModes: ['default', 'acceptEdits', 'bypassPermissions'],
			capabilities: {
				steering: true,
				planMode: true,
				fleet: false,
				imageAttachments: true,
				thinking: true,
				subagents: true,
			},
			security: {
				bindPolicy: 'loopback',
				authScheme: 'bearer',
				sandboxed: true,
				permissionPrompts: true,
			},
			enabledSettingId: 'chat.agentHost.claudeAgent.enabled',
			defaultEnabled: true,
		};
		expect(descriptor.id).toBe('claude');
		expect(descriptor.hostLayer).toBe('agentHost');
		expect(descriptor.models).toBe('dynamic');
	});

	it('IEventNormalizer implementation satisfies the interface', () => {
		const emitted: NormalizedEvent[] = [];

		const normalizer: IEventNormalizer<{ type: string; content?: string }> = {
			providerId: 'claude' as AgentCliProviderId,
			normalize(event) {
				if (event.type === 'text' && event.content) {
					const ev: NormalizedEvent = { type: 'assistant.textDelta', content: event.content };
					emitted.push(ev);
					return [ev];
				}
				return [];
			},
			flush() {
				return [];
			},
		};

		const result = normalizer.normalize({ type: 'text', content: 'hi' });
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe('assistant.textDelta');
		expect(normalizer.flush()).toHaveLength(0);
	});

	it('IAgentCliAdapter has descriptor and normalizer properties', () => {
		const adapter: IAgentCliAdapter<unknown> = {
			descriptor: {
				id: 'copilotcli' as AgentCliProviderId,
				displayName: 'GitHub Copilot',
				family: 'github',
				hostLayer: 'agentHost',
				transport: 'sdk',
				auth: { protectedResources: ['https://api.github.com'] },
				sessionStore: 'sdk',
				models: 'dynamic',
				permissionModes: ['default', 'autopilot'],
				capabilities: {
					steering: true,
					planMode: true,
					fleet: true,
					imageAttachments: false,
					thinking: false,
					subagents: true,
				},
				security: { bindPolicy: 'loopback', authScheme: 'bearer', sandboxed: true, permissionPrompts: true },
				enabledSettingId: 'chat.agentHost.copilotAgent.enabled',
				defaultEnabled: false,
			},
			normalizer: {
				providerId: 'copilotcli' as AgentCliProviderId,
				normalize: () => [],
				flush: () => [],
			},
		};
		expect(adapter.descriptor.id).toBe('copilotcli');
		expect(adapter.normalizer.providerId).toBe('copilotcli');
	});
});

// ---------------------------------------------------------------------------
// Tests for providerEnabledSettingId helper (work item 1.5)
// ---------------------------------------------------------------------------

describe('agentCliProvider — providerEnabledSettingId', () => {
	it('generates the correct setting ID for claude', () => {
		expect(providerEnabledSettingId('claude')).toBe('chat.agentHost.claudeAgent.enabled');
	});

	it('generates the correct setting ID for codex', () => {
		expect(providerEnabledSettingId('codex')).toBe('chat.agentHost.codexAgent.enabled');
	});

	it('follows the chat.agentHost.<id>Agent.enabled pattern for any id', () => {
		expect(providerEnabledSettingId('newprovider')).toBe('chat.agentHost.newproviderAgent.enabled');
		expect(providerEnabledSettingId('copilotcli')).toBe('chat.agentHost.copilotcliAgent.enabled');
	});

	it('IAgentCliProviderDescriptor.defaultEnabled field controls whether provider is on by default', () => {
		// Claude ships default-ON (for backward compat); new providers ship default-OFF
		const claudeDescriptor: IAgentCliProviderDescriptor = {
			id: 'claude' as AgentCliProviderId,
			displayName: 'Claude Code',
			family: 'anthropic',
			hostLayer: 'agentHost',
			transport: 'sdk',
			auth: { protectedResources: ['https://api.github.com'] },
			sessionStore: 'sdk',
			models: 'dynamic',
			permissionModes: ['default'],
			capabilities: { steering: true, planMode: true, fleet: false, imageAttachments: true, thinking: true, subagents: true },
			security: { bindPolicy: 'loopback', authScheme: 'bearer', sandboxed: true, permissionPrompts: true },
			enabledSettingId: providerEnabledSettingId('claude'),
			defaultEnabled: true,
		};
		expect(claudeDescriptor.defaultEnabled).toBe(true);

		const newDescriptor: IAgentCliProviderDescriptor = {
			id: 'newprovider' as AgentCliProviderId,
			displayName: 'New Provider',
			family: 'openai',
			hostLayer: 'agentHost',
			transport: 'sdk',
			auth: { protectedResources: [] },
			sessionStore: 'none',
			models: 'dynamic',
			permissionModes: ['default'],
			capabilities: { steering: false, planMode: false, fleet: false, imageAttachments: false, thinking: false, subagents: false },
			security: { bindPolicy: 'loopback', authScheme: 'bearer', sandboxed: false, permissionPrompts: false },
			enabledSettingId: providerEnabledSettingId('newprovider'),
			defaultEnabled: false,
		};
		expect(newDescriptor.defaultEnabled).toBe(false);
	});
});
