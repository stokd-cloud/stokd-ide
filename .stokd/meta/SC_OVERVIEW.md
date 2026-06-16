<!-- stokd-meta: SC_OVERVIEW.md | metaVersion 0.4.0 | generated: FRESH -->
# SC_OVERVIEW — `code-oss-dev` (stokd-ide)

> Comprehensive codebase overview. Fresh generation, meta version 0.4.0.
> Repo: `/opt/worktrees/stokd-cloud/stokd-ide/main` — root npm package
> `code-oss-dev` @ `1.125.0`. Origin `git@github.com:stokd-cloud/stokd-ide.git`;
> upstream `git@github.com:microsoft/vscode.git`.
>
> Companion docs in this directory: `SC_PRODUCT_CODE_OSS_DEV.md` (product),
> `SC_AXIOMS.md` (repo invariants), `SC_FLOWS.md` (user flows), `SC_VIEWS.md`,
> `SC_TEST.md`, `SC_RECOMMENDATIONS.md`, and per-package `SC_MODULE.md` files
> under `cli/`, `extensions/`, `remote/`, `scripts/`, `test/`.

---

## 1. Repository purpose

`code-oss-dev` is a **thin-patch fork of Microsoft VS Code** ("Code – OSS"),
**re-branded as Stokd Code** and maintained by stokd-cloud. It keeps the entire
VS Code editing experience (workbench, editors, terminal, SCM, language services,
~96 built-in extensions) intact and layers on stokd's **agentic developer
experience**, while holding the edited-upstream surface as small as practical so
each rebase onto a new VS Code release stays a routine, low-conflict operation.

**Branding (`product.json`)** — the fork *does* re-brand (this is the one place it
diverges visibly from upstream):

| Field | Value |
|---|---|
| `nameShort` | `Stokd` |
| `nameLong` | `Stokd Code` |
| `applicationName` | `stokd-code` |
| `serverApplicationName` | `stokd-server` |
| `dataFolderName` | `.stokd` (flat home data folder, no `-dev` suffix) |
| `serverDataFolderName` | `.stokd-server` |
| `darwinBundleIdentifier` | `cloud.stokd.code` |
| `win32MutexName` | `stokdcode` |
| `extensionsGallery` | **Open VSX** (`https://open-vsx.org/vscode/gallery`) |

License MIT. The fork tracks the upstream release line (currently `1.125.0`).

### The problem it solves

Developers increasingly run AI coding agents alongside their own work, but stock
VS Code has no first-class place to **host**, **observe**, **triage**, and
**land the output of** many concurrent agent sessions. This fork adds that layer
end-to-end through four fork-distinguishing capabilities:

1. **Agents Window** — `src/vs/sessions/` — a dedicated, fixed-layout,
   sessions-first workbench *window* (distinct from the main editor window) for
   creating agent sessions, streaming chat turns, reviewing/committing agent
   output, and managing many sessions side-by-side. Backends plug in as **session
   providers** (local CLI, cloud, remote agent host).
2. **Agent Host platform service** — `src/vs/platform/agentHost/` — the large
   fork-added platform service that actually runs sessions: AHP client/server
   glue, multiple agent backends (`claude`, `codex`, `copilot`), changeset /
   checkpoint / commit / PR operations, a session database, git state tracking,
   SSH/WSL/tunnel remote hosting, and OTEL telemetry.
3. **Agent-aware terminal selector** —
   `src/vs/workbench/contrib/terminal/browser/agentTabs/` — an experimental,
   flag-gated terminal tab list that shows agent (chat tool-session) terminals
   alongside human terminals, backed by a new `terminalTabGrouping` proposed API.
4. **Copilot Chat extension** — `extensions/copilot/` (package `copilot-chat`
   @ 0.53.0) — the fork-owned, independently-built AI chat/agent extension that
   powers the chat content surfaced by the Agents Window. (Excluded from packaged
   builds via `product.json`.)

### The thin-patch discipline (read before editing upstream)

Only **fork-owned paths** may be edited freely:
- `src/vs/sessions/**`
- `src/vs/platform/agentHost/**` (fork-added platform service)
- `src/vs/workbench/contrib/terminal/browser/agentTabs/**`
- the terminal seam file `…/terminal/browser/terminalView.ts`
- `extensions/copilot/**`
- fork tooling in `scripts/` and `test/`

**Any** edit to inherited upstream code requires a governed task **and** a row in
`SEAM_MANIFEST.md`. Governing contracts: `AX-TERMINAL-AGENT-TABS`,
`AX-REPO-THIN-PATCH-FORK`.

> ⚠️ **Seam drift to reconcile.** `SEAM_MANIFEST.md` still declares
> "Upstream files edited: **1**" (the `terminalView.ts` seam), but the recent
> `terminalTabGrouping` proposed-API commit (`de405a93`) also edited **5** more
> upstream files (see §3). The manifest needs a governed update to re-account for
> these rows; the count is no longer 1. This is a documentation/accounting gap,
> not an architectural one — the additions are append-style proposed-API wiring.

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
- `workbench/` — the IDE shell, parts, and `contrib/` features (terminal lives
  here; the **agentTabs seam** is a leaf contribution under
  `contrib/terminal/browser/agentTabs/`).
- `sessions/` — **fork-added top layer**; the Agents Window. May import from
  `workbench`, **never the reverse** (`AX-REPO-AGENTS-WINDOW-DISTINCT-WINDOW`).
- Also present: `code/` (process orchestration) and `server/` (REH server).

Each layer is further split by runtime environment: `common/` (isomorphic),
`browser/`, `node/`, `electron-browser/`, `electron-main/`, `electron-utility/`,
`worker/`. Imports must respect both the layer and the environment graph.

### Bootstrap / entry-point map (`src/`)

| File | Role |
|---|---|
| `src/main.ts` | Electron main-process entry (desktop app) |
| `src/server-main.ts` | Remote server (REH) entry |
| `src/server-cli.ts` | Server CLI entry |
| `src/cli.ts` | Node-side CLI entry |
| `src/bootstrap-*.ts` | shared bootstrap helpers (`-node`, `-esm`, `-fork`, `-server`, `-cli`, `-import`, `-meta`) |
| `src/vs/sessions/sessions.{common,desktop,web}.main*.ts` | Agents Window composition roots per surface |

---

## 3. The terminal seam (the upstream-edited surface)

The agent-aware terminal selector is the canonical example of the thin-patch
discipline. It now spans **two** kinds of upstream edits:

**(a) The `terminalView.ts` seam (1 file).** —
`src/vs/workbench/contrib/terminal/browser/terminalView.ts`:

1. Three imports added (`ITerminalTabsView`, `AgentTerminalTabbedView`,
   `TerminalAgentTabsSettingId`) from `./agentTabs/…`.
2. The `_terminalTabbedView` field/getter is retyped `TerminalTabbedView →
   ITerminalTabsView` (a structural seam interface the stock view already
   satisfies).
3. `_createTabsView()` branches on the setting
   `terminal.integrated.agentTabs.enabled` (default **`false`**): flag-on →
   `AgentTerminalTabbedView`, flag-off → stock `TerminalTabbedView`.

With the flag off the terminal is **byte-identical to upstream**. Guard:
`scripts/verify-seam.sh` (exits 0 only if the flag defaults off and the flag-off
path uses the stock view; `AX-TERMINAL-AGENT-TABS`).

**(b) The `terminalTabGrouping` proposed API (commit `de405a93`, ~5 files).** —
to let the Copilot extension supply terminal tab groups, a new proposed API was
added and wired through inherited upstream files:

| Upstream file | Change |
|---|---|
| `src/vs/platform/extensions/common/extensionsApiProposals.ts` | register the `terminalTabGrouping` proposal |
| `src/vs/workbench/api/common/extHost.api.impl.ts` | expose the proposed API to extensions |
| `src/vs/workbench/api/common/extHost.protocol.ts` | add the protocol methods |
| `src/vs/workbench/api/common/extHostTerminalService.ts` | extension-host implementation |
| `src/vs/workbench/api/browser/mainThreadTerminalService.ts` | main-thread side |

Plus the fork-owned `src/vscode-dts/vscode.proposed.terminalTabGrouping.d.ts`
and the new fork file
`…/terminal/browser/agentTabs/terminalTabGroupingProviderService.ts`. The rest of
the selector lives in zero-conflict files under `agentTabs/`
(`ITerminalTabsView.ts`, `agentTerminalSelectorRows.ts` (pure logic),
`agentTerminalSelectorModel.ts`, `agentTerminalTabbedView.ts`,
`agentTerminalHostController.ts`, `agentTabsContribution.ts`, plus `test/`).

> These five additions are the seam-drift flagged in §1: `SEAM_MANIFEST.md` must
> be updated to account for them. See `docs/REBASE_RUNBOOK.md` for the rebase
> methodology — proposed-API additions are append-style and low-conflict, but
> they are still inherited-upstream edits and must be tracked.

---

## 4. Package / module dependency graph

The repo is a multi-language monorepo. The root `package.json` (`code-oss-dev`)
is the TypeScript core; five constituent packages (per `.stokd/meta/config.json`)
layer onto it.

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
   │ (Rust   │   │ (~96 +     │  │ (REH/web │   │ (launch, │   │ (harness│
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
| **`cli/`** | Cargo `code-cli` @ 0.1.0, binary `code` | Native Rust launcher: opens desktop editor; runs `tunnel`/`serve-web`/`command-shell`; **fork-local** `agent host\|ps\|stop\|kill\|logs`; supervises the Agent Host over AHP (`ahp`/`ahp-types` crates @ 0.3). | `cli/SC_MODULE.md` |
| **`extensions/`** | ~96 built-in + `copilot` | Built-in VS Code extensions (languages, grammars, themes, git/github, terminal-suggest…). Mostly inherited/read-only; the **only fork-owned** one is `copilot` (`copilot-chat` @ 0.53.0), built/tested independently and excluded from packaged builds. | `extensions/SC_MODULE.md` |
| **`remote/`** | npm `vscode-reh` @ 0.0.0 | Build-input dependency manifests only (no app source): the runtime closure for **server (REH)** and **web (`vscode-web`)**; pins server Node `24.15.0`, `build_from_source=true` (`remote/.npmrc`). | `remote/SC_MODULE.md` |
| **`scripts/`** | shell + js | The **only supported way to launch** each surface and run the suites; fork-maintenance tooling (`sync-upstream.sh`, `verify-seam.sh`, `sync-agent-host-protocol.ts`, chat-perf/leak). | `scripts/SC_MODULE.md` |
| **`test/`** | npm `vscode-automation` etc. | Test harness, Playwright UI driver, smoke/sanity suites, MCP automation server (`test/mcp/src/stdio.ts`). Fork value in `automation/src/{agentsWindow,chat}.ts`. | `test/SC_MODULE.md` |

### The Agent Host service (`src/vs/platform/agentHost/`)

The largest fork addition outside `sessions/`. It is **not** a thin AHP shim — it
is a full session runtime, split across `common/` (isomorphic), `browser/`,
`node/`, `electron-browser/`, `electron-main/`, and `test/`. Notable areas:

- **Backends** — `node/{claude,codex,copilot}/`, `agentSdkDownloader.ts`,
  `agentPluginManager.ts`, `agentService.ts`.
- **Session state** — `node/sessionDatabase.ts`, `sessionDataService.ts`,
  `agentHostStateManager.ts`, `agentHostLockfile.ts`,
  `common/remoteAgentHostMetadata.ts` (`remoteAgentHostStateSchemaVersion = 1`).
- **Change landing** — `agentHostChangeset*`, `agentHostCheckpointService.ts`,
  `agentHostCommitOperation*`, `agentHostPullRequestOperation*`,
  `agentHostGitService.ts`, `diffComputeService.ts`.
- **Remote hosting** — `sshRemoteAgentHostService.ts`,
  `wslRemoteAgentHostService.ts`, `tunnelAgentHostService.ts`,
  `webSocketTransport.ts`, `relayTransport.ts`.
- **Protocol** — `common/state/protocol/` (vendored AHP types, `DO NOT EDIT`,
  `AX-REPO-VENDORED-AHP-PROTOCOL`); `protocolServerHandler.ts`.
- **Telemetry** — `otel/`, `otlp/`, `agentHostTelemetry*` (see `OTEL.md`).

### Cross-language / cross-surface contracts (must migrate in lockstep)

Governed by `AX-REPO-CROSS-LANGUAGE-CONTRACTS`:

- **`AgentHostMetadata` lockfile schema** — Rust
  `cli/src/tunnels/agent_host_metadata.rs`
  (`AGENT_HOST_METADATA_SCHEMA_VERSION: u32 = 1`, field `schema_version`) ↔ TS
  `src/vs/platform/agentHost/common/remoteAgentHostMetadata.ts`
  (`remoteAgentHostStateSchemaVersion = 1`, field `schemaVersion`).
- **Supervisor handshake** env/sentinels: `VSCODE_AGENT_HOST_SUPERVISOR`,
  `__VSCODE_AGENT_HOST_READY__`.
- **AHP** (Agent Host Protocol) method names/params/error codes — protocol
  version `AGENT_HOST_PROTOCOL_VERSION = "0.1.0"` (Rust crates `ahp`/`ahp-types`
  @ 0.3); TS types **vendored** into
  `src/vs/platform/agentHost/common/state/protocol/` by
  `scripts/sync-agent-host-protocol.ts`.
- **Launcher stdout handshakes / ports** (`AX-REPO-SERVER-LAUNCH-HANDSHAKE`):
  server `Web UI available at <addr>` → port `9888`; agent host `READY:<port>`.
  Default ports: server `9888`, web `8080`, agent-host/sessions-web `8081`,
  CLI control / dev-tunnels `31546`.
- **`terminalTabGrouping` proposed API** — `.d.ts` ↔ the five wired upstream
  files in §3(b); changing the shape requires editing every binding together.
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
  `rmp-serde`, `keyring`, `hyper`, dev-tunnels, `ahp`/`ahp-types`).
- **Node.js 24.15.0** — pinned for the remote server (`remote/.npmrc`).
- **Electron 42.2.0** — desktop runtime.

### Core patterns (inherited from VS Code, preserved by the fork)
- **Dependency injection** via service interfaces + `registerSingleton`
  (decorator-based services in `platform/`); service deps declared in
  constructors only.
- **Layered + environment-split modules** (`common`/`browser`/`node`/
  `electron-*`) enforced by `valid-layers-check`.
- **Contribution model** — workbench features self-register; extensions
  contribute via `package.json` `contributes`/`activationEvents`.
- **Event-driven** (`Emitter`/`Event`), disposables (`DisposableStore`, etc.),
  async barriers.

### Fork-specific patterns
- **Session providers** — pluggable agent backends behind the Agents Window
  (local CLI, cloud, remote agent host; backed by `agentHost/node/{claude,codex,
  copilot}`).
- **Seam interface** — `ITerminalTabsView` lets the pane hold *either* terminal
  view without rewriting the stock view; a structural compile-time assertion keeps
  the off-path identical to upstream.
- **Vendored generated code** — AHP protocol types regenerated from a sibling
  repo, never hand-edited (banner-guarded).
- **Flag-gated experiments** — fork behavior defaults off
  (`terminal.integrated.agentTabs.enabled = false`) so the off-path is
  byte-identical to upstream.
- **Append-style upstream extension** — when a fork capability genuinely needs an
  upstream hook (the `terminalTabGrouping` proposed API), it is added through
  VS Code's own proposed-API mechanism and accounted for in `SEAM_MANIFEST.md`.

### Key external integrations
- **AI SDKs**: `@anthropic-ai/sdk`, `@anthropic-ai/claude-agent-sdk`,
  `@openai/codex`, `@github/copilot`, `@github/copilot-sdk`,
  `@vscode/copilot-api`, `@microsoft/mxc-sdk` (root + `remote/`).
- **Microsoft dev-tunnels** — relay for `code tunnel` and remote agent-host
  exposure.
- **xterm.js** (`@xterm/*` beta) — the integrated terminal.
- **Open VSX** — the extension marketplace (`open-vsx.org`), replacing the
  Microsoft gallery.
- **Telemetry** — Microsoft 1DS (`@microsoft/1ds-*`); OTEL/OTLP in
  `platform/agentHost`.
- **Auth** — GitHub / Microsoft device flow + OS keyring (CLI `auth.rs`);
  `*-authentication` built-in extensions feed `git`/`github`/`copilot`.

---

## 6. Development workflow & build system

### Build orchestration
- **Gulp** (`gulpfile.mjs` → `build/gulpfile*.mjs`) is the primary build system,
  driven through `npm run gulp <target>` (Node with `--experimental-strip-types`,
  8 GB heap).
- **TypeScript native preview** (`tsgo`) powers the fast type-checks
  (`compile-check-ts-native`, `valid-layers-check`, dts checks).
- **Rust/Cargo** builds the CLI (`npm run gulp compile-cli` or `cargo` directly
  in `cli/`).
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

> Per `.claude/CLAUDE.md`: never use `npm run compile` to *check* for TS errors —
> watch the build task output or run `npm run compile-check-ts-native` (src) /
> `npm run gulp compile-extensions` (extensions). Never run tests with
> compilation errors outstanding.

### Testing (`SC_TEST.md`; `AX-REPO-FORK-TDD-SCOPE`)
- **Unit (node)**: `npm run test-node` (mocha, tdd UI).
- **Unit (browser)**: `npm run test-browser`.
- **Extension**: `npm run test-extension` (vscode-test).
- **CLI**: `cd cli && cargo test` (e.g. `cargo test agent_host` round-trips the
  lockfile schema).
- **Smoke / automation**: `npm run smoketest`; Playwright driver in
  `test/automation/`; agentic-surface coverage in
  `automation/src/{agentsWindow,chat}.ts` and
  `smoke/src/areas/{agentsWindow,chat}/`.

**TDD is mandatory** (Axiom 5 / `AX-REPO-FORK-TDD-SCOPE`): every fork behavioral
change adds a test observed to fail (red) before implementation and pass (green)
after. Inherited upstream code is **re-verified by existing runners, not
re-tested** with new fork tests.

### Fork maintenance / rebase
- `scripts/sync-upstream.sh` wires the `upstream` remote and reports the next
  rebase target; `.github/workflows/upstream-sync.yml` (on `main`) rebases the
  patch stack onto upstream tags and runs fast checks.
- On every rebase, re-apply and re-verify every `SEAM_MANIFEST.md` row. The
  realistic conflict points are the `terminalView.ts` seam commit and the
  `terminalTabGrouping` proposed-API wiring (§3) — both must be re-accounted.

---

## 7. Critical paths

### Headline end-to-end agentic loop (spans surfaces; from `SC_FLOWS.md`)
```
C2    start a backend        code agent host            (cli/ → platform/agentHost)
S3/S4 create & send session  Agents Window              (src/vs/sessions/)
S5    continue turns         multi-chat                 (sessions + copilot)
S8    review & land changes  diff / commit / PR / merge (sessions + agentHost changeset)
S9    drop into full editor  → W1 Open Folder & Edit    (workbench)
        observe out-of-band: C3 agent ps · C4 agent logs · T1 agent terminal selector
```

### Agent Host supervision path
`cli/src/commands/` (`agent host`) → downloads & spawns the agent-host child →
supervisor handshake (`VSCODE_AGENT_HOST_SUPERVISOR` /
`__VSCODE_AGENT_HOST_READY__`) → AHP over the wire → TS side
`out/vs/platform/agentHost/node/agentHostServerMain.js` (`READY:<port>`); session
state under `cli/src/state.rs` `LauncherPaths` (lockfiles
`agent-host-<quality>.lock`, logs, download cache; keyring credentials) and the TS
`sessionDatabase.ts`. Backends dispatch through
`agentHost/node/{claude,codex,copilot}`; remote hosting via
`{ssh,wsl,tunnel}RemoteAgentHostService.ts`.

### Inherited workbench paths
W1 Open Folder & Edit, W2 Review a Diff, W3 Run a Task / Integrated Terminal,
W4 Open a Webview / Custom Editor — unchanged upstream flows; T1 (agent terminal
selector) reduces to W3 when the flag is off.

---

## 8. Where to look (quick index)

| You want… | Go to |
|---|---|
| The Agents Window | `src/vs/sessions/` (+ its `README.md`, `LAYOUT.md`, `SESSIONS.md`) |
| Agent Host service / AHP / metadata / changesets | `src/vs/platform/agentHost/` (`OTEL.md` for telemetry) |
| Terminal seam + tab grouping | `…/terminal/browser/terminalView.ts` + `…/agentTabs/`; `vscode.proposed.terminalTabGrouping.d.ts`; `SEAM_MANIFEST.md` |
| The Rust CLI | `cli/src/` (`commands/`, `tunnels/`, `auth.rs`, `state.rs`) |
| Copilot Chat | `extensions/copilot/` (package `copilot-chat`) |
| How to launch anything | `scripts/code*.{sh,js,bat}` |
| Branding / marketplace | `product.json` (Stokd; Open VSX) |
| Build logic | `build/`, `gulpfile.mjs`, root `package.json` scripts |
| Repo invariants | `.stokd/meta/SC_AXIOMS.md` + per-package `.axioms.md` |
| Product framing | `.stokd/meta/SC_PRODUCT_CODE_OSS_DEV.md` |
| User flows | `.stokd/meta/SC_FLOWS.md` |
| Test strategy | `.stokd/meta/SC_TEST.md` |

---

*Generated fresh from direct analysis of `package.json`, `product.json`,
`cli/Cargo.toml`, `remote/package.json`, `remote/.npmrc`,
`extensions/copilot/package.json`, `SEAM_MANIFEST.md`, the `src/vs/sessions/`,
`src/vs/platform/agentHost/`, and `cli/src/` trees, the `de405a93`
`terminalTabGrouping` commit, and the existing `.stokd/meta/` documents.
Meta version 0.4.0.*
