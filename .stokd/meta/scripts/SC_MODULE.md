<!-- stokd-meta-version: 0.4.0 -->
# SC_MODULE.md — `scripts`

## Module name and location

- **Module:** `scripts`
- **Package location:** `scripts/` (monorepo root: `/opt/worktrees/stokd-cloud/stokd-ide/main`)
- **Package type:** `commonjs` (`scripts/package.json` declares only `{ "type": "commonjs" }` — there is no build, dependency manifest, or test config of its own; the scripts run against the repo-root `node_modules` and the compiled `out/` tree).

## Responsibility

`scripts` is the **developer- and CI-facing tooling layer** of the code-oss-dev fork. It is not shipped product code; it is the set of entry-point shell/batch/JS files a contributor or CI job invokes to **launch, test, benchmark, and maintain** the build. Each capability ships as a cross-platform trio — a `*.sh` (POSIX), a `*.bat` (Windows), and frequently a `*.js` orchestrator that both call — so behavior stays identical across darwin / Linux / WSL / Windows.

The module carries two layers:

1. **Upstream VS Code scripts** — launchers (`code`, `code-cli`, `code-server`, `code-web`, `node-electron`), test runners (`test`, `test-integration`, `test-remote-integration`, `test-web-integration`, `test-documentation`), and maintenance utilities (`code-perf`, `xterm-update`, `generate-definitelytyped`).
2. **stokd fork additions** — the agent-host launcher (`code-agent-host`), the standalone Agents/Sessions web launcher (`code-sessions-web`), the fork-maintenance tooling (`sync-upstream.sh`, `verify-seam.sh`, `sync-agent-host-protocol.ts`), and the chat performance/leak harness (`chat-simulation/`).

The fork-addition layer exists to keep the fork a **thin, replayable patch on upstream** (see `sync-upstream.sh`, `verify-seam.sh`) and to launch/measure the fork-specific surfaces (Agents window, agent host, chat).

## Public interfaces / entry points

### Launchers
| Entry point | Purpose |
| --- | --- |
| `code.sh` / `code.bat` | Build (preLaunch) + launch the Electron dev workbench. Handles WSL (`code-wsl`), WSLg (`--disable-gpu`), and Docker (`--disable-dev-shm-usage`). Sets `NODE_ENV=development`, `VSCODE_DEV=1`, `VSCODE_CLI=1`. Disables `vscode.vscode-api-tests` unless `--extensionTestsPath` is passed. |
| `code-cli.sh` / `code-cli.bat` | Run the CLI entry (`out/cli.js`) under Electron-as-Node with `--inspect=5874`. |
| `code-server.js` (+ `.sh`/`.bat`) | Spawn `out/server-main.js`; fixes `VSCODE_SERVER_PORT=9888`; resolves the address from the `Web UI available at …` stdout line; `--launch` opens a browser. |
| `code-web.js` (+ `.sh`/`.bat`) | Spawn `@vscode/test-web`; default host `localhost`, port `8080`; `--playground` downloads/pins `vscode-web-playground` `0.0.13`. |
| `code-agent-host.js` (+ `.sh`) | **(fork)** Spawn `out/vs/platform/agentHost/node/agentHostServerMain.js`; default port `8081` (or `VSCODE_AGENT_HOST_PORT`); flags `--connection-token[-file]`, `--without-connection-token`, `--enable-mock-agent`, `--quiet`, `--log`. Resolves on the `READY:<port>` stdout line. |
| `code-sessions-web.js` (+ `.sh`) | **(fork)** Minimal `http` server (default port `8081`) that hand-builds the Agents/Sessions workbench HTML, an importmap of `out/**/*.css` shims (`_VSCODE_CSS_LOAD`), and bootstraps `vs/sessions/sessions.web.main.internal.js` (or the `test/sessions.web.test.internal.js` build with `--mock`). Flags: `--host`, `--port`, `--no-open`, `--skip-welcome`, `--mock`. |
| `node-electron.sh` / `.bat` | Run an arbitrary script under `ELECTRON_RUN_AS_NODE=1` with the built Electron. |

### Test runners
| Entry point | Purpose |
| --- | --- |
| `test.sh` / `test.bat` | Electron-based unit tests (`test/unit/electron/index.js`). |
| `test-integration.sh` / `.bat` | Full integration test suite (extensions, smoke flows). |
| `test-remote-integration.sh` / `.bat` | Integration tests against a remote server. |
| `test-web-integration.sh` / `.bat` | Browser/web integration tests. |
| `test-documentation.sh` / `.bat` | Validate API docs. |

### Fork maintenance
| Entry point | Purpose |
| --- | --- |
| `sync-upstream.sh` | Wire/fetch the `upstream` remote, report the latest stable release tag, and print (never execute) the rebase/fast-forward commands. `--ff-main` fast-forwards `main`; `--print-tag` prints the latest `MAJOR.MINOR.PATCH` tag. Governing invariant: `AX-TERMINAL-AGENT-TABS`. |
| `verify-seam.sh` | Build-free binary guard for the terminal agent-tabs seam: asserts the `terminal.integrated.agentTabs.enabled` flag exists with `default: false`, that `terminalView.ts` still `createInstance(TerminalTabbedView)` on the flag-off path, and that it references the `ITerminalTabsView` seam interface. Exits non-zero with a reason on failure. |
| `sync-agent-host-protocol.ts` | Copy type defs from the sibling `../agent-host-protocol` repo into `src/vs/platform/agentHost/common/state/protocol/`, applying tab conversion, duplicate-import merge, `tsfmt.json` formatting, and the MS copyright + `DO NOT EDIT` banner. Writes `.ahp-version` with the source short SHA. Run via `npx tsx scripts/sync-agent-host-protocol.ts`. |

### Performance / maintenance utilities
| Entry point | Purpose |
| --- | --- |
| `code-perf.js` | Run `@vscode/vscode-perf` against a build/runtime. |
| `chat-simulation/test-chat-perf-regression.js` | **(fork)** Chat perf benchmark (`npm run perf:chat`): drives the real copilot extension with `IS_SCENARIO_AUTOMATION=1` against a local mock LLM server; compares to `baselineBuild` from `config.jsonc`. |
| `chat-simulation/test-chat-mem-leaks.js` | **(fork)** State-based chat heap/DOM leak checker (`npm run perf:chat-leak`); residual growth across open→work→reset cycles. |
| `chat-simulation/merge-ci-summary.js` | **(fork)** Merge per-matrix-group perf + leak results into one `ci-summary.md`. |
| `xterm-update.js` / `xterm-update.ps1` / `xterm-symlink.ps1` | Update/symlink the `@xterm/*` addon set. |
| `generate-definitelytyped.sh` | Generate the `vscode.d.ts` DefinitelyTyped header for a given version. |

## Products

- **SC_PRODUCT_CODE_OSS_DEV.md** — code-oss-dev. `scripts` is one of the five packages of this product (`cli`, `extensions`, `remote`, `scripts`, `test`) and provides the operational entry points that launch and validate the other four.

## Views

`scripts` renders no UI itself, but its launchers are the **only supported way to bring up** the runtime surfaces classified in `SC_VIEWS.md`:

- **A. Main Workbench Window** (A0–A8) and **B. Editor Views**, **C. Terminal View + Agent Terminal Selector** — launched via `code.sh`/`code.bat`. The agent-tabs seam behind view **C2 (Agent-Aware Terminal Selector)** is guarded by `verify-seam.sh`.
- **D. Agents Window** (D0–D8, `src/vs/sessions/`) — launched standalone in a browser via `code-sessions-web.js`; `--mock` loads the E2E mock extension, `--skip-welcome` bypasses **D8 (Welcome / Setup Dialog)**.
- **E. CLI Terminal Output** (E1–E8, the Rust `code` binary) — exercised via `code-cli.sh`; the **agent-host** banners (E2) and agent session surfaces are served by `code-agent-host.js`.
- The **D3 Chat / New Chat Views** are the subject under measurement in the `chat-simulation/` perf and leak harnesses.
- Browser/server-hosted workbench (`code-web.js`, `code-server.js`) renders the same A/B view families in a web context.

## Integration points

**Upstream / inputs**
- **Compiled `out/` tree** — every launcher resolves `out/server-main.js`, `out/cli.js`, `out/vs/platform/agentHost/node/agentHostServerMain.js`, or `out/**/*.css`; scripts assume a prior `compile`/`preLaunch` (`node build/lib/preLaunch.ts`, gated by `VSCODE_SKIP_PRELAUNCH`).
- **`product.json`** — `code.sh`/`test.sh`/`node-electron.sh` read `nameLong`/`nameShort`/`applicationName` to locate the built Electron binary.
- **Repo-root `node_modules`** — `minimist`, `open`, `fancy-log`, `ansi-colors`, `tinyglobby`, `@vscode/test-web`, `@vscode/vscode-perf`, `tsx`/`typescript`.
- **Sibling `../agent-host-protocol` repo** — required by `sync-agent-host-protocol.ts`; absence is a hard error with clone instructions.
- **`upstream` git remote (microsoft/vscode)** — `sync-upstream.sh`.

**Downstream / outputs & contracts**
- **Stdout READY contracts** — `code-server.js` parses `Web UI available at (.*)`; `code-agent-host.js` parses `READY:(\d+)`. Changing those server log lines breaks the launchers' address/ready resolution.
- **Env-var contract** — `VSCODE_SERVER_PORT=9888`, `VSCODE_AGENT_HOST_PORT` (default `8081`), `VSCODE_DEV`, `VSCODE_CLI`, `NODE_ENV`, `ELECTRON_RUN_AS_NODE`, `VSCODE_SKIP_PRELAUNCH`, `IS_SCENARIO_AUTOMATION`.
- **Generated artifacts** — `sync-agent-host-protocol.ts` writes into `src/vs/platform/agentHost/common/state/protocol/` + `.ahp-version`; chat-simulation writes `.chat-simulation-data/` results and `ci-summary.md`.
- **Default ports** — server `9888`, web `8080`, agent-host / sessions-web `8081`. Treat as a shared contract with CI and docs.
- **CI** — the chat-simulation harness and `merge-ci-summary.js` are consumed by the perf CI matrix; `verify-seam.sh` is the cheap pre-merge guard for the fork seam.

## Key source files

- `scripts/code.sh` — canonical dev launcher; platform branching (darwin/WSL/WSLg/Docker) and the test-extension disable logic live here.
- `scripts/code-agent-host.js` — **(fork)** agent-host server launcher; arg→server mapping and `READY:` handshake.
- `scripts/code-sessions-web.js` — **(fork)** the only standalone host for the Agents/Sessions workbench; hand-built HTML + CSS-importmap bootstrap of `vs/sessions/`.
- `scripts/sync-upstream.sh` — encodes the thin-patch fork strategy (mirror `main`, replay the patch stack onto a pinned release tag); never rewrites history or pushes.
- `scripts/verify-seam.sh` — executable specification of the terminal agent-tabs seam invariant (`AX-TERMINAL-AGENT-TABS`).
- `scripts/sync-agent-host-protocol.ts` — vendoring pipeline for the agent-host protocol types; the generated files are `DO NOT EDIT`.
- `scripts/chat-simulation/common/utils.js` — shared harness primitives (build resolution, env/args, stats, `welchTTest`, VS Code launch, ext-host inspector); `mock-llm-server.ts` and `perf-scenarios.js` define the workload.
- `scripts/chat-simulation/config.jsonc` — perf/leak thresholds (`baselineBuild`, `runsPerScenario`, per-metric `metricThresholds`, `leakThresholdMB`).

## Change impact

When this module changes, validate the following:

- **Cross-platform parity** — a change to a `*.sh` must be mirrored in its `*.bat` (and the shared `*.js`), or Windows/POSIX behavior diverges silently. This is the most common breakage.
- **Stdout-handshake stability** — editing server log lines (`Web UI available at …`, `READY:<port>`) or the launcher regexes that parse them breaks address/ready resolution in `code-server.js` / `code-agent-host.js` and any CI waiting on them.
- **Path coupling to `out/`** — renaming compiled entry points (`server-main.js`, `cli.js`, `agentHostServerMain.js`, `vs/sessions/sessions.web.main.internal.js`) requires updating the matching launcher; these paths are not discovered, they are hard-coded.
- **Port defaults** — changing `9888` / `8080` / `8081` ripples into docs, CI, and developer muscle memory.
- **Seam guard** — `verify-seam.sh` must keep passing; if the terminal seam (flag id, `default: false`, `TerminalTabbedView` flag-off path, `ITerminalTabsView` interface) moves, update both the guard and `SEAM_MANIFEST.md`.
- **Protocol vendoring** — never hand-edit files under `src/vs/platform/agentHost/common/state/protocol/`; re-run `sync-agent-host-protocol.ts` instead, and only after updating the sibling repo. The transform pipeline (tabs, import merge, tsfmt) is part of the contract.
- **Fork maintenance safety** — `sync-upstream.sh` must remain non-destructive (no push, no history rewrite); `--ff-main` must stay `--ff-only`.
- **Perf baselines** — bumping `baselineBuild`/thresholds in `config.jsonc` changes what the CI matrix flags as a regression; coordinate with the perf job and `merge-ci-summary.js`.
