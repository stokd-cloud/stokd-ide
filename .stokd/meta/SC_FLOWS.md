<!-- stokd-meta: SC_FLOWS.md | metaVersion 0.6.0 | generated: UPGRADE (from 0.5.0) -->
# SC_FLOWS — `code-oss-dev` User Flow Classification

> User-flow classification document. Upgraded 0.5.0 → 0.6.0 (content preserved; the
> multi-provider agent-CLI work from PRs #4/#5 folded into T1/S3/S5 + cross-flow notes).
> Repo: `/opt/worktrees/stokd-cloud/stokd-ide/main` — single product `code-oss-dev`
> (stokd-ide, re-branded **Stokd Code**), a **thin-patch fork of `microsoft/vscode`**.
>
> A "flow" here is a distinct user journey / workflow: an actor with a goal,
> the ordered steps they take, the views they pass through, and how the flow
> starts. Flows split into four families that mirror the fork's surfaces:
> the inherited VS Code workbench (kept as-is), the flag-gated terminal seam,
> the Agents Window (`src/vs/sessions/`), and the Rust `code` CLI (`cli/`).
>
> **0.6.0 update (multi-provider LLM CLI):** PRs #4/#5 ("Chat Panel as Multi-Provider
> LLM CLI Surface" + Grok/P4) generalized agent sessions across **five** providers
> (Claude, Copilot, Codex, **Gemini**, **Grok**) and made the Agents Window **chat**
> the default launch surface for *every* provider via the revertible setting
> `chat.agentSessions.defaultSurface` (default `'chat'`), demoting the terminal
> selector (T1 / view V18) to an opt-in escape hatch. No flow IDs were added: the
> change is folded into **S3** (multi-provider type/model/permission-mode pickers,
> chat-as-default destination), **S5** (provider-agnostic permission-mode picker),
> **T1** (now opt-in), and the *Multi-provider agent-CLI* and *Default launch surface*
> cross-flow notes — preserving the W1–W4 / T1 / S1–S9 / C1–C7 regression-contract IDs.
>
> **0.6.0 view reconciliation:** SC_VIEWS' 0.6.0 pass catalogued three previously
> undocumented Agents Window surfaces — **V29 Sessions Files / Explorer** (the
> default auxiliary-bar container), **V30 Embedded Browser**, and **V31 Chat Debug**
> (dev-only). This SC_FLOWS pass wires them into the existing flows without adding
> flow IDs: V29 into **S7/S8** (and noted as the default aux-bar container behind
> the Changes view), V30 into **S5/S9**. V31 is dev-only with no user journey
> (like the V15 Aquarium easter egg) and is intentionally left unmapped.

## Product & document references

- **Single product:** every flow below belongs to **SC_PRODUCT_CODE_OSS_DEV.md**
  (`code-oss-dev`; packages `cli`, `extensions`, `remote`, `scripts`, `test`
  layered on the primary `src/` app). The **Products** field on each flow names
  the package/surface that participates.
- **Views:** the **Views** field references view IDs/names from **SC_VIEWS.md**
  (V1–V28). The full inherited VS Code workbench (main-window editors, Explorer,
  SCM, settings, panels) is upstream and **not catalogued** in SC_VIEWS — flows
  W1–W4 exercise it and it is re-verified, not re-documented
  (`AX-REPO-FORK-TDD-SCOPE`). Where a fork view augments an inherited surface
  (V19 image carousel, V20 editor watermark, V18 terminal selector) it is
  referenced explicitly.
- **Axioms:** the user-facing flows W1–W4, T1, S1–S9, C1–C7 are a regression
  contract — they must not regress without a governed task + red→green test
  (`AX-PROD-CODE-OSS-DEV-007`).
- **Providers (0.6.0):** the S\* flows are **provider-agnostic** — every agent
  session runs one of five registered providers (Claude, Copilot, Codex, Gemini,
  Grok). Providers are registered as pure-data descriptors via
  `extensions/copilot/src/extension/chatSessions/common/{agentCliProvider.ts,agentCliProviderRegistry.ts}`
  (Gemini → `…/gemini/common/geminiProviderDescriptor.ts`, Grok →
  `…/grok/common/grokProviderDescriptor.ts`; Grok's node adapter is
  `src/vs/platform/agentHost/node/grok/grokAgent.ts`) and surfaced workbench-side
  through `src/vs/workbench/contrib/chat/browser/agentSessions/{agentSessionProviderRegistry.ts,agentSessionProviderBuiltins.ts,agentSessionProviderCodicons.ts}`.
  See the *Multi-provider agent-CLI surface* cross-flow note.

## Flow index

| Family | Flows | Runtime / surface |
|---|---|---|
| **W. Workbench (inherited upstream)** | W1–W4 | Desktop / web / remote (`src/vs/workbench/`) |
| **T. Terminal seam (fork, flag-gated)** | T1 | Panel terminal (`contrib/terminal/browser/agentTabs/`) |
| **S. Agents Window (fork)** | S1–S9 | `src/vs/sessions/` (`WindowVisibility.Sessions`) |
| **C. CLI (fork-flavored)** | C1–C7 | Rust `code` binary (`cli/`) |

| # | Flow | Primary views (SC_VIEWS) |
|---|------|--------------------------|
| W1 | Open a Folder/Workspace & Edit a File | *(inherited workbench)* + V20 |
| W2 | Review a Diff (SCM / compare) | *(inherited diff editor)* |
| W3 | Run a Task / Use the Integrated Terminal | *(inherited terminal)* — fork variant T1 |
| W4 | Open a Webview / Custom Editor | *(inherited webview)* + V19 |
| T1 | Select an Agent Terminal Alongside Human Terminals | V18 |
| S1 | First-Launch Setup / Welcome | V1, V9, V8, V13, V17 |
| S2 | Sign In / Manage Account | V2, V8, V13 |
| S3 | Create a New Session & Send First Message | V1, V6, V5, V2, V4, V21, V22 |
| S4 | Send a New Session in the Background | V6, V5, V4 |
| S5 | Continue Session / Multi-Chat | V5, V4, V12, V19, V21, V22, V30 |
| S6 | Browse / Filter / Triage Sessions | V4, V2, V3, V5 |
| S7 | Work With Multiple Sessions Side-by-Side | V1, V5, V3, V4, V2, V29 |
| S8 | Review & Apply Changes / Commit / PR / Merge | V7, V29, V10, V11, V5, V17 |
| S9 | Open Session in VS Code / Run Script / Open Terminal | V2, V16, V14, V10, V30 → W1 |
| C1 | Authenticate / Log In | V27 |
| C2 | Start an Agent Host / Tunnel / Serve Web | V23, V27, V28 |
| C3 | List Active Sessions (`agent ps`) | V24 |
| C4 | Stream Agent Logs (`agent logs`) | V25 |
| C5 | Stop / Kill the Agent Host | V26, V23 |
| C6 | Manage Tunnels | V27 |
| C7 | Update / Check Version | V27 |

---

## W. Workbench Flows (inherited upstream)

Standard VS Code journeys. The fork does not alter them; they are documented so
the Agents Window flows (S\*) and the terminal seam (T1) have context. Their
views are inherited upstream surfaces **not** catalogued in SC_VIEWS, except for
the two fork additions noted (V20, V19).

### W1. Open a Folder / Workspace and Edit a File

- **Actor:** Developer
- **Goal:** Open a project and edit source files.
- **Entry points:** `scripts/code.sh` / `code.bat` (desktop), `scripts/code-web.js`
  (web), `scripts/code-server.js` (remote, port `9888`); the `code <path>` CLI
  (`cli/`); File → Open Folder; recent-workspace pick.
- **Steps:**
  1. Launch a workbench surface → the parts grid renders.
  2. Pick a folder (open dialog / recent list / drag-drop).
  3. Explorer populates the side bar; click a file to open it.
  4. Edit in the text editor (type, find/replace, multi-cursor, IntelliSense);
     an **empty** editor group shows the keybinding watermark (V20), whose logo
     animates on hover.
  5. Save (Ctrl/Cmd+S) → dirty indicator clears.
- **Views:** inherited workbench (activity bar, side bar, editor part, status bar) +
  **V20 Empty-Editor Watermark** (fork add).
- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (root `src/`, `scripts`, `extensions`).

### W2. Review a Diff (SCM / file comparison)

- **Actor:** Developer
- **Goal:** Inspect changes between two versions of a file.
- **Entry points:** Source Control view (click a changed file); gutter diff
  decorations; "Compare Active File With…" command.
- **Steps:**
  1. Open Source Control in the activity/side bar.
  2. Select a changed file → diff editor opens.
  3. Toggle inline vs. side-by-side; stage/revert hunks.
- **Views:** inherited SCM view + diff editor + status bar (git branch).
- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (root `src/`, `extensions/git`,
  `extensions/github`).

### W3. Run a Task / Use the Integrated Terminal

- **Actor:** Developer
- **Goal:** Run commands / build tasks inside the workspace.
- **Entry points:** View → Terminal (Ctrl/Cmd+\`); Run Task command; panel
  composite bar.
- **Steps:**
  1. Open the Panel → Terminal composite.
  2. Create / split / select a terminal tab.
  3. Run commands in the xterm.js terminal.
- **Views:** inherited Panel + terminal view (stock `TerminalTabbedView`).
- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (root `src/`).
- **Note:** with `terminal.integrated.agentTabs.enabled` on **and** a registered
  webview resolver, the tabs strip is replaced by the agent selector — see **T1**;
  off → byte-identical to upstream (`AX-TERMINAL-AGENT-TABS`).

### W4. Open a Webview / Custom Editor

- **Actor:** Developer
- **Goal:** Use an extension-contributed editor / panel.
- **Entry points:** extension command; open a file bound to a custom editor; chat
  image attachment (when `chat.imageCarousel.enabled`).
- **Steps:** invoke → webview iframe loads extension HTML → interact → state
  serialized on hide/restore. The fork-added **Image Carousel** (V19) is a custom
  editor of this kind, opened as a modal slideshow from chat images.
- **Views:** inherited webview / custom editor + **V19 Image Carousel** (fork add,
  preview-gated).
- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (root `src/`, contributing `extensions/`).

---

## T. Terminal Seam Flow (fork — flag-gated, opt-in since 0.6.0)

### T1. Select an Agent Terminal Alongside Human Terminals

- **Actor:** Developer running agent (chat tool-session) terminals in the main workbench.
- **Goal:** See and switch between human terminals and agent terminals in one
  sectioned selector, with per-agent run state, beside the live terminal.
- **0.6.0 status — superseded as the default, retained as an opt-in escape hatch:**
  after P4 (PR #4) the **chat** surface is the default destination for *every*
  agent provider (`chat.agentSessions.defaultSurface`, default `'chat'`), so a new
  agent session lands in the Agents Window chat (S3/S5), not here. The terminal
  selector is **never removed** (DN-1): it becomes the destination again only when
  `chat.agentSessions.defaultSurface` is set to `'terminal'`, or per-launch via the
  "Open in Terminal" escape hatch (`openInTerminal`, which always wins). The
  enabling flag now carries a `markdownDeprecationMessage`; its default stays
  `false`, so flag-off behavior remains byte-identical to upstream
  (`AX-TERMINAL-AGENT-TABS`). See the *Default launch surface* cross-flow note.
- **Entry points:**
  - Enable `terminal.integrated.agentTabs.enabled` (default `false`) and have a
    webview resolver registered for `terminal.integrated.agentTabs.viewId`
    (self-registered in `agentTabs/agentTabsContribution.ts`).
  - Route sessions here by setting `chat.agentSessions.defaultSurface` to
    `'terminal'`, or per-launch via "Open in Terminal".
  - Then open the Panel terminal (Ctrl/Cmd+\`).
- **Steps:**
  1. Flag + resolver on → `terminalView.ts` `_createTabsView()` routes through the
     `ITerminalTabsView` seam to `AgentTerminalTabbedView` (a horizontal
     `SplitView`: selector cell + terminal cell) instead of stock
     `TerminalTabbedView` (the seam; see `SEAM_MANIFEST.md`).
  2. The selector cell hosts the code-ext **Sessions webview**
     (`AgentTerminalWebviewHost`); the terminal cell hosts live xterm groups
     (`AgentTerminalHostController`).
  3. The selector model (`agentTerminalSelectorModel.ts`) fans in built-in rows
     (human terminals) + provider rows (agents) into one change stream; rows are
     merged/de-duped/sectioned by `agentTerminalSelectorRows.ts` (instances that
     are both terminal and agent render once under **Agents**).
  4. Each agent row shows session title + run state (`idle` / `running` /
     `background`); native split-groups (≥2 instances) are tagged with a split id.
  5. Click a row to focus that terminal; drag the sash to resize the selector
     (persisted, storage key `stokd.agentTabs.selectorWidth`).
  6. If the flag/resolver flips after panel init, `shouldRebuildTabsView()` live-swaps
     the view (no reload).
- **Views:** **V18 Agent Terminal Selector** (replaces the stock tabs strip within
  the inherited terminal panel).
- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (root `src/`; fork-only, behind flag +
  resolver).

---

## S. Agents Window Flows (fork — `src/vs/sessions/`)

The Agents Window is a distinct, fixed-layout workbench **window**
(`WindowVisibility.Sessions`), never a panel inside the main workbench
(`AX-REPO-AGENTS-WINDOW-DISTINCT-WINDOW`). Entry surfaces:
`sessions.desktop.main.ts` (Electron), `sessions.web.main.ts` (web standalone,
launched by `scripts/code-sessions-web.js`, port `8081`), `sessions.common.main.ts`.
The fixed shell is **V1**; on phone-class viewports the shell swaps to the mobile
variant **V17**. If enterprise policy blocks the app, the impassable **V13**
overlay covers everything (applies across S1–S9).

> **Model vs. view split** (drives S3–S8): the **management** service
> (`ISessionsManagementService`, `src/vs/sessions/services/sessions/common/sessionsManagement.ts`)
> owns `activeSession`, send, and CRUD (`createNewSession`, `sendNewChatRequest`,
> `sendRequest`, `createAndSendNewChatRequest`, `setActiveSession`,
> `deleteNewSession`); the **view** service (`ISessionsViewService`) owns slots,
> `openSession` / `openNewSession`, focus, navigation, and persistence. See
> `src/vs/sessions/SESSIONS.md`.

### S1. First-Launch Setup / Welcome

- **Actor:** New user opening the Agents Window.
- **Goal:** Complete first-run setup (and re-enable AI / sign in when prompted).
- **Entry points:** first desktop launch / web-with-no-session; the setup service
  checks `WELCOME_COMPLETE_KEY` (`workbench.agentsession.welcomeComplete`) in
  `sessionsSetUpService.ts` / `common/welcome.ts`; re-shown on sign-out.
- **Steps:**
  1. Window opens → shell (V1) builds; setup service checks the welcome key.
  2. Welcome modal (V9) shows: title, markdown body, Continue / Sign Out buttons;
     gated by a default chat agent being configured (skipped otherwise).
  3. User continues / signs in via the account flow (V8) → key persists,
     `onCompleted` fires, modal closes.
- **Views:** **V1 Shell** → **V9 First-Launch Welcome / Setup** → **V8 Account /
  Copilot Status** (sign-in); **V13** if policy-blocked; **V17** on phone.
- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (root `src/`; fork-only).

### S2. Sign In / Manage Account

- **Actor:** User.
- **Goal:** Authenticate, inspect Copilot entitlement/quota, sign out.
- **Entry points:** the titlebar account widget (`accountTitleBarState.ts`,
  `contrib/accountMenu/browser/account.contribution.ts`), rendered in V2 (right)
  and the mobile titlebar (V17).
- **Steps:**
  1. Click the account widget → popup (account header, chat & completions quota,
     entitlement Free/Pro/Team, Sign Out / Manage Account, dashboard link).
  2. Sign in → avatar + quota badge load; entitlement/quota render.
  3. (Optional) Sign out → state resets; the welcome (S1) may re-show.
- **Views:** **V2 Titlebar** → **V8 Account / Copilot Status Panel**;
  **V13** if policy-blocked.
- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (root `src/`; fork-only).

### S3. Create a New Session and Send the First Message

- **Actor:** User.
- **Goal:** Start a new agent session against a workspace and send a first prompt.
- **Entry points:** New Session action / shortcut; mobile titlebar "+"; the session
  picker's "New Session"; or the empty session slot → `ISessionsViewService.openNewSession()`.
- **Steps:**
  1. The **New Chat / New Session** composer (V6) renders in a session slot
     (`contrib/chat/browser/newChatWidget.ts`).
  2. User picks a folder in the **workspace picker** (`sessionWorkspacePicker.ts`
     desktop / `webWorkspacePicker.ts` web) → `openNewSession({ folderUri })` →
     `management.createNewSession(folderUri)` iterates providers (first whose
     `resolveWorkspace` succeeds) → returns a draft session; the slot activates it.
  3. (Optional) User picks a **provider / session type** — one of the five
     registered harnesses (Claude, Copilot CLI/Cloud, Codex, Gemini CLI, Grok) —
     and a **model** (`sessionTypePicker.ts`, `modelPicker.ts`; models sourced
     per-provider via `ISessionsProvider.getModels(sessionId)`, "Auto" fallback) →
     the draft may upgrade in place. By P4 default the type/model chips render in
     the **Controls** row below the input (`renderSessionTypePickerInControls`,
     slot `.sessions-chat-picker-slot`); the picker hides when only one type exists.
  4. (Optional) User sets the **permission / approvals mode** via the
     provider-agnostic **permission-mode picker** (`permissionModePicker.ts`,
     a region of V6; chip in the Controls row). It is shown only when the active
     session's provider declares modes (`ActiveSessionHasPermissionModesContext` /
     `providerHasPermissionModes`); Claude, Gemini, and Grok each declare their own
     (Grok includes a default-deny shell-confirmation mode, DN-4). Reads modes only
     through `getProviderPermissionModes` / `getProviderCurrentPermissionMode`
     (`services/sessions/common/permissionModes.ts`) — it knows nothing about any
     specific agent.
  5. User types and sends (Enter / Send) →
     `management.sendNewChatRequest(session, { query, attachedContext })` →
     `provider.createNewChat` + `provider.sendRequest` → `onDidStartSession` +
     `onDidSendRequest`; the slot swaps from the composer to the **Chat** view (V5).
     Since 0.6.0 the **chat** surface is the default destination for *every*
     provider (`chat.agentSessions.defaultSurface` = `'chat'`); the session lands
     here rather than the terminal selector (T1) unless the default is set to
     `'terminal'` or "Open in Terminal" is chosen. See the *Default launch surface* note.
  6. The agent responds; turns stream into the chat (V5); the session appears in
     the sessions list (V4, per-provider icon) and the titlebar session picker (V2)
     populates.
  7. During the turn, a Copilot/Claude agent may raise **slash-command dialogs** (V21)
     or the **runtime permission / question** carousel (V22 — distinct from the
     pre-turn approvals *mode* picker in step 4).
- **Views:** **V1 Shell** → **V6 New Chat / New Session** (workspace + provider/model +
  permission-mode pickers) → **V5 Session View / Chat**; **V4 Sessions List** (new row),
  **V2 Titlebar** (picker); chat-fed **V21 / V22**.
- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (root `src/` + `extensions/copilot`).
- **Edge states (V6):** no-workspace-selected (can-send gated), no-agent-host empty
  state (web), loading providers, no-selectable-model gate, permission-picker hidden
  when the provider declares no modes, submission error banner.

### S4. Send a New Session in the Background

- **Actor:** User.
- **Goal:** Kick off a session without leaving the composer (fire-and-forget).
- **Entry points:** in the composer, **Alt+Enter** (or Alt-click Send) →
  `sendNewChatRequest(session, { background: true })`.
- **Steps:**
  1. The window returns to a fresh new-session composer (`openNewSession`)
     **before** the provider commits — the composer (V6) stays in view; no slot swap.
  2. The provider commits asynchronously (must support concurrent new sessions);
     the started session appears in the sessions list (V4) once committed.
  3. On commit failure, management calls `deleteNewSession` to dispose the stranded
     draft.
- **Views:** **V5 Session View** → **V6 New Chat** (stays) → **V4 Sessions List**
  (row appears on commit).
- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (root `src/`; fork-only).
- **Related (no UI swap):** `createAndSendNewChatRequest(folderUri, …)` for callers
  outside the composer (e.g. automation) — creates + sends in one call without
  touching the active/pending session.

### S5. Continue an Existing Session / Multi-Chat

- **Actor:** User.
- **Goal:** Send follow-up turns, or open a second chat within a session.
- **Entry points:** type into an active session's chat input; the New Chat header
  action (creates a `newChatInSession` draft); the chat composite bar when a
  session has >1 chat; **Run Prompt** from the AI Customization tree (V12).
- **Steps:**
  1. The active session's Chat view (V5) is focused.
  2. Follow-up message → `management.sendRequest(session, chat, options)`; the view
     makes the sent chat active by reacting to send events.
  3. (Optional) New Chat in session → `newChatInSession` draft → send → a second
     chat; the **chat composite bar** appears to switch between chats.
  4. Input history is scoped by `ISession.sessionId` (Up/Down navigates this
     session's prompts; toggle `chat.agentSessions.scopedInputHistory`).
  5. (Optional) Change the **approvals mode** mid-session via the provider-agnostic
     permission-mode picker (V6 region in the Controls row); it re-renders reactively
     on `ISessionsProvider.onDidChangePermissionModes` and is hidden for providers
     that declare no modes.
  6. Chat content can surface auxiliary views: clicking a chat image opens the
     **Image Carousel** (V19); the agent may raise slash-command (V21) or runtime
     permission/question (V22) dialogs; opening a URL/preview surfaces the
     **Embedded Browser** (V30) as a modal editor (V10) bound to this session
     (`SessionBrowserViewController` ties the `BrowserEditorInput` to the owning
     `ISession` and disposes it on session delete).
- **Views:** **V5 Session View / Chat** (header + chat composite bar + permission-mode
  picker) → **V4 Sessions List**; chat-fed **V12 / V19 / V21 / V22 / V30**.
- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (root `src/` + `extensions/copilot`).

### S6. Browse, Filter & Triage Sessions

- **Actor:** User.
- **Goal:** Find, group, sort, pin, rename, archive, and read/unread sessions; pivot
  between project folders.
- **Entry points:** the **Sessions List** in the sidebar
  (`contrib/sessions/browser/views/sessionsList.ts`); list header actions
  (sort/group/find); the titlebar session picker and host filter (V2); the project
  bar (V3); session-header right-click (`Menus.SessionHeaderContext`).
- **Steps:**
  1. Browse the tree — pinned section + collapsible groups (by workspace or by date).
  2. Find (filter by name/workspace) / filter (exclude-archived, exclude-read, by
     type, by status); "show more" paginates capped groups.
  3. Read per-row status: in-progress (spinner) · needs-input (ring) · error · succeeded ·
     idle; plus read/unread, archived (faded), pinned.
  4. Act on a row/header: pin/close, inline rename, mark read/unread, archive/delete.
  5. (Optional) Switch project folder via the **Project Bar** (V3).
  6. Click a row → `view.openSession(uri)` → `management.setActiveSession` → the slot
     arranges + focuses; the titlebar picker (V2) updates.
- **Views:** **V4 Sessions List** → **V2 Titlebar** (picker / host filter) → **V3
  Project Bar** → **V5 Session View** (on open).
- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (root `src/`; fork-only).

### S7. Work With Multiple Sessions Side-by-Side

- **Actor:** User.
- **Goal:** View several sessions at once; navigate Back/Forward; persist layout.
- **Entry points:** open additional sessions into slots; sticky/pin a slot; maximize
  the active view; Back/Forward navigation (`SessionsNavigation`).
- **Steps:**
  1. Several Session Views (V5) render side-by-side in the Sessions Part internal
     grid; exactly one is **active** (drives focus / context keys / titlebar).
  2. Focus a slot → `part.onDidFocusSession → view.setActive → management.setActiveSession`.
  3. For the active session, the auxiliary bar shows its **Files / Explorer** tree
     (V29) — the *default* aux-bar container (`files.contribution.ts`,
     `isDefault: true`, Cmd+Shift+E), scoped to that session's workspace folder
     (or the `github-remote-file` provider for a remote repo); it collapses to the
     empty view when the session has no folder, and is hidden on phone viewports.
  4. Sticky slots persist; non-sticky slots are recycled; at most one empty slot
     (`undefined`) renders the `newSession` composer (V6).
  5. On reload, the grid restores atomically (`restoreVisibleSessions()`); per-session
     layout (aux-bar visibility + active view, panel show/hide, editor working set)
     restores via `contrib/layout/browser/sessionLayoutController.ts`.
  6. Phone viewport: single-session enforced (`MobileSessionsPart`, V17).
- **Views:** **V1 Shell** → **V5 Session View** (grid) → **V29 Files / Explorer**
  (aux bar) → **V3 Project Bar** / **V4 Sessions List** / **V2 Titlebar**.
- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (root `src/`; fork-only).

### S8. Review & Apply Changes, Commit, Create PR, Merge

- **Actor:** User.
- **Goal:** Review the file changes an agent produced and land them (commit / sync /
  PR / merge), optionally running code review and watching CI.
- **Entry points:** the **Changes View** in the auxiliary bar
  (`contrib/changes/browser/changesView.ts`); **auto-reveal** — the aux bar
  auto-reveals to Changes when a turn produces new changes (suppressed on mobile);
  the code-review action (`contrib/codeReview/`); sync-to-parent
  (`contrib/applyCommitsToParentRepo/`).
- **Steps:**
  1. An agent turn produces changes → the aux bar (whose **default** container is
     the **Files / Explorer** view, V29) auto-reveals the Changes View (V7); the
     changeset tree shows file rows with A/M/D pills and `+N −N` stats (changesets
     are includable/excludable groups). The Files view (V29) carries its own
     **Sync Changes** action for new-chat sessions with a git repo.
  2. Open a file → its diff opens in the **modal editor** (V10); inline agent
     feedback / session comments surface via the **agent feedback overlay** (V11).
  3. (Optional) Run **code review** (`codeReviewService.ts`) and watch the **CI /
     checks** widget (`checksWidget.ts`): passed / failed / loading.
  4. Act via the actions bar: **Commit** (`…sessions.commit`), **Commit & Sync**
     (`…sessions.commitAndSync`), **Create PR** (`…createPR`), **Merge**
     (`…mergeCopilotCLIAgentSessionChanges.merge`), or **Sync to parent repo** —
     buttons disable while a git operation is in progress.
- **Views:** **V1 Shell** → **V29 Files / Explorer** (default aux-bar container) ⇄
  **V7 Changes View** (auto-revealed) → **V10 Modal Editor** (diff) →
  **V11 Agent Feedback Overlay**; **V5 Session header** (±diff stats); on phone the
  **V17** full-screen changes/diff overlays.
- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (root `src/` + `extensions/copilot`,
  `extensions/github`).

### S9. Open a Session in VS Code / Run a Script / Open Terminal

- **Actor:** User.
- **Goal:** Drop from the Agents Window into the full editor, run the session's
  configured script, or open a terminal for the session's workspace.
- **Entry points:** the session-header toolbar (Run, Open in VS Code, New Chat); the
  titlebar right layout (Run script split-button, Open Terminal, Open in VS Code —
  `openInVSCodeWidget.ts`).
- **Steps:**
  1. From an active session, click **Open in VS Code** (V16) → the main workbench
     opens on the session's workspace/worktree (handoff to **W1**).
  2. Or **Run** the configured script → output streams to the (hidden-by-default)
     **Sessions Panel / Terminal** (V14).
  3. Or **Open Terminal** → a terminal in the panel scoped to the session's cwd
     (`SessionsTerminalViewVisibleContext`).
  4. (Setup) Tasks with `runOptions.runOn === "worktreeCreated"` are dispatched
     client-side only for sessions this window just started
     (`WorktreeCreatedTaskDispatcher`); editors opened from a session render as the
     modal overlay (V10) — including an in-session **Embedded Browser** (V30,
     `BrowserEditorInput`), whose lifecycle `SessionBrowserViewController` binds to
     the owning session and tears down when the session is deleted.
- **Views:** **V2 Titlebar** / V5 Session header → **V16 Open-in-VS-Code Widget** →
  **V14 Sessions Panel / Terminal** / **V10 Modal Editor** (incl. **V30 Embedded
  Browser**); (handoff) → **W1**.
- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (root `src/`; fork-only).

> **Easter egg (no flow):** the Aquarium overlay (V15) is a toggleable animated
> background, not part of any user journey.

---

## C. CLI Flows (Rust `code` binary — `cli/`)

The Rust CLI hosts and observes agents and manages remote access. Subcommands are
declared in `cli/src/commands/args.rs`; shared output infra in `cli/src/log.rs`,
`cli/src/commands/output.rs` (banners/pager), `cli/src/util/input.rs`
(prompts/spinners). Default ports: server `9888`, web `8080`, agent-host /
sessions-web `8081`, CLI control `31546`.

### C1. Authenticate / Log In

- **Actor:** Developer at a terminal.
- **Goal:** Authenticate the CLI to a provider.
- **Entry points:** triggered on the first command that needs auth (`cli/src/auth.rs`);
  `code tunnel user login`; legal consent in `cli/src/tunnels/legal.rs`.
- **Steps:**
  1. Provider selector prompt ("Microsoft Account" / "GitHub Account").
  2. Device-code message ("log into {URI} and use code {USER_CODE}").
  3. License/legal confirm prompt (interactive) or non-interactive fallback.
  4. Device-code polling (silent backoff) → success; credentials stored in the OS keyring.
- **Views:** **V27** (interactive device-flow prompts for `tunnel user login`).
- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (`cli`).

### C2. Start an Agent Host (or Tunnel / Serve Web)

- **Actor:** Developer / operator.
- **Goal:** Stand up a backend the Agents Window / clients connect to.
- **Entry points:** `code agent host` (`commands/agent_host.rs`), `code tunnel`
  (`commands/tunnels.rs`), `code serve-web` (`commands/serve_web.rs`); optional
  `--tunnel` exposes the host over a dev tunnel; via launchers
  `scripts/code-agent-host.js` (`READY:<port>`, port `8081`) /
  `scripts/code-server.js` (`Web UI available at …`, port `9888`).
- **Steps:**
  1. Run the command → readiness banner renders (`Code Agent Host vX.Y.Z ready in
     {ms}ms`) with `➜` Tunnel / Local / Network / Manage lines, and the readiness
     sentinel `__VSCODE_AGENT_HOST_READY__` (handshake consumed by `scripts/` / CI,
     `AX-REPO-SERVER-LAUNCH-HANDSHAKE`).
  2. `serve-web` / `tunnel` print `Web UI available at {url}`.
  3. The host runs and writes a lockfile (`agent-host-<quality>.lock`) that
     `agent ps/logs/stop/kill` discover; reuse banner if one is already running.
- **Views:** **V23 `agent host` Supervisor Banner**, **V27 tunnel / serve-web**,
  **V28 Launcher Terminal Output**.
- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (`cli`, `scripts`).

### C3. List Active Agent Sessions (`agent ps`)

- **Actor:** Developer / operator.
- **Goal:** See running agent sessions and their status.
- **Entry points:** `code agent ps` (`commands/agent_ps.rs`); `--all` to include
  inactive; `--tunnel <addr>`/`<name>` to query a remote host; `--json`.
- **Steps:**
  1. Run → the CLI connects to the running agent host (local lockfile or named tunnel).
  2. Prints per-session title + colored status bullet + indented fields (uri, provider,
     activity, cwd); paged if taller than the terminal; or a JSON array with `--json`.
- **Views:** **V24 `agent ps` Session List** (`● input needed` / `● in progress` /
  `● error` / `○ idle` / `? unknown`; "No active sessions." when empty).
- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (`cli`).

### C4. Stream Agent Logs (`agent logs`)

- **Actor:** Developer / operator.
- **Goal:** Watch a session's live event stream.
- **Entry points:** `code agent logs` (`commands/agent_logs.rs`); `--tunnel` for remote.
- **Steps:**
  1. Run → session header snapshot (title / provider / activity / turns with state
     icons / seq).
  2. `Streaming events (Ctrl+C to quit)…` separator → live event lines
     `[{seq}] {TYPE} {param}={value}` colored by type.
  3. Ctrl+C → `Subscription closed.` / `Interrupted.`
- **Views:** **V25 `agent logs` Event Stream**.
- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (`cli`).

### C5. Stop / Kill the Agent Host

- **Actor:** Operator.
- **Goal:** Gracefully cancel a turn or forcefully kill the running host.
- **Entry points:** `code agent stop` (`commands/agent_stop.rs`, graceful turn cancel),
  `code agent kill` (`commands/agent_kill.rs`, force-kill the process tree);
  `--tunnel` for remote.
- **Steps:**
  1. Run → the CLI resolves the running host (lockfile / tunnel); errors "No running
     agent host found. Start one with `code agent host`" if none.
  2. Sends stop / kills the process tree → single result line.
- **Views:** **V26 `agent stop` / `agent kill` Result** (`Cancelled turn …` /
  `Killed agent host (pid N).` / stale-lockfile cleanup); **V23** (host shutdown).
- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (`cli`).

### C6. Manage Tunnels

- **Actor:** Operator.
- **Goal:** Inspect / rename / install-as-service / prune tunnels and check the
  logged-in user.
- **Entry points:** `code tunnel status|rename|user show|service …|prune`
  (`commands/tunnels.rs`).
- **Steps:** run the subcommand → JSON / status output (`{tunnel, service_installed}`,
  rename result, `user show` state, service install/uninstall, prune "Deleted …").
- **Views:** **V27 tunnel / status** (single result lines / JSON objects via
  `log.result()`).
- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (`cli`).

### C7. Update / Check Version

- **Actor:** Developer / operator.
- **Goal:** Update the CLI/desktop or inspect/select installed versions.
- **Entry points:** `code update` (`commands/update.rs`), `code version use|show`
  (`commands/version.rs`), `--version` / `--help` (`commands/args.rs`).
- **Steps:**
  1. `code update` → up-to-date (`…already up to date ({commit})`) vs. update-available;
     animated download progress; "Successfully updated to {version}".
  2. `code version use/show` → current quality + install path, or install-not-found
     guidance (exit 1).
- **Views:** **V27 version / update**.
- **Products:** SC_PRODUCT_CODE_OSS_DEV.md (`cli`).

---

## Cross-flow notes & conventions

- **Headline end-to-end agentic loop (spans surfaces):** start a backend (**C2**
  `code agent host`) → pick a provider & create/send a session (**S3** / **S4**, one
  of Claude / Copilot / Codex / Gemini / Grok, landing in chat by default) →
  continue turns (**S5**) → review & land changes (**S8**) → optionally drop into the
  full editor (**S9** → **W1**); observe out-of-band via the CLI (**C3** / **C4**) or,
  when routed to the terminal, the agent terminal selector (**T1**).
- **Fork-only flows:** **T1** and **S1–S9** are stokd additions. **W1–W4** are
  inherited upstream surfaces (re-verified, not re-documented). **C1–C7** live in
  the upstream `cli/` tree but the `agent host|ps|stop|kill|logs` commands are
  fork-flavored.
- **Multi-provider agent-CLI surface (0.6.0):** S\* flows are provider-agnostic across
  five providers (Claude, Copilot, Codex, **Gemini**, **Grok**). Providers register as
  pure-data descriptors
  (`extensions/copilot/src/extension/chatSessions/common/{agentCliProvider.ts,agentCliProviderRegistry.ts}`;
  `gemini/common/geminiProviderDescriptor.ts`, `grok/common/grokProviderDescriptor.ts`;
  Grok node adapter `src/vs/platform/agentHost/node/grok/grokAgent.ts`) and are surfaced
  workbench-side via
  `src/vs/workbench/contrib/chat/browser/agentSessions/{agentSessionProviderRegistry.ts,agentSessionProviderBuiltins.ts,agentSessionProviderCodicons.ts}`
  (per-family icons — Gemini `sparkle`, Grok `zap`). Provider identity drives the
  type/model/permission-mode pickers in **S3/S5** (V6) and the per-row icon in **S6** (V4).
- **Default launch surface (0.6.0):** `chat.agentSessions.defaultSurface` (`'chat'`
  default | `'terminal'`;
  `src/vs/workbench/contrib/chat/browser/agentSessions/defaultLaunchSurface.ts`) decides
  where a newly-opened agent session lands — the Agents Window **chat** (S3/S5, V5/V6)
  for all providers, or the terminal selector (**T1**, V18). The decision is a pure
  function: `getLaunchSurface(providerId, ctx)` in `…/defaultLaunchSurface.ts`
  (`DEFAULT_AGENT_LAUNCH_SURFACE = 'chat'`, `AGENT_DEFAULT_SURFACE_SETTING_ID =
  'chat.agentSessions.defaultSurface'`), wrapped by `resolveSessionSurface(session,
  openOptions, configuredDefault)` in `…/agentSessionsOpener.ts`; the per-launch
  "Open in Terminal" escape hatch (`openInTerminal`) is checked first and always wins
  (DN-1), and the terminal surface is never removed. This is the P4 switch that
  demoted T1 from the default to opt-in.
- **Flag gate (T1):** T1 manifests only with `terminal.integrated.agentTabs.enabled`
  **and** a registered webview resolver; otherwise the terminal is byte-identical to
  W3 (`AX-TERMINAL-AGENT-TABS`, `scripts/verify-seam.sh`). Since 0.6.0 a session only
  *routes* to T1 when `chat.agentSessions.defaultSurface` is `'terminal'` or "Open in
  Terminal" is used (see *Default launch surface* above) — independent of the flag,
  which still gates the strip-replacement itself.
- **Window separation:** S\* flows run in a distinct workbench window
  (`WindowVisibility.Sessions`), never as a panel in the main workbench
  (`AX-REPO-AGENTS-WINDOW-DISTINCT-WINDOW`). The policy-blocked overlay (V13) can
  gate any S\* flow.
- **Per-session layout:** the visibility/working-set state for V5 / V7 / V10 / V14 is
  remembered per session by `LayoutController`
  (`contrib/layout/browser/sessionLayoutController.ts`; see `LAYOUT_CONTROLLER.md`).
- **Mobile substitution:** on phone viewports V17 substitutes the shell/parts of
  S1–S8 (drawer sidebar, bottom-sheet pickers, full-screen changes/diff overlays).
- **Handshake contracts:** C2/C5's banners and launcher output (V23/V27/V28) carry
  the cross-surface handshakes (`__VSCODE_AGENT_HOST_READY__`, `READY:<port>`,
  `Web UI available at …`) consumed by `scripts/` and CI
  (`AX-REPO-SERVER-LAUNCH-HANDSHAKE`).
- **Regression contract:** W1–W4, T1, S1–S9, C1–C7 must not regress without a
  governed task + red→green test (`AX-PROD-CODE-OSS-DEV-007`, `AX-REPO-FORK-TDD-SCOPE`).
- This file is generated meta. Re-run generation after changes to the sessions layer
  (`src/vs/sessions/`), the terminal seam (`agentTabs/`), the agent-CLI provider
  registry / launch-surface routing
  (`src/vs/workbench/contrib/chat/browser/agentSessions/`,
  `extensions/copilot/src/extension/chatSessions/{common,gemini,grok}/`), the CLI
  command surface (`cli/src/commands/`), or `SC_VIEWS.md`.
