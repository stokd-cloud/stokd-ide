/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Multi-provider LLM CLI chat panel — provider descriptor and normalized event vocabulary.
 *
 * Design goals:
 *  - ONE renderer (chatListRenderer.ts) consumes {@link NormalizedEvent}s.
 *  - Each provider ships exactly ONE {@link IEventNormalizer} that translates
 *    provider-specific SDK events into the normalized vocabulary.
 *  - The renderer is never modified when a new provider is added.
 *
 * Intended provider normalizers (one per provider):
 *  1. Claude Code normalizer  (`claude/`)
 *  2. Copilot CLI normalizer  (`copilotcli/`)
 *  3. Codex normalizer        (`codex/`)
 *  4. (future) additional providers
 */

import { URI } from '../../../util/vs/base/common/uri';

// ---- Provider identity ---------------------------------------------------

/**
 * Stable identifier for a provider (e.g. `'claude'`, `'copilotcli'`, `'codex'`).
 * Use a string-literal union so callers get autocomplete while remaining open
 * for extension via `(string & {})`.
 */
export type AgentCliProviderId = 'claude' | 'copilotcli' | 'codex' | (string & {});

/**
 * Derive the VS Code setting id that gates a provider from its stable id.
 *
 * Formula: `chat.agentHost.${id}Agent.enabled`
 *
 * Examples:
 *  - `providerEnabledSettingId('claude')` → `'chat.agentHost.claudeAgent.enabled'`
 *  - `providerEnabledSettingId('codex')`  → `'chat.agentHost.codexAgent.enabled'`
 *
 * Use this instead of hand-writing provider-specific constants so that a new
 * provider only needs to specify its `id` and gets the correct setting id for
 * free.
 */
export function providerEnabledSettingId(id: AgentCliProviderId): string {
	return `chat.agentHost.${id}Agent.enabled`;
}

/**
 * Vendor family — used for grouping, branding, and auth routing.
 */
export type AgentCliProviderFamily = 'anthropic' | 'github' | 'openai' | (string & {});

// ---- Host / transport ---------------------------------------------------

/**
 * Process layer where the adapter executes.
 *
 * - `'agentHost'`: runs in the dedicated agent host utility process (required for
 *   mid-flight steering and sandbox isolation — see DESIGN-DECISIONS.md DN-2).
 * - `'extensionHost'`: runs in the shared extension host process (non-steering
 *   providers only).
 */
export type AgentCliHostLayer = 'agentHost' | 'extensionHost';

/**
 * Communication channel between the adapter and the backing CLI.
 *
 * - `'sdk'`: uses the provider's TypeScript SDK directly (in-process).
 * - `'process'`: spawns a child process and communicates via stdio/IPC.
 * - `'ipc'`: connects over an existing IPC channel (e.g. already-running server).
 */
export type AgentCliTransport = 'sdk' | 'process' | 'ipc';

// ---- Session persistence -------------------------------------------------

/**
 * Session persistence strategy.
 *
 * - `'sdk'`: delegate persistence to the backing SDK (e.g. Claude session DB,
 *   Copilot `events.jsonl`).
 * - `'none'`: in-memory only; no disk persistence.
 */
export type AgentCliSessionStoreKind = 'sdk' | 'none';

// ---- Permission modes ---------------------------------------------------

/**
 * Permission mode as understood by the chat panel.
 *
 * Providers declare which subset they support via
 * {@link IAgentCliProviderDescriptor.permissionModes}.
 */
export type AgentCliPermissionMode =
	| 'default'
	| 'acceptEdits'
	| 'bypassPermissions'
	| 'plan'
	| 'dontAsk'
	| 'auto'
	| 'interactive'
	| 'autopilot';

// ---- Auth ---------------------------------------------------------------

/**
 * Auth requirements for a provider.
 */
export interface IAgentCliAuthConfig {
	/**
	 * RFC 9728 protected-resource URI(s) that must be resolved before the
	 * provider can start a session. The auth broker resolves tokens for each
	 * and passes them to the adapter at session start.
	 */
	readonly protectedResources: readonly string[];
}

// ---- Models and billing -------------------------------------------------

/**
 * Static model descriptor for a provider model.
 */
export interface IAgentCliModelDescriptor {
	/** Stable model identifier (e.g. `'claude-sonnet-4-6'`). */
	readonly id: string;
	/** Human-readable display name (e.g. `'Claude Sonnet 4.6'`). */
	readonly displayName: string;
	/** Maximum context length in tokens, if known. */
	readonly contextLength?: number;
	/** Whether this model supports image inputs. */
	readonly supportsVision?: boolean;
}

/**
 * Optional billing metadata for the provider / model combination.
 */
export interface IAgentCliBillingDescriptor {
	/**
	 * Billing multiplier relative to a baseline (e.g. `1.0` = standard rate,
	 * `2.0` = twice the base rate). Used for display purposes only.
	 */
	readonly multiplier?: number;
}

// ---- Capabilities -------------------------------------------------------

/**
 * Capability flags for a provider. The renderer uses these to show/hide
 * relevant UI controls (e.g. the plan-mode chip, the fleet button).
 */
export interface IAgentCliCapabilities {
	/** Provider supports mid-flight message steering (`setPendingMessages`). */
	readonly steering: boolean;
	/** Provider supports plan mode (generate-plan-then-execute). */
	readonly planMode: boolean;
	/** Provider supports fleet / parallel execution. */
	readonly fleet: boolean;
	/** Provider supports image attachments in prompts. */
	readonly imageAttachments: boolean;
	/** Provider surfaces thinking / reasoning content. */
	readonly thinking: boolean;
	/** Provider supports custom subagent / task delegation. */
	readonly subagents: boolean;
}

// ---- Security -----------------------------------------------------------

/**
 * Network bind policy for the provider's agent-host transport.
 *
 * The agent host exposes its provider transports only on the local loopback
 * interface — every provider in this abstraction MUST declare `'loopback'`.
 * The other members exist solely to model the postures the registry
 * consistency check ({@link validateSecurityDescriptor}) rejects:
 *
 *  - `'loopback'` — bind to `127.0.0.1` / `::1` only. The single allowed value.
 *  - `'lan'`      — bind to a private LAN interface (routable on the subnet).
 *  - `'any'`      — bind to all interfaces (`0.0.0.0`), publicly reachable.
 *
 * Open for extension via `(string & {})` so a provider can name a more
 * specific posture; any value other than `'loopback'` is rejected.
 */
export type AgentCliBindPolicy = 'loopback' | 'lan' | 'any' | (string & {});

/**
 * Authentication scheme a provider uses to obtain credentials for its backing
 * CLI / API. Used by the auth broker for routing and by the registry
 * consistency check, which requires every provider to declare a non-empty
 * scheme (a "missing" scheme would mean the transport accepts unauthenticated
 * callers).
 *
 *  - `'bearer'` — RFC 6750 bearer token (e.g. the GitHub Copilot token).
 *  - `'oauth'`  — full OAuth 2.0 authorization-code flow.
 *  - `'apiKey'` — a static provider-issued API key.
 *
 * Open for extension via `(string & {})`; the check only requires that the
 * declared value is a non-empty string.
 */
export type AgentCliAuthScheme = 'bearer' | 'oauth' | 'apiKey' | (string & {});

/**
 * Security posture and constraints for a provider — the canonical security
 * descriptor carried on every {@link IAgentCliProviderDescriptor}.
 *
 * Spans two concerns:
 *  - **Transport/network** — {@link bindPolicy} and {@link authScheme}, enforced
 *    by the registry consistency check ({@link validateSecurityDescriptor}).
 *  - **Runtime execution** — {@link sandboxed} and {@link permissionPrompts},
 *    consumed by the renderer to gate UI affordances.
 */
export interface IAgentSecurityDescriptor {
	/**
	 * Network interface the provider's transport is permitted to bind. MUST be
	 * `'loopback'`; any other value is rejected by the registry consistency
	 * check so a provider can never expose its transport on a routable
	 * interface.
	 */
	readonly bindPolicy: AgentCliBindPolicy;
	/**
	 * Auth scheme used to obtain credentials for this provider. MUST be a
	 * non-empty scheme; the registry consistency check rejects an absent or
	 * blank value as a "missing auth scheme".
	 */
	readonly authScheme: AgentCliAuthScheme;
	/**
	 * Whether the provider runs inside the agent-host sandbox.
	 * Providers that run in `extensionHost` cannot be sandboxed.
	 */
	readonly sandboxed: boolean;
	/**
	 * Whether the provider surfaces per-operation permission prompts
	 * (file read/write/shell confirmations before execution).
	 */
	readonly permissionPrompts: boolean;
}

// ---- Provider descriptor ------------------------------------------------

/**
 * Declarative descriptor for a multi-provider LLM CLI chat panel provider.
 *
 * Descriptors are pure data — no runtime state, no methods. A single
 * descriptor is registered per provider and drives:
 *  - UI display (name, icon, family branding)
 *  - Adapter registration and routing
 *  - Session config schema generation
 *  - Capability negotiation with the renderer
 *
 * @example
 * ```ts
 * export const claudeProviderDescriptor: IAgentCliProviderDescriptor = {
 *   id: 'claude',
 *   displayName: 'Claude Code',
 *   family: 'anthropic',
 *   hostLayer: 'agentHost',
 *   transport: 'sdk',
 *   auth: { protectedResources: ['https://api.github.com'] },
 *   sessionStore: 'sdk',
 *   models: 'dynamic',
 *   permissionModes: ['default', 'acceptEdits', 'bypassPermissions', 'plan', 'auto'],
 *   capabilities: { steering: true, planMode: true, fleet: false, imageAttachments: true, thinking: true, subagents: true },
 *   security: { bindPolicy: 'loopback', authScheme: 'bearer', sandboxed: true, permissionPrompts: true },
 *   enabledSettingId: 'chat.agentHost.claudeAgent.enabled',
 * };
 * ```
 */
export interface IAgentCliProviderDescriptor {
	/** Stable identifier for this provider (e.g. `'claude'`, `'copilotcli'`). */
	readonly id: AgentCliProviderId;
	/** Human-readable display name shown in the chat panel picker. */
	readonly displayName: string;
	/** Vendor family — used for grouping and branding. */
	readonly family: AgentCliProviderFamily;
	/** URI to a monochrome icon for use in the picker and session header. */
	readonly icon?: URI;
	/** Process layer where the adapter executes. */
	readonly hostLayer: AgentCliHostLayer;
	/** Transport mechanism used to talk to the backing CLI. */
	readonly transport: AgentCliTransport;
	/** Auth requirements for this provider. */
	readonly auth: IAgentCliAuthConfig;
	/** Session persistence strategy. */
	readonly sessionStore: AgentCliSessionStoreKind;
	/**
	 * Static model catalog, or `'dynamic'` when the provider fetches available
	 * models at runtime (e.g. from a capabilities endpoint).
	 */
	readonly models: readonly IAgentCliModelDescriptor[] | 'dynamic';
	/** Optional billing metadata for the provider. */
	readonly billing?: IAgentCliBillingDescriptor;
	/**
	 * Permission modes this provider supports. The renderer uses this list
	 * to render only the applicable mode chips in the session options bar.
	 */
	readonly permissionModes: readonly AgentCliPermissionMode[];
	/** Capability flags. */
	readonly capabilities: IAgentCliCapabilities;
	/** Security posture and constraints — bind policy, auth scheme, sandbox, prompts. */
	readonly security: IAgentSecurityDescriptor;
	/**
	 * VS Code setting id that gates this provider (e.g.
	 * `'chat.agentHost.claudeAgent.enabled'`). When the setting is `false`
	 * the provider registration is skipped entirely.
	 *
	 * Use {@link providerEnabledSettingId} to derive this from the provider id
	 * rather than writing the string by hand.
	 */
	readonly enabledSettingId: string;
	/**
	 * Whether this provider is registered by default when no explicit setting
	 * value is configured. New providers **must** ship with `false` (default-OFF
	 * kill switch); existing providers like Claude may use `true` for backward
	 * compatibility.
	 *
	 * The config contribution reads this field to populate the `default:` value
	 * in the generated VS Code setting schema, so users see the correct default
	 * in the Settings UI without needing an explicit `settings.json` entry.
	 */
	readonly defaultEnabled: boolean;
}

// =========================================================================
// Normalized event vocabulary
// =========================================================================

// ---- Individual event types ---------------------------------------------

/**
 * Streaming text fragment from the assistant.
 */
export interface NormalizedAssistantTextDelta {
	readonly type: 'assistant.textDelta';
	readonly content: string;
	/** SDK-level message id, used to suppress duplicate non-delta delivery. */
	readonly messageId?: string;
	/** Parent tool call id, if this delta is nested inside a subagent turn. */
	readonly parentToolCallId?: string;
}

/**
 * Thinking / reasoning content from the assistant (extended-thinking models).
 */
export interface NormalizedAssistantThinking {
	readonly type: 'assistant.thinking';
	readonly content: string;
	/** Tool call id of the tool that triggered the thinking block, if any. */
	readonly toolCallId?: string;
}

/**
 * A tool invocation has begun.
 */
export interface NormalizedToolStart {
	readonly type: 'tool.start';
	readonly toolCallId: string;
	readonly toolName: string;
	/** Raw input object forwarded verbatim to the formatter. */
	readonly input: Record<string, unknown>;
	/** Tool call id of the parent (for nested subagent tool calls). */
	readonly parentToolCallId?: string;
}

/**
 * A tool invocation has completed.
 */
export interface NormalizedToolComplete {
	readonly type: 'tool.complete';
	readonly toolCallId: string;
	readonly toolName: string;
	/** Opaque result from the tool (provider-specific). */
	readonly result?: unknown;
	/** Whether the tool execution produced an error. */
	readonly isError?: boolean;
}

/**
 * A terminal / shell tool produced visible output.
 */
export interface NormalizedToolTerminal {
	readonly type: 'tool.terminal';
	readonly toolCallId: string;
	readonly toolName: string;
	/** The shell command that was executed. */
	readonly command: string;
	/** Truncated visible output for display in the chat panel. */
	readonly output?: string;
}

/**
 * A simple, non-edit, non-terminal, non-subagent tool invocation
 * (e.g. file read, web search, glob, grep).
 */
export interface NormalizedToolSimple {
	readonly type: 'tool.simple';
	readonly toolCallId: string;
	readonly toolName: string;
	/** Brief human-readable description of what the tool is doing. */
	readonly description: string;
	/** Optional detail (e.g. path for a file read, query for a search). */
	readonly detail?: string;
}

/**
 * A subagent / task-delegation tool was invoked.
 */
export interface NormalizedToolSubagent {
	readonly type: 'tool.subagent';
	readonly toolCallId: string;
	readonly toolName: string;
	/** Display name of the subagent (e.g. `'Agent'` or a custom name). */
	readonly agentDisplayName?: string;
	/** Optional description of what the subagent is doing. */
	readonly agentDescription?: string;
}

/**
 * A file edit was produced by a tool invocation.
 */
export interface NormalizedEdit {
	readonly type: 'edit';
	readonly toolCallId: string;
	/** URIs of files modified by the tool. */
	readonly uris: readonly URI[];
	/** Edit id for `ChatResponseCodeblockUriPart` correlation. */
	readonly editId: string;
}

/**
 * The provider requires the user to confirm an operation before execution.
 */
export interface NormalizedPermissionRequested {
	readonly type: 'permission.requested';
	/** Provider-assigned request id, used to route the user's response back. */
	readonly requestId: string;
	/** Human-readable description of what is being requested. */
	readonly description: string;
	/** Semantic kind of the permission (e.g. `'shell'`, `'read'`, `'write'`, `'mcp'`). */
	readonly kind: string;
	/** Tool call id that triggered this permission request, if any. */
	readonly toolCallId?: string;
}

/**
 * Token usage stats for the current turn.
 */
export interface NormalizedUsage {
	readonly type: 'usage';
	readonly inputTokens?: number;
	readonly outputTokens?: number;
	readonly cacheReadTokens?: number;
	readonly cacheCreationTokens?: number;
}

/**
 * The provider has computed or updated a session title.
 */
export interface NormalizedTitle {
	readonly type: 'title';
	readonly title: string;
}

/**
 * A session-level error occurred.
 */
export interface NormalizedError {
	readonly type: 'error';
	readonly message: string;
	/** Provider-specific error type / code. */
	readonly errorType?: string;
}

// ---- Discriminated union ------------------------------------------------

/**
 * Discriminated union of all normalized events emitted by an
 * {@link IEventNormalizer}. The chat panel renderer consumes exactly
 * this vocabulary — providers never modify the renderer.
 *
 * Event types:
 *  - `assistant.textDelta`    — streaming assistant text fragment
 *  - `assistant.thinking`     — thinking / reasoning block
 *  - `tool.start`             — tool invocation began
 *  - `tool.complete`          — tool invocation finished
 *  - `tool.terminal`          — shell/terminal tool output
 *  - `tool.simple`            — simple read/search/etc. tool
 *  - `tool.subagent`          — subagent / task delegation
 *  - `edit`                   — file edit produced by a tool
 *  - `permission.requested`   — user confirmation required
 *  - `usage`                  — token usage statistics
 *  - `title`                  — session title update
 *  - `error`                  — session-level error
 */
export type NormalizedEvent =
	| NormalizedAssistantTextDelta
	| NormalizedAssistantThinking
	| NormalizedToolStart
	| NormalizedToolComplete
	| NormalizedToolTerminal
	| NormalizedToolSimple
	| NormalizedToolSubagent
	| NormalizedEdit
	| NormalizedPermissionRequested
	| NormalizedUsage
	| NormalizedTitle
	| NormalizedError;

/**
 * All valid `type` discriminants for {@link NormalizedEvent}, in declaration order.
 * Exported as a runtime constant so tests and registries can enumerate them without
 * duplication.
 */
export const normalizedEventTypes: ReadonlyArray<NormalizedEvent['type']> = [
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
] as const;

/**
 * The ordered subset of {@link NormalizedEvent} types that make up a single
 * assistant turn's lifecycle — the events a provider emits, in their natural
 * progression, from the start of a turn through its completion:
 *
 *  text/thinking → tool start → tool detail (complete / terminal / simple /
 *  subagent) → edit → usage → title.
 *
 * Deliberately **excludes** the two out-of-band members of
 * {@link normalizedEventTypes} that are not part of the linear turn flow:
 *  - `permission.requested` — an interactive interruption that pauses the turn
 *    pending a user decision, rather than a step that advances it.
 *  - `error` — a terminal failure that aborts the turn instead of completing it.
 *
 * Every member is also a member of {@link normalizedEventTypes}; this constant
 * is the vocabulary a conforming provider's emitter is expected to produce for
 * a normal turn, and is asserted by the recorded-event test (AC-P0.5).
 */
export const turnLifecycleEventTypes: ReadonlyArray<NormalizedEvent['type']> = [
	'assistant.textDelta',
	'assistant.thinking',
	'tool.start',
	'tool.complete',
	'tool.terminal',
	'tool.simple',
	'tool.subagent',
	'edit',
	'usage',
	'title',
] as const;

// =========================================================================
// Normalizer and adapter contracts
// =========================================================================

/**
 * Normalizer contract: translates provider-specific raw events into zero or
 * more {@link NormalizedEvent}s that the shared renderer can consume.
 *
 * Each provider ships exactly one `IEventNormalizer` implementation. The
 * renderer is provider-agnostic and never needs to be modified when a new
 * provider is added.
 *
 * @typeParam TRawEvent - Provider-specific event type (e.g. `SessionEvent`
 * from `@github/copilot/sdk`, or `SDKAssistantMessage` from
 * `@anthropic-ai/claude-agent-sdk`).
 */
export interface IEventNormalizer<TRawEvent = unknown> {
	/** Provider this normalizer belongs to. */
	readonly providerId: AgentCliProviderId;

	/**
	 * Translate one raw event into zero or more normalized events.
	 *
	 * Implementations may buffer state internally (e.g. accumulate streaming
	 * text deltas) and emit the buffered result as part of a subsequent call
	 * or via {@link flush}.
	 */
	normalize(event: TRawEvent): readonly NormalizedEvent[];

	/**
	 * Flush any internally buffered state and return the resulting events.
	 *
	 * MUST be called at turn boundaries to ensure streamed text is committed
	 * before the turn is considered complete.
	 */
	flush(): readonly NormalizedEvent[];
}

/**
 * Drive a normalizer over a sequence of raw events and record every
 * {@link NormalizedEvent} it emits through the existing emitters —
 * {@link IEventNormalizer.normalize} for each raw event, then a single
 * trailing {@link IEventNormalizer.flush} at the turn boundary.
 *
 * This is the "recorded-event" primitive: the shared renderer consumes exactly
 * the sequence produced here, so a test can assert that a provider emits the
 * normalized turn-lifecycle vocabulary ({@link turnLifecycleEventTypes}) without
 * standing up the real renderer or agent host. Recording through both
 * `normalize()` and `flush()` ensures buffered tail events (e.g. a committed
 * streamed-text block, or a turn-final title) are captured.
 *
 * @typeParam TRawEvent - Provider-specific raw event type accepted by the normalizer.
 * @param normalizer - The provider's emitter.
 * @param rawEvents - The scripted raw turn, applied in order.
 * @returns The flat, ordered list of normalized events emitted across the turn.
 */
export function recordNormalizedEvents<TRawEvent>(
	normalizer: IEventNormalizer<TRawEvent>,
	rawEvents: Iterable<TRawEvent>,
): NormalizedEvent[] {
	const recorded: NormalizedEvent[] = [];
	for (const raw of rawEvents) {
		recorded.push(...normalizer.normalize(raw));
	}
	recorded.push(...normalizer.flush());
	return recorded;
}

/**
 * Adapter contract: the bridge between a provider's `IAgent` implementation
 * and the normalized event vocabulary understood by the renderer.
 *
 * An adapter:
 *  1. Owns an {@link IAgentCliProviderDescriptor} that describes the provider.
 *  2. Owns an {@link IEventNormalizer} that translates the provider's SDK events
 *     into {@link NormalizedEvent}s for the renderer.
 *
 * The adapter never talks directly to the renderer; it emits normalized events
 * via its normalizer, and the renderer subscribes to those events through the
 * agent host's `onDidSessionProgress` channel.
 *
 * @typeParam TRawEvent - Provider-specific event type, forwarded to the normalizer.
 */
export interface IAgentCliAdapter<TRawEvent = unknown> {
	/** Static descriptor for this provider. */
	readonly descriptor: IAgentCliProviderDescriptor;
	/** Normalizer owned by this adapter. */
	readonly normalizer: IEventNormalizer<TRawEvent>;
}
