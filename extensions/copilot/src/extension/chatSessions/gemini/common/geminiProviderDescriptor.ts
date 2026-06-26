/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Gemini ACP provider descriptor for the multi-provider LLM CLI chat panel.
 *
 * Pure-data descriptor (no runtime state) registered with the
 * {@link AgentCliProviderRegistry}. It drives UI display, adapter routing,
 * capability negotiation, and the per-provider enablement gate.
 *
 * Design decisions encoded here:
 *  - **DN-2** — the Gemini agent is hosted in the `agentHost` platform layer
 *    (`hostLayer: 'agentHost'`) and spawns the gemini-cli child process
 *    (`transport: 'process'`).
 *  - **DN-3** — models are sourced dynamically by reusing the BYOK Gemini
 *    `LanguageModelChatProvider` scoped via `targetChatSessionType` (`models:
 *    'dynamic'`); see {@link GEMINI_SESSION_TYPE}.
 *  - **DN-4** — steering is **Tier 2 (emulated, ACP abort-and-replace)**, set
 *    from the live-vs-resume spike. `capabilities.steering` is `true` *as
 *    emulated cancel-and-replace*, which DN-4 explicitly permits. The agent's
 *    `setPendingMessages` issues a fresh `session/prompt` (which aborts the
 *    in-flight turn → `stopReason: "cancelled"`) rather than Claude-grade
 *    native injection. The live ACP transport additionally requires
 *    `gemini-api-key` / `vertex-ai` / `gateway` auth (`authScheme: 'apiKey'`);
 *    OAuth-personal-only environments fall back to SDK/headless.
 */

import {
	providerEnabledSettingId,
	type AgentCliProviderId,
	type IAgentCliAdapter,
	type IAgentCliProviderDescriptor,
} from '../../common/agentCliProvider';
import { GeminiAcpEventNormalizer } from './geminiAcpEvents';
import type { GeminiAcpSessionUpdate } from './geminiAcpTypes';
import { GEMINI_DECLARED_PERMISSION_MODES } from './geminiPermissionModes';

// ---- Identity & pin constants -------------------------------------------

/** Stable provider id for the Gemini ACP provider. */
export const GEMINI_PROVIDER_ID: AgentCliProviderId = 'gemini';

/**
 * The gemini-cli version the steering tier (DN-4) and the ACP wire shapes
 * ({@link GeminiAcpSessionUpdate}) are pinned to. Bumping this requires
 * re-running the live-vs-resume spike (see `ACP-STEERING-SPIKE.md`).
 */
export const GEMINI_CLI_PINNED_VERSION = '0.47.0';

/** The flag that starts gemini-cli in ACP mode (`gemini --acp`). */
export const GEMINI_ACP_FLAG = '--acp';

/**
 * Deprecated alias for {@link GEMINI_ACP_FLAG}, retained only for pins older
 * than the `--acp` rename (still live on 0.47.0).
 */
export const GEMINI_ACP_DEPRECATED_FLAG = '--experimental-acp';

/** The ACP protocol version negotiated in the `initialize` handshake. */
export const GEMINI_ACP_PROTOCOL_VERSION = 1;

// ---- Descriptor ----------------------------------------------------------

export const geminiProviderDescriptor: IAgentCliProviderDescriptor = {
	id: GEMINI_PROVIDER_ID,
	displayName: 'Gemini CLI',
	family: 'google',
	hostLayer: 'agentHost',
	// Spawns `gemini --acp` and speaks newline-delimited JSON-RPC over stdio.
	transport: 'process',
	// The live ACP path authenticates with a Gemini API key / Vertex / gateway
	// credential (DN-4 auth gate); there is no RFC 9728 protected resource.
	auth: { protectedResources: [] },
	// ACP advertises loadSession: true — session history is owned by the agent.
	sessionStore: 'sdk',
	// DN-3: BYOK Gemini models, scoped via targetChatSessionType.
	models: 'dynamic',
	permissionModes: GEMINI_DECLARED_PERMISSION_MODES,
	capabilities: {
		// DN-4: emulated steering (Tier 2, abort-and-replace) — NOT native injection.
		// `true` here is "emulated cancel-and-replace"; the machine-readable label and the
		// abort-and-replace primitive live in `./geminiSteering` (GEMINI_STEERING, verified
		// in test/geminiSteering.spec.ts) so this boolean is never mistaken for Tier-1 injection.
		steering: true,
		planMode: false,
		fleet: false,
		// initialize → promptCapabilities.image: true
		imageAttachments: true,
		// agent_thought_chunk session updates
		thinking: true,
		subagents: false,
	},
	security: {
		bindPolicy: 'loopback',
		authScheme: 'apiKey',
		sandboxed: true,
		permissionPrompts: true,
	},
	enabledSettingId: providerEnabledSettingId(GEMINI_PROVIDER_ID),
	// New provider: default-OFF kill switch.
	defaultEnabled: false,
};

// ---- Adapter -------------------------------------------------------------

/**
 * Build the Gemini {@link IAgentCliAdapter}: the provider descriptor paired
 * with a fresh ACP event normalizer (the normalizer is stateful per session,
 * so a new instance is returned on each call).
 */
export function createGeminiAdapter(): IAgentCliAdapter<GeminiAcpSessionUpdate> {
	return {
		descriptor: geminiProviderDescriptor,
		normalizer: new GeminiAcpEventNormalizer(),
	};
}
