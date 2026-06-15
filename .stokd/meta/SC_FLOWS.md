<!-- stokd-meta: SC_FLOWS.md | metaVersion 0.4.0 | generated: FRESH -->
# SC_FLOWS.md — stokd-ide User Flow Classification

This document classifies the distinct **user flows** (user journeys / workflows)
across the monorepo. The repo is a **thin-patch fork of VS Code (`code-oss-dev`)**,
so the flows split into three families:

- **Inherited workbench flows** — the standard VS Code editing journeys (kept as-is
  by the fork; summarized here for completeness).
- **Fork flows** — the stokd additions that justify the fork:
  - the **Agent-aware terminal selector** (`AX-TERMINAL-AGENT-TABS`)
  - the **Agents Window** (`src/vs/sessions/`) — sessions-first agentic UX
- **CLI flows** — the Rust `code` binary (`cli/`) that hosts and observes agents.

**Product key**: there is a single product doc, **`SC_PRODUCT_CODE_OSS_DEV.md`**
(`code-oss-dev`; packages: `cli`, `extensions`, `remote`, `scripts`, `test`).
Every flow below belongs to that product; the **Products** field notes which
package/surface participates.

**View references** point at the IDs/names defined in `SC_VIEWS.md`
(A0–A8 workbench parts, B1–B3 editors, C1/C2 terminal, D0–D8 Agents Window,
E1–E8 CLI output). Read `SC_VIEWS.md` alongside this file.

Flows are grouped by surface:

| Family | Flows | Runtime |
|---|---|---|
| **W. Workbench (inherited)** | W1–W4 | Electron / web / remote (`src/vs/workbench/`) |
| **T. Terminal seam (fork)** | T1 | Panel terminal (`contrib/terminal/`) |
| **S. Agents Window (fork)** | S1–S9 | `src/vs/sessions/` |
| **C. CLI (fork-flavored)** | C1–C7 | Rust `code` binary (`cli/`) |

---

## W. Workbench Flows (inherited upstream)

These are standard VS Code journeys. The fork does not alter them; they are
documented so the Agents Window flows (S*) and terminal seam (T1) have context.

### W1. Open a Folder / Workspace and Edit a File

- **Actor**: Developer
- **Goal**: Open a project and edit source files.
- **Entry points**: `./scripts/code.sh` (desktop), `./scripts/code-web.sh` (web),
  `./scripts/code-server.sh` (remote); File → Open Folder; `code <path>` CLI;
  recent-workspace pick.
- **Steps**:
  1. Launch the workbench → shell renders the parts grid.
  2. Pick a folder (open dialog / recent list / drag-drop).
  3. Explorer populates in the side bar; click a file to open it.
  4. Edit in the text editor (type, find/replace, multi-cursor, IntelliSense).
  5. Save (Ctrl/Cmd+S) → dirty indicator clears.
- **Views**: A0 Workbench Layout Container → A3 Activity Bar (Explorer) →
  A4 Side Bar (Primary) → A6 Editor Part → B1 Text (Code) Editor → A8 Status Bar.
- **Products**: `SC_PRODUCT_CODE_OSS_DEV.md` (root `src/`).

### W2. Review a Diff (SCM / file comparison)

- **Actor**: Developer
- **Goal**: Inspect changes between two versions of a file.
- **Entry points**: SCM view (click a changed file); `git diff` gutter; command
  palette "Compare Active File With…".
- **Steps**:
  1. Open Source Control in the activity bar / side bar.
  2. Select a changed file → diff editor opens.
  3. Toggle inline vs. side-by-side; stage/revert hunks.
- **Views**: A3 Activity Bar (SCM) → A4 Side Bar → A6 Editor Part →
  B2 Diff Editor → A8 Status Bar (git branch).
- **Products**: `SC_PRODUCT_CODE_OSS_DEV.md` (root `src/`, `extensions/git`).

### W3. Run a Task / Use the Integrated Terminal

- **Actor**: Developer
- **Goal**: Run commands / build tasks inside the workspace.
- **Entry points**: View → Terminal (Ctrl/Cmd+`); Run Task command; panel
  composite bar.
- **Steps**:
  1. Open the Panel → Terminal composite.
  2. Create / split / select a terminal tab.
  3. Run commands in the xterm.js canvas.
- **Views**: A7 Panel (Bottom) → C1 Terminal View (stock) → A8 Status Bar.
- **Products**: `SC_PRODUCT_CODE_OSS_DEV.md` (root `src/`).
- *Note*: when `terminal.integrated.agentTabs.enabled` is on, the tabs sub-view is
  replaced — see **T1**.

### W4. Open a Webview / Custom Editor (e.g. extension UI)

- **Actor**: Developer
- **Goal**: Use an extension-contributed editor or panel.
- **Entry points**: extension command; open a file bound to a custom editor.
- **Steps**: invoke → webview iframe loads extension HTML → interact → state
  serialized on hide/restore.
- **Views**: A6 Editor Part → B3 Webview / Custom Editor.
- **Products**: `SC_PRODUCT_CODE_OSS_DEV.md` (root `src/`, contributing `extensions/`).

---

## T. Terminal Seam Flow (fork — AX-TERMINAL-AGENT-TABS)

### T1. Select an Agent Terminal Alongside Human Terminals

- **Actor**: Developer running agent/chat tool-sessions in the main workbench
- **Goal**: See and switch between regular terminals and **agent (chat tool-session)
  terminals** in one sectioned list, with per-agent run state.
- **Entry points**:
  - Enable the experimental setting `terminal.integrated.agentTabs.enabled`
    (default `false` → byte-identical to upstream). Self-registered by
    `src/vs/workbench/contrib/terminal/browser/agentTabs/agentTabsContribution.ts`.
  - Then open the Panel terminal (Ctrl/Cmd+`).
- **Steps**:
  1. Flag on → `terminalView.ts` `_createTabsView()` instantiates
     `AgentTerminalTabbedView` instead of the stock `TerminalTabbedView`
     (the 3-line seam; see `SEAM_MANIFEST.md`).
  2. The selector model (`agentTerminalSelectorModel.ts`) merges
     `ITerminalGroupService` (human terminals) + `ITerminalChatService` (agent
     terminals) and fans changes into one `onDidChange`.
  3. Rows are merged/de-duped/sectioned by `agentTerminalSelectorRows.ts`:
     **Terminals (n)** section, then **Agents (n)** section; an instance that is
     both appears once, under **Agents** (agent identity wins).
  4. Each agent row shows `sessionTitle [runState]`
     (`idle | running | awaiting-approval | background`).
  5. Click a row to focus that terminal; collapse a section header to hide its rows
     (count retained).
- **Views**: A7 Panel → **C2 Agent-Aware Terminal Selector** (replaces C1's tabs
  sub-view).
- **Products**: `SC_PRODUCT_CODE_OSS_DEV.md` (root `src/`; fork-only, behind flag).
- *Scope note (Phase 2)*: basic list only — WorkbenchList, drag-and-drop, status
  column, inline approval, and hover are later phases; `setEditable()`/`focusHover()`
  are intentional no-ops.

---

## S. Agents Window Flows (fork — `src/vs/sessions/`)

The Agents Window is a distinct workbench entry (not a panel inside the main
window). Contributions use `WindowVisibility.Sessions`. Entry points:
`sessions.{desktop,web,common}.main.ts`; web launcher
`./scripts/code-sessions-web.sh`. The fixed shell is **D0**.

### S1. First-Launch Setup / Welcome

- **Actor**: New user opening the Agents Window
- **Goal**: Complete first-run setup (and re-enable AI / sign in when prompted).
- **Entry points**: first desktop launch / web-with-no-session; AI-disabled
  re-enable prompt; signed-out re-show (`src/vs/sessions/browser/sessionsSetUpService.ts`,
  `common/welcome.ts`).
- **Steps**:
  1. Window opens → setup service checks `WELCOME_COMPLETE_KEY`.
  2. Welcome modal shows (markdown body, primary/secondary buttons).
  3. User completes / signs in → key persists (cleared on sign-out).
- **Views**: D0 Agents Window Shell → **D8 Welcome / Setup Dialog** →
  D7 Account / Copilot Status Widget (sign-in).
- **Products**: `SC_PRODUCT_CODE_OSS_DEV.md` (root `src/`; fork-only).

### S2. Sign In / Manage Account

- **Actor**: User
- **Goal**: Authenticate, view Copilot entitlement/quota, sign out.
- **Entry points**: account widget in the title bar / sidebar footer
  (`contrib/accountMenu/browser/account.contribution.ts`,
  `browser/accountTitleBarState.ts`).
- **Steps**:
  1. Click the account widget → dropdown (Sign in/out, Settings, updates).
  2. Sign in → avatar loads; Copilot status dashboard shows entitlement/quota.
  3. (Optional) Sign out → state resets; welcome may re-show.
- **Views**: D6 Title Bar (Agents Window) / D5 Sessions List footer →
  **D7 Account / Copilot Status Widget**.
- **Products**: `SC_PRODUCT_CODE_OSS_DEV.md` (root `src/`; fork-only).

### S3. Create a New Agent Session and Send the First Message

- **Actor**: User
- **Goal**: Start a new agent session against a workspace and send a prompt.
- **Entry points**: New Session button / Ctrl-Cmd+N / mobile titlebar "+" / sessions
  quick picker "New Session" → `ISessionsViewService.openNewSession()`; or the
  empty session slot.
- **Steps**:
  1. The **New Chat** view renders in a session slot (`NewChatView`,
     `contrib/chat/browser/newChatWidget.ts`).
  2. User picks a folder in the **workspace picker** (`sessionWorkspacePicker.ts`)
     → `openNewSession({ folderUri })` → `management.createNewSession(folderUri)`
     iterates providers (first whose `resolveWorkspace` succeeds) → returns a model
     draft; the view activates it (draft slot shows reactively).
  3. (Optional) User picks a **session type / harness** (e.g. `copilot-cli`,
     `copilot-cloud`) — `SessionTypePicker` → `openNewSession({ folderUri,
     providerId, sessionTypeId })`; the draft may upgrade in place once the
     preferred provider's session types surface.
  4. User types a message and sends (Enter / click Send) →
     `management.sendNewChatRequest(session, {query, attachedContext})` →
     `provider.createNewChat` + `provider.sendRequest` → `onDidStartSession` +
     `onDidSendRequest`; the view swaps the slot to the **Chat** view.
  5. The agent responds; turns stream into the chat view; the session appears in
     the sessions list.
- **Views**: D0 Shell → D1 Session View → **D3 Chat / New Chat Views**
  (`newSession` → `chat`); D5 Sessions List (new row); D6 Title Bar (session picker
  populates).
- **Products**: `SC_PRODUCT_CODE_OSS_DEV.md` (root `src/`; fork-only).
- *Empty/edge states (D3)*: no-workspace-selected (input disabled),
  no-agent-hosts (D3 no-agent-host empty state on web), loading providers,
  no-selectable-model gate.

### S4. Send a New Session in the Background

- **Actor**: User
- **Goal**: Kick off a session without leaving the composer (fire-and-forget).
- **Entry points**: in the new-session composer, **Alt+Enter** (or **Alt-click**
  Send) → `sendNewChatRequest(session, { background: true })`.
- **Steps**:
  1. The window returns to a fresh new-session view (`openNewSession`) **before**
     creating/sending — composer stays in view; no visible-slot swap.
  2. Provider commits asynchronously (must support concurrent new sessions); the
     started session just appears in the sessions list once committed.
  3. On commit failure, management calls `deleteNewSession` to dispose the
     stranded draft.
- **Views**: D1 Session View → D3 New Chat View (stays) → D5 Sessions List
  (row appears on commit).
- **Products**: `SC_PRODUCT_CODE_OSS_DEV.md` (root `src/`; fork-only).
- *Related (no UI swap)*: `createAndSendNewChatRequest(folderUri, …)` for callers
  outside the composer (e.g. automation) — creates + sends in one call without
  touching the active/pending session.

### S5. Continue an Existing Session / Multi-Chat

- **Actor**: User
- **Goal**: Send follow-up turns, or open a second chat within a session.
- **Entry points**: type into an active session's chat input; New Chat toolbar
  action in the session header (creates `newChatInSession`); chat tab strip when
  a session has >1 chat.
- **Steps**:
  1. Active session's Chat view is focused.
  2. Follow-up message → `management.sendRequest(session, chat, options)`; the view
     makes the sent chat active by reacting to send events.
  3. (Optional) New Chat in session → `newChatInSession` draft → send → second
     chat; **chat composite bar** appears to switch between chats.
  4. Input history is scoped by `ISession.sessionId` (Up/Down navigates this
     session's prompts; toggle via `chat.agentSessions.scopedInputHistory`).
- **Views**: D1 Session View (Session header + **chat composite bar**) →
  D3 Chat View.
- **Products**: `SC_PRODUCT_CODE_OSS_DEV.md` (root `src/`; fork-only).

### S6. Browse, Filter & Triage Sessions

- **Actor**: User
- **Goal**: Find, group, pin, rename, archive, and read/unread sessions.
- **Entry points**: Sessions List in the sidebar (`contrib/sessions/browser/views/
  sessionsList.ts`); header actions (New Session, filter menu, find); session
  picker in the title bar; session-header right-click (`Menus.SessionHeaderContext`).
- **Steps**:
  1. Browse the tree — pinned section + collapsible groups (by workspace or by
     date: Today/Yesterday/…).
  2. Find (search highlight) / filter (exclude-archived, exclude-read, by
     session-type, by status); "show more" paginates capped groups.
  3. Read per-row status: `InProgress` (spinner) · `NeedsInput` ("input needed") ·
     `Error` · `Completed` · `Untitled`; flags read/unread, archived (faded),
     pinned, sticky.
  4. Act on a row/header: pin/close, rename (inline edit), mark read/unread,
     archive/delete.
  5. Click a row → `view.openSession(uri)` → `management.setActiveSession` → slot
     arranges + focuses; title bar session picker updates.
- **Views**: **D5 Sessions List** → D6 Title Bar (session picker / agent-host
  filter) → D1 Session View (on open).
- **Products**: `SC_PRODUCT_CODE_OSS_DEV.md` (root `src/`; fork-only).

### S7. Work With Multiple Sessions Side-by-Side

- **Actor**: User
- **Goal**: View several sessions at once; navigate Back/Forward; persist layout.
- **Entry points**: open additional sessions into slots; sticky/pin a slot;
  maximize the active view; Back/Forward navigation (`SessionsNavigation`).
- **Steps**:
  1. Multiple Session Views render side-by-side in the Sessions Part; exactly one
     is **active** (drives focus / context keys / titlebar).
  2. Focus a slot → `part.onDidFocusSession → view.setActive →
     management.setActiveSession`.
  3. Sticky slots persist; non-sticky slots are recycled; one empty slot
     (`undefined`) renders the `newSession` view.
  4. On reload, the grid restores atomically; per-session layout (aux-bar
     visibility + active view, panel show/hide, editor working set) restores via
     `contrib/layout/browser/sessionLayoutController.ts`.
  5. Mobile/phone viewport: single-session enforced (`MobileSessionsPart`).
- **Views**: D0 Shell → **D1 Session View** (grid) → D6 Title Bar.
- **Products**: `SC_PRODUCT_CODE_OSS_DEV.md` (root `src/`; fork-only).

### S8. Review & Apply Changes, Commit, Create PR, Merge

- **Actor**: User
- **Goal**: Review the file changes an agent produced and land them (commit / sync /
  PR / merge), watching CI.
- **Entry points**: Changes View in the auxiliary bar (`contrib/changes/browser/
  changesView.ts`, `changesViewActions.ts`); **auto-reveal** — the aux bar
  auto-reveals to Changes when a chat turn produces new file changes (suppressed on
  mobile).
- **Steps**:
  1. Agent turn produces changes → aux bar reveals Changes View; changes tree shows
     file/folder hierarchy with ±diff stats (changesets are togglable groups).
  2. Open a file → diff (multi-diff source resolver) in the (modal) editor.
  3. Watch the **CI / checks** widget (`checksWidget.ts`): passed / failed /
     loading; collapsible.
  4. Act via the actions bar: **Commit**, **Sync** (push/pull), **Create PR**
     (`createPullRequest`), **Merge** — buttons disable while a git operation is in
     progress.
- **Views**: D0 Shell → **D4 Changes View** (Auxiliary Bar) → D1 Session header
  (±diff stats) → modal editor (diff) when a file is opened.
- **Products**: `SC_PRODUCT_CODE_OSS_DEV.md` (root `src/`; fork-only).

### S9. Open a Session in VS Code / Run a Script / Open Terminal

- **Actor**: User
- **Goal**: Drop from the Agents Window into a full editor, run the session's
  configured script, or open a terminal for the session's workspace.
- **Entry points**: session-header toolbar (Run, Open in VS Code, New Chat); title
  bar right layout (Run script split-button, Open Terminal / Open VS Code).
- **Steps**:
  1. From an active session, click **Open in VS Code** → main workbench opens on the
     session's workspace/worktree (transition to W1).
  2. Or **Run** the configured script → output streams to the (hidden-by-default)
     panel.
  3. Or **Open Terminal** → terminal panel for the session workspace.
  4. (Setup) Tasks with `runOptions.runOn === "worktreeCreated"` are dispatched
     client-side only for sessions this window just started
     (`WorktreeCreatedTaskDispatcher`).
- **Views**: D1 Session header / **D6 Title Bar** → D0 Panel (output) /
  → (handoff) A0 Main Workbench (W1).
- **Products**: `SC_PRODUCT_CODE_OSS_DEV.md` (root `src/`; fork-only).

---

## C. CLI Flows (Rust `code` binary — `cli/`)

The Rust CLI hosts and observes agents and tunnels. Shared output infra:
`cli/src/log.rs`, `cli/src/commands/output.rs` (banners/pager),
`cli/src/util/input.rs` (prompts/spinners). Subcommands declared in
`cli/src/commands/args.rs`.

### C1. Authenticate / Log In

- **Actor**: Developer at a terminal
- **Goal**: Authenticate the CLI to a provider.
- **Entry points**: triggered on first command needing auth (`cli/src/auth.rs`);
  legal consent in `cli/src/tunnels/legal.rs`.
- **Steps**:
  1. Provider selector prompt ("Microsoft Account / GitHub Account").
  2. Device-code message ("log into {URI} and use code {USER_CODE}").
  3. License/legal confirm prompt (interactive) or non-interactive fallback
     (defaults to GitHub / errors if consent needed).
  4. Device-code polling (silent backoff) → success.
- **Views**: **E1 Authentication / Login Flow**.
- **Products**: `SC_PRODUCT_CODE_OSS_DEV.md` (`cli`).

### C2. Start an Agent Host (or Tunnel / Serve Web)

- **Actor**: Developer / operator
- **Goal**: Stand up a backend that the Agents Window / clients connect to.
- **Entry points**: `code agent host` (`commands/agent_host.rs`),
  `code tunnel` (`commands/tunnels.rs` / `tunnels/code_server.rs`),
  `code serve-web` (`commands/serve_web.rs`); optional `--tunnel` to expose the host
  over a dev tunnel.
- **Steps**:
  1. Run the command → readiness banner renders
     (`{PRODUCT} Agent Host/Tunnel vX.Y.Z [ready in Nms]`).
  2. Banner lists `➜ Tunnel / Open / Local / Network / Manage` lines and the web-UI
     URL when applicable.
  3. Host runs; writes a lockfile that `agent ps/logs/stop/kill` discover.
- **Views**: **E2 Tunnel / Agent-Host / Serve-Web Status Banners**;
  E8 logging for sub-component prefixes (`[tunnel.n]`, `[codeserver.n]`).
- **Products**: `SC_PRODUCT_CODE_OSS_DEV.md` (`cli`).

### C3. List Active Agent Sessions (`agent ps`)

- **Actor**: Developer / operator
- **Goal**: See running agent sessions and their status.
- **Entry points**: `code agent ps` (`commands/agent_ps.rs`); `--all` to include
  inactive; `--tunnel <name>` to query a remote host; `--json`.
- **Steps**:
  1. Run → CLI connects to the running agent host (local lockfile or named tunnel).
  2. Prints per-session title + colored status dot + indented fields (uri,
     provider, activity, cwd); or a JSON array with `--json`.
- **Views**: **E3 Agent Session List**; status dots `● input needed` / `● in
  progress` / `● error` / `○ idle` / `? unknown`; "No active sessions." when empty.
- **Products**: `SC_PRODUCT_CODE_OSS_DEV.md` (`cli`).

### C4. Stream Agent Logs (`agent logs`)

- **Actor**: Developer / operator
- **Goal**: Watch a session's live event stream.
- **Entry points**: `code agent logs` (`commands/agent_logs.rs`); `--tunnel` for
  remote.
- **Steps**:
  1. Run → snapshot header (title/provider/activity/turns).
  2. `Streaming events (Ctrl+C to quit)…` separator → live event lines
     `[{seq}] {action} {params}` colored by type.
  3. Ctrl+C → subscription closed.
- **Views**: **E4 Agent Logs Stream**.
- **Products**: `SC_PRODUCT_CODE_OSS_DEV.md` (`cli`).

### C5. Stop / Kill the Agent Host (`agent stop` / `agent kill`)

- **Actor**: Operator
- **Goal**: Gracefully stop or forcefully kill the running agent host.
- **Entry points**: `code agent stop` (`commands/agent_stop.rs`, graceful),
  `code agent kill` (`commands/agent_kill.rs`, force-kill the process tree);
  `--tunnel` for remote stop.
- **Steps**:
  1. Run → CLI resolves the running host (lockfile / tunnel) — errors with "No
     running agent host found. Start one with `code agent host`…" if none.
  2. Sends stop / kills the process tree → confirmation line.
- **Views**: E8 Help / Version / Logging (result lines + errors);
  E2 (host shutdown).
- **Products**: `SC_PRODUCT_CODE_OSS_DEV.md` (`cli`).

### C6. Manage Tunnels

- **Actor**: Operator
- **Goal**: Inspect / rename / install-as-service / prune tunnels and check the
  logged-in user.
- **Entry points**: `code tunnel status|rename|user show|service …|prune`
  (`commands/tunnels.rs`).
- **Steps**: run subcommand → JSON / status output (`{tunnel, service_installed}`,
  rename result, `user show` logged-in state, service install/uninstall, prune
  "Deleted …").
- **Views**: **E5 Tunnel Management Output**; E7 Pager for long output.
- **Products**: `SC_PRODUCT_CODE_OSS_DEV.md` (`cli`).

### C7. Update / Check Version

- **Actor**: Developer / operator
- **Goal**: Update the CLI/desktop or inspect/select installed versions.
- **Entry points**: `code update` (`commands/update.rs`), `code version use|show`
  (`commands/version.rs`, `desktop/version_manager.rs`), `--version`/`--help`
  (`commands/args.rs`).
- **Steps**:
  1. `code update` → up-to-date (exit 1) vs. update-available (exit 0); animated
     download progress; "Successfully updated to {version}".
  2. `code version use/show` → current quality + install path, or
     install-not-found guidance.
- **Views**: **E6 Update / Version Output**; E8 Help / Version / Logging.
- **Products**: `SC_PRODUCT_CODE_OSS_DEV.md` (`cli`).

---

## Cross-Flow Notes & Conventions

- **End-to-end agentic loop**: the headline journey spans surfaces —
  start a backend (**C2** `code agent host`) → create & send a session
  (**S3**/**S4**) → continue turns (**S5**) → review & land changes (**S8**) →
  optionally drop into the full editor (**S9** → **W1**); observe out-of-band via
  the CLI (**C3**/**C4**) or the agent terminal selector (**T1**).
- **Fork-only flows**: **T1** and all of **S1–S9** are stokd additions; **W1–W4**
  and **C1–C7** are inherited/upstream surfaces (the CLI `agent *` commands are
  stokd-flavored but live in the upstream `cli/` tree).
- **Flag gate**: **T1** only manifests with
  `terminal.integrated.agentTabs.enabled = true`; off → byte-identical to W3.
- **Window separation**: Agents Window flows (S*) run in a distinct workbench
  window (`WindowVisibility.Sessions`), never as a panel inside the main workbench
  (W*).
- **Model vs. view split** (S3–S8): the session **model**
  (`ISessionsManagementService`) owns `activeSession`, send, and CRUD; the **view**
  (`ISessionsViewService`) owns slots, opening, focus, navigation, and persistence.
  See `src/vs/sessions/SESSIONS.md`.
- This file is generated meta. Re-run generation after changes to the sessions
  layer, the terminal seam, or CLI command surface.
