<!-- stokd-meta: SC_MODULE.md | package: test | metaVersion 0.6.0 | generated: UPGRADE (from 0.5.0) -->
# SC_MODULE.md — `test`

> Module classification document. Upgraded 0.5.0 → 0.6.0 (content preserved and
> re-verified against the tree; header normalized to the 0.6.0 form used by the
> sibling modules; the multi-provider LLM CLI / Grok / P4 work — PRs #4/#5,
> `d88c67b` — folded into **Responsibility**, **Views**, and **Change impact**;
> the previously-undocumented `mcp/automationTools/chat.ts` added). The 0.6.0
> re-verification pass (this run) re-confirmed every structural claim below
> against the working tree — sub-package manifests/lockfiles, the `unit/node`
> `TEST_GLOB`/`excludeGlobs` contract, the `automation`/`mcp` page-object sets,
> the `smoke`/`sanity` scenario files, and the `copy-driver-definition` dual
> `driver.d.ts` write — and added the node/electron **runner-support files**
> (`unit/{reporter,fullJsonStreamReporter,coverage,analyzeSnapshot,assert}.js`)
> and the `cgmanifest.json` vendored-dependency registration, which were
> previously undocumented.

## Module name and location

- **Module:** `test`
- **Package location:** `test/` (monorepo root: `/opt/worktrees/stokd-cloud/stokd-ide/main`)
- **Package type:** the root `test/package.json` declares only `{ "type": "commonjs" }`. `test` is **not a single build target** — it is an umbrella over a set of **independently-installed sub-packages**. Eight directories carry their own `package.json` (`automation`, `smoke`, `sanity`, `mcp`, `monaco`, `integration/browser`, `componentFixtures/playwright`, and `unit/node`); **seven of those ship a committed `package-lock.json`** and must be `npm ci`'d before their suite runs (`automation`, `smoke`, `sanity`, `mcp`, `monaco`, `integration/browser`, `componentFixtures/playwright`). `unit/node/package.json` is only `{ "type": "module" }` (it marks the runner as ESM; it has **no lockfile** and installs nothing of its own). `sanity` and `componentFixtures/playwright` are `type: module`; `automation`, `smoke`, `mcp`, `monaco`, and `integration/browser` declare no `type` (CommonJS). `unit/electron`, `unit/browser`, and `integration/electron` have **no manifest at all** — they run against the repo-root `node_modules` and the compiled `out/` tree.
- **Mocha defaults:** `test/.mocharc.json` → `{ ui: "tdd", timeout: 10000 }`.

## Responsibility

`test` is the **test-harness and UI-automation layer** of the `code-oss-dev` fork. It owns the *runners* (how tests are discovered and executed), the *automation driver* (how a real VS Code instance is driven via Playwright), and the *scenario suites* (unit, integration, smoke, sanity, MCP, Monaco packaging, component fixtures). It does **not** own the unit tests for product code — those live co-located under `src/**/test/**` and `extensions/**/test/**` and are merely *discovered* by the runners here.

Per `SC_TEST.md` (§0), the fork is a **thin patch on `microsoft/vscode`** (`code-oss-dev` @ `1.125.0`), so the testing posture is: *upstream tests are re-verified by the runners unchanged; fork value is concentrated in the automation page-objects and smoke scenarios that exercise the fork's distinguishing surfaces* — the **Agents Window** (`src/vs/sessions/`), **Chat / Sessions**, the **agent-aware terminal selector**, the **multi-provider agent-CLI surface** (Claude / Copilot / Codex / Gemini / Grok), and the fork-added editor surfaces (Image Carousel, watermark). Concretely, `automation/src/agentsWindow.ts`, `automation/src/chat.ts`, `smoke/src/areas/agentsWindow/`, `smoke/src/areas/chat/` (incl. `copilotCli.test.ts`), and `componentFixtures/playwright/tests/imageCarousel.spec.ts` are the fork-relevant additions inside this module.

> **0.6.0 note — multi-provider LLM CLI / Grok / P4.** PRs #4/#5 (`d88c67b`) made the
> Agents Window **chat** the default launch surface for *every* agent provider via the
> revertible setting `chat.agentSessions.defaultSurface` (default `'chat'`), demoting the
> terminal selector (V18) to an opt-in escape hatch, and added the Grok provider. The bulk
> of that work's tests do **not** live in this module: the pure Grok `common/` logic and the
> CLI-registry invariants are **vitest `*.spec.ts`** under `extensions/copilot/` (run by
> `cd extensions/copilot && npm run test:unit`), and the P4 `defaultLaunchSurface` /
> `agentSessionsOpener` tests are **browser-layer** `*.test.ts` under
> `src/vs/workbench/contrib/chat/browser/agentSessions/` (run by `npm run test-browser`).
> The test **module's** stake in that work is the *automation/smoke* layer: the
> provider-agnostic Chat surface driven by `automation/src/chat.ts`, the multi-provider CLI
> smoke scenario `smoke/src/areas/chat/copilotCli.test.ts`, and the demoted-but-still-driven
> terminal selector in `automation/src/terminal.ts`.

The module carries two layers:

1. **Upstream VS Code harness** — the Mocha/Playwright/Electron unit runners (`unit/`), the API integration suites (`integration/`), the UI automation driver (`automation/`), the smoke suite (`smoke/`), the release sanity suite (`sanity/`), the Monaco editor packaging check (`monaco/`), and the MCP automation server (`mcp/`).
2. **stokd fork additions** — page objects and smoke scenarios for the Agents Window, Chat Sessions, and multi-provider Copilot CLI; the Image Carousel Playwright component fixture; and a fork-specific exclusion in the node runner (`vs/sessions/test/web.test.js`, a web-only E2E that imports CSS and cannot run under Node).

## Public interfaces / entry points

### Test runners (invoked from `scripts/` / root `package.json`)

| Entry point | Invoked by | Discovers / does |
| --- | --- | --- |
| `unit/node/index.js` | `npm run test-node` (`mocha test/unit/node/index.js --delay --ui=tdd --timeout=5000 --exit`) | Node-layer Mocha runner. `TEST_GLOB = '**/test/**/*.test.js'`; `excludeGlobs` = browser/electron layers, `nativeModules.test.js`, `storage.test.js` (native sqlite), flaky `vs/workbench/contrib/testing/test/**`, and the fork-specific `vs/sessions/test/web.test.js`. Resolves base URL from `out` (or `out-build` with `--build`). Supports `--run <file>`, `--glob`, `--coverage`. Enforces a minimum Node major parsed from `remote/.npmrc` `target=`. |
| `unit/electron/index.js` (+ `renderer.html`, `renderer.js`, `preload.js`) | `scripts/test.[sh\|bat]` | Electron-renderer unit runner — DOM + Node APIs, closest to shipped runtime. `--debug` opens devtools; `--glob`/`--run` narrow the set; `--coverage` writes to `.build/coverage`. |
| `unit/browser/index.js` (+ `renderer.html`) | `npm run test-browser` (`npx playwright install && node test/unit/browser/index.js`) | Playwright browser unit runner for `common`/`browser` layers across chromium/webkit/firefox. `renderer.html?m=<amd_module>` loads a single module for debugging. Runs the ~62 `sessions/**/browser/**` and the P4 `chat/.../agentSessions/browser/**` fork tests. |
| `integration/browser/src/index.ts` | web integration (via `scripts/`) | Web/browser API integration suite (own lockfile). |
| `integration/electron/testrunner.js` | electron API integration (via `scripts/`) | Electron API integration test runner (`testrunner.d.ts` is the typed config surface). No manifest of its own. |
| `smoke/src/main.ts` (`main: ./src/main.js`) | `npm run smoketest` (`node build/lib/preLaunch.ts && cd test/smoke && npm run compile && node test/index.js`) | Automated UI smoke suite over a built or dev Electron; drives `automation/` page objects. `smoke`'s `compile` script chains `cd ../automation && npm run compile` first. `smoketest-no-compile` skips the build. |
| `sanity/src/index.ts` (`main: ./out/index.js`) | `cd test/sanity && npm start` | Release sanity suite (Playwright + Mocha + `mocha-junit-reporter`) over desktop / server / web / WSL / CLI / dev-tunnel builds. |
| `monaco/runner.js` | `cd test/monaco && npm test` | Monaco standalone-editor packaging/ESM check (`esm-check/`, `webpack.config.js`, `bundle-webpack`). |
| `mcp/src/stdio.ts` (`main: ./out/main.js`) | `cd test/mcp && npm run start-stdio` | Model Context Protocol **stdio server** that exposes the automation driver as MCP tools (`mcp/src/automationTools/*`) so an agent can drive VS Code. `compile` chains `cd ../automation && npm run compile`; `start-stdio` runs `npm ci && npm run -s compile` then `node ./out/stdio.js`. |
| `componentFixtures/playwright` (`test: playwright test`) | `cd test/componentFixtures/playwright && npm test` | Playwright component-fixture specs (e.g. `tests/imageCarousel.spec.ts` via `openFixture`); ESM (`type: module`), own lockfile + `playwright.config.ts`. |
| `.vscode-test.js` (repo root) | `npm run test-extension` (`vscode-test`) | `@vscode/test-cli` config: per-extension test configs (workspace folders, mocha timeouts, e.g. `markdown-language-features` @ 60s). Not under `test/` but is the entry point for extension integration tests. |

### Runner support files (`unit/`)

The node and electron unit runners share a set of helper modules that shape how results are emitted and instrumented:

- `unit/reporter.js` + `unit/fullJsonStreamReporter.js` — the **machine-readable JSON-stream Mocha reporter** (`FullJsonStreamReporter` over `mocha/lib/runner` constants) that emits one structured event per test pass/fail. This is the surface a harness parses to record an ordered red→green **outcome series** (Axiom 5.3); changing its event shape silently breaks any consumer of those outcomes.
- `unit/coverage.js` — coverage instrumentation/collection (writes to `.build/coverage`); driven by the `--coverage` flag on the node/electron runners.
- `unit/analyzeSnapshot.js` — forked snapshot analysis (runs in a child process because a worker cannot be spawned from the renderer).
- `unit/assert.js` — shared assertion utility loaded by the runners.
- `unit/electron/{renderer.html,renderer.js,preload.js}` — the electron-renderer host the unit runner loads.

### Automation driver (`test/automation` → published as `vscode-automation`, `main: ./out/index.js`)

The reusable Playwright-backed page-object library imported by `smoke/`, `sanity/`, and `mcp/`. Barrel: `automation/src/index.ts`. The 33 page objects include `application.ts`, `code.ts`, `workbench.ts`, `editor.ts`/`editors.ts`, `terminal.ts`, `quickaccess.ts`/`quickinput.ts`, `chat.ts`, `agentsWindow.ts` **(fork)**, plus `activityBar`, `viewlet`, `explorer`, `search`, `scm`, `debug`, `notebook`, `task`, `settings`, `extensions`, `problems`, `statusbar`, `peek`, `keybindings`, `localization`, `profiler`, `processes`, `logger`, and the launch backends `playwrightDriver`/`playwrightElectron`/`playwrightBrowser`/`electron`. `tools/copy-driver-definition.js` reads `src/vs/workbench/services/driver/common/driver.ts` and writes `driver.d.ts` into **both** `automation/src/` and `automation/out/`, keeping the published types in sync with the source driver contract (run as part of `automation`'s `compile`).

### MCP automation tools (`mcp/src/automationTools/*`)

The `mcp` stdio server re-exposes the automation page objects as MCP tools — `core.ts`, `windows.ts`, `chat.ts` **(fork-relevant — drives the workbench Chat panel)**, `editor.ts`, `explorer.ts`, `search.ts`, `scm.ts`, `debug.ts`, `notebook.ts`, `task.ts`, `terminal.ts`, `extensions.ts`, `settings.ts`, `keybindings.ts`, `localization.ts`, `problems.ts`, `profiler.ts`, `quickAccess.ts`, `statusbar.ts`, `activityBar.ts`, barreled by `index.ts`. Each tool wraps an `automation` method, so the same selector contracts (and their drift risks) flow through to agent-driven UI testing.

### Fixtures

- `componentFixtures/component-explorer.json` + `component-explorer-diff.json` — `@vscode/component-explorer-cli` config for component screenshot / visual regression.
- `componentFixtures/blocks-ci-screenshots.md` — **CI-generated** screenshot index (`<!-- auto-generated by CI — do not edit manually -->`).
- `componentFixtures/playwright/` — Playwright specs + `playwright.config.ts` for component fixtures (e.g. `tests/imageCarousel.spec.ts`, `tests/utils.ts` `openFixture`).

## Products

- **SC_PRODUCT_CODE_OSS_DEV.md** — code-oss-dev. `test` is one of the five packages of this single product (`cli`, `extensions`, `remote`, `scripts`, `test`). It **validates the other four**: it drives the workbench produced by `src`/`extensions`, the server produced by `remote`, and the CLI produced by `cli` (via `sanity/src/{cli,server,serverWeb,devTunnel,wsl}.test.ts`).

## Views

`test` renders no product UI; it **drives and asserts against** the runtime surfaces classified in `SC_VIEWS.md` (`V1`–`V28`, surface families A–E) through the `automation/` page objects and the `smoke/` / `sanity/` / `componentFixtures/` scenarios. Fork-distinguishing coverage:

- **Surface family A — Agents Window (`src/vs/sessions/`)** — primarily **V1 (Shell / Layout)**, **V5 (Session View / Chat)**, **V6 (New Chat / New Session)**: driven by `automation/src/agentsWindow.ts` (selectors `.agent-sessions-workbench`, `.sessions-chat-widget .new-chat-widget-container`, `.sessions-chat-session-type-picker .action-label`, `.sessions-chat-send-button`; methods `openCurrentFolderInAgentsWindow`, `switchToAgentsWindow`, `waitForNewSessionView`, `waitForAssistantText`) and the smoke scenario `smoke/src/areas/agentsWindow/agentsWindow.test.ts`. **This is the fork's most fragile automation surface** — selectors here are a contract with `src/vs/sessions/` DOM classes. Per the 0.6.0 SC_VIEWS update, **V6** is now the provider-agnostic permission-mode + multi-provider type/model picker, so `.sessions-chat-session-type-picker` is exercised against multiple providers.
- **V5 chat (main workbench panel)** — `automation/src/chat.ts` (and its MCP mirror `mcp/src/automationTools/chat.ts`) drive the *workbench* chat panel (`div[id="workbench.panel.chat"]`, `.interactive-session`, `.chat-execute-toolbar`), distinct from the Agents Window new-session view in `agentsWindow.ts`. With chat now the **default launch surface** for every provider (P4), this is the surface most multi-provider sessions land in. Smoke: `smoke/src/areas/chat/{chatSessions,chatDisabled,copilotCli}.test.ts`.
- **Surface family B — Workbench fork additions**: **V18 (Agent Terminal Selector)** — exercised by `automation/src/terminal.ts` + `smoke/src/areas/terminal`; in 0.6.0 V18 is **demoted to an opt-in escape hatch** (default surface is chat) but the page object still drives it. The flag-gated seam itself is guarded by `scripts/verify-seam.sh`, **not** this module. **V19 (Image Carousel)** — directly covered by `componentFixtures/playwright/tests/imageCarousel.spec.ts`. **V20 (Empty-Editor Watermark)** — no dedicated harness here.
- **Surface family D — Rust `code` CLI (V23–V27)** — `sanity/src/cli.test.ts` (`agent ps/logs/stop`), `server.test.ts`, `serverWeb.test.ts`, `devTunnel.test.ts`, `wsl.test.ts`.
- **Broad upstream workbench / editor / terminal / SCM / notebook surfaces** — driven by the general `automation/` page objects and the corresponding `smoke/src/areas/*` suites (`workbench`, `languages`, `notebook`, `multiroot`, `preferences`, `statusbar`, `search`, `task`, `terminal`, `extensions`, `accessibility`); these are upstream-classified and not enumerated in `SC_VIEWS.md`.

## Integration points

**Upstream / inputs**
- **Compiled `out/` tree** — `unit/node/index.js` resolves `out` (or `out-build` with `--build`) as the base URL for AMD module loading; runners assume a prior `compile`/`watch`.
- **`remote/.npmrc`** — `unit/node/index.js` parses `target="…"` to enforce the required Node major version; a mismatch is a hard exit.
- **`src/vs/workbench/services/driver/common/driver.ts`** — the automation driver contract; `automation/tools/copy-driver-definition.js` copies it into `driver.d.ts` (src + out) of the published `vscode-automation` types. Driver drift breaks all smoke/sanity/mcp automation.
- **`src/vs/sessions/` DOM** — `agentsWindow.ts` selectors are a direct contract with the Agents Window markup; a class rename on either side breaks Agents Window smoke coverage.
- **Repo-root `node_modules`** — `mocha`, `glob`, `minimatch`, `minimist`, `semver` for the runners; `playwright`, `@vscode/test-electron`, `@vscode/test-cli`, `@vscode/test-web` for the harnesses.
- **Sub-package `node_modules`** — the seven lockfiled sub-packages install independently and must be `npm ci`'d before their suite runs.

**Downstream / consumers**
- **`smoke/`, `sanity/`, `mcp/`** all import the compiled `automation` package (`main: ./out/index.js`) — `automation` must be compiled first; `smoke` and `mcp` chain `cd ../automation && npm run compile` in their own `compile`.
- **CI** — the smoke/sanity suites and `componentFixtures` screenshot diffs gate releases; `blocks-ci-screenshots.md` is auto-generated and must not be hand-edited.

## Key source files

| File | Why it matters |
| --- | --- |
| `unit/node/index.js` | Node Mocha runner; defines `TEST_GLOB` and `excludeGlobs` that determine which tests run in which layer. Editing globs silently changes coverage; the `vs/sessions/test/web.test.js` exclusion (CSS import) must stay. |
| `unit/electron/index.js` | Renderer-layer runner — the environment closest to shipped VS Code; primary CI unit gate. |
| `unit/browser/index.js` | Cross-browser (chromium/webkit/firefox) unit runner; catches platform-specific DOM failures and runs the ~62 `sessions/**/browser/**` + P4 `chat/.../agentSessions/browser/**` fork tests. |
| `automation/src/index.ts` | Barrel export of the `vscode-automation` driver consumed by every higher suite. |
| `automation/src/code.ts` / `application.ts` / `workbench.ts` | Core driver lifecycle (launch Electron/web, connect Playwright, top-level page object). |
| `automation/src/agentsWindow.ts` | **(fork)** Page object for the Agents Window — selectors and command flows for `src/vs/sessions/` (V1/V5/V6). |
| `automation/src/chat.ts` | Page object for the main workbench Chat panel (`workbench.panel.chat`) — the P4 default launch surface for every provider. |
| `automation/src/terminal.ts` | Page object for the terminal, including the V18 agent-aware selector surface (now opt-in). |
| `automation/tools/copy-driver-definition.js` | Keeps the driver type contract (`driver.d.ts`) in sync with `src/`; a guard against driver API drift. |
| `smoke/src/main.ts` | Smoke-suite bootstrap (Electron download, logging, options). |
| `smoke/src/areas/agentsWindow/agentsWindow.test.ts` | **(fork)** Smoke scenario for the Agents Window. |
| `smoke/src/areas/chat/{chatSessions,chatDisabled,copilotCli}.test.ts` | **(fork-relevant)** Chat Sessions / chat-disabled / multi-provider Copilot CLI smoke scenarios. |
| `sanity/src/{cli,server,serverWeb,devTunnel,wsl,desktop}.test.ts` | Release sanity over desktop/server/web/WSL/CLI/tunnel builds (drives `cli/` and `remote/` outputs). |
| `mcp/src/stdio.ts` + `automationTools/` | Exposes the automation driver as MCP tools for agent-driven UI testing (incl. `automationTools/chat.ts`). |
| `monaco/runner.js` + `esm-check/` | Validates the standalone Monaco editor packaging / ESM exports. |
| `componentFixtures/playwright/tests/imageCarousel.spec.ts` | **(fork-relevant)** Playwright component fixture for V19 Image Carousel. |
| `.vscode-test.js` (repo root) | `@vscode/test-cli` config for extension integration tests (`npm run test-extension`). |
| `unit/reporter.js` + `unit/fullJsonStreamReporter.js` | Machine-readable JSON-stream Mocha reporter; the per-test pass/fail event surface a harness parses to record red→green outcome series (Axiom 5.3). |
| `cgmanifest.json` | Vendored third-party test-dependency registration (e.g. `Jxck/assert`) for license/compliance scanning; update when a vendored test dep is added or its commit/hash changes. |

## Change impact

When this module changes, validate the following:

- **Runner glob / exclude edits (`unit/node/index.js`, `unit/electron/index.js`):** can silently include or drop whole test layers. Confirm `npm run test-node` discovers the expected file count, especially the fork-relevant `src/vs/sessions/test/common/**`; remember most `sessions` tests (and all P4 `chat/.../agentSessions` browser tests) live in `browser/` and run only under `npm run test-browser`. The `vs/sessions/test/web.test.js` exclusion must stay (CSS import, cannot run under Node).
- **Automation driver (`automation/src/*`):** a selector or method change ripples to every consumer (`smoke`, `sanity`, `mcp` — including the `mcp/src/automationTools/*` mirrors). Recompile `automation` first, then re-run the smoke suite. Selector drift in `agentsWindow.ts` (`.agent-sessions-workbench`, `.sessions-chat-widget`, `.sessions-chat-send-button`, `.sessions-chat-session-type-picker`) is the most common fork breakage when `src/vs/sessions/` DOM classes change.
- **Driver contract (`copy-driver-definition.js`):** must be re-run if `src/vs/workbench/services/driver/common/driver.ts` changes, or the published `vscode-automation` types (`driver.d.ts`) go stale and smoke/sanity/mcp fail to compile.
- **Sub-package dependency bumps:** each lockfiled sub-package installs independently; a bump in `automation` requires re-`npm ci` **and** recompile in `smoke`/`sanity`/`mcp` before their suites pass.
- **Node version floor:** changing `remote/.npmrc` `target` shifts the minimum Node the node runner accepts.
- **Multi-provider / P4 surface changes:** the Grok-provider and CLI-registry tests are **not in this module** (they are vitest `*.spec.ts` under `extensions/copilot/` and browser `*.test.ts` under `src/vs/workbench/contrib/chat/browser/agentSessions/`). When the *default launch surface* or provider pickers change, re-run `smoke/src/areas/chat/copilotCli.test.ts` and the Agents Window smoke scenario to confirm chat-default routing and the provider-agnostic V6 pickers still resolve.
- **Rebase (upstream sync):** per `SC_TEST.md` §7, after a sync re-run `node --test` on `agentTabs/test/**`, `npm run test-node` (sessions `common`) + `npm run test-browser` (sessions `browser` + P4 `agentSessions` browser), and the smoke Agents Window / Chat scenarios; recompile `automation` to catch driver-interface drift; keep `scripts/verify-seam.sh` green.
- **`componentFixtures` config / screenshots:** `blocks-ci-screenshots.md` is CI-generated — do not hand-edit; visual-regression baselines change when component DOM changes. The Image Carousel fixture spec is the V19 browser-level guard.
