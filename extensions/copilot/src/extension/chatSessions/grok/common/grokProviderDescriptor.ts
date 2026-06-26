/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Grok provider descriptor for the multi-provider LLM CLI chat panel.
 *
 * Pure-data descriptor (no runtime state) registered with the
 * {@link AgentCliProviderRegistry}. It drives UI display, adapter routing,
 * capability negotiation, and the per-provider enablement gate.
 *
 * Design decisions encoded here (pinned against grok 0.2.51 — see
 * `node/grok/GROK-DISCOVERY-GATE.md`):
 *  - **DN-2** — Grok is hosted in the `agentHost` platform layer
 *    (`hostLayer: 'agentHost'`) and spawns the grok CLI child process
 *    (`transport: 'process'`), spawn-per-turn.
 *  - **DN-3** — models are sourced dynamically by reusing a BYOK Grok
 *    `LanguageModelChatProvider` scoped via `targetChatSessionType`
 *    (`models: 'dynamic'`); see {@link GROK_SESSION_TYPE}.
 *  - **DN-5** — steering is **emulated** (abort the in-flight spawn and resume
 *    via `grok -r <session-id>`), not native injection; `capabilities.steering`
 *    is `true` strictly as emulated abort-and-resume.
 *  - **DN-4** — shell security is *default-deny*: `permissionPrompts: true` and
 *    the default permission mode confirms every command (the enforcement lives
 *    with the spawn adapter, work item 4.3).
 */

import {
	providerEnabledSettingId,
	type AgentCliProviderId,
	type IAgentCliAdapter,
	type IAgentCliProviderDescriptor,
} from '../../common/agentCliProvider';
import { GROK_DECLARED_PERMISSION_MODES } from './grokPermissionModes';
import { GrokEventNormalizer } from './grokStreamingEvents';
import type { GrokStreamRecord } from './grokStreamTypes';

// ---- Identity & pin constants -------------------------------------------

/** Stable provider id for the Grok provider. */
export const GROK_PROVIDER_ID: AgentCliProviderId = 'grok';

/**
 * The grok CLI version the on-disk layout, headless/resume flags, and stream
 * shapes are pinned to (discovery gate, build `f4f85a6492e`). Bumping this
 * requires re-running the discovery gate (`GROK-DISCOVERY-GATE.md`).
 */
export const GROK_CLI_PINNED_VERSION = '0.2.51';

/** Headless single-turn flag — `grok -p/--single <PROMPT>` (prints + exits). */
export const GROK_HEADLESS_SINGLE_FLAG = '-p';

/** Headless output-format flag — `--output-format <plain|json|streaming-json>`. */
export const GROK_OUTPUT_FORMAT_FLAG = '--output-format';

/** Resume flag — `grok -r/--resume [<SESSION_ID>]` (keyed by the on-disk uuid). */
export const GROK_RESUME_FLAG = '-r';

/** The structured, steerable headless transport — `grok agent stdio`. */
export const GROK_AGENT_STDIO_SUBCOMMAND = 'agent stdio';

// ---- Descriptor ----------------------------------------------------------

export const grokProviderDescriptor: IAgentCliProviderDescriptor = {
	id: GROK_PROVIDER_ID,
	displayName: 'Grok',
	family: 'xai',
	hostLayer: 'agentHost',
	// Spawns the grok CLI (`grok agent stdio` / `-p`) per turn.
	transport: 'process',
	// Grok manages its own credentials; the spawned process is local, no RFC 9728
	// protected resource is fetched by the host.
	auth: { protectedResources: [] },
	// Grok owns the authoritative on-disk session tree and resumes by id (DN-5).
	sessionStore: 'sdk',
	// DN-3: BYOK Grok models, scoped via targetChatSessionType (GROK_SESSION_TYPE).
	models: 'dynamic',
	permissionModes: GROK_DECLARED_PERMISSION_MODES,
	capabilities: {
		// DN-5: emulated steering (abort the spawn + resume) — NOT native injection.
		steering: true,
		planMode: false,
		fleet: false,
		// Headless image input is not confirmed at this pin; conservatively off.
		imageAttachments: false,
		// grok emits `reasoning` records.
		thinking: true,
		subagents: false,
	},
	security: {
		bindPolicy: 'loopback',
		authScheme: 'apiKey',
		sandboxed: true,
		// DN-4: default-deny — confirm every shell command / file edit.
		permissionPrompts: true,
	},
	enabledSettingId: providerEnabledSettingId(GROK_PROVIDER_ID),
	// New provider: default-OFF kill switch.
	defaultEnabled: false,
};

// ---- Adapter -------------------------------------------------------------

/**
 * Build the Grok {@link IAgentCliAdapter}: the provider descriptor paired with
 * a fresh stream/replay normalizer (the normalizer is stateful per session, so
 * a new instance is returned on each call).
 */
export function createGrokAdapter(): IAgentCliAdapter<GrokStreamRecord> {
	return {
		descriptor: grokProviderDescriptor,
		normalizer: new GrokEventNormalizer(),
	};
}
