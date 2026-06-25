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

# Feature: in-place single-folder workspace re-root

> Governing contract: **AX-STOKDIDE-SWITCH-ROOT-NO-RELOAD**. Lets the worktrees
> panel (stokd-mono `code-ext`) switch the Explorer root to another folder via the
> command `stokd.workspace.switchRootFolder` **without reloading the window**, so
> the extension host, terminals and any running agents survive. The extension API
> cannot do this (replacing folder[0] of a single-folder workspace via
> `updateWorkspaceFolders` forces a reload), so the capability lives in core.

## Upstream files edited: **3** (+ 1 upstream test file)

| File | Change | Why |
|---|---|---|
| `src/vs/workbench/services/configuration/common/configuration.ts` | +1 method on `IWorkbenchConfigurationService`: `reRootSingleFolderWorkspace(folder: URI)` | declare the new capability on the injectable service interface |
| `src/vs/workbench/services/configuration/browser/configurationService.ts` | +1 public method `reRootSingleFolderWorkspace` on `WorkspaceService` | re-inits the workspace at the new folder via the existing `initialize()` path, **reusing the current `workspace.id`** so identity (window storage/backups/hot-exit) is preserved and no reload occurs. Guards: requires `WorkbenchState.FOLDER`; no-op if unchanged. Serialized through `workspaceEditingQueue`. |
| `src/vs/workbench/workbench.common.main.ts` | +1 import line | load the fork-owned command contribution at startup |
| `src/vs/workbench/services/configuration/test/browser/configurationService.test.ts` *(upstream test)* | +3 tests + `DisposableStore` import | red→green coverage: in-place switch preserves identity & fires one `onDidChangeWorkspaceFolders`; no-op when unchanged; rejects in a multi-root workspace |

**Rebase risk:** low–med. The two production edits are additive (new method + new
interleaved entry), localized, and don't alter existing control flow. The barrel
import is append-only. The method depends on `WorkspaceService.initialize()` +
`createSingleFolderWorkspace` semantics — interface drift there is a *compile*
error, not a silent conflict.

## Fork-owned files (zero upstream conflict surface)

| File | Role |
|---|---|
| `src/vs/workbench/contrib/stokd/browser/switchRootFolder.contribution.ts` | registers command `stokd.workspace.switchRootFolder`; validates the target is a directory, calls `reRootSingleFolderWorkspace` in single-folder windows, falls back to `IHostService.openWindow({ forceReuseWindow })` for multi-root/empty windows |
| `src/vs/sessions/services/configuration/browser/configurationService.ts` *(fork layer)* | +1 method implementing the new interface member; throws (re-root is unsupported in the Agents window) |

## Verification

```bash
npm run compile-check-ts-native   # type-check src — exits 0
npm run valid-layers-check        # layering — exits 0
# behavioral (red→green), from a refreshed out/ (esbuild transpile, not gulp compile):
node build/next/index.ts transpile
npm run test-browser-no-install -- --grep "reRootSingleFolderWorkspace" --browser chromium
```

**Known race (not hit in production):** `WorkspaceService.initialize()` schedules a
fire-and-forget `validateWorkspaceFoldersAndReload`. Only the *startup* init
schedules it (re-roots don't — the completion barrier is already open), so a
worktree click — which happens long after the window loads — never collides with
it. Back-to-back re-roots are likewise safe. The unit test lets the startup
validation settle (`await timeout(0)`) before re-rooting to model real usage.
