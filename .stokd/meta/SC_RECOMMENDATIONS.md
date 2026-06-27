<!-- stokd-meta: SC_RECOMMENDATIONS.md | metaVersion 0.6.0 | generated: UPGRADE -->
# SC_RECOMMENDATIONS.md — `code-oss-dev` (stokd-ide) Actionable Recommendations

> Upgrade pass, meta version 0.6.0 (from 0.4.0). Re-verified every prior item against
> the live tree; resolved/stale items are corrected, and the work landed since the
> 0.4.0 doc (multi-provider chat surface, Grok backend, in-place re-root, the three
> open `SEAM_MANIFEST.md` gaps) is folded in. See `SC_OVERVIEW.md` (0.6.0) for the
> architecture this builds on.

## Scope & guiding principle

stokd-ide is a **thin-patch fork** of `microsoft/vscode` (`code-oss-dev` @ `1.125.0`).
The overwhelming majority of files in this tree are **upstream-owned**; touching them
fights the rebase discipline (`SEAM_MANIFEST.md`, `docs/REBASE_RUNBOOK.md`,
`AX-REPO-THIN-PATCH-FORK`) and is explicitly out of scope — such a change would not
survive the next rebase and widens the conflict surface for no fork benefit.

**Every recommendation below targets fork-owned code only:**

- `src/vs/workbench/contrib/chat/browser/agentSessions/**` — the multi-provider chat surface / provider registry *(new since 0.5.0)*
- `src/vs/workbench/contrib/terminal/browser/agentTabs/**` — the agent-tabs seam feature
- `src/vs/workbench/contrib/terminal/browser/terminalView.ts` — the sanctioned terminal seam edit
- `src/vs/sessions/**` — the Agents Window layer
- `src/vs/platform/agentHost/**` — the fork-added Agent Host platform service
- `extensions/copilot/**` — first-party `copilot-chat` extension (@ 0.53.0)
- `cli/**` — the Rust `code` binary / Agent Host supervisor
- `scripts/`, `test/`, `.github/workflows/` — fork engineering system

Recommendations that would require editing inherited upstream files **outside** a
tracked seam are intentionally excluded.

**Priorities:** **P0** = correctness/contract risk, address soon · **P1** = quality/coverage
gap · **P2** = polish / future-phase enabler.

All file/line references below were verified against the live tree at generation time.

---

## 1. Code Quality Improvements

### P1 — A `console.log` debug line ships inside the `terminalView.ts` seam
`terminalView.ts:284` contains a leftover debug print **inside the one sanctioned
upstream-edited seam file**:
```ts
console.log(`[stokd][agentTabs] _createTabsView: flagEnabled=${flagEnabled} designatedViewId=${designatedViewId ?? '(unset)'} hasResolver=${hasResolver} -> useAgentTabs=${useAgentTabs}`);
```
This is doubly bad: (1) it prints to the user's devtools console on every terminal
pane construction (and now on every config-driven rebuild), and (2) it **dirties the
seam diff** — `SEAM_MANIFEST.md` describes the terminal seam as three minimal redirects,
not debug instrumentation, so this line makes the edited-upstream surface larger and
noisier than the manifest claims. Remove it (or route it through `ILogService` at trace
level). Three more production `console.log` lines live in fork code at
`src/vs/sessions/contrib/terminal/browser/sessionsTerminalContribution.ts:554-560`
(a terminal-debug dump; the other `console.log` matches under `sessions/` are in
`src/vs/sessions/test/e2e/**`, which is fine). Add a local ESLint
`no-console` guard scoped to `agentTabs/`, the seam file, and `sessions/contrib/**` to
keep this from recurring.

> **Resolved since 0.4.0 — no longer a recommendation:** the prior doc's P0 *"flag is
> read once; toggling does nothing until reload"* is **fixed**. `terminalView.ts` now
> imports `shouldRebuildTabsView`/`shouldUseAgentTabs` (`:36`), registers an
> `onDidChangeConfiguration` listener that reacts to `TerminalAgentTabsSettingId` /
> `TerminalAgentTabsViewIdSettingId` (`:142-143`), and re-runs `_createTabsView()` on
> change (`:318`). Live toggling works; verify the rebuild path is covered by a test
> (it is exercised by `agentTabsSeam.test.ts`).

### P1 — Dead/unreachable state still advertised by the row model
`agentTerminalSelectorRows.ts:21` declares `AgentRunState = 'idle' | 'running' |
'awaiting-approval' | 'background'` and `:26` declares `pendingApprovals: number`, but
the producer (`agentTerminalSelectorModel.ts:89`) **always** returns
`pendingApprovals: 0` and **never** emits `'awaiting-approval'` — the inline comment
(`:82`) defers both to Phase 4. The type advertises a contract the producer cannot
satisfy, so a downstream consumer can branch on a state that never fires. Either
annotate the `'awaiting-approval'` union member (`// Phase 4: not yet produced`) or gate
those fields behind the phase that implements them.

### P2 — Triage the open `TODO`s in `src/vs/sessions/**`
The fork's largest surface still carries in-source TODOs, several describing **disabled
or unimplemented behavior**, not just polish — e.g. `branchChatSessionAction.ts` *throws*
`'Branching chat sessions is not yet supported.'` while hard-disabling the action, and
`sessionsTerminalContribution.ts` guards terminals by `cwd` rather than tagging 1:1 by
`sessionId` (a correctness foot-gun if two sessions share a cwd). Convert each into a
tracked task with a gating reason, or resolve it — an in-source `TODO` that throws is a
latent surprise during review.

### P2 — Keep the agentTabs list render diff-based as it grows
`agentTerminalTabbedView.ts` was substantially rewritten since 0.4.0 (it now hosts the
real terminal group + webview rather than a clear-and-rebuild list skeleton). When the
keyed-list / `WorkbenchList` migration lands, keep it **diff-based** (key rows on
`instanceId`, update in place) — the model already fires a single coalesced
`onDidChange`, so a keyed data-source is the natural fit. Capture this in the migration
issue so a clear-and-rebuild loop is not reintroduced.

---

## 2. Architecture Suggestions

### P1 — Account for the three open `SEAM_MANIFEST.md` gaps (governance, highest-leverage)
`SC_OVERVIEW.md` (0.6.0) flags three inherited-upstream edits that are **not yet recorded**
in `SEAM_MANIFEST.md`. Verified against the live tree:
1. **`terminalTabGrouping` proposed-API wiring — 5 upstream files** (`extensionsApiProposals.ts`,
   `extHost.api.impl.ts`, `extHost.protocol.ts`, `extHostTerminalService.ts`,
   `mainThreadTerminalService.ts`; commits `de405a9`, `0685ac9`). Grep confirms these files
   carry `terminalTabGrouping` edits and `SEAM_MANIFEST.md` has **zero** mentions.
2. **Editor watermark video** — `src/vs/workbench/browser/parts/editor/media/electric-loop.webm`
   (+ `editorGroupWatermark.ts`, `editorgroupview.css`; commit `53498e2`). Zero manifest mentions.
3. **User-visible string rebrand — ~52 files** (commit `809785a`, *"rebrand user-visible
   'VS Code' references to 'Stokd Code'"*). The manifest references rebranding only in
   passing (2 incidental hits); the 52-file workbench-source edit is not enumerated.

Per `AX-REPO-THIN-PATCH-FORK` these are exactly the edits the manifest exists to keep honest,
and they will be the realistic rebase conflict points. This is **documentation/accounting
debt, not architectural debt** — open one governed `SEAM_MANIFEST.md` task that adds a row
(file list + governing axiom + rebase-impact note) for each of the three.

### P1 — Promote (or explicitly scope) the two new feature axioms
The multi-provider work introduced two load-bearing invariants —
`AX-AGENT-CLI-PROVIDER-REGISTRY` (DN-9: adding a provider is *descriptor + adapter +
`package.json`*, never a new upstream `case`) and `AX-STOKDIDE-SWITCH-ROOT-NO-RELOAD`
(in-place re-root must not reload the window). Both are declared only in `SEAM_MANIFEST.md`
/ feature docs — **zero references in `.stokd/meta/SC_AXIOMS.md`**. Now that the provider
registry is a first-class fork capability (chat is the default launch surface), its
invariant deserves a repo-wide axiom with an executable Acceptance Check (e.g. a golden
snapshot proving descriptors resolve byte-identically — `agentSessionProviderRedirect.test.ts`
already does this and can be the check). Either promote both into `SC_AXIOMS.md` or record
in that file *why* they intentionally stay feature-local.

### P1 — Make the agentTabs "single consumer" invariant enforceable, not convention-only
`agentTerminalSelectorModel.ts` is documented as the **sole** consumer of
`ITerminalChatService` / `ITerminalGroupService` within `agentTabs/`, which is the fork's
core defense against upstream interface drift. Nothing *enforces* that a future file in
`agentTabs/` won't import those services directly and widen the blast radius. Add a guard —
a `.eslint-plugin-local/` rule or a grep step in `scripts/verify-seam.sh` — asserting those
two service symbols are imported **only** by `agentTerminalSelectorModel.ts` within
`agentTabs/`. The same pattern applies to the chat surface: `agentSessions.ts` should remain
the only file whose `default` branches reach `agentSessionProviderRegistry`.

### P1 — Confirm the `sessions`-above-`workbench` layer rule is actually asserted
`AX-REPO-LAYER-BOUNDARIES` and `src/vs/sessions/LAYERS.md` state `sessions` may import from
`workbench` but never the reverse. `npm run valid-layers-check` enforces the
`base→platform→editor→workbench` chain; **confirm it also covers** the
`sessions`-above-`workbench` rule. With the `sessions/` surface this large, an accidental
`workbench → sessions` import is too big a surface to police by review alone — if the check
doesn't cover it, add a `tsconfig`-based layer assertion so it fails fast.

### P2 — `src/vs/platform/agentHost/**` is a large fork-added service with thin repo-wide invariants
The Agent Host service is the second-largest fork surface after `sessions/`. It now ships a
design log (`DESIGN-DECISIONS.md`, `DN-2…DN-9`) and an `OTEL.md`, but only the
`AgentHostMetadata` schema and the vendored protocol have repo-wide governing axioms
(`AX-REPO-CROSS-LANGUAGE-CONTRACTS`, `AX-REPO-VENDORED-AHP-PROTOCOL`). Recommend an
`.axioms.md` (or `SC_MODULE.md`) for `platform/agentHost/` recording the service's own
invariants — especially the network/credential trust boundaries (`sshRemoteAgentHostService.ts`,
`tunnelAgentHostService.ts`, `relayTransport.ts`, `webSocketTransport.ts`; see §5).

---

## 3. Missing Tests

### P0 — Seam guards do NOT run on pull requests (still open)
**Highest-leverage gap, confirmed still present.** `scripts/verify-seam.sh` and the agentTabs
unit test are wired **only** into `.github/workflows/upstream-sync.yml` (a `schedule` /
`workflow_dispatch` job, lines 65 + 76). Nine workflows trigger on `pull_request`
(`pr.yml`, `sessions-e2e.yml`, `api-proposal-version-check.yml`, …) and **none** reference
`verify-seam`, `agentTabs`, or `agentSession`. A feature PR that breaks the thin-patch
contract or the provider-redirect equivalence passes PR CI and is only caught up to a week
later during the scheduled rebase.

**Fix:** add a `pull_request`-triggered step (new `seam-guard.yml`, or a step in `pr.yml`)
that runs:
```bash
bash scripts/verify-seam.sh
node --test out/vs/workbench/contrib/terminal/browser/agentTabs/test/*.test.js
node --test out/vs/workbench/contrib/chat/test/common/agentSessions/agentSessionProviderRedirect.test.js
npm run compile-check-ts-native   # so the ITerminalTabsView structural canary actually compiles
```
The `agentSessionProviderRedirect.test.ts` golden test is the protection for the
multi-provider seam (it proves Claude/Copilot/Codex descriptors resolve byte-identically to
the old inline switch) — it belongs in PR CI alongside the terminal seam guard. The
`compile-check-ts-native` line matters: the compile-time assertion in
`agentTabs/ITerminalTabsView.ts` only fires under a real `tsgo` compile.

### P1 — `grokAgent.ts` (~930 LOC) has zero tests
The Grok node adapter (`src/vs/platform/agentHost/node/grok/grokAgent.ts`, ~29 KB, landed
commit `d88c67b`) is the newest and most parsing-heavy fork backend: it maps
`grok … --output-format streaming-json` **NDJSON stdout** to protocol `SessionAction`s,
emulates steering via **SIGTERM + resume**, and lists sessions by walking
`~/.grok/sessions/<encodeURIComponent(cwd)>/<uuid>/summary.json`. A grep across
`platform/agentHost/test/**` returns **zero** files naming or referencing `grok`/`grokAgent`,
and there is no co-located test (the 54 Grok tests in `extensions/copilot/src/extension/chatSessions/grok`
cover the *extension chatSession* integration, **not** the node-side agent). By contrast the
Codex backend ships `test/node/codex/`. Per `AX-REPO-FORK-TDD-SCOPE` this fork behavioral code
needs red→green tests. Add DOM-free node tests for: NDJSON line → `SessionAction` mapping
(including partial/malformed lines), the SIGTERM-then-resume steering path, and the
`summary.json` discovery walk. Factor the pure NDJSON→action mapping out of the spawn plumbing
so it tests with no child process.

### P1 — Test the `_agentMeta` derivation, not just the merge
`agentTerminalSelectorModel.test.ts` (now ~7 KB) exercises `mergeSelectorRows` and constructs
`meta` fixtures, but the **derivation** in `agentTerminalSelectorModel.ts:57-89` — the
`sessionTitle` fallback chain and the `idle`/`running`/`background` `runState` selection — is
the stateful logic most likely to silently regress when upstream `ITerminalChatService` /
`ITerminalGroupService` interfaces drift on rebase, and it is the path the fixtures *skip*.
Best fix: factor the title/run-state derivation into a pure helper in
`agentTerminalSelectorRows.ts` so it tests with **no** service mock (mirroring how
`mergeSelectorRows` was extracted). Wrap the model test in
`ensureNoDisposablesAreLeakedInTestSuite()` — it registers three listeners + an emitter.

### P2 — `webSocketTransport.ts` (remote-host transport) has no test
The remote-hosting paths are now well covered: SSH ships **5** test files
(`test/common/sshConfigParsing.test.ts`, `test/electron-browser/sshRelayTransport.test.ts`
+ `sshRemoteAgentHostService.test.ts`, `test/node/sshRemoteAgentHostService.test.ts` +
`sshRemoteAgentHostHelpers.test.ts`), tunnel (`tunnelAgentHostService.test.ts`) and WSL
(`wslRemoteAgentHostHelpers.test.ts`) one each, and the relay layer is exercised by
`sshRelayTransport.test.ts`. The one transport with **zero** coverage is
`src/vs/platform/agentHost/common/webSocketTransport.ts` — the socket layer those hosts
ride. Add a focused test for frame/parse handling and disconnect behavior; see §5 for the
security angle.

### P2 — `policyBlocked` trust contribution has no test
`src/vs/sessions/contrib/policyBlocked/browser/policyBlocked.contribution.ts` is a trust/policy
surface with **no `*.test.ts`** (by contrast `services/agentHostFilter/` ships
`test/browser/agentHostFilterService.test.ts`). Add a focused test asserting blocked policies
fail **closed** (§5-P1).

---

## 4. Documentation

### P2 — Document the agentTabs flag's deprecated, opt-in status for users
The experimental flag `terminal.integrated.agentTabs.enabled` is now default-off and
**deprecated in favor of the chat surface** (`chat.agentSessions.defaultSurface`). Confirm the
flag's `markdownDeprecationMessage` (in `agentTabsContribution.ts`) points users at the chat
surface and states that the terminal selector is reached only via the explicit *Open in
Terminal* escape hatch, so the setting's lifecycle is self-documenting.

### P2 — Replace line-number anchors in `SEAM_MANIFEST.md` with symbol anchors
The manifest cites approximate line numbers that drift on every edit (the terminal seam has
already moved — `_createTabsView()` is now `terminalView.ts:263`, the `createInstance` branch
`:292`, the field/getter `:65-66`). Reference changes by **symbol** (`_terminalTabbedView`
field, `_createTabsView()` method) since the runbook asks maintainers to re-verify each row on
every rebase. Apply the same when adding rows for the three §2-P1 gaps.

### P2 — Add a module doc / `.axioms.md` for `platform/agentHost/`
See §2-P2 — this large fork-added service has design-decision and OTEL docs but no dedicated
module `.axioms.md`/`SC_MODULE.md`, leaving its internal contracts (transport, SSH/WSL/tunnel
hosts, checkpoint service, session database) without an executable-invariant home.

---

## 5. Security Considerations

### P1 — Verify `agentHostFilter` and `policyBlocked` are fail-closed at every entry point
`src/vs/sessions/services/agentHostFilter/` and `contrib/policyBlocked/` are the fork's actual
trust seams between session providers (local CLI, copilot, agent host, remote agent host).
`agentHostFilter` has a test; `policyBlocked` does **not** (§3-P2). Recommend a focused
review + test pass confirming the filter is applied on **every** provider entry point (not
just the default) and that both surfaces **fail closed** — a policy/filter error must deny,
never default-allow. With the provider registry now resolving many backends through one
`default` branch, "every entry point" includes each registered descriptor.

### P1 — Audit the network/credential trust boundaries in `platform/agentHost/` (coverage exists; confirm fail-closed)
`platform/agentHost/node/` brokers the agent-host connection over SSH/WSL/dev-tunnels
(`sshRemoteAgentHostService.ts`, `wslRemoteAgentHostService.ts`, `tunnelAgentHostService.ts`,
`relayTransport.ts`, `webSocketTransport.ts`), parses user SSH config
(`sshRemoteAgentHostHelpers.ts`), and — with the Rust side (`cli/src/auth.rs` keyring,
`AgentHostMetadata` lockfile) — is where remote trust is established. Unlike the 0.4.0 doc's
assumption, these now have **substantial** coverage (ssh ×5 incl. a dedicated
`sshConfigParsing.test.ts`, tunnel/wsl ×1 each, relay via `sshRelayTransport.test.ts`); the
sole untested transport is `webSocketTransport.ts` (§3-P2). Recommend a review confirming:
`sshConfigParsing.test.ts` actually exercises malformed/injection input (not just the happy
path) so config parsing can never mis-route; tunnel/relay/websocket transport validates
the peer; and the `AgentHostMetadata` lockfile (cross-language contract,
`AGENT_HOST_METADATA_SCHEMA_VERSION = 1`) is integrity-checked on read. These are higher-risk
than any UI surface.

### P1 — Keep agent-influenced strings escaped, and make it enforceable
Agent/session titles and tool output are **attacker-influenceable** (a session title derives
from `resource.path` / tool output) and are rendered by both the agentTabs view and the chat
surface (`chat/browser/agentSessions/`, which renders agent-authored content). Today these
paths use `textContent` / safe rendering, but that is **incidental, not enforced**. Add a local
ESLint `no-inner-html`-style guard scoped to `agentTabs/` **and**
`workbench/contrib/chat/browser/agentSessions/` so a future renderer can never switch to
`innerHTML` or an unescaped templating path. (Pairs with the `no-console` guard in §1-P1.)

### P2 — Confirm AI SDK calls never leak credentials/telemetry from `extensions/copilot/`
`copilot-chat` integrates `@anthropic-ai/sdk` / `@github/copilot-sdk` (and the fork shells out
to the xAI Grok CLI) and exposes many tools. Recommend a review confirming tool inputs/outputs
and any 1DS telemetry do not include secrets or full file contents beyond what the user
authorized, and that tests mock the SDKs at the module boundary (never a live model call —
`SC_TEST.md` §4). Extend the same check to the Grok shell-out (`grokAgent.ts`): the spawned
command line and its NDJSON output must not be logged with secrets.

---

## 6. Performance Opportunities

### P2 — Coalesce model recomputes (1 full recompute per upstream event)
`agentTerminalSelectorModel.ts` subscribes several upstream events, each calling `_recompute()`
synchronously, which re-runs `mergeSelectorRows` over **all** instances and re-derives
`_agentMeta` for every agent. During bursts (opening several terminals, an agent registering
multiple sessions) this is O(events × instances). Debounce `_recompute` onto a
microtask/animation-frame so a burst collapses into one recompute + one render. Low risk — the
rows function is pure and idempotent — and a measurable win once the keyed list widget lands.

### P2 — The 5.7 MB `electric-loop.webm` bloats every clone and rebase
`src/vs/workbench/browser/parts/editor/media/electric-loop.webm` is a **5.7 MB binary** committed
into an inherited-upstream media directory (commit `53498e2`). Beyond the §2-P1 accounting gap,
this is a concrete cost: it inflates every `git clone`/fetch and history operation, and a binary
in upstream's media tree is a guaranteed rebase-friction point. Recommend (a) re-encoding to a
much smaller/looped clip or a lighter format, (b) lazy-loading it so it never blocks watermark
render, and (c) if it must stay large, hosting it outside the source tree (or via Git LFS) rather
than in upstream's `parts/editor/media/`.

---

## Quick-win checklist (do these first)

1. **[P0]** Add a `pull_request`-triggered seam guard running `verify-seam.sh` + the agentTabs
   tests + the `agentSessionProviderRedirect` golden test + `compile-check-ts-native` (§3-P0).
   Single highest-value change — closes the week-long detection gap and now also guards the
   provider seam.
2. **[P1]** Open one governed `SEAM_MANIFEST.md` task adding rows for the three unaccounted
   upstream edits: `terminalTabGrouping` wiring (5 files), `electric-loop.webm`, the 52-file
   rebrand (§2-P1).
3. **[P1]** Remove the `console.log` at `terminalView.ts:284` and add a local `no-console`
   lint guard over the seam + `agentTabs/` + `sessions/contrib/**` (§1-P1).
4. **[P1]** Add node tests for `grokAgent.ts` (NDJSON→action mapping, SIGTERM+resume,
   `summary.json` discovery) — factor the pure mapper out first (§3-P1).
5. **[P1]** Promote `AX-AGENT-CLI-PROVIDER-REGISTRY` / `AX-STOKDIDE-SWITCH-ROOT-NO-RELOAD` into
   `SC_AXIOMS.md` (or record why they stay feature-local), using the redirect golden test as the
   Acceptance Check (§2-P1).
6. **[P1]** Confirm `policyBlocked` / `agentHostFilter` fail closed and add the missing
   `policyBlocked` test (§5-P1, §3-P2).
7. **[P2]** Replace line-number anchors in `SEAM_MANIFEST.md` with symbol anchors (§4-P2).

---

*Upgraded (0.4.0 → 0.6.0) from direct analysis of `terminalView.ts`, the `agentTabs/` tree,
`src/vs/workbench/contrib/chat/browser/agentSessions/` (+ its `test/` dir),
`src/vs/platform/agentHost/` (incl. `node/grok/grokAgent.ts` and `test/node/`),
`extensions/copilot/`, `.github/workflows/`, `SEAM_MANIFEST.md`, `git` history (PRs #3/#4/#5),
and the companion `.stokd/meta/` documents (esp. `SC_OVERVIEW.md` 0.6.0). Resolved/stale items
from 0.4.0 are corrected (the flag-read-once P0 is fixed; `agentTerminalTabbedView.ts` was
rewritten; SSH/relay boundaries now have tests). Re-verified against the live tree at HEAD
`d88c67b` for the 0.5.0 → 0.6.0 pass: every cited fact (the `console.log` at
`terminalView.ts:284`, the 5.7 MB `electric-loop.webm`, grok zero node-tests, no
`pull_request` seam guard, the three open `SEAM_MANIFEST.md` gaps, `policyBlocked` having no
test) still holds; corrected three drifts — the sessions-contribution debug print is now
three lines (`sessionsTerminalContribution.ts:554-560`, not one), SSH/transport coverage is
richer than previously stated (5 ssh test files incl. `sshConfigParsing.test.ts`; only
`webSocketTransport.ts` is untested), and the seam's `createInstance` branch moved to
`terminalView.ts:292`. Before acting on any item that touches inherited upstream code, re-read
`SEAM_MANIFEST.md` — only listed seams may edit upstream files; everything else must be a new
file under a fork-owned path. Meta version 0.6.0.*
