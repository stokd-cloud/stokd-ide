<!-- stokd-meta: SC_TEST.md | package: Monorepo (root) | priority: critical | refreshed: 2026-06-26 -->
# SC_TEST.md — Testing Strategy: `stokd-ide` (Monorepo root)

## 0. Scope & Guiding Principle

`stokd-ide` is a **thin-patch fork of `microsoft/vscode`** (`code-oss-dev` @ `1.125.0`).
Upstream code is exhaustively tested by Microsoft and re-verified on every rebase by a
full `npm run compile`. **Writing or maintaining tests for upstream code is out of scope**
(AX-REPO-FORK-TDD-SCOPE) — it is wasted effort that widens the rebase conflict surface.

> **This strategy targets fork-owned code only** — files the fork created or the few
> upstream lines it edits. Concretely, in priority order:
>
> 1. `src/vs/workbench/contrib/terminal/browser/agentTabs/**` — agent-aware terminal selector (AX-TERMINAL-AGENT-TABS) — *12 source modules, 7 test files*
> 2. `extensions/copilot/src/extension/chatSessions/grok/**` — Grok provider (CLI adapter + spawn-per-turn node agent) — *new since PR #4 / `d88c67b`*
> 3. `extensions/copilot/src/extension/chatSessions/common/agentCliProvider*.ts` — multi-provider CLI registry (the seam that makes #2 generic)
> 4. `src/vs/workbench/contrib/chat/browser/agentSessions/**` — P4 chat-default launch surface + the broader agentHost chat surface
> 5. `src/vs/platform/agentHost/node/grok/grokAgent.ts` — the platform-layer Grok `IAgent` (child-process, **currently untested — the biggest gap**)
> 6. `src/vs/sessions/**` — the Agents Window layer (~66 `*.test.ts`)
> 7. The **seam edit** in `src/vs/workbench/contrib/terminal/browser/terminalView.ts` (grep-guarded, not unit-tested)
> 8. Fork tooling: `scripts/verify-seam.sh`, `scripts/sync-upstream.sh`

The fork's defining constraint — *"anything that can be a new file IS a new file"* — is
also a **testing** constraint: keep behavior in pure, new, DOM-free modules so it can be
tested without a full build, and keep the untestable upstream-touching surface
(`terminalView.ts`) so trivial it needs only a grep-level guard. The Grok provider is the
model citizen here: 8 pure `common/` modules backed by 8 vitest specs, with all I/O
quarantined in `node/` and `src/vs/platform/agentHost/node/`.

---

## 1. Test Harnesses Available (use the cheapest one that fits)

The repo ships **five** distinct harnesses plus a grep guard. Pick by what the code under
test depends on.

| Harness | Command | Discovers | Needs a build? | Use for |
|---|---|---|---|---|
| **`node --test` (native / tsx)** | `node --import tsx --test src/**/x.test.ts` *or* `node --test out/**/x.test.js` | the file you name | **No** (tsx) / yes (`out/`) | DOM-free `vs/` logic. The agentTabs house style. Fastest loop. |
| **Mocha node unit** | `npm run test-node` | `**/test/**/*.test.js` (TDD `suite`/`test`), **excludes** `browser`/`electron-*` layers | Yes (`compile`/`watch`) | Logic importing `vs/base`, `vs/platform`, services, DI — in a `common/`/`node/` layer. |
| **Playwright browser unit** | `npm run test-browser` | same glob, `browser/` layer | Yes | DOM-touching code (views, widgets) and **most `sessions/**` + `chat/.../agentSessions` tests**. |
| **Electron unit** | `scripts/test.sh [--grep X]` | `test/unit/electron/index.js` | Built Electron app | Full-app electron-layer behavior (rarely needed for fork work). |
| **Copilot Vitest** | `cd extensions/copilot && npm run test:unit` (`vitest --run --pool=forks`) | **`**/*.spec.ts`** | No (vite, with `vscode` shim) | Pure/unit logic in `extensions/copilot/` — the Grok `common/` and registry tests. |
| **Copilot extension-host** | `cd extensions/copilot && npm run test:extension` (`vscode-test`) | **`**/test/vscode-node/**/*.test.ts`** | Copilot build | Activation/commands/tool-session against a real extension host. |
| **Copilot simulation** | `cd extensions/copilot && npm run simulate-ci` | `test/simulation/**` | Copilot build | AI prompt/quality regression vs a baseline. Not a unit harness — gate on baseline diff. |
| **Seam guard (grep)** | `scripts/verify-seam.sh` | n/a | No | Binary safety check on the one edited upstream file. |

**Harness facts grounded in source — internalize these or your test runs silently:**

- **Mocha node** (`test/unit/node/index.js`): `TEST_GLOB = '**/test/**/*.test.js'` and it **excludes** `**/{browser,electron-browser,electron-main,electron-utility}/**`. A test placed in a `browser/` folder will **not** run under `test-node` — it only runs under `test-browser`. This is why **62 of the 66 `sessions/**` `*.test.ts` and 20 of the 23 `chat/**/agentSessions` tests run only under `test-browser`**; only the `common/`-layer tests run under `test-node` — 3 in `sessions/test/common/`, and 3 in `chat/test/common/agentSessions/` (`agentSessionProviderRegistration` / `…Codicons` / `…Redirect`). **Do not assume `test-node` covers the chat/sessions surface — the overwhelming majority is browser-layer.**
- **Copilot naming is load-bearing**: `**/*.spec.ts` → **vitest** (`test:unit`); extension-host tests are bundled into `dist/test-extension.js` (from `test/vscode-node/**`) and run by **vscode-test** (`test:extension`). The repo currently has **398 `.spec.ts`** (→ vitest) vs **95 `.test.ts`** across copilot (these are split across harnesses — vscode-test and completions-core mocha — *not* all extension-host). Name a new pure copilot test `*.spec.ts` or vitest never sees it.
- **agentTabs is `node:test`, not mocha**: files import `node:test` + `node:assert/strict`, import siblings with the VS Code `.js` extension convention, and are runnable two ways — from source via `node --import tsx --test src/...` (no build) or against compiled output via `node --test out/...`. See the run-command comment block at the top of each agentTabs test.

### House styles (match the file you sit next to)

**A. agentTabs pure test** (`node:test`, `.js` imports, no build via tsx):
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeSelectorRows, buildProvidedSelectorRows } from '../agentTerminalSelectorRows.js';
```

**B. Copilot vitest spec** (Grok / registry style):
```ts
import { describe, expect, it } from 'vitest';
import { grokTextOf, grokToolKind } from '../grokStreamTypes.ts';   // vite resolves the vscode shim
```

**C. Mocha unit / browser test** (sessions, chat agentSessions, upstream style):
```ts
import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
suite('MyUnit', () => {
    ensureNoDisposablesAreLeakedInTestSuite();   // MANDATORY for anything touching Disposable/Emitter
    test('does X', () => { /* ... */ });
});
```

---

## 2. What To Test (by component, ranked)

### 2.1 Grok platform agent — `src/vs/platform/agentHost/node/grok/grokAgent.ts` (HIGHEST priority — largest untested fork surface)

`GrokAgent extends Disposable implements IAgent` (~933 LOC, 29 KB) is the **spawn-per-turn**
node adapter: it spawns the `grok` CLI per turn, parses NDJSON, manages turn state, emulates
steering via `SIGTERM`+resume, and discovers sessions by walking `~/.grok/sessions/`.
**It has no test.** Child-process + filesystem I/O make it expensive to test as-is — the fix
is *extraction*, per the fork's pure-core discipline:

- **Extract and unit-test the pure record handling.** The per-line NDJSON parse, the
  record→turn-state transitions, and the `_handle*Record` mappers should be pure functions
  over `GrokStreamRecord` (the types already live in `grok/common/grokStreamTypes.ts`). Once
  extracted into `common/`, test them with **vitest** alongside the existing Grok specs — no
  spawn, no fs. This is the single highest-value test investment in the fork right now.
- **Mock the boundary for what cannot move.** For the residual spawn/abort/resume logic,
  inject `child_process.spawn` and the fs reads behind an interface and assert on the
  *commands issued* (argv, signal), not on a live `grok` process. Reuse the already-tested
  `buildGrokHeadlessArgs` / `buildGrokResumeArgs` (in `grokSessionListing.ts`) so argv
  construction is verified once, in `common/`.
- **Steering contract** (`setPendingMessages` → abort + resume): assert it emits exactly the
  `SIGTERM` (`GROK_STEERING_ABORT_SIGNAL`) then a resume spawn — this is the emulation of a
  capability the CLI lacks, so it is fork logic worth a regression test.

### 2.2 Grok provider common layer — `extensions/copilot/.../chatSessions/grok/common/**` (HIGH — exemplary, sustain + close edges)

**Best-tested new surface: 8 source modules; 7 carry a vitest spec, plus a `grokAgent.spec.ts`
node-registration smoke test.** The **one uncovered module is `grokPermissionModes.ts`** —
write its spec first (§6). Strategy = *sustain and extend the edges*. Verified pure exports
worth holding at high coverage:

| Module | Key exports | Edge cases to confirm/add |
|---|---|---|
| `grokStreamTypes.ts` | `grokTextOf`, `grokToolKind`, `GROK_CHAT_RECORD_TYPES`, `GROK_EVENT_TYPES`, `GROK_CHAT_FORMAT_VERSION` | `grokTextOf` over `string` vs `GrokContentBlock` vs `readonly GrokContentBlock[]` vs `undefined`; unknown tool name → `'simple'`; record/event type sets stay **disjoint** (the normalizer relies on this). |
| `grokStreamingEvents.ts` | `GrokEventNormalizer` (`normalize`, `flush`) | One spec per event type (reasoning, tool-start/complete, permission, lifecycle); `flush()` after a partial turn; replay (`chat_history.jsonl`) vs stream (`events.jsonl`) parity — same normalizer, both directions (per AC-P3.1 header). |
| `grokSessionListing.ts` | `parseGrokSummaryRow`, `sortGrokRowsByRecency`, `grokSessionsDirSegmentForCwd`, `buildGrokHeadlessArgs`, `buildGrokResumeArgs` | Missing/empty/corrupt `summary.json`; recency tie-break; cwd→dir-segment hashing stability; resume args with and without a trailing prompt. |
| `grokShellSecurity.ts` | `grokIsShellTool` | Boundary set (`shell`/`bash`/`exec`/`execute`/`command`/`terminal`/`run`) and near-misses that must return `false`. |
| `grokProviderDescriptor.ts` | `GROK_PROVIDER_ID`, `createGrokAdapter`, `grokProviderDescriptor`, pinned-version/flag constants | Descriptor shape passes `validateSecurityDescriptor` (§2.3); `GROK_CLI_PINNED_VERSION` change is a deliberate, reviewed contract bump. |
| `grokModelCatalog.ts` | model catalog | Catalog is non-empty and every entry has the required `IAgentCliModelDescriptor` fields. |
| `grokSteering.ts` | `GROK_STEERING_ABORT_SIGNAL` | Signal value is `'SIGTERM'` (the agent in §2.1 depends on it). |
| `grokPermissionModes.ts` ⚠️ **no spec yet** | declared permission modes | **Write the missing spec:** modes are a subset of the registry's allowed set; each declared mode is non-empty and unique. This is the only uncovered `grok/common/` module. |

### 2.3 Multi-provider CLI registry — `extensions/copilot/.../chatSessions/common/agentCliProvider*.ts` (HIGH — the generic seam)

This is what makes Grok (and the next provider) pluggable, so its invariants protect every
provider. Pure, vitest-covered (`agentCliProvider.spec.ts`, `agentCliProviderRegistry.spec.ts`).
Verified exports and the contracts to pin:

- `validateSecurityDescriptor(security)` — **security-critical** (ties to AX-REPO-CROSS-LANGUAGE-CONTRACTS / loopback-only intent). Test: valid loopback+auth → `undefined`; non-loopback bind, missing/unknown auth scheme → a specific error string. Default-deny on uncertainty.
- `AgentCliProviderRegistry` (`registerDescriptor`/`getDescriptor`/`getDescriptors`) — duplicate id, security-reject-on-register, ordering/stability of `getDescriptors`.
- `applyRegistryToAgentService(...)` — only **enabled** providers are instantiated; the factory is called once per enabled descriptor; disabled providers are skipped.
- ID/setting/command derivation (`providerEnabledSettingId`, `providerEnable/DisableCommandId`, `…FromSettingId`, `generateProviderEnabledConfigs`, `generateProviderEnabledCommands`) — round-trip: `settingId → commandId → ` back is consistent; generated config entries match the descriptor set.

### 2.4 P4 chat-default launch surface — `src/vs/workbench/contrib/chat/browser/agentSessions/**` (HIGH)

The decision of whether an agent session opens in **chat** vs **terminal**. Pure core +
DI shell, both already covered (`test/browser/agentSessions/defaultLaunchSurface.test.ts`,
`agentSessionsLaunchSurface.test.ts`) — **browser layer → `test-browser` only**.

- `defaultLaunchSurface.ts` (PURE): `getLaunchSurface(providerId, context)` and
  `getDefaultLaunchSurface(providerId, configuredDefault?)`. Pin the **DN-1 invariant**: an
  explicit escape-hatch in `context` **always** wins over the configured/P4 default; absent
  that, P4 routes every provider to `DEFAULT_AGENT_LAUNCH_SURFACE` (`'chat'`); the
  `AGENT_DEFAULT_SURFACE_SETTING_ID` setting can revert to `'terminal'`. These are pure → keep
  them exhaustively covered; they are the cheapest tests in the fork.
- `agentSessionsOpener.ts` (DI): `resolveSessionSurface` / `SessionOpenerRegistry` /
  `openSession`. Test surface resolution with fakes; the end-to-end `openSession` (needs chat
  widget service) stays an integration-style browser test.

### 2.5 Agent-aware terminal selector — `agentTabs/**` (HIGH — flagship, now well covered)

12 source modules; **7 `node:test` files** (`agentTabsSeam`, `agentTerminalActiveHighlightBridge`,
`agentTerminalHostController`, `agentTerminalSelectorModel`, `agentTerminalSelectorWidth`,
`agentTerminalSplitGroups`, `agentTerminalWebviewHost`). The June gaps are largely closed —
`agentTerminalSelectorModel.test.ts` now exercises both `mergeSelectorRows` **and**
`buildProvidedSelectorRows`. Remaining gaps, ranked:

| Module | Coverage | Gap to close |
|---|---|---|
| `agentTerminalSelectorRows.ts` | ✅ via `agentTerminalSelectorModel.test.ts` | Edge cases: both sections collapsed; id in both lists *and* duplicated within agents; `meta` pass-through unchanged. |
| `agentTerminalSplitGroups.ts` | ✅ dedicated test (AX-CODEEXT-DASHBOARD-REFLECTS-REAL-SPLITS) | Co-split mapping fidelity vs flat list — keep guarding the documented bug. |
| `agentTerminalTabbedView.ts` (`AgentTerminalTabbedView`) | ❌ **none** | DOM render (browser test): header/terminal/agent rows produce expected classes + text; model `onDidChange` re-renders; `layout` + disposal. |
| `terminalTabGroupingProviderService.ts` | ❌ **none** | Grouping/provider registration logic — node-layer mocha or `node:test` with fakes. |
| `agentTabsContribution.ts` (flag) | ⚠️ grep via `verify-seam.sh` | Keep the default-`false` grep assertion (covered). |
| `ITerminalTabsView.ts` | ✅ compile-time | Drift caught by `tsc` — no runtime test. |
| `terminalView.ts` seam | ⚠️ grep via `verify-seam.sh` | Keep grep guard; **never** unit-test upstream. |

### 2.6 Agents Window — `src/vs/sessions/**` (MEDIUM — sustain)

66 `*.test.ts` (62 `browser/`, 3 `common/`, 1 `test/web.test.ts`), **plus** a separate
`.cjs`-driven e2e harness under `src/vs/sessions/test/e2e/` (`scenarios/` + `test.cjs` + `generate.cjs`,
its own `package.json`). Already the most-tested fork area. **Most `*.test.ts` run only under
`test-browser`** (browser layer). Strategy = sustain + match the split: new **provider/schema**
logic → `common/*.test.ts` (stays in the fast `test-node` runner); new **layout/part/view** →
`browser/*.test.ts`. Respect the layer law (`sessions` may import `workbench`, never the reverse,
AX-REPO-LAYER-BOUNDARIES) — a test forcing an upward import is a design smell. The `e2e/` scenarios
run before shipping session-provider or chat-flow changes.

### 2.7 agentHost chat surface — source `chat/browser/agentSessions/**`, tests `chat/test/{common,browser}/agentSessions/**` (MEDIUM — sustain)

**23 test files: 20 under `chat/test/browser/agentSessions/`** (`agentHostAuth`,
`agentHostClientTools`, `agentHostPermissionUiContribution`, `agentHostTerminalContribution`,
`agentHostChatContribution`, `agentSessionApprovalModel`, `agentSessionViewModel`,
`localAgentSessionsController`, `agentSessionsDataSource`, `sessionTypeAvailability`, …)
**plus 3 under `chat/test/common/agentSessions/`** (`agentSessionProviderRegistration`,
`agentSessionProviderCodicons`, `agentSessionProviderRedirect`) — the latter 3 run under the
fast `test-node` runner, the other 20 only under `test-browser`. Healthy. Add a test per new
agentHost contribution or view-model, placed in the layer that matches its deps; respect
AX-REPO-CROSS-LANGUAGE-CONTRACTS for anything touching the AHP wire shape (the protocol types
are **generated — never hand-edited**, AX-REPO-VENDORED-AHP-PROTOCOL).

### 2.8 Fork tooling & perf (LOW but required — the safety nets)
- `scripts/verify-seam.sh` **is** the test for the upstream edit; it **must exit 0** in CI on every rebase (AX-TERMINAL-AGENT-TABS). A non-zero exit is a release blocker.
- `scripts/sync-upstream.sh` — smoke check it is executable and prints the next rebase target without erroring (no network assertions).
- `npm run perf:chat` / `perf:chat-leak` (`scripts/chat-simulation/`) — run before/after chat-surface changes; treat a regression vs baseline as a blocker, a leak as a hard fail.

---

## 3. Test File Organization & Naming

The harness globs depend on these — follow exactly:
- **Location:** co-locate under a `test/` subfolder beside the unit. Mirror the source layer
  (`common` / `browser` / `node` / `electron-*`) so the right harness picks it up.
- **Name & harness mapping:**
  - `src/vs/**` (workbench/platform/sessions): `<unit>.test.ts`, placed in the layer that matches its deps (`common/` → also runs in `test-node`; `browser/` → `test-browser` only).
  - `extensions/copilot/**` pure logic: **`<unit>.spec.ts`** (vitest). Extension-host behavior: `test/vscode-node/<unit>.test.ts` (vscode-test).
  - `agentTabs/**`: `<unit>.test.ts` using `node:test`, `.js` sibling imports, with a top-of-file run-command comment.
- **One suite/`describe` per file**; the name matches the unit/function under test.
- **Copyright header:** fork-authored `src/vs/**` files use the **`Copyright (c) stokd. Thin-patch fork …`** header (see `agentTabs/*`); copilot and upstream-derived files keep the **Microsoft** header (see the Grok specs).
- **Imports:** mocha/`src` tests import siblings with **`.js`**; copilot vitest specs import with **`.ts`** (vite resolves them). Don't mix within a file.
- **No new top-level test dirs.** Fork tests live under the layer they test.

---

## 4. Mock / Stub Strategy

- **Prefer pure cores over mocks.** The whole design discipline — `mergeSelectorRows`, the Grok `common/` modules, `defaultLaunchSurface`, the registry derivation helpers — exists so the hard logic needs *no* mocks. For any new fork logic, extract the decision into a pure function first, test it directly, keep the DI/IO shell thin. **This is the prescribed fix for `grokAgent.ts` (§2.1).**
- **Inject the boundary, don't stub globals.** For `GrokAgent`, make `child_process.spawn` and fs reads injectable (constructor param defaulting to the real impl) and pass a fake — never monkey-patch a global or `any`-cast a fake in (matches the CLAUDE.md learnings). Use `Emitter` from `vs/base/common/event` for fake events.
- **Fake the two terminal services by hand** for `AgentTerminalSelectorModel`: implement only the surface it touches (`ITerminalGroupService`: `instances`, `onDidChangeInstances`, `onDidChangeActiveInstance`; `ITerminalChatService`: `getToolSessionTerminalInstances`, `onDidRegisterTerminalInstanceWithToolSession`, `getToolSessionIdForInstance`, `getChatSessionResourceForInstance`, `isBackgroundTerminal`, `getAhpCommandSource`).
- **Use VS Code test utilities:** `ensureNoDisposablesAreLeakedInTestSuite()` (mandatory for any Disposable/Emitter-owning unit), `workbenchInstantiationService` / `TestInstantiationService` for DI-heavy `sessions`/`chat` tests.
- **Copilot:** vitest resolves `vscode` via the shim at `src/util/common/test/shims/vscodeTypesShim.ts` — import vscode types freely in specs; do not roll your own shim.
- **Never call real external services** — no live Anthropic/Copilot/Grok model or CLI calls, no network, no real PTYs. Stub at the module/process boundary; assert on **request/argv shape**, not model output. (Model-quality lives in the `simulate` baseline harness, not unit tests.)

---

## 5. Coverage Targets (priority: **critical** — scoped to fork-owned code)

Coverage is measured on **fork-owned files only**. Copilot: `vitest --run --coverage`. Core: `npm run test-node -- --coverage`.

| Area | Line target | Rationale |
|---|---|---|
| `agentTabs/agentTerminalSelectorRows.ts` | **100%** | Pure, branchy, trivially coverable; heart of the selector. |
| `agentTabs/*` (model, splitGroups, width, hostController, webviewHost, seam) | **≥ 90%** | All have tests; close edge gaps. |
| `agentTabs/agentTerminalTabbedView.ts` | **≥ 70%** | DOM view; cover render branches, skip Phase-3 stubs. |
| `grok/common/**` | **≥ 90%** | Pure, 7 of 8 modules spec-backed; flagship example — close the `grokPermissionModes.ts` gap to hold the line. |
| `chatSessions/common/agentCliProvider*.ts` | **≥ 90%** | Security + registry invariants protect every provider. |
| `chat/.../agentSessions/defaultLaunchSurface.ts` | **100%** | Tiny pure decision core; no excuse. |
| `platform/agentHost/node/grok/grokAgent.ts` | **≥ 70%** (post-extraction) | After moving pure logic to `common/`, the extracted core hits ≥90%; residual spawn shell ≥50%. |
| `src/vs/sessions/**` (fork logic) | **≥ 80%** | Large surface; hold, raise per new provider/part. |
| `extensions/copilot/**` (other fork glue) | **≥ 60%** | Integration-heavy; cover activation + command wiring. |
| Edited upstream lines (`terminalView.ts` seam) | **grep guard = green** | `verify-seam.sh`, not unit coverage. |
| Upstream files (everything else) | **n/a** | Out of scope by design. |

**Gating (blocks a release / merge):**
1. `scripts/verify-seam.sh` exits 0.
2. `node --import tsx --test` passes on every `agentTabs/test/*.test.ts`.
3. `cd extensions/copilot && npm run test:unit` green (Grok + registry specs).
4. `npm run test-browser` green for fork browser-layer tests (`sessions/**/browser`, `chat/.../agentSessions`), and `npm run test-node` green for fork `common/`-layer tests. **Do not assume `test-node` alone exercises sessions/chat — most are browser-layer.**
5. `npm run compile` succeeds on the current rebase target (canary for `ITerminalTabsView` / terminal-service / AHP interface drift).

---

## 6. Specific Test Cases To Implement First (ordered)

Each is a TDD **red → green** unit (AX-REPO-FORK-TDD-SCOPE: write the test, see it fail, then implement/verify; record the red→green outcome series).

1. **Extract + test `GrokAgent` NDJSON line parsing** — move per-line parse into a pure `common/` fn over `GrokStreamRecord`; vitest: well-formed record by type, malformed JSON line → skipped/no-throw, partial/empty line buffered. *(closes the #1 gap; no spawn needed)*
2. **`GrokEventNormalizer.normalize` — per-event-type coverage** — one assertion per `GROK_EVENT_TYPES` member + `flush()` after a partial turn; assert replay/stream parity.
3. **`grokSessionListing` resilience** — `parseGrokSummaryRow` over missing/empty/corrupt `summary.json`; `sortGrokRowsByRecency` tie-break; `buildGrokResumeArgs` with/without prompt.
4. **`validateSecurityDescriptor` — default-deny** — valid loopback+auth → `undefined`; non-loopback bind and unknown/missing auth scheme → specific error strings.
5. **`applyRegistryToAgentService` — enabled gate** — disabled provider is never instantiated; factory invoked exactly once per enabled descriptor.
6. **`getLaunchSurface` — DN-1 escape hatch wins** — explicit context surface overrides configured default; absent it, all providers → `'chat'`; setting reverts to `'terminal'`.
7. **`grokIsShellTool` boundary set + the missing `grokPermissionModes` spec** — every shell synonym returns `true`, near-miss names return `false`; and (the only uncovered `grok/common/` module) declared permission modes are a non-empty, unique subset of the registry's allowed set.
8. **`GrokAgent.setPendingMessages` — steering emulation** (boundary-mocked) — emits `SIGTERM` then a resume spawn with the right argv.
9. **`mergeSelectorRows` edges** — both sections collapsed; id in both lists *and* duplicated within agents; `meta` pass-through unchanged. *(no build)*
10. **`AgentTerminalTabbedView` render fidelity** (browser test) — header/terminal/agent rows → expected classes + text; model change re-renders; disposal clean.
11. **`verify-seam.sh` CI wiring** — assert it runs in CI and a deliberate flag-default flip (in a fixture copy) makes it exit non-zero. *(protects the rebase contract)*

Items 1–7 are pure/boundary-mocked and need **no full build** — land them first. 8–11 harden the spawn shell, the DOM view, and the rebase safety net.

---

## 7. Rebase-Time Test Protocol (fork-specific, non-negotiable)

On every upstream sync (`scripts/sync-upstream.sh` → rebase; see `docs/REBASE_RUNBOOK.md`):
1. `scripts/verify-seam.sh` — flag still off by default; flag-off path still builds the stock view.
2. `npm run compile` — the **only** thing that catches `ITerminalGroupService` / `ITerminalChatService` / `TerminalTabbedView` / AHP / `IAgent` interface drift (a compile error, not a silent conflict). The `ITerminalTabsView` compile-time assertion and the generated AHP types are the canaries.
3. `node --import tsx --test src/vs/workbench/contrib/terminal/browser/agentTabs/test/**` + `cd extensions/copilot && npm run test:unit` + `npm run test-browser` (fork browser tests) — confirm fork behavior survived the rebase.

If any step fails, the rebase is not complete — fix the seam, **do not weaken the test** (AX-REPO-FORK-TDD-SCOPE).
