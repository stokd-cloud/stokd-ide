<!-- stokd-meta: SC_TEST.md | package: Monorepo (root) | priority: critical -->
# SC_TEST.md — Testing Strategy: `stokd-ide` (Monorepo root)

## 0. Scope & Guiding Principle

`stokd-ide` is a **thin-patch fork of `microsoft/vscode`** (`code-oss-dev` @ `1.125.0`).
Upstream code is already exhaustively tested by Microsoft and re-verified on every
rebase by a full `npm run compile`. **Writing or maintaining tests for upstream code
is out of scope** — it is wasted effort that also widens the rebase conflict surface.

> **The only code this strategy targets is fork-owned code** — the files the fork
> created or the single upstream line it edits. Concretely:
>
> 1. `src/vs/workbench/contrib/terminal/browser/agentTabs/**` — agent-aware terminal selector (AX-TERMINAL-AGENT-TABS)
> 2. `src/vs/sessions/**` — the Agents Window layer
> 3. `extensions/copilot/**` — first-party Copilot Chat extension
> 4. The **seam edit** in `src/vs/workbench/contrib/terminal/browser/terminalView.ts` (~10 ins / 3 del)
> 5. Fork tooling: `scripts/verify-seam.sh`, `scripts/sync-upstream.sh`

The fork's defining constraint — *"anything that can be a new file IS a new file"* —
is also a **testing** constraint: keep behavior in pure, new, DOM-free modules so it
can be tested without a full build, and keep the untestable upstream-touching surface
(`terminalView.ts`) so trivial it needs only a grep-level guard.

---

## 1. Test Harnesses Available (use the cheapest one that fits)

The repo ships **three** distinct harnesses. Pick by what the code under test depends on.

| Harness | Command | Discovers | Needs a build? | Use for |
|---|---|---|---|---|
| **`node --test` (native TS strip)** | `node --test path/to/x.test.ts` | the file you name | **No** | Pure, dependency-free logic (zero `vs/` imports). The fastest loop. |
| **Mocha node unit** | `npm run test-node` | `**/test/**/*.test.js` (TDD `suite`/`test`) | Yes (`npm run compile`/`watch`) | Logic that imports `vs/base`, `vs/platform`, services, DI. |
| **Playwright browser unit** | `npm run test-browser` | same glob, `browser/` layer | Yes | DOM-touching code (`vs/base/browser/dom`, views, widgets). |
| **Copilot Vitest unit** | `cd extensions/copilot && npm run test:unit` (`vitest --run --pool=forks`) | copilot `**/test/**` | Copilot Vite build | Pure/unit logic inside `extensions/copilot/`. |
| **Extension integration** | `cd extensions/copilot && npm test` (`vscode-test` + sanity + vitest + mocha) | copilot `**/test/vscode-node/**` | Copilot build | `extensions/copilot/` activation/commands against a real extension host. |
| **Seam guard (grep)** | `scripts/verify-seam.sh` | n/a | No | Binary safety check on the one edited upstream file. |

Notes grounded in the harness source (`test/unit/node/index.js`):
- `TEST_GLOB = '**/test/**/*.test.js'` — tests **must** live in a `test/` subfolder and end in `.test.ts` (compiled to `.test.js`). This is why `agentTabs/test/` and `sessions/test/` exist.
- The node run **excludes** `**/{browser,electron-browser,electron-main,electron-utility}/**/*.test.js` — DOM tests only run under `test-browser`. Place a test in the layer matching its dependencies or it will be silently skipped.
- Run a single mocha file fast: `npm run test-node -- --run src/vs/sessions/test/common/agentHostSessionsProvider.test.ts`.

### The two house styles (match the file you sit next to)

**A. Standalone pure test** (`node --test`) — current `agentTabs` style. No build, imports `.ts` directly:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeSelectorRows } from '../agentTerminalSelectorRows.ts';   // .ts extension
```

**B. Mocha unit test** — the `sessions` / upstream style:
```ts
import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';  // .js extension
suite('MyUnit', () => {
    ensureNoDisposablesAreLeakedInTestSuite();   // MANDATORY for anything touching Disposable/Emitter
    test('does X', () => { /* ... */ });
});
```

---

## 2. What To Test (by component, ranked)

### 2.1 Agent-aware terminal selector — `agentTabs/` (HIGHEST priority — the flagship fork feature)

| File | Current coverage | Gap to close |
|---|---|---|
| `agentTerminalSelectorRows.ts` (`mergeSelectorRows`) | ✅ 6 tests, `node --test` | Edge cases below. **Note:** the tests live in the *misnamed* file `test/agentTerminalSelectorModel.test.ts` — it imports and exercises only `mergeSelectorRows` from the *rows* file, not the model class. See the rename action in §3. |
| `agentTerminalSelectorModel.ts` (`AgentTerminalSelectorModel`) | ❌ **none** | The model **class** is untested despite the test file bearing its name. Cover the event fan-in (3 listeners + ctor recompute) + `_agentMeta` mapping. |
| `agentTerminalTabbedView.ts` (`AgentTerminalTabbedView`) | ❌ **none** | DOM render of rows (browser test) |
| `agentTabsContribution.ts` (flag registration) | ⚠️ grep-only via `verify-seam.sh` | Default-`false` assertion (covered, keep) |
| `ITerminalTabsView.ts` | ✅ compile-time assertion | Drift caught by `tsc` — no runtime test needed |
| `terminalView.ts` seam | ⚠️ grep-only via `verify-seam.sh` | Keep grep guard; do not unit-test upstream |

**Critical paths & edge cases for `mergeSelectorRows`** (extend the existing pure test — cheapest, highest value):
- ✅ already covered: two-section ordering, agent-wins de-dupe, intra-list de-dupe, collapsed-section header retention, empty input, agents-only.
- ➕ **add**: `collapsed: { agents: true }` (mirror of the terminals case); **both** sections collapsed; an id present in *both* lists *and* duplicated *within* the agents list; preservation of input order within a section; `meta` object passed through unchanged onto the `agent` row.

**`AgentTerminalSelectorModel`** (needs DI → mocha node test, `sessions` style). The model is a pure event-fan-in over two services, so test with **fakes**, not the real terminal stack:
- Construct with fake `ITerminalGroupService` + `ITerminalChatService`; assert `rows` is computed eagerly in the ctor.
- Fire each subscribed event (`onDidChangeInstances`, `onDidChangeActiveInstance`, `onDidRegisterTerminalInstanceWithToolSession`) and assert `onDidChange` fires **once** per and `rows` recomputes.
- `_agentMeta` mapping (test via observable `rows[].meta`): `isBackground` → `runState: 'background'`; a session with `getAhpCommandSource` truthy → `runState: 'running'`; `sessionTitle` fallback chain `resource.path basename → instance.title → 'Agent'`.
- Wrap in `ensureNoDisposablesAreLeakedInTestSuite()` — the model registers 3 listeners + an emitter; this asserts they're disposed.

**`AgentTerminalTabbedView`** (DOM → `browser/` mocha test, runs under `test-browser`). Keep light — it is a Phase-2 skeleton:
- Given a model with one header + one terminal + one agent row, assert the container renders `.agent-tabs-section-header`, `.agent-tabs-row.terminal`, `.agent-tabs-row.agent` with the expected `textContent` (`"Agents (1)"`, agent label `"<title> [<runState>]"`).
- `onDidChange` from the model triggers a re-render (clear + rebuild).
- `layout(w,h)` sets container width/height; disposal cleans up.

### 2.2 Agents Window — `src/vs/sessions/**` (HIGH priority — large fork surface, 65 existing `*.test.ts`)

Already the best-tested fork area (~64 `*.test.ts`, mocha, split `common` / `browser` / `e2e` at `src/vs/sessions/test/` plus per-contrib `contrib/<feature>/test/browser/`). **Reality check on harness:** **62 of ~64** sessions tests sit in a `browser/` layer folder, so they are **excluded from `npm run test-node`** (the node runner skips `**/{browser,electron-*}/**`) and run only under **`npm run test-browser`**. Only the handful under `test/common/` (e.g. `agentHostSessionsProvider.test.ts`) run in the node runner. Strategy = **sustain and extend**, matching the existing split:
- **`common/`** — provider logic, schema derivation (e.g. `buildMutableConfigSchema`), session-provider registration. Pure-ish, fast, node layer → `test-node`.
- **`browser/`** — layout controller, parts, mobile views (`mobileSessionsPart`, `auxiliaryBarPart`, `layoutActions`), and the bulk of contrib tests. DOM layer → `test-browser`.
- **`e2e/`** — scenario-driven (`src/vs/sessions/test/e2e/scenarios/`, driven by `test.cjs`/`generate.cjs`) against a mock session extension. Run before shipping session-provider or chat-flow changes.
- **Rule:** any new session **provider** gets a `common/*.test.ts` (keeps it in the fast node runner); any new **layout/part** gets a `browser/*.test.ts`. Respect the layer law (`sessions` may import `workbench`, never the reverse) — a test that forces an upward import is a design smell.

### 2.3 Copilot Chat extension — `extensions/copilot/**` (MEDIUM)
- Has its **own Vite build and its own test scripts** — run them from inside the package, not the repo root. `extensions/copilot/package.json` defines: `test` = `npm-run-all test:*`; `test:unit` = **`vitest --run --pool=forks`** (pure/unit logic); `test:extension` = `vscode-test` (activation/command/tool-session against a real extension host); `test:sanity` = `vscode-test --sanity`; `test:prompt` = mocha over `completions-core` prompt tests; `test:completions-core` = a custom `runTest.ts`.
- Existing integration tests live under `src/extension/**/test/vscode-node/*.test.ts` (e.g. `extension.test.ts`, `session.test.ts`, `endpoints.test.ts`); the simulation harness lives under `test/simulation/`.
- For new pure helpers prefer **Vitest** (`test:unit`) — it is the established unit harness here; reserve `vscode-test` for behavior that needs the extension host.
- Mock the AI SDKs (`@anthropic-ai/sdk`, `@github/copilot-sdk`) — never hit a live model in tests (see §4).

### 2.4 Fork tooling (LOW but required — these are the rebase safety net)
- `scripts/verify-seam.sh` is itself the test for the upstream edit; it **must exit 0** in CI on every rebase. Treat a non-zero exit as a release blocker.
- Add a tiny smoke check that `scripts/sync-upstream.sh` is executable and prints the next rebase target without erroring (no network assertions).

---

## 3. Test File Organization & Naming

Follow the established conventions exactly — the harness globs depend on them:
- **Location:** co-locate under a `test/` subfolder beside the unit (`…/agentTabs/test/`, `…/sessions/test/common/`). Mirror the source layer (`common` / `browser` / `electron-*`) so the right harness picks it up.
- **Name:** `<unitName>.test.ts`. One suite per file; the suite name matches the unit/function under test.
- **Copyright header:** fork-authored files use the **`Copyright (c) stokd. Thin-patch fork …`** header (see existing `agentTabs/*`); files derived from upstream keep the Microsoft header.
- **Imports:** mocha-style tests import sibling source with **`.js`** extensions; standalone `node --test` files import with **`.ts`** extensions. Do not mix.
- **No new top-level test dirs.** New fork tests live under the layer they test, never at repo root.

> ⚠️ **Known naming violation to fix:** `agentTabs/test/agentTerminalSelectorModel.test.ts` is misnamed — it tests `mergeSelectorRows` (the *rows* module), not `AgentTerminalSelectorModel`. Per the "suite name matches the unit under test" rule, **rename it to `agentTerminalSelectorRows.test.ts`** and free the `agentTerminalSelectorModel.test.ts` name for the actual (mocha node) model test added in §6. Do this rename in the same task that adds the first model test, so the two files don't collide.

---

## 4. Mock / Stub Strategy

- **Prefer pure cores over mocks.** The whole `agentTabs` design — pushing logic into `mergeSelectorRows` with zero imports — exists so the hard part needs *no* mocks. Replicate this for any new fork logic: extract the decision into a pure function, test it with `node --test`, keep the DI shell thin.
- **Fake the two terminal services by hand** for `AgentTerminalSelectorModel`. Implement only the surface it touches: `ITerminalGroupService` → `instances`, `onDidChangeInstances`, `onDidChangeActiveInstance`; `ITerminalChatService` → `getToolSessionTerminalInstances`, `onDidRegisterTerminalInstanceWithToolSession`, `getToolSessionIdForInstance`, `getChatSessionResourceForInstance`, `isBackgroundTerminal`, `getAhpCommandSource`. Use `Emitter` from `vs/base/common/event` for the fake events.
- **Use VS Code test utilities** rather than rolling your own: `ensureNoDisposablesAreLeakedInTestSuite()` (mandatory for Disposable-owning units), `workbenchInstantiationService` / `TestInstantiationService` for DI-heavy `sessions` tests.
- **Never call real external services** — no live Anthropic/Copilot model calls, no network, no real terminal PTYs. Stub the AI SDKs at the module boundary; assert on request shape, not model output.
- **DOM:** rely on the Playwright `test-browser` environment for real DOM; do not hand-roll a DOM shim.

---

## 5. Coverage Targets (priority: **critical** — but scoped to fork-owned code)

Coverage is measured on **fork-owned files only**. Generate with `npm run test-node -- --coverage`.

| Area | Line target | Rationale |
|---|---|---|
| `agentTabs/agentTerminalSelectorRows.ts` | **100%** | Pure, branchy, trivially coverable; it's the heart of the feature. |
| `agentTabs/agentTerminalSelectorModel.ts` | **≥ 90%** | Event fan-in + meta mapping; fakes make full coverage cheap. |
| `agentTabs/agentTerminalTabbedView.ts` | **≥ 70%** | Skeleton view; cover render branches, skip Phase-3 stubs. |
| `src/vs/sessions/**` (fork logic) | **≥ 80%** | Large surface; hold the line, raise with each new provider/part. |
| `extensions/copilot/**` (fork glue) | **≥ 60%** | Integration-heavy; cover activation + command wiring. |
| Edited upstream lines (`terminalView.ts` seam) | **grep guard = green** | Not unit coverage — `verify-seam.sh` must pass. |
| Upstream files (everything else) | **n/a** | Out of scope by design. |

**Gating (what blocks a release / merge):**
1. `scripts/verify-seam.sh` exits 0.
2. `node --test` on every `agentTabs/test/*.test.ts` passes.
3. `npm run test-node` green for the **node-layer** fork tests (`sessions/test/common/**`, any future `agentTabs` model test) **and** `npm run test-browser` green for the **browser-layer** fork tests (the ~62 `sessions/**/browser/**` tests + the agentTabs view test). Most sessions coverage is browser-layer — do not assume `test-node` alone exercises it.
4. `npm run compile` succeeds on the current rebase target (the canary for `ITerminalTabsView` interface drift).

---

## 6. Specific Test Cases To Implement First (ordered)

Each is a TDD **red → green** unit — write the test, see it fail, then implement/verify.

1. **`mergeSelectorRows` — `collapsed: { agents: true }`** keeps the Agents header with full count and hides agent rows. *(extend existing pure test — 5 min, mirrors the proven terminals case)*
2. **`mergeSelectorRows` — both sections collapsed**: two headers, zero child rows, counts intact.
3. **`mergeSelectorRows` — meta pass-through**: an `agent` row's `meta` is the exact object supplied (sessionTitle/runState/pendingApprovals/isBackground preserved).
4. **`mergeSelectorRows` — id in both lists AND duplicated within agents**: renders once, as an agent, counted once.
5. **`AgentTerminalSelectorModel` — eager compute + single-fire fan-in**: ctor populates `rows`; each of the 3 subscribed events (`onDidChangeInstances`, `onDidChangeActiveInstance`, `onDidRegisterTerminalInstanceWithToolSession`) fires `onDidChange` exactly once and recomputes. *(first mocha node test for the model — first rename the existing rows test off the `agentTerminalSelectorModel.test.ts` name, see §3)*
6. **`AgentTerminalSelectorModel._agentMeta` — runState mapping**: background→`'background'`, AHP command source→`'running'`, else `'idle'`; `sessionTitle` fallback chain.
7. **`AgentTerminalSelectorModel` — no disposable leaks** via `ensureNoDisposablesAreLeakedInTestSuite()`.
8. **`AgentTerminalTabbedView` — render fidelity** (browser test): header/terminal/agent rows produce the expected DOM classes and text; model change re-renders.
9. **`verify-seam.sh` CI wiring**: assert the script is invoked in CI and a deliberate break (flag default flipped to `true` in a fixture copy) makes it exit non-zero. *(protects the rebase contract)*

Items 1–4 require **no build** and should land immediately; 5–7 establish the model test file; 8 adds the browser-layer test; 9 hardens the rebase safety net.

---

## 7. Rebase-Time Test Protocol (fork-specific, non-negotiable)

On every upstream sync (`scripts/sync-upstream.sh` → rebase, see `docs/REBASE_RUNBOOK.md`):
1. `scripts/verify-seam.sh` — flag still off by default, flag-off path still builds the stock view.
2. `npm run compile` — the **only** thing that catches `ITerminalGroupService` / `ITerminalChatService` / `TerminalTabbedView` interface drift (a compile error, not a silent conflict). The `ITerminalTabsView` compile-time assertion is the canary.
3. `node --test` on `agentTabs/test/**` + `npm run test-node` on `sessions` — confirm fork behavior survived the rebase.

If any step fails, the rebase is not complete — fix the seam, do not weaken the test.
