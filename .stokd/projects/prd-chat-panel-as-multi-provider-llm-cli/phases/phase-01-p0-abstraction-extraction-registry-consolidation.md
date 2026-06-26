# Phase 1: P0 — Abstraction extraction + registry consolidation

**Project:** PRD: Chat Panel as Multi-Provider LLM CLI Surface
**Slug:** prd-chat-panel-as-multi-provider-llm-cli
**Review Mode:** complete

## Work Items

### 1.1: Resolve DN-2 host layer for the abstraction

**Implementation Details**

Decide and record that the Agent CLI Provider abstraction is hosted on the platform agentHost registry (the only layer with live setPendingMessages steering, sandbox, and server/remote parity). Any provider needing true mid-flight steering must live in agentHost. Resolve before coding P0.

**Acceptance Criteria**

- DN-2 decision recorded as ACCEPT (host on platform agentHost agentService); documented as a prerequisite for all P0 coding.

### 1.2: Define IAgentCliProviderDescriptor and EventNormalizer vocabulary

**Dependencies:** 1.1

**Implementation Details**

Define the declarative provider descriptor (id, displayName, family, icon, hostLayer, transport, auth, sessionStore, models, billing?, permissionModes, capabilities, security, enabledSettingId) and the normalized EventNormalizer event vocabulary (assistant.textDelta, assistant.thinking, tool.start/complete, tool.terminal, tool.simple, tool.subagent, edit, permission.requested, usage/title/error). Adapter contract implements IAgent verbs plus an EventNormalizer.

**Acceptance Criteria**

- Descriptor and normalized event vocabulary defined; renderer (chatListRenderer.ts) unchanged (NG1); one renderer, four normalizers.

### 1.3: Build fork-owned provider registry mapped onto platform agentService

**Dependencies:** 1.2

**Implementation Details**

Create a fork-owned Agent CLI Provider registry that maps descriptors onto the existing platform agentService.registerProvider seam. Extract a shared base for the per-type registration that copilotcli/claude-code hand-copy, retiring the hand-copied extension DI blocks over time.

**Acceptance Criteria**

- Registry exists and maps descriptors onto registerProvider; shared registration base extracted.

### 1.4: Redirect upstream agentSessions.ts switches/enum to the registry

**Dependencies:** 1.3

**Implementation Details**

Redirect all upstream switches to read from the fork-owned registry: AgentSessionProviders enum, isBuiltInAgentSessionProvider, getAgentSessionProvider, getAgentSessionProviderName, getAgentSessionProviderIcon, isFirstPartyAgentSessionProvider, getAgentCanContinueIn. Also redirect SessionType in chatSessionsService.ts and the per-provider CommandsRegistry.registerCommand block in chat.contribution.ts. Keep the diff minimal (highest rebase risk).

**Acceptance Criteria**

- AC-P0.2 — A no-op test provider via mockAgent appears in the SESSIONS list and the session-type picker with a proper name, fork-registered icon, and family filter, without editing any upstream enum/switch after P0.

### 1.5: Generate per-provider enable config keys and commands from descriptor

**Dependencies:** 1.3

**Implementation Details**

Generate per-provider enable config keys (replacing hand-written AgentHostClaudeAgentEnabledSettingId / AgentHostCodexAgentEnabledSettingId constants) and auto-generated commands from descriptor.enabledSettingId, following the existing chat.agentHost.<provider>Agent.enabled env+setting pattern (default-OFF kill switch).

**Acceptance Criteria**

- Enable config keys and commands generated from the descriptor; new providers ship default-OFF.

### 1.6: Generalize model picker and promote permission-mode methods

**Dependencies:** 1.3

**Implementation Details**

Generalize DEFAULT_MODEL_PICKER_OPTIONS so non-GitHub providers are not forced into 'Auto'; modelPicker.ts reads provider.getModels/getModelPickerOptions reactively. Promote getPermissionModes(sessionId)/setPermissionMode onto ISessionsProvider so the composer renders one generic picker driven by provider-declared modes, replacing duplicated Claude pickers.

**Acceptance Criteria**

- Generalized model picker scoping and a single generic permission-mode picker driven by provider-declared modes; no Claude-specific picker required.

### 1.7: Fork-register Gemini/Grok codicons

**Dependencies:** 1.4

**Implementation Details**

No Codicon.gemini/Codicon.grok exist (only claude/openai/copilot). Fork-register codicons for per-family iconography so getAgentSessionProviderIcon resolves an icon for non-enum providers. This is a hard P0 dependency.

**Acceptance Criteria**

- R7.1.3 — Per-family iconography resolves for Gemini/Grok via fork-registered codicons; non-enum providers show a proper icon, not a blank.

### 1.8: Re-register Claude and Copilot CLI through the registry with no behavior change

**Dependencies:** 1.3, 1.4, 1.5, 1.6

**Implementation Details**

Re-register Claude and Copilot CLI through the registry/descriptor with no behavior change.

**Acceptance Criteria**

- AC-P0.1 — Golden snapshot of session list plus a replayed session is byte-identical; valid-layers-check passes (AC-P0.3); the new SEAM_MANIFEST records every redirected upstream switch/file.

### 1.9: Enforce security descriptor and normalized telemetry in the registry

**Dependencies:** 1.3

**Implementation Details**

Carry IAgentSecurityDescriptor on the descriptor; add a registry consistency test rejecting a provider with a non-loopback bind policy or missing auth scheme. Ensure a registered provider emits the normalized turn-lifecycle vocabulary through the existing emitters.

**Acceptance Criteria**

- AC-P0.4 — registry consistency test rejects non-loopback bind or missing auth scheme. AC-P0.5 — a registered provider emits the normalized turn-lifecycle vocabulary, verified by a recorded-event test.

