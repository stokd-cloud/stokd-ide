<!-- stokd-meta: SC_PRODUCT_CODE_OSS_DEV.md | metaVersion 0.6.0 | generated: UPGRADE (from 0.5.0) -->
# SC_PRODUCT — `code-oss-dev` (Stokd Code)

> Product classification document. Upgraded 0.5.0 → 0.6.0 (accurate 0.5.0 content
> preserved and re-verified against the tree; the multi-provider LLM CLI work from
> PRs #4/#5 — the chat-as-default surface, five providers Claude/Copilot/Codex/
> **Gemini**/**Grok**, the Grok spawn-per-turn adapter, the in-place re-root seam, and
> the design-decisions log — is folded into the description, surfaces, flows, modules,
> boundaries, and three new product axioms).
> Repo: `/opt/worktrees/stokd-cloud/stokd-ide/main` — root npm package
> `code-oss-dev` @ `1.125.0`. Origin `github.com/stokd-cloud/stokd-ide`;
> upstream `github.com/microsoft/vscode`.
>
> Companion docs in this directory: `SC_OVERVIEW.md` (codebase overview),
> `SC_AXIOMS.md` (repo invariants), `SC_FLOWS.md` (user flows, W1–W4 / T1 /
> S1–S9 / C1–C7), `SC_VIEWS.md` (views V1–V31), `SC_TEST.md`,
> `SC_RECOMMENDATIONS.md`, and the per-package `SC_MODULE.md` files under
> `cli/`, `extensions/`, `remote/`, `scripts/`, `test/`. The fork's
> upstream-edit accounting lives in `SEAM_MANIFEST.md` (repo root); the agent
> host's design-decision log lives in `src/vs/platform/agentHost/DESIGN-DECISIONS.md`.

---

## Product name & constituent packages

- **Product name:** `code-oss-dev` — branded **Stokd Code** (`product.json`:
  `nameLong = "Stokd Code"`, `nameShort = "Stokd"`, `applicationName = "stokd-code"`).
- **This is a single product**, not a family. The desktop app, the web workbench,
  the remote server (REH), the Agents Window, the multi-provider chat surface, the
  Rust `code` CLI, and the Copilot Chat extension are **different surfaces of one
  offering** — the same `src/` TypeScript core built and launched in different
  runtimes. They share users, goals, data stores, and the agentic-loop flow, so they
  are documented here as one product rather than split into separate product docs.
- **Constituent packages** (per `.stokd/meta/config.json`), all layered on the
  primary `src/` application:

| Package | Identity | Module doc |
|---|---|---|
| `src/` (root) | npm `code-oss-dev` @ 1.125.0 (TypeScript core; ESM) | — |
| `cli` | Cargo `code-cli` @ 0.1.0, binary `code` | `cli/SC_MODULE.md` |
| `extensions` | ~95 built-in + fork-owned `copilot` (`copilot-chat` @ 0.53.0) | `extensions/SC_MODULE.md` |
| `remote` | npm `vscode-reh` (+ `vscode-web`) | `remote/SC_MODULE.md` |
| `scripts` | shell + js launchers / fork tooling | `scripts/SC_MODULE.md` |
| `test` | `vscode-automation` + smoke / sanity / mcp harness | `test/SC_MODULE.md` |

---

## Description — what this product is and the problem it solves

`code-oss-dev` is a **thin-patch fork of Microsoft VS Code** ("Code – OSS"),
re-branded as **Stokd Code** and maintained by stokd-cloud. It keeps the entire
VS Code editing experience (workbench, Monaco editors, integrated terminal, SCM,
language services, ~100 built-in extensions) intact and **layers a first-class
agentic developer experience on top**, while holding the edited-upstream surface
as small as practical so each rebase onto a new VS Code release stays a routine,
low-conflict operation (`AX-PROD-CODE-OSS-DEV-001`).

**The problem it solves:** developers increasingly run AI coding agents alongside
their own work, but stock VS Code has no first-class place to **host**,
**observe**, **triage**, and **land the output of** many concurrent agent
sessions — and no provider-neutral place to drive *any* agent CLI. This fork adds
that layer end-to-end through **five** fork-distinguishing capabilities:

1. **Agents Window** — `src/vs/sessions/` — a dedicated, fixed-layout,
   sessions-first workbench **window** (distinct from the main editor window;
   `WindowVisibility.Sessions`) for creating agent sessions, streaming chat turns,
   reviewing/committing/landing agent output, and managing many sessions
   side-by-side. Backends plug in as **session providers** (local chat, copilot
   chat, agent host, remote agent host).
2. **Agent Host platform service** — `src/vs/platform/agentHost/` — the large
   fork-added platform service that actually runs sessions: AHP client/server
   glue, multiple agent backends (`claude`, `codex`, `copilot`, `grok`; `gemini`
   spiked), changeset / checkpoint / commit / PR operations, a session database,
   git state tracking, SSH/WSL/tunnel remote hosting, and OTEL telemetry. Its
   design rationale is logged in `DESIGN-DECISIONS.md` (`DN-2 … DN-5`).
3. **Multi-provider LLM CLI chat surface** *(new since 0.5.0)* —
   `src/vs/workbench/contrib/chat/browser/agentSessions/` — the chat panel is now a
   **provider-agnostic LLM-CLI surface**. A fork-owned descriptor registry
   (`agentSessionProviderRegistry.ts` + the copilot-side
   `AgentCliProviderRegistry`) replaces per-provider switch cases in the tracked
   seam `agentSessions.ts`, so Claude, Copilot CLI (Background), Codex, **Gemini**,
   and **Grok** all resolve through descriptors. **Chat is the default launch
   surface** for every provider; the terminal selector is demoted to an opt-in
   escape hatch via the revertible setting `chat.agentSessions.defaultSurface`
   (default `'chat'`). Governed by the feature-local axiom
   `AX-AGENT-CLI-PROVIDER-REGISTRY` (DN-9) (`AX-PROD-CODE-OSS-DEV-009`/`-010`).
4. **Agent-aware terminal selector** —
   `src/vs/workbench/contrib/terminal/browser/agentTabs/` — an experimental,
   flag-gated terminal tabs strip that hosts the code-ext Sessions webview and
   surfaces agent terminals alongside human terminals, backed by the
   `terminalTabGrouping` proposed API. **Reframed by capability #3:** retained,
   default-off (`terminal.integrated.agentTabs.enabled = false`, now carrying a
   `markdownDeprecationMessage`), reached only when `chat.agentSessions.defaultSurface`
   is `'terminal'` or via the explicit *Open in Terminal* action. Never removed
   (`AX-PROD-CODE-OSS-DEV-010`).
5. **Copilot Chat extension** — `extensions/copilot/` (`copilot-chat` @ 0.53.0) —
   the fork-owned, independently-built AI chat/agent extension that powers the chat
   content surfaced by the Agents Window and the multi-provider chat surface, and
   hosts the provider descriptors for Gemini and Grok.

The headline end-to-end loop spans every surface: start a backend
(`code agent host`) → pick a provider and create & send a session (Agents Window /
chat) → continue turns → review & land changes (commit / PR / merge) → optionally
drop into the full editor; observe out-of-band via the CLI (`agent ps` /
`agent logs`) or, when routed to the terminal, the agent terminal selector.

**Branding (`product.json`):** re-branded to Stokd Code (`dataFolderName = .stokd`,
`darwinBundleIdentifier = cloud.stokd.code`, `urlProtocol = stokd-code`,
`tunnelApplicationName = stokd-tunnel`) and the marketplace switched from the
Microsoft gallery to **Open VSX** (`https://open-vsx.org/vscode/gallery`)
(`AX-PROD-CODE-OSS-DEV-008`). License MIT; tracks upstream release line `1.125.0`.

---

## Target audience

- **Primary: developers running AI coding agents** who want to host, observe,
  triage, and land the output of many concurrent agent sessions — across **any of
  five providers** (Claude, Copilot, Codex, Gemini, Grok) — inside their editor.
  The Agents Window / multi-provider chat persona (flows S1–S9).
- **Developers using a full IDE** — the inherited VS Code editing experience
  (open/edit, diffs, tasks/terminal, webviews/custom editors; flows W1–W4).
- **Operators / power users running headless or remote** — the Rust `code` CLI
  and Agent Host supervisor: authenticate, start an agent host / tunnel / serve
  web, list/stream/stop sessions, manage tunnels and versions (flows C1–C7).
- **Fork maintainers and CI** — consumers of the launch handshakes, seam guard,
  and rebase tooling in `scripts/` and `test/`.

---

## Entry points / surfaces

The same `src/` core is launched across several runtimes (see `SC_OVERVIEW.md` §2):

| Surface | Runtime | Primary entry | Launcher |
|---|---|---|---|
| **Desktop workbench** | Electron 42.2.0 | `src/main.ts` → `out/main.js` | `scripts/code.sh` / `code.bat` |
| **Web workbench** | Browser | `vscode-web` build assets | `scripts/code-web.js` (port `8080`) |
| **Remote server (REH)** | Node 24.15.0 | `src/server-main.ts` | `scripts/code-server.js` (port `9888`, `Web UI available at <addr>`) |
| **Agents Window (desktop)** | Electron | `src/vs/sessions/sessions.desktop.main.ts` | desktop app, `WindowVisibility.Sessions` |
| **Agents Window (web standalone)** | Browser | `src/vs/sessions/sessions.web.main.ts` | `scripts/code-sessions-web.js` (port `8081`) |
| **CLI / Agent Host** | Rust native + Node | `cli/src/bin/code/main.rs`; `out/vs/platform/agentHost/node/agentHostServerMain.js` | `scripts/code-cli.sh`; `scripts/code-agent-host.js` (port `8081`, `READY:<port>`) |

**Surface-level entry mechanisms:**

- **CLI command surface** (`cli/src/commands/args.rs`): `tunnel`, `serve-web`,
  `command-shell`, `version`, `ext`/`status`, `update`, and the **fork-local**
  `agent host|ps|stop|kill|logs` family.
- **Agents Window composition roots**: `sessions.{common,desktop,web}.main*.ts`;
  New Session / session picker / project bar / Changes view actions; git action
  commands (`…sessions.commit`, `…sessions.commitAndSync`, `…sessions.sync`,
  `…sessions.initializeRepository`).
- **Multi-provider chat surface** (fork-owned registry seam,
  `src/vs/workbench/contrib/chat/browser/agentSessions/`): provider resolution
  flows through `agentSessions.ts` (the tracked seam) whose `default` branches read
  `agentSessionProviderRegistry`; a newly-opened session is routed by
  `agentSessionsOpener.resolveSessionSurface()` →
  `getLaunchSurface()` (`defaultLaunchSurface.ts`,
  `DEFAULT_AGENT_LAUNCH_SURFACE = 'chat'`,
  `AGENT_DEFAULT_SURFACE_SETTING_ID = 'chat.agentSessions.defaultSurface'`) to the
  Agents Window chat by default. Providers register as pure-data descriptors
  (`agentSessionProviderBuiltins.ts`; copilot-side
  `chatSessions/common/{agentCliProvider.ts,agentCliProviderRegistry.ts}`; Gemini →
  `chatSessions/gemini/common/geminiProviderDescriptor.ts`, Grok →
  `chatSessions/grok/common/grokProviderDescriptor.ts`).
- **Terminal seam** (flag-gated, opt-in since 0.6.0):
  `terminal.integrated.agentTabs.enabled` (default `false`, now deprecated) **and**
  a registered webview resolver for `terminal.integrated.agentTabs.viewId` route
  the panel through `terminalView.ts` `_createTabsView()` to
  `AgentTerminalTabbedView`; a session only *lands* here when
  `chat.agentSessions.defaultSurface` is `'terminal'` or *Open in Terminal* is used.
- **Copilot extension contributions** (`extensions/copilot/`): chat session
  providers, slash commands (`/agents`, `/hooks`, `/memory`, `/terminal`),
  permission/question dialogs, MCP-server contributors, hooks; `main` →
  `./dist/extension`, 63 `enabledApiProposals`.
- **Launcher stdout handshakes / ports** (`scripts/`): `Web UI available at …`
  (server `9888`), `READY:<port>` (agent host `8081`), `Sessions Web running at …`
  (sessions web `8081`), `Starting @vscode/test-web …` (web `8080`); plus the
  supervisor sentinel `__VSCODE_AGENT_HOST_READY__` and CLI control ports
  (`CONTROL_PORT = 31545`, `AGENT_HOST_PORT = 31546`).

---

## Flows (from `SC_FLOWS.md`)

Every flow in `SC_FLOWS.md` belongs to this single product. Four families
(`W*` inherited; `T1` terminal seam; `S*` Agents Window; `C*` CLI). The 0.6.0
multi-provider work added **no new flow IDs** — it is folded into S3/S5 (provider
& launch-surface pickers), T1 (now opt-in), and cross-flow notes — preserving the
W1–W4 / T1 / S1–S9 / C1–C7 regression-contract IDs.

**W. Workbench (inherited upstream)** — re-verified, not re-documented:
- **W1** Open a Folder/Workspace & Edit a File · **W2** Review a Diff (SCM/compare)
  · **W3** Run a Task / Use the Integrated Terminal · **W4** Open a Webview / Custom
  Editor.

**T. Terminal seam (fork, flag-gated, opt-in since 0.6.0):**
- **T1** Select an Agent Terminal Alongside Human Terminals — superseded as the
  default by the chat surface; retained as an opt-in escape hatch (DN-1), never
  removed.

**S. Agents Window (fork, `src/vs/sessions/`) — provider-agnostic across five providers:**
- **S1** First-Launch Setup / Welcome · **S2** Sign In / Manage Account · **S3**
  Create a New Session & Send First Message (multi-provider type/model/permission-mode
  pickers; chat-as-default destination) · **S4** Send a New Session in the
  Background · **S5** Continue Session / Multi-Chat (provider-agnostic permission-mode
  picker; embedded browser V30) · **S6** Browse / Filter / Triage Sessions · **S7**
  Work With Multiple Sessions Side-by-Side (Files/Explorer aux bar, V29) · **S8**
  Review & Apply Changes / Commit / PR / Merge (V29 default aux container ⇄ V7
  Changes) · **S9** Open Session in VS Code / Run Script / Open Terminal (V30 embedded
  browser).

**C. CLI (fork-flavored, Rust `code` binary):**
- **C1** Authenticate / Log In · **C2** Start an Agent Host / Tunnel / Serve Web ·
  **C3** List Active Sessions (`agent ps`) · **C4** Stream Agent Logs
  (`agent logs`) · **C5** Stop / Kill the Agent Host · **C6** Manage Tunnels ·
  **C7** Update / Check Version.

**Headline end-to-end agentic loop (spans surfaces):** C2 → S3/S4 (pick a provider,
land in chat by default) → S5 → S8 → S9 (→ W1), observed out-of-band via C3/C4 or,
when routed to the terminal, T1. The user-facing flows W1–W4, T1, S1–S9, C1–C7 are
a **regression contract** — they must not regress without a governed task +
red→green test (`AX-PROD-CODE-OSS-DEV-007`).

---

## Modules — how each package contributes

The primary `src/` app (not a separate package) hosts the Agents Window
(`src/vs/sessions/`), the Agent Host platform service
(`src/vs/platform/agentHost/`), the **multi-provider chat surface**
(`…/chat/browser/agentSessions/`), the terminal seam
(`…/terminal/browser/agentTabs/`), and the inherited workbench/editor core. The
five constituent packages layer onto it:

### `cli` — `cli/SC_MODULE.md`
The native Rust `code` binary (single statically-linked binary, no Node runtime).
Three roles: (1) **launcher** — resolve & exec the installed desktop editor;
(2) **remote-access servers** — `tunnel` (dev-tunnels relay), `serve-web`,
`command-shell`; (3) **fork-local Agent Host supervision/client** — `agent host`
daemonizes a supervisor that binds a loopback listener, mints a connection token,
manages the downloaded Agent Host backend child, and writes
`agent-host-<quality>.lock`; `agent ps|stop|logs` are AHP WebSocket clients;
`agent kill` tears the supervisor down. Owns CLI views **V23–V27** and flows
**C1–C7**. Cross-language contract: `AgentHostMetadata`
(`cli/src/tunnels/agent_host_metadata.rs`, `AGENT_HOST_METADATA_SCHEMA_VERSION = 1`,
wire `AGENT_HOST_PROTOCOL_VERSION = "0.1.0"`) ↔ TS
`src/vs/platform/agentHost/common/remoteAgentHostMetadata.ts`.

### `extensions` — `extensions/SC_MODULE.md`
Home of VS Code's built-in extensions. The overwhelming majority are **inherited
upstream and read-only** under thin-patch discipline (languages, grammars, themes,
`git`/`github`, `terminal-suggest`, …). The single **fork-owned** extension is
**`copilot`** (`copilot-chat`) — the first-party AI chat/agent extension built &
tested independently (esbuild + Vitest, excluded from packaged builds). It powers
the Agents Window / multi-provider chat **content** (the window supplies the
surface) and, since 0.6.0, hosts the **agent-CLI provider registry seam**
(`chatSessions/common/{agentCliProvider.ts,agentCliProviderRegistry.ts}`) and the
**Gemini** and **Grok** provider descriptors
(`chatSessions/{gemini,grok}/common/`). It owns the Copilot dialog views **V21**
(slash-command wizards) and **V22** (permission / question carousel) for flows
S3–S5. `git`/`github` feed the Agents Window Changes view via API proposals
(`scmHistoryProvider`, `agentSessionsWorkspace`, …).

### `remote` — `remote/SC_MODULE.md`
A **build-input dependency-manifest module** — ships no application source. It
declares, pins, and locks the runtime closure for the two server-side
distributions: **`vscode-reh`** (headless server: `node-pty`, SSH, ripgrep,
Copilot SDK, telemetry) and **`vscode-web`** (browser-safe subset). It is the
single source of truth for the server's Node.js version (`remote/.npmrc`
`target="24.15.0"`, `build_from_source="true"`). Supplies the runtime deps behind
the web shell (V1/V17), the terminal stack (`@xterm/*`, V14/V18), and ripgrep
search; consumed by `build/gulpfile.reh.ts` / `build/gulpfile.vscode.web.ts`.

### `scripts` — `scripts/SC_MODULE.md`
The developer- and CI-facing tooling layer — **the only supported way to launch
and validate** every runtime surface. Cross-platform launcher trios (`code`,
`code-cli`, `code-server`, `code-web`) plus fork additions: the agent-host
launcher (`code-agent-host.js`), the standalone Agents/Sessions web launcher
(`code-sessions-web.js`), fork-maintenance tooling (`sync-upstream.sh`,
`verify-seam.sh`, `sync-agent-host-protocol.ts`), the macOS package-and-install
flow (`package-and-install-macos.sh` = `npm run ship`), and the chat perf/leak
harness (which now exercises the multi-provider chat surface). Owns view **V28**
(launcher terminal output) and the stdout-handshake / default-port contracts
(flow C2). The 0.6.0 multi-provider work landed in `extensions/copilot`, **not**
in `scripts`.

### `test` — `test/SC_MODULE.md`
The test-harness and UI-automation layer: Mocha/Playwright/Electron unit runners,
the `vscode-automation` Playwright driver, smoke/sanity suites, the Monaco
packaging check, and the MCP automation server (`test/mcp/src/stdio.ts`,
`mcp/automationTools/chat.ts`). Drives and asserts against every surface (V1–V31).
Fork value-add: `automation/src/{agentsWindow,chat}.ts`,
`smoke/src/areas/{agentsWindow,chat}/`, and
`componentFixtures/playwright/tests/imageCarousel.spec.ts` (V19). The
`agentsWindow.ts` selectors are a direct contract with `src/vs/sessions/` DOM
classes — the fork's most fragile automation surface.

---

## Operational boundaries

**External systems & integrations**
- **AI SDKs** — `@anthropic-ai/sdk`, `@anthropic-ai/claude-agent-sdk`,
  `@openai/codex`, `@github/copilot`, `@github/copilot-sdk`, `@vscode/copilot-api`,
  `@microsoft/mxc-sdk` (root + `remote/`); dispatched by
  `agentHost/node/{claude,codex,copilot}` and the copilot extension session
  adapters. The xAI **Grok** CLI is **shelled out to** (spawn-per-turn
  `grok -p … --output-format streaming-json` / `-r <id>`,
  `agentHost/node/grok/grokAgent.ts`), **not** an SDK dependency; **Gemini** is an
  ACP agent (steering-tier spiked, no production adapter yet).
- **Microsoft dev-tunnels** — relay for `code tunnel` and remote agent-host
  exposure (`AGENT_HOST_PORT = 31546`).
- **Open VSX** — the extension marketplace (`open-vsx.org`), replacing the
  Microsoft gallery.
- **Auth** — GitHub / Microsoft device flow + OS keyring (CLI `auth.rs`,
  `keyring` crate); the `*-authentication` built-in extensions feed
  `git`/`github`/`copilot`.
- **Telemetry** — Microsoft 1DS (`@microsoft/1ds-*`); OTEL/OTLP in
  `platform/agentHost` (`OTEL.md`).
- **xterm.js** (`@xterm/*`) for the integrated terminal; **MCP servers** reachable
  by the copilot session adapters and the test MCP automation server; the
  IDE↔CLI MCP reverse channel (in-proc HTTP server + lock-file + nonce) preserved
  by the opt-in terminal seam.

**Data stores & state**
- **Agent-host session state** — the TS `sessionDatabase.ts`
  (`src/vs/platform/agentHost/node/`); CLI `LauncherPaths` (`cli/src/state.rs`):
  lockfiles (`agent-host-<quality>.lock`), logs, download cache; OS keyring for
  credentials.
- **Persisted chat / provider sessions** — `.jsonl` under `~/.claude/projects/…`
  (copilot Claude integration) and `~/.copilot/session-state/…` (Copilot CLI
  integration); Grok sessions are discovered by walking
  `~/.grok/sessions/<encodeURIComponent(cwd)>/<uuid>/summary.json`
  (`node/grok/GROK-DISCOVERY-GATE.md`); the copilot extension also owns its own
  SQLite databases (see `extensions/SC_MODULE.md`).
- **Workbench/session layout state** — per-session visibility/working-set state via
  `LayoutController` (`src/vs/sessions/contrib/layout/`); project-bar folders in
  workspace storage; the welcome key `workbench.agentsession.welcomeComplete`.

**Runtime constraints / cross-surface contracts** (governed; see
`AX-REPO-CROSS-LANGUAGE-CONTRACTS`, `AX-REPO-SERVER-LAUNCH-HANDSHAKE`)
- **`AgentHostMetadata` lockfile schema** — Rust ↔ TS, must migrate in lockstep;
  bump `AGENT_HOST_METADATA_SCHEMA_VERSION` for incompatible changes.
- **Supervisor handshake** — env `VSCODE_AGENT_HOST_SUPERVISOR`, stdout sentinel
  `__VSCODE_AGENT_HOST_READY__`; breaking either silently breaks daemonization.
- **AHP versions** — two distinct constants that must not be conflated: Rust
  wire/metadata `AGENT_HOST_PROTOCOL_VERSION = "0.1.0"` vs TS state-model
  `PROTOCOL_VERSION = '0.4.0'` (`SUPPORTED_PROTOCOL_VERSIONS = ['0.4.0','0.3.0']`).
  TS types are **vendored** into `…/common/state/protocol/` by
  `scripts/sync-agent-host-protocol.ts` (`DO NOT EDIT` banner;
  `AX-REPO-VENDORED-AHP-PROTOCOL`). (Unrelated: `cli/src/constants.rs` tunnel-CLI
  `PROTOCOL_VERSION: u32 = 5`.)
- **Codex protocol types** — `node/codex/protocol/generated/` regenerated only via
  `npm run codex:gen-protocol` (pinned `build/codex/codex-version.txt`), never
  hand-edited.
- **Launcher stdout handshakes & default ports** — server `9888`, web `8080`,
  agent-host / sessions-web `8081`, CLI control `31546`.
- **`terminalTabGrouping` proposed API** — the `.d.ts` and its five wired upstream
  files must change together (an open `SEAM_MANIFEST.md` gap; see `SC_OVERVIEW.md` §1).
- **Multi-provider chat seam** — the eight provider-resolution functions in
  `agentSessions.ts` (1 upstream file, 10 redirected edits) point their `default`
  branches at the fork-owned `agentSessionProviderRegistry`; adding a provider is
  *descriptor + adapter + `package.json`*, never a new upstream `case`
  (`AX-AGENT-CLI-PROVIDER-REGISTRY`, DN-9; `AX-PROD-CODE-OSS-DEV-009`).
- **In-place single-folder re-root** — `reRootSingleFolderWorkspace(folder)` on
  `IWorkbenchConfigurationService` / `WorkspaceService` re-inits at the new folder
  reusing the current `workspace.id` **without a window reload** (3 upstream files
  + 1 test; `AX-STOKDIDE-SWITCH-ROOT-NO-RELOAD`; `AX-PROD-CODE-OSS-DEV-011`).
- **Automation driver `.d.ts`** ↔ `src/vs/workbench/services/driver/common/driver.ts`
  (kept in sync by `test/automation/tools/copy-driver-definition.js`).
- **Lockfile sync** — every `package.json` with a committed `package-lock.json`
  (root, `remote/`, `remote/web/`, `test/` sub-packages) regenerated with any
  dependency edit (`AX-REPO-LOCKFILE-SYNC`).
- **Source layering** — `base → platform → editor → workbench → sessions`;
  `sessions` may import from `workbench`, never the reverse, and
  `platform/agentHost` cannot import from `extensions/copilot` (so shared provider
  constants are duplicated and kept in sync) (`AX-REPO-LAYER-BOUNDARIES`,
  `AX-REPO-AGENTS-WINDOW-DISTINCT-WINDOW`).
- **Server Node** pinned to `24.15.0`; native modules build from source across all
  REH target platforms (`remote/.npmrc`).

---

## Product axioms

These are promoted into `.stokd/meta/SC_AXIOMS.md` by the axiom-enrichment pass.
Where an axiom mirrors an existing repo-wide or feature-local invariant, the
mapping is noted. (`AX-AGENT-CLI-PROVIDER-REGISTRY` and
`AX-STOKDIDE-SWITCH-ROOT-NO-RELOAD` are currently feature-local — declared in
`SEAM_MANIFEST.md` / feature docs and **not yet promoted** to repo-wide
`SC_AXIOMS.md`; the `-009/-010/-011` product axioms below are their promotion path.)

- **AX-PROD-CODE-OSS-DEV-001:** This product is a thin patch on
  `microsoft/vscode`; only fork-owned paths (`src/vs/sessions/**`,
  `src/vs/platform/agentHost/**`, `…/chat/browser/agentSessions/**`,
  `…/terminal/browser/agentTabs/**`, the `terminalView.ts` seam,
  `extensions/copilot/**`, fork tooling in `scripts/`/`test/`) may be edited
  freely, and any edit to inherited upstream code requires a governed task and a
  `SEAM_MANIFEST.md` entry. *(↔ `AX-REPO-THIN-PATCH-FORK`)*
- **AX-PROD-CODE-OSS-DEV-002:** The agent-aware terminal selector is gated by
  `terminal.integrated.agentTabs.enabled` (default `false`) plus a registered
  webview resolver; with the flag off the terminal is byte-identical to upstream.
  *(↔ `AX-TERMINAL-AGENT-TABS`; guarded by `scripts/verify-seam.sh`)*
- **AX-PROD-CODE-OSS-DEV-003:** The Agents Window (`src/vs/sessions/`) is a
  distinct, fixed-layout workbench window (`WindowVisibility.Sessions`) and must
  never be rendered as a panel, view, or editor inside the main workbench window.
  *(↔ `AX-REPO-AGENTS-WINDOW-DISTINCT-WINDOW`)*
- **AX-PROD-CODE-OSS-DEV-004:** The launcher/server stdout handshakes
  (`Web UI available at <addr>`, `READY:<port>`, `__VSCODE_AGENT_HOST_READY__`)
  and the default ports (server `9888`, web `8080`, agent-host/sessions-web
  `8081`, CLI control `31546`) are an observable cross-surface contract changed
  only by a coordinated update on both emitter and consumer. *(↔ `AX-REPO-SERVER-LAUNCH-HANDSHAKE`)*
- **AX-PROD-CODE-OSS-DEV-005:** The cross-language/cross-surface contracts that
  bind the CLI to the Agent Host — the `AgentHostMetadata` lockfile schema (Rust
  ↔ TS), the supervisor env/sentinel handshake, and AHP method names/params/error
  codes — must migrate in lockstep, with incompatible schema changes bumping the
  relevant version and older payloads degrading gracefully. *(↔ `AX-REPO-CROSS-LANGUAGE-CONTRACTS`)*
- **AX-PROD-CODE-OSS-DEV-006:** The AHP protocol types under
  `src/vs/platform/agentHost/common/state/protocol/**` are vendored output of
  `scripts/sync-agent-host-protocol.ts` (carrying a `DO NOT EDIT` banner) and are
  regenerated from the sibling `agent-host-protocol` repo, never hand-edited.
  *(↔ `AX-REPO-VENDORED-AHP-PROTOCOL`)*
- **AX-PROD-CODE-OSS-DEV-007:** The user-facing flows W1–W4, T1, S1–S9, and C1–C7
  are a regression contract — none may regress without a governed task and a
  red→green test exercising the changed behavior. *(↔ `AX-REPO-FORK-TDD-SCOPE`, Axiom 5)*
- **AX-PROD-CODE-OSS-DEV-008:** The product's Stokd Code identity is defined solely
  by `product.json` (`nameLong`, `applicationName`, `dataFolderName = .stokd`,
  `darwinBundleIdentifier`, `urlProtocol`, `tunnelApplicationName`) and its
  marketplace is Open VSX (`extensionsGallery`); branding/marketplace changes are
  made there and must stay consistent with the launchers and CLI constants that
  read them. *(↔ `AX-REPO-PRODUCT-IDENTITY`)*
- **AX-PROD-CODE-OSS-DEV-009:** Every agent-CLI provider (Claude, Copilot CLI,
  Codex, Gemini, Grok, …) is registered as a pure-data descriptor in the fork-owned
  registry (`agentSessionProviderRegistry` + copilot-side `AgentCliProviderRegistry`),
  and the provider-resolution functions in the `agentSessions.ts` seam resolve
  unknown providers from the registry's `default` branch; adding a provider is
  *descriptor + adapter + `package.json`* with **zero** new upstream switch edits.
  *(↔ feature-local `AX-AGENT-CLI-PROVIDER-REGISTRY`, DN-9 — promotion candidate)*
- **AX-PROD-CODE-OSS-DEV-010:** Chat is the default launch surface for every agent
  provider (`getLaunchSurface` → `chat`; setting
  `chat.agentSessions.defaultSurface`, default `'chat'`,
  `DEFAULT_AGENT_LAUNCH_SURFACE = 'chat'`); the flag-gated terminal selector is a
  retained, default-off, **never-removed** opt-in escape hatch reached only when
  the setting is `'terminal'` or the per-launch *Open in Terminal* action is used
  (which always wins). *(↔ feature-local `AX-AGENT-CLI-PROVIDER-REGISTRY` / DN-1 —
  promotion candidate)*
- **AX-PROD-CODE-OSS-DEV-011:** The worktrees panel can re-root a single-folder
  workspace to another folder (`stokd.workspace.switchRootFolder` →
  `reRootSingleFolderWorkspace(folder)`) **without reloading the window** — re-init
  reuses the current `workspace.id` so the extension host, terminals, and running
  agents survive. *(↔ feature-local `AX-STOKDIDE-SWITCH-ROOT-NO-RELOAD` — promotion
  candidate)*

---

*Upgraded (0.5.0 → 0.6.0) from direct analysis of the constituent package manifests
(`package.json`, `cli/Cargo.toml` / `cli/src/constants.rs` /
`cli/src/tunnels/agent_host_metadata.rs`, `remote/package.json`,
`extensions/copilot/package.json`), `product.json`, the `src/vs/sessions/`,
`src/vs/platform/agentHost/` (incl. `DESIGN-DECISIONS.md`, `node/grok/`,
`node/gemini/`), `…/chat/browser/agentSessions/`, and `…/terminal/browser/agentTabs/`
trees, and the existing `.stokd/meta/` documents (`SC_OVERVIEW.md`, `SC_FLOWS.md`,
`SC_VIEWS.md`, and the five `SC_MODULE.md` files, all at 0.6.0). Net change since
0.5.0: promoted the multi-provider LLM CLI chat surface to a first-class (5th) fork
capability, added the five-provider framing (Claude/Copilot/Codex/Gemini/Grok) and
the Grok spawn-per-turn adapter, the chat-as-default / terminal-opt-in surface, the
in-place re-root seam, and three new product axioms (`-009/-010/-011`); refreshed
surfaces, modules, and boundaries; extended the view range to V1–V31. Meta version 0.6.0.*
