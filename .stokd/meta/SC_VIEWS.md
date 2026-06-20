<!-- stokd-meta: SC_VIEWS.md | metaVersion 0.5.0 | generated: FRESH -->
# SC_VIEWS — `code-oss-dev` View Classification

> View-classification document. Fresh generation, meta version 0.5.0.
> Repo: `/opt/worktrees/stokd-cloud/stokd-ide/main` — single product `code-oss-dev` (stokd-ide), a thin-patch fork of `microsoft/vscode`.
>
> Scope: this document catalogs the **fork-distinguishing** views — the Agents Window (`src/vs/sessions/`), the fork additions inside inherited workbench code (the flag-gated agent terminal selector, the chat Image Carousel, the empty-editor watermark video), the fork-owned Copilot Chat extension dialogs (`extensions/copilot/`), the Rust `code` CLI terminal-output views (`cli/`), and the dev/CI launcher terminal output (`scripts/`). The full inherited VS Code workbench (editors, panels, SCM, settings, etc.) is upstream and out of scope here — it is exercised by flows W1–W4 and re-verified, not re-documented (see `AX-REPO-FORK-TDD-SCOPE`). Every view below belongs to the single product documented in **SC_PRODUCT_CODE_OSS_DEV.md**.
>
> A "view" here is any distinct screen, panel, page, modal, overlay, or terminal-output surface a user perceives as a unit. Each entry records the implementing source file(s), the layout **Regions** (zones + the widget that renders each), and the meaningful **States**.

---

## View Index

| # | View | Surface family | Product flows |
|---|------|----------------|---------------|
| V1 | Agents Window — Shell / Layout | Agents Window (`src/vs/sessions/`) | S1–S9 |
| V2 | Titlebar | Agents Window | S2, S3, S6, S9 |
| V3 | Project Bar | Agents Window | S6, S7 |
| V4 | Sessions List (Sidebar) | Agents Window | S5, S6, S7 |
| V5 | Session View / Chat | Agents Window | S3, S5, S7 |
| V6 | New Chat / New Session | Agents Window | S3, S4 |
| V7 | Changes View (Auxiliary Bar) | Agents Window | S8 |
| V8 | Account / Copilot Status Panel | Agents Window | S2 |
| V9 | First-Launch Welcome / Setup | Agents Window | S1 |
| V10 | Modal Editor Overlay | Agents Window | S8, S9 |
| V11 | Agent Feedback Editor Overlay | Agents Window | S8 |
| V12 | AI Customization Tree View | Agents Window | S5 |
| V13 | Policy-Blocked Overlay | Agents Window | S1, S2 |
| V14 | Sessions Panel / Terminal | Agents Window | S9 |
| V15 | Aquarium Overlay (easter egg) | Agents Window | — |
| V16 | Open-in-VS-Code Widget | Agents Window | S9 |
| V17 | Mobile / Phone Layout | Agents Window (web) | S1–S8 |
| V18 | Agent Terminal Selector | Terminal seam (`agentTabs/`) | T1 |
| V19 | Image Carousel | Workbench fork add (`imageCarousel/`) | S5 (chat images) |
| V20 | Empty-Editor Watermark | Workbench fork add (`editorGroupWatermark`) | W1 |
| V21 | Copilot Slash-Command Dialogs | Copilot extension (`extensions/copilot/`) | S3–S5 |
| V22 | Copilot Permission / Question Carousel | Copilot extension | S3–S5 |
| V23 | CLI — `agent host` Supervisor Banner | Rust CLI (`cli/`) | C2 |
| V24 | CLI — `agent ps` Session List | Rust CLI | C3 |
| V25 | CLI — `agent logs` Event Stream | Rust CLI | C4 |
| V26 | CLI — `agent stop` / `agent kill` Result | Rust CLI | C5 |
| V27 | CLI — `tunnel` / `serve-web` / `status` / `version` / `update` | Rust CLI | C2, C6, C7 |
| V28 | Launcher Terminal Output | Scripts (`scripts/`) | C2 |

> Products column: every view above is exposed by the single product doc **SC_PRODUCT_CODE_OSS_DEV.md** (`code-oss-dev`; packages `cli`, `extensions`, `remote`, `scripts`, `test` layered on the primary `src/` app). The "Surface family" names which surface of that one product owns the view.

---

## Surface family A — Agents Window (`src/vs/sessions/`)

Views V1–V17 render **only** in the Agents Window (`WindowVisibility.Sessions`), a distinct fixed-layout window, never a panel inside the main workbench (`AX-REPO-AGENTS-WINDOW-DISTINCT-WINDOW`).

### V1 — Agents Window: Shell / Layout

The root fixed-layout workbench window that hosts every other Agents Window view.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/browser/workbench.ts` — `Workbench` (grid construction, lifecycle)
  - `src/vs/sessions/browser/parts/sessionsPart.ts` — central Sessions Part (internal grid of session views)
  - `src/vs/sessions/browser/parts/{sidebarPart,auxiliaryBarPart,panelPart,titlebarPart,editorPart,projectBarPart}.ts`
  - `src/vs/sessions/browser/parts/{parts.ts,sessionsParts.ts,editorParts.ts}` — part registration/factories
  - `src/vs/sessions/browser/layoutPolicy.ts` — viewport class & layout actions
  - Entry points: `sessions.desktop.main.ts` (Electron), `sessions.web.main.ts` (web standalone), `sessions.common.main.ts`
  - `src/vs/sessions/browser/media/style.css` — `.agent-sessions-workbench` shell, accent radial gradient
- **Regions:**
  - **Titlebar** (top, full width) — V2
  - **Project Bar** (left edge) — V3 (project folder switcher)
  - **Sidebar** (left, ~300px) — Sessions List (V4); flush, no card; footer hosts account widget
  - **Sessions Part** (center) — internal `SerializableGrid` of one or more Session Views (V5); card appearance
  - **Editor** (in grid, beside Sessions Part) — hidden by default; opens as modal overlay (V10)
  - **Auxiliary Bar** (right, ~340px) — Changes View (V7); card appearance
  - **Panel** (below, ~300px) — Sessions Terminal output (V14); hidden by default; card appearance
  - Excluded vs. stock workbench: **no activity bar, no status bar, no banner**
- **States:**
  - **Part visibility** — initial: Sidebar ✅, Sessions Part ✅, Auxiliary Bar ✅, Editor ❌, Panel ❌. Visibility classes `nosidebar` / `noauxiliarybar` / `nosessionspart` / `nopanel` toggled on `.agent-sessions-workbench`.
  - **Restoring** — on startup `ISessionsViewService.restoreVisibleSessions()` rebuilds the grid atomically before first paint (`src/vs/sessions/services/sessions/browser/{sessionsViewService.ts,visibleSessions.ts}`).
  - **Maximized session** — one session view maximized within the Sessions Part internal grid.
  - **No-op feature states** — Zen Mode / Centered Layout / Menu Bar Toggle / Maximize Aux Bar are no-ops.
  - **Viewport class** — `phone` / `tablet` / `desktop` (drives V17 swap), from `layoutPolicy.ts`.
  - **Policy-blocked** — entire shell covered by the impassable overlay (V13).
  - **High-contrast** — disables the accent radial gradient.

---

### V2 — Titlebar

Standalone three-section titlebar (`TitlebarPart`, not `BrowserTitlebarPart`). No menubar, no editor actions.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/browser/parts/titlebarPart.ts` (desktop), `electron-browser/parts/titlebarPart.ts`
  - `src/vs/sessions/browser/parts/mobile/mobileTitlebarPart.ts` (phone)
  - `src/vs/sessions/browser/parts/menubar.contribution.ts`, `browser/menus.ts` — menu IDs
  - `src/vs/sessions/browser/sessionStatusIcon.ts` — session status icon
  - `src/vs/sessions/browser/accountTitleBarState.ts` — account widget state
- **Regions:**
  - **Left** (`Menus.TitleBarLeftLayout`) — toggle sidebar, **agent host filter** pill
  - **Center** (`Menus.CommandCenter`) — **session picker** widget (provider icon · session title · workspace · branch/worktree · `+ins -del` changes summary); plus `Menus.TitleBarSessionMenu` for active-session actions; opens the session switcher quick pick on click
  - **Right** (`Menus.TitleBarRightLayout`) — **Run script** split button, **Open Terminal**, **Open in VS Code** (V16), toggle auxiliary bar, **account widget** (V8)
  - macOS custom-titlebar: traffic-light spacer in sidebar (70px)
- **States:**
  - **Session active** — picker renders full chrome (icon, title, workspace, branch, change stats).
  - **No active session** (new-chat draft) — picker hides its chrome (center empty); Run script disabled.
  - **Host filter** — visible only when multiple remote agent hosts are known; acts as re-discover trigger when none are known.
  - **Account widget** — loading / signed-in (avatar + quota badge) / sign-in needed; badge kinds `default`/`accent`/`warning`/`prominent`; dot badge none/warning/error. See V8.
  - **Fullscreen** — titlebar may hide/show (desktop).

---

### V3 — Project Bar

A vertical project-folder switcher Part along the left edge, listing project entries persisted in workspace storage so the user can pivot the Agents Window to a different folder/workspace.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/browser/parts/projectBarPart.ts` — `ProjectBarPart extends Part`; storage key `workbench.agentsession.projectbar.folders`; hover group `projectbar`
  - `src/vs/sessions/browser/parts/media/projectBarPart.css`
- **Regions:**
  - **Folder entry list** — one selectable button per stored project folder (icon + name on hover)
  - **Customize action** — `projectbar.customize` ("Customize") opens a quick pick to add/remove/reorder folders
- **States:**
  - **Populated** — one or more project entries.
  - **Empty** — no stored folders.
  - **Selected / active** — the entry matching the active session's workspace is highlighted.
  - **Customize** — quick pick open (add/remove/reorder).
  - **Hover** — entry name tooltip (`projectbar` hover group).

---

### V4 — Sessions List (Sidebar)

The session inventory: a tree of sessions grouped by workspace/date with a pinned section, plus the account-widget footer.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/contrib/sessions/browser/views/sessionsList.ts` — tree widget, grouping/sorting, item rendering
  - `src/vs/sessions/contrib/sessions/browser/views/sessionsView.ts` — `ViewPane` container, header, actions
  - `src/vs/sessions/contrib/sessions/browser/views/sessionsViewActions.ts` — rename/pin/read/archive actions
  - `src/vs/sessions/browser/parts/sidebarPart.ts` — sidebar part + footer toolbar
  - `src/vs/sessions/browser/parts/sessionDropTarget.ts` — drag/drop target
  - `src/vs/sessions/browser/sessionStatusIcon.ts` — per-item status icon
- **Regions:**
  - **Header** — view title + actions (sort/group); on phone a filter-chip row (V17)
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

### V5 — Session View / Chat

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
  - **Chat view** (below bars) — one of `'newSession'` (V6), `'newChatInSession'` (V6 variant), or `'chat'` (`ChatView` rendering `session.activeChat`); inner content capped to 950px and centered, viewport full-width for edge-aligned scrollbar
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
  - **Mobile** — replaced by single-session host (`MobileSessionsPart`, V17).

---

### V6 — New Chat / New Session

The empty-slot composer: workspace + session-type (+ model) pickers and the first-message input. Also the in-session new-chat variant.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/contrib/chat/browser/newChatWidget.ts` — composes pickers + input; disposal-guarded async workspace handler
  - `src/vs/sessions/contrib/chat/browser/newChatInput.ts` — input + button bar
  - `src/vs/sessions/contrib/chat/browser/newChatInSessionWidget.ts` — new-chat-in-existing-session variant
  - `src/vs/sessions/contrib/chat/browser/{sessionWorkspacePicker.ts,webWorkspacePicker.ts}` — workspace picker (desktop / web GitHub-org)
  - `src/vs/sessions/contrib/chat/browser/{sessionTypePicker.ts,modelPicker.ts}` — type & model selectors
  - `src/vs/sessions/contrib/chat/browser/noAgentHostEmptyState.ts` — empty state when no host
  - Mobile sheets: `src/vs/sessions/contrib/chat/browser/mobile/{mobileWorkspacePickerSheet.ts,mobileSessionTypePicker.ts}`
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

### V7 — Changes View (Auxiliary Bar)

Reviews and lands the file changes an agent produced for the active session: changeset tree, diffs, CI checks, sync/apply.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/contrib/changes/browser/changesView.ts` — `ViewPane`
  - `src/vs/sessions/contrib/changes/browser/changesViewRenderer.ts` — tree item rendering
  - `src/vs/sessions/contrib/changes/browser/changesViewModel.ts` — state
  - `src/vs/sessions/contrib/changes/browser/checksWidget.ts` — CI status widget
  - `src/vs/sessions/browser/parts/auxiliaryBarPart.ts` — host part
  - Related: `src/vs/sessions/contrib/codeReview/browser/` (run code review), `contrib/applyCommitsToParentRepo/` (sync to parent)
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
  - **Mobile** — hidden in aux bar; accessed via a titlebar **Changes** pill → full-screen overlay (V17).

---

### V8 — Account / Copilot Status Panel

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

### V9 — First-Launch Welcome / Setup

A one-time modal shown on first launch of the Agents Window per profile.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/browser/sessionsSetUpService.ts` — service + `SessionsSetUpWidget`
  - `src/vs/sessions/common/welcome.ts` — `WELCOME_COMPLETE_KEY` (`workbench.agentsession.welcomeComplete`), `shouldSkipSessionsWelcome`
  - `src/vs/sessions/browser/media/sessionsSetUp.css`
- **Regions:**
  - **Modal** — title ("Welcome to Agents"), markdown body (product + sign-in info), action buttons (Continue / Sign Out), optional GitHub sign-in flow
- **States:**
  - **Visible** — first launch only (storage key unset, not smoke test/URL-skipped, default chat agent configured); `SessionsWelcomeVisibleContext`.
  - **Signing in** — async auth flow.
  - **Complete** — writes `WELCOME_COMPLETE_KEY`, fires `onCompleted`, closes.
  - **Skipped** — never shown when no default agent is configured.

---

### V10 — Modal Editor Overlay

Editors open as modal overlays instead of occupying grid space (`workbench.editor.useModal: 'all'`).

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/browser/parts/{editorPart.ts,editorParts.ts}` — `ModalEditorPart`
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

### V11 — Agent Feedback Editor Overlay

An in-editor overlay for reviewing/navigating agent feedback and inline session comments on a file opened in the modal editor (V10).

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/contrib/agentFeedback/browser/agentFeedbackEditorOverlay.ts` — `AgentFeedbackOverlayWidget` / `AgentFeedbackOverlayController`
  - `src/vs/sessions/contrib/agentFeedback/browser/agentFeedbackEditorWidgetContribution.ts` — editor contribution
  - `src/vs/sessions/contrib/agentFeedback/browser/agentFeedbackOverviewRulerContribution.ts` — overview-ruler marks
  - `src/vs/sessions/contrib/agentFeedback/browser/{agentFeedbackHover.ts,sessionEditorComments.ts,agentFeedbackAttachmentWidget.ts,agentFeedbackModel.ts,agentFeedbackService.ts}`
  - `src/vs/sessions/contrib/agentFeedback/browser/media/`
- **Regions:**
  - **Overlay widget** (`.agent-feedback-editor-overlay-widget`) — floating toolbar (`.agent-feedback-editor-overlay-toolbar`) with prev/next navigation and a position label (`{0}/{1}`)
  - **Overview ruler** — feedback marks down the scrollbar gutter
  - **Inline comment hover** — comment content from `getSessionEditorComments`
  - **Attachment widget** — feedback attachment preview
- **States:**
  - **Empty** — `0/0` label, no marks.
  - **Populated** — `N/M` count; navigation cycles between feedback items.
  - **Hover** — comment hover expanded.
  - **Editing / submitting** — feedback attachment compose/submit.

---

### V12 — AI Customization Tree View

A sidebar `ViewPane` listing the AI-customization files (prompts, instructions, agent definitions) discoverable for the active workspace, with per-item actions, plus an overview view.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/contrib/aiCustomizationTreeView/browser/aiCustomizationTreeViewViews.ts` — `AICustomizationViewPane`, context keys (`AICustomizationItemType/Disabled/Storage`)
  - `src/vs/sessions/contrib/aiCustomizationTreeView/browser/aiCustomizationTreeView.contribution.ts` — view + action registration (Open, Run Prompt, Copy Path, Delete)
  - `src/vs/sessions/contrib/aiCustomizationTreeView/browser/{aiCustomizationTreeView.ts,aiCustomizationOverviewView.ts}`
- **Regions:**
  - **Tree** — customization items grouped by type/storage scope; per-item inline actions (Run Prompt ▶, Open, Copy Path, Delete 🗑)
  - **Overview view** — summary/landing pane (`aiCustomizationOverviewView.ts`)
  - **Delete confirmation** — modal dialog ("Are you sure you want to delete '{0}'?")
- **States:**
  - **Populated / empty** — items present vs none.
  - **Item enabled / disabled** — `AICustomizationItemDisabledContextKey`.
  - **Storage scope** — user vs workspace (`AICustomizationItemStorageContextKey`).
  - **Deleting** — confirmation dialog open.
  - **Running** — Run Prompt dispatched to a session.

---

### V13 — Policy-Blocked Overlay

A full-window impassable modal shown when enterprise policy blocks the Agents app entirely.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/contrib/policyBlocked/browser/sessionsPolicyBlocked.ts` — `SessionsPolicyBlockedOverlay` (`.sessions-policy-blocked-overlay`, `role=dialog`, `aria-modal=true`, self-focusing)
  - `src/vs/sessions/contrib/policyBlocked/browser/policyBlocked.contribution.ts`
- **Regions:**
  - **Impassable overlay** — full-window dialog covering the entire shell (V1); explanatory text + any policy action links
- **States:**
  - **Visible** — chat/agent features disabled by policy; overlay covers everything and traps focus.
  - **Hidden** — policy permits use; overlay absent.

---

### V14 — Sessions Panel / Terminal

The Agents Window bottom panel hosting terminals, scoped to the active session by working directory, plus the agent-host session task runner.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/contrib/terminal/browser/sessionsTerminalContribution.ts` — `SessionsTerminalViewVisibleContext`; terminals shown/hidden by initial cwd matching the active session path
  - `src/vs/sessions/contrib/terminal/browser/agentHostSessionTaskRunner.ts` — runs session tasks in terminals
  - `src/vs/sessions/browser/parts/panelPart.ts` — host part (`TERMINAL_VIEW_ID`)
- **Regions:**
  - **Panel** (bottom) — terminal view hosting one or more terminal instances; "Open Terminal" / Run script (V2 titlebar) target this panel
- **States:**
  - **Hidden by default** — panel off until a terminal/task is opened (`nopanel` on V1 shell).
  - **Scoped-visible** — a terminal is visible when its initial cwd matches the active session's path (`SessionsTerminalViewVisibleContext`).
  - **Task running** — agent-host task runner streaming output.
  - **Switched session** — terminal set re-filters to the newly active session's cwd.

---

### V15 — Aquarium Overlay (easter egg)

A toggleable animated-fish overlay painted behind the workbench — a developer-joy easter egg.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/sessions/contrib/aquarium/browser/aquariumOverlay.ts` — `AquariumService` (animation loop, spontaneous bursts, turn-back margins)
  - `src/vs/sessions/contrib/aquarium/browser/{fish.ts,vscodeLogoPath.ts,aquarium.contribution.ts}`, `browser/media/`
- **Regions:**
  - **Background canvas/overlay** — animated fish swimming behind the shell content
- **States:**
  - **Active** — fish animating ("Hide Aquarium" action shown); occasional speed bursts.
  - **Inactive** — overlay hidden ("Show Aquarium" action shown).
  - **Suspended** — stops painting when another view takes its place.

---

### V16 — Open-in-VS-Code Widget

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

### V17 — Mobile / Phone Layout

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
  - **Single-file diff** (`mobileDiffView.ts`) — header (filename + `+N −N` + prev/next nav) + scrollable unified-diff body; swipe between sibling files; generation-guarded async render.
  - **Multi-file diff** (`mobileMultiDiffView.ts`) — virtualized file sections; per-file `loadState` `idle`/`loading`/`loaded`/`empty`/`error`, `loadKind` `visible`/`prefetch`, collapsed/expanded; deterministic virtual heights.

---

## Surface family B — Workbench fork additions (`src/vs/workbench/`)

Fork code that lives **inside** inherited workbench contributions (not the Agents Window). V18 is flag-gated and byte-identical to upstream when off (`AX-TERMINAL-AGENT-TABS`); V19/V20 are fork-added surfaces fed by chat content.

### V18 — Agent Terminal Selector (flag-gated terminal seam)

An experimental replacement for the terminal tabs strip that hosts the code-ext Sessions webview as the selector beside the live terminal, with persisted selector width and native split-group awareness. Gated by `terminal.integrated.agentTabs.enabled` (default `false`) **and** a registered webview resolver for the configured view id; otherwise the terminal is byte-identical to upstream.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - Seam: `src/vs/workbench/contrib/terminal/browser/terminalView.ts` — `_createTabsView()` / `_updateTabsView()` branch through the `ITerminalTabsView` interface
  - `src/vs/workbench/contrib/terminal/browser/agentTabs/ITerminalTabsView.ts` — seam interface (`rerenderTabs`, `layout`, `setEditable`, `focusTabs`, `focus`, `focusHover`)
  - `agentTabs/agentTabsSeam.ts` — `shouldUseAgentTabs()` (flag + view id + resolver), `shouldRebuildTabsView()` (activation-race guard)
  - `agentTabs/agentTabsContribution.ts` — settings `terminal.integrated.agentTabs.enabled` (`default: false`) and `terminal.integrated.agentTabs.viewId` (`default: DEFAULT_TERMINAL_AGENT_TABS_VIEW_ID`)
  - `agentTabs/agentTerminalTabbedView.ts` — `AgentTerminalTabbedView` (horizontal `SplitView`: selector cell + terminal cell)
  - `agentTabs/agentTerminalWebviewHost.ts` — `AgentTerminalWebviewHost` (hosts the code-ext `IOverlayWebview` in the selector cell)
  - `agentTabs/agentTerminalHostController.ts` — hosts the live xterm terminal groups
  - `agentTabs/agentTerminalSelectorWidth.ts` — `SelectorWidthController` (persisted width, storage key `stokd.agentTabs.selectorWidth`, bounds `[46, 600]` capped at `floor(total/2)`)
  - `agentTabs/agentTerminalSelectorModel.ts` — stateful model + event fan-in (built-in rows and provider rows)
  - `agentTabs/agentTerminalSelectorRows.ts` — pure builders `mergeSelectorRows` / `buildProvidedSelectorRows`, `AgentRunState`, `IAgentRowMeta`
  - `agentTabs/agentTerminalSplitGroups.ts` — `computeSplitGroupIds()` (native split-group → id map)
  - `agentTabs/terminalTabGroupingProviderService.ts` — in-renderer bridge to the extension grouping provider
  - Proposed API: `src/vscode-dts/vscode.proposed.terminalTabGrouping.d.ts` (`TerminalHandle`, `registerTerminalTabGroupingProvider`, `getTerminalHandles`, `activateTerminalById`)
  - Stock fallback (flag off / no resolver): `src/vs/workbench/contrib/terminal/browser/terminalTabbedView.ts`
- **Regions:**
  - **SplitView** (`Orientation.HORIZONTAL`, non-proportional) — selector cell + terminal cell; selector index 0 or 1 by `tabs.location`
  - **Selector cell** (`.agent-terminal-tabs-webview` + `.agent-terminal-tabs-webview-anchor`) — hosts the code-ext Sessions webview overlay; anchor reserves the sash edge so the drag handle stays grabbable
  - **Terminal cell** — live xterm groups (`AgentTerminalHostController`)
  - **Selector rows model** (rendered by the hosted webview): **group headers** ("Terminals", "Agents", or provider-defined sections with counts/collapse), **terminal rows**, **agent rows** (session title + run state + badge), or **provided items** (extension model)
- **States:**
  - **Flag off / no resolver (default)** — stock `TerminalTabbedView`, upstream-identical; the seam never shows a broken/empty strip.
  - **Live swap** — `shouldRebuildTabsView()` swaps views when the flag or resolver registration flips after panel init (no reload).
  - **Selector width** — restored once from storage on first `layout()`; preserved across relayout; persisted on sash drag.
  - **Per-agent run state** (`AgentRunState`) — `idle` / `running` / `background` (+ `pendingApprovals` reserved).
  - **Dedup** — an instance that is both terminal and agent renders once under Agents (agent identity wins by `instanceId`).
  - **Split groups** — native groups with ≥2 instances tagged with the min-instanceId split id (exposed via `TerminalHandle.splitGroupId`).
  - **Provider model** — extension-supplied N-section grouping takes precedence when a provider is registered; rows carry `status` `idle`/`running`/`attention`.
  - **Empty / collapsed** — no terminals & no agents → no rows; collapsed header keeps its count, hides its rows.

---

### V19 — Image Carousel

A modal slideshow editor for viewing collections of images (and videos) — opened from chat image attachments and response-derived images. Preview-gated by `chat.imageCarousel.enabled` (default `false`).

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/workbench/contrib/imageCarousel/browser/imageCarouselEditor.ts` — editor pane (DOM, zoom, navigation)
  - `src/vs/workbench/contrib/imageCarousel/browser/imageCarouselEditorInput.ts` — editor input (`vscode-image-carousel` scheme, non-serializable)
  - `src/vs/workbench/contrib/imageCarousel/browser/imageCarouselTypes.ts` — `ICarouselImage` / `ICarouselSection` / `IImageCarouselCollection`
  - `src/vs/workbench/contrib/imageCarousel/browser/imageCarousel.contribution.ts` — registration + `workbench.action.chat.openImageInCarousel`
  - `src/vs/workbench/contrib/imageCarousel/browser/media/`
- **Regions** (`.slideshow-container`):
  - **Image area** — `.main-image-container` with `.main-image` (`<img>`) or a webview `.video-container` for `video/*` MIME types; prev/next arrows
  - **Bottom bar** — `.caption-text` + `.caption-separator` + `.counter` ("3 / 15")
  - **Thumbnail strip** — `sectionsContainer` (section-grouped thumbnails)
- **States:**
  - **Modal** — opens in `MODAL_GROUP` (overlay), not restorable.
  - **Preview-gated** — when `chat.imageCarousel.enabled` is off, image clicks fall through to `openResource()`; the carousel never opens.
  - **Zoom** — `ZoomScale = number | 'fit'`; levels `0.1…20` (+ `fit`); pixelated ≥3×; click/Alt-click/Ctrl-scroll/pinch gestures; resets to `fit` on navigation.
  - **Image kind** — static image vs hosted video webview.
  - **Navigation** — index across the flattened section images; counter + thumbnail selection track position.

---

### V20 — Empty-Editor Watermark

The empty editor group's keybinding-hint watermark, augmented with an animated logo that plays on hover (a fork enhancement to an inherited surface).

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md
- **Location:**
  - `src/vs/workbench/browser/parts/editor/editorGroupWatermark.ts` — `.letterpress` static SVG + `.letterpress-anim` video overlay (`electric-loop.webm`, loaded via `FileAccess.asBrowserUri`)
  - `src/vs/workbench/browser/parts/editor/media/{editorgroupview.css,electric-loop.webm}`
- **Regions:**
  - **Letterpress logo** (`.letterpress`) — static product SVG background, centered in the empty editor group
  - **Animated overlay** (`.letterpress-anim`) — absolutely-positioned looping muted VP9 video, scaled via `--logo-anim-scale`
  - **Keybinding hints** — the inherited shortcut list below the logo
- **States:**
  - **Static (default)** — SVG shown, video hidden (`opacity: 0`).
  - **Hover-playing** — on `.letterpress` mouseenter the video plays (looping, muted), `.letterpress-animating` hides the static SVG to avoid alpha double-imaging.
  - **Reset** — on mouseleave the video pauses and resets; static SVG returns.

---

## Surface family C — Copilot Chat extension dialogs (`extensions/copilot/`)

The fork-owned `copilot` (`copilot-chat`) extension powers the chat content rendered inside the Agents Window (and VS Code chat). Its chat transcript renders through VS Code's native chat UI; the distinct extension-owned surfaces are the slash-command quick-pick/input flows and the agent permission/question dialogs.

### V21 — Copilot Slash-Command Dialogs

Quick-pick and input-box wizards triggered by `/`-commands in a Claude chat session.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (package `extensions`)
- **Location:** `extensions/copilot/src/extension/chatSessions/claude/vscode-node/slashCommands/`
  - `agentsCommand.ts` (`/agents`), `hooksCommand.ts` (`/hooks`), `memoryCommand.ts` (`/memory`), `terminalCommand.ts` (`/terminal`), `claudeSlashCommandRegistry.ts`
- **Regions / flows:**
  - **`/agents`** — `showQuickPick` (list project + user agents, "Create new agent") → create wizard: location → method → description `showInputBox` → tools picker → model picker; or edit: agent → View/Edit/Delete
  - **`/hooks`** — event picker (PreToolUse, PostToolUse, PermissionRequest, UserPromptSubmit, Stop, …) → matcher picker ("+ Add new") → command `showInputBox` → settings-file location picker (Workspace/User)
  - **`/memory`** — location quick pick (User `~/.claude/CLAUDE.md`, Project `.claude/CLAUDE.md`, Project-local `.claude/CLAUDE.local.md`) → opens the file in an editor
  - **`/terminal`** — creates a terminal wired to the Copilot endpoint; on missing CLI shows an error message with a download-link button (`https://code.claude.com`)
- **States:**
  - **Selecting** — quick pick open (single or multi-select).
  - **Entering** — input box (optionally pre-filled for edits).
  - **Confirming** — destructive (delete agent) confirmation.
  - **Result** — markdown summary streamed to chat / file opened / terminal created.
  - **Error** — CLI missing (download prompt) / cancelled (no-op).

---

### V22 — Copilot Permission / Question Carousel

Permission-confirmation dialogs and the multi-choice question carousel raised by the Copilot CLI agent during a turn.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (package `extensions`)
- **Location:** `extensions/copilot/src/extension/chatSessions/copilotcli/node/`
  - `permissionHelpers.ts` — `handleReadPermission` / `handleWritePermission` / `handleShellPermission` / `handleMcpPermission` / `showInteractivePermissionPrompt`
  - `userInputHelpers.ts` — `IUserQuestionHandler` / `IQuestion` / `IQuestionAnswer`
  - Claude side: `extensions/copilot/src/extension/chatSessions/claude/common/toolPermissionHandlers/askUserQuestionHandler.ts` (delegates to the core `vscode_askQuestions` carousel)
- **Regions:**
  - **Confirmation dialog** — `CoreConfirmationTool` (read/write/MCP: title + message + JSON args / diff preview) or `CoreTerminalConfirmationTool` (shell: command text + intention + background flag)
  - **Question carousel** — header, question, message; option cards (label + description + recommended), optional free-form input, multi-select
- **States:**
  - **Auto-approved** — workspace-internal reads/writes approved without UI (held in the pending-invocation queue until resolved).
  - **Awaiting confirmation** — dialog shown; resolves `approve-once` / `denied-interactively-by-user`.
  - **Question pending** — carousel shown; resolves `{ selected[], freeText, skipped }`.
  - **Denied / skipped** — user declined → declination sent back to the agent.

---

## Surface family D — Rust `code` CLI (`cli/`)

Terminal-output views printed by the native CLI. Handshake strings (`__VSCODE_AGENT_HOST_READY__`, `Web UI available at …`) are a cross-surface contract consumed by `scripts/` and CI (`AX-REPO-SERVER-LAUNCH-HANDSHAKE`).

### V23 — CLI: `agent host` Supervisor Banner

Startup/reuse banner and readiness sentinel printed when supervising the Agent Host.

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (package `cli`)
- **Location:**
  - `cli/src/commands/agent_host.rs` — `run_supervisor()`, `print_reuse_banner()`
  - `cli/src/commands/output.rs` — `print_banner_header`, `print_banner_line`, `print_network_lines`, `Styles`
- **Regions:**
  - **Header** — `Code Agent Host vX.Y.Z  ready in {ms}ms` (cyan-bold title · dim version · dim elapsed)
  - **`➜` lines** — Tunnel (conditional), Local (`ws://localhost:{port}?tkn=…`), Network (per-interface `ws://{ip}:{port}` or dim `use --host to expose` hint), Manage (`code agent ps | code agent kill`)
  - **Sentinel** — `__VSCODE_AGENT_HOST_READY__` (handshake; printed before stdio redirect)
- **States:**
  - **Fresh spawn** — full banner + sentinel → exit 0.
  - **Reuse existing** — reuse banner with stored host/port/token (`Agent host supervisor already running (PID {pid})…`).
  - **Config conflict** — error (`…but {conflict}. Use code agent kill…`) → exit 2.
  - **Timeout / premature exit** — `Timed out after 300s…` / `…exited before becoming ready.` → exit 1.
  - **Loopback vs exposed** — Network line shows interface IPs (`--host`) or the expose hint.

---

### V24 — CLI: `agent ps` Session List

Lists agent sessions known to the running host (flow C3).

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (package `cli`)
- **Location:** `cli/src/commands/agent_ps.rs` — `agent_ps()`, `format_sessions_list()`, `status_styled()`; pager via `cli/src/commands/output.rs` `print_paged()`
- **Regions** (human):
  - Per-session block — bold title + colored status bullet; indented `uri:` (cyan), `provider:`, optional `activity:`, optional `cwd:`
  - Status bullets — `● input needed` (yellow), `● in progress` (green), `● error` (red), `○ idle` (dim), `? unknown ({code})` (dim)
- **States:**
  - **Empty** — `No active sessions.`
  - **Populated** — sorted newest-first; paged if taller than the terminal.
  - **Filtered** — active-only (default) vs `--all` (includes idle/archived).
  - **JSON** — `--json` prints `serde_json::to_string_pretty` array instead of the table.

---

### V25 — CLI: `agent logs` Event Stream

Session metadata header followed by a live event stream (flow C4).

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (package `cli`)
- **Location:** `cli/src/commands/agent_logs.rs` — `agent_logs()`, `print_initial_state()`, `print_action()`, `action_style()`
- **Regions:**
  - **Session header** — `Session {uri}` (cyan) + indented `title:` / `provider:` / `activity:` / `turns:` (with per-turn state icons `✓`/`⊘`/`✗` and `► active turn`) / `seq:`
  - **Stream header** — `Streaming events (Ctrl+C to quit)...` + rule line
  - **Event lines** — `[{seq:>6}] {TYPE} {param}={value} …`, colored by type (error=red, complete=green, cancel=yellow, ToolCall=blue, delta/reasoning=dim, notification=magenta, else cyan); params truncated ~80 chars
- **States:**
  - **Initial snapshot** — header + past turns.
  - **Streaming / follow** — live events until Ctrl+C or subscription close.
  - **Subscription closed** — `Subscription closed.` (dim).
  - **Interrupted** — `Interrupted.` on Ctrl+C.

---

### V26 — CLI: `agent stop` / `agent kill` Result

Single-line result lines for cancelling a turn or killing the host (flow C5).

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (package `cli`)
- **Location:** `cli/src/commands/agent_stop.rs`, `cli/src/commands/agent_kill.rs` — `ctx.log.result(...)`
- **Regions:** single result line to stdout.
- **States:**
  - **`stop`** — `Cancelled turn {id} on {uri}` / `No active turn to cancel.`
  - **`kill`** — `Killed agent host (pid N).` / `Agent host is not running (stale lockfile cleaned up).` / `No running agent host found. Start one with code agent host` / corrupt-lockfile / kill-failed errors.

---

### V27 — CLI: `tunnel` / `serve-web` / `status` / `version` / `update`

Inherited-upstream + fork-flavored CLI output for remote access and version management (flows C2, C6, C7).

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (package `cli`)
- **Location:**
  - `cli/src/commands/tunnels.rs` — `serve()` (`Listening on {addr}` / `Web UI available at http://{addr}{base}{?tkn=}`), `status()` (JSON `{tunnel, service_installed}`), `kill/restart/rename/prune`, `user login/logout/show`
  - `cli/src/commands/serve_web.rs` — `Web UI available at {url}` / `Web UI available on {socket}`
  - `cli/src/commands/version.rs` — `show()` (`Current quality: … / Installation path: …` or `No existing installation found`), `switch_to()` / `print_now_using()`
  - `cli/src/commands/update.rs` — `…is already up to date ({commit})` / `Update to {version} is available` / download progress / `Successfully updated to {version}`
  - `cli/src/bin/code/main.rs` — `status` forwarded to the editor binary
- **Regions:** single result lines / JSON objects via `log.result()`; interactive device-flow prompts for `tunnel user login`.
- **States:**
  - **Listening (long-running)** — serve / serve-web print the bound address/URL (random port resolved, optional base path & `?tkn=` token).
  - **Status** — tunnel object populated / `null`; `service_installed` flag.
  - **Auth prompt** — interactive device-flow login.
  - **Version** — found (quality + path) / not found (install prompt, exit 1).
  - **Update** — up-to-date / available / downloading (progress) / updated.
  - **Diagnostic** — `log.emit(level, …)` timestamped/colored lines (Trace…Critical) under the above.

---

## Surface family E — Launchers (`scripts/`)

### V28 — Launcher Terminal Output

Human-readable handshake/status output from the dev/CI launchers — the only supported way to start each surface, and a contract parsed by tooling and CI (`AX-REPO-SERVER-LAUNCH-HANDSHAKE`).

- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (package `scripts`)
- **Location:**
  - `scripts/code-server.js` — parses `Web UI available at (.*)`; `VSCODE_SERVER_PORT=9888`
  - `scripts/code-agent-host.js` — parses `READY:(\d+)`; help text; default port `8081` (`VSCODE_AGENT_HOST_PORT`)
  - `scripts/code-sessions-web.js` — prints `Sessions Web running at: http://{HOST}:{PORT}/`; default port `8081`
  - `scripts/code-web.js` — prints `Starting @vscode/test-web: …`; default port `8080`; `stdio: 'inherit'`
  - `scripts/{code.sh,code.bat}` (Electron desktop), `scripts/code-cli.sh` (`--inspect=5874` on `out/cli.js`), `scripts/{code-server.sh,code-web.sh}` (download builtins → resolve Node → exec the `.js`)
  - `scripts/package-and-install-macos.sh` — fork-local macOS package & install (gulp `darwin` bundle → `/Applications`)
- **Regions:**
  - **Readiness handshake line** — `Web UI available at …` (server 9888), `READY:{port}` (agent host 8081), `Sessions Web running at http://…` (sessions web 8081)
  - **Launch/info line** — `Starting @vscode/test-web …` (web 8080); help/usage text (agent host)
  - **Build/progress** — `download-builtin-extensions` output (server/web shell wrappers)
  - **macOS install lifecycle** — `package: building … / stop: quitting … / install: …app -> /Applications / launch: opening … / done: installed …`
- **States:**
  - **Starting / building** — pre-launch download + Node resolution; macOS install `building → stopping → installing → launching → done`.
  - **Ready** — handshake line emitted (captured by the script to detect readiness).
  - **Inherited stdio** — `code-web.js` passes stdio through to the subprocess; desktop launchers print no server handshake.
  - **Dry-run / skip-build** — macOS installer env knobs (`STOKD_IDE_DEPLOY_DRY_RUN`, `STOKD_IDE_SKIP_BUILD`, `STOKD_IDE_MINIFY`, …).
  - **Error** — non-zero subprocess exit propagated.

> Default ports referenced across V23–V28: server `9888`, web `8080`, agent-host / sessions-web `8081`, CLI control `31546` (`AGENT_HOST_PORT`).

---

## Cross-cutting notes

- **Window isolation** — V1–V17 render only in the Agents Window (`WindowVisibility.Sessions`); none mount inside the main workbench (`AX-REPO-AGENTS-WINDOW-DISTINCT-WINDOW`).
- **Flag/resolver isolation** — V18 is the only fork view inside inherited terminal code; with `terminal.integrated.agentTabs.enabled` off (or no registered webview resolver) it is invisible and the surface is byte-identical to upstream (`AX-TERMINAL-AGENT-TABS`, `scripts/verify-seam.sh`). V19/V20 are also preview/hover-gated additions to inherited workbench code.
- **Per-session layout state** — V5/V7/V10/V14 visibility (auxiliary bar, panel, editor working sets) is remembered per session by `LayoutController` (`src/vs/sessions/contrib/layout/browser/sessionLayoutController.ts`; see `LAYOUT_CONTROLLER.md` and `LAYOUT.md`).
- **Chat-fed surfaces** — V19 (image carousel) and V21/V22 (slash-command + permission dialogs) are raised by chat content/agents that surface inside V5; the chat transcript itself is rendered by VS Code's native chat UI (inherited) and is not a separate fork view.
- **Handshake contracts** — V23 (`__VSCODE_AGENT_HOST_READY__`, `READY:`), V27 (`Web UI available at`), and V28 are a cross-surface contract between CLI/server emitters and `scripts/` consumers (`AX-REPO-SERVER-LAUNCH-HANDSHAKE`).
