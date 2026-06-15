<!-- stokd-meta: SC_RECOMMENDATIONS.md | metaVersion 0.4.0 | generated: FRESH -->
# SC_RECOMMENDATIONS.md — `code-oss-dev` (stokd-ide) Actionable Recommendations

## Scope & guiding principle

stokd-ide is a **thin-patch fork** of `microsoft/vscode` (`code-oss-dev` @ `1.125.0`).
The overwhelming majority of files in this tree are **upstream-owned**; touching them
fights the rebase discipline (`SEAM_MANIFEST.md`, `docs/REBASE_RUNBOOK.md`,
`AX-REPO-THIN-PATCH-FORK`) and is explicitly out of scope — such a change would not
survive the next rebase and widens the conflict surface for no fork benefit.

**Every recommendation below targets fork-owned code only:**

- `src/vs/workbench/contrib/terminal/browser/agentTabs/**` — the agent-tabs seam feature
- `src/vs/workbench/contrib/terminal/browser/terminalView.ts` — the one sanctioned seam edit
- `src/vs/sessions/**` — the Agents Window layer (354 `.ts` files, 65 `*.test.ts`)
- `src/vs/platform/agentHost/**` — the fork-added Agent Host platform service
- `extensions/copilot/**` — first-party `copilot-chat` extension (@ 0.53.0)
- `cli/**` — the Rust `code` binary / Agent Host supervisor
- `scripts/`, `test/`, `.github/workflows/` — fork engineering system

Recommendations that would require editing inherited upstream files **outside** the
seam are intentionally excluded.

**Priorities:** **P0** = correctness/contract risk, address soon · **P1** = quality/coverage
gap · **P2** = polish / future-phase enabler.

All file/line references below were verified against the live tree at generation time.

---

## 1. Code Quality Improvements

### P0 — Agent-tabs flag is read once; toggling it silently does nothing until reload
`terminalView.ts:245` reads `terminal.integrated.agentTabs.enabled` exactly once, inside
`_createTabsView()` at pane construction:
```ts
const useAgentTabs = this._configurationService.getValue<boolean>(TerminalAgentTabsSettingId) === true;
this._terminalTabbedView = this._register(useAgentTabs
    ? this.instantiationService.createInstance(AgentTerminalTabbedView, this._parentDomElement)
    : this.instantiationService.createInstance(TerminalTabbedView, this._parentDomElement));
```
The two existing `onDidChangeConfiguration` listeners in the file (`terminalView.ts:125`
and `:208`) watch **other** settings — neither reacts to `TerminalAgentTabsSettingId`.
Consequence: a user who flips the experimental setting sees **no change until a full window
reload**, with no UI affordance telling them a reload is required.

Recommended fix (lowest blast radius inside the seam file):
- In `agentTabs/agentTabsContribution.ts:32`, append a *"requires reload"* note to the
  `markdownDescription`, and register the setting so VS Code surfaces its standard
  restart/reload hint for reload-required settings.
- Only add a live config listener in `terminalView.ts` (dispose `_terminalTabbedView` +
  re-run `_createTabsView()` on change) if live toggling is a real requirement — that
  enlarges the edited-upstream seam and must be reflected in `SEAM_MANIFEST.md`.

### P1 — `_agentMeta` is the only stateful logic in agentTabs and has zero test coverage
`agentTerminalSelectorModel.ts:57-72` derives the agent row metadata: the `sessionTitle`
fallback chain (`resource.path basename → instance.title → 'Agent'`, line 61) and the
`runState` derivation (`background` / `running` / `idle` via `getAhpCommandSource`, lines
66-69). The existing unit test (`agentTabs/test/agentTerminalSelectorModel.test.ts`,
4.4 KB) exercises **only** the pure `mergeSelectorRows` function — `_agentMeta` and the
three-event fan-in (`agentTerminalSelectorModel.ts:40-42`) have **no coverage**. This is the
most likely place for a silent regression when upstream `ITerminalChatService` /
`ITerminalGroupService` interfaces drift on rebase. See §3-P1 for the test to add.

### P1 — Dead/unreachable states advertised by the row model
`agentTerminalSelectorRows.ts` declares `AgentRunState` including `'awaiting-approval'` and
`IAgentRowMeta.pendingApprovals`, but `_agentMeta` **always** sets `pendingApprovals: 0` and
**never** produces `'awaiting-approval'` (`agentTerminalSelectorModel.ts:71`). The code
comments this as Phase-4 work (`agentTerminalSelectorModel.ts:63-65`), which is fine, but the
type currently advertises a contract the producer cannot satisfy. Either annotate the
`'awaiting-approval'` union member (`// Phase 4: not yet produced`) or gate those fields
behind the phase that implements them, so a downstream consumer can't branch on a state
that never fires.

### P2 — Full DOM teardown on every model change
`agentTerminalTabbedView.ts:41` calls `dom.clearNode(this._listContainer)` and rebuilds the
entire list on every `onDidChange`. Acceptable for the Phase-2 skeleton, but the planned
Phase-3 `WorkbenchList` migration should be **diff-based** (key rows on `instanceId`, update
in place). The model already fires a single coalesced `onDidChange`, so a keyed list
data-source is the natural fit. Capture this in the Phase-3 issue so the clear-and-rebuild
loop isn't carried forward.

### P2 — Triage the 8 open `TODO`s in `src/vs/sessions/**`
The fork's largest surface carries 8 in-source TODOs, several of which describe **disabled
or unimplemented behavior**, not just polish:
- `contrib/chat/browser/branchChatSessionAction.ts:108` — *throws* `'Branching chat sessions
  is not yet supported.'`; line 52 hard-disables the action via `ContextKeyExpr.false()`.
- `sessions.web.main.ts:190` — `// TODO: support agent feedback in web` (feature gap on the web surface).
- `contrib/terminal/browser/sessionsTerminalContribution.ts:218` — terminals are guarded by
  `cwd` rather than tagged 1:1 by `sessionId` (correctness foot-gun if two sessions share a cwd).
- Two `eslint-disable local/code-import-patterns` TODOs (`sessionWorkspacePicker.ts:37`,
  `changesView.ts:69`) mark layering shortcuts that should be resolved rather than left to rot.

Recommend converting each into a tracked task with a gating reason, or resolving them — an
in-source `TODO` that throws is a latent surprise during review.

---

## 2. Architecture Suggestions

### P1 — Make the agentTabs "single consumer" invariant enforceable, not convention-only
The fork's core defense against upstream interface drift is that
`agentTerminalSelectorModel.ts` is the **sole** consumer of `ITerminalChatService` /
`ITerminalGroupService` inside `agentTabs/` (documented in the class header,
`agentTerminalSelectorModel.ts:14-19`). Nothing currently *enforces* that a future file in
`agentTabs/` won't import those services directly and widen the blast radius. Add a guard —
a `.eslint-plugin-local/` rule or a grep step in `scripts/verify-seam.sh` — asserting those
two service symbols are imported **only** by `agentTerminalSelectorModel.ts` within
`agentTabs/`. Turns a written invariant into a CI-checked one.

### P1 — Confirm the `sessions`-above-`workbench` layer rule is actually asserted
`AX-REPO-LAYER-BOUNDARIES` and `src/vs/sessions/LAYERS.md` state `sessions` may import from
`workbench` but never the reverse. `npm run valid-layers-check` enforces the
`base→platform→editor→workbench` chain; **confirm it also covers** the
`sessions`-above-`workbench` rule. With 354 TS files in `sessions/`, an accidental
`workbench → sessions` import is too large a surface to police by review alone — if the
check doesn't cover it, add a `tsconfig`-based layer assertion so it fails fast.

### P2 — `src/vs/platform/agentHost/**` is a large fork-added service with thin documented invariants
The Agent Host platform service is ~50 `common/` modules plus `node/`, `otel/`, `otlp/`,
and the vendored `state/protocol/` tree — by file count the second-largest fork surface
after `sessions/`. Only the `AgentHostMetadata` schema and the vendored protocol have
governing axioms (`AX-REPO-CROSS-LANGUAGE-CONTRACTS`, `AX-REPO-VENDORED-AHP-PROTOCOL`).
Recommend an `.axioms.md` (or a `SC_MODULE.md`) for `platform/agentHost/` that records the
service's own invariants — especially around `relayTransport.ts`, `sshConfigParsing.ts`,
and `sshRemoteAgentHost.ts`, which are the network/credential trust boundaries (see §5).

---

## 3. Missing Tests

### P0 — Seam guard + agentTabs unit test do NOT run on pull requests
**Highest-leverage gap.** `scripts/verify-seam.sh` and the agentTabs unit test are wired
**only** into `.github/workflows/upstream-sync.yml` (a `schedule` / `workflow_dispatch`
job). A grep across `.github/workflows/` confirms **no other workflow references
`verify-seam`, `agentTerminalSelector`, or `agentTabs`** — not `pr.yml`, nor the
`pr-{linux,darwin,win32}-test.yml` / `pr-linux-cli-test.yml` matrices. A feature PR that
breaks the thin-patch contract or the merge logic passes PR CI and is only caught up to a
week later during the scheduled rebase.

**Fix:** add a lightweight `pull_request`-triggered step (new `seam-guard.yml`, or a step in
`pr.yml`) that runs:
```bash
bash scripts/verify-seam.sh
node --test src/vs/workbench/contrib/terminal/browser/agentTabs/test/agentTerminalSelectorModel.test.ts
npm run compile-check-ts-native   # so the ITerminalTabsView structural canary actually compiles
```
The third line matters: the compile-time assertion in `agentTabs/ITerminalTabsView.ts`
(stock view structurally satisfies the seam interface) only fires under a real `tsgo`
compile — without it in PR CI, interface drift is invisible until the scheduled job.

### P1 — Add a DOM-free unit test for `_agentMeta`
Lock in the title fallback order and `background` / `running` / `idle` derivation
(`agentTerminalSelectorModel.ts:57-72`) using hand-rolled fakes for `ITerminalGroupService`
+ `ITerminalChatService` (per `SC_TEST.md` §4 the mock surface is already enumerated). Write
it **red first**. Best option: factor the title/run-state derivation into a pure helper in
`agentTerminalSelectorRows.ts` so it tests with **no** service mock — mirroring how
`mergeSelectorRows` was extracted to be testable. Wrap the model test in
`ensureNoDisposablesAreLeakedInTestSuite()` (it registers 3 listeners + an emitter).

### P1 — No rendering test for `AgentTerminalTabbedView`
`agentTerminalTabbedView.ts` has zero tests. Add a `test-browser` (jsdom/Playwright) test
asserting: section headers render `"<section> (<count>)"` (line 46), terminal rows use
`instance.title` fallback (line 51), agent rows render `"<sessionTitle> [<runState>]"`
(line 56), and an `onDidChange` from the model triggers re-render. Catches regressions the
pure-logic tests can't.

### P2 — Extend `mergeSelectorRows` edge cases (cheap, no build)
Per `SC_TEST.md` §6, add the still-missing pure cases: `collapsed: { agents: true }`; **both**
sections collapsed; an id in **both** lists *and* duplicated *within* the agents list; input
order preserved within a section; `meta` passed through unchanged. These run under
`node --test` with no build and should land immediately.

### P2 — `policyBlocked` trust contribution has no test
`src/vs/sessions/contrib/policyBlocked/browser/policyBlocked.contribution.ts` is a
trust/policy surface with **no `*.test.ts`** (by contrast `services/agentHostFilter/` already
ships `test/browser/agentHostFilterService.test.ts`). Add a focused test asserting blocked
policies fail **closed**. See §5-P1.

---

## 4. Documentation

### P2 — Document the "flag change requires reload" behavior for users
Whichever path is chosen for §1-P0, the experimental setting's `markdownDescription`
(`agentTabsContribution.ts:32`) should state the reload requirement explicitly. The current
text describes *what* the flag does but not the *reload* caveat.

### P2 — Replace line-number anchors in `SEAM_MANIFEST.md` with symbol anchors
`SEAM_MANIFEST.md` cites approximate line numbers that have already drifted from the live
file (the `createInstance` branch is now `terminalView.ts:245-248`; the field/getter are at
`:63-64`). The manifest's *contract* (3 changes, 1 file) is correct, but line hints rot.
Reference the changes by **symbol** (`_terminalTabbedView` field, `_createTabsView()` method)
since the runbook asks maintainers to re-verify each row on every rebase.

### P2 — Add a module doc / `.axioms.md` for `platform/agentHost/`
See §2-P2 — this large fork-added service has no dedicated `SC_MODULE.md`, leaving its
internal contracts (transport, SSH/WSL/tunnel hosts, checkpoint service) undocumented for
maintainers.

---

## 5. Security Considerations

### P1 — Verify `agentHostFilter` and `policyBlocked` are fail-closed at every entry point
`src/vs/sessions/services/agentHostFilter/` and `contrib/policyBlocked/` are the fork's
actual trust seams between session providers (local CLI, cloud, remote agent host).
`agentHostFilter` has a test (`test/browser/agentHostFilterService.test.ts`); `policyBlocked`
does **not** (§3-P2). Recommend a focused review + test pass confirming the filter is applied
on **every** provider entry point (not just the default) and that both surfaces **fail
closed** — a policy/filter error must deny, never default-allow. These deserve dedicated
coverage in `sessions/test/`.

### P1 — Audit the network/credential trust boundaries in `platform/agentHost/`
`platform/agentHost/common/` contains `sshConfigParsing.ts`, `sshRemoteAgentHost.ts`,
`wslRemoteAgentHost.ts`, `tunnelAgentHost.ts`, and `relayTransport.ts` — the code that parses
user SSH config and brokers the agent-host connection over SSH/WSL/dev-tunnels. Combined with
the Rust side (`cli/src/auth.rs` keyring, `AgentHostMetadata` lockfile), this is where remote
trust is established. Recommend a focused review confirming: SSH config parsing rejects
malformed/injection input rather than mis-routing; tunnel/relay transport validates the peer;
and the `AgentHostMetadata` lockfile (cross-language contract,
`AGENT_HOST_METADATA_SCHEMA_VERSION = 1`) is integrity-checked on read. These are higher-risk
than the agentTabs UI surface and currently under-documented (§2-P2).

### P1 — Keep agent-influenced strings on `textContent`; make it enforceable
`agentTerminalTabbedView.ts` correctly uses `textContent` (lines 46, 51, 56) for agent /
terminal / session titles, which are **attacker-influenceable** (a session title derives from
`resource.path` / tool output). This is safe today but **incidental, not enforced**. When the
Phase-3 real renderer lands it must never switch these to `innerHTML` or an unescaped
templating path. Add a local ESLint `no-inner-html`-style guard scoped to `agentTabs/`
(and ideally `sessions/contrib/chat/`, which renders agent-authored content) so the safety is
guaranteed, not reviewed-for each time.

### P2 — Confirm AI SDK calls never leak credentials/telemetry from `extensions/copilot/`
`copilot-chat` integrates `@anthropic-ai/sdk` / `@github/copilot-sdk` and exposes many tools
(`copilot_searchCodebase`, `execution_subagent`, `copilot_findFiles`, … per
`extensions/copilot/package.json`). Recommend a review confirming tool inputs/outputs and any
1DS telemetry do not include secrets or full file contents beyond what the user authorized,
and that tests mock the SDKs at the module boundary (never a live model call — `SC_TEST.md` §4).

---

## 6. Performance Opportunities

### P2 — Coalesce model recomputes (currently 1 full recompute per upstream event)
`agentTerminalSelectorModel.ts:40-42` subscribes three upstream events
(`onDidChangeInstances`, `onDidChangeActiveInstance`,
`onDidRegisterTerminalInstanceWithToolSession`), each calling `_recompute()` synchronously,
which re-runs `mergeSelectorRows` over **all** instances, re-derives `_agentMeta` for every
agent, and fires `onDidChange` (→ full DOM rebuild, §1-P2). During bursts (opening several
terminals, an agent registering multiple sessions) this is O(events × instances). Debounce
`_recompute` onto a microtask/animation-frame so a burst collapses into one recompute + one
render. Low risk — the rows function is pure and idempotent — and a measurable win once the
real list widget lands.

### P2 — `mergeSelectorRows` rebuilds Sets + row array each call — fine now, watch at scale
`agentTerminalSelectorRows.ts` rebuilds `Set`s and the row array on every recompute.
Negligible for realistic terminal counts; revisit only if the Agents section is expected to
hold large numbers of background sessions. Pair with the debounce above rather than
micro-optimizing the function in isolation.

---

## Quick-win checklist (do these first)

1. **[P0]** Add a `pull_request`-triggered seam guard running `verify-seam.sh` + the agentTabs
   unit test + `compile-check-ts-native` (§3-P0). Single highest-value change — closes the
   week-long detection gap.
2. **[P0]** Make the agent-tabs flag's reload requirement explicit, or add live re-creation (§1-P0).
3. **[P1]** Add `_agentMeta` coverage, ideally by extracting a pure title/run-state helper (§3-P1).
4. **[P1]** Add a local lint/grep guard that `ITerminalChatService` & `ITerminalGroupService`
   are imported only by `agentTerminalSelectorModel.ts` within `agentTabs/` (§2-P1).
5. **[P1]** Confirm `policyBlocked` / `agentHostFilter` fail closed and add the missing
   `policyBlocked` test (§5-P1, §3-P2).
6. **[P2]** Replace line-number anchors in `SEAM_MANIFEST.md` with symbol anchors (§4-P2).

---

*Generated fresh from direct analysis of `terminalView.ts`, the `agentTabs/` tree,
`src/vs/sessions/**`, `src/vs/platform/agentHost/**`, `extensions/copilot/package.json`,
`.github/workflows/`, and the companion `.stokd/meta/` documents. All references verified
against the live tree. Before acting on any item that touches
`src/vs/workbench/contrib/terminal/`, re-read `SEAM_MANIFEST.md` — only the listed seam may
edit upstream files; everything else must be a new file under `agentTabs/`. Meta version 0.4.0.*
</content>
</invoke>
