<!-- stokd-meta: SC_VIEWS.md | metaVersion 0.4.0 | generated: FRESH -->
# SC_VIEWS — `code-oss-dev` View Classification

> View-classification document. Fresh generation, meta version 0.4.0.
> Repo: `/opt/worktrees/stokd-cloud/stokd-ide/main` — single product `code-oss-dev` (stokd-ide), a thin-patch fork of `microsoft/vscode`.
>
> Scope: this document catalogs the **fork-distinguishing** views — the Agents Window (`src/vs/sessions/`), the flag-gated agent terminal selector (`src/vs/workbench/contrib/terminal/browser/agentTabs/`), the Rust `code` CLI terminal-output views (`cli/`), and the dev/CI launcher terminal output (`scripts/`). The full inherited VS Code workbench (editors, panels, SCM, settings, etc.) is upstream and out of scope here — it is exercised by flows W1–W4 and re-verified, not re-documented (see `AX-REPO-FORK-TDD-SCOPE`). All views below belong to the single product documented in **SC_PRODUCT_CODE_OSS_DEV.md**.
>
> A "view" here is any distinct screen, panel, page, modal, or terminal-output surface a user perceives as a unit. Each entry records the implementing source file(s), the layout **Regions** (zones + the widget that renders each), and the meaningful **States**.

---

## View Index

| # | View | Surface family | Product flows |
|---|------|----------------|---------------|
| V1 | Agents Window — Shell / Layout | Agents Window (`src/vs/sessions/`) | S1–S9 |
| V2 | Titlebar | Agents Window | S2, S3, S6, S9 |
| V3 | Sessions List (Sidebar) | Agents Window | S5, S6, S7 |
| V4 | Session View / Chat | Agents Window | S3, S5, S7 |
| V5 | New Chat / New Session | Agents Window | S3, S4 |
| V6 | Changes View (Auxiliary Bar) | Agents Window | S8 |
| V7 | Account / Copilot Status Panel | Agents Window | S2 |
| V8 | First-Launch Welcome / Setup | Agents Window | S1 |
| V9 | Modal Editor Overlay | Agents Window | S8, S9 |
| V10 | Open-in-VS-Code Widget | Agents Window | S9 |
| V11 | Mobile / Phone Layout | Agents Window (web) | S1–S8 |
| V12 | Agent Terminal Selector | Terminal seam (`agentTabs/`) | T1 |
| V13 | CLI — `agent host` Supervisor Banner | Rust CLI (`cli/`) | C2 |
| V14 | CLI — `agent ps` Session List | Rust CLI | C3 |
| V15 | CLI — `agent logs` Event Stream | Rust CLI | C4 |
| V16 | CLI — `agent stop` / `agent kill` Result | Rust CLI | C5 |
| V17 | CLI — `tunnel` / `serve-web` / `status` / `version` | Rust CLI | C2, C6, C7 |
| V18 | Launcher Terminal Output | Scripts (`scripts/`) | C2 |

> Products column: every view above is exposed by the single product doc **SC_PRODUCT_CODE_OSS_DEV.md** (`code-oss-dev`; packages `cli`, `extensions`, `remote`, `scripts`, `test` layered on the primary `src/` app). The "Surface family" names which surface of that one product owns the view.

---

## V1 — Agents Window: Shell / Layout

The root fixed-layout workbench window that hosts every other Agents Window view. A distinct window (`WindowVisibility.Sessions`), never a panel inside the main editor (`AX-REPO-AGENTS-WINDOW-DISTINCT-WINDOW`).

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/browser/workbench.ts` — `Workbench` (grid construction, lifecycle)
  - `src/vs/sessions/browser/parts/sessionsPart.ts` — central Sessions Part (internal grid of session views)
  - `src/vs/sessions/browser/parts/{sidebarPart,auxiliaryBarPart,panelPart,titlebarPart,editorPart}.ts`
  - `src/vs/sessions/browser/layoutPolicy.ts`, `layoutActions.ts` — viewport class & layout actions
  - Entry points: `sessions.desktop.main.ts` (Electron), `sessions.web.main.ts` (web standalone), `sessions.common.main.ts`
  - `src/vs/sessions/browser/media/style.css` — `.agent-sessions-workbench` shell, accent radial gradient
- **Regions:**
  - **Titlebar** (top, full width) — V2
  - **Sidebar** (left, ~300px) — Sessions List (V3); flush, no card; footer hosts account widget
  - **Sessions Part** (center) — internal `SerializableGrid` of one or more Session Views (V4); card appearance
  - **Editor** (in grid, beside Sessions Part) — hidden by default; opens as modal overlay (V9)
  - **Auxiliary Bar** (right, ~340px) — Changes View (V6); card appearance
  - **Panel** (below, ~300px) — terminal/debug output; hidden by default; card appearance
  - Excluded vs. stock workbench: **no activity bar, no status bar, no banner**
- **States:**
  - **Part visibility** — initial: Sidebar ✅, Sessions Part ✅, Auxiliary Bar ✅, Editor ❌, Panel ❌. Visibility classes `nosidebar` / `noauxiliarybar` / `nosessionspart` / `nopanel` toggled on `.agent-sessions-workbench`.
  - **Restoring** — on startup `ISessionsViewService.restoreVisibleSessions()` rebuilds the grid atomically before first paint (`src/vs/sessions/services/sessions/browser/sessionsViewService.ts`, `visibleSessions.ts`).
  - **Maximized session** — one session view maximized within the Sessions Part internal grid.
  - **No-op feature states** — Zen Mode / Centered Layout / Menu Bar Toggle / Maximize Aux Bar are no-ops.
  - **Viewport class** — `phone` / `tablet` / `desktop` (drives V11 swap), from `layoutPolicy.ts`.
  - **High-contrast** — disables the accent radial gradient.

---

## V2 — Titlebar

Standalone three-section titlebar (`TitlebarPart`, not `BrowserTitlebarPart`). No menubar, no editor actions.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/browser/parts/titlebarPart.ts` (desktop), `electron-browser/parts/titlebarPart.ts`
  - `src/vs/sessions/browser/parts/mobile/mobileTitlebarPart.ts` (phone)
  - `src/vs/sessions/browser/menus.ts` — menu IDs
  - `src/vs/sessions/browser/sessionStatusIcon.ts` — session status icon
  - `src/vs/sessions/browser/accountTitleBarState.ts` — account widget state
- **Regions:**
  - **Left** (`Menus.TitleBarLeftLayout`) — toggle sidebar, **agent host filter** pill
  - **Center** (`Menus.CommandCenter`) — **session picker** widget (provider icon · session title · workspace · branch/worktree · `+ins -del` changes summary); plus `Menus.TitleBarSessionMenu` for active-session actions; opens the session switcher quick pick on click
  - **Right** (`Menus.TitleBarRightLayout`) — **Run script** split button, **Open Terminal**, **Open in VS Code** (V10), toggle auxiliary bar, **account widget** (V7)
  - macOS custom-titlebar: traffic-light spacer in sidebar (70px)
- **States:**
  - **Session active** — picker renders full chrome (icon, title, workspace, branch, change stats).
  - **No active session** (new-chat draft) — picker hides its chrome (center empty); Run script disabled.
  - **Host filter** — visible only when multiple remote agent hosts are known; acts as re-discover trigger when none are known.
  - **Account widget** — loading / signed-in (avatar + quota badge) / sign-in needed; badge kinds `default`/`accent`/`warning`/`prominent`; dot badge none/warning/error. See V7.
  - **Fullscreen** — titlebar may hide/show (desktop).

---

## V3 — Sessions List (Sidebar)

The session inventory: a tree of sessions grouped by workspace/date with a pinned section, plus the account-widget footer.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/contrib/sessions/browser/views/sessionsList.ts` — tree widget, grouping/sorting, item rendering
  - `src/vs/sessions/contrib/sessions/browser/views/sessionsView.ts` — `ViewPane` container, header, actions
  - `src/vs/sessions/contrib/sessions/browser/sessionsActions.ts` — rename/pin/read actions
  - `src/vs/sessions/browser/parts/sidebarPart.ts` — sidebar part + footer toolbar
  - `src/vs/sessions/browser/sessionStatusIcon.ts` — per-item status icon
- **Regions:**
  - **Header** — view title + actions (sort/group); on phone a filter-chip row (V11)
  - **Find widget** — filter by session name / workspace
  - **Tree** — collapsible **section headers** (by workspace or date, plus pinned section) → **session items**: status icon, title (inline-rename), meta row (workspace · branch · diff stats), hover/focus inline-action toolbar, drag handle; "show more/less" nodes for capped groups
  - **Footer** — sort/group toggles + account widget (desktop)
- **States:**
  - **Grouping** — by workspace / by date.
  - **Sorting** — by created / by updated.
  - **Section** — collapsed / expanded (persisted); workspace group capped (`IsWorkspaceGroupCappedContext`).
  - **Item** — loading/in-progress (spinner), needs-input (ring), succeeded (check), failed (error), idle; read / unread; pinned / unpinned (`IsSessionPinnedContext`); archived (faded); active (selected).
  - **Filtered** — find query active; phone filter chips (Completed / In Progress / Failed).
  - **Empty** — no sessions for the active host/filter.
  - **Editing** — inline rename input replaces the title.

---

## V4 — Session View / Chat

A single leaf of the Sessions Part internal grid: header + optional chat-tab strip + chat surface + scoped progress. The Sessions Part may show several side-by-side; exactly one is active.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/browser/parts/sessionsPart.ts` — owns the internal grid, slot pool, reconcile, maximize
  - `src/vs/sessions/browser/parts/sessionView.ts` — per-session leaf host, height layout
  - `src/vs/sessions/browser/parts/sessionHeader.ts` — header + `SessionViewFloatingToolbar`
  - `src/vs/sessions/browser/parts/chatCompositeBar.ts` — chat tab strip (multi-chat only)
  - `src/vs/sessions/browser/parts/chatView.ts` — `ChatViewKind` selection, `AbstractChatView` (scoped progress bar)
  - `src/vs/sessions/contrib/chat/browser/chatView.ts` — concrete `ChatView` (wraps workbench `ChatWidget`) via `IChatViewFactory`
  - `src/vs/sessions/browser/parts/{sessionBarStyles.ts,media/chatCompositeBar.css}`, `browser/media/style.css` (`.interactive-item-container` 950px cap)
  - Visibility model: `src/vs/sessions/services/sessions/browser/{sessionsViewService.ts,visibleSessions.ts}`
- **Regions:**
  - **Header** (top) — status icon + title (drag handle; right-click → `Menus.SessionHeaderContext`: pin/close, rename, mark read/unread), meta row (workspace · branch · diff stats), toolbars (Run, Open in VS Code, New Chat); replaced by floating toolbar for not-yet-created sessions
  - **Chat composite bar** (below header) — chat tab strip; only when the session has >1 chat
  - **Chat view** (below bars) — one of `'newSession'` (V5), `'newChatInSession'` (V5 variant), or `'chat'` (`ChatView` rendering `session.activeChat`); inner content capped to 950px and centered, viewport full-width for edge-aligned scrollbar
  - **Progress bar** — per-leaf, pinned to top of the leaf; `ScopedProgressIndicator` driven by `AbstractChatView.showProgressWhile`
- **States:**
  - **Chat kind** — `newSession` / `newChatInSession` / `chat`.
  - **Created vs draft** — `SessionIsCreatedContext`; one slot may be the `undefined` empty/placeholder slot (always non-sticky, at most one).
  - **Active vs inactive** — focus/pointer-down promotes to active.
  - **Sticky / non-sticky** — pinned slot preserved across reconcile; `SessionIsStickyContext`.
  - **Maximized** — `SessionIsMaximizedContext` (only when ≥2 non-placeholder views visible).
  - **Loading** — leaf progress bar visible while `acquireOrLoadSession` runs.
  - **Read / archived / multi-chat** — `SessionIsReadContext`, `SessionIsArchivedContext`, `SessionSupportsMultipleChatsContext`.
  - **Editing** — inline title rename in header.
  - **Mobile** — replaced by single-session host (`MobileSessionsPart`, V11).

---

## V5 — New Chat / New Session

The empty-slot composer: workspace + session-type (+ model) pickers and the first-message input. Also the in-session new-chat variant.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/contrib/chat/browser/newChatWidget.ts` — composes pickers + input; disposal-guarded async workspace handler
  - `src/vs/sessions/contrib/chat/browser/newChatInput.ts` — input + button bar
  - `src/vs/sessions/contrib/chat/browser/newChatInSessionWidget.ts` — new-chat-in-existing-session variant
  - `src/vs/sessions/contrib/chat/browser/{sessionWorkspacePicker.ts,webWorkspacePicker.ts}` — workspace picker (desktop / web+phone bottom sheet)
  - `src/vs/sessions/contrib/chat/browser/sessionTypePicker.ts`, `modelPicker.ts` — type & model selectors
- **Regions:**
  - **No-agent-host empty state** — heading + help text + CTAs when no host is available
  - **Workspace picker** — label + dropdown/button (desktop) or bottom sheet (phone); recents + Local/Remote groups
  - **Session-type picker** — inline ("with …") by default, or in a **Controls** section below input (A/B)
  - **Model/agent picker** — chip row (when provider exposes models)
  - **Input area** — heading ("What do you want to do?"), rich input (markdown/@mentions/attachments), attachment panel, action buttons: **Send** (primary), **Background Send** (Alt+Enter), **More (…)**
- **States:**
  - **Empty** — initial focus, nothing typed.
  - **Filled** — text and/or attachments present.
  - **Can-send gate** — disabled when no active session, still loading, or no selectable model.
  - **Sending** — submit in flight (`loading`); transitions placeholder into a real session, preserving the slot.
  - **Error** — submission failed (banner).
  - **No host** — empty-state gate shown instead of composer.
  - **Variant** — new-chat-in-session hides the workspace picker.
  - **Mobile** — pickers render as bottom sheets.

---

## V6 — Changes View (Auxiliary Bar)

Reviews and lands the file changes an agent produced for the active session: changeset tree, diffs, CI checks, sync/apply.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/contrib/changes/browser/changesView.ts` — `ViewPane`
  - `src/vs/sessions/contrib/changes/browser/changesViewRenderer.ts` — tree item rendering
  - `src/vs/sessions/contrib/changes/browser/changesViewModel.ts` — state
  - `src/vs/sessions/contrib/changes/browser/checksWidget.ts` — CI status widget
  - `src/vs/sessions/browser/parts/auxiliaryBarPart.ts` — host part
  - Mobile overlay: `src/vs/sessions/browser/parts/mobile/contributions/mobileChangesView.ts`
- **Regions:**
  - **Title bar** — "Changes" + count badge + toolbar (sort/filter, sync, run code review)
  - **Controls** — isolation-mode toggle (isolated/integrated), view-mode toggle (list/split), sync-to-parent button
  - **Progress bar** — during git operations
  - **Changes tree** — changeset roots (checkbox include/exclude, title, file count) → file rows (A/M/D icon + pill, path, `+N −N`, hover actions: open diff/open file/discard)
  - **Diff editor** — single- or multi-file diff for the selected file
  - **CI checks widget** — run status badge + per-check list
- **States:**
  - **Loading** — `hasGitOperationInProgress` (progress bar).
  - **Isolation mode** — isolated / integrated.
  - **View mode** — tree/list, split/full.
  - **Changeset** — collapsed/expanded; included/excluded.
  - **File item** — selected (drives diff) / not.
  - **Diff** — single-file vs multi-file editor active.
  - **Empty** — no changes.
  - **Error** — sync/apply failed (banner).
  - **Auto-reveal** — auxiliary bar auto-reveals to Changes when a turn completes with new changes (suppressed on mobile; see `LAYOUT_CONTROLLER.md`).
  - **Mobile** — hidden in aux bar; accessed via a titlebar **Changes** pill → full-screen overlay (V11).

---

## V7 — Account / Copilot Status Panel

The titlebar account widget and its popup: identity, quota, entitlement, sign in/out.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/browser/accountTitleBarState.ts` — state computation + profile image URL
  - `src/vs/sessions/contrib/accountMenu/browser/account.contribution.ts` — menu/action registration
  - rendered in `src/vs/sessions/browser/parts/titlebarPart.ts` (right) and `parts/mobile/mobileTitlebarPart.ts`
- **Regions:**
  - **Titlebar widget** — avatar (GitHub profile image, falls back to account codicon) + name + badge + dot indicator
  - **Popup** — account header, chat & completions quota, entitlement (Free/Pro/Team), sentiment feedback, actions (Sign Out, Manage Account), Copilot dashboard link
- **States:**
  - **Loading** — spinner.
  - **Signed in / signed out** — avatar+name vs sign-in prompt.
  - **Entitlement** — Free / Pro / Team / Trial.
  - **Quota** — chat + completions snapshots; badge kind default/accent/warning/prominent.
  - **Dot badge** — none / warning / error.
  - **Sentiment** — none / positive / negative.

---

## V8 — First-Launch Welcome / Setup

A one-time modal shown on first launch of the Agents Window per profile.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/browser/sessionsSetUpService.ts` — service + `SessionsSetUpWidget`
  - `src/vs/sessions/common/welcome.ts` — `WELCOME_COMPLETE_KEY`, `shouldSkipSessionsWelcome`
  - `src/vs/sessions/browser/media/sessionsSetUp.css`
- **Regions:**
  - **Modal** — title ("Welcome to Agents"), markdown body (product + sign-in info), action buttons (Continue / Sign Out), optional GitHub sign-in flow
- **States:**
  - **Visible** — first launch only (storage key unset, not smoke test/URL-skipped, default chat agent configured); `SessionsWelcomeVisibleContext`.
  - **Signing in** — async auth flow.
  - **Complete** — writes `WELCOME_COMPLETE_KEY`, fires `onCompleted`, closes.
  - **Skipped** — never shown when no default agent is configured.

---

## V9 — Modal Editor Overlay

Editors open as modal overlays instead of occupying grid space (`workbench.editor.useModal: 'all'`).

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/browser/parts/editorPart.ts`, `editorParts.ts` — `ModalEditorPart`
  - `src/vs/sessions/contrib/editor/browser/editor.contribution.ts` — editor-title layout actions
- **Regions:**
  - **Modal overlay** — editor group rendered over the workbench with a backdrop
  - **In-grid editor title toolbar** (when the editor is revealed in-grid rather than modal) — open-in-modal, maximize/restore editor area, auxiliary-bar chevron (Push Editor Right / Show Secondary Side Bar), close editor area
- **States:**
  - **Open (modal)** — file opened with no explicit group.
  - **Closed** — all editors closed / Escape / backdrop click → disposed.
  - **In-grid revealed** — main editor part explicitly shown; aux-bar chevron flips on `AuxiliaryBarVisibleContext`; `.noauxiliarybar` restores editor card borders.
  - **Session-restore reveal** — programmatic reveal honoring the session's saved aux-bar visibility.

---

## V10 — Open-in-VS-Code Widget

Titlebar action to open the active session in the full VS Code editor (flow S9).

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/browser/widget/openInVSCodeWidget.ts`
  - `src/vs/sessions/browser/{actions/vscodeActions.ts,openInVSCodeUtils.ts}`, `electron-browser/actions/vscodeActions.ts`
  - `src/vs/sessions/browser/media/openInVSCode.css`
- **Regions:**
  - **Icon button** — distro-specific icon (`data-product-quality`), label "Open in VS Code" + keybinding hint on hover
- **States:**
  - **Enabled** — session exists.
  - **Disabled** — new-session draft.
  - **Hover / focus** — label + keybinding revealed.

---

## V11 — Mobile / Phone Layout

The phone-class variant of the Agents Window (web), substituted at construction by viewport class.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/browser/layoutPolicy.ts`, `browser/parts/mobile/mobileLayout.ts` — viewport classification
  - `src/vs/sessions/browser/parts/mobile/{mobileTitlebarPart,mobileSessionsPart,mobileSidebarPart,mobileAuxiliaryBarPart,mobilePanelPart}.ts` — part variants
  - `src/vs/sessions/browser/parts/mobile/{mobilePickerSheet,mobileSessionFilterChips,mobileSortGroupSheet,mobileVisualViewport,mobileEdgeSwipe,longPress}.ts`
  - `src/vs/sessions/browser/mobileNavigationStack.ts` — Android back-button stack
  - `src/vs/sessions/browser/parts/mobile/contributions/{mobileChangesView,mobileDiffView,mobileMultiDiffView}.ts`
- **Regions:**
  - **Mobile titlebar** — left hamburger (☰), center session title, right contextual (+ new chat / 👤 account)
  - **Sidebar drawer** — left overlay (~85% width) over backdrop; hosts Sessions List
  - **Grid area** — single full-width Session View (edge-to-edge, no card margins), input pinned to bottom
  - **Full-screen overlays** — changes (master), single-file diff (detail), multi-diff (scrollable)
  - **Bottom sheets** — workspace / session-type / model / host-filter / sort-group pickers
- **States:**
  - **Viewport class** — phone (<640px, mobile UI) / tablet (640–1024px) / desktop (≥1024px, desktop UI).
  - **Drawer** — open / closed (animation + navigation history stack).
  - **Bottom sheet** — open / closed (resolves on Done or backdrop tap).
  - **Filter chips** — Completed / In Progress / Failed selection.
  - **Virtual keyboard** — `sessionsKeyboardVisible` context key; `--vscode-keyboard-height` tracked.
  - **Overlay nav** — master → detail (changes → diff) via the navigation stack.

---

## V12 — Agent Terminal Selector (flag-gated terminal seam)

Experimental terminal tab list that groups agent (tool-session) terminals separately from human terminals with per-agent run state. Gated by `terminal.integrated.agentTabs.enabled` (default `false`); with the flag off the terminal is byte-identical to upstream (`AX-TERMINAL-AGENT-TABS`).

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - Seam: `src/vs/workbench/contrib/terminal/browser/terminalView.ts` — `_createTabsView()` branches on the flag, creating `AgentTerminalTabbedView` or stock `TerminalTabbedView` through the `ITerminalTabsView` interface
  - `src/vs/workbench/contrib/terminal/browser/agentTabs/ITerminalTabsView.ts` — seam interface (`rerenderTabs`, `layout`, `setEditable`, `focusTabs`, `focus`, `focusHover`)
  - `agentTabs/agentTerminalTabbedView.ts` — view (DOM list builder)
  - `agentTabs/agentTerminalSelectorModel.ts` — stateful model, event fan-in
  - `agentTabs/agentTerminalSelectorRows.ts` — pure merge/dedupe/sectioning (`mergeSelectorRows`, `AgentRunState`, `IAgentRowMeta`)
  - `agentTabs/agentTabsContribution.ts` — flag registration (`TerminalAgentTabsSettingId`)
  - Stock fallback (flag off): `src/vs/workbench/contrib/terminal/browser/terminalTabbedView.ts`
- **Regions** (`.agent-terminal-tabs` container, three row kinds):
  - **Group header** (`.agent-tabs-section-header`) — `"${section} (${count})"`; sections `Terminals` then `Agents`, only non-empty sections render
  - **Terminal row** (`.agent-tabs-row.terminal`) — `instance.title` (or `Terminal {id}`)
  - **Agent row** (`.agent-tabs-row.agent`) — `"${sessionTitle} [${runState}]"`
- **States:**
  - **Flag off (default)** — stock `TerminalTabbedView`, upstream-identical.
  - **Per-agent run state** (`AgentRunState`) — `idle` / `running` / `awaiting-approval` (Phase 4 placeholder) / `background`.
  - **Empty** — no terminals and no agents → no rows, no headers.
  - **Populated** — non-empty section headers + rows; agent identity wins for dual instances (dedup by instanceId).
  - **Collapsed section** — header renders with full count; rows omitted.
  - **Selection / hover** — not yet implemented (later phase).

---

## V13 — CLI: `agent host` Supervisor Banner

Startup/reuse banner and readiness sentinel printed when supervising the Agent Host.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (package `cli`)
- **Location:**
  - `cli/src/commands/agent_host.rs` — `run_supervisor()`, `print_reuse_banner()`
  - `cli/src/commands/output.rs` — `print_banner_header`, `print_banner_line`, `print_network_lines`, `Styles`
- **Regions:**
  - **Header** — `Code Agent Host vX.Y.Z ready in Xms`
  - **`➜` lines** — Tunnel (conditional), Local (`ws://localhost:{port}?tkn=…`), Network (per-interface `ws://{ip}:{port}` or `use --host to expose` hint), Manage (`code agent ps | code agent kill`)
  - **Sentinel** — `__VSCODE_AGENT_HOST_READY__` (handshake; printed before stdio redirect)
- **States:**
  - **Fresh spawn** — full banner + sentinel.
  - **Reuse existing** — reuse banner with stored host/port/token.
  - **Config conflict** — error + exit code 2.
  - **Loopback vs exposed** — Network line shows interface IPs (`--host`) or the expose hint.

---

## V14 — CLI: `agent ps` Session List

Lists agent sessions known to the running host (flow C3).

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (package `cli`)
- **Location:** `cli/src/commands/agent_ps.rs` — `agent_ps()`, `format_sessions_list()`, `status_styled()`; pager via `cli/src/commands/output.rs` `print_paged()`
- **Regions** (human):
  - Per-session block — bold title + colored status bullet; indented `uri:` (cyan), `provider:`, optional `activity:`, optional `cwd:`
  - Status bullets — `● input needed` (yellow), `● in progress` (green), `● error` (red), `○ idle` (dim), `? unknown (code)` (dim)
- **States:**
  - **Empty** — "No active sessions."
  - **Populated** — paged list.
  - **Filtered** — active-only (default) vs `--all` (includes idle/archived).
  - **JSON** — `--json` prints a pretty JSON array instead of the table.

---

## V15 — CLI: `agent logs` Event Stream

Session metadata header followed by a live event stream (flow C4).

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (package `cli`)
- **Location:** `cli/src/commands/agent_logs.rs` — `agent_logs()`, `print_initial_state()`, `print_action()`, `action_style()`
- **Regions:**
  - **Session header** — `Session {uri}` (cyan) + indented `title:` / `provider:` / `activity:` / `turns:` (with per-turn state icons `✓`/`⊘`/`✗` and `► active turn`) / `seq:`
  - **Stream header** — `Streaming events (Ctrl+C to quit)...` + rule line
  - **Event lines** — `[{seq:>6}] {TYPE} {param}={value} …`, colored by type (error=red, complete=green, cancel=yellow, ToolCall=blue, delta/reasoning=dim, else cyan)
- **States:**
  - **Initial snapshot** — header + past turns.
  - **Streaming / follow** — live events until Ctrl+C or subscription close.
  - **Interrupted** — stop message on Ctrl+C.

---

## V16 — CLI: `agent stop` / `agent kill` Result

Single-line result lines for cancelling a turn or killing the host (flow C5).

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (package `cli`)
- **Location:** `cli/src/commands/agent_stop.rs`, `cli/src/commands/agent_kill.rs` — `ctx.log.result(...)`
- **Regions:** single result line to stdout.
- **States:**
  - **`stop`** — `Cancelled turn {id} on {uri}` / `No active turn to cancel.`
  - **`kill`** — `Killed agent host (pid N).` / `Agent host is not running (stale lockfile cleaned up).` / no-lockfile error (`Start one with code agent host`).

---

## V17 — CLI: `tunnel` / `serve-web` / `status` / `version`

Inherited-upstream + fork-flavored CLI output for remote access and version management (flows C2, C6, C7).

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (package `cli`)
- **Location:**
  - `cli/src/commands/tunnels.rs` — `serve()` (`Listening on {addr}`), `status()` (JSON `{tunnel, service_installed}`), `kill/restart/rename/prune`, `user login/logout/show`
  - `cli/src/commands/serve_web.rs` — `Web UI available at {url}` / `Web UI available on {socket}`
  - `cli/src/commands/version.rs` — `show()` (quality + path / "No existing installation found"), `switch_to()` / `print_now_using()`
  - `cli/src/bin/code/main.rs` — `status` forwarded to the editor binary
- **Regions:** single result lines / JSON objects via `log.result()`; interactive auth prompts for `tunnel user login`.
- **States:**
  - **Listening (long-running)** — serve / serve-web print the bound address/URL (random port resolved, optional base path & `?tkn=` token).
  - **Status** — tunnel object populated / `null`; `service_installed` flag.
  - **Auth prompt** — interactive device-flow login.
  - **Version** — found (quality + path) / not found (install prompt, exit 1).
  - **Diagnostic** — `log.emit(level, …)` timestamped/colored lines (Trace…Critical) under the above.

---

## V18 — Launcher Terminal Output (scripts)

Human-readable handshake/status output from the dev/CI launchers — the only supported way to start each surface, and a contract parsed by tooling and CI (`AX-REPO-SERVER-LAUNCH-HANDSHAKE`).

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (package `scripts`)
- **Location:**
  - `scripts/code-server.js` — parses `Web UI available at (.*)`; `VSCODE_SERVER_PORT=9888`
  - `scripts/code-agent-host.js` — parses `READY:(\d+)`; help text; default port `8081` (`VSCODE_AGENT_HOST_PORT`)
  - `scripts/code-sessions-web.js` — prints `Sessions Web running at: http://{HOST}:{PORT}/`; default port `8081`
  - `scripts/code-web.js` — prints `Starting @vscode/test-web: …`; default port `8080`; delegates readiness to `@vscode/test-web`
  - `scripts/{code.sh,code.bat}` (Electron desktop), `scripts/code-cli.sh` (`--inspect=5874` on `out/cli.js`), `scripts/{code-server.sh,code-web.sh}` (download builtins → resolve Node → exec the `.js`)
- **Regions:**
  - **Readiness handshake line** — `Web UI available at …` (server 9888), `READY:{port}` (agent host 8081), `Sessions Web running at http://…` (sessions web 8081)
  - **Launch/info line** — `Starting @vscode/test-web …` (web 8080); help/usage text (agent host)
  - **Build/progress** — `download-builtin-extensions` output (server/web shell wrappers)
- **States:**
  - **Starting / building** — pre-launch download + Node resolution.
  - **Ready** — handshake line emitted (captured by the script to detect readiness).
  - **Inherited stdio** — `code-web.js` passes stdio through to the subprocess; desktop launchers print no server handshake.
  - **Error** — non-zero subprocess exit propagated.

> Default ports referenced across V13–V18: server `9888`, web `8080`, agent-host / sessions-web `8081`, CLI control `31546` (`AGENT_HOST_PORT`).

---

## Cross-cutting notes

- **Window isolation** — V1–V11 render only in the Agents Window (`WindowVisibility.Sessions`); none mount inside the main workbench (`AX-REPO-AGENTS-WINDOW-DISTINCT-WINDOW`).
- **Flag isolation** — V12 is the only fork view inside inherited terminal code; with `terminal.integrated.agentTabs.enabled` off it is invisible and the surface is byte-identical to upstream (`AX-TERMINAL-AGENT-TABS`, `scripts/verify-seam.sh`).
- **Per-session layout state** — V4/V6/V9 visibility (auxiliary bar, panel, editor working sets) is remembered per session by `LayoutController` (`src/vs/sessions/contrib/layout/browser/sessionLayoutController.ts`; see `LAYOUT_CONTROLLER.md` and `LAYOUT.md`).
- **Handshake contracts** — V13 (`__VSCODE_AGENT_HOST_READY__`, `READY:`), V17 (`Web UI available at`), and V18 are a cross-surface contract between CLI/server emitters and `scripts/` consumers (`AX-REPO-SERVER-LAUNCH-HANDSHAKE`).
