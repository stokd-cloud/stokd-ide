<!-- stokd-meta-version: 0.5.0 -->
# SC_MODULE.md — `scripts`

> Module classification document. Generated for meta version 0.5.0 (fresh generation).

## Module name & location

- **Module:** `scripts`
- **Package location:** `scripts/` (monorepo root: `/opt/worktrees/stokd-cloud/stokd-ide/main`)
- **Package type:** `commonjs` — `scripts/package.json` declares only `{ "type": "commonjs" }`. There is no build, dependency manifest, or test config of its own; the scripts run against the repo-root `node_modules` and the compiled `out/` tree.
- **Product:** `SC_PRODUCT_CODE_OSS_DEV.md` (code-oss-dev — packages: `cli`, `extensions`, `remote`, `scripts`, `test`, layered on the primary `src/` TypeScript app)

This is the **developer- and CI-facing tooling layer** of the code-oss-dev fork. It ships no product code; it is the set of entry-point shell/batch/JS/TS files a contributor or CI job invokes to **launch, test, benchmark, package, and maintain** the build.

---

## Responsibility

`scripts` is the **only supported way to bring up and validate** every runtime surface of the product. Each capability ships as a cross-platform trio — a `*.sh` (POSIX), a `*.bat` (Windows), and frequently a shared `*.js` orchestrator that both call — so behavior stays identical across darwin / Linux / WSL / Windows (`AX-MOD-SCRIPTS-001`).

The module carries two layers:

1. **Upstream VS Code scripts** — launchers (`code`, `code-cli`, `code-server`, `code-web`, `node-electron`), test runners (`test`, `test-integration`, `test-remote-integration`, `test-web-integration`, `test-documentation`), and maintenance utilities (`code-perf`, `xterm-update`/`xterm-symlink`, `generate-definitelytyped`).
2. **stokd fork additions** — the agent-host launcher (`code-agent-host`), the standalone Agents/Sessions web launcher (`code-sessions-web`), the fork-maintenance tooling (`sync-upstream.sh`, `verify-seam.sh`, `sync-agent-host-protocol.ts`), the macOS package-and-install flow (`package-and-install-macos.sh` + `.test.sh`), and the chat performance/leak harness (`chat-simulation/`).

The fork-addition layer exists to keep the fork a **thin, replayable patch on upstream** (`sync-upstream.sh`, `verify-seam.sh`; governing contract `AX-TERMINAL-AGENT-TABS`, accounted in `SEAM_MANIFEST.md`) and to launch/measure/package the fork-specific surfaces (Agents Window, agent host, chat).

---

## Public interfaces / entry points

### Launchers
| Entry point | Purpose |
| --- | --- |
| `code.sh` / `code.bat` | Build (preLaunch) + launch the Electron dev workbench. Handles WSL (`code-wsl`), WSLg (`--disable-gpu`), and Docker (`--disable-dev-shm-usage`). Sets `NODE_ENV=development`, `VSCODE_DEV=1`, `VSCODE_CLI=1`. Disables `vscode.vscode-api-tests` unless `--extensionTestsPath` is passed. |
| `code-cli.sh` / `code-cli.bat` | Run the CLI entry (`out/cli.js`) under Electron-as-Node with `--inspect=5874`. |
| `code-server.js` (+ `.sh`/`.bat`) | Spawn `out/server-main.js`; fixes `VSCODE_SERVER_PORT=9888`; resolves the address from the `Web UI available at (.*)` stdout line; `--launch` opens a browser via `open`. |
| `code-web.js` (+ `.sh`/`.bat`) | Spawn `@vscode/test-web`; default host `localhost`, port `8080`; `stdio: 'inherit'`; `--playground` downloads/pins `vscode-web-playground`. |
| `code-agent-host.js` (+ `.sh`) | **(fork)** Spawn `out/vs/platform/agentHost/node/agentHostServerMain.js`; default port `8081` (or `VSCODE_AGENT_HOST_PORT`); flags `--port`, `--host`, `--connection-token[-file]`, `--without-connection-token`, `--enable-mock-agent`, `--quiet`, `--log`, `--help`. Resolves on the `READY:(\d+)` stdout line. POSIX-only (no `.bat`). |
| `code-sessions-web.js` (+ `.sh`) | **(fork)** Minimal `http` server (default port `8081`) that hand-builds the Agents/Sessions workbench HTML, an importmap of `out/**/*.css` shims (`_VSCODE_CSS_LOAD`), and bootstraps `vs/sessions/sessions.web.main.internal.js` (or `test/sessions.web.test.internal.js` under `--mock`). Flags: `--host`, `--port`, `--no-open`, `--skip-welcome`, `--mock`. Prints `Sessions Web running at: http://{host}:{port}/`. POSIX-only. |
| `node-electron.sh` / `.bat` | Run an arbitrary script under `ELECTRON_RUN_AS_NODE=1` with the built Electron. |

### Test runners
| Entry point | Purpose |
| --- | --- |
| `test.sh` / `test.bat` | Electron-based unit tests (`test/unit/electron/index.js`). Root `npm test` only prints "run any of the test scripts from the scripts folder". |
| `test-integration.sh` / `.bat` | Full integration test suite (extensions, smoke flows). |
| `test-remote-integration.sh` / `.bat` | Integration tests against a remote server. |
| `test-web-integration.sh` / `.bat` | Browser/web integration tests. |
| `test-documentation.sh` / `.bat` | Validate API docs. |

### Fork maintenance
| Entry point | Purpose |
| --- | --- |
| `sync-upstream.sh` | Wire/fetch the `upstream` remote (`microsoft/vscode`), report the latest stable `MAJOR.MINOR.PATCH` tag, and **print (never execute)** the rebase/replay commands. `--ff-main` fast-forwards `main` via `git merge --ff-only`; `--print-tag` prints the latest tag. Non-destructive (`AX-MOD-SCRIPTS-003`). |
| `verify-seam.sh` | Build-free binary guard for the terminal agent-tabs seam (`AX-TERMINAL-AGENT-TABS`): asserts the `terminal.integrated.agentTabs.enabled` flag exists with `default: false`, that `terminalView.ts` still `createInstance(TerminalTabbedView)` on the flag-off path, and that it references the `ITerminalTabsView` seam interface. Exits non-zero with a reason on failure. POSIX-only. |
| `sync-agent-host-protocol.ts` | Copy type defs from the sibling `../agent-host-protocol` repo into `src/vs/platform/agentHost/common/state/protocol/`, applying tab conversion, duplicate-import merge, `tsfmt.json` formatting, and the MS copyright + `DO NOT EDIT -- auto-generated` banner. Writes `.ahp-version` with the source short SHA. Run via `npx tsx scripts/sync-agent-host-protocol.ts`. Hard-errors with clone instructions if the sibling repo is missing (`AX-MOD-SCRIPTS-004`, `AX-REPO-VENDORED-AHP-PROTOCOL`). |

### Packaging / install
| Entry point | Purpose |
| --- | --- |
| `package-and-install-macos.sh` | **(fork)** macOS package-and-install (`npm run ship`): builds the darwin bundle via the gulp target resolved by `uname -m` (`vscode-darwin-arm64\|x64`, `+-min` under `STOKD_IDE_MINIFY`), verifies `Stokd Code.app`, KILLS the running instance (`osascript quit` + `pkill -x stokd-code`) **before** swapping, atomically replaces `$APPLICATIONS_DIR/Stokd Code.app` (default `/Applications`) via `rm -rf` + `ditto`, normalizes timestamps (`find … -exec touch`), then relaunches via `open`. Env knobs: `STOKD_IDE_DEPLOY_DRY_RUN`, `STOKD_IDE_SKIP_BUILD`, `STOKD_IDE_MINIFY`, `STOKD_IDE_BUNDLE_DIR`, `STOKD_IDE_APPLICATIONS_DIR`, `STOKD_IDE_HEAP_MB`. POSIX-only (`AX-IDE-PACKAGE-INSTALL-MACOS`). |
| `package-and-install-macos.test.sh` | Headless guard for the above: drives it with `STOKD_IDE_DEPLOY_DRY_RUN=1` + stub knobs, PATH-stubs `pkill`/`open`/`osascript` to prove the destructive steps are skipped in dry-run, asserts the install copy, the 1980-epoch timestamp refresh, and the missing-bundle non-zero exit. |

### Performance / maintenance utilities
| Entry point | Purpose |
| --- | --- |
| `code-perf.js` | Run `@vscode/vscode-perf` against a build/runtime. |
| `chat-simulation/test-chat-perf-regression.js` | **(fork)** Chat perf benchmark (`npm run perf:chat`): drives the real copilot extension with `IS_SCENARIO_AUTOMATION=1` against a local mock LLM server; compares to `baselineBuild` from `config.jsonc`. |
| `chat-simulation/test-chat-mem-leaks.js` | **(fork)** State-based chat heap/DOM leak checker (`npm run perf:chat-leak`); residual growth across open→work→reset cycles. |
| `chat-simulation/merge-ci-summary.js` | **(fork)** Merge per-matrix-group perf + leak results into one `ci-summary.md`. |
| `xterm-update.js` / `xterm-update.ps1` / `xterm-symlink.ps1` | Update/symlink the `@xterm/*` addon set. |
| `generate-definitelytyped.sh` | Generate the `index.d.ts` DefinitelyTyped header from `src/vscode-dts/vscode.d.ts` for a given version. |

---

## Products

| Product doc | Relationship |
|---|---|
| `SC_PRODUCT_CODE_OSS_DEV.md` | The only product. `scripts` is one of the five packages (`cli`, `extensions`, `remote`, `scripts`, `test`) and provides the operational entry points that launch and validate the other four plus the primary `src/` app. Per the product doc, it is "the only supported way to launch every runtime surface … run the test suites, and maintain the fork." |

---

## Views

`scripts` renders no GUI, but it **owns the launcher terminal-output surface** and is the only supported way to bring up the GUI/CLI surfaces classified in `SC_VIEWS.md` (V-numbered):

| View | Title | Relationship |
|---|---|---|
| **V28** | Launcher Terminal Output | **Owned by `scripts`.** Human-readable handshake/status lines from the dev/CI launchers — `Web UI available at (.*)` (`code-server.js`, port 9888), `READY:(\d+)` (`code-agent-host.js`, 8081), `Sessions Web running at: …` (`code-sessions-web.js`, 8081), `Starting @vscode/test-web …` (`code-web.js`, 8080), and the macOS install lifecycle lines `package/stop/install/launch/done` (`package-and-install-macos.sh`). A cross-surface contract parsed by tooling/CI (`AX-REPO-SERVER-LAUNCH-HANDSHAKE`). |

Surfaces `scripts` brings up but does not render:
- **V1–V17 Agents Window** (`src/vs/sessions/`) — desktop via `code.sh`/`code.bat`; web standalone via `code-sessions-web.js` (`--mock` loads the E2E mock extension, `--skip-welcome` bypasses **V9** First-Launch Welcome / Setup).
- **V18 Agent Terminal Selector** (terminal seam) — launched via `code.sh`; the seam behind it is guarded by `verify-seam.sh` (`AX-TERMINAL-AGENT-TABS`).
- **V19 Image Carousel / V20 Empty-Editor Watermark** (workbench fork adds) and the inherited workbench (W1–W4) — via `code.sh` / `code-web.js` / `code-server.js`.
- **V21/V22 Copilot dialogs** — the **V5 Session / Chat** chat content is the subject under measurement in the `chat-simulation/` perf and leak harnesses.
- **V23–V27 Rust CLI views** — exercised via `code-cli.sh`; the agent-host banners (V23) are served by `code-agent-host.js`.

---

## Integration points

**Upstream / inputs**
- **Compiled `out/` tree** — every launcher hard-codes a path into `out/`: `out/server-main.js`, `out/cli.js`, `out/vs/platform/agentHost/node/agentHostServerMain.js`, `out/**/*.css` (sessions-web importmap). Scripts assume a prior `compile`/`preLaunch` (`node build/lib/preLaunch.ts`, gated by `VSCODE_SKIP_PRELAUNCH`). These paths are **not discovered** — they are coupled to the build output.
- **`product.json`** — `code.sh`/`test.sh`/`node-electron.sh` read `nameLong`/`nameShort`/`applicationName` to locate the built Electron binary; `package-and-install-macos.sh` hard-codes `Stokd Code` / `stokd-code` from the same source.
- **Repo-root `node_modules`** — `minimist`, `open`, `tinyglobby`, `gulp`, `@vscode/test-web`, `@vscode/vscode-perf`, `tsx`/`typescript`.
- **Sibling `../agent-host-protocol` repo** — required by `sync-agent-host-protocol.ts`; absence is a hard error with clone instructions.
- **`upstream` git remote (microsoft/vscode)** — `sync-upstream.sh`.

**Downstream / outputs & contracts**
- **Stdout READY contracts** — `code-server.js` parses `Web UI available at (.*)`; `code-agent-host.js` parses `READY:(\d+)`. Changing those server log lines breaks the launchers' address/ready resolution (`AX-MOD-SCRIPTS-002`, `AX-REPO-SERVER-LAUNCH-HANDSHAKE`).
- **Env-var contract** — `VSCODE_SERVER_PORT=9888`, `VSCODE_AGENT_HOST_PORT` (default `8081`), `VSCODE_DEV`, `VSCODE_CLI`, `NODE_ENV`, `ELECTRON_RUN_AS_NODE`, `VSCODE_SKIP_PRELAUNCH`, `IS_SCENARIO_AUTOMATION`, and the `STOKD_IDE_*` packaging knobs.
- **Generated artifacts** — `sync-agent-host-protocol.ts` writes into `src/vs/platform/agentHost/common/state/protocol/` + `.ahp-version`; chat-simulation writes results + `ci-summary.md`; `package-and-install-macos.sh` writes `$APPLICATIONS_DIR/Stokd Code.app`.
- **Default ports** — server `9888`, web `8080`, agent-host / sessions-web `8081` (CLI control `31546` lives in `cli`). Treat as a shared contract with CI and docs.
- **CI** — the chat-simulation harness and `merge-ci-summary.js` are consumed by the perf CI matrix; `verify-seam.sh` is the cheap pre-merge guard for the fork seam; `package-and-install-macos.test.sh` is the guard for the packaging flow.

---

## Key source files

| File | Why it matters |
|---|---|
| `scripts/code.sh` | Canonical dev launcher; platform branching (darwin/WSL/WSLg/Docker) and the test-extension disable logic live here. |
| `scripts/code-server.js` | Server launcher; `VSCODE_SERVER_PORT=9888`, `Web UI available at` handshake, `--launch` browser open. |
| `scripts/code-agent-host.js` | **(fork)** agent-host server launcher; arg→server mapping and the `READY:` handshake; renders V28 for the agent host. |
| `scripts/code-sessions-web.js` | **(fork)** the only standalone host for the Agents/Sessions workbench; hand-built HTML + CSS-importmap bootstrap of `vs/sessions/`; `--mock`/`--skip-welcome`. |
| `scripts/sync-upstream.sh` | Encodes the thin-patch fork strategy (mirror `main`, replay the patch stack onto a pinned release tag); never rewrites history or pushes; only mutation is `--ff-only`. |
| `scripts/verify-seam.sh` | Executable specification of the terminal agent-tabs seam invariant (`AX-TERMINAL-AGENT-TABS`). |
| `scripts/sync-agent-host-protocol.ts` | Vendoring pipeline for the agent-host protocol types; generated files are `DO NOT EDIT` (`BANNER` const at line 70). |
| `scripts/package-and-install-macos.sh` | **(fork)** macOS package & install; kill-before-swap ordering, arch-resolved gulp task, `ditto` install, timestamp normalization. |
| `scripts/package-and-install-macos.test.sh` | Headless dry-run guard proving the destructive steps are skipped and the install/guards behave. |
| `scripts/chat-simulation/common/utils.js` | Shared harness primitives (build resolution, `loadConfig`, env/args, stats, `welchTTest`, VS Code launch, ext-host inspector). |
| `scripts/chat-simulation/common/{mock-llm-server.ts,perf-scenarios.js}` | Define the deterministic LLM workload and the chat scenarios under measurement. |
| `scripts/chat-simulation/config.jsonc` | Perf/leak thresholds — `baselineBuild: "1.122.0"`, `runsPerScenario: 5`, per-metric `metricThresholds` (e.g. `timeToFirstToken: "100ms"`), `memLeaks.iterations: 3`, `leakThresholdMB: 10`. |
| `scripts/package.json` | Declares only `{ "type": "commonjs" }`; the module intentionally has no build/deps of its own. |

---

## Change impact

When this module changes, validate the following:

- **Cross-platform parity** — a change to a `*.sh` must be mirrored in its `*.bat` (and the shared `*.js`), or Windows/POSIX behavior diverges silently. This is the most common breakage. POSIX-only scripts (`sync-upstream`, `verify-seam`, `code-agent-host`, `code-sessions-web`, `generate-definitelytyped`, `package-and-install-macos`) are intentionally `.bat`-exempt (`AX-MOD-SCRIPTS-001`).
- **Stdout-handshake stability** — editing server log lines (`Web UI available at …`, `READY:<port>`) or the launcher regexes that parse them breaks address/ready resolution in `code-server.js` / `code-agent-host.js` and any CI waiting on them (`AX-MOD-SCRIPTS-002`).
- **Path coupling to `out/`** — renaming compiled entry points (`server-main.js`, `cli.js`, `agentHostServerMain.js`, `vs/sessions/sessions.web.main.internal.js`) requires updating the matching launcher; these paths are hard-coded, not discovered.
- **Port defaults** — changing `9888` / `8080` / `8081` ripples into docs, CI, and developer muscle memory.
- **Seam guard** — `verify-seam.sh` must keep passing; if the terminal seam (flag id, `default: false`, `TerminalTabbedView` flag-off path, `ITerminalTabsView` interface) moves, update both the guard and `SEAM_MANIFEST.md` (`AX-MOD-SCRIPTS-003`).
- **Protocol vendoring** — never hand-edit files under `src/vs/platform/agentHost/common/state/protocol/`; re-run `sync-agent-host-protocol.ts` (after updating the sibling repo). The transform pipeline (tabs, import merge, tsfmt, banner, `.ahp-version`) is part of the contract (`AX-MOD-SCRIPTS-004`, `AX-REPO-VENDORED-AHP-PROTOCOL`).
- **Fork maintenance safety** — `sync-upstream.sh` must remain non-destructive (no push, no history rewrite); `--ff-main` must stay `--ff-only`.
- **Perf baselines** — bumping `baselineBuild`/thresholds in `config.jsonc` changes what the CI matrix flags as a regression; coordinate with the perf job and `merge-ci-summary.js` (`AX-MOD-SCRIPTS-005`).
- **macOS packaging** — never reorder install-before-kill; run `package-and-install-macos.test.sh` after touching the flow (`AX-IDE-PACKAGE-INSTALL-MACOS`).

---

## Notes

- Per `SC_TEST.md` and `AX-REPO-FORK-TDD-SCOPE`, upstream launchers/test runners are re-verified rather than re-tested; the fork value-add — the agent-host/sessions launchers, the seam/protocol/maintenance tooling, the chat-simulation harness, and the macOS packaging flow — is where new tests belong (e.g. `package-and-install-macos.test.sh`, `verify-seam.sh`).
- Module-local invariants live in `scripts/.axioms.md` (`AX-MOD-SCRIPTS-001..005`, `AX-IDE-PACKAGE-INSTALL-MACOS`) and roll up to repo-wide `AX-REPO-SERVER-LAUNCH-HANDSHAKE`, `AX-REPO-VENDORED-AHP-PROTOCOL`, and `AX-TERMINAL-AGENT-TABS` in `.stokd/meta/SC_AXIOMS.md`. The cross-platform-launcher-parity convention is a standing repo-wide candidate (see the comment block atop `scripts/.axioms.md`).
