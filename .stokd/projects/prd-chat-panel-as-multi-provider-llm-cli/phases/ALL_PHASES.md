# Complete Phase Review

**Project:** PRD: Chat Panel as Multi-Provider LLM CLI Surface
**Slug:** prd-chat-panel-as-multi-provider-llm-cli
**Generated:** 2026-06-25T14:43:49.369225+00:00

## Included Phases

- Phase 1: P0 — Abstraction extraction + registry consolidation (`phase-01-p0-abstraction-extraction-registry-consolidation.md`)
- Phase 2: P2 — Codex (validate the registry on in-tree code) (`phase-02-p2-codex-validate-the-registry-on-in-tree.md`)
- Phase 3: P1 — Gemini via ACP (proof of generalization; spike-gated) (`phase-03-p1-gemini-via-acp-proof-of-generalization-spike.md`)
- Phase 4: P3 — Grok (spawn-per-turn, emulated steering; discovery-gated) (`phase-04-p3-grok-spawn-per-turn-emulated-steering-discovery.md`)
- Phase 5: P5 — AWS Bedrock model access (BYOK; chat-first; parallelizable after P0) (`phase-05-p5-aws-bedrock-model-access-byok-chat-first.md`)
- Phase 6: P4 — Make chat the default for ALL providers; terminal becomes opt-in escape hatch (`phase-06-p4-make-chat-the-default-for-all-providers.md`)

---

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


---

# Phase 2: P2 — Codex (validate the registry on in-tree code)

**Project:** PRD: Chat Panel as Multi-Provider LLM CLI Surface
**Slug:** prd-chat-panel-as-multi-provider-llm-cli
**Review Mode:** complete

## Work Items

### 2.1: Resolve Codex model sourcing (DN-3 gate)

**Dependencies:** 1.8

**Implementation Details**

Resolve Codex model sourcing as a gate per DN-3: reuse existing BYOK LanguageModelChatProviders scoped via targetChatSessionType, with no new editor-proxy adapters.

**Acceptance Criteria**

- Codex model sourcing decision documented (BYOK reuse) before adapter work proceeds.

### 2.2: Bring codexAgent onto the P0 registry/descriptor

**Dependencies:** 1.8, 2.1

**Implementation Details**

Register codexAgent.ts via the P0 registry/descriptor; wire list/click/resume/steer/abort through the registry (createSession→thread/start, steer→turn/steer, abort→turn/interrupt, resume→thread/resume). Protocol regeneration via npm run codex:gen-protocol; generated types never hand-edited.

**Acceptance Criteria**

- AC-P2.1 — Codex list/click/resume/steer/abort all work via the registry.

### 2.3: Wire Codex history builder/tool formatter into normalized vocabulary

**Dependencies:** 2.2

**Implementation Details**

Wire Codex history builder and tool formatter into the shared normalized event vocabulary so Codex renders structured tool/thinking/text parts.

**Acceptance Criteria**

- AC-P2.2 — Codex renders structured tool/thinking/text parts through the shared normalizer.

### 2.4: Reconcile Codex across all agentSessions.ts switches

**Dependencies:** 2.2

**Implementation Details**

Reconcile the half-wired Codex across name/icon/family/first-party/continue-in switches so it appears consistently.

**Acceptance Criteria**

- AC-P2.3 — Codex appears consistently across name/icon/family/first-party/continue-in (the half-wiring is reconciled).

### 2.5: Codex pinned-version contract test

**Dependencies:** 2.2

**Implementation Details**

Add a pinned-version smoke test asserting Codex exec --json event schema and ~/.codex/sessions format; CI fails on drift.

**Acceptance Criteria**

- AC-P2.4 — pinned-version smoke test asserts exec --json event schema + ~/.codex/sessions format; CI fails on drift.


---

# Phase 3: P1 — Gemini via ACP (proof of generalization; spike-gated)

**Project:** PRD: Chat Panel as Multi-Provider LLM CLI Surface
**Slug:** prd-chat-panel-as-multi-provider-llm-cli
**Review Mode:** complete

## Work Items

### 3.1: ACP live-vs-resume spike gate

**Dependencies:** 1.8

**Implementation Details**

Build a throwaway ACP handshake against a pinned gemini-cli and confirm whether a second prompt mid-turn injects vs queues. If it queues, Gemini drops to emulated steering and/or falls back to SDK/headless. Pin the version (--acp vs --experimental-acp).

**Acceptance Criteria**

- AC-P1.0 — Documented result of the live-vs-resume spike against a pinned version; the steering tier is set from this evidence, not assumed.

### 3.2: Implement Gemini ACP adapter, descriptor, history builder/tool formatter

**Dependencies:** 3.1

**Implementation Details**

Implement the ACP adapter plus descriptor, history builder/tool formatter, model catalog via BYOK geminiNativeProvider.ts, and permission modes. Fallbacks: @google/gemini-cli-sdk or headless --output-format stream-json. Any ACP code-gen follows AX-REPO-VENDORED-AHP-PROTOCOL (never hand-edited).

**Acceptance Criteria**

- AC-P1.1 — A gemini --acp session appears, is clickable, replays full history with thinking/tool parts, and streams a live turn incrementally. AC-P1.3 — model picker shows only Gemini models; permission picker shows Gemini-declared modes.

### 3.3: Verify Gemini steering per spike result

**Dependencies:** 3.1, 3.2

**Implementation Details**

If AC-P1.0 confirms injection, verify mid-flight steering against the pinned version; otherwise label and verify emulated steering.

**Acceptance Criteria**

- AC-P1.2 — If spike confirms injection: mid-flight steering verified; otherwise emulated steering labeled and verified.

### 3.4: Gemini normalized telemetry recorded-event test

**Dependencies:** 3.2

**Implementation Details**

Verify a Gemini turn emits the same normalized turn-lifecycle events as Claude.

**Acceptance Criteria**

- AC-P1.4 — A Gemini turn emits the same normalized turn-lifecycle events as Claude, verified by a recorded-event test.


---

# Phase 4: P3 — Grok (spawn-per-turn, emulated steering; discovery-gated)

**Project:** PRD: Chat Panel as Multi-Provider LLM CLI Surface
**Slug:** prd-chat-panel-as-multi-provider-llm-cli
**Review Mode:** complete

## Work Items

### 4.1: Grok discovery gate

**Dependencies:** 1.8

**Implementation Details**

Determine Grok on-disk session path/format, headless output flag, and resume flag against a pinned grok-cli before committing to file-watch listing.

**Acceptance Criteria**

- AC-P3.0 — Storage path/format + flags documented and pinned before committing to file-watch listing.

### 4.2: Implement Grok spawn-per-turn adapter with file-watch listing

**Dependencies:** 4.1

**Implementation Details**

Implement the spawn-per-turn adapter plus correlated file-watch listing and descriptor; deliver list + click-to-resume + streaming. Steering emulated (abort+resume). Benefits from P1's normalizer. Use args arrays, never shell:true.

**Acceptance Criteria**

- AC-P3.1 — Grok sessions appear and replay/stream. AC-P3.2 — Resume via -s <id> works from a click. AC-P3.3 — Emulated steering labeled best-effort and verifiably aborts+resumes.

### 4.3: Implement Grok shell-security mitigation (DN-4)

**Dependencies:** 4.2

**Implementation Details**

Grok's shell runs outside the existing sandbox/approver. Ship default-deny auto-approve with explicit per-command confirmation (use a CLI permission-hook flag where one exists). Terminal-first is explicitly not used (DN-1).

**Acceptance Criteria**

- AC-P3.4 — Grok's shell runs outside the existing sandbox/approver; auto-approve is default-deny with explicit per-command confirmation.


---

# Phase 5: P5 — AWS Bedrock model access (BYOK; chat-first; parallelizable after P0)

**Project:** PRD: Chat Panel as Multi-Provider LLM CLI Surface
**Slug:** prd-chat-panel-as-multi-provider-llm-cli
**Review Mode:** complete

## Work Items

### 5.1: Ship Bedrock BYOK LanguageModelChatProvider

**Dependencies:** 1.6

**Implementation Details**

Ship a Bedrock BYOK LanguageModelChatProvider over the AWS Bedrock Runtime SDK, registered like geminiNativeProvider.ts / xAIProvider.ts and scoped via targetChatSessionType, so Bedrock-hosted models are selectable in the same chat surface. No new editor-proxy adapter; no terminal path. Discover the catalog at runtime and surface only enabled models.

**Acceptance Criteria**

- AC-P5.1 — Bedrock models appear in the model picker and complete a streaming turn rendered through the unchanged ChatWidget. AC-P5.4 — Bedrock sessions are chat-first: no terminal launch path is introduced.

### 5.2: Keep Bedrock inference within the AWS perimeter

**Dependencies:** 5.1

**Implementation Details**

Route model calls to the Bedrock endpoint via the AWS SDK so data/inference does not leave the AWS perimeter; verify with a network-assertion/unit test against a mocked Bedrock client.

**Acceptance Criteria**

- AC-P5.2 — Model calls go to the Bedrock endpoint via the AWS SDK and do not leave the AWS perimeter, verified by a network-assertion/unit test against a mocked Bedrock client.

### 5.3: Resolve AWS auth via standard credential chain with degraded states

**Dependencies:** 5.1

**Implementation Details**

Resolve AWS auth via the standard credential chain (profile / region / SSO). Surface a missing/invalid credential as an actionable degraded state rather than a silent failure.

**Acceptance Criteria**

- AC-P5.3 — AWS auth resolves via the standard credential chain; a missing/invalid credential surfaces an actionable degraded state (R7.1.5), not a silent failure.


---

# Phase 6: P4 — Make chat the default for ALL providers; terminal becomes opt-in escape hatch

**Project:** PRD: Chat Panel as Multi-Provider LLM CLI Surface
**Slug:** prd-chat-panel-as-multi-provider-llm-cli
**Review Mode:** complete

## Work Items

### 6.1: Make chat the default launch surface for all providers

**Dependencies:** 3.2, 4.2

**Implementation Details**

Make the chat-session surface the default for all provider launches (Claude, Copilot, Codex, Gemini, Grok, and Bedrock-backed sessions) behind a revertible setting. Depends on ≥2 new providers proven (P1–P3); P5 (Bedrock) is independent.

**Acceptance Criteria**

- AC-P4.1 — Default launch for every provider (incl. Grok and Bedrock-backed sessions) opens an Agents Window chat session, not a terminal tab; behind a revertible setting (no rebuild rollback).

### 6.2: Demote terminal agentTabs to opt-in escape hatch, preserve reverse channel

**Dependencies:** 6.1

**Implementation Details**

Demote agentTerminalTabbedView.ts to an explicit, opt-in 'Open in terminal' escape hatch, never a default for any provider. Preserve the IDE↔CLI MCP reverse channel so the terminal CLI still reaches editor tools.

**Acceptance Criteria**

- AC-P4.2 — 'Open in terminal' still works and the terminal CLI still reaches editor tools via the reverse-channel lock file. AC-P4.3 — existing agentTabs tests pass for the contractually frozen escape-hatch behaviors (launch, reverse-channel, highlight bridge); behaviors allowed to deprecate are listed.

### 6.3: Decide and document terminal.integrated.agentTabs.enabled deprecation mechanics

**Dependencies:** 6.1

**Implementation Details**

Decide and document whether terminal.integrated.agentTabs.enabled is retained / repurposed / removed; define the deprecation timeline, user-facing messaging, and migration of in-flight terminal sessions.

**Acceptance Criteria**

- AC-P4.4 — Deprecation flag decision is implemented and documented; in-flight terminal sessions migrate or are explicitly out-of-scope with a stated reason.

