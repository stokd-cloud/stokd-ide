# Seam manifest — agent-aware terminal selector

> The honest, checked-in accounting of **every upstream line this fork touches.**
> Governing contract: **AX-TERMINAL-AGENT-TABS**. On every rebase, re-apply and
> re-verify each row below; nothing outside this list may edit an upstream file.
> See [`docs/REBASE_RUNBOOK.md`](docs/REBASE_RUNBOOK.md) and the source plan
> `agent-terminal-selector-implementation-plan.md`.

Base: upstream `microsoft/vscode` `main` (synced; pin to a release tag such as
`1.124.2` for the patch stack — see the runbook).

---

## Upstream files edited: **1**

### `src/vs/workbench/contrib/terminal/browser/terminalView.ts`  (~10 insertions, 3 deletions)

| # | Location | Change | Why |
|---|---|---|---|
| 1 | after the `TerminalTabbedView` import (line ~31) | add 3 imports: `ITerminalTabsView`, `AgentTerminalTabbedView`, `TerminalAgentTabsSettingId` (all from `./agentTabs/…`) | bring the seam interface, the alternate view, and the flag id into scope |
| 2 | field + public getter `_terminalTabbedView` / `terminalTabbedView` (lines ~59–60) | retype `TerminalTabbedView` → `ITerminalTabsView` | let the pane hold *either* view; the public getter's only external consumers (`terminalGroupService.ts`, `terminalEditingService.ts`) call `focusTabs()`, `focusHover()`, `setEditable()` — all covered by the interface |
| 3 | `_createTabsView()` `createInstance` call (line ~241) | branch on `terminal.integrated.agentTabs.enabled`: flag-on → `AgentTerminalTabbedView`, flag-off → stock `TerminalTabbedView` | the actual swap; flag-off path is byte-identical to upstream |

**Rebase risk:** low–med. `terminalView.ts` changes occasionally, but the three
edits are localized and the flag is a fallback. This is the only commit that can
conflict on rebase (the "seam" commit).

### Why no second upstream edit (no barrel import)

The plan budgeted for an optional one-line import in a contribution barrel to pull
the self-registering flag into the module graph. It proved unnecessary:
`terminal.contribution.ts` already statically imports `TerminalViewPane`
(`terminalView.js`), which now statically imports `agentTabsContribution.js` for
the flag id — so the configuration registers eagerly at workbench startup through
the existing import chain. Upstream footprint is therefore a **single file**.

---

## Fork-identity seams (rebrand + flat data folder)

Separate concern from the agent-tabs feature, but still upstream edits that must be
re-applied on every rebase.

### `product.json` — rebrand Code - OSS → Stokd Code
Config, not churning code: product names, application/data/tunnel/server names,
win32 reg/mutex/dir ids + regenerated AppId GUIDs, `darwinBundleIdentifier`,
`urlProtocol`, `linuxIconName`, license/report URLs. **Rebase risk:** low (rarely conflicts).

### `src/vs/platform/product/common/product.ts` (~line 37) & `src/main.ts` (~line 449)
Removed the `-dev` suffix append to `dataFolderName` so the home data folder is a
**flat `~/.stokd`** in dev too (intentionally shares the stokd CLI/harness home).
`nameShort`/`nameLong` keep the ` Dev` title suffix; `serverDataFolderName` keeps `-dev`.
Each is a 1–3 line change marked with a `stokd fork:` comment. **Rebase risk:** low–med.

### `cli/src/constants.rs` (~92/102) & `cli/src/options.rs` (~47)
Aligned the CLI's standalone fallback constants (`.vscode-oss` / `.vscode-server-oss`
/ `code-server-oss`) to the new data-folder/server names. Only used when the
build-time env injection from `product.json` is absent. **Rebase risk:** low.

---

## New files (zero conflict surface — upstream has never seen them)

All under `src/vs/workbench/contrib/terminal/browser/agentTabs/`:

| File | Role |
|---|---|
| `ITerminalTabsView.ts` | the seam interface; includes a compile-time assertion that the stock `TerminalTabbedView` satisfies it **structurally** (so we never edit `terminalTabbedView.ts`) |
| `agentTerminalSelectorRows.ts` | pure, dependency-free merge/de-dupe/sectioning logic — unit-tested without a build |
| `agentTerminalSelectorModel.ts` | DOM-free model: single consumer of `ITerminalGroupService` + `ITerminalChatService`, fans their events into one `onDidChange`, delegates to the pure rows logic |
| `agentTerminalTabbedView.ts` | Phase-2 skeleton view (`implements ITerminalTabsView`) that renders the merged, sectioned rows |
| `agentTabsContribution.ts` | self-registering experimental flag `terminal.integrated.agentTabs.enabled` (default `false`) |
| `test/agentTerminalSelectorModel.test.ts` | red→green unit test for the merge logic (`node --test`) |

Supporting (repo root / tooling), also new files:

| File | Role |
|---|---|
| `scripts/sync-upstream.sh` | wire `upstream`, fetch, report the next rebase target |
| `scripts/verify-seam.sh` | binary guard: flag defaults off + flag-off path uses the stock view |
| `docs/REBASE_RUNBOOK.md` | the "kept in sync" methodology |
| `.github/workflows/upstream-sync.yml` *(lives on `main`, not this PR — kept out so the inherited engineering-system guard passes; see AX-WORKFLOW-UPSTREAM-SYNC)* | CI: rebase the patch stack onto upstream tags and run the fast checks |

---

## Verification

```bash
scripts/verify-seam.sh                                   # seam guard — exits 0 (no build needed)
# Unit test (merge/de-dupe/sectioning logic). The test file follows the VS Code
# `.js`-import convention so it builds with the rest of src/; run it from out/:
npm run compile   # or the watch task; produces out/
node --test out/vs/workbench/contrib/terminal/browser/agentTabs/test/agentTerminalSelectorModel.test.js
```

The remaining risk is **interface drift** in `ITerminalGroupService` /
`ITerminalChatService` (a *compile* error, not a silent conflict) — caught by the
full `npm run compile` in CI on each upstream tag.

---

# Seam — chat panel as multi-provider LLM CLI (agent session providers)

> Governing contract: **AX-REPO-THIN-PATCH-FORK** + **AX-REPO-LAYER-BOUNDARIES**.
> The chat-panel multi-provider project (`project/prd-chat-panel-as-multi-provider-llm-cli`)
> turns the hard-coded agent-session-provider switch blocks into a fork-owned
> **registry** so new LLM-CLI providers (Gemini, Grok, …) and existing built-ins
> resolve through descriptors instead of per-provider upstream edits. This section
> is the honest accounting of the **single upstream file** that project redirects.

## Upstream files edited: **1**

### `src/vs/workbench/contrib/chat/browser/agentSessions/agentSessions.ts`

All edits are localized to the eight provider-resolution functions plus three
import/bootstrap lines. The pattern: each function keeps its hard-coded cases for
the providers that stay inline, and its **`default` branch consults the fork-owned
`agentSessionProviderRegistry`** instead of returning a hard-coded fallback. Claude
and Copilot CLI (Background) were moved out of the inline cases by work item 1.8,
and **Codex by work item 2.2**; all three now resolve through that registry
(descriptors live in `agentSessionProviderBuiltins.ts`). Work item 2.4 added the
eighth resolver — `getAgentSessionProviderFamily` — so the **family** facet is
surfaced consistently alongside name/icon/first-party/continue-in, completing the
Codex reconciliation (AC-P2.3).

| # | Location | Redirected change | Why |
|---|---|---|---|
| 1 | imports (lines ~13–14) | add `agentSessionProviderRegistry` and `registerBuiltInAgentSessionProviders` imports | bring the registry and the built-in re-registration into scope |
| 2 | module top-level (line ~20) | `registerBuiltInAgentSessionProviders();` | re-register Claude + Copilot CLI + Codex descriptors at module load, before any function below is called |
| 3 | `isBuiltInAgentSessionProvider` | drop `Background`/`Claude` from the inline `if`; `default` → `registry.get(provider)?.isBuiltIn === true` | built-in flag now sourced from the descriptor (Codex was never in this list → stays `false` via the descriptor) |
| 4 | `getAgentSessionProvider` | drop `Background`/`Claude`/`Codex` from the recognized `switch`; `default` → `registry.has(type) ? type : undefined` | recognition now sourced from the registry |
| 5 | `getAgentSessionProviderName` | drop `Background`/`Claude`/`Codex` cases; `default` → `registry.get(provider)?.displayName ?? provider` | display name from the descriptor |
| 6 | `getAgentSessionProviderIcon` | drop `Background`/`Claude`/`Codex` cases; `default` → `registry.get(provider)?.icon ?? Codicon.extensions` | icon from the descriptor (per-family codicons) |
| 7 | `isFirstPartyAgentSessionProvider` | drop `Background` (true) / `Claude` (false) / `Codex` (false) cases; `default` → `registry.get(provider)?.isFirstParty ?? false` | first-party flag from the descriptor |
| 8 | `getAgentCanContinueIn` | drop `Background` (true) / `Claude` (false) / `Codex` (false) cases; `default` → `registry.get(provider)?.canContinueIn ?? false` | continue-in flag from the descriptor |
| 9 | `getAgentSessionProviderDescription` | drop `Background`/`Claude`/`Codex` cases; `default` `return ''` → `registry.get(provider)?.description ?? ''` | description from the descriptor; absent → original `''` preserved |
| 10 | `getAgentSessionProviderFamily` (**new**, work item 2.4) | added function; inline cases (`Local`/`Cloud`/`Growth`/`AgentHostCopilot`) → `undefined`; `default` → `registry.get(provider)?.family` | new unified accessor for the **family** facet; Background → `'github'`, Claude → `'anthropic'`, Codex → `'openai'` resolve from the descriptor; hard-coded built-ins never declared a family → `undefined`. Reconciles the last Codex facet (AC-P2.3) |

**No behavior change.** Every descriptor in `agentSessionProviderBuiltins.ts` is
byte-identical to the value its original inline case produced — same display name
(Claude's and Codex's stay the literals `'Claude'` / `'Codex'`, not localized),
same icon, same flags, and the same localized description under the same nls key.
Codex keeps `isBuiltIn: false` because it was never part of the original
`isBuiltInAgentSessionProvider` allow-list (Local, Background, Cloud, Claude).
Proven by the golden snapshot test (below).

The agent host's Codex provider (`src/vs/platform/agentHost/node/codex/codexAgent.ts`)
is unchanged by this work item; it already backs the Codex list/click/resume/steer/
abort operations through its own AHP wiring (`createSession`→`thread/start`,
`steer`→`turn/steer`, `abort`→`turn/interrupt`, `resume`→`thread/resume`,
`listSessions`→`thread/list`). The generated codex protocol types under
`node/codex/protocol/generated/` are regenerated only via `npm run codex:gen-protocol`
(pinned `build/codex/codex-version.txt`) and are never hand-edited; this work item
made no protocol-schema change, so they remain untouched.

**Rebase risk:** low–med. `agentSessions.ts` changes when upstream adds/relabels a
provider. On rebase, re-apply rows 1–10; if upstream adds a new provider case, keep
it inline (the `default` registry redirect is additive and never conflicts with new
inline cases). Row 10 (`getAgentSessionProviderFamily`) is a net-new fork-added
export — purely additive, no upstream counterpart to conflict with.

### New files (zero conflict surface — upstream has never seen them)

All fork-owned, under `src/vs/workbench/contrib/chat/`:

| File | Role |
|---|---|
| `browser/agentSessions/agentSessionProviderRegistry.ts` | the registry + `IAgentSessionProviderUIEntry` descriptor (incl. optional `description`) |
| `browser/agentSessions/agentSessionProviderBuiltins.ts` | re-registers Claude + Copilot CLI (Background) + Codex descriptors via an idempotent `registerBuiltInAgentSessionProviders()` |
| `browser/agentSessions/agentSessionProviderCodicons.ts` | per-family `gemini`/`grok` codicons for non-enum providers |
| `test/common/agentSessions/agentSessionProviderRegistration.test.ts` | **golden snapshot** (AC-P0.1 / AC-P2.1): byte-identical provider resolution + registry presence of Claude/Copilot CLI/Codex; also pins the **family** facet for the full list and asserts Codex's 5-facet consistency (AC-P2.3) |
| `test/common/agentSessions/agentSessionProviderCodicons.test.ts` | per-family codicon resolution test |

## Verification

```bash
# Golden snapshot — byte-identical session list + replayed-session resolution (AC-P0.1):
node build/next/index.ts transpile   # produces out/ (requires node 24.15.0 for the runner)
node test/unit/node/index.js --runGlob "vs/workbench/contrib/chat/test/common/agentSessions/**/*.test.js"

# Layer boundaries (AC-P0.3) — the redirect stays within the browser layer:
node build/checker/layersChecker.ts   # exits 0 (no fork-introduced layer violation)
```
