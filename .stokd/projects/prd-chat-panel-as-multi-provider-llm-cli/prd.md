# PRD: Chat Panel as Multi-Provider LLM CLI Surface

**One-line summary:** Make the Agents Window chat surface the first-class home for LLM CLIs by formalizing an **Agent CLI Provider** abstraction over the *existing* platform `agentHost` registry, so any LLM CLI (Claude, Copilot, Codex, Gemini, Grok) **and AWS Bedrock–hosted models** surface as a listed, clickable, resumable session — with **true mid-flight steering where the backend supports it** and explicit emulation/degradation elsewhere. **Chat is the default surface for ALL providers; the terminal is an opt-in escape hatch, never a default.** (Decisions recorded in §11.)

| Field | Value |
|---|---|
| **Status** | DRAFT — user decisions recorded (see §11) |
| **Owner** | _<assign>_ (brian@stokd.cloud) |
| **Author** | Principal Product Engineering |
| **Created** | 2026-06-20 |
| **Last updated** | 2026-06-21 (decisions recorded) |
| **Reviewers** | _<assign: core/sessions, copilot-ext, agentHost, security>_ |
| **Target release** | _<assign>_ |
| **Maps to stokd project** | Yes — see Phased Delivery Plan (P0–P5; P5 = Bedrock) |
| **Governing axioms** | `AX-REPO-AGENTS-WINDOW-DISTINCT-WINDOW`, `AX-REPO-THIN-PATCH-FORK`, `AX-REPO-FORK-TDD-SCOPE`, `AX-REPO-VENDORED-AHP-PROTOCOL`; **proposes new `AX-AGENT-CLI-PROVIDER-REGISTRY`** (see §13) |
| **SEAM_MANIFEST decision** | **New `SEAM_MANIFEST.md` (or new section) under the proposed axiom** — the existing manifest is scoped to `AX-TERMINAL-AGENT-TABS` (terminal selector, one upstream file `terminalView.ts` + rebrand seams) and **cannot silently absorb these edits** (see §13) |

---

## 0. Considered Alternatives

Recorded before the proposed solution so reviewers can see what was rejected and why.

| Alt | Description | Goals satisfied | Why rejected / chosen |
|---|---|---|---|
| **A — File-watch + parser, keep terminal** | Every CLI writes discoverable session files; ship a per-CLI `.jsonl` parser; keep the LLM CLI running in a terminal tab. | G1 (surface), G2 (resume) only — ~40% of goals. | **Rejected.** This is the user's "just parse session files" intuition. The repo's own state is the counter-evidence: the Claude `.jsonl` parser (`claudeSessionParser.ts`) is dormant *because it is structurally insufficient for the headline feature* — file-watch gives listing/replay but **cannot deliver live streaming (R7.2.3) or mid-flight steering (G3)** of an in-flight turn. Fails the headline interaction the user actually values. |
| **B — Terminal + chat coexist as co-equal peers (no demotion)** | Terminal stays a first-class peer; chat is opt-in per provider; no deprecation. | All except a hard G6. | **Superseded by the user's DN-1 choice.** Terminal is *retained* but as an opt-in escape hatch, not a co-equal default. |
| **C — Full extraction, chat-as-default everywhere, terminal demoted to escape hatch** | Original draft framing. | All. | **ADOPTED (modified) — the user's DN-1 choice.** Chat-default for *all* providers; the terminal is *retained* as an opt-in escape hatch (not removed); Grok ships with emulated steering + default-deny shell rather than terminal-first. |

**Chosen framing (DN-1 — resolved by the user, see §11):** **Chat is the DEFAULT launch surface for ALL providers (Claude, Copilot, Codex, Gemini, Grok) and for AWS Bedrock–hosted models; the terminal is retained as an OPT-IN escape hatch only, never a default for any provider.** Rationale (user): the project also surfaces Bedrock models via a BYOK `LanguageModelChatProvider` (data perimeter stays in AWS), and a terminal default would give Bedrock-backed and structured-transport-lacking providers an inconsistent, lower-quality UI — the goal is one uniform chat surface. This is **Alternative C, modified**: the terminal is *retained* (not removed) and Grok ships with *emulated* steering + a default-deny shell (DN-4) rather than terminal-first. Accepted trade-off: Grok (spawn-per-turn) executes shell outside the existing sandbox; mitigated per §10 / DN-4.

---

## 1. Background & Problem Statement

### 1.1 What the user observed

Today, when the user runs Claude through the Claude/stokd CLI, prompts surface in the VS Code **SESSIONS** list, and clicking a running session lets them **steer the in-flight agent from the chat dialog**.

**Verified scope of this premise (important correction):** this live click-to-steer behavior is real **today only for providers implemented in the platform `agentHost` `IAgent` layer** (Claude-AgentHost, Codex, Copilot-AgentHost). The control path is: SESSIONS chat input → agent-host process → `agentSideEffects.ts:1008` reads `state.steeringMessage` → calls `IAgent.setPendingMessages(...)`. It is **not** a generic property of the copilot-extension chat-session layer. The generalization the user assumes is **real for the agentHost path and aspirational for the extension path** (see §3.3, §5.7).

### 1.2 Why the terminal-based LLM CLI is limiting

Running an LLM CLI inside a terminal tab (`src/vs/workbench/contrib/terminal/browser/agentTabs/`) has structural problems:

- **No structured surfacing.** A terminal is an opaque byte stream; assistant text, thinking, tool calls/results are not rendered as structured chat content, and the session is not a navigable/filterable/resumable object.
- **No reliable click-to-steer.** Steering a TUI requires injecting keystrokes into a pty — fragile and provider-specific.
- **No model picker / permission UX integration.** Model, reasoning effort, approval mode, worktree isolation are all CLI-flag/in-TUI concerns invisible to the workbench.
- **No cross-provider parity.** Each TUI is different.

### 1.3 What changes (chat-default for ALL providers; terminal as opt-in escape hatch)

The terminal `agentTabs` path (`agentTerminalTabbedView.ts`, the in-flight `agentTerminalActiveHighlightBridge.ts`) is **demoted from the default LLM-CLI surface for ALL providers** to a retained **opt-in escape hatch**. It is **not removed**, and it is **never the default for any provider** — including Grok and AWS Bedrock–backed models. The IDE↔CLI MCP reverse channel is preserved. The deprecation mechanics (flag, timeline, migration) are specified in §8 (P4); DN-1 is resolved in §11.

### 1.4 Why now

The chat-session architecture is provider-agnostic by design and already runs three heterogeneous backends. **Crucially, the single-seam pluggable registry the abstraction needs largely already exists at the platform layer:** `agentService.registerProvider(...)` runs Copilot+Claude+Codex (`agentHostMain.ts`) plus a `mockAgent` (`agentHostServerMain.ts`), proving pluggability. Remaining work is to (a) **unify on the existing platform registry and retire the hand-copied extension DI blocks**, and (b) close a small number of single-vendor seams. This is a generalization/consolidation effort on working infrastructure, not a greenfield build.

---

## 2. Goals / Non-Goals

### 2.1 Goals

1. **G1 — Unified surface.** Any supported LLM CLI surfaces in the Agents Window SESSIONS list and renders with structured content (assistant markdown, thinking, tool invocations/results, subagents, diffs).
2. **G2 — Click-to-resume.** Clicking a listed session loads its full history.
3. **G3 — Click-to-steer (capability-gated).** Where the backend supports **live mid-flight injection**, typing during a turn injects into the running turn; where it does not, the message is **emulated** (queued / abort+resume) and clearly labeled. Steering is a declared capability, not a guaranteed verb.
4. **G4 — Provider abstraction.** Adding a CLI is a descriptor + adapter + `package.json` contribution mapped onto the **existing platform registry** — not a hand-copied DI block and not per-provider core-enum edits *after the one-time P0 seam*.
5. **G5 — Consistent controls.** Shared model picker (provider-scoped), permission/approval-mode picker (provider-declared modes), folder/worktree isolation.
6. **G6 (resolved — DN-1) — Chat as default for ALL providers; terminal as opt-in escape hatch.** Chat is the default launch surface for every provider (Claude, Copilot, Codex, Gemini, Grok) and for AWS Bedrock–hosted models. The terminal is retained as an opt-in escape hatch and is **never** a default for any provider.
7. **G7 — All providers reach a documented tier** (Claude, Copilot, Codex, Gemini, Grok + Bedrock model access; see §6).
8. **G8 — Seamless resume parity.** Interacting with a **not-currently-running** (dormant/persisted) session transparently resumes it (SDK `forkSession` / `thread/resume` / `-s <id>`) with **no separate "resume" step**, and yields the **same interaction model as a live session** — full history, continue, and (capability-gated) steer. A resumed session must be indistinguishable from one that never stopped.
9. **G9 — AWS Bedrock model access.** Bedrock-hosted models are selectable in the same chat surface via a BYOK `LanguageModelChatProvider` (DN-3), keeping the data/inference perimeter inside AWS — no terminal, no separate UI.

### 2.2 Non-Goals

- **NG1** — No new chat renderer. We reuse the workbench `ChatWidget` + content-part system. No new message-rendering UI.
- **NG2** — No unified auth/billing model. Per-provider.
- **NG3** — No universal protocol all CLIs must speak. We adapt per transport.
- **NG4** — No removal of the terminal or the IDE↔CLI MCP reverse channel.
- **NG5** — True mid-flight steering for backends that genuinely cannot support it (Grok today) is **not** a hard requirement; emulated steering is the accepted degradation.
- **NG6** — No re-architecting the Agents Window layout (`AX-REPO-AGENTS-WINDOW-DISTINCT-WINDOW`).

---

## 3. Current Architecture (as-is)

Grounded in the codebase. There are **two parallel integration layers**, and they bridge into the SESSIONS list through **different** mechanisms — a fact the abstraction must confront, not gloss.

### 3.1 The two integration layers and how each bridges to the SESSIONS list

| Layer | Where | Providers today | Transport | **Bridge to SESSIONS list** | **Has live `setPendingMessages` steering?** |
|---|---|---|---|---|---|
| **agentHost (core/platform)** | `src/vs/platform/agentHost/` | Claude, Codex, Copilot | `IAgent`; SDK / spawned `app-server` JSON-RPC | `src/vs/sessions/contrib/providers/agentHost/localAgentHostSessionsProvider.ts` (an `ISessionsProvider`) | **Yes** — `IAgent.setPendingMessages?` exists in this layer |
| **chat-sessions (extension)** | `extensions/copilot/src/extension/chatSessions/` | `claude-code`, `copilotcli` | proposed chat-sessions API; in-proc SDK / Anthropic-proxy | copilot-extension `chatSessions` contribution + workbench `agentSessionsModel` contribution map | **No generic verb** — steers via per-provider `yieldRequested` poll + queue |

**Consequence:** live mid-flight steering (`setPendingMessages`) exists **only in the agentHost `IAgent` layer**. This makes OQ-2 ("which layer hosts a new provider") a **forced architectural decision, not a preference** — it determines whether true steering is even available (see §5, §11 DN-2).

### 3.2 The provider-agnostic `IAgent` contract (platform layer)

- **`src/vs/platform/agentHost/common/agentService.ts`** defines `IAgent` (`listSessions`, `getSessionMessages`, `sendMessage`, **`setPendingMessages?` — OPTIONAL, `agentService.ts:828`**, the live-steer verb; absent ⇒ no live steering), `abortSession`, `changeModel`, `respondToPermissionRequest`). `AgentProvider = string`; session URIs use the provider name as scheme (e.g. `codex:/<id>`). **Per-provider enable/disable config keys are hand-written named constants** (`AgentHostClaudeAgentEnabledSettingId` `:71`, `AgentHostCodexAgentEnabledSettingId` `:79`).
- **`src/vs/platform/agentHost/node/agentHostMain.ts`** — single registration seam: `registerProvider(...)` for `CopilotAgent` (`:183`), `ClaudeAgent` (`:197`), `CodexAgent` (`:200`). **`agentHostServerMain.ts`** mirrors it for server/remote and registers `mockAgent` (`:311`) — proving the seam is pluggable.
- **Codex is fully built here.** `node/codex/codexAgent.ts` spawns native `codex app-server`, talks JSON-RPC 2.0 over NDJSON via `codexAppServerClient.ts`; verbs: createSession→`thread/start`, sendMessage→`turn/start`, **`setPendingMessages`→`turn/steer` (`codexAgent.ts:1187`, verified)**, abort→`turn/interrupt`, restore→`thread/resume`. 87 generated protocol types under `codex/protocol/generated/` (from `build/codex/generate-protocol.mjs`; **never hand-edited** per `AX-REPO-VENDORED-AHP-PROTOCOL`).

### 3.3 Claude session surfacing — premise correction, and resume-vs-steer disambiguation

The user's premise was that Claude reads `~/.claude/projects/<slug>/*.jsonl` directly. **In this repo the live path is SDK-first, and there are TWO Claude implementations with TWO different steering mechanisms:**

| Claude impl | File | Resume/fork | **Live steering** |
|---|---|---|---|
| **agentHost ClaudeAgent** | `src/vs/platform/agentHost/node/claude/claudeAgent.ts` (`:871`) → `claudeAgentSession.injectSteering` → `claudeSdkPipeline.injectSteering` (`:317`) | SDK | **YES — true mid-flight `setPendingMessages`→`injectSteering`. Drops the message if no in-flight turn.** This is the path the user's lived experience rides. |
| **copilot-extension claudeCodeAgent** | `extensions/copilot/.../claude/.../claudeCodeAgent.ts` | `claudeCodeSdkService.ts` `forkSession` (RESUME/FORK only) | **NO `setPendingMessages`.** Steers via a `yieldRequested` poll (100ms) + `_queuedRequests`/`_inFlightRequests`: completes the current request and pulls the next queued request into the same streaming `query()` generator. A *different mechanism*. |

**Critical disambiguation (do not blur):** `forkSession` / `thread/resume` / `-s <id>` are **resume from persisted state**, NOT steering. **Live mid-flight steering is a distinct capability** that, for Claude, lives in the **agentHost** layer.

Supporting facts:
- `extensions/copilot/.../claude/node/sessionParser/claudeCodeSessionService.ts` — SDK-first `getAllSessions`/`getSession`.
- `claudeCodeSdkService.ts` — dynamic-import `@anthropic-ai/claude-agent-sdk`; exposes `forkSession` (resume/fork), **no steer verb**.
- `.../sessionParser/claudeSessionParser.ts` — raw `.jsonl` parser, wired only to its schema sibling. **Dormant — and structurally insufficient for the headline live-steer/streaming feature, not merely "fallback scaffolding."**
- **Two proxy files exist** (disambiguate per OQ-3 / DN-3): `extensions/copilot/src/extension/agents/node/langModelServer.ts` (`/v1/messages`, `AnthropicAdapterFactory`) serves the **extension** Claude SDK subprocess (`ANTHROPIC_BASE_URL` pointed at it); the **agentHost** Claude path uses its own proxy. A second file `chatSessions/claude/node/claudeLanguageModelServer.ts` also exists. Which proxy serves which Claude impl must be stated when resolving model sourcing.

**Implication:** the real common abstraction is the agentHost `IAgent` (+ the optional steer capability), **not** "everyone is a jsonl file-watcher."

### 3.4 Copilot CLI provider (the richest *event-translation* reference)

`extensions/copilot/.../chatSessions/copilotcli/` is the most complete event→stream reference (note: it lives in the **extension** layer, which lacks generic `setPendingMessages`). Copilot CLI runs the GitHub SDK **in-process** via `internal.LocalSessionManager`.

Key files:
- `vscode-node/chatSessions.ts` (`ChatSessionsContrib`) — wires the child DI container; per type registers `LanguageModelChatProvider`, chat participant, `ChatSessionContentProvider`, `ChatSessionCustomizationProvider`, commands. The blueprint for what a new CLI must register **in the extension layer**.
- `copilotcli/node/copilotcliSession.ts` (~3200 lines) — per-session engine; **steering via `send({mode:'immediate'})` (`:1857`, verified)**; full SDK-event→`ChatResponseStream` translation; permission/exit-plan handling; usage/credits; **OTel + `sendMSFTTelemetryEvent('languageModelToolInvoked', ...)`** (telemetry seam, see §9).
- `copilotcli/node/copilotcliSessionService.ts` — `internal.LocalSessionManager`, `buildChatHistoryFromEvents`, watches `~/.copilot/session-state/**/*.jsonl`.
- `copilotcli/node/permissionHelpers.ts` — **auto-approve heuristics (path-scoped: workspace files, working-dir confinement, isolation-mode-aware writes)** + round-trip to `CoreConfirmationTool`/`CoreTerminalConfirmationTool`. This is the real safety mechanism, not just the picker UX.
- `copilotcli/vscode-node/inProcHttpServer.ts` + `contribution.ts` + `lockFile.ts` — IDE↔CLI **reverse** channel: in-proc MCP StreamableHTTP server over unix socket / named pipe with **nonce auth (`Authorization: Nonce <nonce>`, `inProcHttpServer.ts:185`)**, lock file written **`mode:0o600` (`lockFile.ts:58`)**, discovered via `~/.copilot/ide/<uuid>.lock`.
- `copilotcli/node/mcpHandler.ts` — **forward** channel: bridges VS Code MCP servers into the SDK via `IMcpService.startMcpGateway`.

Steering pattern: participant handler races `context.yieldRequested` (polled 100ms) against the running turn, then routes `mode:'immediate'` — depends only on the proposed API.

### 3.5 Generic chat-session-provider seams (extension contract)

A "chat session type" is a string id in `package.json` `contributes.chatSessions` (gated by `chatSessionsProvider` proposed API), backed by: (1) `lm.registerLanguageModelChatProvider` (models tagged `targetChatSessionType:'<id>'`, `vscode.proposed.chatProvider.d.ts:87`); (2) `chat.createChatParticipant`; (3) `chat.createChatSessionItemController` (list + per-session input option groups); (4) `chat.registerChatSessionContentProvider`; (5) `chat.registerChatSessionCustomizationProvider`.

Core wiring: `chatSessions.contribution.ts` (extension point + schema + auto-generated `openSessionWithPrompt.<type>`/`openNewSessionEditor.<type>`/`openNewSessionSidebar.<type>`); `chatSessionsService.ts` (`ChatSessionsService` + hard-coded `SessionType` well-known list, `:292–298`). Proposed APIs: `vscode.proposed.chatSessionsProvider.d.ts`, `.chatProvider.d.ts`, `.chatSessionCustomizationProvider.d.ts`.

### 3.6 Agents Window, SESSIONS list, chat rendering

The Agents Window is a distinct fixed-layout Electron workbench under `src/vs/sessions/` (`AX-REPO-AGENTS-WINDOW-DISTINCT-WINDOW`).

- `src/vs/sessions/browser/workbench.ts` — `.agent-sessions-workbench` (~`:744`); keyed by `IWindowSettings.isSessionsWindow`.
- `SESSIONS.md` — three-layer model: `SessionsProvidersService` (registry) + `SessionsManagementService` (model) + `SessionsViewService` (view); providers implement `ISessionsProvider` (**full contract, no optional methods**).
- `contrib/sessions/browser/views/sessionsList.ts` / `sessionsView.ts` — list tree (grouping, filter by type + agent host, status icon, workspace badge, diff stats, approval row; context keys `chatSessionType` / `chatSessionProviderId`).
- `contrib/chat/browser/chatView.ts` — `ChatView` instantiates the **standard workbench `ChatWidget`** (`ChatAgentLocation.Chat`, `isSessionsWindow:true`), loads via `IChatService.acquireOrLoadSession`, calls `lockToCodingAgent(sessionType)`. **There are ZERO `setPendingMessages` references under `src/vs/sessions/`** — the SESSIONS chat view does NOT itself call the steer verb; the wiring is in the agent-host process (`agentSideEffects.ts:1008`).
- **Rendering** is the workbench `ChatWidget`: `chatListRenderer.ts` dispatches `IChatContentPart` by kind (`markdownContent`→`ChatMarkdownContentPart`, `thinking`→`chatThinkingContentPart.ts`, `toolInvocation`→`chatToolInvocationPart.ts`, plus `textEditGroup`/`externalEdit`/subagent/terminal). **The Agents Window implements no message rendering.**
- **Claude replay**: `chatSessions/vscode-node/chatHistoryBuilder.ts` → `ChatRequestTurn2`/`ChatResponseTurn2`; `claude/common/toolInvocationFormatter.ts` maps Claude tool blocks (Bash→`ChatTerminalToolInvocationData`, Read/Glob/Grep/LS→`ChatSimpleToolResultData`, Agent/Task→`ChatSubagentToolInvocationData`; Edit/Write/MultiEdit/TodoWrite suppressed); `claudeChatSessionContentProvider.ts` bridges via `provideChatSessionContent`.

### 3.7 The terminal `agentTabs` path (to be demoted, not removed)

`agentTerminalTabbedView.ts` + new `agentTerminalActiveHighlightBridge.ts` — the "LLM CLI in a terminal tab" model (opaque pty; no structured surfacing/steering). Governed today by `AX-TERMINAL-AGENT-TABS` and the `terminal.integrated.agentTabs.enabled` flag.

### 3.8 Hard-coded single-vendor seams blocking generalization (as-is gaps)

1. **Provider hard-wired per block.** `copilotcli`/`claude-code` are hand-written parallel ~25-service DI blocks in `ChatSessionsContrib`. No registry over "an agent CLI provider" in the extension layer (the **platform** layer *does* have one — `registerProvider`).
2. **Closed well-known enum + MANY switches (main core blocker).** `src/vs/workbench/contrib/chat/browser/agentSessions/agentSessions.ts` `AgentSessionProviders` (`:14`) lists Codex (`openai-codex`) but **not Gemini/Grok**. The blocking surface is **larger than one enum** — it includes **at least six switch/predicate functions**: `isBuiltInAgentSessionProvider` (`:32`, does NOT include Codex), `getAgentSessionProvider` (`:39`, returns `undefined` for non-enum types), `getAgentSessionProviderName` (`:54`), `getAgentSessionProviderIcon` (`:75`), `isFirstPartyAgentSessionProvider` (`:96`, marks Claude+Codex NOT first-party), `getAgentCanContinueIn` (`:118`) — **plus** `SessionType` enum in `chatSessionsService.ts` (`:292–298`) and per-provider `CommandsRegistry.registerCommand` blocks in `chat/electron-browser/chat.contribution.ts` (multiple, keyed off the enum incl. `:353`). The session-list *surfacing* path (`agentSessionsModel.ts:691`, `mapSessionContributionToType` / `isBuiltInAgentSessionProvider`) already admits unknown contribution types, **but the name/icon/family/filter paths fall through to generic defaults** for non-enum providers, gating hover-widget and filter labels (`agentSessionHoverWidget.ts`, `agentSessionsFilter.ts:217`). **Codex is itself half-wired** across these switches and must be reconciled.
3. **Auth/billing/paths Copilot-specific** in the copilotcli block (`~/.copilot/...`, `copilotUsage.totalNanoAiu`, `IChatQuotaService`).
4. **Event schema is each SDK's** — translation coupled to exact SDK event names.
5. **In-process vs subprocess divergence** — Copilot drives the SDK in-process; most CLIs are spawnable binaries.
6. **Claude registries are vendor-private** (`claudeToolPermissionRegistry`, `claudeMcpServerRegistry`, `claudeSlashCommandRegistry`).
7. **Permission UI duplicated per host** — `claudePermissionModePicker.ts` + parallel `agentHostClaudePermissionModePicker.ts` hard-code Claude's modes.
8. **Model proxy is Anthropic-shaped.** `langModelServer.ts` registers only `AnthropicAdapterFactory` at `/v1/messages`. The adapter abstraction (`agents/node/adapters/types.ts`) has **exactly ONE production impl** (Anthropic); the OpenAI adapter present is `OpenAIAdapterForSTests` (**test-only, no-op `formatStreamResponse`**). **Existing BYOK providers are relevant here:** `extensions/copilot/.../byok/vscode-node/geminiNativeProvider.ts` (`@google/genai`) and `xAIProvider.ts` (OpenAI-compatible) **already implement `LanguageModelChatProvider`** for Gemini/Grok and are registered in `byokContribution.ts` (see §5.5, DN-3).
9. **Shell security primitives are vendor-coupled and transport-specific.** A 533-line tree-sitter `commandAutoApprover.ts` + `agentHostSandboxEngine.ts` + `sandboxConfigSchema.ts` (`allowUnsandboxedCommands`, `autoApproveUnsandboxedCommands`, network allow/deny) gate Copilot/Claude shell **but only for in-layer transports**. A spawn-per-turn CLI executes shell **inside the vendor process, outside this sandbox/approver** (see §10).

---

## 4. Architecture Summary

_Consolidated into §3 (Current Architecture, §3.1–§3.8)._

---

## 5. Proposed Solution

### 5.1 Overview

Introduce a formal **Agent CLI Provider** abstraction that turns "add an LLM CLI" into **declare + adapt + register**, mapping onto the **existing platform `agentService` registry** (the seam that already runs Copilot/Claude/Codex + `mockAgent`) rather than inventing a fourth registry. Three parts: a **descriptor** (declarative), a **normalized adapter** (transport + event normalization), and **consolidation onto the existing registry** (retiring the hand-copied extension DI blocks and redirecting the upstream `agentSessions.ts` switches to a fork-owned registry).

> **Thin-patch discipline (`AX-REPO-THIN-PATCH-FORK`).** P0 requires a **non-trivial, one-time upstream edit** to redirect the `agentSessions.ts` switches/enum and `chatSessionsService.ts` `SessionType` to a fork-owned registry. This is the **highest-rebase-risk change** in the plan and gets its own up-front SEAM_MANIFEST rows (see §13). New behavior lives in fork-owned dirs (`src/vs/sessions/`, the stokd provider area, `extensions/copilot/.../chatSessions/`). Calling P0 "merely widen a seam" understates it; it is honestly a redirect of multiple upstream switches.

### 5.2 Relationship to existing registries (resolves OQ-2 as a P0 prerequisite)

Three registries already exist: (1) **platform `agentService.registerProvider`** (Copilot/Claude/Codex/`mockAgent`; single seam; **has `setPendingMessages` steering + sandbox + auto-approver + server/remote parity**); (2) **sessions-layer `SessionsProvidersService`/`ISessionsProvider`** (full contract); (3) **extension `ChatSessionsContrib`** (hand-copied DI blocks; **no generic steer verb**).

**Recommendation (subject to DN-2): host the abstraction on the platform `agentHost` registry.** Rationale: it matches Codex, already exposes the only live-steering verb, has the sandbox/auto-approver, and has server/remote parity. The descriptor maps onto `registerProvider`; the extension `chatSessions` blocks are retired onto it over time. **Any provider that must support true mid-flight steering MUST be implemented in agentHost** — this is a constraint on the abstraction, not a preference.

### 5.3 The provider descriptor (declarative)

A fork-owned registry entry per provider:

```ts
interface IAgentCliProviderDescriptor {
	readonly id: string;              // session type AND URI scheme, e.g. 'gemini'
	readonly displayName: string;     // "Gemini"
	readonly family: string;          // list-filter grouping, e.g. 'google'
	readonly icon: ThemeIcon;         // FORK-REGISTERED codicon (no Codicon.gemini/grok exist; only claude/openai/copilot)
	readonly hostLayer: 'agentHost' | 'extension'; // determines steering availability + bridge (§5.2)
	readonly transport: 'sdk-inproc' | 'app-server' | 'acp' | 'spawn-per-turn';
	readonly auth: IAgentAuthDescriptor;
	readonly sessionStore: IAgentSessionStoreDescriptor;   // dir + format + watch
	readonly models: IAgentModelCatalogDescriptor;         // source + scoping (may reference BYOK provider)
	readonly billing?: IAgentBillingDescriptor;            // optional, per-provider
	readonly permissionModes: IAgentPermissionMode[];      // provider-declared
	readonly capabilities: IAgentCapabilities;             // supportsStructuredStream, supportsMidFlightSteering, images, tools, subagents...
	readonly security: IAgentSecurityDescriptor;           // bind policy, socket mode, auth scheme, auto-approve boundary (§10)
	readonly enabledSettingId: string;                     // generated; default-OFF kill switch (§5.8)
}
```

This replaces the per-literal hard-coding in §3.8 (id, scheme, paths, auth, model catalog, billing, **enable config key**, **commands**, **name/icon/family**).

### 5.4 The adapter contract (normalized) — and the steering distinction made crisp

Each provider supplies an adapter implementing the `IAgent` verbs (`listSessions`, `getSessionMessages`, `sendMessage`, **`setPendingMessages?` — optional**, `abortSession`, `changeModel`, `respondToPermissionRequest`) **plus** an `EventNormalizer` mapping native events into one shared vocabulary:

| Normalized event | Renders as (existing) |
|---|---|
| `assistant.textDelta` | `stream.markdown` → `ChatMarkdownContentPart` |
| `assistant.thinking` | `ChatResponseThinkingProgressPart` → `chatThinkingContentPart.ts` |
| `tool.start` / `tool.complete` | `ChatToolInvocationPart` (+ deferred-until-approved UI) |
| `tool.terminal` | `ChatTerminalToolInvocationData` |
| `tool.simple` | `ChatSimpleToolResultData` |
| `tool.subagent` | `ChatSubagentToolInvocationData` (nested via parent-tool-id) |
| `edit` | `textEditGroup` / `externalEdit` (diff) |
| `permission.requested` | `CoreConfirmationTool` / `CoreTerminalConfirmationTool` round-trip |
| `usage` / `title` / `error` | `stream.usage` / `onDidChangeTitle` / `errorDetails` |

The renderer (`chatListRenderer.ts`) is unchanged (NG1). **One renderer, four normalizers.**

#### 5.4.1 Steering mechanism per provider (live vs resume vs emulated) — verified

Three distinct mechanisms, do not conflate:

- **(a) Live mid-flight injection into a running turn** (true steering):
  - Codex — `turn/steer` (`codexAgent.ts:1187`, verified).
  - Copilot — `send({mode:'immediate'})` (`copilotcliSession.ts:1857`, verified; extension layer's own race, not `setPendingMessages`).
  - Claude (agentHost) — `setPendingMessages`→`injectSteering` (`claudeAgent.ts:871` + `claudeSdkPipeline.ts:317`, verified; **drops the message if no in-flight turn**).
  - Claude (extension) — `yieldRequested` poll + queue (NOT `setPendingMessages`; a different mechanism).
- **(b) Resume / fork from persisted state** (NOT steering): `forkSession` / `thread/resume` / `-s <id>`.
- **(c) Abort+resume emulation** (Grok): no live path.

**The `§5.4 "one verb, four normalizers" claim holds only if a provider is implemented in the agentHost `IAgent` layer.** Extension-layer providers steer via their own race, not the generic verb.

#### 5.4.2 Four transport adapter shapes

| Adapter | Transport | Steering | Reuses |
|---|---|---|---|
| **SDK in-proc** | dynamic-import vendor SDK | native (`send({mode:'immediate'})` / `injectSteering`) | copilotcli/claude-agentHost pattern |
| **app-server JSON-RPC** | spawn native binary, JSON-RPC/NDJSON over stdio | native (`turn/steer`) | `codexAppServerClient.ts` |
| **ACP** | spawn `--acp`, JSON-RPC over stdio | **UNVERIFIED — see §6;** treat as net-new + unverified protocol, NOT proven transport reuse | transport *plumbing* of `codexAppServerClient.ts` may be reusable; ACP handshake/methods are not in-repo |
| **spawn-per-turn** | spawn headless, parse NDJSON, resume via `-s <id>` | **emulated** (abort + resume + new prompt) | file-watch for listing |

**File-watcher + parser** is a *listing* strategy for spawn-per-turn providers; it is **not** the primary mechanism for SDK/app-server/ACP (those list via live API). **MCP adapter** covers forward (`IMcpService.startMcpGateway`, cf. `mcpHandler.ts`) and optional reverse (in-proc MCP + lock file, cf. `inProcHttpServer.ts`).

### 5.5 Model picker, permission UX — and the BYOK answer

- **Model sourcing (resolves OQ-3 toward an answer, DN-3):** model **access** is largely solved. `geminiNativeProvider.ts` (`@google/genai`) and `xAIProvider.ts` (OpenAI-compatible) already implement `LanguageModelChatProvider` and are registered in `byokContribution.ts`. The likely answer is **reuse the BYOK providers, scope via `targetChatSessionType`** — **new `langModelServer.ts` adapters are likely UNnecessary**. The editor-proxy alternative (new `IProtocolAdapter` impls: OpenAI-compatible for Codex/Grok, Google for Gemini) is **genuinely net-new production work** (the only production adapter today is Anthropic; the OpenAI one is test-only) and should only be chosen deliberately. What is missing is **wiring existing BYOK models to the new session types**, not building new adapters. **AWS Bedrock (G9, DN-3 confirmed):** Bedrock models are sourced the same way — a BYOK-style `LanguageModelChatProvider` (a dedicated Bedrock provider extension over the AWS Bedrock Runtime SDK) channels Bedrock-hosted models into the same chat surface while keeping the data/inference perimeter inside AWS. No new editor-proxy adapter is required; this is precisely why chat-default-for-all (G6/DN-1) matters — Bedrock-backed sessions get the identical chat UI rather than a terminal.
- **Model picker scoping:** generalize `DEFAULT_MODEL_PICKER_OPTIONS` so non-GitHub providers are not forced into "Auto"; `modelPicker.ts` reads `provider.getModels`/`getModelPickerOptions` reactively.
- **Permission UX (closes §3.8.7):** promote `getPermissionModes(sessionId)` + `setPermissionMode` onto `ISessionsProvider` so the composer renders **one generic picker** driven by provider-declared modes (Claude: ask/accept/plan/auto/bypass; others: their own). Replaces the duplicated Claude pickers. Permission *requests* continue round-tripping through `CoreConfirmationTool`/`CoreTerminalConfirmationTool`. **Auto-approve confinement (§10)** is the real safety mechanism, not the picker.

### 5.6 Raw / TUI terminal capabilities — handled or degraded

- **Structured-first** where a CLI exposes structured transport.
- **Opt-in terminal escape hatch (never a default).** "Open in terminal" spawns the vendor's interactive CLI (retained `agentTabs` machinery) only when the user explicitly chooses it. Reverse-channel MCP lets that terminal CLI still reach editor tools.
- **Capability flags** (`IAgentCapabilities`) drive UI: hide affordances a provider cannot honor (no live steering box for spawn-per-turn → "queued, will apply on next turn"). **Runtime detection:** when a provider's adapter omits `setPendingMessages?`, the chat box is **read-only-during-turn** and surfaces "will apply on next turn" — verified by unit test, not merely declared (AC in §8/§9).

### 5.7 Steering an in-flight session (generalized, capability-gated)

- **Control path (documented):** SESSIONS chat input → agent-host process IPC → `agentSideEffects.ts:1008` reads `state.steeringMessage` → `IAgent.setPendingMessages(...)`. The sessions-window `ChatView` does **not** call the verb directly.
- **Native steering** (agentHost Claude, Copilot extension race, Codex `turn/steer`, Gemini ACP *if verified*): chat box stays live; message injected into the running turn.
- **Emulated steering** (Grok): message queued; on confirmation (or per setting) the current run is aborted and resumed with `-s <id>` + new prompt. UI labels best-effort.
- **Absent verb:** if `setPendingMessages?` is undefined, the UI degrades to emulated/read-only-during-turn (runtime-detected).

### 5.8 Kill switches & rollback

Every new provider ships behind a **default-OFF** per-provider setting following the existing `chat.agentHost.<provider>Agent.enabled` env+setting pattern (generated from `descriptor.enabledSettingId`). P4 terminal demotion is gated behind a **revertible setting (no rebuild to roll back)**.

### 5.9 Seamless resume parity (G8)

A resumed session must be **indistinguishable from one that never stopped.** The user clicks any listed session — whether its backing process is live or long-since-exited — and gets full history plus an interactive composer with **no separate "Resume" affordance**.

- **Transparent resume-then-continue.** When the user sends into a not-currently-running session, the adapter first resumes the backing session (SDK `forkSession` / `thread/resume` / `-s <id>`) and then proceeds with the new turn in one motion. The resume step is an implementation detail, never a user-visible mode.
- **Capability mapping.** For live-steering providers (agentHost Claude, Copilot, Codex, Gemini-if-verified) a resumed session that becomes active accepts mid-flight steering exactly like a never-stopped one; for emulated providers (Grok) the new message is queued and applied on the resumed turn.
- **Lazy hydration.** History loads from persisted session state on click (no need to keep processes warm); the adapter spawns/attaches the backing process only when the user actually sends. Idle cost stays at zero while preserving the live-parity illusion.
- **State fidelity.** Model selection, permission mode, and working-dir/worktree are restored from the persisted session so the resumed turn runs under the same configuration. Where a backend cannot restore a field, it is surfaced, not silently defaulted.

This goal is **cross-cutting**: P0 builds transparent resume-then-continue into the session model/registry; each provider phase verifies live-parity for its transport (AC in §8; DoD-11 in §12).

---

## 6. Per-Provider Plan

Tier criterion is explicit: **STRONG = code exists in-tree and is tested; everything else is a research bet** distinguished only by how much external evidence exists.

| Provider | Tier | Transport / adapter | Listing | Resume (persisted) | Live steering | Status today | Hedges |
|---|---|---|---|---|---|---|---|
| **Claude** (Anthropic) | **STRONG (shipping)** | SDK in-proc (`@anthropic-ai/claude-agent-sdk`) + Anthropic `/v1/messages` proxy | SDK `listSessions` | SDK `forkSession` | **Native — agentHost path only** (`injectSteering`); extension path uses yield/queue | Live | Premise correction: resume uses SDK `forkSession`; **live steering is agentHost `setPendingMessages`→`injectSteering`, a different file/layer than the extension `claudeCodeSdkService`**. jsonl parser dormant + structurally insufficient. Disambiguate which proxy serves which impl |
| **Copilot CLI** | **STRONG (shipping)** | SDK in-proc (`@github/copilot/sdk`, `LocalSessionManager`) | watch `~/.copilot/session-state/**` + SDK | SDK replay | **Native** (`send({mode:'immediate'})`) — extension-layer race | Live | Billing/quota/paths Copilot-specific; keep in provider block |
| **Codex** (OpenAI) | **STRONG (near-done)** | spawn `codex app-server`, JSON-RPC/NDJSON | `thread/*` | `thread/resume` | **Native** (`turn/steer`) | Substantially implemented in agentHost; 5 test files + 87 generated types | In agentHost layer (has steer + sandbox). **Half-wired across `agentSessions.ts` switches — P2 must reconcile, not just "register."** Model sourcing is OQ-3/DN-3 (gate, not floating). Re-verify `exec --json` schema + `~/.codex/sessions` at build time |
| **Gemini** (Google) | **UNVERIFIED — external-protocol bet** (STRONG *iff* ACP verified, else MODERATE via SDK/headless) | ACP client over JSON-RPC/stdio (`gemini --acp`) — **net-new + unverified protocol** | `--list-sessions`/`--resume` or file-watch `~/.gemini/tmp/<hash>` | `loadSession`/`--resume` | **UNVERIFIED — may be emulated.** Whether a second `prompt` mid-turn *injects* vs *queues* is the live-vs-resume question and must be proven by a spike | **Zero in-tree code.** Rests entirely on external docs (Jan-2026 cutoff, no live web). Pin gemini-cli version; `--acp` vs `--experimental-acp`, `unstable_setSessionModel` evolving. **Models likely via existing BYOK `geminiNativeProvider.ts`.** Not in `AgentSessionProviders` |
| **Grok** (xAI / `superagent-ai/grok-cli`) | **DISCOVERY-REQUIRED** | spawn-per-turn headless | file-watch (path **undocumented**) or `--session latest` | `-s <id>` | **Emulated only** (abort+resume) | **Zero in-tree code.** No SDK/ACP/IPC | **Chat-first (G6/DN-1) — NOT terminal-first.** On-disk path/format, headless output flag, AND resume flag are all **discovery tasks**. Shell runs inside the vendor process, outside the existing sandbox/approver (§10) — **addressed by DN-4: default-deny auto-approve + per-command confirmation.** Models likely via existing BYOK `xAIProvider.ts`. Not in `AgentSessionProviders` |
| **AWS Bedrock** (models) | **STRONG (BYOK pattern)** | BYOK `LanguageModelChatProvider` over the Bedrock Runtime SDK — a **model source**, not an agentic CLI | n/a (supplies models to chat sessions/agents) | n/a | n/a (inherits the steering of whichever agent uses the model) | BYOK pattern proven (`geminiNativeProvider.ts` / `xAIProvider.ts`); a Bedrock provider is the new work | Bedrock is a **model backend** surfaced in the same chat (DN-3/G9), keeping the data perimeter in AWS; **chat-first by construction (G6/DN-1)**. AWS auth/region/profile config is Bedrock-specific |

**Cross-cutting hedge:** all four external CLIs move fast (Jan-2026 cutoff; web search unavailable during research). **Pin every CLI version; re-verify flag/SDK/schema names at implementation time via the contract-test harness (§9.3), not by hand.**

**Recommended risk-ordered sequencing (inverts the draft's prose):** **P2 Codex first** (lowest risk: already in the agentHost layer with verified `turn/steer`+`thread/resume`+`turn/interrupt`, 5 tests, 87 generated types — validates the registry on in-tree code before betting it on an unverified external protocol) → **P1 Gemini** (ACP spike-gated) → **P3 Grok** (discovery-gated, emulated steering) → **P5 Bedrock** (BYOK model access; independent of the agentic-CLI work — can run in parallel any time after P0). The phase numbers below preserve dependency structure; the *execution order* is **P0 → P2 → P1 → P3 → (P5) → P4**.

---

## 7. UX & UI Requirements

### 7.1 SESSIONS list

- **R7.1.1** — Every provider's sessions appear (`sessionsList.ts`), grouped (Pinned / by workspace-or-date / Done), namespaced by URI scheme.
- **R7.1.2** — Filter by agent type/family via `chatSessionType`/`chatSessionProviderId` context keys; each CLI registers a distinct type id + family.
- **R7.1.3** — **Per-family iconography is a HARD P0 dependency, not a P1+ nicety** (the `getAgentSessionProviderIcon` switch returns no icon for non-enum providers). **No `Codicon.gemini`/`Codicon.grok` exist today** (only claude/openai/copilot) → **fork-register codicons in P0**.
- **R7.1.4** — Status / diff stats / approval row work for all providers.
- **R7.1.5 — Degraded states.** A provider whose CLI is missing / version-mismatched / handshake-failed / port-in-use shows an **actionable disabled state, not a silent empty list**.

### 7.2 Chat rendering for arbitrary CLIs

- **R7.2.1** — Each provider supplies a history builder + tool formatter emitting existing `ChatResponsePart`/`ChatToolInvocationPart` shapes. Renderer unchanged.
- **R7.2.2** — Required parts: assistant markdown, thinking, tool invocation (terminal/simple/subagent), edit-group/diff, subagent inlining via parent-tool-id, per-CLI suppression/formatting table.
- **R7.2.3** — **Streaming parity.** Live updates flow through `onDidChangeSessions` + streaming tool states (`isStreaming`/`isComplete`).

### 7.3 Per-agent input controls

- **R7.3.1** — Shared model picker scoped to the provider's catalog.
- **R7.3.2** — Generic permission-mode picker driven by provider-declared modes, hosted in `Menus.NewSessionConfig`.
- **R7.3.3** — Folder/worktree/branch isolation (reuse `IChatSessionWorktreeService`, `ISessionRequestLifecycle`, checkpoint service).
- **R7.3.4** — `canSendRequest` gating applies uniformly.

### 7.4 Steering an in-flight session

- **R7.4.1** — Chat input stays interactive for providers with verified `supportsMidFlightSteering`.
- **R7.4.2** — Emulated-steering providers accept a message and show "will apply on next turn" (or abort+resume per setting), clearly labeled.
- **R7.4.3** — Stop/abort available for all (`abortSession`/`cancel`/`turn/interrupt`).
- **R7.4.4** — When `setPendingMessages?` is absent at runtime, the box is read-only-during-turn (runtime-detected, unit-tested).
- **R7.4.5 (seamless resume, G8)** — Clicking a not-currently-running session opens it with full history and an interactive composer and **no separate "Resume" control**; the first send transparently resumes the backing session and continues. A resumed session is visually and behaviorally indistinguishable from a live one (model / permission mode / worktree restored).

---

## 8. Phased Delivery Plan

Falsifiable milestones. Behavior changes in fork-owned code follow **TDD (`AX-REPO-FORK-TDD-SCOPE`)** — failing test first. Upstream redirects are recorded in the new SEAM_MANIFEST (§13). **Execution order is P0 → P2 → P1 → P3 → P4** (risk-ordered).

### P0 — Abstraction extraction + registry consolidation (foundation; highest rebase risk)

- **Scope:** Define `IAgentCliProviderDescriptor`, the `EventNormalizer` vocabulary, and a fork-owned **provider registry mapped onto the existing platform `agentService`**. **Redirect ALL upstream switches** to read from the registry: `agentSessions.ts` (`isBuiltInAgentSessionProvider`, `getAgentSessionProvider`, `getAgentSessionProviderName`, `getAgentSessionProviderIcon`, `isFirstPartyAgentSessionProvider`, `getAgentCanContinueIn`), `SessionType` (`chatSessionsService.ts:292–298`), and the per-provider `CommandsRegistry.registerCommand` block in `chat.contribution.ts`. **Generate per-provider enable config keys + auto-generated commands from the descriptor** (replacing hand-written `AgentHostClaudeAgentEnabledSettingId` etc.). Extract a shared base for the per-type registration that copilotcli/claude-code hand-copy. Generalize `DEFAULT_MODEL_PICKER_OPTIONS`; promote `getPermissionModes`/`setPermissionMode` onto `ISessionsProvider`. **Fork-register Gemini/Grok codicons.** Resolve DN-2 (host layer) before coding.
- **Dependencies:** none. **Resolves OQ-2/DN-2 as a prerequisite.**
- **Acceptance criteria:**
  - **AC-P0.1** — Claude and Copilot CLI re-registered through the registry/descriptor with no behavior change (golden snapshot of session list + a replayed session byte-identical).
  - **AC-P0.2** — A no-op test provider via `mockAgent` appears in the SESSIONS list **and the session-type picker with a proper name, fork-registered icon, and family filter** — without editing any upstream enum/switch *after P0*.
  - **AC-P0.3** — `valid-layers-check` passes; the new SEAM_MANIFEST records every redirected upstream switch/file (§13).
  - **AC-P0.4 (security)** — The descriptor carries `IAgentSecurityDescriptor`; a registry consistency test rejects a provider with a non-loopback bind policy or missing auth scheme (§10).
  - **AC-P0.5 (telemetry)** — A registered provider emits the normalized turn-lifecycle vocabulary (§9) through the existing emitters, verified by a recorded-event test.
- **Key risks:** **highest-rebase-risk** redirect of multiple upstream switches; keep diff minimal; do not regress existing pickers.

### P2 — Codex (validate the registry on in-tree code; execute FIRST after P0)

- **Scope:** Bring `codexAgent.ts` onto the P0 registry/descriptor; **reconcile Codex across all `agentSessions.ts` switches** (it is half-wired); wire history builder/tool formatter into the normalized vocabulary; QA steer/resume/abort. **Resolve Codex model sourcing (DN-3) as a gate.**
- **Dependencies:** P0.
- **Acceptance criteria:**
  - **AC-P2.1** — Codex list/click/resume/steer/abort all work via the registry (createSession→`thread/start`, steer→`turn/steer`, abort→`turn/interrupt`, resume→`thread/resume`).
  - **AC-P2.2** — Codex renders structured tool/thinking/text parts through the shared normalizer.
  - **AC-P2.3** — Codex appears consistently across name/icon/family/first-party/continue-in (the half-wiring is reconciled).
  - **AC-P2.4 (contract test)** — A pinned-version smoke test asserts `exec --json` event schema + `~/.codex/sessions` format; CI fails on drift.
- **Key risks:** doc drift; protocol regeneration (`npm run codex:gen-protocol`; generated types never hand-edited).

### P1 — Gemini via ACP (proof of generalization on a non-incumbent; spike-gated)

- **Scope:** **Spike gate FIRST:** build a throwaway ACP handshake against a pinned gemini-cli and **confirm a second `prompt` mid-turn INJECTS vs QUEUES**. If it queues, Gemini drops to **emulated** steering (like Grok) and/or falls back to SDK/headless. Then implement the ACP adapter (+ descriptor, history builder/tool formatter, model catalog via BYOK `geminiNativeProvider.ts`, permission modes).
- **Dependencies:** P0. (P2 strongly recommended first to de-risk the registry.)
- **Acceptance criteria:**
  - **AC-P1.0 (spike gate)** — Documented result of the live-vs-resume spike against a pinned version; the steering tier is set from this evidence (not assumed).
  - **AC-P1.1** — A `gemini --acp` session appears, is clickable, replays full history with thinking/tool parts, and streams a live turn incrementally.
  - **AC-P1.2** — *If* AC-P1.0 confirms injection: mid-flight steering verified against the pinned version. Otherwise emulated steering is labeled and verified.
  - **AC-P1.3** — Model picker shows only Gemini models; permission picker shows Gemini-declared modes.
  - **AC-P1.4 (telemetry)** — A Gemini turn emits the same normalized turn-lifecycle events as Claude, verified by a recorded-event test.
- **Key risks:** ACP method/flag instability — pin version; fallbacks `@google/gemini-cli-sdk` or headless `--output-format stream-json`.

### P3 — Grok (spawn-per-turn, emulated steering; discovery-gated)

- **Scope:** **Discovery task FIRST:** determine on-disk session path/format, headless output flag, and resume flag against a pinned grok-cli. Then implement the spawn-per-turn adapter + file-watch listing + descriptor. Deliver list + click-to-resume + streaming; steering emulated.
- **Dependencies:** P0; benefits from P1's normalizer.
- **Acceptance criteria:**
  - **AC-P3.0 (discovery gate)** — Storage path/format + flags documented and pinned before committing to file-watch listing.
  - **AC-P3.1** — Grok sessions appear and replay/stream.
  - **AC-P3.2** — Resume via `-s <id>` works from a click.
  - **AC-P3.3** — Emulated steering labeled best-effort and verifiably aborts+resumes.
  - **AC-P3.4 (security)** — Grok's shell runs outside the existing sandbox/approver; either auto-approve is **default-deny** with explicit per-command confirmation, or Grok ships **terminal-first** (§10, DN-4).
- **Key risks:** undocumented storage; no true steering (NG5).

### P4 — Make chat the default for ALL providers; terminal becomes an opt-in escape hatch (coexist)

- **Scope:** Make the chat-session surface the **default for ALL provider launches** (Claude, Copilot, Codex, Gemini, Grok, and Bedrock-backed sessions); demote `agentTerminalTabbedView.ts` to an explicit, **opt-in** "Open in terminal" escape hatch that is **never a default for any provider**. **Deprecation mechanics:** decide and document whether `terminal.integrated.agentTabs.enabled` is **retained / repurposed / removed**; deprecation timeline; user-facing messaging; migration of in-flight terminal sessions; **revertible default-surface setting (no rebuild rollback)**. Preserve the IDE↔CLI MCP reverse channel.
- **Dependencies:** P1–P3 (≥2 new providers proven before demoting); P5 (Bedrock) is independent.
- **Acceptance criteria:**
  - **AC-P4.1** — Default launch for **every** provider (incl. Grok and Bedrock-backed sessions) opens an Agents Window chat session, not a terminal tab; behind a revertible setting.
  - **AC-P4.2** — "Open in terminal" still works and the terminal CLI still reaches editor tools via the reverse-channel lock file.
  - **AC-P4.3** — Frozen terminal behaviors documented: existing `agentTabs` tests pass for the **contractually frozen** escape-hatch behaviors (launch, reverse-channel, highlight bridge); behaviors explicitly allowed to deprecate are listed.
  - **AC-P4.4** — Deprecation flag decision is implemented and documented; in-flight terminal sessions migrate or are explicitly out-of-scope with a stated reason.
- **Key risks:** users relying on TUI-only features → mitigated by the retained opt-in terminal escape hatch + capability flags + reverse-channel MCP.

### P5 — AWS Bedrock model access (BYOK; chat-first; parallelizable after P0)

- **Scope:** Ship a Bedrock **BYOK `LanguageModelChatProvider`** (over the AWS Bedrock Runtime SDK), registered like `geminiNativeProvider.ts` / `xAIProvider.ts` and scoped via `targetChatSessionType`, so Bedrock-hosted models are selectable in the same chat surface (G9). AWS auth via the existing credential chain (profile / region / SSO); the data/inference perimeter stays in AWS. No new editor-proxy adapter; no terminal path.
- **Dependencies:** P0 (descriptor + model-picker generalization). Independent of P1–P3; may run in parallel.
- **Acceptance criteria:**
  - **AC-P5.1** — Bedrock models appear in the model picker for chat sessions and complete a streaming turn rendered through the unchanged `ChatWidget`.
  - **AC-P5.2** — Model calls go to the Bedrock endpoint via the AWS SDK and do not leave the AWS perimeter (verified by a network-assertion/unit test against a mocked Bedrock client).
  - **AC-P5.3** — AWS auth resolves via the standard credential chain (profile / region / SSO); a missing/invalid credential surfaces an actionable degraded state (R7.1.5), not a silent failure.
  - **AC-P5.4** — Bedrock sessions are chat-first: no terminal launch path is introduced (G6/DN-1).
- **Key risks:** AWS SDK / region / model-id drift → pin SDK + model ids + contract-style smoke test; per-account/region catalog variance → discover the catalog at runtime and surface only enabled models.

---

## 9. Telemetry & Observability

### 9.1 Normalized telemetry vocabulary

A telemetry vocabulary **parallel to the EventNormalizer**, owned by the fork, mapped onto existing emitters (`sendMSFTTelemetryEvent` — cf. `copilotcliSession.ts` `languageModelToolInvoked`; the OTel span processor `copilotCliBridgeSpanProcessor.ts` / `missionControlApiClient.ts`):

| Telemetry event | Emitted on |
|---|---|
| `agentcli.turn.start` / `agentcli.turn.complete` | turn lifecycle |
| `agentcli.turn.steer` | live injection or emulated steer |
| `agentcli.turn.abort` | abort/interrupt/cancel |
| `agentcli.tool.invoked` | tool start (maps to existing `languageModelToolInvoked`) |
| `agentcli.permission.requested` / `.resolved` | approval round-trip |
| `agentcli.error` | adapter/transport/handshake failure |

### 9.2 Requirements

- **R9.1** — Every transport reports the same turn-lifecycle events uniformly (the normalizer owns this; per-provider transports must not invent ad-hoc events).
- **R9.2** — **PII/prompt-content classification:** prompt text and file paths are GDPR-classified and **gated on telemetry level**; never emit raw prompt/file content on a default-on event.
- **R9.3** — Respect the workbench telemetry level / opt-out.
- **R9.4** — Per-phase telemetry AC (e.g. AC-P0.5, AC-P1.4) verified by recorded-event tests.

### 9.3 Failure & degraded-state observability + external-CLI contract tests

- **R9.5 — Failure surfaces:** binary-missing / version-mismatch / handshake-failure / port-in-use map to defined SESSIONS-list degraded states (R7.1.5).
- **R9.6 — Contract-test harness (makes R1/R2/R3 concrete):** a **pinned-version smoke test per provider** (modeled on `src/vs/platform/agentHost/test/node/protocol/toolApproval.integrationTest.ts` / `realSdkTestHelpers.ts`) asserting flag names, SDK exports, and on-disk schema; **fails CI on drift** so vendor churn is caught at build, not by users. (CLIs are not in CI by default; the harness runs against pinned, cached binaries where available, and is skipped-with-warning otherwise.)

---

## 10. Security & Trust Boundary

The only security mention in the draft was permission round-trips; the real surface is larger and already present in code.

### 10.1 Security model per transport (who enforces approval/sandbox)

| Transport | Tool-approval enforced by | `commandAutoApprover.ts` + `agentHostSandboxEngine.ts` apply? | Residual risk |
|---|---|---|---|
| **sdk-inproc** (Claude/Copilot) | in-layer permission round-trip + auto-approver | **Yes** | low — within existing engine |
| **app-server** (Codex) | agentHost permission round-trip | **Yes** (in agentHost layer) | low |
| **acp** (Gemini) | ACP permission callbacks (if exposed) → round-trip | **Partial — unverified;** depends on whether the CLI exposes a permission hook | medium — verify hook exists in P1 spike |
| **spawn-per-turn** (Grok) | **the vendor CLI itself — OUTSIDE our sandbox/approver**, mitigated by **default-deny + per-command confirmation (DN-4)** | **NO** (engine) — per-command confirmation instead | **Medium — mitigated by DN-4** |

**Statement:** spawn-per-turn + emulated-steering providers **cannot be sandboxed by the existing engine unless the CLI exposes a permission hook.** **Mitigation (DN-4 — resolved by the user): default-deny auto-approve + per-command confirmation** (use the CLI's permission-hook flag where one exists). **Terminal-first is NOT used** — Grok is chat-first per G6/DN-1.

### 10.2 Local transport confinement (descriptor `IAgentSecurityDescriptor`)

Mirror the existing primitives:
- **Bind policy: loopback-only (`127.0.0.1`).** The Anthropic proxy binds an ephemeral port with **no auth, loopback-only** (`langModelServer.ts:325` `listen(0,'127.0.0.1')`). **Acceptable only on loopback; 0.0.0.0 binds are forbidden** (registry consistency test rejects them, AC-P0.4).
- **Socket/auth:** reverse-channel uses unix socket / named pipe with **nonce auth** (`inProcHttpServer.ts:185`) and lock file **`mode:0o600`** (`lockFile.ts:58`). New local transports declare bind policy, socket mode, and auth scheme.
- **Env hygiene:** spawned binaries' env (vendor tokens, `ANTHROPIC_BASE_URL`-equivalents) is not leaked beyond the child.
- **Command-injection:** spawn-per-turn arg construction (`-s <id>`, `--prompt`) uses **args arrays, never `shell:true`**.

### 10.3 Auto-approve confinement contract (generalizes `permissionHelpers.ts`)

- **R10.1** — Each provider declares its auto-approve boundary (workspace / working-dir, isolation-mode aware).
- **R10.2** — **A write outside the session working dir is never auto-approved, regardless of provider** (AC, enforced in tests).
- **R10.3** — **Threat statement:** `bypass`/`auto` permission modes on shell-capable CLIs are **RCE-by-design**. Bypass mode is **OFF by default** and **visibly indicated** in the UI.

---

## 11. Decisions — RESOLVED by the user (recorded 2026-06-21)

The user reviewed the open questions and **accepted all PRD recommendations except DN-1** (terminal default), which was overridden to chat-first for every provider.

- **DN-1 — Replace vs coexist (the central one).** **DECISION: OVERRIDDEN → chat is the default surface for ALL providers; the terminal is an opt-in escape hatch, never a default** (incl. Grok and Bedrock-backed models). Reason (user): the project also surfaces AWS Bedrock models, and a terminal default would give them — and any structured-transport-lacking provider — an inconsistent, lower-quality UI; the goal is one uniform chat surface. Drives G6, §0, §1.3, §5.6, §5.9, §8 (P4), and §6.
- **DN-2 — Host layer for the abstraction (P0 prerequisite, forced fork).** **DECISION: ACCEPT** — host on the **platform `agentHost` registry** (the only layer with live `setPendingMessages` steering + sandbox + server/remote parity); retire the extension DI blocks onto it. Any provider needing true mid-flight steering MUST live in agentHost.
- **DN-3 — Model sourcing.** **DECISION: ACCEPT** — **reuse existing BYOK `LanguageModelChatProvider`s** scoped via `targetChatSessionType`; **no new editor-proxy adapters.** Extends to **AWS Bedrock**, shipped as a BYOK Bedrock provider (G9, §8 P5) keeping the data perimeter in AWS.
- **DN-4 — Grok shell security.** **DECISION: option (c) — default-deny auto-approve + per-command confirmation** (use a CLI permission-hook flag where one exists). **Terminal-first (option a) is explicitly NOT used** (consequence of DN-1). See §10.
- **DN-5 — Grok steering tier.** **DECISION: ACCEPT** — ship Grok with **emulated** steering (NG5); do not defer. Seamless-resume parity (G8) still applies — the queued message is applied on the resumed turn.
- **DN-6 — Shared registries.** **DECISION: ACCEPT** — extract the Claude-private slash-command / tool-permission / MCP / hook registries into a vendor-agnostic agent-runtime layer for uniform hooks/MCP/permissions across all providers.
- **DN-7 — Session-list merge semantics.** **DECISION: ACCEPT** — default group by workspace/date, sort by last-activity, with per-family filter chips at GA (URI scheme namespaces).
- **DN-8 — Codex family grouping.** **DECISION: ACCEPT** — surface Codex as a **distinct family** (not folded under a generic "OpenAI" grouping).
- **DN-9 — Axiom & SEAM_MANIFEST.** **DECISION: ACCEPT** — add the new **`AX-AGENT-CLI-PROVIDER-REGISTRY`** axiom and a **new SEAM_MANIFEST** section (the existing one is scoped to `AX-TERMINAL-AGENT-TABS` and cannot absorb these edits) — see §13.

---

## 12. Acceptance Criteria / Definition of Done (overall, falsifiable)

- **DoD-1** — All five providers appear in the SESSIONS list, are filterable by family (with proper name + fork-registered icon), and are clickable to replay full structured history.
- **DoD-2** — Claude (agentHost), Copilot, Codex support **verified true mid-flight steering**; **Gemini supports true steering only if the P1 spike (AC-P1.0) confirms injection, otherwise emulated**; Grok supports **emulated** steering, clearly labeled. (No DoD line asserts unverified steering as guaranteed.)
- **DoD-3** — Adding a *sixth* provider requires **only** a descriptor + adapter + `package.json` contribution and **zero NEW per-provider upstream edits after the one-time P0 seam** (verified by AC-P0.2, including proper name/icon/family — not a nameless degraded row).
- **DoD-4** — Each provider's model picker is scoped to its own models; each provider's permission picker is driven by provider-declared modes (no Claude-specific picker remains).
- **DoD-5** — Chat rendering for all providers uses the unchanged workbench `ChatWidget` renderer (NG1).
- **DoD-6** — Chat is the default surface for **ALL** providers (incl. Grok and Bedrock-backed sessions); the terminal "Open in terminal" escape hatch is **opt-in only** and the IDE↔CLI MCP reverse channel remains functional; default-surface change is revertible by setting.
- **DoD-7 (security)** — No transport binds non-loopback; bypass mode is off by default and visibly indicated; a write outside the session working dir is never auto-approved; Grok's shell-security decision (DN-4) is implemented.
- **DoD-8 (telemetry)** — Every provider emits the normalized turn-lifecycle vocabulary respecting telemetry level; no raw prompt/file content on default-on events.
- **DoD-9 (testing)** — Per-provider `EventNormalizer` golden-fixture tests and the adapter contract suite pass; external-CLI contract tests fail CI on drift; new fork behavior is TDD-covered (`AX-REPO-FORK-TDD-SCOPE`).
- **DoD-10 (process)** — `valid-layers-check` passes; Agents Window remains a distinct window; `product.json` identity unchanged; the new SEAM_MANIFEST records every redirected upstream seam under the new axiom; correlated file watchers used (not shared).
- **DoD-11 (seamless resume, G8)** — Clicking a not-currently-running session of any provider yields full history + an interactive composer with **no separate "Resume" step**; the first send transparently resumes and continues; a resumed session is indistinguishable from a live one (model / permission mode / worktree restored). Verified per provider.
- **DoD-12 (Bedrock, G9)** — AWS Bedrock models are selectable in the chat surface via a BYOK provider; model calls stay within the AWS perimeter; no terminal path is introduced.

---

## 13. Axiom & SEAM_MANIFEST Accounting

- **Governing axioms:** `AX-REPO-AGENTS-WINDOW-DISTINCT-WINDOW`, `AX-REPO-THIN-PATCH-FORK`, `AX-REPO-FORK-TDD-SCOPE`, `AX-REPO-VENDORED-AHP-PROTOCOL` (generated protocol types never hand-edited — applies to Codex + any ACP code-gen).
- **Proposed new axiom: `AX-AGENT-CLI-PROVIDER-REGISTRY`** — "new LLM-CLI providers register via the fork-owned Agent CLI Provider registry mapped onto the platform `agentHost` `agentService`; upstream `agentSessions.ts` switches and `SessionType` read from this registry; no per-provider upstream edits after the one-time seam." (Decision: DN-9.)
- **SEAM_MANIFEST decision:** the **checked-in `SEAM_MANIFEST.md` is scoped to `AX-TERMINAL-AGENT-TABS`** (the agent-aware terminal selector; accounts for exactly **one** upstream file `terminalView.ts` plus rebrand seams) and **cannot silently absorb this work.** Create a **new manifest (or new clearly-scoped section)** under `AX-AGENT-CLI-PROVIDER-REGISTRY`.
- **Upstream files this work redirects (must each get a manifest row in P0):**
  - `src/vs/workbench/contrib/chat/browser/agentSessions/agentSessions.ts` — `AgentSessionProviders` enum + six switches (`isBuiltInAgentSessionProvider`, `getAgentSessionProvider`, `getAgentSessionProviderName`, `getAgentSessionProviderIcon`, `isFirstPartyAgentSessionProvider`, `getAgentCanContinueIn`).
  - `src/vs/workbench/contrib/chat/common/chatSessionsService.ts` — `SessionType` (`:292–298`).
  - `src/vs/workbench/contrib/chat/electron-browser/chat.contribution.ts` — per-provider `CommandsRegistry.registerCommand` block (incl. `:353`).
  - `src/vs/platform/agentHost/common/agentService.ts` — generated enable config keys (replacing hand-written constants `:71`/`:79`).
- **Rebase-risk note:** P0 is the **highest-rebase-risk** change (it edits inherited-upstream chat-session files). R8 (rebase surface) is bounded to these seams; the dominant churn risk is **R1 (vendor CLI drift, High)**, mitigated by the §9.3 contract-test harness.

---

## 14. Risks & Mitigations

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | External CLI flags/SDKs/schemas drift (Jan-2026 cutoff; no live web during research) | **High** | Pin every CLI version; **contract-test harness fails CI on drift (§9.3)**; capability-flag-gate UI |
| R2 | Gemini ACP unverified — flag spelling, `unstable_` methods, live-vs-resume semantics | **High** | **P1 spike gate (AC-P1.0)** before committing; fallbacks `@google/gemini-cli-sdk` / headless; tier conditional on spike |
| R3 | Grok has no SDK/ACP/IPC; storage/flags undocumented; shell outside sandbox | **High (security)** | Discovery gate (AC-P3.0); **DN-4 shell-security decision**; emulated steering (NG5) |
| R4 | Live-vs-resume conflation leads to over-promising steering | **High** | §5.4.1 names the verb + layer per provider; DoD-2 ties steering to verification |
| R5 | Redirecting the many `agentSessions.ts` switches regresses pickers / increases rebase cost | Med-High | TDD + golden snapshots (AC-P0.1); enumerate every switch (§13); minimal diff |
| R6 | Wrong host-layer choice removes steering for new providers | Med-High | DN-2 forced decision; recommend agentHost (only layer with `setPendingMessages`) |
| R7 | Spawn-per-turn shell bypasses sandbox/approver (RCE surface) | **High** | §10.1 table; default-deny / permission-hook / terminal-first (DN-4); bypass off by default |
| R8 | In-proc-SDK vs subprocess divergence complicates one adapter contract | Med | Four explicit transport shapes (§5.4.2); shared normalizer, not shared transport |
| R9 | Per-provider event schemas don't map cleanly | Med | Per-provider normalizer + golden-fixture tests; per-CLI suppression table; fall back to "Used tool: X" |
| R10 | Telemetry leaks prompt/file content | Med | GDPR classification + telemetry-level gating (§9.2); no raw content on default-on events |
| R11 | Aggregated multi-provider list perf (103k ws dirs; known agent-row ps-walk regression; 5× file watchers) | Med | **Correlated watchers (`fileService.createWatcher`, not shared)**; list-refresh budget AC; avoid ps-walk keying |
| R12 | Heterogeneous session list has unspecified sort/merge | Low-Med | DN-7; URI scheme namespaces |
| R13 | Billing/quota Copilot-specific leaks into shared code | Low | Billing optional in descriptor; isolate in Copilot block |
| R14 | New providers ship without a kill switch | Low | Default-OFF per-provider setting (§5.8); revertible P4 default-surface setting |
| R15 | Users depend on raw-TUI-only features | Low-Med | Retained terminal peer + reverse-channel MCP + per-tier policy (DN-1) |

---

## 15. Performance & Scale

- **R15.1** — Define a **SESSIONS-list aggregation budget** with N providers enabled (list-refresh cost bounded; AC).
- **R15.2** — **Mandatory correlated file watchers** (`fileService.createWatcher`, not shared) for every provider watching an on-disk session dir (`~/.copilot/session-state/**`, `~/.gemini/tmp/<hash>`, `~/.codex/sessions`, undocumented grok path).
- **R15.3** — Do not re-introduce the known agent-row `ps`-walk regression (wrong-pid keying); list/row rendering must not ride a process walk.

---

## 16. Testing Strategy (`AX-REPO-FORK-TDD-SCOPE`)

Make the established pattern normative:

- **Convention:** DOM-free `node:test`, **AC-numbered** test cases, **dependency injection of fakes** (no global stubs, no `any` casts — per the CLAUDE.md learning: make the dependency injectable via an optional constructor param defaulting to the real impl).
- **R16.1 — EventNormalizer golden-fixture test (highest leverage):** record real CLI events → assert normalized output via a **single `assert.deepStrictEqual` snapshot** per provider.
- **R16.2 — Adapter contract suite:** every adapter passes a shared list/resume/steer/abort/permission round-trip suite **against a mock transport**.
- **R16.3 — Capability-degradation test:** when `setPendingMessages?` is omitted, the chat box is read-only-during-turn and surfaces "will apply on next turn" — unit-tested.
- **R16.4 — External-CLI contract tests:** §9.3 pinned-version smoke tests fail CI on drift.
- **R16.5 — Generated protocol types** (Codex; any ACP code-gen) are **never hand-edited** (`AX-REPO-VENDORED-AHP-PROTOCOL`); regeneration is part of the build.

---

## 17. Appendix

### 17.1 Key files / seams reference

| Concern | File | Role |
|---|---|---|
| Provider-agnostic agent contract | `src/vs/platform/agentHost/common/agentService.ts` | `IAgent` verbs; **`setPendingMessages?` OPTIONAL `:828`**; enable keys `:71`/`:79`; `AgentProvider=string` |
| Registration seam (desktop) | `src/vs/platform/agentHost/node/agentHostMain.ts` | `registerProvider` Copilot `:183` / Claude `:197` / Codex `:200` |
| Registration seam (server) | `src/vs/platform/agentHost/node/agentHostServerMain.ts` | same + `mockAgent` `:311` |
| Live-steer wiring | `src/vs/platform/agentHost/node/agentSideEffects.ts` | `:1008` reads `state.steeringMessage` → `IAgent.setPendingMessages` |
| Codex provider (template) | `src/vs/platform/agentHost/node/codex/codexAgent.ts` | spawn `app-server`; `turn/steer` `:1187` |
| Reusable JSON-RPC/NDJSON transport | `src/vs/platform/agentHost/node/codex/codexAppServerClient.ts` | transport plumbing (ACP handshake NOT in-repo) |
| Codex protocol gen | `build/codex/generate-protocol.mjs` + `codex/protocol/generated/` | 87 types; never hand-edited |
| agentHost Claude steering | `claude/claudeAgent.ts:871` + `claudeSdkPipeline.ts:317` | `setPendingMessages`→`injectSteering` (**true live steer; drops if no in-flight turn**) |
| Extension Claude SDK service | `extensions/copilot/.../claude/node/claudeCodeSdkService.ts` | `forkSession` (RESUME/FORK only — **no steer**) |
| Extension Claude session service | `.../claude/node/sessionParser/claudeCodeSessionService.ts` | SDK-first list/load |
| Dormant jsonl parser | `.../claude/node/sessionParser/claudeSessionParser.ts` | **dormant + structurally insufficient for live steer** |
| Copilot CLI reference block | `extensions/copilot/.../chatSessions/vscode-node/chatSessions.ts` | extension-layer registration blueprint |
| Copilot session engine | `.../copilotcli/node/copilotcliSession.ts` | event→stream; steer `:1857`; telemetry `languageModelToolInvoked` |
| Copilot session service | `.../copilotcli/node/copilotcliSessionService.ts` | `LocalSessionManager`; watch `~/.copilot/session-state/**` |
| Permission round-trip + auto-approve | `.../copilotcli/node/permissionHelpers.ts` | path-scoped auto-approve + core confirmation tools |
| Shell sandbox/approver | `commandAutoApprover.ts`, `agentHostSandboxEngine.ts`, `sandboxConfigSchema.ts` | tree-sitter approver + sandbox (in-layer only) |
| IDE↔CLI reverse channel | `.../copilotcli/vscode-node/inProcHttpServer.ts` (`:185` nonce), `contribution.ts`, `lockFile.ts` (`:58` 0o600) | MCP server + lock file |
| Forward MCP gateway | `.../copilotcli/node/mcpHandler.ts` | bridge VS Code MCP → SDK |
| Anthropic model proxy | `extensions/copilot/.../agents/node/langModelServer.ts` | `/v1/messages` `:325` loopback no-auth; serves **extension** Claude |
| Second Claude proxy | `.../chatSessions/claude/node/claudeLanguageModelServer.ts` | disambiguate which Claude impl it serves (DN-3) |
| Protocol-adapter abstraction | `extensions/copilot/.../agents/node/adapters/types.ts` | **only Anthropic is production; OpenAI is `OpenAIAdapterForSTests` (test-only no-op)** |
| BYOK Gemini provider | `extensions/copilot/.../byok/vscode-node/geminiNativeProvider.ts` | `@google/genai` `LanguageModelChatProvider` (OQ-3 answer) |
| BYOK xAI provider | `.../byok/vscode-node/xAIProvider.ts` | OpenAI-compatible `LanguageModelChatProvider` (OQ-3 answer) |
| BYOK registration | `.../byok/.../byokContribution.ts` | registers BYOK providers |
| Claude history builder | `.../chatSessions/vscode-node/chatHistoryBuilder.ts` | JSONL → `ChatRequestTurn2`/`ChatResponseTurn2` |
| Claude tool formatter | `.../chatSessions/claude/common/toolInvocationFormatter.ts` | tool blocks → `ChatToolInvocationPart` |
| Claude content provider | `.../chatSessions/vscode-node/claudeChatSessionContentProvider.ts` | `provideChatSessionContent` bridge |
| Claude permission picker (to generalize) | `src/vs/sessions/contrib/providers/copilotChatSessions/browser/claudePermissionModePicker.ts` | Claude-hardcoded modes |
| Core chat-sessions extension point | `chat/browser/chatSessions/chatSessions.contribution.ts` | per-type commands + schema |
| Core chat-sessions service + types | `chat/common/chatSessionsService.ts` | `SessionType` `:292–298` |
| **Closed enum + SIX switches (main blocker)** | `chat/browser/agentSessions/agentSessions.ts` | `AgentSessionProviders` `:14`; `isBuiltInAgentSessionProvider` `:32`; `getAgentSessionProvider` `:39`; `getAgentSessionProviderName` `:54`; `getAgentSessionProviderIcon` `:75`; `isFirstPartyAgentSessionProvider` `:96`; `getAgentCanContinueIn` `:118` |
| List-surfacing admits unknown types | `chat/.../agentSessionsModel.ts:691` | `mapSessionContributionToType` (but labels/icons fall through) |
| Filter / hover (degrade for unknowns) | `agentSessionsFilter.ts:217`, `agentSessionHoverWidget.ts` | gated by `getAgentSessionProvider` |
| Electron startup enum ref | `chat/electron-browser/chat.contribution.ts:353` | per-provider commands |
| agentHost → sessions bridge | `src/vs/sessions/contrib/providers/agentHost/localAgentHostSessionsProvider.ts` | `ISessionsProvider` for agentHost providers |
| Proposed APIs | `vscode.proposed.chatSessionsProvider.d.ts`, `.chatProvider.d.ts` (`:87`), `.chatSessionCustomizationProvider.d.ts` | provider contract |
| Agents Window root | `src/vs/sessions/browser/workbench.ts` | `.agent-sessions-workbench` `:744`; distinct window |
| Sessions architecture | `src/vs/sessions/SESSIONS.md`, `SESSIONS_LIST.md`, `LAYOUT.md` | provider model + list spec |
| Sessions list tree | `src/vs/sessions/contrib/sessions/browser/views/sessionsList.ts` | grouping/filter/context keys |
| Concrete chat view | `src/vs/sessions/contrib/chat/browser/chatView.ts` | hosts `ChatWidget`; **no `setPendingMessages` here** |
| Core renderer | `chat/browser/widget/chatListRenderer.ts` | content-part dispatch (unchanged) |
| Thinking / tool parts | `.../chatContentParts/chatThinkingContentPart.ts`, `.../toolInvocationParts/chatToolInvocationPart.ts` | reasoning / tool I/O / subagent |
| Terminal agentTabs (demote, not remove) | `terminal/browser/agentTabs/agentTerminalTabbedView.ts`, `agentTerminalActiveHighlightBridge.ts` | retained peer / escape hatch |
| Contract-test models | `agentHost/test/node/protocol/toolApproval.integrationTest.ts`, `realSdkTestHelpers.ts` | external-CLI smoke-test pattern |
| Axioms | `.stokd/meta/SC_AXIOMS.md` | `AX-REPO-AGENTS-WINDOW-DISTINCT-WINDOW`, `AX-REPO-THIN-PATCH-FORK`, `AX-REPO-FORK-TDD-SCOPE`, `AX-REPO-VENDORED-AHP-PROTOCOL`, `AX-TERMINAL-AGENT-TABS`; proposed `AX-AGENT-CLI-PROVIDER-REGISTRY` |
| SEAM manifest | `SEAM_MANIFEST.md` (existing, scoped to `AX-TERMINAL-AGENT-TABS`) | **new manifest/section required (§13)** |

### 17.2 External-CLI capability matrix

| Capability | Claude | Copilot CLI | Codex | Gemini | Grok |
|---|---|---|---|---|---|
| Transport | SDK in-proc | SDK in-proc | app-server JSON-RPC | ACP JSON-RPC (**unverified**) / SDK / headless | spawn-per-turn headless |
| Host layer | agentHost (steer) + extension | extension | agentHost | TBD (DN-2; agentHost for steering) | TBD (DN-2) |
| Wire location | `@anthropic-ai/claude-agent-sdk` | `@github/copilot/sdk` | native `codex app-server` | `gemini --acp` / `@google/gemini-cli-sdk` | `grok` headless (flag undocumented) |
| List sessions | SDK `listSessions` | watch `~/.copilot/session-state/**` + SDK | `thread/*` | `--list-sessions` / file-watch `~/.gemini/tmp/<hash>` | file-watch (**undocumented**) / `--session latest` |
| Resume (persisted) | SDK `forkSession` | SDK replay | `thread/resume` | `loadSession` / `--resume` | `-s <id>` |
| **Live mid-flight steering** | **Native — agentHost `injectSteering`** | **Native** (`mode:'immediate'`) | **Native** (`turn/steer`) | **UNVERIFIED — spike-gated (may be emulated)** | **Emulated** (abort+resume) |
| Abort | SDK | SDK | `turn/interrupt` | `cancel` | kill process |
| Model source | editor proxy (`/v1/messages`) | Copilot models | **BYOK or proxy — DN-3 gate** | **likely BYOK `geminiNativeProvider`** | **likely BYOK `xAIProvider`** |
| Shell sandboxed by existing engine | Yes | Yes | Yes | Partial (unverified hook) | **NO (DN-4)** |
| MCP | Claude registry (private) | gateway + reverse channel | TBD | ACP `initialize` (if exposed) | `.grok/settings.json` |
| In `AgentSessionProviders` today | yes (`claude-code`) | yes (`copilotcli`) | yes (`openai-codex`, **half-wired across switches**) | **no** | **no** |
| Confidence | High (in-tree, shipping) | High (in-tree, shipping) | High (in-tree, near-done) | **Unverified — external bet** | **Discovery-required** |

> **Verification note:** the external-CLI rows rest on GitHub raw docs + code search (Jan-2026 knowledge cutoff, no live web). Flag names, SDK package names, on-disk formats, and ACP semantics **must be re-verified at implementation time via the §9.3 contract-test harness and the P1/P3 spike/discovery gates** — and pinned.

### 17.3 AWS Bedrock (model provider, not an agentic CLI)

Bedrock is a **model source**, not a sixth agentic CLI, so it does not get a full capability column above. It integrates as a **BYOK `LanguageModelChatProvider`** over the AWS Bedrock Runtime SDK (analogous to `geminiNativeProvider.ts` / `xAIProvider.ts`), scoped via `targetChatSessionType`, surfacing Bedrock-hosted models in the same chat surface (G9, §8 P5). Auth uses the standard AWS credential chain (profile / region / SSO); the data/inference perimeter stays in AWS. Chat-first by construction (G6/DN-1) — no terminal path. Resume/steering are inherited from whichever agent runtime consumes the Bedrock model.