/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import type {
	IAgentCliAdapter,
	IAgentCliProviderDescriptor,
	IAgentSecurityDescriptor,
	IEventNormalizer,
	NormalizedEvent,
} from '../agentCliProvider';
import type { AgentCliProviderId } from '../agentCliProvider';
import {
	normalizedEventTypes,
	providerEnabledSettingId,
	recordNormalizedEvents,
	turnLifecycleEventTypes,
} from '../agentCliProvider';
import {
	AgentCliProviderRegistry,
	applyRegistryToAgentService,
	generateProviderEnabledCommands,
	generateProviderEnabledConfigs,
	providerDisableCommandId,
	providerDisableCommandIdFromSettingId,
	providerEnableCommandId,
	providerEnableCommandIdFromSettingId,
	validateSecurityDescriptor,
	type IAgentLike,
	type IAgentFactory,
	type IAgentServiceLike,
	type ISettingsServiceLike,
} from '../agentCliProviderRegistry';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDescriptor(
	id: AgentCliProviderId,
	enabledSettingId = `chat.agentHost.${id}.enabled`,
	defaultEnabled = false,
): IAgentCliProviderDescriptor {
	return {
		id,
		displayName: `Test Provider ${id}`,
		family: 'github',
		hostLayer: 'agentHost',
		transport: 'sdk',
		auth: { protectedResources: ['https://api.github.com'] },
		sessionStore: 'sdk',
		models: 'dynamic',
		permissionModes: ['default'],
		capabilities: {
			steering: false,
			planMode: false,
			fleet: false,
			imageAttachments: false,
			thinking: false,
			subagents: false,
		},
		security: { bindPolicy: 'loopback', authScheme: 'bearer', sandboxed: true, permissionPrompts: false },
		enabledSettingId,
		defaultEnabled,
	};
}

function makeAgent(id: string): IAgentLike {
	return { id };
}

class FakeFactory implements IAgentFactory {
	public readonly created: IAgentLike[] = [];
	createAgent(descriptor: IAgentCliProviderDescriptor): IAgentLike {
		const agent = makeAgent(descriptor.id);
		this.created.push(agent);
		return agent;
	}
}

class FakeAgentService implements IAgentServiceLike {
	public readonly registered: IAgentLike[] = [];
	registerProvider(agent: IAgentLike): void {
		this.registered.push(agent);
	}
}

class FakeSettings implements ISettingsServiceLike {
	private readonly _values: Map<string, unknown>;
	constructor(values: Record<string, unknown> = {}) {
		this._values = new Map(Object.entries(values));
	}
	getValue(settingId: string): unknown {
		return this._values.get(settingId);
	}
}

// ---------------------------------------------------------------------------
// Tests — AgentCliProviderRegistry
// ---------------------------------------------------------------------------

describe('AgentCliProviderRegistry', () => {
	it('starts empty', () => {
		const registry = new AgentCliProviderRegistry();
		expect(registry.getDescriptors()).toHaveLength(0);
	});

	it('registers a descriptor and returns it', () => {
		const registry = new AgentCliProviderRegistry();
		const desc = makeDescriptor('claude');
		registry.registerDescriptor(desc);
		expect(registry.getDescriptors()).toHaveLength(1);
		expect(registry.getDescriptors()[0]).toBe(desc);
	});

	it('returns the descriptor by id', () => {
		const registry = new AgentCliProviderRegistry();
		const desc = makeDescriptor('copilotcli');
		registry.registerDescriptor(desc);
		expect(registry.getDescriptor('copilotcli')).toBe(desc);
	});

	it('returns undefined for an unregistered id', () => {
		const registry = new AgentCliProviderRegistry();
		expect(registry.getDescriptor('claude')).toBeUndefined();
	});

	it('throws when registering a duplicate id', () => {
		const registry = new AgentCliProviderRegistry();
		registry.registerDescriptor(makeDescriptor('claude'));
		expect(() => registry.registerDescriptor(makeDescriptor('claude'))).toThrow(
			/already registered/i,
		);
	});

	it('registers multiple descriptors and enumerates them in insertion order', () => {
		const registry = new AgentCliProviderRegistry();
		registry.registerDescriptor(makeDescriptor('claude'));
		registry.registerDescriptor(makeDescriptor('copilotcli'));
		registry.registerDescriptor(makeDescriptor('codex'));
		const ids = registry.getDescriptors().map(d => d.id);
		expect(ids).toEqual(['claude', 'copilotcli', 'codex']);
	});
});

// ---------------------------------------------------------------------------
// Tests — applyRegistryToAgentService (the shared registration base)
// ---------------------------------------------------------------------------

describe('applyRegistryToAgentService', () => {
	it('calls registerProvider for each registered descriptor', () => {
		const registry = new AgentCliProviderRegistry();
		registry.registerDescriptor(makeDescriptor('claude'));
		registry.registerDescriptor(makeDescriptor('copilotcli'));

		const agentService = new FakeAgentService();
		const settings = new FakeSettings(); // all settings undefined → default enabled
		const factory = new FakeFactory();

		applyRegistryToAgentService(registry, agentService, settings, factory);

		expect(agentService.registered).toHaveLength(2);
		expect(agentService.registered.map(a => a.id)).toEqual(['claude', 'copilotcli']);
	});

	it('skips providers whose enabledSettingId resolves to false', () => {
		const registry = new AgentCliProviderRegistry();
		registry.registerDescriptor(makeDescriptor('claude', 'chat.claude.enabled'));
		registry.registerDescriptor(makeDescriptor('copilotcli', 'chat.copilot.enabled'));

		const agentService = new FakeAgentService();
		const settings = new FakeSettings({ 'chat.claude.enabled': false });
		const factory = new FakeFactory();

		applyRegistryToAgentService(registry, agentService, settings, factory);

		expect(agentService.registered).toHaveLength(1);
		expect(agentService.registered[0].id).toBe('copilotcli');
	});

	it('registers providers whose enabledSettingId resolves to true', () => {
		const registry = new AgentCliProviderRegistry();
		registry.registerDescriptor(makeDescriptor('claude', 'chat.claude.enabled'));

		const agentService = new FakeAgentService();
		const settings = new FakeSettings({ 'chat.claude.enabled': true });
		const factory = new FakeFactory();

		applyRegistryToAgentService(registry, agentService, settings, factory);

		expect(agentService.registered).toHaveLength(1);
	});

	it('registers providers whose enabledSettingId is not in settings (default enabled)', () => {
		const registry = new AgentCliProviderRegistry();
		registry.registerDescriptor(makeDescriptor('codex', 'chat.codex.enabled'));

		const agentService = new FakeAgentService();
		const settings = new FakeSettings({}); // setting absent → not explicitly false
		const factory = new FakeFactory();

		applyRegistryToAgentService(registry, agentService, settings, factory);

		expect(agentService.registered).toHaveLength(1);
		expect(agentService.registered[0].id).toBe('codex');
	});

	it('skips all providers when all settings are false', () => {
		const registry = new AgentCliProviderRegistry();
		registry.registerDescriptor(makeDescriptor('claude', 'chat.claude.enabled'));
		registry.registerDescriptor(makeDescriptor('copilotcli', 'chat.copilot.enabled'));

		const agentService = new FakeAgentService();
		const settings = new FakeSettings({
			'chat.claude.enabled': false,
			'chat.copilot.enabled': false,
		});
		const factory = new FakeFactory();

		applyRegistryToAgentService(registry, agentService, settings, factory);

		expect(agentService.registered).toHaveLength(0);
	});

	it('delegates IAgent creation to the factory', () => {
		const registry = new AgentCliProviderRegistry();
		const desc = makeDescriptor('claude');
		registry.registerDescriptor(desc);

		const agentService = new FakeAgentService();
		const settings = new FakeSettings();
		const factory = new FakeFactory();

		applyRegistryToAgentService(registry, agentService, settings, factory);

		expect(factory.created).toHaveLength(1);
		expect(factory.created[0].id).toBe('claude');
	});

	it('does nothing when registry is empty', () => {
		const registry = new AgentCliProviderRegistry();
		const agentService = new FakeAgentService();
		const settings = new FakeSettings();
		const factory = new FakeFactory();

		expect(() =>
			applyRegistryToAgentService(registry, agentService, settings, factory),
		).not.toThrow();
		expect(agentService.registered).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Tests — generateProviderEnabledConfigs (work item 1.5)
// ---------------------------------------------------------------------------

describe('generateProviderEnabledConfigs', () => {
	it('returns an empty array when the registry is empty', () => {
		const registry = new AgentCliProviderRegistry();
		expect(generateProviderEnabledConfigs(registry)).toHaveLength(0);
	});

	it('returns one config entry per registered descriptor', () => {
		const registry = new AgentCliProviderRegistry();
		registry.registerDescriptor(
			makeDescriptor('claude', providerEnabledSettingId('claude'), true),
		);
		registry.registerDescriptor(
			makeDescriptor('codex', providerEnabledSettingId('codex'), false),
		);

		const configs = generateProviderEnabledConfigs(registry);
		expect(configs).toHaveLength(2);
	});

	it('each entry carries the settingId from the descriptor', () => {
		const registry = new AgentCliProviderRegistry();
		registry.registerDescriptor(
			makeDescriptor('claude', providerEnabledSettingId('claude'), true),
		);

		const configs = generateProviderEnabledConfigs(registry);
		expect(configs[0].settingId).toBe('chat.agentHost.claudeAgent.enabled');
	});

	it('each entry carries the defaultEnabled value from the descriptor', () => {
		const registry = new AgentCliProviderRegistry();
		registry.registerDescriptor(
			makeDescriptor('claude', providerEnabledSettingId('claude'), true),
		);
		registry.registerDescriptor(
			makeDescriptor('codex', providerEnabledSettingId('codex'), false),
		);

		const configs = generateProviderEnabledConfigs(registry);
		expect(configs[0].defaultEnabled).toBe(true);  // Claude: default-ON
		expect(configs[1].defaultEnabled).toBe(false); // Codex: default-OFF
	});

	it('new provider descriptors with defaultEnabled=false produce default-OFF configs', () => {
		const registry = new AgentCliProviderRegistry();
		registry.registerDescriptor(
			makeDescriptor('newprovider', providerEnabledSettingId('newprovider'), false),
		);

		const configs = generateProviderEnabledConfigs(registry);
		expect(configs[0].settingId).toBe('chat.agentHost.newproviderAgent.enabled');
		expect(configs[0].defaultEnabled).toBe(false);
	});

	it('entries preserve insertion order', () => {
		const registry = new AgentCliProviderRegistry();
		registry.registerDescriptor(makeDescriptor('claude', providerEnabledSettingId('claude'), true));
		registry.registerDescriptor(makeDescriptor('codex', providerEnabledSettingId('codex'), false));
		registry.registerDescriptor(makeDescriptor('copilotcli', providerEnabledSettingId('copilotcli'), false));

		const configs = generateProviderEnabledConfigs(registry);
		expect(configs.map(c => c.settingId)).toEqual([
			'chat.agentHost.claudeAgent.enabled',
			'chat.agentHost.codexAgent.enabled',
			'chat.agentHost.copilotcliAgent.enabled',
		]);
	});
});

// ---------------------------------------------------------------------------
// Tests — providerEnableCommandId / providerDisableCommandId (work item 1.5)
// ---------------------------------------------------------------------------

describe('providerEnableCommandId / providerDisableCommandId', () => {
	it('providerEnableCommandId generates chat.agentHost.<id>Agent.enable', () => {
		expect(providerEnableCommandId('claude')).toBe('chat.agentHost.claudeAgent.enable');
		expect(providerEnableCommandId('codex')).toBe('chat.agentHost.codexAgent.enable');
		expect(providerEnableCommandId('newprovider')).toBe('chat.agentHost.newproviderAgent.enable');
	});

	it('providerDisableCommandId generates chat.agentHost.<id>Agent.disable', () => {
		expect(providerDisableCommandId('claude')).toBe('chat.agentHost.claudeAgent.disable');
		expect(providerDisableCommandId('codex')).toBe('chat.agentHost.codexAgent.disable');
		expect(providerDisableCommandId('newprovider')).toBe('chat.agentHost.newproviderAgent.disable');
	});

	it('enable and disable command IDs are distinct for the same provider', () => {
		expect(providerEnableCommandId('claude')).not.toBe(providerDisableCommandId('claude'));
	});
});

// ---------------------------------------------------------------------------
// Tests — commands derived from descriptor.enabledSettingId (work item 1.5)
//
// The work item requires commands to be "auto-generated from
// descriptor.enabledSettingId" — i.e. the command ids must track the actual
// setting a descriptor declares, not a value re-computed from the provider id.
// ---------------------------------------------------------------------------

describe('command ids derived from enabledSettingId', () => {
	it('providerEnableCommandIdFromSettingId strips the .enabled suffix and appends .enable', () => {
		expect(providerEnableCommandIdFromSettingId('chat.agentHost.claudeAgent.enabled')).toBe(
			'chat.agentHost.claudeAgent.enable',
		);
	});

	it('providerDisableCommandIdFromSettingId strips the .enabled suffix and appends .disable', () => {
		expect(providerDisableCommandIdFromSettingId('chat.agentHost.codexAgent.enabled')).toBe(
			'chat.agentHost.codexAgent.disable',
		);
	});

	it('derives from the actual setting id, not the canonical id formula', () => {
		// A descriptor that overrides its enabledSettingId to a non-canonical value
		// gets commands consistent with THAT setting, not the id-derived default.
		expect(providerEnableCommandIdFromSettingId('chat.claude.enabled')).toBe('chat.claude.enable');
		expect(providerDisableCommandIdFromSettingId('chat.claude.enabled')).toBe('chat.claude.disable');
	});

	it('matches the by-id command helpers for canonical descriptors', () => {
		const settingId = providerEnabledSettingId('claude');
		expect(providerEnableCommandIdFromSettingId(settingId)).toBe(providerEnableCommandId('claude'));
		expect(providerDisableCommandIdFromSettingId(settingId)).toBe(providerDisableCommandId('claude'));
	});

	it('falls back to appending when the setting id does not end in .enabled', () => {
		expect(providerEnableCommandIdFromSettingId('chat.agentHost.fooAgent')).toBe(
			'chat.agentHost.fooAgent.enable',
		);
		expect(providerDisableCommandIdFromSettingId('chat.agentHost.fooAgent')).toBe(
			'chat.agentHost.fooAgent.disable',
		);
	});
});

describe('generateProviderEnabledCommands (work item 1.5)', () => {
	it('returns an empty array when the registry is empty', () => {
		const registry = new AgentCliProviderRegistry();
		expect(generateProviderEnabledCommands(registry)).toHaveLength(0);
	});

	it('returns one enable/disable command pair per descriptor, derived from enabledSettingId', () => {
		const registry = new AgentCliProviderRegistry();
		registry.registerDescriptor(makeDescriptor('claude', providerEnabledSettingId('claude'), true));
		registry.registerDescriptor(makeDescriptor('codex', providerEnabledSettingId('codex'), false));

		expect(generateProviderEnabledCommands(registry)).toEqual([
			{
				providerId: 'claude',
				enableCommandId: 'chat.agentHost.claudeAgent.enable',
				disableCommandId: 'chat.agentHost.claudeAgent.disable',
			},
			{
				providerId: 'codex',
				enableCommandId: 'chat.agentHost.codexAgent.enable',
				disableCommandId: 'chat.agentHost.codexAgent.disable',
			},
		]);
	});

	it('honors a descriptor that overrides its enabledSettingId', () => {
		const registry = new AgentCliProviderRegistry();
		registry.registerDescriptor(makeDescriptor('claude', 'chat.claude.enabled'));

		expect(generateProviderEnabledCommands(registry)[0]).toEqual({
			providerId: 'claude',
			enableCommandId: 'chat.claude.enable',
			disableCommandId: 'chat.claude.disable',
		});
	});

	it('produces a command pair for a new provider without touching the generator', () => {
		const registry = new AgentCliProviderRegistry();
		registry.registerDescriptor(
			makeDescriptor('newprovider', providerEnabledSettingId('newprovider'), false),
		);

		const commands = generateProviderEnabledCommands(registry);
		expect(commands[0].enableCommandId).toBe('chat.agentHost.newproviderAgent.enable');
		expect(commands[0].disableCommandId).toBe('chat.agentHost.newproviderAgent.disable');
	});

	it('preserves insertion order', () => {
		const registry = new AgentCliProviderRegistry();
		registry.registerDescriptor(makeDescriptor('claude', providerEnabledSettingId('claude'), true));
		registry.registerDescriptor(makeDescriptor('codex', providerEnabledSettingId('codex'), false));
		registry.registerDescriptor(
			makeDescriptor('copilotcli', providerEnabledSettingId('copilotcli'), false),
		);

		expect(generateProviderEnabledCommands(registry).map(c => c.providerId)).toEqual([
			'claude',
			'codex',
			'copilotcli',
		]);
	});
});

// ---------------------------------------------------------------------------
// Tests — security-descriptor consistency (work item 1.9, AC-P0.4)
// ---------------------------------------------------------------------------

/** Build a descriptor with an overridden security descriptor. */
function withSecurity(
	id: AgentCliProviderId,
	security: IAgentSecurityDescriptor,
): IAgentCliProviderDescriptor {
	return { ...makeDescriptor(id), security };
}

describe('validateSecurityDescriptor (AC-P0.4)', () => {
	it('accepts a loopback bind policy with a non-empty auth scheme', () => {
		expect(
			validateSecurityDescriptor({
				bindPolicy: 'loopback',
				authScheme: 'bearer',
				sandboxed: true,
				permissionPrompts: true,
			}),
		).toBeUndefined();
	});

	it('rejects a non-loopback bind policy', () => {
		const reason = validateSecurityDescriptor({
			bindPolicy: 'any',
			authScheme: 'bearer',
			sandboxed: true,
			permissionPrompts: true,
		});
		expect(reason).toMatch(/non-loopback bind policy/i);
		expect(reason).toContain('any');
	});

	it('rejects a LAN bind policy (also non-loopback)', () => {
		expect(
			validateSecurityDescriptor({
				bindPolicy: 'lan',
				authScheme: 'bearer',
				sandboxed: true,
				permissionPrompts: true,
			}),
		).toMatch(/non-loopback bind policy/i);
	});

	it('rejects a missing (empty) auth scheme', () => {
		expect(
			validateSecurityDescriptor({
				bindPolicy: 'loopback',
				authScheme: '',
				sandboxed: true,
				permissionPrompts: true,
			}),
		).toMatch(/missing auth scheme/i);
	});

	it('rejects a blank (whitespace-only) auth scheme', () => {
		expect(
			validateSecurityDescriptor({
				bindPolicy: 'loopback',
				authScheme: '   ',
				sandboxed: true,
				permissionPrompts: true,
			}),
		).toMatch(/missing auth scheme/i);
	});

	it('rejects an absent security descriptor', () => {
		expect(validateSecurityDescriptor(undefined)).toMatch(/missing security descriptor/i);
	});
});

describe('AgentCliProviderRegistry — security-descriptor consistency (AC-P0.4)', () => {
	it('registers a provider with a loopback bind policy and an auth scheme', () => {
		const registry = new AgentCliProviderRegistry();
		expect(() =>
			registry.registerDescriptor(
				withSecurity('claude', {
					bindPolicy: 'loopback',
					authScheme: 'bearer',
					sandboxed: true,
					permissionPrompts: true,
				}),
			),
		).not.toThrow();
		expect(registry.getDescriptor('claude')).toBeDefined();
	});

	it('rejects (throws) a provider with a non-loopback bind policy', () => {
		const registry = new AgentCliProviderRegistry();
		expect(() =>
			registry.registerDescriptor(
				withSecurity('codex', {
					bindPolicy: 'any',
					authScheme: 'bearer',
					sandboxed: true,
					permissionPrompts: true,
				}),
			),
		).toThrow(/non-loopback bind policy/i);
	});

	it('rejects (throws) a provider with a missing auth scheme', () => {
		const registry = new AgentCliProviderRegistry();
		expect(() =>
			registry.registerDescriptor(
				withSecurity('codex', {
					bindPolicy: 'loopback',
					authScheme: '',
					sandboxed: true,
					permissionPrompts: true,
				}),
			),
		).toThrow(/missing auth scheme/i);
	});

	it('does not register a rejected provider (registry stays empty)', () => {
		const registry = new AgentCliProviderRegistry();
		expect(() =>
			registry.registerDescriptor(
				withSecurity('codex', {
					bindPolicy: 'any',
					authScheme: 'bearer',
					sandboxed: true,
					permissionPrompts: true,
				}),
			),
		).toThrow();
		expect(registry.getDescriptors()).toHaveLength(0);
		expect(registry.getDescriptor('codex')).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Tests — registered provider emits the normalized turn-lifecycle vocabulary
// (work item 1.9, AC-P0.5)
// ---------------------------------------------------------------------------

/** A representative {@link NormalizedEvent} for each turn-lifecycle type. */
function sampleEventOfType(type: NormalizedEvent['type']): NormalizedEvent {
	switch (type) {
		case 'assistant.textDelta':
			return { type, content: 'Hello' };
		case 'assistant.thinking':
			return { type, content: 'reasoning…' };
		case 'tool.start':
			return { type, toolCallId: 'tc1', toolName: 'Bash', input: { command: 'ls' } };
		case 'tool.complete':
			return { type, toolCallId: 'tc1', toolName: 'Bash' };
		case 'tool.terminal':
			return { type, toolCallId: 'tc2', toolName: 'Bash', command: 'ls -la', output: 'a\nb' };
		case 'tool.simple':
			return { type, toolCallId: 'tc3', toolName: 'Glob', description: 'Searching files' };
		case 'tool.subagent':
			return { type, toolCallId: 'tc4', toolName: 'Agent', agentDisplayName: 'Agent' };
		case 'edit':
			return { type, toolCallId: 'tc5', uris: [], editId: 'e1' };
		case 'usage':
			return { type, inputTokens: 10, outputTokens: 20 };
		case 'title':
			return { type, title: 'My session' };
		default:
			throw new Error(`sampleEventOfType: ${type} is not part of the turn lifecycle`);
	}
}

/**
 * A pass-through normalizer that emits each scripted raw event verbatim, but
 * buffers the turn-final `title` and only releases it on {@link IEventNormalizer.flush}.
 * Buffering proves the recorder drains the emitter at the turn boundary.
 */
function makeLifecycleNormalizer(providerId: AgentCliProviderId): IEventNormalizer<NormalizedEvent> {
	let bufferedTitle: NormalizedEvent | undefined;
	return {
		providerId,
		normalize(event) {
			if (event.type === 'title') {
				bufferedTitle = event;
				return [];
			}
			return [event];
		},
		flush() {
			if (!bufferedTitle) {
				return [];
			}
			const out = [bufferedTitle];
			bufferedTitle = undefined;
			return out;
		},
	};
}

describe('registered provider emits the normalized turn-lifecycle vocabulary (AC-P0.5)', () => {
	it('records every turn-lifecycle event a registered provider emits through its normalizer', () => {
		// A registered provider.
		const registry = new AgentCliProviderRegistry();
		registry.registerDescriptor(makeDescriptor('claude'));
		const descriptor = registry.getDescriptor('claude');
		expect(descriptor).toBeDefined();

		// Its adapter pairs the descriptor with its event normalizer (the emitter).
		const adapter: IAgentCliAdapter<NormalizedEvent> = {
			descriptor: descriptor!,
			normalizer: makeLifecycleNormalizer('claude'),
		};
		expect(adapter.normalizer.providerId).toBe(descriptor!.id);

		// Drive a full turn and record what the emitter produces.
		const rawTurn = turnLifecycleEventTypes.map(sampleEventOfType);
		const recorded = recordNormalizedEvents(adapter.normalizer, rawTurn);

		// Every recorded event is part of the normalized vocabulary.
		for (const ev of recorded) {
			expect(normalizedEventTypes).toContain(ev.type);
		}

		// The recording covers the turn-lifecycle vocabulary, in order — and the
		// turn-final `title` only appears because flush() was drained.
		expect(recorded.map(e => e.type)).toEqual([...turnLifecycleEventTypes]);
		expect(recorded.at(-1)?.type).toBe('title');
	});

	it('turn-lifecycle vocabulary is a strict subset of the normalized vocabulary', () => {
		for (const type of turnLifecycleEventTypes) {
			expect(normalizedEventTypes).toContain(type);
		}
		// The out-of-band events are intentionally excluded from the lifecycle.
		expect(turnLifecycleEventTypes).not.toContain('permission.requested');
		expect(turnLifecycleEventTypes).not.toContain('error');
		expect(turnLifecycleEventTypes.length).toBeLessThan(normalizedEventTypes.length);
	});

	it('recordNormalizedEvents drains buffered tail events via flush()', () => {
		// A normalizer that emits nothing until flush proves the recorder calls flush().
		const normalizer: IEventNormalizer<NormalizedEvent> = {
			providerId: 'claude',
			normalize: () => [],
			flush: () => [sampleEventOfType('title')],
		};
		const recorded = recordNormalizedEvents(normalizer, [sampleEventOfType('assistant.textDelta')]);
		expect(recorded).toHaveLength(1);
		expect(recorded[0].type).toBe('title');
	});
});
