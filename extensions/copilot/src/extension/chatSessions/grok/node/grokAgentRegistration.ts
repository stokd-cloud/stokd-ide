/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Grok node adapter registration — the extension-layer binding point for the
 * Grok provider's node-specific IAgent implementation
 * (`src/vs/platform/agentHost/node/grok/grokAgent.ts`).
 *
 * This module is the single source of truth for the Grok provider id on the
 * extension side. It re-exports the canonical provider id and descriptor from
 * the common layer so extension contributions (chat-session picker, default
 * launch surface, model-catalog scoping) can key off `GROK_AGENT_REGISTRATION`
 * without importing from the platform layer.
 *
 * @see GROK_PROVIDER_ID — the stable id string `'grok'`
 * @see grokProviderDescriptor — the declarative descriptor used by the registry
 */

import {
	GROK_PROVIDER_ID,
	grokProviderDescriptor,
} from '../common/grokProviderDescriptor';

// ---- Registration shape -----------------------------------------------------

/**
 * The structural type of {@link GROK_AGENT_REGISTRATION}.
 *
 * Kept structural (not imported from the platform layer) so the extension and
 * platform layers remain decoupled: the extension only needs to publish a
 * `providerId` and `descriptor`; the platform layer's `grokAgent.ts` reads
 * `id` off the same {@link grokProviderDescriptor} directly.
 */
export interface IGrokAgentRegistration {
	/** The stable provider id — always `'grok'`. */
	readonly providerId: typeof GROK_PROVIDER_ID;
	/** The declarative descriptor for the Grok provider. */
	readonly descriptor: typeof grokProviderDescriptor;
}

// ---- Exported constant -------------------------------------------------------

/**
 * Grok node adapter registration constant.
 *
 * Exported as a named constant (not a class/factory) because the registration
 * is pure static data — there is no runtime state here. The `IAgent`
 * implementation lives in `src/vs/platform/agentHost/node/grok/grokAgent.ts`
 * and is instantiated by the agent host process; this constant is only the
 * extension-side declaration that the `'grok'` provider exists and what its
 * descriptor is.
 */
export const GROK_AGENT_REGISTRATION: IGrokAgentRegistration = {
	providerId: GROK_PROVIDER_ID,
	descriptor: grokProviderDescriptor,
};
