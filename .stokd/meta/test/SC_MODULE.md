<!-- stokd-meta-version: 0.4.0 -->
# SC_MODULE.md — `test`

## Module name and location

- **Module:** `test`
- **Package location:** `test/` (monorepo root: `/opt/worktrees/stokd-cloud/stokd-ide/main`)
- **Package type:** `commonjs` (`test/package.json` declares only `{ "type": "commonjs" }`). `test` is not a single build target — it is an umbrella of **eight independently-installed sub-packages**, several with their own `package.json` / `package-lock.json` / `tsconfig.json` (`automation`, `smoke`, `sanity`, `mcp`, `monaco`, `integration/browser`, `componentFixtures/playwright`). The `unit/` and `integration/electron/` runners have no manifest of their own — they run against the repo-root `node_modules` and the compiled `out/` tree.

## Responsibility

`test` is the **test-harness and UI-automation layer** of the code-oss-dev fork. It owns the *runners* (how tests are discovered and executed), the *automation driver* (how a real VS Code instance is driven), and the *scenario suites* (unit, integration, smoke, sanity). It does **not** own the unit tests themselves for product code — those live co-located under `src/**/test/**` and `extensions/**/test/**` and are merely *discovered* by the runners here.

Per `SC_TEST.md`, the fork is a **thin patch on `microsoft/vscode`**, so the testing posture is: *upstream tests are re-verified by the runners unchanged; fork value is concentrated in the automation page-objects and smoke scenarios that exercise the fork's distinguishing surfaces* — the **Agents Window** (`src/vs/sessions/`), **Chat / Sessions**, and the **agent-aware terminal selector**. Concretely, `automation/src/agentsWindow.ts`, `automation/src/chat.ts`, and `smoke/src/areas/agentsWindow/` + `smoke/src/areas/chat/` are the fork-relevant additions inside this module.

The module carries two layers:

1. **Upstream VS Code harness** — the Mocha/Playwright/Electron unit runners (`unit/`), the API integration suites (`integration/`), the UI automation driver (`automation/`), the smoke suite (`smoke/`), the Monaco editor packaging check (`monaco/`), and the MCP automation server (`mcp/`).
2. **stokd fork additions** — page objects and smoke scenarios for the Agents Window and Chat Sessions, plus a fork-specific exclusion in the node runner (`vs/sessions/test/web.test.js`, a web-only E2E that imports CSS and cannot run under Node).

## Public interfaces / entry points

### Test runners (invoked from `scripts/` / root `package.json`)
| Entry point | Invoked by | Discovers / does |
| --- | --- | --- |
| `unit/node/index.js` | `npm run test-node` (`mocha test/unit/node/index.js --delay --ui=tdd`) | Node-layer Mocha runner. `TEST_GLOB = '**/test/**/*.test.js'`; **excludes** `**/{browser,electron-browser,electron-main,electron-utility}/**`, native-module tests, flaky `testing/`, and `vs/sessions/test/web.test.js`. Supports `--run <file>`, `--glob`, `--coverage`, `--build` (run from `out-build`). Enforces a minimum Node major from `remote/.npmrc`. |
| `unit/electron/index.js` (+ `renderer.html`, `renderer.js`, `preload.js`) | `scripts/test.[sh|bat]` | Electron-renderer unit runner — DOM + Node APIs, closest to shipped runtime. `--debug` opens devtools; `--glob`/`--run` narrow the set; `--coverage` writes to `.build/coverage`. |
| `unit/browser/index.js` (+ `renderer.html`) | `npm run test-browser` | Playwright browser unit runner for `common`/`browser` layers across chromium/webkit/firefox. `renderer.html?m=<amd_module>` loads a single module for debugging. |
| `integration/browser/src/index.ts` | `npm run test-web-integration` (via `scripts/`) | Web/browser API integration suite. |
| `integration/electron/testrunner.js` | `npm run test-integration` (via `scripts/`) | Electron API integration test runner (`testrunner.d.ts` is the typed config surface). |
| `smoke/src/main.ts` | `npm run smoketest` (`… && cd test/smoke && npm run compile && node test/index.js`) | Automated UI smoke suite over a built or dev Electron; drives `automation/` page objects. `smoketest-no-compile` skips the build. |
| `sanity/src/index.ts` | `cd test/sanity && npm start` | Release sanity suite (Playwright + Mocha + junit reporter) over desktop / server / web / WSL / CLI builds. |
| `monaco/runner.js` | `cd test/monaco && npm test` | Monaco standalone-editor packaging/ESM check (`esm-check/`, `webpack.config.js`, `bundle-webpack`). |
| `mcp/src/stdio.ts` | `cd test/mcp && npm run start-stdio` | Model Context Protocol stdio server that exposes the automation driver as MCP tools (`mcp/src/automationTools/`) so an agent can drive VS Code. |
| `.vscode-test.js` (repo root) | `npm run test-extension` (`vscode-test`) | Declares per-extension `@vscode/test-cli` configs (workspace folders, mocha timeouts). Not under `test/` but is the entry point for extension integration tests. |

### Automation driver (`test/automation` → published as `vscode-automation`, `main: ./out/index.js`)
The reusable Playwright-backed page-object library imported by `smoke/`, `sanity/`, and `mcp/`. Key page objects: `application.ts`, `code.ts`, `workbench.ts`, `editor(s).ts`, `terminal.ts`, `quickaccess.ts`, `chat.ts`, `agentsWindow.ts` **(fork)**, plus `explorer`, `search`, `scm`, `debug`, `notebook`, `task`, `settings`, `extensions`, `problems`, `statusbar`, `playwrightDriver`/`playwrightElectron`/`playwrightBrowser`. `tools/copy-driver-definition.js` keeps the driver `.d.ts` in sync with `src/vs/workbench/services/driver/common/driver.ts`.

### Fixtures
- `componentFixtures/component-explorer.json` + `component-explorer-diff.json` — `@vscode/component-explorer-cli` config for component screenshot/visual regression (CI screenshots indexed in `blocks-ci-screenshots.md`).
- `componentFixtures/playwright/` — Playwright specs (e.g. `tests/imageCarousel.spec.ts`) for component fixtures.

## Products

- **SC_PRODUCT_CODE_OSS_DEV.md** — code-oss-dev. `test` is one of the five packages of this product (`cli`, `extensions`, `remote`, `scripts`, `test`). It validates the other four: it drives the workbench produced by `src`/`extensions`, the server produced by `remote`, and the CLI produced by `cli` (via `sanity/src/cli.test.ts` / `server.test.ts` / `serverWeb.test.ts`).

## Views

`test` renders no product UI; it **drives and asserts against** the runtime surfaces classified in `SC_VIEWS.md` through the `automation/` page objects and `smoke/` / `sanity/` scenarios:

- **A. Main Workbench Window** (A0–A8) — driven by `automation/src/workbench.ts`, `activityBar`, `viewlet`, `statusbar`, etc.; smoke coverage under `smoke/src/areas/workbench`, `preferences`, `statusbar`.
- **B. Editor Views** — `automation/src/editor(s).ts`, `peek.ts`, `notebook.ts`; smoke under `smoke/src/areas/languages`, `notebook`, `multiroot`.
- **C. Terminal View + Agent Terminal Selector** — `automation/src/terminal.ts`; smoke under `smoke/src/areas/terminal`. The fork seam **C2 (Agent-Aware Terminal Selector)** is guarded primarily by `scripts/verify-seam.sh`, not this module.
- **D. Agents Window** (D0–D8, `src/vs/sessions/`) — **fork-distinguishing coverage:** `automation/src/agentsWindow.ts` (page object using `.agent-sessions-workbench`, `.sessions-chat-widget` selectors; `openCurrentFolderInAgentsWindow`, `switchToAgentsWindow`) and `smoke/src/areas/agentsWindow/agentsWindow.test.ts`.
- **D3. Chat / New Chat Views** — `automation/src/chat.ts`; smoke under `smoke/src/areas/chat/` (`chatSessions.test.ts`, `chatDisabled.test.ts`, `copilotCli.test.ts`).
- **E. CLI Terminal Output** — exercised by `sanity/src/cli.test.ts`, `server.test.ts`, `serverWeb.test.ts`, `wsl.test.ts`.

## Integration points

**Upstream / inputs**
- **Compiled `out/` tree** — `unit/node/index.js` resolves `out` (or `out-build` with `--build`) as the base URL for AMD module loading; runners assume a prior `compile`/`watch`.
- **`remote/.npmrc`** — `unit/node/index.js` parses `target="…"` to enforce the required Node major version; a mismatch is a hard exit.
- **`src/vs/workbench/services/driver/common/driver.ts`** — the automation driver contract; `automation/tools/copy-driver-definition.js` copies it into the published `vscode-automation` types. Driver drift breaks all smoke/sanity/mcp automation.
- **Repo-root `node_modules`** — `mocha`, `glob`, `minimatch`, `minimist`, `semver` for the runners; `playwright`, `@vscode/test-electron`, `@vscode/test-cli`, `@vscode/test-web` for the harnesses.
- **Sub-package `node_modules`** — `automation`, `smoke`, `sanity`, `mcp`, `monaco`, `integration/browser`, `componentFixtures/playwright` each install independently (own `package-lock.json`) and must be `npm ci`'d before their suite runs.

**Downstream / consumers**
- **`smoke/`, `sanity/`, `mcp/`** all import the compiled `automation` package (`../../automation`, `main: ./out/index.js`) — `automation` must be compiled first (their `compile` scripts chain `cd ../automation && npm run compile`).
- **CI** — the smoke/sanity suites and `componentFixtures` screenshot diffs gate releases; `blocks-ci-screenshots.md` is auto-generated and must not be hand-edited.

## Key source files

| File | Why it matters |
| --- | --- |
| `unit/node/index.js` | The node Mocha runner; defines `TEST_GLOB` and the exclude list that determines which tests run in which layer. Editing globs silently changes coverage. |
| `unit/electron/index.js` | The renderer-layer runner — the environment closest to shipped VS Code; primary CI unit gate. |
| `unit/browser/index.js` | Cross-browser (chromium/webkit/firefox) unit runner; catches platform-specific DOM failures. |
| `automation/src/index.ts` | Barrel export of the `vscode-automation` driver consumed by every higher suite. |
| `automation/src/code.ts` / `application.ts` / `workbench.ts` | Core driver lifecycle (launch Electron/web, connect Playwright, top-level page object). |
| `automation/src/agentsWindow.ts` | **(fork)** Page object for the Agents Window — selectors and command flows for `src/vs/sessions/` surfaces (D-series views). |
| `automation/src/chat.ts` | Page object for Chat / Sessions chat surfaces (D3). |
| `automation/tools/copy-driver-definition.js` | Keeps the driver type contract in sync with `src/`; a guard against driver API drift. |
| `smoke/src/main.ts` | Smoke-suite bootstrap (Electron download, logging, options). |
| `smoke/src/areas/agentsWindow/agentsWindow.test.ts` | **(fork)** Smoke scenario for the Agents Window. |
| `smoke/src/areas/chat/*.test.ts` | **(fork-relevant)** Chat Sessions / Copilot CLI / chat-disabled smoke scenarios. |
| `sanity/src/*.test.ts` | Release sanity over desktop/server/web/WSL/CLI builds. |
| `mcp/src/stdio.ts` + `automationTools/` | Exposes the automation driver as MCP tools for agent-driven UI testing. |
| `monaco/runner.js` + `esm-check/` | Validates the standalone Monaco editor packaging / ESM exports. |
| `.vscode-test.js` (repo root) | `@vscode/test-cli` config for extension integration tests (`npm run test-extension`). |

## Change impact

When this module changes, validate the following:

- **Runner glob / exclude edits (`unit/node/index.js`, `unit/electron/index.js`):** can silently include or drop whole test layers. Confirm `npm run test-node` and `scripts/test.sh` discover the expected file count, especially the fork-relevant `src/vs/sessions/**/test/**` and `agentTabs/test/**`. The `vs/sessions/test/web.test.js` exclusion must stay (it imports CSS and cannot run under Node).
- **Automation driver (`automation/src/*`):** a selector or method change ripples to every consumer (`smoke`, `sanity`, `mcp`). Recompile `automation` first, then re-run the smoke suite. Selector drift in `agentsWindow.ts` / `chat.ts` is the most common fork breakage when `src/vs/sessions/` DOM classes change (`.agent-sessions-workbench`, `.sessions-chat-widget`, `.sessions-chat-send-button`).
- **Driver contract (`copy-driver-definition.js`):** must be re-run if `src/vs/workbench/services/driver/common/driver.ts` changes, or the published `vscode-automation` types go stale and smoke tests fail to compile.
- **Sub-package dependency bumps:** each sub-package has its own lockfile; a bump in `automation` requires re-`npm ci` and recompile in `smoke`/`sanity`/`mcp` before their suites pass.
- **Node version floor:** changing `remote/.npmrc` `target` shifts the minimum Node the node runner accepts.
- **Rebase (upstream sync):** per `SC_TEST.md` §7, after a sync re-run `npm run test-node` (sessions + agentTabs) and the smoke Agents Window / Chat scenarios to confirm fork automation survived; recompile `automation` to catch driver-interface drift.
- **`componentFixtures` config / screenshots:** `blocks-ci-screenshots.md` is CI-generated — do not hand-edit; visual-regression baselines change when component DOM changes.
