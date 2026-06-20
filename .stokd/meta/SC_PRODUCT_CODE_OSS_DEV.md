<!-- stokd-meta: SC_PRODUCT_CODE_OSS_DEV.md | metaVersion 0.5.0 | generated: FRESH -->
# SC_PRODUCT — `code-oss-dev` (Stokd Code)

> Product classification document. Fresh generation, meta version 0.5.0.
> Repo: `/opt/worktrees/stokd-cloud/stokd-ide/main` — root npm package
> `code-oss-dev` @ `1.125.0`. Origin `github.com/stokd-cloud/stokd-ide`;
> upstream `github.com/microsoft/vscode`.
>
> Companion docs in this directory: `SC_OVERVIEW.md` (codebase overview),
> `SC_AXIOMS.md` (repo invariants), `SC_FLOWS.md` (user flows, W1–W4 / T1 /
> S1–S9 / C1–C7), `SC_VIEWS.md` (views V1–V28), `SC_TEST.md`,
> `SC_RECOMMENDATIONS.md`, and the per-package `SC_MODULE.md` files under
> `cli/`, `extensions/`, `remote/`, `scripts/`, `test/`.

---

## Product name & constituent packages

- **Product name:** `code-oss-dev` — branded **Stokd Code** (`product.json`:
  `nameLong = "Stokd Code"`, `nameShort = "Stokd"`, `applicationName = "stokd-code"`).
- **This is a single product**, not a family. The desktop app, the web workbench,
  the remote server (REH), the Agents Window, the Rust `code` CLI, and the Copilot
  Chat extension are **different surfaces of one offering** — the same `src/`
  TypeScript core built and launched in different runtimes. They share users,
  goals, data stores, and the agentic-loop flow, so they are documented here as
  one product rather than split into separate product docs.
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
sessions. This fork adds that layer end-to-end through four fork-distinguishing
capabilities:

1. **Agents Window** — `src/vs/sessions/` — a dedicated, fixed-layout,
   sessions-first workbench **window** (distinct from the main editor window;
   `WindowVisibility.Sessions`) for creating agent sessions, streaming chat turns,
   reviewing/committing/landing agent output, and managing many sessions
   side-by-side. Backends plug in as **session providers** (local chat, copilot
   chat, agent host, remote agent host).
2. **Agent Host platform service** — `src/vs/platform/agentHost/` — the large
   fork-added platform service that actually runs sessions: AHP client/server
   glue, multiple agent backends (`claude`, `codex`, `copilot`), changeset /
   checkpoint / commit / PR operations, a session database, git state tracking,
   SSH/WSL/tunnel remote hosting, and OTEL telemetry.
3. **Agent-aware terminal selector** —
   `src/vs/workbench/contrib/terminal/browser/agentTabs/` — an experimental,
   flag-gated terminal tabs strip that hosts the code-ext Sessions webview and
   surfaces agent terminals alongside human terminals, backed by a new
   `terminalTabGrouping` proposed API.
4. **Copilot Chat extension** — `extensions/copilot/` (`copilot-chat` @ 0.53.0) —
   the fork-owned, independently-built AI chat/agent extension that powers the chat
   content surfaced by the Agents Window.

The headline end-to-end loop spans every surface: start a backend
(`code agent host`) → create & send a session (Agents Window) → continue turns →
review & land changes (commit / PR / merge) → optionally drop into the full
editor; observe out-of-band via the CLI (`agent ps` / `agent logs`) or the agent
terminal selector.

**Branding (`product.json`):** re-branded to Stokd Code (`dataFolderName = .stokd`,
`darwinBundleIdentifier = cloud.stokd.code`, `urlProtocol = stokd-code`,
`tunnelApplicationName = stokd-tunnel`) and the marketplace switched from the
Microsoft gallery to **Open VSX** (`https://open-vsx.org/vscode/gallery`)
(`AX-PROD-CODE-OSS-DEV-008`). License MIT; tracks upstream release line `1.125.0`.

---

## Target audience

- **Primary: developers running AI coding agents** who want to host, observe,
  triage, and land the output of many concurrent agent sessions inside their
  editor — the Agents Window persona (flows S1–S9).
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
- **Terminal seam** (flag-gated): `terminal.integrated.agentTabs.enabled`
  (default `false`) **and** a registered webview resolver for
  `terminal.integrated.agentTabs.viewId` route the panel through
  `terminalView.ts` `_createTabsView()` to `AgentTerminalTabbedView`.
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

Every flow in `SC_FLOWS.md` belongs to this single product. Four families:

**W. Workbench (inherited upstream)** — re-verified, not re-documented:
- **W1** Open a Folder/Workspace & Edit a File · **W2** Review a Diff (SCM/compare)
  · **W3** Run a Task / Use the Integrated Terminal · **W4** Open a Webview / Custom
  Editor.

**T. Terminal seam (fork, flag-gated):**
- **T1** Select an Agent Terminal Alongside Human Terminals.

**S. Agents Window (fork, `src/vs/sessions/`):**
- **S1** First-Launch Setup / Welcome · **S2** Sign In / Manage Account · **S3**
  Create a New Session & Send First Message · **S4** Send a New Session in the
  Background · **S5** Continue Session / Multi-Chat · **S6** Browse / Filter /
  Triage Sessions · **S7** Work With Multiple Sessions Side-by-Side · **S8** Review
  & Apply Changes / Commit / PR / Merge · **S9** Open Session in VS Code / Run
  Script / Open Terminal.

**C. CLI (fork-flavored, Rust `code` binary):**
- **C1** Authenticate / Log In · **C2** Start an Agent Host / Tunnel / Serve Web ·
  **C3** List Active Sessions (`agent ps`) · **C4** Stream Agent Logs
  (`agent logs`) · **C5** Stop / Kill the Agent Host · **C6** Manage Tunnels ·
  **C7** Update / Check Version.

**Headline end-to-end agentic loop (spans surfaces):** C2 → S3/S4 → S5 → S8 → S9
(→ W1), observed out-of-band via C3/C4 or T1. The user-facing flows W1–W4, T1,
S1–S9, C1–C7 are a **regression contract** — they must not regress without a
governed task + red→green test (`AX-PROD-CODE-OSS-DEV-007`).

---

## Modules — how each package contributes

The primary `src/` app (not a separate package) hosts the Agents Window
(`src/vs/sessions/`), the Agent Host platform service
(`src/vs/platform/agentHost/`), the terminal seam
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
(`cli/src/tunnels/agent_host_metadata.rs`) ↔ TS
`src/vs/platform/agentHost/common/remoteAgentHostMetadata.ts`.

### `extensions` — `extensions/SC_MODULE.md`
Home of VS Code's built-in extensions. The overwhelming majority are **inherited
upstream and read-only** under thin-patch discipline (languages, grammars, themes,
`git`/`github`, `terminal-suggest`, …). The single **fork-owned** extension is
**`copilot`** (`copilot-chat`) — the first-party AI chat/agent extension built &
tested independently (esbuild + Vitest, excluded from packaged builds). It powers
the Agents Window chat **content** (the window supplies the surface) and owns the
Copilot dialog views **V21** (slash-command wizards) and **V22** (permission /
question carousel) for flows S3–S5. `git`/`github` feed the Agents Window Changes
view via API proposals (`scmHistoryProvider`, `agentSessionsWorkspace`, …).

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
harness. Owns view **V28** (launcher terminal output) and the stdout-handshake /
default-port contracts (flow C2).

### `test` — `test/SC_MODULE.md`
The test-harness and UI-automation layer: Mocha/Playwright/Electron unit runners,
the `vscode-automation` Playwright driver, smoke/sanity suites, the Monaco
packaging check, and the MCP automation server (`test/mcp/src/stdio.ts`). Drives
and asserts against every surface (V1–V28). Fork value-add: `automation/src/{agentsWindow,chat}.ts`,
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
  adapters.
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
  by the copilot session adapters and the test MCP automation server.

**Data stores & state**
- **Agent-host session state** — the TS `sessionDatabase.ts`
  (`src/vs/platform/agentHost/node/`); CLI `LauncherPaths` (`cli/src/state.rs`):
  lockfiles (`agent-host-<quality>.lock`), logs, download cache; OS keyring for
  credentials.
- **Persisted chat sessions** — `.jsonl` under `~/.claude/projects/…` (copilot
  Claude integration) and `~/.copilot/session-state/…` (Copilot CLI integration).
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
  `PROTOCOL_VERSION = '0.4.0'`. TS types are **vendored** into
  `…/common/state/protocol/` by `scripts/sync-agent-host-protocol.ts`
  (`DO NOT EDIT` banner; `AX-REPO-VENDORED-AHP-PROTOCOL`).
- **Launcher stdout handshakes & default ports** — server `9888`, web `8080`,
  agent-host / sessions-web `8081`, CLI control `31546`.
- **`terminalTabGrouping` proposed API** — the `.d.ts` and its five wired upstream
  files must change together.
- **Automation driver `.d.ts`** ↔ `src/vs/workbench/services/driver/common/driver.ts`
  (kept in sync by `test/automation/tools/copy-driver-definition.js`).
- **Lockfile sync** — every `package.json` with a committed `package-lock.json`
  (root, `remote/`, `remote/web/`, `test/` sub-packages) regenerated with any
  dependency edit (`AX-REPO-LOCKFILE-SYNC`).
- **Source layering** — `base → platform → editor → workbench → sessions`;
  `sessions` may import from `workbench`, never the reverse
  (`AX-REPO-LAYER-BOUNDARIES`, `AX-REPO-AGENTS-WINDOW-DISTINCT-WINDOW`).
- **Server Node** pinned to `24.15.0`; native modules build from source across all
  REH target platforms (`remote/.npmrc`).

---

## Product axioms

These are promoted into `.stokd/meta/SC_AXIOMS.md` by the axiom-enrichment pass.
Where an axiom mirrors an existing repo-wide invariant, the mapping is noted.

- **AX-PROD-CODE-OSS-DEV-001:** This product is a thin patch on
  `microsoft/vscode`; only fork-owned paths (`src/vs/sessions/**`,
  `src/vs/platform/agentHost/**`, `…/terminal/browser/agentTabs/**`, the
  `terminalView.ts` seam, `extensions/copilot/**`, fork tooling in
  `scripts/`/`test/`) may be edited freely, and any edit to inherited upstream
  code requires a governed task and a `SEAM_MANIFEST.md` entry. *(↔ `AX-REPO-THIN-PATCH-FORK`)*
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
  read them.

---

*Generated fresh from direct analysis of the constituent package manifests
(`package.json`, `cli/Cargo.toml`, `remote/package.json`,
`extensions/copilot/package.json`), `product.json`, the `src/vs/sessions/`,
`src/vs/platform/agentHost/`, and `…/terminal/browser/agentTabs/` trees, and the
existing `.stokd/meta/` documents (`SC_OVERVIEW.md`, `SC_FLOWS.md`, `SC_VIEWS.md`,
and the five `SC_MODULE.md` files). Meta version 0.5.0.*
