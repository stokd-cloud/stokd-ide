<!-- stokd-meta: SC_PRODUCT_CODE_OSS_DEV.md | metaVersion 0.4.0 | generated: FRESH -->
# SC_PRODUCT — `code-oss-dev`

> Product classification document. Fresh generation, meta version 0.4.0.
> Repo: `/opt/worktrees/stokd-cloud/stokd-ide/main` — package identity `code-oss-dev` @ `1.125.0`.

## Product name & constituent packages

- **Product name:** `code-oss-dev` (stokd-ide) — the stokd-cloud agentic editor, a **thin-patch fork of Microsoft VS Code** ("Code – OSS"; `product.json` `nameLong`/`nameShort` = `Code - OSS`, `applicationName` = `code-oss`).
- **Constituent packages** (per `.stokd/meta/config.json`), layered on top of the primary `src/` TypeScript application (root npm package `code-oss-dev`):
  - **`cli`** — Rust `code` launcher/CLI (Cargo crate `code-cli`, binary `code`) — `.stokd/meta/cli/SC_MODULE.md`
  - **`extensions`** — ~105 built-in VS Code extensions + the fork-owned `copilot` (`copilot-chat`) — `.stokd/meta/extensions/SC_MODULE.md`
  - **`remote`** — server (REH `vscode-reh`) + web (`vscode-web`) runtime dependency manifests — `.stokd/meta/remote/SC_MODULE.md`
  - **`scripts`** — dev/CI launchers, test runners, fork-maintenance tooling — `.stokd/meta/scripts/SC_MODULE.md`
  - **`test`** — test harness, UI automation driver (`vscode-automation`), smoke/sanity suites — `.stokd/meta/test/SC_MODULE.md`

This is a **single product**. The desktop (Electron), web (browser), remote-server (REH), and CLI surfaces are all surfaces of the *same* offering — an editor that ships stokd's agentic developer experience — not separate products. Per `SC_OVERVIEW.md` and `SC_FLOWS.md`, there is exactly one product doc and every flow/module references it.

## Description — what this product is and the problem it solves

`code-oss-dev` is a downstream fork of `microsoft/vscode` maintained by stokd-cloud. It keeps the entire VS Code editing experience (workbench, editors, terminal, SCM, extensions, language services) intact and adds two **fork-distinguishing agentic capabilities** while holding the edited-upstream surface as small as possible so rebasing onto each new VS Code release stays a routine, low-conflict operation (the **thin-patch** discipline; governing contract `AX-TERMINAL-AGENT-TABS`, accounted in `SEAM_MANIFEST.md`).

The problem it solves: developers increasingly run AI coding agents alongside their own work, but stock VS Code has no first-class place to *host*, *observe*, *triage*, and *land the output of* many concurrent agent sessions. This product adds that layer end-to-end:

1. **Agents Window** (`src/vs/sessions/`) — a dedicated, fixed-layout, **sessions-first** workbench (distinct from the main editor window) for creating agent sessions, streaming chat turns, reviewing/committing the changes agents produce, and managing many sessions side-by-side. Backends plug in as **session providers** (local CLI, cloud, remote agent host).
2. **Agent-aware terminal selector** (`src/vs/workbench/contrib/terminal/browser/agentTabs/`) — an experimental, flag-gated terminal tab list that shows agent (chat tool-session) terminals alongside human terminals with per-agent run state.
3. **Agent Host CLI** (`cli/` Rust `code` binary) — a native launcher that supervises a long-lived **Agent Host** (over the Agent Host Protocol / AHP) and lets operators host, list, log, stop, and tunnel agent sessions from the terminal.
4. **Copilot Chat extension** (`extensions/copilot/`) — the fork-owned, independently-built AI chat/agent extension that powers the chat content surfaced by the Agents Window.

The fork tracks the upstream release line (`code-oss-dev @ 1.125.0`); branding stays `Code - OSS`, license MIT.

## Target audience

- **Developers** using the editor for everyday work (the inherited VS Code audience) — desktop, web, and remote.
- **Developers running AI coding agents** who want to create, observe, and triage many concurrent agent sessions and land their changes (the Agents Window + Copilot Chat audience).
- **Operators / power users** who host and observe agents from the terminal — running `code agent host`, tunnels, and `agent ps/logs/stop` (the CLI audience).
- **Fork maintainers / contributors** who rebase the patch stack onto upstream and validate the seam (served by `scripts/` + `test/`).

## Entry points / surfaces

| Surface | Entry point(s) | Package |
|---|---|---|
| **Desktop workbench (Electron)** | `src/main.ts` → `out/main.js`; launched via `scripts/code.sh` / `code.bat` | `src/`, `scripts` |
| **Web workbench (browser)** | `scripts/code-web.js`; web build assets from `vscode-web` | `src/`, `remote`, `scripts` |
| **Remote server (REH)** | `src/server-main.ts`; launched via `scripts/code-server.js` (`VSCODE_SERVER_PORT=9888`) | `src/`, `remote`, `scripts` |
| **Agents Window (desktop)** | `src/vs/sessions/sessions.desktop.main.ts` (window `WindowVisibility.Sessions`) | `src/` |
| **Agents Window (web standalone)** | `src/vs/sessions/sessions.web.main.ts`; launched via `scripts/code-sessions-web.js` (default port `8081`) | `src/`, `scripts` |
| **Agent-aware terminal selector** | `terminalView.ts` seam → `agentTabs/`; gated by setting `terminal.integrated.agentTabs.enabled` (default `false`) | `src/` |
| **Rust CLI commands** | `cli/src/bin/code/main.rs` → clap surface (`cli/src/commands/args.rs`): `tunnel`, `serve-web`, `ext`, `status`, `version`, `command-shell`, and the fork-local **`agent host\|ps\|stop\|kill\|logs`** | `cli` |
| **Agent Host server** | `out/vs/platform/agentHost/node/agentHostServerMain.js`; launched via `scripts/code-agent-host.js` (default port `8081`, `READY:<port>` handshake) | `src/`, `scripts` |
| **Built-in extension contributions** | each `extensions/*/package.json` `contributes`/`activationEvents` (commands, menus, views, languages, themes); **`copilot`** powers Agents Window chat | `extensions` |
| **MCP automation server** | `test/mcp/src/stdio.ts` — exposes the automation driver as MCP tools for agent-driven UI testing | `test` |

## Flows (from `SC_FLOWS.md`)

Every flow in `SC_FLOWS.md` belongs to this product. They split into four families:

- **Inherited workbench (upstream):** **W1** Open Folder & Edit, **W2** Review a Diff, **W3** Run a Task / Integrated Terminal, **W4** Open a Webview / Custom Editor.
- **Terminal seam (fork):** **T1** Select an Agent Terminal Alongside Human Terminals (flag-gated; off → byte-identical to W3).
- **Agents Window (fork, `src/vs/sessions/`):** **S1** First-Launch Setup/Welcome, **S2** Sign In / Manage Account, **S3** Create a New Session & Send First Message, **S4** Send a New Session in the Background, **S5** Continue Session / Multi-Chat, **S6** Browse/Filter/Triage Sessions, **S7** Multiple Sessions Side-by-Side, **S8** Review & Apply Changes / Commit / PR / Merge, **S9** Open Session in VS Code / Run Script / Open Terminal.
- **CLI (fork-flavored, `cli/`):** **C1** Authenticate, **C2** Start an Agent Host / Tunnel / Serve Web, **C3** List Sessions (`agent ps`), **C4** Stream Logs (`agent logs`), **C5** Stop/Kill the Agent Host, **C6** Manage Tunnels, **C7** Update / Check Version.

**Headline end-to-end agentic loop** (spans surfaces): start a backend (**C2** `code agent host`) → create & send a session (**S3**/**S4**) → continue turns (**S5**) → review & land changes (**S8**) → optionally drop into the full editor (**S9** → **W1**); observe out-of-band via the CLI (**C3**/**C4**) or the agent terminal selector (**T1**).

## Modules

| Module doc | Contribution to the product |
|---|---|
| **`.stokd/meta/cli/SC_MODULE.md`** (`cli`) | The native Rust `code` binary: launches the desktop editor, runs remote-access servers (`tunnel`, `serve-web`, `command-shell`), and — fork-local — supervises the **Agent Host** and provides the AHP client commands (`agent ps/stop/logs/kill`). Owns CLI flows **C1–C7** and view family **E**. Shares the lockfile schema (`AgentHostMetadata`) with the TS SSH client — a cross-language contract. |
| **`.stokd/meta/extensions/SC_MODULE.md`** (`extensions`) | The built-in extensions that ship inside the editor (language features, grammars, themes, git/github, terminal-suggest, etc.). Mostly inherited upstream and read-only under thin-patch discipline; the **single fork-owned** extension is **`copilot`** (`copilot-chat`), which powers the Agents Window chat content (flows S3–S5) and is built/tested independently (`compile-copilot`, `test-extension`). |
| **`.stokd/meta/remote/SC_MODULE.md`** (`remote`) | Build-input dependency manifests (no app source): declares the runtime closure for the **server (REH `vscode-reh`)** and **web (`vscode-web`)** distributions, and pins the server Node.js version (`remote/.npmrc` `target=24.15.0`). Supplies the runtime deps behind the remote/web workbench, the `node-pty` terminal backend, and ripgrep search. |
| **`.stokd/meta/scripts/SC_MODULE.md`** (`scripts`) | The developer/CI tooling layer — the **only supported way to launch** every runtime surface (`code.sh`, `code-web.js`, `code-server.js`, `code-sessions-web.js`, `code-agent-host.js`, `code-cli.sh`), run the test suites, and maintain the fork (`sync-upstream.sh`, `verify-seam.sh`, `sync-agent-host-protocol.ts`, chat-perf/leak harness). |
| **`.stokd/meta/test/SC_MODULE.md`** (`test`) | The test-harness & UI-automation layer: unit/integration/browser runners, the `vscode-automation` Playwright driver, smoke/sanity suites, and the MCP automation server. Fork value is concentrated in `automation/src/agentsWindow.ts` + `chat.ts` and `smoke/src/areas/{agentsWindow,chat}/`, which exercise the fork's distinguishing surfaces. |

> The primary `src/` TypeScript application (root package `code-oss-dev`) is not one of the five constituent packages but is the core all five layer onto. The Agents Window (`src/vs/sessions/`) and terminal seam (`src/vs/workbench/contrib/terminal/browser/agentTabs/`) live there; see `SC_OVERVIEW.md` §3 and `SEAM_MANIFEST.md`.

## Operational boundaries

**Integrations & external systems**
- **Agent Host Protocol (AHP)** — `ahp` / `ahp-types` crates; the CLI is an AHP client (`agent ps/stop/logs`) and supervises an AHP server (the downloaded agent-host child). Protocol version `AGENT_HOST_PROTOCOL_VERSION = "0.1.0"`. TypeScript-side types are vendored via `scripts/sync-agent-host-protocol.ts` into `src/vs/platform/agentHost/common/state/protocol/` (generated, `DO NOT EDIT`).
- **AI SDKs** — `@anthropic-ai/sdk`, `@github/copilot`, `@github/copilot-sdk`, `@vscode/copilot-api` (root + `remote/`); power Copilot Chat and the session providers.
- **Microsoft dev-tunnels** — relay connectivity for `code tunnel` and exposing the agent host remotely (`AGENT_HOST_PORT = 31546`).
- **Auth providers** — GitHub / Microsoft device flow + OS keyring (CLI `auth.rs`); `*-authentication` extensions provide sessions consumed by `git`, `github`, `copilot`.
- **Telemetry** — Microsoft 1DS (`@microsoft/1ds-*`).

**Data stores / state**
- CLI launcher paths (`state::LauncherPaths`): lockfiles (`agent-host-<quality>.lock`), logs, download/server cache; keyring-stored credentials.
- Server build ships a plain Node runtime (`node-pty` PTY backend, `@vscode/sqlite3`, ripgrep) — kept separate from the Electron desktop closure by design (`remote/`).

**Cross-language / cross-surface contracts (must stay in sync)**
- `AgentHostMetadata` lockfile schema ↔ `src/vs/platform/agentHost/common/remoteAgentHostMetadata.ts` (`AGENT_HOST_METADATA_SCHEMA_VERSION = 1`).
- Supervisor handshake env/sentinels (`VSCODE_AGENT_HOST_SUPERVISOR`, `__VSCODE_AGENT_HOST_READY__`).
- Launcher stdout READY contracts (`Web UI available at …` → port 9888; `READY:<port>` → agent host) parsed by `scripts/`.
- Automation driver `.d.ts` ↔ `src/vs/workbench/services/driver/common/driver.ts` (kept in sync by `test/automation/tools/copy-driver-definition.js`).
- The terminal seam: `terminal.integrated.agentTabs.enabled` flag (`default: false`), `terminalView.ts` flag-off path uses stock `TerminalTabbedView`, `ITerminalTabsView` interface — guarded by `scripts/verify-seam.sh`.

**Runtime constraints**
- Server Node version pinned to `24.15.0`; native modules build from source per `remote/.npmrc` across all REH target platforms.
- Default ports: server `9888`, web `8080`, agent-host / sessions-web `8081`, CLI control `31546`.
- Layer boundaries enforced (`npm run valid-layers-check`): `base → platform → editor → workbench`, with `sessions` above `workbench` (may import from it, never the reverse).

## Product axioms

- `AX-PROD-CODE-OSS-DEV-001`: This repository is a single product (`code-oss-dev`) whose desktop, web, remote-server, and CLI surfaces are surfaces of one offering, not separate products.
- `AX-PROD-CODE-OSS-DEV-002`: The fork is a thin patch on `microsoft/vscode` — the set of edited upstream files must stay minimal and accounted for in `SEAM_MANIFEST.md`, so any change widening the edited-upstream surface requires a governed task.
- `AX-PROD-CODE-OSS-DEV-003`: The agent-aware terminal selector is gated by `terminal.integrated.agentTabs.enabled` defaulting to `false`, so with the flag off the terminal behaves byte-identically to upstream (enforced by `scripts/verify-seam.sh`, governing contract `AX-TERMINAL-AGENT-TABS`).
- `AX-PROD-CODE-OSS-DEV-004`: The Agents Window (`src/vs/sessions/`) is a distinct workbench window (`WindowVisibility.Sessions`) and never renders as a panel inside the main workbench.
- `AX-PROD-CODE-OSS-DEV-005`: The Agent Host lockfile schema (`AgentHostMetadata`) and supervisor handshake are a cross-language contract between the Rust CLI and the TypeScript SSH client — field/sentinel changes must be mirrored in both languages or the surfaces fail to interoperate.
- `AX-PROD-CODE-OSS-DEV-006`: The agent-host protocol types under `src/vs/platform/agentHost/common/state/protocol/` are vendored (generated by `scripts/sync-agent-host-protocol.ts`) and must never be hand-edited.
- `AX-PROD-CODE-OSS-DEV-007`: User-facing flows for this product (W1–W4, T1, S1–S9, C1–C7) must not regress without a governed task that defines acceptance criteria and the corresponding red→green test.
