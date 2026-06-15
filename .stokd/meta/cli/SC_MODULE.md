<!-- stokd-meta-version: 0.4.0 -->
# SC_MODULE.md — `cli`

## Module name & location

- **Module**: `cli`
- **Crate**: `code-cli` (Cargo package), library name `cli` (`src/lib.rs`), default binary `code` (`src/bin/code/main.rs`)
- **Package location**: `cli/` (Rust workspace; `Cargo.toml`, `Cargo.lock`, `build.rs`)
- **Product**: `SC_PRODUCT_CODE_OSS_DEV.md` (code-oss-dev — packages: `cli`, `extensions`, `remote`, `scripts`, `test`)

This is the standalone Rust `code` launcher/CLI shipped with VS Code (code-oss-dev). It is the upstream Microsoft CLI **plus** a fork-local `agent` command family (`cli/src/commands/agent*.rs`, `cli/src/tunnels/agent_host*.rs`) that supervises and talks to an **Agent Host** over the Agent Host Protocol (AHP).

---

## Responsibility

The `cli` module is the native, statically-linked `code` binary. Its design intent:

1. **Launcher** — resolve and exec the installed desktop editor (`start_code` in `main.rs` via `desktop::CodeVersionManager`), and translate legacy argv into the new clap-based command surface (`bin/code/legacy_args.rs`, `is_integrated_cli`).
2. **Remote access servers** — run VS Code remotely without a desktop install: `tunnel` (dev-tunnels relay), `serve-web` (local web server), and `command-shell` (control server over stdio).
3. **Agent Host supervision (fork-local)** — `agent host` daemonizes a long-lived supervisor that binds a TCP/loopback listener, mints a connection token, manages the downloaded Agent Host backend child (with a background update loop), and optionally exposes it over a dev tunnel. The lockfile it writes is the rendezvous point for every other `agent` subcommand and for `tunnel`/bridge callers.
4. **Agent Host client (fork-local)** — `agent ps|stop|logs` connect to a running agent host over a WebSocket AHP transport, auto-handle `AUTH_REQUIRED` via device-flow login, and render session lists / live event streams / turn cancellation.
5. **Cross-cutting infrastructure** — auth (`auth.rs`, keyring + device flow), update/self-update (`update_service.rs`, `self_update.rs`), download caching (`download_cache.rs`), RPC (`json_rpc.rs`, `msgpack_rpc.rs`, `rpc.rs`), singleton coordination (`singleton.rs`), platform utilities (`util/`), and terminal output/logging (`log.rs`, `commands/output.rs`, `util/input.rs`).

---

## Public interfaces / entry points

### Process entry point
- `src/bin/code/main.rs` — `#[tokio::main] async fn main()`. Parses argv into `args::AnyCli` (`Integrated` vs `Standalone`), builds a `CommandContext`, and dispatches to one command handler. Exit code is the handler's `Result<i32, AnyError>`.

### CLI command surface (clap — `src/commands/args.rs`)
Top-level `enum Commands`:
- `tunnel` (`TunnelArgs` → `commands::tunnels`) — subcommands `prune|unregister|kill|restart|status|rename|user|service|forward-internal`, default `serve`.
- `ext` (`ExtensionArgs`) — manage editor extensions (forwarded to the editor).
- `status` — process diagnostics (forwarded as `--status`).
- `version` (`use|show` → `commands::version`).
- `serve-web` (`ServeWebArgs` → `commands::serve_web`).
- `command-shell` (hidden; control server over stdio → `commands::tunnels::command_shell`).
- **`agent` (`AgentArgs` → `commands::agent_*`)** — fork-local. Subcommands:
  - `host` (`AgentHostArgs` → `agent_host::agent_host`) — also the default when `agent` is run with no subcommand.
  - `ps` (`AgentPsArgs` → `agent_ps::agent_ps`)
  - `stop <session>` (`AgentStopArgs` → `agent_stop::agent_stop`)
  - `kill` (`agent_kill::agent_kill`)
  - `logs <session>` (`AgentLogsArgs` → `agent_logs::agent_logs`)

`StandaloneCommands::Update` is the only standalone-only command.

### Library exports (`src/lib.rs`)
Public modules: `auth`, `constants`, `log` (macro-exporting), `commands`, `desktop`, `options`, `self_update`, `state`, `tunnels`, `update_service`, `util`. Private: `async_pipe`, `download_cache`, `json_rpc`, `msgpack_rpc`, `rpc`, `singleton`. (Per the header comment, the exported surface is intentionally being narrowed over time.)

### Key public functions (fork-local agent surface)
- `commands::agent::connect(ctx, address, tunnel_name) -> Client` — open + initialize an AHP session via direct address, dev tunnel, or lockfile discovery.
- `commands::agent::request_with_auth(ctx, client, method, params)` — issue an AHP request, transparently running login + retry on `AUTH_REQUIRED` (`-32007`).
- `commands::agent_host::agent_host(ctx, args)` — foreground/supervisor dispatch.
- `commands::agent_host::ensure_supervisor_running(paths, log) -> ActiveAgentHost` — used by `tunnel`/bridge callers to guarantee a live supervisor.
- `commands::agent_host::{ActiveAgentHost, dial_host}` — endpoint description + wildcard→loopback dial mapping; `ActiveAgentHost::apply_to_bridge` populates `CodeServerArgs.agent_host_bridge_*`.

---

## Products

| Product doc | Relationship |
|---|---|
| `SC_PRODUCT_CODE_OSS_DEV.md` | The only product. `cli` is the Rust `code` binary package alongside `extensions`, `remote`, `scripts`, `test`. |

---

## Views

This module renders terminal-output "views" (no GUI). From `SC_VIEWS.md`, surface **E — CLI Terminal Output (`cli/`)**:

| View | Rendered by |
|---|---|
| **E1. Authentication / Login Flow** | `src/auth.rs`, `src/util/input.rs`, `src/tunnels/legal.rs` |
| **E2. Tunnel / Agent-Host / Serve-Web Status Banners** | `src/commands/agent_host.rs`, `src/commands/serve_web.rs`, `src/tunnels/code_server.rs`, banner renderer `src/commands/output.rs` |
| **E3. Agent Session List (`agent ps`)** | `src/commands/agent_ps.rs` |
| **E4. Agent Logs Stream (`agent logs`)** | `src/commands/agent_logs.rs` |
| **E5. Tunnel Management Output** | `src/commands/tunnels.rs` |
| **E6. Update / Version Output** | `src/commands/update.rs`, `src/commands/version.rs` |

Shared rendering infra: `src/log.rs` (`StdioLogSink`/`FileLogSink`, `log.result(...)`), `src/commands/output.rs` (styled banners, `Styles`, `print_paged`, `print_banner_*`/`print_network_lines`), `src/util/input.rs` (`dialoguer`/`indicatif` prompts + spinners).

The CLI does **not** render the GUI surfaces (A–D, e.g. the Agent-aware terminal selector or Agents Window) — those live in `src/vs/...`. The CLI's relationship to them is operational: it launches the editor and supervises the agent host the GUI/SSH client connects to.

---

## Integration points

**Upstream / external contracts**
- **AHP (Agent Host Protocol)** — the `ahp` + `ahp-types` crates (`commands::{AuthenticateParams, ListSessionsParams, SubscribeParams, ...}`, `state::*`, `actions::StateAction`, `errors::ahp_error_codes`, `ROOT_RESOURCE_URI`, `PROTOCOL_VERSION`). The CLI is an AHP **client** (ps/stop/logs) and supervises an AHP **server** (the downloaded agent host child).
- **dev-tunnels** — `tunnels` crate (Microsoft dev-tunnels) for relay connectivity; `DevTunnels` opens direct-tcpip channels to `AGENT_HOST_PORT` (`constants.rs` = `31546`).
- **Update service** — `update_service.rs` resolves/downloads server + agent-host releases over HTTP (`reqwest`), cached in `state::LauncherPaths::server_cache`.
- **Auth** — `keyring` for credential storage; GitHub/Microsoft device flow (`AuthProvider`); namespaced credentials (`agent-host` namespace for AHP).
- **Desktop editor** — `desktop::CodeVersionManager` resolves the installed editor binary, which `start_code` execs.

**Cross-language contract (must stay in sync)**
- `src/tunnels/agent_host_metadata.rs::AgentHostMetadata` is the lockfile schema **shared with the TypeScript SSH client** at `src/vs/platform/agentHost/common/remoteAgentHostMetadata.ts`. Field renames/removals must be coordinated across both languages. Lockfile path: `<launcher-root>/.../agent-host-<quality>.lock` (`LauncherPaths::agent_host_lockfile`). Schema version `AGENT_HOST_METADATA_SCHEMA_VERSION = 1`, protocol `AGENT_HOST_PROTOCOL_VERSION = "0.1.0"`.

**Internal coordination contracts**
- `SUPERVISOR_ENV = "VSCODE_AGENT_HOST_SUPERVISOR"` and stdout sentinel `SUPERVISOR_READY_LINE = "__VSCODE_AGENT_HOST_READY__"` — the foreground↔supervisor handshake (`agent_host.rs`). Changing either silently breaks daemonization.
- `MANAGEMENT_SOCKET_ENV = "VSCODE_AGENT_HOST_MANAGEMENT_SOCKET"` — tells the agent host child it has a managing CLI (`tunnels/agent_host.rs`).
- `VSCODE_CLI_INITIAL_AH_VERSION` / `VSCODE_CLI_OVERRIDE_SERVER_PATH` — version/path overrides for testing the upgrade flow.
- `--agent-host-bridge-{host,port,connection-token}` on `CodeServerArgs` — the bridge channel a spawned VS Code server uses to dial the supervisor.

---

## Key source files

| File | Why it matters |
|---|---|
| `src/bin/code/main.rs` | Process entry; argv parsing, `CommandContext` construction, command dispatch, editor exec. |
| `src/bin/code/legacy_args.rs` | Back-compat translation of the old Node CLI argv into the new clap surface. |
| `src/commands/args.rs` | The entire clap command/flag contract (`Commands`, `AgentSubcommand`, `*Args`). Public CLI surface. |
| `src/commands/agent_host.rs` | Foreground vs supervisor modes, daemonization handshake, token minting, config-conflict detection, `ensure_supervisor_running`, `ActiveAgentHost`/`dial_host`. |
| `src/tunnels/agent_host.rs` | The supervisor internals: `AgentHostManager` (download/update loop), `AgentHostSidecar` (loopback/tunnel proxy accept loop), env-var contracts, server lifecycle. |
| `src/tunnels/agent_host_metadata.rs` | Lockfile schema (`AgentHostMetadata`) — cross-language contract with the TS SSH client. |
| `src/commands/agent.rs` | AHP client plumbing: `connect`, `WsTransport`, `request_with_auth`, device-flow auth-on-`-32007`, lockfile discovery. |
| `src/commands/agent_ps.rs` / `agent_stop.rs` / `agent_logs.rs` | The three AHP client commands (list / cancel-turn / stream). Render views E3/E4. |
| `src/commands/output.rs` | Banner/table/pager rendering + `Styles`. Shared by all status views. |
| `src/auth.rs` | Credential storage (keyring), device flow, `AuthProvider`, namespaced credentials. |
| `src/state.rs` | `LauncherPaths` — canonical path resolution (lockfiles, logs, caches, agent-host root). |
| `src/constants.rs` | Ports (`CONTROL_PORT`, `AGENT_HOST_PORT`), product names, `EDITOR_WEB_URL`, build-time `option_env!` overrides. |
| `src/util/errors.rs` | `AnyError`/`CodeError` taxonomy (e.g. `NoRunningAgentHost`, `CouldNotListenOnInterface`, `*ConnectionToken*`); these strings are user-facing. |
| `Cargo.toml` | Dependency contract (tokio, clap, reqwest, tungstenite, `ahp`/`ahp-types`, dev-tunnels git pin, russh patch). |
| `build.rs` | Build-time codegen / resource embedding (Windows resources via `winresource`). |

---

## Change impact

When this module changes, validate the following:

- **Command surface (`args.rs`)** — renaming/removing a command, subcommand, or flag is a breaking contract change for users and scripts; legacy-arg translation (`legacy_args.rs`) and any docs/help text must be updated together.
- **Agent-host lockfile (`AgentHostMetadata`)** — any field change must be mirrored in `src/vs/platform/agentHost/common/remoteAgentHostMetadata.ts`; otherwise the TS SSH client fails to parse running supervisors. Bump `AGENT_HOST_METADATA_SCHEMA_VERSION` for incompatible changes and verify older lockfiles still degrade gracefully (e.g. `host: None`).
- **Supervisor handshake** — changing `SUPERVISOR_ENV`, `SUPERVISOR_READY_LINE`, or the stdout-sentinel protocol breaks daemonization silently (foreground hangs until `SUPERVISOR_READY_TIMEOUT`). Test fresh-start, `--replace`, and reuse paths.
- **AHP method names / params / error codes** — `agent.rs` and the command handlers hard-code AHP method strings (`listSessions`, `subscribe`, `authenticate`) and rely on `ahp_error_codes::AUTH_REQUIRED`. Keep aligned with the `ahp`/`ahp-types` crate versions.
- **Auth flow** — changes to `AuthProvider` selection (`provider_for_resource`) or namespacing (`agent-host`) can break the auto-login-and-retry path; verify the `-32007`→login→retry cycle still works.
- **Output rendering** — status-dot logic (`agent_ps::status_styled`/`is_active`), JSON output shape (`--json`), and banner lines are observed behavior covered by views E2–E4; verify TTY and non-TTY paths.
- **Error messages** — `CodeError` strings and the inline guidance ("Start one with `code agent host`", "pass `--replace`") are observable; update referencing docs/tests when reworded.
- **Build** — run `cargo build` and `cargo test` (the only existing Rust tests live in `#[cfg(test)]` modules, e.g. `agent_host::mint_connection_token_*`, `msgpack_rpc`, `singleton`, `util/*`). Cross-platform `cfg` branches (Windows/macOS/Linux in `agent_host.rs::redirect_stdio_to_null`, target-specific deps) need per-OS validation when touched.

---

## Notes

- Per `SC_TEST.md`, upstream Rust code is largely covered by Microsoft; the fork-local **value-add is the `agent` family** — that is where new tests belong. Keep new logic in pure, unit-testable functions (cf. `mint_connection_token`, `detect_config_conflict`, `dial_host`, `is_active`) so behavior can be tested without spawning processes or binding sockets.
