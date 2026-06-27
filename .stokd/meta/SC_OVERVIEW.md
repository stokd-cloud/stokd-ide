<!-- stokd-meta: SC_OVERVIEW.md | metaVersion 0.6.0 | generated: UPGRADE -->
# SC_OVERVIEW — `code-oss-dev` (stokd-ide)

> Comprehensive codebase overview. Upgrade pass, meta version 0.6.0 (from 0.5.0).
> Repo: `/opt/worktrees/stokd-cloud/stokd-ide/main` — root npm package
> `code-oss-dev` @ `1.125.0`. Origin `github.com/stokd-cloud/stokd-ide`;
> upstream `github.com/microsoft/vscode`.
>
> Companion docs in this directory: `SC_PRODUCT_CODE_OSS_DEV.md` (product),
> `SC_AXIOMS.md` (repo invariants), `SC_FLOWS.md` (user flows), `SC_VIEWS.md`,
> `SC_TEST.md`, `SC_RECOMMENDATIONS.md`, and per-package `SC_MODULE.md` files
> under `cli/`, `extensions/`, `remote/`, `scripts/`, `test/`. The fork's
> upstream-edit accounting lives in `SEAM_MANIFEST.md` (repo root); the agent
> host's design-decision log lives in `src/vs/platform/agentHost/DESIGN-DECISIONS.md`.

---

## 1. Repository purpose

`code-oss-dev` is a **thin-patch fork of Microsoft VS Code** ("Code – OSS"),
**re-branded as Stokd Code** and maintained by stokd-cloud. It keeps the entire
VS Code editing experience (workbench, editors, terminal, SCM, language services,
~100 built-in extensions) intact and layers on stokd's **agentic developer
experience**, while holding the edited-upstream surface as small as practical so
each rebase onto a new VS Code release stays a routine, low-conflict operation.

**Branding (`product.json`)** — the fork *does* re-brand (the one place it
diverges visibly from upstream):

| Field | Value |
|---|---|
| `nameShort` | `Stokd` |
| `nameLong` | `Stokd Code` |
| `applicationName` | `stokd-code` |
| `serverApplicationName` | `stokd-server` |
| `dataFolderName` | `.stokd` (flat home data folder, no `-dev` suffix) |
| `serverDataFolderName` | `.stokd-server` |
| `sharedDataFolderName` | `.stokd-shared` |
| `tunnelApplicationName` | `stokd-tunnel` |
| `darwinBundleIdentifier` | `cloud.stokd.code` |
| `win32MutexName` | `stokdcode` |
| `urlProtocol` | `stokd-code` |
| `extensionsGallery` | **Open VSX** (`https://open-vsx.org/vscode/gallery`) |

License MIT. The fork tracks the upstream release line (currently `1.125.0`).
Branding identity is governed by `AX-REPO-PRODUCT-IDENTITY`.

### The problem it solves

Developers increasingly run AI coding agents alongside their own work, but stock
VS Code has no first-class place to **host**, **observe**, **triage**, and
**land the output of** many concurrent agent sessions. This fork adds that layer
end-to-end through five fork-distinguishing capabilities:

1. **Agents Window** — `src/vs/sessions/` — a dedicated, fixed-layout,
   sessions-first workbench *window* (distinct from the main editor window) for
   creating agent sessions, streaming chat turns, reviewing/committing/landing
   agent output, and managing many sessions side-by-side. Backends plug in as
   **session providers** (local chat, copilot chat, agent host, remote agent host).
2. **Agent Host platform service** — `src/vs/platform/agentHost/` — the large
   fork-added platform service that actually runs sessions: AHP client/server
   glue, multiple agent backends (`claude`, `codex`, `copilot`, `grok`; `gemini`
   spiked), changeset / checkpoint / commit / PR operations, a session database,
   git state tracking, SSH/WSL/tunnel remote hosting, and OTEL telemetry. Its
   design rationale is logged in `DESIGN-DECISIONS.md` (entries `DN-2 … DN-5`).
3. **Multi-provider LLM CLI chat surface** *(new since 0.5.0)* —
   `src/vs/workbench/contrib/chat/browser/agentSessions/` — the chat panel is now
   a **provider-agnostic LLM-CLI surface**. A fork-owned descriptor registry
   (`AgentCliProviderRegistry` + `agentSessionProviderRegistry`) replaces
   per-provider switch cases, so Claude, Copilot CLI (Background), Codex, Gemini,
   Grok, … all resolve through descriptors. **Chat is the default launch surface;
   the terminal selector is now an opt-in escape hatch** (setting
   `chat.agentSessions.defaultSurface`, default `chat`). Governed by the new
   feature axiom `AX-AGENT-CLI-PROVIDER-REGISTRY` (DN-9).
4. **Agent-aware terminal selector** —
   `src/vs/workbench/contrib/terminal/browser/agentTabs/` — an experimental,
   flag-gated terminal tabs strip that hosts the code-ext **Sessions webview**
   (and surfaces agent terminals alongside human terminals), backed by the
   `terminalTabGrouping` proposed API. **Reframed by capability #3:** retained,
   default-off (`terminal.integrated.agentTabs.enabled = false`, now deprecated
   in favor of the chat surface), reached only via the explicit *Open in Terminal*
   action.
5. **Copilot Chat extension** — `extensions/copilot/` (package `copilot-chat`
   @ 0.53.0) — the fork-owned, independently-built AI chat/agent extension that
   powers the chat content surfaced by the Agents Window and the chat surface.
   (Excluded from packaged builds via `product.json`.)

### The thin-patch discipline (read before editing upstream)

Only **fork-owned paths** may be edited freely:
- `src/vs/sessions/**`
- `src/vs/platform/agentHost/**` (fork-added platform service)
- `src/vs/workbench/contrib/chat/browser/agentSessions/**` *(new fork-owned files;
  one upstream file — `agentSessions.ts` — is a tracked seam, see §3)*
- `src/vs/workbench/contrib/terminal/browser/agentTabs/**`
- the terminal seam file `…/terminal/browser/terminalView.ts`
- `extensions/copilot/**`
- fork tooling in `scripts/` and `test/`

**Any** edit to inherited upstream code requires a governed task **and** a row in
`SEAM_MANIFEST.md`. Governing contracts: `AX-TERMINAL-AGENT-TABS`,
`AX-REPO-THIN-PATCH-FORK`.

> ⚠️ **Seam accounting status (updated for 0.6.0).** `SEAM_MANIFEST.md` has grown
> from a single-seam doc to a multi-section ledger (~331 lines) and **now properly
> accounts for** the terminal seam, the fork-identity rebrand
> (`product.json` / `product.ts` / `main.ts` / `cli/constants.rs` / `cli/options.rs`),
> the multi-provider chat surface (`agentSessions.ts`, 1 file, 10 redirected edits),
> the chat-default surface (0 upstream files), the in-place re-root feature (3 files
> + 1 test), and the Grok node adapter (0 upstream files). The 0.5.0 drift around
> the terminal seam growth and re-root is **reconciled**.
>
> **Three gaps remain open** (inherited-upstream edits not yet in the manifest):
> 1. **`terminalTabGrouping` proposed-API wiring — 5 files**
>    (`extensionsApiProposals.ts`, `extHost.api.impl.ts`, `extHost.protocol.ts`,
>    `extHostTerminalService.ts`, `mainThreadTerminalService.ts`). Real edits
>    (commits `de405a9`, `0685ac9`) with no manifest row.
> 2. **Editor watermark video** (`editorGroupWatermark.ts`,
>    `editorgroupview.css`, `media/electric-loop.webm`; commit `53498e2`).
> 3. **User-visible branding rebrand — 52 files / ~134 insertions** (commit
>    `809785a`, *"rebrand user-visible 'VS Code' references to 'Stokd Code'"*):
>    `helpActions.ts`, `workbench.contribution.ts`, `gettingStartedContent.ts`,
>    `terminalConfiguration.ts`, `debugAdapterManager.ts`, and ~47 other workbench
>    sources. This is a *new* gap introduced after the 0.5.0 meta regen.
>
> These are documentation/accounting gaps, not architectural ones — append-style
> wiring and string branding — but they are exactly the surface
> `AX-REPO-THIN-PATCH-FORK` exists to keep honest, and they will be the realistic
> rebase conflict points. A governed `SEAM_MANIFEST.md` update should re-account
> for all three.

---

## 2. High-level architecture

This is a **single product** with multiple runtime surfaces, all built from the
same `src/` TypeScript core:

| Surface | Runtime | Primary entry | Launcher |
|---|---|---|---|
| **Desktop workbench** | Electron 42.2.0 | `src/main.ts` → `out/main.js` | `scripts/code.sh` / `code.bat` |
| **Web workbench** | Browser | web build assets (`vscode-web`) | `scripts/code-web.js` |
| **Remote server (REH)** | Node 24.15.0 | `src/server-main.ts` | `scripts/code-server.js` (port `9888`, `Web UI available at <addr>`) |
| **Agents Window (desktop)** | Electron | `src/vs/sessions/sessions.desktop.main.ts` | desktop app, window `WindowVisibility.Sessions` |
| **Agents Window (web standalone)** | Browser | `src/vs/sessions/sessions.web.main.ts` | `scripts/code-sessions-web.js` (port `8081`) |
| **CLI / Agent Host** | Rust native + Node | `cli/src/bin/code/main.rs`; `out/vs/platform/agentHost/node/agentHostServerMain.js` | `scripts/code-cli.sh`; `scripts/code-agent-host.js` (port `8081`, `READY:<port>`) |

### Source layering (`src/vs/`)

The classic VS Code layer order is enforced by the layers checker
(`npm run valid-layers-check`, `AX-REPO-LAYER-BOUNDARIES`):

```
base  →  platform  →  editor  →  workbench  →  sessions
```

- `base/` — platform-agnostic utilities, no VS Code domain knowledge.
- `platform/` — DI services and cross-cutting infrastructure. **Fork addition:**
  `platform/agentHost/` (see §4) — by far the largest fork addition outside
  `sessions/`.
- `editor/` — the Monaco editor.
- `workbench/` — the IDE shell, parts, and `contrib/` features. Two fork seams
  live here: the **multi-provider chat surface** under
  `contrib/chat/browser/agentSessions/` and the **agentTabs seam** under
  `contrib/terminal/browser/agentTabs/`.
- `sessions/` — **fork-added top layer**; the Agents Window. May import from
  `workbench`, **never the reverse** (`AX-REPO-AGENTS-WINDOW-DISTINCT-WINDOW`).
  See `src/vs/sessions/LAYERS.md`.
- Also present: `code/` (process orchestration) and `server/` (REH server).

Each layer is further split by runtime environment: `common/` (isomorphic),
`browser/`, `node/`, `electron-browser/`, `electron-main/`, `electron-utility/`,
`worker/`. Imports must respect both the layer and the environment graph. A
recurring fork constraint (`AX-REPO-LAYER-BOUNDARIES`): `src/vs/platform/agentHost/`
**cannot** import from `extensions/copilot/`, so provider logic that both sides
need (e.g. Grok CLI flags / `summary.json` keys) is duplicated and kept in sync.

### Bootstrap / entry-point map (`src/`)

| File | Role |
|---|---|
| `src/main.ts` | Electron main-process entry (desktop app) |
| `src/server-main.ts` | Remote server (REH) entry |
| `src/server-cli.ts` | Server CLI entry |
| `src/cli.ts` | Node-side CLI entry |
| `src/bootstrap-*.ts` | shared bootstrap helpers (`-node`, `-esm`, `-fork`, `-server`, `-cli`, `-import`, `-meta`) |
| `src/vs/sessions/sessions.{common,desktop,web}.main*.ts` | Agents Window composition roots per surface (`sessions.web.main.ts` + `sessions.web.main.internal.ts`) |

---

## 3. The upstream-edited surface (seams)

The fork concentrates its upstream footprint into a small set of **seams**, each
tracked in `SEAM_MANIFEST.md`. The unifying pattern is *redirect, don't replace*:
an upstream `default`/fallback branch is pointed at a fork-owned registry or a
pure decision function, leaving the on-path behavior byte-identical to upstream.

### Seam summary (what `SEAM_MANIFEST.md` records)

| Seam | Upstream files | Governing contract | Status |
|---|---|---|---|
| Terminal selector (`terminalView.ts`) | 1 | `AX-TERMINAL-AGENT-TABS` | accounted |
| Fork identity (`product.json`, `product.ts`, `main.ts`, `cli/constants.rs`, `cli/options.rs`) | 5 | `AX-REPO-PRODUCT-IDENTITY` | accounted |
| Multi-provider chat surface (`agentSessions.ts`) | 1 (10 redirects) | `AX-AGENT-CLI-PROVIDER-REGISTRY` | accounted |
| Chat-as-default surface (P4) | 0 | `AX-AGENT-CLI-PROVIDER-REGISTRY` | accounted |
| In-place single-folder re-root | 3 (+1 test) | `AX-STOKDIDE-SWITCH-ROOT-NO-RELOAD` | accounted |
| Grok spawn-per-turn node adapter | 0 | `AX-AGENT-CLI-PROVIDER-REGISTRY` | accounted |
| **`terminalTabGrouping` proposed API** | 5 | `AX-REPO-THIN-PATCH-FORK` | **gap (§1)** |
| **Editor watermark video** | 2 + asset | `AX-REPO-THIN-PATCH-FORK` | **gap (§1)** |
| **User-visible string rebrand** | 52 | `AX-REPO-PRODUCT-IDENTITY` | **gap (§1)** |

> Note: `AX-AGENT-CLI-PROVIDER-REGISTRY` (DN-9) and
> `AX-STOKDIDE-SWITCH-ROOT-NO-RELOAD` are **feature-local** axioms declared in
> `SEAM_MANIFEST.md` / feature docs; they are **not (yet) promoted** to repo-wide
> `.stokd/meta/SC_AXIOMS.md`.

### (a) The terminal seam (`terminalView.ts`, 1 file)

`src/vs/workbench/contrib/terminal/browser/terminalView.ts` imports the seam
interface (`ITerminalTabsView`), the alternate view (`AgentTerminalTabbedView`),
and the flag id; retypes `_terminalTabbedView` to the structural seam interface;
and branches in `_createTabsView()` on `terminal.integrated.agentTabs.enabled`.
With the flag off the terminal is **byte-identical to upstream**. Guard:
`scripts/verify-seam.sh`. **The agentTabs machinery is now an opt-in escape hatch**
(P4): the flag stays default-off and carries a `markdownDeprecationMessage`
pointing to `chat.agentSessions.defaultSurface`; in-flight terminal sessions keep
working, nothing is force-migrated, and the IDE↔CLI MCP reverse channel
(in-proc HTTP server + lock-file + nonce) is preserved.

### (b) The multi-provider chat surface (`agentSessions.ts`, 1 file)

The chat-panel project (`project/prd-chat-panel-as-multi-provider-llm-cli`) turns
eight hard-coded provider-resolution functions in
`src/vs/workbench/contrib/chat/browser/agentSessions/agentSessions.ts` into
registry lookups: each function keeps inline cases for the providers that stay
inline and points its **`default` branch at the fork-owned
`agentSessionProviderRegistry`**. Claude, Copilot CLI (Background), and Codex were
moved out of the inline cases into descriptors (`agentSessionProviderBuiltins.ts`),
**byte-identically** (proven by a golden-snapshot test). Adding a provider is now
*descriptor + adapter + `package.json`* — zero new upstream switch edits
(`AX-AGENT-CLI-PROVIDER-REGISTRY`). New fork-owned files:
`agentSessionProviderRegistry.ts`, `agentSessionProviderBuiltins.ts`,
`agentSessionProviderCodicons.ts` (per-family `gemini`/`grok` codicons),
`defaultLaunchSurface.ts`, `agentSessionsOpener.ts` (wires `resolveSessionSurface`),
plus tests.

### (c) The `terminalTabGrouping` proposed API (~5 upstream files — gap)

To let the Copilot extension supply terminal tab groups, a new proposed API was
wired through inherited upstream files (`extensionsApiProposals.ts`,
`extHost.api.impl.ts`, `extHost.protocol.ts`, `extHostTerminalService.ts`,
`mainThreadTerminalService.ts`) plus the fork-owned
`src/vscode-dts/vscode.proposed.terminalTabGrouping.d.ts`. Backed by
`terminalTabGroupingProviderService.ts`; consumed by the agentTabs selector.
**Not yet tracked in `SEAM_MANIFEST.md`** (see §1).

### (d) In-place single-folder workspace re-root (3 upstream files)

`AX-STOKDIDE-SWITCH-ROOT-NO-RELOAD` — the worktrees panel can switch the Explorer
root to another folder (`stokd.workspace.switchRootFolder`) **without reloading
the window**, so the extension host, terminals, and running agents survive. Adds
`reRootSingleFolderWorkspace(folder)` to `IWorkbenchConfigurationService`
(`configuration.ts`) and `WorkspaceService` (`configurationService.ts`, re-inits
at the new folder reusing the current `workspace.id`), plus one import in
`workbench.common.main.ts`; fork-owned command in `…/stokd/browser/`.

### The fork-owned `agentTabs/` tree (zero-conflict)

Under `src/vs/workbench/contrib/terminal/browser/agentTabs/`:

| File | Role |
|---|---|
| `ITerminalTabsView.ts` | seam interface + compile-time assertion that stock `TerminalTabbedView` satisfies it structurally (so `terminalTabbedView.ts` is never edited) |
| `agentTabsSeam.ts` | **pure** seam decision (flag on + designated webview view id) |
| `agentTabsContribution.ts` | self-registering experimental flag (default `false`) |
| `agentTerminalTabbedView.ts` | the agent-aware view (`implements ITerminalTabsView`) |
| `agentTerminalHostController.ts` | terminal-hosting core (registers a DOM container so xterm renders) |
| `agentTerminalWebviewHost.ts` | webview-hosting core — hosts the existing code-ext Sessions webview directly in the strip via `IWebviewViewService` |
| `agentTerminalSelectorWidth.ts` | width-persistence contract (drag persists, never reset on relayout) |
| `agentTerminalSplitGroups.ts` | derives split-group membership, surfaced over `terminalTabGrouping` |
| `terminalTabGroupingProviderService.ts` | DI service backing the proposed API |
| `agentTerminalActiveHighlightBridge.ts` | highlights the active agent terminal row (commit `7b4f8e1`) |
| `agentTerminalSelectorRows.ts` / `agentTerminalSelectorModel.ts` | pure, dependency-free merge/de-dupe/sectioning + a DOM-free event model |
| `test/` | `node --test` red→green logic tests (model, seam, width, split-groups, highlight bridge) |
| `.axioms.md` | module-local invariants for the seam |

> See `docs/REBASE_RUNBOOK.md` for the rebase methodology. On rebase, re-apply and
> re-verify every `SEAM_MANIFEST.md` row plus the three open gaps in §1.

---

## 4. Package / module dependency graph

The repo is a multi-language monorepo. The root `package.json` (`code-oss-dev`)
is the TypeScript core; five constituent packages (per `.stokd/meta/config.json`)
layer onto it. (`pnpm-workspace.yaml` exists but declares only
`onlyBuiltDependencies` build-approvals — npm remains the primary package manager;
`package-lock.json` is authoritative.)

```
                       ┌─────────────────────────────────────────────┐
                       │  src/  (code-oss-dev, TypeScript core)       │
                       │  base → platform → editor → workbench →      │
                       │         sessions    + platform/agentHost     │
                       └───────────────┬─────────────────────────────┘
                                       │ built into / launched by
        ┌──────────────┬──────────────┼───────────────┬──────────────┐
        ▼              ▼              ▼               ▼              ▼
   ┌─────────┐   ┌───────────┐  ┌──────────┐   ┌──────────┐   ┌─────────┐
   │  cli/   │   │ extensions/│  │ remote/  │   │ scripts/ │   │  test/  │
   │ (Rust   │   │ (~100 +    │  │ (REH/web │   │ (launch, │   │ (harness│
   │  code   │   │  copilot)  │  │  dep     │   │  CI, fork│   │  + auto-│
   │  binary)│   │            │  │ manifests│   │  maint.) │   │ mation) │
   └────┬────┘   └─────┬──────┘  └────┬─────┘   └────┬─────┘   └────┬────┘
        │              │              │              │              │
        │ AHP / AgentHostMetadata     │ runtime      │ launches     │ drives
        │ lockfile (cross-language)   │ closure for  │ every        │ every
        └──────────────┐              │ server/web   │ surface      │ surface
                       ▼              ▼              ▼              ▼
                 src/vs/platform/agentHost  ←── shared contracts ──┘
```

### Package roles

| Package | Identity | Role | Module doc |
|---|---|---|---|
| **`src/`** (root) | npm `code-oss-dev` @ 1.125.0 | The TypeScript application core; all surfaces build from it. ESM, `"type": "module"`. | — |
| **`cli/`** | Cargo `code-cli` @ 0.1.0, binary `code` | Native Rust launcher: opens desktop editor; runs `tunnel`/`serve-web`/`command-shell`; **fork-local** `agent host\|ps\|stop\|kill\|logs`; supervises the Agent Host over AHP (`ahp`/`ahp-types` crates). | `cli/SC_MODULE.md` |
| **`extensions/`** | ~100 built-in + `copilot` | Built-in VS Code extensions (languages, grammars, themes, git/github, terminal-suggest…). Mostly inherited/read-only; the **only fork-owned** one is `copilot` (`copilot-chat` @ 0.53.0), built/tested independently (esbuild + Vitest) and excluded from packaged builds. | `extensions/SC_MODULE.md` |
| **`remote/`** | npm `vscode-reh` @ 0.0.0 (+ `remote/web`) | Build-input dependency manifests only (no app source): the runtime closure for **server (REH)** and **web (`vscode-web`)**; pins server Node `24.15.0`, `build_from_source=true` (`remote/.npmrc`). | `remote/SC_MODULE.md` |
| **`scripts/`** | shell + js | The **only supported way to launch** each surface and run the suites; fork-maintenance tooling (`sync-upstream.sh`, `verify-seam.sh`, `sync-agent-host-protocol.ts`, chat-perf/leak, `package-and-install-macos.sh` = `npm run ship`). | `scripts/SC_MODULE.md` |
| **`test/`** | npm `vscode-automation` etc. | Test harness, Playwright UI driver, smoke/sanity suites, MCP automation server (`test/mcp/src/stdio.ts`). Fork value in `automation/src/{agentsWindow,chat}.ts`. | `test/SC_MODULE.md` |

### The Agents Window (`src/vs/sessions/`)

A full fork-added workbench layer, structured like the main workbench (parts,
contribs, services) but sessions-first. Notable areas:

- **Composition roots** — `sessions.common.main.ts`, `sessions.desktop.main.ts`,
  `sessions.web.main.ts` (+ `…internal.ts`); `browser/` and `electron-browser/`
  parts, `widget/`, `media/`.
- **Session providers** — `contrib/providers/{agentHost, copilotChatSessions,
  localChatSessions, remoteAgentHost}` — the four pluggable backends.
- **Feature contribs** (`contrib/`) — `chat`, `chatDebug`, `changes`, `codeReview`,
  `github`, `files`, `fileTreeView`, `search`, `editor`, `terminal`, `browserView`,
  `tunnelHost`, `workspace`, `accountMenu`, `agentFeedback`,
  `aiCustomizationTreeView`, `applyCommitsToParentRepo`, `aquarium`,
  `policyBlocked`, `configuration`, `sessions`, `layout`.
- **Services** (`services/`) — `agentHost`, `agentHostFilter`, `chatView`,
  `sessions`, `configuration`, `extensionRecommendations`, `title`, `workspace`.
- **Bundled agent skills** (`skills/`) — `commit`, `sync`, `merge`, `create-pr`,
  `create-draft-pr`, `update-pr`, `code-review`, `act-on-feedback`,
  `generate-run-commands`, `sync-upstream`, `update-skills` — the change-landing
  slash commands shipped as agent skills.
- **Docs** — `README.md`, `SESSIONS.md`, `SESSIONS_LIST.md`, `LAYOUT.md`,
  `LAYOUT_CONTROLLER.md`, `LAYERS.md`, `MOBILE.md`, `AI_CUSTOMIZATIONS.md`,
  `copilot-customizations-spec.md`. Tests in `test/{browser,common,e2e}`.

### The Agent Host service (`src/vs/platform/agentHost/`)

The largest fork addition outside `sessions/`. **Not** a thin AHP shim — a full
session runtime split across `common/`, `browser/`, `node/`,
`electron-browser/`, `electron-main/`, `test/`. Notable areas:

- **Backends** — `node/{claude,codex,copilot,grok}/` (+ `node/shared/`,
  `node/otel/`), `agentSdkDownloader.ts`, `agentPluginManager.ts`,
  `agentService.ts`. `node/gemini/` currently holds only `ACP-STEERING-SPIKE.md`
  (the throwaway steering-tier gate, DN-4), no agent impl yet.
  - **Grok** (`node/grok/grokAgent.ts`, ~930 LOC) is a **spawn-per-turn** `IAgent`:
    each `sendMessage` spawns `grok -p <prompt> --output-format streaming-json`
    (or `-r <id>` for resume), maps NDJSON stdout to protocol `SessionAction`s,
    emulates steering via SIGTERM + resume (DN-5), defaults to deny-shell security
    (DN-4), and lists sessions by walking
    `~/.grok/sessions/<encodeURIComponent(cwd)>/<uuid>/summary.json`
    (rationale: `node/grok/GROK-DISCOVERY-GATE.md`). All grok CLI constants are
    inlined per the layer boundary.
- **Session state** — `node/sessionDatabase.ts`, `sessionDataService.ts`,
  `agentHostStateManager.ts`, `agentHostLockfile.ts`,
  `common/remoteAgentHostMetadata.ts` (`remoteAgentHostStateSchemaVersion = 1`,
  field `schemaVersion`).
- **Change landing** — `agentHostChangeset*`, `agentHostCheckpointService.ts`,
  `agentHostCommitOperation*`, `agentHostPullRequestOperation*`,
  `agentHostGitService.ts`, `diffComputeService.ts`.
- **Remote hosting** — `sshRemoteAgentHostService.ts`,
  `wslRemoteAgentHostService.ts`, `tunnelAgentHostService.ts`,
  `webSocketTransport.ts`.
- **Protocol (AHP)** — `common/state/protocol/` (vendored types, `DO NOT EDIT`,
  `AX-REPO-VENDORED-AHP-PROTOCOL`): `actions.ts`, `commands.ts`,
  `action-origin.generated.ts`, and per-domain `channels-*`;
  `protocolServerHandler.ts`.
- **Telemetry** — `node/otel/`, `otlp/`, `agentHostTelemetry*` (see `OTEL.md`).
- **Design log** — `DESIGN-DECISIONS.md` records four entries, `DN-2`…`DN-5`:
  `DN-2` (host layer for the provider abstraction), `DN-3` (Codex model sourcing
  via BYOK `LanguageModelChatProvider` scoped by `targetChatSessionType`), `DN-4`
  (Gemini steering tier — emulated ACP abort-and-replace), `DN-5` (Grok session
  listing — file-watch the per-session `summary.json` tree). Each carries a
  `**Status:**` field (all four currently `ACCEPT`); entries are append-only. The
  `AX-AGENT-CLI-PROVIDER-REGISTRY` axiom is labelled **`DN-9`** in
  `SEAM_MANIFEST.md` but has **no** `DESIGN-DECISIONS.md` entry of its own — that
  number is a manifest label, not a design-log section.

### The multi-provider chat surface (`…/chat/browser/agentSessions/`)

The fork-owned provider registry + chat-default surface (§3b). Key files:
`agentSessions.ts` (the tracked seam), `agentSessionProviderRegistry.ts`,
`agentSessionProviderBuiltins.ts`, `agentSessionProviderCodicons.ts`,
`defaultLaunchSurface.ts` (`getDefaultLaunchSurface` → `chat`; `getLaunchSurface`
honors the *Open in Terminal* escape hatch), `agentSessionsOpener.ts`
(`resolveSessionSurface()` at the `openSession()` entry point reads
`chat.agentSessions.defaultSurface`), `agentSessionsService.ts`,
`agentSessionsModel.ts`, `agentSessionsViewer.ts`, `agentSessionsPicker.ts`,
`localAgentSessionsController.ts`, plus `agentHost/` and `experiments/`
subfolders.

### Cross-language / cross-surface contracts (must migrate in lockstep)

Governed by `AX-REPO-CROSS-LANGUAGE-CONTRACTS`:

- **`AgentHostMetadata` lockfile schema** — Rust
  `cli/src/tunnels/agent_host_metadata.rs`
  (`AGENT_HOST_METADATA_SCHEMA_VERSION = 1`, field `schema_version`) ↔ TS
  `src/vs/platform/agentHost/common/remoteAgentHostMetadata.ts`
  (`remoteAgentHostStateSchemaVersion = 1`, field `schemaVersion`).
- **Supervisor handshake** env/sentinels: `VSCODE_AGENT_HOST_SUPERVISOR`,
  `__VSCODE_AGENT_HOST_READY__`.
- **AHP** method names/params/error codes — distinct version constants that must
  **not** be conflated: the Rust **wire/metadata** version
  `AGENT_HOST_PROTOCOL_VERSION = "0.1.0"`
  (`cli/src/tunnels/agent_host_metadata.rs`, field `protocol_version`; crates
  `ahp`/`ahp-types`) and the TS **state-model** version
  `PROTOCOL_VERSION = '0.4.0'` (`…/common/state/protocol/version/registry.ts`,
  `SUPPORTED_PROTOCOL_VERSIONS = ['0.4.0', '0.3.0']`). The TS types are
  **vendored** into `…/common/state/protocol/` by
  `scripts/sync-agent-host-protocol.ts` from the sibling `agent-host-protocol`
  repo. (Separately, `cli/src/constants.rs` carries the upstream tunnel-CLI
  `PROTOCOL_VERSION: u32 = 5` / `protocolv5` tag — unrelated to AHP.)
- **Launcher stdout handshakes / ports** (`AX-REPO-SERVER-LAUNCH-HANDSHAKE`):
  server `Web UI available at <addr>` → port `9888`; agent host `READY:<port>`.
  Default ports: server `9888`, web `8080`, agent-host/sessions-web launcher
  `8081`; Rust `cli/src/constants.rs` `CONTROL_PORT = 31545`,
  `AGENT_HOST_PORT = 31546`.
- **`terminalTabGrouping` proposed API** — `.d.ts` ↔ the five wired upstream
  files in §3(c); changing the shape requires editing every binding together.
- **Codex protocol types** — `node/codex/protocol/generated/` regenerated only via
  `npm run codex:gen-protocol` (pinned `build/codex/codex-version.txt`), never
  hand-edited.
- **Automation driver `.d.ts`** ↔
  `src/vs/workbench/services/driver/common/driver.ts` (kept in sync by
  `test/automation/tools/copy-driver-definition.js`).
- **Lockfiles** (`AX-REPO-LOCKFILE-SYNC`): every `package.json` with a committed
  `package-lock.json` (root, `remote/`, `remote/web/`, `test/` sub-packages) must
  be regenerated in the same change as any dependency edit.

---

## 5. Key technologies & patterns

### Languages & runtimes
- **TypeScript** (ESM, `"type": "module"`) — the core; compiled with a TypeScript
  `next`/native-preview toolchain (`tsgo` / `@typescript/native-preview`).
- **Rust** (edition 2021) — the `code` CLI (`tokio`, `clap`, `reqwest`,
  `rmp-serde`, `keyring`, `hyper`/`hyper-util`, `tokio-tungstenite`, dev-tunnels,
  `ahp`/`ahp-types`).
- **Node.js 24.15.0** — pinned for the remote server (`remote/.npmrc`).
- **Electron 42.2.0** — desktop runtime.

### Core patterns (inherited from VS Code, preserved by the fork)
- **Dependency injection** via service interfaces + `registerSingleton`
  (decorator `createDecorator`); service deps declared in constructors only.
- **Layered + environment-split modules** (`common`/`browser`/`node`/
  `electron-*`) enforced by `valid-layers-check`.
- **Contribution model** — workbench features self-register; extensions
  contribute via `package.json` `contributes`/`activationEvents`.
- **Event-driven** (`Emitter`/`Event`), disposables (`DisposableStore`,
  `MutableDisposable`, `DisposableMap`), reactive **observables** (`derived`,
  `autorun`) — heavily used by the Agents Window input pipelines.

### Fork-specific patterns
- **Descriptor-driven provider registry** *(new)* — every agent-CLI provider
  (Claude, Copilot CLI, Codex, Gemini, Grok, …) is registered as a descriptor in
  `AgentCliProviderRegistry` / `agentSessionProviderRegistry`; upstream switches
  resolve from the registry's `default` branch. Adding a provider is *descriptor +
  adapter + `package.json`* — no new upstream `case` literals
  (`AX-AGENT-CLI-PROVIDER-REGISTRY`, DN-9).
- **Chat as default surface, terminal as opt-in escape hatch** *(new)* —
  `getDefaultLaunchSurface` returns `chat` for every provider; the revertible
  setting `chat.agentSessions.defaultSurface` (default `chat`) and the explicit
  *Open in Terminal* action preserve the (deprecated, default-off) agentTabs
  selector without removing it.
- **Spawn-per-turn vs. long-lived adapters** *(new)* — `IAgent` providers choose a
  steering tier from documented spike evidence: Claude uses live `priority:'now'`
  injection (DN-2); Grok emulates steering via SIGTERM + resume (DN-5); Gemini's
  ACP agent does cancel-and-replace (DN-4). The tier is set from a pinned-version
  spike, not assumed.
- **Session providers** — pluggable agent backends behind the Agents Window
  (`contrib/providers/{agentHost,copilotChatSessions,localChatSessions,
  remoteAgentHost}`), backed by `agentHost/node/{claude,codex,copilot,grok}`.
- **Seam interface + pure decision** — `ITerminalTabsView` lets the pane hold
  *either* terminal view; `agentTabsSeam.ts` makes the on/off choice a pure,
  unit-testable function; a structural compile-time assertion keeps the off-path
  identical to upstream.
- **Webview re-hosting** — the agent terminal view hosts the existing code-ext
  Sessions webview in the terminal strip (`agentTerminalWebviewHost.ts`) rather
  than re-drawing UI.
- **Vendored generated code** — AHP and Codex protocol types regenerated from
  pinned sources, never hand-edited (banner-guarded).
- **Flag-gated experiments** — fork behavior defaults off so the off-path is
  byte-identical to upstream.

### Key external integrations
- **AI SDKs**: `@anthropic-ai/sdk`, `@anthropic-ai/claude-agent-sdk`,
  `@openai/codex`, `@github/copilot`, `@github/copilot-sdk`,
  `@vscode/copilot-api`, `@microsoft/mxc-sdk`; the xAI **Grok** CLI is shelled out
  to (not an SDK dependency).
- **Microsoft dev-tunnels** — relay for `code tunnel` and remote agent-host
  exposure (port `31546`).
- **xterm.js** (`@xterm/*` beta) — the integrated terminal.
- **Open VSX** — the extension marketplace (`open-vsx.org`), replacing the
  Microsoft gallery.
- **Telemetry** — Microsoft 1DS (`@microsoft/1ds-*`); OTEL/OTLP in
  `platform/agentHost`.
- **Auth** — GitHub / Microsoft device flow + OS keyring (CLI `auth.rs`,
  `keyring` crate); `*-authentication` built-in extensions feed
  `git`/`github`/`copilot`.

---

## 6. Development workflow & build system

### Build orchestration
- **Gulp** (`gulpfile.mjs` → `build/gulpfile*.ts`) is the primary build system,
  driven through `npm run gulp <target>` (Node with `--experimental-strip-types`,
  8 GB heap).
- **`build/next/index.ts`** drives the fast transpile path
  (`npm run transpile-client` / `watch-client-transpile`).
- **TypeScript native preview** (`tsgo`) powers the fast type-checks
  (`compile-check-ts-native`, `valid-layers-check`, dts checks).
- **Rust/Cargo** builds the CLI (`npm run gulp compile-cli` / `watch-cli`, or
  `cargo` directly in `cli/`).
- The **Copilot** extension builds independently (`compile-copilot` →
  `npm --prefix extensions/copilot run compile`, esbuild + Vitest).
- `npm install` runs `build/npm/preinstall.ts` + `postinstall.ts` hooks.

### Common commands
| Intent | Command |
|---|---|
| Full compile | `npm run compile` (client + copilot) |
| Fast transpile | `npm run transpile` |
| Watch (all) | `npm run watch` (or `watchd` via deemon daemon) |
| Type/layer check | `npm run valid-layers-check`, `npm run compile-check-ts-native` |
| Lint / format | `npm run eslint`, `npm run stylelint`, `npm run hygiene` |
| Launch desktop | `./scripts/code.sh` |
| Launch web | `./scripts/code-web.js` |
| Launch server (REH) | `./scripts/code-server.js` (port 9888) |
| Launch Agents Window (web) | `./scripts/code-sessions-web.js` (port 8081) |
| Launch Agent Host | `./scripts/code-agent-host.js` (port 8081) |
| Seam guard | `scripts/verify-seam.sh` |
| Sync upstream | `scripts/sync-upstream.sh` |
| Sync AHP protocol | `npx tsx scripts/sync-agent-host-protocol.ts` |
| Regenerate Codex protocol | `npm run codex:gen-protocol` |
| Package + install (macOS) | `npm run ship` (`scripts/package-and-install-macos.sh`) |

> Per `.claude/CLAUDE.md`: never use `npm run compile` to *check* for TS errors —
> watch the build task output or run `npm run compile-check-ts-native` (src) /
> `npm run gulp compile-extensions` (extensions). Never run tests with
> compilation errors outstanding.

### Testing (`SC_TEST.md`; `AX-REPO-FORK-TDD-SCOPE`)
- **Unit (node)**: `npm run test-node` (mocha, tdd UI). Pure-logic fork tests
  also run via `node --test` against `out/` (e.g. the `agentTabs/test/*`).
- **Unit (browser)**: `npm run test-browser`.
- **Extension**: `npm run test-extension` (vscode-test); copilot uses Vitest
  (e.g. `npx vitest --run --pool=forks src/extension/chatSessions/grok` — 54
  tests / 8 files — exercises a provider built entirely on the registry).
- **CLI**: `cd cli && cargo test` (e.g. `cargo test agent_host` round-trips the
  lockfile schema).
- **Smoke / automation**: `npm run smoketest`; Playwright driver in
  `test/automation/`; agentic-surface coverage in
  `automation/src/{agentsWindow,chat}.ts` and
  `smoke/src/areas/{agentsWindow,chat}/`; MCP automation server in
  `test/mcp/src/stdio.ts`.

**TDD is mandatory** (Axiom 5 / `AX-REPO-FORK-TDD-SCOPE`): every fork behavioral
change adds a test observed to fail (red) before implementation and pass (green)
after. Inherited upstream code is **re-verified by existing runners, not
re-tested** with new fork tests. The multi-provider work made this concrete — its
acceptance criteria (`AC-P0.* … AC-P4.*`) are each backed by a red→green test, and
provider discovery gates (`GROK-DISCOVERY-GATE.md`, `ACP-STEERING-SPIKE.md`) pin a
binary version before any listing/steering strategy is committed.

### Fork maintenance / rebase
- `scripts/sync-upstream.sh` wires the `upstream` remote and reports the next
  rebase target; `.github/workflows/upstream-sync.yml` (on `main`) rebases the
  patch stack onto upstream tags and runs fast checks.
- On every rebase, re-apply and re-verify every `SEAM_MANIFEST.md` row **plus the
  three open gaps in §1** (terminalTabGrouping wiring, editor watermark, the
  52-file user-visible string rebrand). The most rebase-fragile points are the
  `terminalView.ts` seam, the `agentSessions.ts` provider seam, the
  `terminalTabGrouping` extHost wiring, and the broad branding rebrand.

---

## 7. Critical paths

### Headline end-to-end agentic loop (spans surfaces; from `SC_FLOWS.md`)
```
C2    start a backend        code agent host            (cli/ → platform/agentHost)
S3/S4 create & send session  Agents Window / chat       (src/vs/sessions/ ; chat surface)
S5    continue turns         multi-chat                 (sessions + copilot + providers)
S8    review & land changes  diff / commit / PR / merge (sessions + agentHost changeset)
S9    drop into full editor  → W1 Open Folder & Edit    (workbench)
        observe out-of-band: C3 agent ps · C4 agent logs · T1 agent terminal strip (opt-in)
```

### Provider resolution + launch-surface path (new)
A session click enters `agentSessionsOpener.openSession()` →
`resolveSessionSurface()` reads `chat.agentSessions.defaultSurface` and calls
`getLaunchSurface()` (`defaultLaunchSurface.ts`) → `chat` by default, or `terminal`
via the *Open in Terminal* escape hatch. Provider identity (name/icon/family/
first-party/continue-in/description) resolves through the eight functions in
`agentSessions.ts`, whose `default` branches read `agentSessionProviderRegistry`.

### Agent Host supervision path
`cli/src/commands/agent_host.rs` (`agent host`) → downloads & spawns the
agent-host child → supervisor handshake (`VSCODE_AGENT_HOST_SUPERVISOR` /
`__VSCODE_AGENT_HOST_READY__`) → AHP over the wire → TS side
`out/vs/platform/agentHost/node/agentHostServerMain.js` (`READY:<port>`); session
state under `cli/src/state.rs` `LauncherPaths` (lockfiles
`agent-host-<quality>.lock`, logs, download cache; keyring credentials) and the TS
`sessionDatabase.ts`. Backends dispatch through
`agentHost/node/{claude,codex,copilot,grok}`; remote hosting via
`{ssh,wsl,tunnel}RemoteAgentHostService.ts`; tunnel port `AGENT_HOST_PORT = 31546`.

### Inherited workbench paths
W1 Open Folder & Edit, W2 Review a Diff, W3 Run a Task / Integrated Terminal,
W4 Open a Webview / Custom Editor — unchanged upstream flows; T1 (agent terminal
strip) reduces to W3 when the flag is off / chat surface is default.

---

## 8. Where to look (quick index)

| You want… | Go to |
|---|---|
| The Agents Window | `src/vs/sessions/` (+ `README.md`, `SESSIONS.md`, `LAYOUT.md`, `LAYERS.md`) |
| Session providers | `src/vs/sessions/contrib/providers/{agentHost,copilotChatSessions,localChatSessions,remoteAgentHost}` |
| Multi-provider chat surface / provider registry | `src/vs/workbench/contrib/chat/browser/agentSessions/` (`agentSessions.ts`, `agentSessionProviderRegistry.ts`, `defaultLaunchSurface.ts`, `agentSessionsOpener.ts`) |
| Agent Host service / AHP / metadata / changesets | `src/vs/platform/agentHost/` (`OTEL.md`; `DESIGN-DECISIONS.md`; `common/state/AGENTS.md`) |
| Grok / Gemini backends | `src/vs/platform/agentHost/node/grok/` (`grokAgent.ts`, `GROK-DISCOVERY-GATE.md`); `node/gemini/ACP-STEERING-SPIKE.md` |
| Terminal seam + tab grouping + webview host | `…/terminal/browser/terminalView.ts` + `…/agentTabs/`; `vscode.proposed.terminalTabGrouping.d.ts`; `SEAM_MANIFEST.md` |
| In-place workspace re-root | `…/services/configuration/{common/configuration.ts,browser/configurationService.ts}`; `…/stokd/browser/switchRootFolder.contribution.ts` |
| The Rust CLI | `cli/src/` (`commands/`, `tunnels/`, `auth.rs`, `state.rs`, `constants.rs`) |
| Copilot Chat | `extensions/copilot/` (package `copilot-chat` @ 0.53.0; its own `CLAUDE.md`) |
| How to launch anything | `scripts/code*.{sh,js,bat}` |
| Branding / marketplace | `product.json` (Stokd; Open VSX) |
| Upstream-edit accounting | `SEAM_MANIFEST.md` (+ the three open gaps in §1) |
| Build logic | `build/`, `gulpfile.mjs`, `build/next/index.ts`, root `package.json` scripts |
| Repo invariants | `.stokd/meta/SC_AXIOMS.md` + per-package `.axioms.md` |
| Product framing | `.stokd/meta/SC_PRODUCT_CODE_OSS_DEV.md` |
| User flows | `.stokd/meta/SC_FLOWS.md` |
| Test strategy | `.stokd/meta/SC_TEST.md` |

---

*Upgraded (0.5.0 → 0.6.0) from direct analysis of `package.json`, `product.json`,
`cli/Cargo.toml` / `cli/src/constants.rs` / `cli/src/tunnels/agent_host_metadata.rs`,
`extensions/copilot/package.json`, `SEAM_MANIFEST.md` (now ~331 lines, multi-seam),
`src/vs/platform/agentHost/` (incl. `DESIGN-DECISIONS.md`, `node/grok/`,
`node/gemini/`), `src/vs/workbench/contrib/chat/browser/agentSessions/`,
the terminal `agentTabs/` tree, recent `git` history (multi-provider LLM CLI
project — PRs #4/#5, the Grok spawn-per-turn adapter, the chat-default surface,
in-place re-root, and the 52-file user-visible rebrand), and the existing
`.stokd/meta/` documents. Net change since 0.5.0: added the multi-provider chat
surface as a first-class fork capability, the Grok/Gemini backends, the design
log, and the in-place re-root seam; reconciled the 0.5.0 seam-drift around the
terminal seam; flagged three still-open `SEAM_MANIFEST.md` gaps. Meta version 0.6.0.*
