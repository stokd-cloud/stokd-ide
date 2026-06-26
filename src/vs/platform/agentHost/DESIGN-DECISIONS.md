# Design Decisions — Agent Host Platform Layer

This file is the design-decision log for the `agentHost` platform layer. Each entry
has an identifier (`DN-<n>`), a status (`ACCEPT` | `REJECT` | `DEFER`), and a dated
rationale. Entries are append-only; superseded decisions are marked SUPERSEDED with
a forward reference to the replacement.

---

## DN-2 — Host Layer for the Agent CLI Provider Abstraction

**Status:** ACCEPT  
**Date:** 2026-06-22  
**Prerequisite for:** all P0 coding on the multi-provider LLM CLI abstraction

### Decision

The Agent CLI Provider abstraction—and all future `IAgent` providers that require
true mid-flight steering—**must be hosted in the platform `agentHost` layer**
(`src/vs/platform/agentHost/`), registered with `IAgentService`.

### Rationale

The `agentHost` layer is the **only** layer in the codebase that provides all three
of the following capabilities simultaneously:

**1. Live `setPendingMessages` / mid-flight steering**

Phase 9 of the Claude agent implementation established the `priority: 'now'`
prompt-iterable mechanism: when `IAgent.setPendingMessages()` is called, the
provider injects a `priority: 'now'` `SDKUserMessage` into the existing async
iterable that the Claude SDK's `WarmQuery.query()` is consuming
(`src/vs/platform/agentHost/node/claude/claudeSdkPipeline.ts`), causing the SDK's
`'now'`-priority watcher to abort the in-flight turn and dequeue the steering
prompt next. This path is reached exclusively through agentHost's
`IAgent.setPendingMessages()` boundary method. (The `IAgent` contract exposes
`sendMessage` / `setPendingMessages` — there is no `IAgent.query()`; `query()` is
the Claude SDK primitive, internal to the provider.) No other layer (workbench,
extension host) has access to the underlying `SDKUserMessage { priority: 'now' }`
injection point.

> Spec: `src/vs/platform/agentHost/node/claude/phase9-plan.md`  
> Do **not** use `Query.streamInput()` — that is the wrong entry point and was
> explicitly ruled out in the Phase 9 steering design (zero callers in the
> reference impl; the prompt iterable absorbs that role).

**2. Sandbox isolation**

agentHost runs in a dedicated utility process with appropriate sandboxing.
Extension-host providers run in the shared extension host process and cannot
provide equivalent process isolation.

**3. Server / remote parity**

agentHost nodes are instantiated in both local and remote-server configurations
(tunnel, SSH). An extension-host provider would only run on the local machine,
making mid-flight steering non-functional over remote connections.

### Implications for All P0 Coding

This decision is a **hard prerequisite** for all P0 implementation work. Any work
that begins without accepting this decision may require a full layer migration.

Concretely:

| Concern | Constraint |
|---|---|
| **Provider location** | `src/vs/platform/agentHost/node/<provider>/` |
| **Registration** | `agentHostMain.ts` (platform DI container) |
| **Shared interfaces** | `src/vs/platform/agentHost/common/` (no Node.js or workbench APIs) |
| **Routing** | `IAgentService` (registered in agentHostMain) is the sole entry point |
| **Workbench-side registration** | Not needed; workbench talks to agentHost over IPC |
| **Non-steering providers** | SHOULD also register in agentHost for consistency and forward-compat |

### Reference to Prior Art

- **`ClaudeAgent`** — `src/vs/platform/agentHost/node/claude/` (Phases 1–13+):
  complete steering, proxy auth, session lifecycle, and SDK integration pattern
- **`CopilotAgent`** — `src/vs/platform/agentHost/node/copilot/`: original
  reference implementation
- **`IAgent` / `IAgentService`** — `src/vs/platform/agentHost/common/agentService.ts`
- **Phase 9 steering spec** — `src/vs/platform/agentHost/node/claude/phase9-plan.md`
- **CONTEXT.md mapping catalogue** — `src/vs/platform/agentHost/node/claude/CONTEXT.md`

### Alternatives Considered and Rejected

| Alternative | Reason rejected |
|---|---|
| Workbench-layer provider (VS Code extension) | No steering path; weaker sandboxing; no server/remote parity |
| Separate utility process per provider | Duplicates agentHost process; complicates auth-proxy sharing; breaks established `IAgent` contract |
| Extension-host provider + IPC bridge to agentHost for steering | Leaky abstraction; cross-process complexity with no benefit; violates `IAgent` contract boundary |

---

<!-- append new DN entries below this line -->

## DN-3 — Codex Model Sourcing: Reuse BYOK `LanguageModelChatProvider`s Scoped via `targetChatSessionType`

**Status:** ACCEPT  
**Date:** 2026-06-25  
**Gate for:** all Codex provider model-sourcing / adapter coding (the Codex provider may
not begin model-wiring work until this decision is accepted)

### Decision

The Codex provider **sources its models by reusing the existing BYOK
`LanguageModelChatProvider`s**, scoped to the Codex chat session type via the
existing `targetChatSessionType` model-metadata mechanism. **No new editor-proxy
adapter is introduced** for Codex model sourcing in the chat panel.

Concretely: OpenAI / Codex models entered as a user's own key flow through the
already-registered BYOK OpenAI / OpenAI-compatible providers
(`OAIBYOKLMProvider`, `CustomOAIBYOKModelProvider`,
`CustomEndpointBYOKModelProvider`, `AzureBYOKModelProvider`). The Codex session's
model picker is populated by tagging the relevant BYOK model metadata with the
Codex chat session type (e.g. `targetChatSessionType: 'agent-host-codex'`), exactly
as Copilot CLI and Claude Code already do for their own session types.

### Rationale

**1. The scoping mechanism already exists and is proven.**

`filterModelsForSession()`
(`src/vs/workbench/contrib/chat/browser/widget/input/chatModelSelectionLogic.ts`)
is the single source of truth for which models a session's picker shows: when a
session has a non-`'local'` `sessionType` and any model targets it, **only** models
whose `metadata.targetChatSessionType === sessionType` are shown; otherwise only
untargeted (general-purpose) models are shown. This is the same mechanism that
already scopes:

| Session type | Set by | Registration |
|---|---|---|
| `'copilotcli'` | `copilotCli.ts` (`targetChatSessionType: 'copilotcli'`) | `lm.registerLanguageModelChatProvider('copilotcli', …)` |
| `'claude-code'` | `claudeCodeModels.ts` (`targetChatSessionType: 'claude-code'`) | `lm.registerLanguageModelChatProvider('claude-code', …)` |
| `agent-host-*` | `agentHostLanguageModelProvider.ts` (scheme-derived) | per-session-type provider |

Codex slots into this exact pattern — it requires **no new model-routing
infrastructure**, only a descriptor + correctly-tagged BYOK model metadata.

**2. BYOK already owns the hard parts.**

The BYOK contribution (`extensions/copilot/src/extension/byok/`) already provides
secure user-key storage, OpenAI / OpenAI-compatible / Azure model discovery, and a
conforming `LanguageModelChatProvider` implementation. Re-using it means Codex
model sourcing inherits all of that for free instead of re-implementing it.

**3. A new editor-proxy adapter would duplicate routing and widen the security
surface.**

The "editor-proxy adapter" alternative already exists as prior art for a
*different* purpose: `lmProxyContrib.ts` registers a `LanguageModelProxyProvider`
(gated by `token.codexAgentEnabled` / `chat.experimental.codex.enabled`) backed by
`oaiLanguageModelServer.ts`, which stands up a **local HTTP server** presenting an
OpenAI Responses-API endpoint that proxies to the editor's own endpoints. Standing
up a *new* such proxy for chat-panel Codex model sourcing would:

  - add a parallel model-sourcing path to maintain alongside `LanguageModelChatProvider`;
  - introduce another local HTTP listener + auth surface, in tension with the
    loopback-only / explicit-auth-scheme posture the provider registry enforces
    (`validateSecurityDescriptor`, AC-P0.4); and
  - make Codex the lone provider that does not source models through the shared
    `LanguageModelChatProvider` + `targetChatSessionType` seam, breaking the
    "one renderer, one descriptor per provider" symmetry of the abstraction.

**4. Orthogonal to DN-2, and consistent with it.**

DN-2 governs **where the Codex *agent* (session + steering) runs** — the
`agentHost` platform layer (`src/vs/platform/agentHost/node/codex/`). DN-3 governs
**how the Codex picker is populated with models** — an extension-host / workbench
concern (BYOK registration + `filterModelsForSession`). The two decisions are
independent and complementary: the agent runs in `agentHost` per DN-2; its models
are sourced via BYOK per DN-3.

### Implications for Codex Coding

| Concern | Constraint |
|---|---|
| **Model provider** | Reuse existing BYOK `LanguageModelChatProvider`s; do **not** add a Codex-specific model provider class. |
| **Picker scoping** | BYOK Codex model metadata carries `targetChatSessionType` = the Codex session type; no change to `filterModelsForSession`. |
| **Editor-proxy adapter** | Do **not** introduce a new `LanguageModelProxyProvider` / OpenAI-proxy HTTP server for chat-panel model sourcing. |
| **Follow-on work (unblocked by this gate)** | Tag the relevant BYOK model metadata with the Codex `targetChatSessionType`; register the Codex provider descriptor; wire the Codex session type. |

### Reference to Prior Art

- **`filterModelsForSession` / `targetChatSessionType` scoping** —
  `src/vs/workbench/contrib/chat/browser/widget/input/chatModelSelectionLogic.ts`
- **Copilot CLI model registration** (the pattern to copy) —
  `extensions/copilot/src/extension/chatSessions/copilotcli/node/copilotCli.ts`
  (`targetChatSessionType: 'copilotcli'`)
- **Claude Code model registration** —
  `extensions/copilot/src/extension/chatSessions/claude/node/claudeCodeModels.ts`
- **BYOK providers** — `extensions/copilot/src/extension/byok/vscode-node/byokContribution.ts`
- **Editor-proxy adapter (rejected alternative; existing prior art for a different use)** —
  `extensions/copilot/src/extension/externalAgents/vscode-node/lmProxyContrib.ts`,
  `extensions/copilot/src/extension/externalAgents/node/oaiLanguageModelServer.ts`
- **Codex agent (hosted per DN-2)** — `src/vs/platform/agentHost/node/codex/`

### Alternatives Considered and Rejected

| Alternative | Reason rejected |
|---|---|
| New editor-proxy adapter (dedicated `LanguageModelProxyProvider` + local OpenAI-proxy HTTP server for the Codex panel) | Duplicates model routing; adds a local HTTP listener + auth surface that conflicts with the loopback-only / explicit-auth registry posture; makes Codex inconsistent with every other provider in the abstraction. |
| Dedicated `CodexLanguageModelChatProvider` separate from BYOK | Re-implements key storage and OpenAI-compatible model discovery that BYOK already provides; more code to maintain for no added capability. |
| Surface Codex models in the general (untargeted) pool only | Loses session-scoped filtering; Codex models would leak into every non-Codex session's picker, contrary to the per-provider scoping the abstraction depends on. |

---

## DN-4 — Gemini Steering Tier: Emulated (ACP abort-and-replace), set from the live-vs-resume spike

**Status:** ACCEPT
**Date:** 2026-06-25
**Gate for:** all Gemini-provider steering / enablement coding (the Gemini adapter may not assume a
steering tier until this decision is accepted)
**Spike (AC-P1.0):** [`node/gemini/ACP-STEERING-SPIKE.md`](node/gemini/ACP-STEERING-SPIKE.md)

### Decision

The Gemini provider's steering tier is **Tier 2 — emulated steering, realized via ACP
abort-and-replace**, and is set from spike evidence (work item 3.1), **not assumed**. Gemini does
**not** get Claude-grade Tier-1 native mid-flight injection; it does **not** queue.

Concretely, against the pinned **gemini-cli `0.47.0`** in ACP mode (pin the **`--acp`** flag;
`--experimental-acp` is the deprecated alias), a second `session/prompt` sent **mid-turn**:

- is dispatched **concurrently** (the `agent-client-protocol` receive loop calls `#processMessage`
  **without `await`**), and
- causes the agent's `session.prompt()` to run **`this.pendingPrompt?.abort()` first**, which
  **cancels the in-flight turn** — that turn resolves with **`stopReason: "cancelled"`** — and starts
  the new prompt as a fresh turn.

This is **abort-and-replace**, the exact primitive needed for emulated steering: the Gemini adapter
implements `IAgent.setPendingMessages()` by issuing a fresh `session/prompt` (equivalently
`session/cancel` + `session/prompt`) and reconciling the pre-empted turn's `cancelled` stop reason.
Because the cancel is native and immediate, the emulation is **low-latency** — strictly better than a
protocol that truly queues.

### Auth gate (orthogonal, recorded so downstream work does not assume otherwise)

On the same pinned 0.47.0, `session/new` is **server-side rejected under OAuth-personal** ("Gemini
Code Assist for individuals … migrate to Antigravity"). The **live ACP path therefore requires
`gemini-api-key` / `vertex-ai` / `gateway` auth**; OAuth-personal-only environments must **fall back
to SDK/headless** (Tier 3) on auth grounds, independent of the steering finding.

### Implications for Gemini Coding

| Concern | Constraint |
|---|---|
| **Steering tier** | Tier 2 (emulated). Do **not** wire Gemini as if it had Claude-style native `priority:'now'` injection. |
| **`setPendingMessages` impl** | New `session/prompt` (abort-and-replace) or `session/cancel` + `session/prompt`; the adapter must handle the pre-empted turn's `stopReason: "cancelled"`. |
| **Descriptor `capabilities.steering`** | Permitted to be `true` **only if** documented/treated as emulated (cancel-and-replace), not native injection; otherwise encode `false` + an emulated-steering shim. The tier (Tier 2) is fixed here; the descriptor work item fixes the boolean's exact semantics. |
| **Live transport auth** | Gate the live ACP path on `gemini-api-key`/`vertex-ai`/`gateway`; fall back to SDK/headless for OAuth-personal-only. |
| **Version pin** | Bound to gemini-cli `0.47.0` + flag `--acp`. Re-run the spike on any pin bump (the steering verdict depends on the bundle's receive-loop and `prompt()` abort-first behavior). |

### Reference to Prior Art

- **Spike result + evidence (white-box source citations against the pinned bundle)** —
  `node/gemini/ACP-STEERING-SPIKE.md`
- **Claude Tier-1 native steering (the contrast)** — DN-2 above; `node/claude/phase9-plan.md`
  (`priority:'now'` `SDKUserMessage` injection inside one `query()` iterable)
- **Steering capability flag** — `IAgentCliCapabilities.steering`,
  `extensions/copilot/src/extension/chatSessions/common/agentCliProvider.ts`

### Alternatives Considered and Rejected

| Alternative | Reason rejected |
|---|---|
| Assume Tier-1 native injection for Gemini (parity with Claude) | Contradicted by the pinned bundle: the agent **aborts** the in-flight turn rather than injecting into a continuing one; the pre-empted turn surfaces `stopReason: "cancelled"` as a separate ACP turn. |
| Assume Gemini queues → force SDK/headless on steering grounds | Contradicted by the evidence: ACP does **not** queue; the second prompt cancels the first immediately, which is sufficient for low-latency emulated steering. (SDK/headless fallback is still required for OAuth-personal **auth**, a separate axis.) |
| Treat OAuth-personal as a working live-ACP credential on 0.47.0 | Contradicted by the live `session/new` rejection (E2 in the spike); OAuth-personal is server-deprecated on this pin. |

---

## DN-5 — Grok Session Listing: File-watch the per-session `summary.json` tree, set from the discovery gate

**Status:** ACCEPT
**Date:** 2026-06-25
**Gate for:** all Grok-provider session-listing / discovery coding (the Grok adapter may not commit
to a listing source until this decision is accepted)
**Gate (AC-P3.0):** [`node/grok/GROK-DISCOVERY-GATE.md`](node/grok/GROK-DISCOVERY-GATE.md)

### Decision

The Grok provider lists sessions by **watching the on-disk per-session directory tree**, and the
storage path/format + headless/resume flags are **pinned from the discovery gate** (work item 4.1),
**not assumed**. Against the pinned **grok `0.2.51`** (build `f4f85a6492e`, `[stable]`):

- **Session store (authoritative, file-watch source):**
  `~/.grok/sessions/<encodeURIComponent(cwd)>/<session-uuid-v7>/`, one **`summary.json`** per
  session carrying `info.id`, `generated_title`/`session_summary`, `cwd`, `created_at`/`updated_at`/
  `last_active_at`, `current_model_id`, `num_messages`, `head_branch`, `agent_name`. The workspace
  directory key is the **percent-encoded absolute cwd** (`/` → `%2F`); session ids are **UUID v7**
  (lexical ≈ chronological). Transcript/events are NDJSON siblings (`chat_history.jsonl`,
  `events.jsonl`, `chat_format_version: 1`) — consumed by the **downstream** replay/normalizer work,
  not frozen by this gate.
- **Headless output flag:** `-p`/`--single <PROMPT>` + **`--output-format <plain|json|streaming-json>`**;
  structured agent loop via `grok agent {stdio,headless,serve}`.
- **Resume flag:** `-r`/`--resume [<SESSION_ID>]` (id = `summary.json` `info.id`); `-c`/`--continue`
  (cwd-scoped, most-recent); `--restore-code` opts into checking out the original commit on resume.

### Rejected sources (recorded so downstream work does not reach for them)

| Source | Why not | Evidence |
|---|---|---|
| `grok sessions list` / `search` | **No `--output-format json`** (only `-n/--limit`) — human/TUI text, brittle to parse; routes through the leader socket (not a pure local read). | `grok sessions list --help` |
| `~/.grok/grok.db` (`sessions` table) | **Legacy/stale** — holds only **6** of 81 sessions, `max(updated_at)` = **2026-05-07** (frozen ~7 weeks). Clean STRICT schema, but not maintained at this pin → cannot back a live list. | `SELECT count(*) FROM sessions` = 6; `max(updated_at)` = 2026-05-07 |
| `~/.grok/sessions/session_search.sqlite` (`session_docs`) | **Derived FTS5 index that lags** (51 of 81; `last_indexed_offset`). Good for **search**, not an authoritative **list**. | `SELECT count(*) FROM session_docs` = 51 |

The on-disk tree is the only **complete + current** catalogue (**81** dirs ↔ **81** `summary.json`),
and it is offline/local (no leader, no network, no auth to enumerate). The SQLite stores may be used
as optional accelerators *on top of* the file-watch source, never as the source of truth.

### Implications for Grok Coding

| Concern | Constraint |
|---|---|
| **Listing source** | File-watch `~/.grok/sessions/<encodeURIComponent(cwd)>/<uuid>/summary.json`. Do **not** parse `grok sessions list`, and do **not** treat `grok.db`/`session_search.sqlite` as authoritative. |
| **cwd key** | Encode the workspace cwd with `encodeURIComponent` (`/`→`%2F`) to locate its sessions; do not assume a flat slug. Re-confirm the encoder for edge chars on a pin bump. |
| **Session id** | UUID v7 from the dir name / `info.id`; it is also the `--resume <SESSION_ID>` key — listing and resume share one id. |
| **Headless / resume flags** | As pinned above; bound to grok `0.2.51`. |
| **Version pin / drift** | Bound to grok `0.2.51` (`f4f85a6492e`). Re-run the gate on any pin bump — re-check flags, the `summary.json` key set, the cwd encoder, and the authority counts (if `grok.db` becomes complete, a DB-backed list may supersede file-watch). A downstream pinned-contract test (mirroring codex's `codexVersionContract.test.ts`) should freeze the `summary.json` key set + flag surface once the listing code lands. |

### Reference to Prior Art

- **Gate result + evidence** — `node/grok/GROK-DISCOVERY-GATE.md`
- **Provider descriptor (where the pinned facts land downstream)** —
  `extensions/copilot/src/extension/chatSessions/common/agentCliProvider.ts`
  (`IAgentCliProviderDescriptor`)
- **Codex pinned-contract drift test (the downstream pattern to mirror)** —
  `src/vs/platform/agentHost/test/node/codex/codexVersionContract.test.ts`;
  `build/codex/codex-version.txt`
- **Sibling discovery gate (Gemini, work item 3.1)** — `node/gemini/ACP-STEERING-SPIKE.md`; DN-4 above

### Alternatives Considered and Rejected

| Alternative | Reason rejected |
|---|---|
| Shell out to `grok sessions list` and parse its output | No machine-readable (`--output-format json`) mode at this pin; TUI text is brittle; routes through the leader socket rather than a local read. |
| Read `grok.db` as the session catalogue | Stale/legacy at this pin (6 of 81 sessions, frozen since 2026-05-07); cannot represent the live set. |
| Query `session_search.sqlite` for the list | It is an FTS **search** index that lags the tree (51 of 81); fit for search, not an authoritative list. |
| Assume a flat per-cwd slug instead of `encodeURIComponent` | Contradicted by the on-disk dir names (`%2Fopt%2Fworktrees%2F…`), which are the percent-encoded absolute cwd. |
