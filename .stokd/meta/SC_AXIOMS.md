<!-- stokd-meta: SC_AXIOMS.md | metaVersion 0.6.0 | generated: UPGRADE (from 0.5.0) -->
# SC_AXIOMS — Repo-Wide Invariants (`code-oss-dev`)

> Repo-global axioms for the stokd-cloud `code-oss-dev` fork (thin-patch fork of
> `microsoft/vscode`). Each active axiom is a single declarative invariant with at
> least one Acceptance Check. Module-local axioms live in each package's
> `<package>/.axioms.md`; product axioms live in `.stokd/meta/SC_PRODUCT_*.md`.
>
> Active axioms below are appended-only: preserve every `## AX-...` heading and its
> body verbatim; only add new entries. Candidate blocks that lack repo-wide evidence
> are kept as commented `<!-- stokd-axiom-candidate -->` blocks with a rationale.

---

## AX-TERMINAL-AGENT-TABS: Terminal agent-tabs seam is flag-gated and byte-identical when off
The agent-aware terminal selector is gated by the setting `terminal.integrated.agentTabs.enabled` (default `false`); with the flag off, `terminalView.ts` creates the stock `TerminalTabbedView` through the `ITerminalTabsView` seam interface so the terminal behaves byte-identically to upstream.

### Acceptance Checks
- `bash scripts/verify-seam.sh` (exits 0; asserts flag registered `default: false`, flag-off branch creates `TerminalTabbedView`, and `terminalView.ts` references `ITerminalTabsView`)
- manual: any change widening the seam is reflected in `SEAM_MANIFEST.md` in the same task.

## AX-REPO-THIN-PATCH-FORK: Edited-upstream surface stays minimal and accounted for
This repo is a thin patch on `microsoft/vscode`; only fork-owned paths (`src/vs/sessions/**`, `src/vs/workbench/contrib/terminal/browser/agentTabs/**`, the `terminalView.ts` seam, `extensions/copilot/**`, and the fork tooling in `scripts/`/`test/`) may be edited freely, and any change to inherited upstream code requires a governed task and a `SEAM_MANIFEST.md` entry, because each such edit widens the rebase conflict surface.

### Acceptance Checks
- `test -f SEAM_MANIFEST.md` (the seam accounting document exists)
- `git diff --name-only HEAD~1 -- extensions/ | grep -v '^extensions/copilot/' | grep -v '^extensions/\.axioms\.md$'` returns empty for routine fork work
- manual: a diff touching inherited upstream code cites a governed task ID and a rebase-impact justification, or is rejected.

## AX-REPO-CROSS-LANGUAGE-CONTRACTS: Cross-language/cross-surface data contracts migrate in lockstep
Any data or wire contract shared across language or surface boundaries — the `AgentHostMetadata` lockfile schema (Rust `cli/src/tunnels/agent_host_metadata.rs` ↔ TS `src/vs/platform/agentHost/common/remoteAgentHostMetadata.ts`), the supervisor env/sentinel handshake (`VSCODE_AGENT_HOST_SUPERVISOR`, `__VSCODE_AGENT_HOST_READY__`), AHP method names/params/error codes, and the automation driver `.d.ts` (`src/vs/workbench/services/driver/common/driver.ts`) — must be changed by a coordinated migration that updates every binding in the same change; incompatible schema changes must bump the relevant version (`AGENT_HOST_METADATA_SCHEMA_VERSION`) and keep older payloads degrading gracefully.

### Acceptance Checks
- `test -f cli/src/tunnels/agent_host_metadata.rs && test -f src/vs/platform/agentHost/common/remoteAgentHostMetadata.ts` (both contract sides present)
- `cd cli && cargo test agent_host` (lockfile round-trip + token tests pass)
- manual: any `AgentHostMetadata` field rename/removal is mirrored across both languages and optional fields keep `serde(skip_serializing_if = "Option::is_none")` / degrade to `None`.

## AX-REPO-VENDORED-AHP-PROTOCOL: Generated agent-host protocol types are never hand-edited
Files under `src/vs/platform/agentHost/common/state/protocol/**` are vendored output of `scripts/sync-agent-host-protocol.ts` and carry a `DO NOT EDIT -- auto-generated` banner; protocol changes must be made by re-running the sync script against the sibling `../agent-host-protocol` repo (preserving the tab-conversion/import-merge/tsfmt/banner/`.ahp-version` pipeline), never by editing the generated files directly.

### Acceptance Checks
- `grep -q 'DO NOT EDIT' src/vs/platform/agentHost/common/state/protocol/actions.ts` (banner retained)
- manual: after a protocol change, `npx tsx scripts/sync-agent-host-protocol.ts` is run and `.ahp-version` matches the source repo short SHA; the generated files were not hand-edited.

## AX-REPO-LOCKFILE-SYNC: Dependency changes keep the committed lockfile in sync
Every `package.json` in the repo that has a committed `package-lock.json` (root, `remote/`, `remote/web/`, and the independently-installed `test/` sub-packages) declares a reproducible production closure; any add/remove/bump of a dependency must regenerate and commit the matching lockfile in the same change, because a stale lockfile yields a non-reproducible build.

### Acceptance Checks
- `test -f package-lock.json && test -f remote/package-lock.json && test -f remote/web/package-lock.json`
- manual: after editing dependencies, run the install and confirm the matching `package-lock.json` updated and is staged for commit.

## AX-REPO-FORK-TDD-SCOPE: Fork behavior changes require a red→green test; upstream is re-verified, not re-tested
Per Axiom 5 (formal TDD) and `SC_TEST.md` §0, every change to observable behavior in fork-owned code (`src/vs/sessions/**`, `agentTabs/**`, the terminal seam, `extensions/copilot/**`, fork tooling) must add a test that is observed to fail before implementation and pass after; inherited upstream code is re-verified by the existing runners and is not a target for new or maintained fork tests.

### Acceptance Checks
- manual: each fork behavioral acceptance criterion records an ordered red→green outcome series; no test is weakened or deleted to make a task look done.
- `npm run test-node -- --run src/vs/sessions/test/common/agentHostSessionsProvider.test.ts` (the node runner discovers and runs a fork sessions test)

## AX-REPO-SERVER-LAUNCH-HANDSHAKE: Launch handshake strings and default ports are an observable contract
The stdout readiness/address handshakes (`Web UI available at <addr>` for the server, `READY:<port>` for the agent host) and the default ports (server `9888`, web `8080`, agent-host/sessions-web `8081`, CLI control `31546`) are a contract shared between the server/agent-host entry points, the `scripts/` launchers that parse them, and CI; changing a handshake string, regex, or default port requires a coordinated update on both the emitting and consuming sides in the same task.

### Acceptance Checks
- `grep -q 'Web UI available at' scripts/code-server.js && grep -q 'READY:' scripts/code-agent-host.js`
- manual: a changed handshake string or port is updated in the corresponding server entry point (`out/`/`src/`) and any CI step that waits on it, in the same change.

## AX-REPO-LAYER-BOUNDARIES: Source layering is one-directional and enforced
The `src/` layer order `base → platform → editor → workbench` (with `sessions` layered above `workbench` — `sessions` may import from `workbench`, never the reverse) is an architectural invariant enforced by the layers checker; an import that violates the order must fail the check, not be suppressed.

### Acceptance Checks
- `npm run valid-layers-check` (the layers checker + per-target tsconfig checks pass)
- manual: no new import makes a lower layer depend on a higher one, and nothing in `workbench` imports from `sessions`.

## AX-REPO-AGENTS-WINDOW-DISTINCT-WINDOW: The Agents Window is a distinct window, never a workbench panel
The Agents Window (`src/vs/sessions/`) is a separate, fixed-layout workbench window (`WindowVisibility.Sessions`) and must never be rendered as a panel, view, or editor inside the main workbench window.

### Acceptance Checks
- `grep -rq 'WindowVisibility.Sessions' src/vs/sessions/` (the sessions window visibility marker is used)
- manual: no `src/vs/workbench/**` contribution mounts `src/vs/sessions/` content inside the main workbench part layout.

## AX-REPO-PRODUCT-IDENTITY: Stokd Code identity and marketplace live solely in product.json
The product's Stokd Code identity — `nameLong = "Stokd Code"`, `applicationName = "stokd-code"`, `dataFolderName = ".stokd"`, `darwinBundleIdentifier = "cloud.stokd.code"`, `urlProtocol = "stokd-code"`, `tunnelApplicationName = "stokd-tunnel"` — and its Open VSX marketplace (`extensionsGallery` → `open-vsx.org`) are defined solely in `product.json`; branding/marketplace changes are made there and must stay consistent with the launchers and CLI constants that read them.

### Acceptance Checks
- `node -e "const p=require('./product.json');const g=JSON.stringify(p.extensionsGallery||{});process.exit((p.nameLong==='Stokd Code'&&p.applicationName==='stokd-code'&&p.dataFolderName==='.stokd'&&p.darwinBundleIdentifier==='cloud.stokd.code'&&p.urlProtocol==='stokd-code'&&p.tunnelApplicationName==='stokd-tunnel'&&g.includes('open-vsx.org'))?0:1)"` (identity fields and Open VSX gallery intact)
- manual: a branding/marketplace change updates `product.json` and is mirrored in any launcher or CLI constant that hard-codes the old value (e.g. `stokd-code`, `.stokd`, `stokd-tunnel`). *(↔ `AX-PROD-CODE-OSS-DEV-008`)*

## AX-REPO-AGENT-CLI-PROVIDER-REGISTRY: Agent-CLI providers are pure-data descriptors resolved through a fork-owned registry
Every agent-CLI provider (Claude, Copilot CLI, Codex, Gemini, Grok, …) is registered as a pure-data descriptor in the fork-owned registries — core `agentSessionProviderRegistry` (`src/vs/workbench/contrib/chat/browser/agentSessions/`) and copilot-side `AgentCliProviderRegistry` (`extensions/copilot/src/extension/chatSessions/common/agentCliProviderRegistry.ts`) — and the provider-resolution functions in the tracked `agentSessions.ts` seam resolve unknown providers from the registry's `default` branch; adding a provider is *descriptor + adapter + `package.json`* with zero new upstream switch-case edits and no change to the single shared chat renderer.

### Acceptance Checks
- `test -f src/vs/workbench/contrib/chat/browser/agentSessions/agentSessionProviderRegistry.ts && test -f extensions/copilot/src/extension/chatSessions/common/agentCliProviderRegistry.ts` (both registry seams exist)
- `grep -q 'renderer is never modified' extensions/copilot/src/extension/chatSessions/common/agentCliProvider.ts` (the no-renderer-edit contract is documented in the descriptor module)
- manual: a new provider adds a `chatSessions/<provider>/common/` descriptor + normalizer and registers via the registry; it adds no upstream `case` to `agentSessions.ts` and does not edit the shared renderer. *(↔ `AX-PROD-CODE-OSS-DEV-009`; feature-local `AX-AGENT-CLI-PROVIDER-REGISTRY` / DN-9; module-local `AX-MOD-EXT-006`)*

## AX-REPO-AGENT-CHAT-DEFAULT-SURFACE: Chat is the default agent launch surface; the terminal selector is a never-removed opt-in
Newly-opened agent sessions land in the Agents Window chat by default — `getLaunchSurface()` returns `DEFAULT_AGENT_LAUNCH_SURFACE = 'chat'`, gated by the revertible setting `chat.agentSessions.defaultSurface` (`'chat' | 'terminal'`, default `'chat'`) — and the flag-gated agent-aware terminal selector (`terminal.integrated.agentTabs.enabled`, default `false`, now carrying a deprecation message) is retained as an opt-in escape hatch reached only when the setting is `'terminal'` or the per-launch *Open in Terminal* action is used; it is superseded, never removed.

### Acceptance Checks
- `grep -q "DEFAULT_AGENT_LAUNCH_SURFACE: AgentLaunchSurface = 'chat'" src/vs/workbench/contrib/chat/browser/agentSessions/defaultLaunchSurface.ts` (chat is the wired default)
- `grep -q "AGENT_DEFAULT_SURFACE_SETTING_ID = 'chat.agentSessions.defaultSurface'" src/vs/workbench/contrib/chat/browser/agentSessions/defaultLaunchSurface.ts` (the revertible setting id is intact)
- `grep -q 'markdownDeprecationMessage' src/vs/workbench/contrib/terminal/browser/agentTabs/agentTabsContribution.ts && grep -q 'default: false' src/vs/workbench/contrib/terminal/browser/agentTabs/agentTabsContribution.ts` (terminal selector stays default-off and deprecated, not deleted)
- manual: changing the default formula/value is a coordinated change across the core surface and the copilot provider gating, and the terminal escape hatch still works. *(↔ `AX-PROD-CODE-OSS-DEV-010`, `AX-TERMINAL-AGENT-TABS`; module-local `AX-MOD-EXT-007`)*

## AX-REPO-INPLACE-REROOT-NO-RELOAD: Re-rooting a single-folder workspace reuses the workspace id without a window reload
The worktrees panel re-roots a single-folder workspace to another folder (command `stokd.workspace.switchRootFolder` → `IWorkbenchConfigurationService.reRootSingleFolderWorkspace(folder)` on `WorkspaceService`) by re-initializing configuration at the new folder while reusing the current `workspace.id`, so no window reload occurs and the extension host, terminals, and running agents survive the switch.

### Acceptance Checks
- `grep -q 'reRootSingleFolderWorkspace' src/vs/workbench/services/configuration/common/configuration.ts` (the seam method is on the service interface)
- `grep -q 'reRootSingleFolderWorkspace' src/vs/workbench/services/configuration/test/browser/configurationService.test.ts` (the re-root behavior carries a test)
- `test -f src/vs/workbench/contrib/stokd/browser/switchRootFolder.contribution.ts` (the `stokd.workspace.switchRootFolder` command contribution exists)
- manual: re-root reuses the existing `workspace.id` (no new id, no `window.reload`); the ext host, terminals, and running agents are not torn down. *(↔ `AX-PROD-CODE-OSS-DEV-011`; feature-local `AX-STOKDIDE-SWITCH-ROOT-NO-RELOAD`)*

---

## Non-Promoted Candidates

The following candidate blocks were surfaced by module metadata but are **not** promoted
to active repo-wide axioms — the concrete evidence is module-local or the invariant is
not yet confirmed at the repo level. They are retained verbatim for the next review pass.

<!--
  stokd-axiom-candidate (NOT promoted)
  source: scripts/.axioms.md (AX-MOD-SCRIPTS-001)
  proposed: AX-REPO-CROSS-PLATFORM-LAUNCHER-PARITY — a behavioral change to a *.sh
    launcher must be mirrored in its *.bat and shared *.js siblings so all platforms
    launch identically.
  rationale-for-not-promoting: The cross-platform *.sh/*.bat/*.js trio convention is
    concentrated in the `scripts/` package; no other package ships this trio pattern
    (cli is a single Rust binary with per-OS cfg branches, not paired shell scripts).
    The invariant is real but module-local — it stays governed by AX-MOD-SCRIPTS-001.
    Promote only if a second package adopts the trio pattern.
  acceptance-if-promoted: for each touched scripts/<name>.sh, scripts/<name>.bat and
    scripts/<name>.js carry equivalent flags/ports/env (POSIX-only maintenance scripts exempt).
-->

<!--
  stokd-axiom-candidate (NOT promoted — low confidence)
  source: remote/.axioms.md (bottom block)
  proposed: AX-REPO-SERVER-DEPS-DISJOINT — the server/web dependency closure (remote/)
    stays disjoint from Electron-only dependencies in the root package.json so heavy
    desktop-only modules never leak into the headless server image.
  rationale-for-not-promoting: Design intent is documented (SC_MODULE remote §Responsibility)
    but there is no executable check or enumerated "Electron-only" deny-list to test against,
    so the invariant cannot yet declare a non-manual Acceptance Check. Needs an explicit
    deny-list / build-size assertion before promotion.
-->

<!--
  stokd-axiom-candidate (NOT promoted — low confidence)
  source: cli/.axioms.md (AX-MOD-CLI-006)
  proposed: AX-REPO-CLI-TESTS-GREEN — existing cli #[cfg(test)] unit tests
    (mint_connection_token_*, msgpack_rpc, singleton, util/*) must stay green before merge.
  rationale-for-not-promoting: This is the cli module's local "don't break existing tests"
    default, already covered by AX-REPO-FORK-TDD-SCOPE at the repo level and by the cli
    module axioms. The canonical repo-wide CI test command is not yet confirmed, so a
    cli-specific `cargo test` gate is left module-local.
-->

<!--
  stokd-axiom-candidate (NOT promoted — stays module-local)
  source: extensions/.axioms.md (AX-MOD-EXT-002)
  proposed: AX-REPO-COPILOT-INDEPENDENT-BUILD — the fork-owned `copilot` extension is
    compiled/tested on its own pipeline (esbuild + Vitest) and excluded from the gulp
    extensions build, so it must be validated via its own scripts, not assumed covered
    by `transpile-extensions`.
  rationale-for-not-promoting: The invariant is confirmed (SC_PRODUCT §Modules and
    SC_MODULE extensions), but its surface is a single extension's build topology inside
    `extensions/`; it is fully governed by the module axiom AX-MOD-EXT-002
    (`npm run compile-copilot`). No second package shares this independent-build pattern,
    so it stays module-local. Promote only if another fork-owned package adopts an
    independent (non-gulp) extension build.
  acceptance-if-promoted: `npm run compile-copilot` exits 0 and the copilot suite is run
    by its own test script, separate from the gulp extensions pipeline.
-->

<!--
  stokd-axiom-candidate (NOT promoted — cross-surface but narrow)
  source: test/.axioms.md (AX-MOD-TEST-004)
  proposed: AX-REPO-AGENTS-WINDOW-SELECTOR-CONTRACT — the Agents Window / Chat automation
    page objects (`test/automation/src/{agentsWindow,chat}.ts`) encode DOM selectors for
    `src/vs/sessions/` surfaces (e.g. `.agent-sessions-workbench`, `.sessions-chat-widget`,
    `.sessions-chat-send-button`), so a selector change on either side without the matching
    change on the other breaks Agents Window / Chat smoke coverage.
  rationale-for-not-promoting: This is a genuine cross-package coupling (`test/` ↔
    `src/vs/sessions/`), but its acceptance is largely manual (run the smoke scenario) and
    it is already governed by the module axiom AX-MOD-TEST-004 and the regression contract
    (AX-REPO-FORK-TDD-SCOPE / AX-PROD-CODE-OSS-DEV-007). The data/wire-contract axiom
    AX-REPO-CROSS-LANGUAGE-CONTRACTS covers the driver `.d.ts` but not these DOM selectors.
    Promote only if selector drift recurs and a deterministic guard (selector-extraction
    check) is added.
  acceptance-if-promoted: a check that the selectors used by `agentsWindow.ts`/`chat.ts`
    resolve against `src/vs/sessions/` DOM classes (or the Agents Window smoke scenario passes).
-->
