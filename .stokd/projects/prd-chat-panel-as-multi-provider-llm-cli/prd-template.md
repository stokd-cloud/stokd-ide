<!-- stokd-version: 0.1.151 -->
# Product Requirements Document (Sequential)

## 0. Source Context
**Derived From:** Problem Description (architecture analysis of stokd-ide fork)
**Feature Name:** Chat Panel as Multi-Provider LLM CLI Surface
**PRD Owner:** brian@stokd.cloud
**Last Updated:** 2026-06-22

### Feature Brief Summary
Formalize an **Agent CLI Provider** abstraction over the existing platform `agentHost` registry so any LLM CLI (Claude, Copilot, Codex, Gemini, Grok) and AWS Bedrock–hosted models surface as a listed, clickable, resumable session in the Agents Window — with true mid-flight steering where the backend supports it and explicit emulation/degradation elsewhere. Chat is the default surface for ALL providers; the terminal is an opt-in escape hatch, never a default.

### Key Decisions (Resolved 2026-06-21)
- **DN-1:** Chat is the default for ALL providers; terminal is opt-in escape hatch only
- **DN-2:** Host abstraction on the platform `agentHost` registry (has `setPendingMessages` steering + sandbox + server/remote parity)
- **DN-3:** Reuse existing BYOK `LanguageModelChatProvider`s scoped via `targetChatSessionType`; no new editor-proxy adapters
- **DN-4:** Grok shell security: default-deny auto-approve + per-command confirmation
- **DN-5:** Grok ships with emulated steering (abort+resume)
- **DN-6:** Extract Claude-private registries into vendor-agnostic agent-runtime layer
- **DN-7:** Session list: group by workspace/date, sort by last-activity, per-family filter chips
- **DN-8:** Codex surfaces as a distinct family (not generic "OpenAI")
- **DN-9:** New `AX-AGENT-CLI-PROVIDER-REGISTRY` axiom + new SEAM_MANIFEST section

### Governing Axioms
`AX-REPO-AGENTS-WINDOW-DISTINCT-WINDOW`, `AX-REPO-THIN-PATCH-FORK`, `AX-REPO-FORK-TDD-SCOPE`, `AX-REPO-VENDORED-AHP-PROTOCOL`; proposes new `AX-AGENT-CLI-PROVIDER-REGISTRY`

---

## 1. Objectives & Constraints
### Objectives
- **G1 — Unified surface.** Any supported LLM CLI surfaces in the Agents Window SESSIONS list with structured content (assistant markdown, thinking, tool invocations/results, subagents, diffs)
- **G2 — Click-to-resume.** Clicking a listed session loads its full history
- **G3 — Click-to-steer (capability-gated).** Live mid-flight injection where supported; emulated (queued/abort+resume) and clearly labeled where not
- **G4 — Provider abstraction.** Adding a CLI = descriptor + adapter + `package.json` contribution — not hand-copied DI blocks or per-provider upstream edits after the one-time P0 seam
- **G5 — Consistent controls.** Shared model picker (provider-scoped), permission/approval-mode picker (provider-declared), folder/worktree isolation
- **G6 — Chat as default for ALL providers; terminal as opt-in escape hatch** (incl. Grok and Bedrock)
- **G7 — All providers reach a documented tier** (Claude, Copilot, Codex, Gemini, Grok + Bedrock)
- **G8 — Seamless resume parity.** Dormant sessions resume transparently on first send — indistinguishable from a live session
- **G9 — AWS Bedrock model access.** Bedrock-hosted models selectable via BYOK `LanguageModelChatProvider`, data perimeter stays in AWS

### Constraints
- **C1 — No new chat renderer** (NG1). Reuse the workbench `ChatWidget` + content-part system
- **C2 — No unified auth/billing model** (NG2). Per-provider
- **C3 — No universal protocol** (NG3). Adapt per transport
- **C4 — No terminal removal** (NG4). Retain IDE↔CLI MCP reverse channel
- **C5 — No re-architecting Agents Window layout** (NG6 / `AX-REPO-AGENTS-WINDOW-DISTINCT-WINDOW`)
- **C6 — Thin-patch fork discipline** (`AX-REPO-THIN-PATCH-FORK`). Upstream edits minimal, recorded in SEAM_MANIFEST
- **C7 — TDD required** (`AX-REPO-FORK-TDD-SCOPE`). Red→green for all fork behavioral changes
- **C8 — External CLI knowledge cutoff Jan-2026.** Pin versions; contract-test harness catches drift

---

## 1.5 Required Toolchain

> Standard Node.js/TypeScript toolchain for the stokd-ide (VS Code fork) codebase, plus additional tools for specific phases.

| Tool | Min Version | Install Command | Verify Command |
|------|------------|-----------------|----------------|
| node | 20+ | `nvm install 20` | `node --version` |
| npm | 10+ | ships with node | `npm --version` |
| typescript | (repo-local) | `npm install` | `npx tsc --version` |
| gulp | (repo-local) | `npm install` | `npx gulp --version` |
| codex (P2 only) | pinned at impl time | vendor install | `codex --version` |
| gemini-cli (P1 only) | pinned at impl time | vendor install | `gemini --version` |
| grok-cli (P3 only) | pinned at impl time | vendor install | `grok --version` |
| AWS SDK (P5 only) | `@aws-sdk/client-bedrock-runtime` 3.x | `npm install @aws-sdk/client-bedrock-runtime` | `node -e "require('@aws-sdk/client-bedrock-runtime')"` |

---

## 2. Execution Phases

> Phases below are ordered and sequential (execution order: P0 → P2 → P1 → P3 → P5 → P4).
> A phase cannot begin until all acceptance criteria of the previous phase are met.
> P5 (Bedrock) is independent and can run in parallel after P0.

---

## Phase 1: P0 — Abstraction Extraction + Registry Consolidation
**Purpose:** Foundation phase. Defines the `IAgentCliProviderDescriptor`, `EventNormalizer` vocabulary, and fork-owned provider registry mapped onto the existing platform `agentService`. Redirects all upstream switches to the registry. **Highest rebase risk** — must complete first so all subsequent providers register through the abstraction rather than hand-copying DI blocks.

### 1.1 Resolve DN-2 Host Layer for the Abstraction
Record that the Agent CLI Provider abstraction is hosted on the platform `agentHost` registry (the only layer with live `setPendingMessages` steering, sandbox, and server/remote parity).

**Implementation Details**
- Systems affected: architectural decision document, no code changes
- Inputs: analysis from §3 of the original PRD (two integration layers, steering availability)
- Core logic: decision gate — any provider needing true mid-flight steering MUST live in agentHost
- Failure modes: choosing the wrong layer locks out steering for new providers (R6)
- Dependencies: none (first work item)

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-1.1.a: DN-2 decision recorded as ACCEPT → documented as a prerequisite for all P0 coding

_Executable (verified by running a command):_
- AC-1.1.b: `grep -q 'DN-2.*ACCEPT' .stokd/projects/prd-chat-panel-as-multi-provider-llm-cli/prd.md` → exits 0

**Acceptance Tests**
- Test-1.1.a: Review confirms decision is documented and rationale references `setPendingMessages` + sandbox + server/remote parity

**Verification Commands**
```bash
# Decision documented
grep -q 'DN-2.*ACCEPT' .stokd/projects/prd-chat-panel-as-multi-provider-llm-cli/prd.md
```

---

### 1.2 Define IAgentCliProviderDescriptor and EventNormalizer Vocabulary
Define the declarative provider descriptor interface and the normalized event vocabulary that maps native SDK events to shared chat content parts.

**Implementation Details**
- Systems affected: new file(s) under `src/vs/platform/agentHost/common/` (fork-owned)
- Inputs: existing `IAgent` verbs from `agentService.ts`, content-part kinds from `chatListRenderer.ts`
- Core logic: descriptor covers id, displayName, family, icon, hostLayer, transport, auth, sessionStore, models, billing?, permissionModes, capabilities, security, enabledSettingId. EventNormalizer maps: `assistant.textDelta`, `assistant.thinking`, `tool.start/complete`, `tool.terminal`, `tool.simple`, `tool.subagent`, `edit`, `permission.requested`, `usage/title/error`
- Failure modes: vocabulary gaps → unmapped native events fall through to "Used tool: X" generic
- Dependencies: 1.1

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-1.2.a: `IAgentCliProviderDescriptor` interface defined → all descriptor fields from §5.3 present
- AC-1.2.b: EventNormalizer event vocabulary defined → each event kind maps to an existing `IChatContentPart`

_Executable (verified by running a command):_
- AC-1.2.c: `npm run compile-check-ts-native` → exits 0 (types compile)
- AC-1.2.d: `npm run valid-layers-check` → exits 0 (no layering violations)

**Acceptance Tests**
- Test-1.2.a: Unit test confirms descriptor type has all required fields (compile-time + runtime shape assertion)
- Test-1.2.b: Unit test confirms EventNormalizer vocabulary maps to existing content-part kinds

**Verification Commands**
```bash
npm run compile-check-ts-native
npm run valid-layers-check
```

---

### 1.3 Build Fork-Owned Provider Registry Mapped onto Platform agentService
Create the registry that maps descriptors onto `agentService.registerProvider`. Extract a shared registration base replacing the hand-copied extension DI blocks.

**Implementation Details**
- Systems affected: new registry file(s) under fork-owned path; `agentHostMain.ts` / `agentHostServerMain.ts` registration calls
- Inputs: `IAgentCliProviderDescriptor`, existing `registerProvider` seam
- Core logic: registry holds descriptors; lookup by id/family; generates enable config keys + commands from descriptor
- Failure modes: registry fails to resolve existing providers → regression in Claude/Copilot/Codex
- Dependencies: 1.2

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-1.3.a: Registry module exists → exports `registerAgentCliProvider` / `getAgentCliProvider` / `getAllAgentCliProviders`
- AC-1.3.b: Shared registration base extracted → copilotcli/claude-code blocks reference the shared base

_Executable (verified by running a command):_
- AC-1.3.c: `npm run compile-check-ts-native` → exits 0
- AC-1.3.d: `scripts/test.sh --grep "AgentCliProviderRegistry"` → registry unit tests pass

**Acceptance Tests**
- Test-1.3.a: Unit test registers a mock provider → `getAgentCliProvider('mock')` returns the descriptor
- Test-1.3.b: Unit test verifies `getAllAgentCliProviders()` returns Claude + Copilot + Codex after re-registration

**Verification Commands**
```bash
npm run compile-check-ts-native
scripts/test.sh --grep "AgentCliProviderRegistry"
```

---

### 1.4 Redirect Upstream agentSessions.ts Switches/Enum to the Registry
Redirect all 6 upstream switches + `SessionType` enum + per-provider `CommandsRegistry.registerCommand` to read from the fork-owned registry. **Highest rebase risk change.**

**Implementation Details**
- Systems affected: `agentSessions.ts` (6 switches: `isBuiltInAgentSessionProvider` `:32`, `getAgentSessionProvider` `:39`, `getAgentSessionProviderName` `:54`, `getAgentSessionProviderIcon` `:75`, `isFirstPartyAgentSessionProvider` `:96`, `getAgentCanContinueIn` `:118`); `chatSessionsService.ts` (`SessionType` `:292–298`); `chat.contribution.ts` (per-provider commands incl. `:353`)
- Inputs: fork-owned provider registry
- Core logic: each switch delegates to registry lookup instead of hard-coded enum/literal
- Failure modes: regression in existing pickers, filter labels, hover widgets; increased rebase cost
- Performance: must not add per-render overhead (registry lookup is O(1) map)
- Dependencies: 1.3

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-1.4.a: All 6 `agentSessions.ts` switches read from registry → no hard-coded provider literals remain in switch bodies
- AC-1.4.b: `SessionType` in `chatSessionsService.ts` reads from registry
- AC-1.4.c: Per-provider commands in `chat.contribution.ts` generated from descriptors

_Executable (verified by running a command):_
- AC-1.4.d: `npm run compile-check-ts-native` → exits 0
- AC-1.4.e: `scripts/test.sh --grep "mockAgent.*SESSIONS"` → a no-op test provider via `mockAgent` appears in the SESSIONS list with proper name, icon, family filter (AC-P0.2)

**Acceptance Tests**
- Test-1.4.a: Golden snapshot of session list with Claude+Copilot+Codex is byte-identical before and after redirect
- Test-1.4.b: Mock provider registered → appears in session-type picker with name, icon, family filter without editing any upstream switch

**Verification Commands**
```bash
npm run compile-check-ts-native
npm run valid-layers-check
scripts/test.sh --grep "mockAgent.*SESSIONS"
# Golden snapshot comparison
scripts/test.sh --grep "session.list.golden"
```

---

### 1.5 Generate Per-Provider Enable Config Keys and Commands from Descriptor
Replace hand-written `AgentHostClaudeAgentEnabledSettingId` / `AgentHostCodexAgentEnabledSettingId` constants with descriptor-generated keys.

**Implementation Details**
- Systems affected: `agentService.ts` (`:71`/`:79` constants); configuration schema; `package.json` contributions
- Inputs: `descriptor.enabledSettingId` from each registered provider
- Core logic: config key pattern `chat.agentHost.<provider>Agent.enabled` generated from descriptor; default OFF kill switch
- Failure modes: key name mismatch breaks existing settings migration
- Dependencies: 1.3

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-1.5.a: Enable config keys generated from descriptors → hand-written constants removed or aliased

_Executable (verified by running a command):_
- AC-1.5.b: `npm run compile-check-ts-native` → exits 0
- AC-1.5.c: `scripts/test.sh --grep "enabledSettingId"` → unit test confirms new providers ship default-OFF

**Acceptance Tests**
- Test-1.5.a: Unit test registers a provider with `enabledSettingId:'chat.agentHost.testAgent.enabled'` → setting exists with default `false`

**Verification Commands**
```bash
npm run compile-check-ts-native
scripts/test.sh --grep "enabledSettingId"
```

---

### 1.6 Generalize Model Picker and Promote Permission-Mode Methods
Make the model picker work for non-GitHub providers; make the permission picker provider-declared.

**Implementation Details**
- Systems affected: `modelPicker.ts` (`DEFAULT_MODEL_PICKER_OPTIONS`); `ISessionsProvider` interface; `claudePermissionModePicker.ts` / `agentHostClaudePermissionModePicker.ts` (to be replaced)
- Inputs: `descriptor.models`, `descriptor.permissionModes`
- Core logic: model picker reads `provider.getModels`/`getModelPickerOptions` reactively; `getPermissionModes(sessionId)` / `setPermissionMode` promoted to `ISessionsProvider`
- Failure modes: non-GitHub providers forced into "Auto" model → broken model selection
- Dependencies: 1.3

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-1.6.a: `ISessionsProvider` has `getPermissionModes` / `setPermissionMode` → generic permission picker renders provider-declared modes
- AC-1.6.b: Claude-specific permission pickers replaced by the generic picker

_Executable (verified by running a command):_
- AC-1.6.c: `npm run compile-check-ts-native` → exits 0
- AC-1.6.d: `scripts/test.sh --grep "permissionMode.generic"` → unit test confirms provider-declared modes drive the picker

**Acceptance Tests**
- Test-1.6.a: Unit test: mock provider declares modes `['ask', 'auto']` → picker renders exactly those modes
- Test-1.6.b: Unit test: model picker scoped to provider catalog → non-provider models excluded

**Verification Commands**
```bash
npm run compile-check-ts-native
scripts/test.sh --grep "permissionMode.generic"
scripts/test.sh --grep "modelPicker.provider"
```

---

### 1.7 Fork-Register Gemini/Grok Codicons
No `Codicon.gemini`/`Codicon.grok` exist upstream. Fork-register them so `getAgentSessionProviderIcon` resolves.

**Implementation Details**
- Systems affected: codicon font/registry (fork-owned additions); icon theme contributions
- Inputs: Gemini/Grok brand SVGs (or generic AI icons)
- Core logic: register codicons via the existing fork icon infrastructure
- Failure modes: icon missing → blank in session list (the exact regression this fixes)
- Dependencies: 1.4

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-1.7.a: `Codicon.gemini` and `Codicon.grok` (or equivalently-named fork codicons) exist → `getAgentSessionProviderIcon` returns non-null for both

_Executable (verified by running a command):_
- AC-1.7.b: `npm run compile-check-ts-native` → exits 0
- AC-1.7.c: `scripts/test.sh --grep "codicon.gemini\\|codicon.grok"` → icon registration tests pass

**Acceptance Tests**
- Test-1.7.a: Unit test: `getAgentSessionProviderIcon('gemini')` returns a `ThemeIcon`, not undefined

**Verification Commands**
```bash
npm run compile-check-ts-native
scripts/test.sh --grep "codicon.gemini"
```

---

### 1.8 Re-Register Claude and Copilot CLI Through the Registry (No Behavior Change)
Prove the registry works by re-registering the two shipping providers with byte-identical behavior.

**Implementation Details**
- Systems affected: Claude and Copilot CLI registration paths → point to registry descriptors
- Inputs: existing Claude/Copilot registration code, P0 registry
- Core logic: create descriptors for Claude and Copilot; register through the new registry; existing behavior preserved
- Failure modes: regression in session list, replay, steering, permission modes — caught by golden snapshot
- Dependencies: 1.3, 1.4, 1.5, 1.6

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-1.8.a: Claude and Copilot CLI registered via the descriptor/registry → hand-copied DI blocks replaced

_Executable (verified by running a command):_
- AC-1.8.b: `scripts/test.sh --grep "session.list.golden"` → golden snapshot byte-identical (AC-P0.1)
- AC-1.8.c: `npm run valid-layers-check` → exits 0 (AC-P0.3)
- AC-1.8.d: `test -f SEAM_MANIFEST_AGENT_CLI.md` → new SEAM_MANIFEST exists and records every redirected upstream switch

**Acceptance Tests**
- Test-1.8.a: Regression test: session list snapshot before vs after → byte-identical
- Test-1.8.b: Regression test: replayed Claude session → content parts identical

**Verification Commands**
```bash
scripts/test.sh --grep "session.list.golden"
npm run valid-layers-check
test -f SEAM_MANIFEST_AGENT_CLI.md && echo "SEAM_MANIFEST exists"
```

---

### 1.9 Enforce Security Descriptor and Normalized Telemetry in the Registry
Add consistency checks and telemetry normalization.

**Implementation Details**
- Systems affected: registry validation logic; telemetry emitters (`sendMSFTTelemetryEvent` path)
- Inputs: `IAgentSecurityDescriptor` on each descriptor; normalized telemetry vocabulary (§9)
- Core logic: registry rejects non-loopback bind policy or missing auth scheme; registered providers emit `agentcli.turn.start/.complete/.steer/.abort`, `agentcli.tool.invoked`, `agentcli.permission.requested/.resolved`, `agentcli.error`
- Failure modes: insecure provider registered without validation → 0.0.0.0 bind; telemetry gaps → blind spots in observability
- Dependencies: 1.3

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-1.9.a: Registry consistency test rejects provider with non-loopback bind policy → error thrown (AC-P0.4)
- AC-1.9.b: Registry consistency test rejects provider with missing auth scheme → error thrown (AC-P0.4)

_Executable (verified by running a command):_
- AC-1.9.c: `scripts/test.sh --grep "security.descriptor"` → consistency test passes (AC-P0.4)
- AC-1.9.d: `scripts/test.sh --grep "telemetry.normalized"` → recorded-event test verifies turn-lifecycle vocabulary (AC-P0.5)

**Acceptance Tests**
- Test-1.9.a: Unit test: register provider with `bindPolicy:'0.0.0.0'` → throws
- Test-1.9.b: Unit test: register provider with no `authScheme` → throws
- Test-1.9.c: Integration test: mock provider emits turn start/complete → telemetry recorder captures `agentcli.turn.start` + `agentcli.turn.complete`

**Verification Commands**
```bash
scripts/test.sh --grep "security.descriptor"
scripts/test.sh --grep "telemetry.normalized"
```

---

## Phase 2: P2 — Codex: Validate the Registry on In-Tree Code
**Purpose:** First provider after P0. Codex is already substantially implemented in the agentHost layer with verified `turn/steer`, `thread/resume`, `turn/interrupt`, 5 test files, and 87 generated types. Validates the registry on **known-working, in-tree code** before betting it on unverified external protocols. Must come before P1/P3.

### 2.1 Resolve Codex Model Sourcing (DN-3 Gate)
Gate: confirm BYOK reuse for Codex model sourcing before adapter work proceeds.

**Implementation Details**
- Systems affected: model picker wiring for Codex sessions
- Inputs: DN-3 decision (reuse BYOK `LanguageModelChatProvider`s); existing BYOK infrastructure
- Core logic: determine how Codex models are surfaced — either via existing BYOK or a dedicated adapter
- Failure modes: wrong sourcing decision → model picker shows wrong models or none
- Dependencies: 1.8

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-2.1.a: Codex model sourcing decision documented (BYOK reuse) → recorded before adapter work

_Executable (verified by running a command):_
- AC-2.1.b: `grep -q 'Codex.*BYOK\|Codex.*model.sourcing' .stokd/projects/prd-chat-panel-as-multi-provider-llm-cli/prd.md` → exits 0

**Acceptance Tests**
- Test-2.1.a: Review confirms decision is documented with rationale

**Verification Commands**
```bash
grep -q 'Codex.*model' .stokd/projects/prd-chat-panel-as-multi-provider-llm-cli/prd.md
```

---

### 2.2 Bring codexAgent onto the P0 Registry/Descriptor
Register `codexAgent.ts` via the registry; wire all verbs through it.

**Implementation Details**
- Systems affected: `codexAgent.ts`, registry; `codexAppServerClient.ts` transport
- Inputs: P0 registry, Codex `IAgent` implementation
- Core logic: create Codex descriptor; register via `registerAgentCliProvider`; wire `createSession`→`thread/start`, steer→`turn/steer`, abort→`turn/interrupt`, resume→`thread/resume`
- Failure modes: verb routing regression; protocol mismatch after regeneration
- Performance: must not add latency to JSON-RPC round-trips
- Dependencies: 1.8, 2.1

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-2.2.a: Codex registered via registry descriptor → `getAgentCliProvider('openai-codex')` returns descriptor

_Executable (verified by running a command):_
- AC-2.2.b: `scripts/test.sh --grep "codex.registry"` → list/click/resume/steer/abort work via registry (AC-P2.1)
- AC-2.2.c: `npm run codex:gen-protocol` → exits 0 (generated types never hand-edited)

**Acceptance Tests**
- Test-2.2.a: Integration test: Codex `createSession` → `thread/start` dispatched via registry adapter
- Test-2.2.b: Integration test: Codex steer → `turn/steer` dispatched; abort → `turn/interrupt`; resume → `thread/resume`

**Verification Commands**
```bash
npm run compile-check-ts-native
npm run codex:gen-protocol
scripts/test.sh --grep "codex.registry"
```

---

### 2.3 Wire Codex History Builder/Tool Formatter into Normalized Vocabulary
Codex renders structured parts through the shared EventNormalizer.

**Implementation Details**
- Systems affected: new Codex history builder + tool formatter (fork-owned); EventNormalizer mapping
- Inputs: Codex JSON-RPC event stream; normalized event vocabulary from 1.2
- Core logic: map Codex-native events to `assistant.textDelta`, `tool.start/complete`, `assistant.thinking`, etc.
- Failure modes: unmapped Codex events → silent content loss
- Dependencies: 2.2

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-2.3.a: Codex tool/thinking/text parts render through the shared normalizer → `ChatWidget` displays them

_Executable (verified by running a command):_
- AC-2.3.b: `scripts/test.sh --grep "codex.normalizer.golden"` → golden-fixture test passes (AC-P2.2)

**Acceptance Tests**
- Test-2.3.a: Golden-fixture test: recorded Codex events → `assert.deepStrictEqual` against expected normalized output

**Verification Commands**
```bash
scripts/test.sh --grep "codex.normalizer.golden"
```

---

### 2.4 Reconcile Codex Across All agentSessions.ts Switches
Fix the half-wired Codex across name/icon/family/first-party/continue-in.

**Implementation Details**
- Systems affected: Codex descriptor fields (name, icon, family, isFirstParty, canContinueIn)
- Inputs: current half-wired state across the 6 switches
- Core logic: ensure Codex descriptor is complete so all switches resolve consistently
- Failure modes: Codex still shows generic/missing in some views
- Dependencies: 2.2

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-2.4.a: Codex appears consistently across all 6 switch functions → name, icon, family, first-party status, continue-in all resolve

_Executable (verified by running a command):_
- AC-2.4.b: `scripts/test.sh --grep "codex.switches.consistent"` → consistency test passes (AC-P2.3)

**Acceptance Tests**
- Test-2.4.a: Unit test: each of the 6 switch functions returns correct values for 'openai-codex'

**Verification Commands**
```bash
scripts/test.sh --grep "codex.switches.consistent"
```

---

### 2.5 Codex Pinned-Version Contract Test
CI guard against external CLI drift.

**Implementation Details**
- Systems affected: test infrastructure; CI configuration
- Inputs: pinned Codex binary version; expected `exec --json` event schema; expected `~/.codex/sessions` format
- Core logic: smoke test asserts flag names, SDK exports, on-disk schema; fails CI on drift (§9.3)
- Failure modes: Codex updates break event schema silently → caught by this test
- Dependencies: 2.2

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-2.5.a: Pinned-version smoke test exists and is wired into CI

_Executable (verified by running a command):_
- AC-2.5.b: `scripts/test.sh --grep "codex.contract"` → smoke test passes against pinned version (AC-P2.4)

**Acceptance Tests**
- Test-2.5.a: Contract test: `exec --json` schema matches pinned expectation
- Test-2.5.b: Contract test: `~/.codex/sessions` directory structure matches expected format

**Verification Commands**
```bash
scripts/test.sh --grep "codex.contract"
```

---

## Phase 3: P1 — Gemini via ACP (Proof of Generalization; Spike-Gated)
**Purpose:** First **external, non-incumbent** provider. Proves the registry generalizes beyond in-tree code. ACP is an **unverified protocol** — the spike gate (3.1) determines whether true steering is possible before committing to the adapter shape. Must come after P2 (registry proven on in-tree code first).

### 3.1 ACP Live-vs-Resume Spike Gate
Build a throwaway ACP handshake to determine Gemini's steering tier.

**Implementation Details**
- Systems affected: throwaway spike code (not shipped); pinned `gemini-cli` binary
- Inputs: `gemini --acp` (or `--experimental-acp`); ACP JSON-RPC protocol docs
- Core logic: initiate ACP session; send a prompt; during in-flight turn, send a second prompt; observe whether it injects into the running turn or queues
- Failure modes: ACP flag doesn't exist or has changed; gemini-cli version drift
- Dependencies: 1.8

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-3.1.a: Spike result documented → steering tier set from evidence, not assumed (AC-P1.0)

_Executable (verified by running a command):_
- AC-3.1.b: `test -f .stokd/projects/prd-chat-panel-as-multi-provider-llm-cli/spikes/gemini-acp-spike.md` → spike doc exists

**Acceptance Tests**
- Test-3.1.a: Review confirms spike ran against a pinned version with documented result

**Verification Commands**
```bash
test -f .stokd/projects/prd-chat-panel-as-multi-provider-llm-cli/spikes/gemini-acp-spike.md && echo "Spike documented"
```

---

### 3.2 Implement Gemini ACP Adapter, Descriptor, History Builder/Tool Formatter
Full Gemini provider implementation.

**Implementation Details**
- Systems affected: new adapter under fork-owned provider dir; descriptor; history builder; tool formatter; model catalog (BYOK `geminiNativeProvider.ts`); permission modes
- Inputs: ACP protocol (from spike); BYOK Gemini provider; EventNormalizer
- Core logic: ACP client over JSON-RPC/stdio; map Gemini events to normalized vocabulary; fallbacks: `@google/gemini-cli-sdk` or headless `--output-format stream-json`
- Failure modes: ACP method instability; event schema gaps; version drift
- Dependencies: 3.1

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-3.2.a: Gemini session appears in SESSIONS list → clickable, replays full history with thinking/tool parts
- AC-3.2.b: Model picker shows only Gemini models; permission picker shows Gemini-declared modes (AC-P1.3)

_Executable (verified by running a command):_
- AC-3.2.c: `scripts/test.sh --grep "gemini.adapter"` → adapter tests pass
- AC-3.2.d: `scripts/test.sh --grep "gemini.normalizer.golden"` → golden-fixture test passes (AC-P1.1)

**Acceptance Tests**
- Test-3.2.a: Golden-fixture test: recorded Gemini ACP events → normalized output matches expected
- Test-3.2.b: Unit test: Gemini model picker scoped to Gemini models only
- Test-3.2.c: Unit test: Gemini permission picker shows declared modes

**Verification Commands**
```bash
npm run compile-check-ts-native
scripts/test.sh --grep "gemini.adapter"
scripts/test.sh --grep "gemini.normalizer.golden"
```

---

### 3.3 Verify Gemini Steering per Spike Result
Wire steering based on AC-P1.0 outcome.

**Implementation Details**
- Systems affected: Gemini adapter steering path
- Inputs: spike result (3.1)
- Core logic: if spike confirms injection → wire native steering via ACP; if queues → wire emulated steering (abort+resume) with clear UI label
- Failure modes: steering labeled as native when it's actually emulated
- Dependencies: 3.1, 3.2

**Acceptance Criteria**

_Executable (verified by running a command):_
- AC-3.3.a: `scripts/test.sh --grep "gemini.steering"` → steering test passes per spike result (AC-P1.2)

**Acceptance Tests**
- Test-3.3.a: If native: integration test confirms mid-flight injection against pinned version
- Test-3.3.b: If emulated: unit test confirms "will apply on next turn" label + abort+resume sequence

**Verification Commands**
```bash
scripts/test.sh --grep "gemini.steering"
```

---

### 3.4 Gemini Normalized Telemetry Recorded-Event Test
Verify telemetry parity.

**Implementation Details**
- Systems affected: telemetry emitters for Gemini turns
- Core logic: Gemini turn emits same `agentcli.turn.start/.complete` vocabulary as Claude
- Dependencies: 3.2

**Acceptance Criteria**

_Executable (verified by running a command):_
- AC-3.4.a: `scripts/test.sh --grep "gemini.telemetry"` → recorded-event test passes (AC-P1.4)

**Acceptance Tests**
- Test-3.4.a: Recorded-event test: mock Gemini turn → telemetry recorder captures `agentcli.turn.start` + `agentcli.turn.complete` with correct provider id

**Verification Commands**
```bash
scripts/test.sh --grep "gemini.telemetry"
```

---

## Phase 4: P3 — Grok (Spawn-Per-Turn, Emulated Steering; Discovery-Gated)
**Purpose:** Grok has **zero in-tree code**, no SDK/ACP/IPC, and undocumented storage. The discovery gate (4.1) must complete before committing to any implementation. Proves the registry handles the lowest-capability transport (spawn-per-turn). Shell security requires explicit mitigation (DN-4).

### 4.1 Grok Discovery Gate
Determine on-disk path/format, headless output flag, and resume flag.

**Implementation Details**
- Systems affected: discovery documentation; pinned `grok-cli` binary
- Inputs: installed grok-cli at pinned version
- Core logic: run grok headless; inspect file output; test resume flag (`-s <id>`); document storage path + format
- Failure modes: no headless mode; no resume flag; undocumented/unstable format
- Dependencies: 1.8

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-4.1.a: Storage path/format + flags documented and pinned (AC-P3.0)

_Executable (verified by running a command):_
- AC-4.1.b: `test -f .stokd/projects/prd-chat-panel-as-multi-provider-llm-cli/spikes/grok-discovery.md` → discovery doc exists

**Acceptance Tests**
- Test-4.1.a: Review confirms discovery ran against pinned version with documented storage path, format, headless flag, resume flag

**Verification Commands**
```bash
test -f .stokd/projects/prd-chat-panel-as-multi-provider-llm-cli/spikes/grok-discovery.md && echo "Discovery documented"
```

---

### 4.2 Implement Grok Spawn-Per-Turn Adapter with File-Watch Listing
Full Grok provider: list + click-to-resume + streaming with emulated steering.

**Implementation Details**
- Systems affected: new adapter; correlated file watcher (not shared); descriptor; history builder; tool formatter; model catalog (BYOK `xAIProvider.ts`)
- Inputs: discovery results (4.1); EventNormalizer; BYOK xAI provider
- Core logic: spawn grok headless per turn; parse NDJSON output; watch session dir with correlated watcher; resume via `-s <id>`; steering emulated (abort+resume). **Must use args arrays, never `shell:true`** (§10.2)
- Failure modes: format drift; resume flag changes; file-watch perf on large dirs
- Dependencies: 4.1

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-4.2.a: Grok sessions appear in SESSIONS list and replay/stream (AC-P3.1)
- AC-4.2.b: Resume via `-s <id>` works from a click (AC-P3.2)

_Executable (verified by running a command):_
- AC-4.2.c: `scripts/test.sh --grep "grok.adapter"` → adapter tests pass
- AC-4.2.d: `scripts/test.sh --grep "grok.steering.emulated"` → emulated steering labeled best-effort and verifiably aborts+resumes (AC-P3.3)

**Acceptance Tests**
- Test-4.2.a: Unit test: Grok session appears in list after file-watch detects session file
- Test-4.2.b: Unit test: resume dispatches spawn with `-s <id>` arg (args array, not shell string)
- Test-4.2.c: Unit test: emulated steering shows "will apply on next turn" label + abort+resume sequence

**Verification Commands**
```bash
npm run compile-check-ts-native
scripts/test.sh --grep "grok.adapter"
scripts/test.sh --grep "grok.steering.emulated"
```

---

### 4.3 Implement Grok Shell-Security Mitigation (DN-4)
Default-deny auto-approve + per-command confirmation for Grok's out-of-sandbox shell.

**Implementation Details**
- Systems affected: Grok adapter permission handling; auto-approve configuration
- Inputs: DN-4 decision; CLI permission-hook flag (if one exists)
- Core logic: Grok's shell runs inside the vendor process, outside `commandAutoApprover.ts` / `agentHostSandboxEngine.ts`. Mitigation: auto-approve is **default-deny**; every shell command requires explicit per-command confirmation. Use the CLI's permission-hook flag where available. **Terminal-first is explicitly NOT used** (DN-1)
- Failure modes: auto-approve accidentally set to allow → RCE surface
- Dependencies: 4.2

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-4.3.a: Grok auto-approve is default-deny → no shell command auto-approved without explicit confirmation (AC-P3.4)

_Executable (verified by running a command):_
- AC-4.3.b: `scripts/test.sh --grep "grok.security"` → security test passes

**Acceptance Tests**
- Test-4.3.a: Unit test: Grok shell command → permission.requested event emitted, not auto-approved
- Test-4.3.b: Unit test: bypass mode OFF by default for Grok

**Verification Commands**
```bash
scripts/test.sh --grep "grok.security"
```

---

## Phase 5: P5 — AWS Bedrock Model Access (BYOK; Chat-First; Parallelizable After P0)
**Purpose:** Ship a Bedrock BYOK `LanguageModelChatProvider` so Bedrock-hosted models are selectable in the same chat surface. Independent of P1–P3; can run in parallel after P0. Bedrock is a **model source**, not an agentic CLI — it supplies models; steering/resume are inherited from whichever agent runtime consumes the model.

### 5.1 Ship Bedrock BYOK LanguageModelChatProvider
Bedrock models selectable in the model picker; streaming turn rendered through unchanged `ChatWidget`.

**Implementation Details**
- Systems affected: new Bedrock provider extension (like `geminiNativeProvider.ts` / `xAIProvider.ts`); `byokContribution.ts` registration; `@aws-sdk/client-bedrock-runtime` dependency
- Inputs: AWS Bedrock Runtime SDK; model catalog from Bedrock `ListFoundationModels` API
- Core logic: implement `LanguageModelChatProvider` over Bedrock `InvokeModelWithResponseStream`; register via `byokContribution.ts` scoped with `targetChatSessionType`; discover catalog at runtime and surface only enabled models
- Failure modes: AWS SDK / region / model-id drift; per-account/region catalog variance
- Dependencies: 1.6 (model picker generalization)

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-5.1.a: Bedrock models appear in the model picker → selectable for chat sessions (AC-P5.1)
- AC-5.1.b: Bedrock sessions are chat-first → no terminal launch path introduced (AC-P5.4)

_Executable (verified by running a command):_
- AC-5.1.c: `npm run compile-check-ts-native` → exits 0
- AC-5.1.d: `scripts/test.sh --grep "bedrock.provider"` → provider registration test passes

**Acceptance Tests**
- Test-5.1.a: Unit test: Bedrock provider registered → model picker includes Bedrock models
- Test-5.1.b: Unit test: streaming turn via mocked Bedrock client → `ChatWidget` renders response

**Verification Commands**
```bash
npm run compile-check-ts-native
scripts/test.sh --grep "bedrock.provider"
```

---

### 5.2 Keep Bedrock Inference Within the AWS Perimeter
Model calls go to Bedrock endpoint via AWS SDK, verified by test.

**Implementation Details**
- Systems affected: Bedrock provider HTTP client configuration
- Inputs: AWS SDK Bedrock Runtime client
- Core logic: all model invocations route through `BedrockRuntimeClient`; no intermediate proxy that leaves AWS
- Failure modes: misconfigured endpoint → data leaves AWS perimeter
- Dependencies: 5.1

**Acceptance Criteria**

_Executable (verified by running a command):_
- AC-5.2.a: `scripts/test.sh --grep "bedrock.perimeter"` → network-assertion test confirms calls stay within AWS (AC-P5.2)

**Acceptance Tests**
- Test-5.2.a: Unit test against mocked Bedrock client: assert all calls route to `bedrock-runtime.<region>.amazonaws.com` endpoint, no other HTTP calls made

**Verification Commands**
```bash
scripts/test.sh --grep "bedrock.perimeter"
```

---

### 5.3 Resolve AWS Auth via Standard Credential Chain with Degraded States
Missing/invalid credentials surface an actionable error, not a silent failure.

**Implementation Details**
- Systems affected: Bedrock provider auth resolution; SESSIONS list degraded-state rendering
- Inputs: AWS credential chain (profile / region / SSO via `@aws-sdk/credential-providers`)
- Core logic: resolve credentials via `fromNodeProviderChain()`; on failure, surface R7.1.5 degraded state with actionable message ("Configure AWS profile in settings")
- Failure modes: silent failure → user sees empty model list with no explanation
- Dependencies: 5.1

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-5.3.a: Missing credential → actionable degraded state shown, not silent failure (AC-P5.3)

_Executable (verified by running a command):_
- AC-5.3.b: `scripts/test.sh --grep "bedrock.auth"` → auth resolution test passes

**Acceptance Tests**
- Test-5.3.a: Unit test: no AWS credentials configured → provider reports degraded state with message
- Test-5.3.b: Unit test: valid credentials → provider resolves and lists models

**Verification Commands**
```bash
scripts/test.sh --grep "bedrock.auth"
```

---

## Phase 6: P4 — Make Chat the Default for ALL Providers; Terminal Becomes Opt-In Escape Hatch
**Purpose:** Culminating phase. After ≥2 new providers are proven (P1–P3), switch the default launch surface from terminal to chat for **every** provider. The terminal `agentTabs` path is demoted to an explicit opt-in escape hatch — retained but never a default. **Must not execute until P1–P3 prove the registry handles diverse transports.**

### 6.1 Make Chat the Default Launch Surface for All Providers
Default launch opens Agents Window chat session, not terminal tab.

**Implementation Details**
- Systems affected: provider launch routing; default-surface setting; `package.json` contributions
- Inputs: all registered providers (Claude, Copilot, Codex, Gemini, Grok, Bedrock-backed)
- Core logic: set default launch surface to chat for every provider; gate behind a **revertible setting** (no rebuild to roll back)
- Failure modes: users lose terminal workflows → mitigated by retained opt-in escape hatch
- Dependencies: 3.2 (Gemini proven), 4.2 (Grok proven)

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-6.1.a: Default launch for every provider → opens Agents Window chat session (AC-P4.1)
- AC-6.1.b: Revertible setting exists → user can switch back without rebuilding

_Executable (verified by running a command):_
- AC-6.1.c: `scripts/test.sh --grep "default.surface.chat"` → default-surface test passes

**Acceptance Tests**
- Test-6.1.a: Unit test: for each provider id, `getDefaultLaunchSurface(providerId)` returns 'chat'
- Test-6.1.b: Unit test: revertible setting toggled → `getDefaultLaunchSurface` returns 'terminal'

**Verification Commands**
```bash
npm run compile-check-ts-native
scripts/test.sh --grep "default.surface.chat"
```

---

### 6.2 Demote Terminal agentTabs to Opt-In Escape Hatch, Preserve Reverse Channel
"Open in terminal" still works; IDE↔CLI MCP reverse channel preserved.

**Implementation Details**
- Systems affected: `agentTerminalTabbedView.ts`; `agentTerminalActiveHighlightBridge.ts`; reverse-channel `inProcHttpServer.ts` + `lockFile.ts`
- Core logic: retain all terminal machinery but only activate via explicit "Open in terminal" action; preserve reverse-channel lock file + nonce auth
- Failure modes: reverse channel broken → terminal CLI can't reach editor tools
- Dependencies: 6.1

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-6.2.a: "Open in terminal" escape hatch works → terminal CLI reaches editor tools via lock file (AC-P4.2)
- AC-6.2.b: Existing agentTabs tests pass for frozen escape-hatch behaviors (AC-P4.3)

_Executable (verified by running a command):_
- AC-6.2.c: `scripts/test.sh --grep "agentTabs.escape"` → escape-hatch tests pass
- AC-6.2.d: `scripts/test.sh --grep "reverseChannel"` → reverse-channel test passes

**Acceptance Tests**
- Test-6.2.a: Integration test: "Open in terminal" command → terminal tab opens with LLM CLI
- Test-6.2.b: Integration test: terminal CLI calls MCP reverse channel → editor tool invoked

**Verification Commands**
```bash
scripts/test.sh --grep "agentTabs.escape"
scripts/test.sh --grep "reverseChannel"
```

---

### 6.3 Decide and Document terminal.integrated.agentTabs.enabled Deprecation Mechanics
Define what happens to the existing flag and terminal sessions.

**Implementation Details**
- Systems affected: `terminal.integrated.agentTabs.enabled` setting; deprecation messaging; in-flight session migration
- Core logic: decide retain/repurpose/remove; define timeline; write user-facing deprecation message; handle in-flight terminal sessions
- Failure modes: users confused by setting behavior change
- Dependencies: 6.1

**Acceptance Criteria**

_Structural (code exists and is correct):_
- AC-6.3.a: Deprecation flag decision implemented and documented (AC-P4.4)
- AC-6.3.b: In-flight terminal sessions either migrate or are explicitly out-of-scope with stated reason

_Executable (verified by running a command):_
- AC-6.3.c: `npm run compile-check-ts-native` → exits 0

**Acceptance Tests**
- Test-6.3.a: Review confirms deprecation decision is documented with timeline and migration plan

**Verification Commands**
```bash
npm run compile-check-ts-native
```

---

## 3. Completion Criteria
The project is considered complete when:
- All phase acceptance criteria pass (P0 through P4, plus P5 Bedrock)
- All acceptance tests are green (verified by executing test commands, not just reading code)
- All Verification Commands from every work item exit 0
- Full project build succeeds (`npm run compile-check-ts-native`)
- `npm run valid-layers-check` passes; Agents Window remains a distinct window
- No open P0 or P1 issues remain
- **DoD-1** — All 5 providers + Bedrock appear in SESSIONS list, filterable by family, clickable to replay
- **DoD-2** — Claude/Copilot/Codex: verified true steering; Gemini: conditional on spike; Grok: emulated, labeled
- **DoD-3** — Adding a 6th provider requires only descriptor + adapter + `package.json` — zero new upstream edits
- **DoD-4** — Per-provider model picker and generic permission picker working
- **DoD-5** — All providers use unchanged `ChatWidget` renderer
- **DoD-6** — Chat is default for ALL; terminal is opt-in escape hatch; revertible by setting
- **DoD-7** — No non-loopback binds; bypass off by default; no out-of-dir auto-approve; DN-4 implemented
- **DoD-8** — Normalized telemetry vocabulary; no raw prompt/file content on default-on events
- **DoD-9** — Golden-fixture tests, adapter contract suite, external-CLI contract tests all pass; TDD-covered
- **DoD-10** — `valid-layers-check` passes; `product.json` unchanged; new SEAM_MANIFEST records all seams
- **DoD-11** — Seamless resume: clicking dormant session → full history + interactive composer, no "Resume" step
- **DoD-12** — Bedrock models selectable; calls stay in AWS; no terminal path

---

## 4. Rollout & Validation
### Rollout Strategy
- **Per-provider kill switches (default-OFF):** `chat.agentHost.<provider>Agent.enabled` — new providers ship disabled
- **Revertible default-surface setting:** P4 chat-default is reversible via setting (no rebuild)
- **Progressive exposure:** P0 → P2 (Codex, in-tree) → P1 (Gemini, spike-gated) → P3 (Grok, discovery-gated) → P5 (Bedrock, parallel) → P4 (chat-default)
- **Feature flags per decision:** DN-4 Grok security; terminal deprecation flag

### Post-Launch Validation
- **Metrics to monitor:**
  - `agentcli.turn.start` / `.complete` rates per provider (turn lifecycle)
  - `agentcli.turn.steer` counts (live vs emulated)
  - `agentcli.error` rates per transport type
  - SESSIONS list render latency (R15.1 budget)
  - Permission request/resolve round-trip times
- **Rollback triggers:**
  - Provider error rate > 10% of turns → disable provider via kill switch
  - SESSIONS list render > 500ms with N providers → investigate file-watcher/ps-walk regression
  - Security incident on spawn-per-turn shell → disable Grok + engage DN-4 review
  - Bedrock auth failures > 50% of attempts → surface degraded state, disable by default

---

## 5. Open Questions
- **OQ-1 (P1):** Does `gemini --acp` support `--experimental-acp` or has it graduated? (resolve in spike 3.1)
- **OQ-2 (P1):** What is the exact ACP `initialize`/`prompt` method schema? (resolve in spike 3.1)
- **OQ-3 (P3):** What is Grok's on-disk session path and format? (resolve in discovery 4.1)
- **OQ-4 (P3):** Does grok-cli expose a permission-hook flag for shell commands? (resolve in discovery 4.1)
- **OQ-5 (P5):** Which Bedrock model IDs should be offered by default vs discovered at runtime? (resolve in P5 implementation)
- **OQ-6 (P4):** Is `terminal.integrated.agentTabs.enabled` retained, repurposed, or removed? (resolve in 6.3)
- **OQ-7 (cross-cutting):** What is the SESSIONS-list aggregation latency budget with 5+ providers? (R15.1, measure in P2)
- **OQ-8 (cross-cutting):** Which Claude proxy (`langModelServer.ts` vs `claudeLanguageModelServer.ts`) serves which Claude impl? (document in P0)

---
