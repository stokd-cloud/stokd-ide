<!-- stokd-meta-version: 0.5.0 -->
# SC_MODULE.md — `cli`

> Module classification document. Generated for meta version 0.5.0 (fresh generation).

## Module name & location

- **Module**: `cli`
- **Crate**: `code-cli` (Cargo package), library name `cli` (`src/lib.rs`), default binary `code` (`src/bin/code/main.rs`, `default-run = "code"`)
- **Package location**: `cli/` (standalone Rust crate; `Cargo.toml`, `Cargo.lock`, `build.rs`, `rustfmt.toml`)
- **Product**: `SC_PRODUCT_CODE_OSS_DEV.md` (code-oss-dev — packages: `cli`, `extensions`, `remote`, `scripts`, `test`)

This is the standalone Rust `code` launcher/CLI shipped with VS Code (code-oss-dev). It is the upstream Microsoft CLI **plus** a fork-local `agent` command family (`cli/src/commands/agent*.rs`, `cli/src/tunnels/agent_host*.rs`) that supervises and talks to an **Agent Host** over the Agent Host Protocol (AHP). It builds to a single statically-linked native binary with no Node.js runtime.

---

## Responsibility

The `cli` module is the native `code` binary. Its design intent:

1. **Launcher** — resolve and exec the installed desktop editor (`start_code` in `main.rs` via `desktop::CodeVersionManager`), and translate legacy argv into the new clap-based command surface (`bin/code/legacy_args.rs`, `util/is_integrated.rs::is_integrated_cli`).
2. **Remote-access servers** — run VS Code remotely without a desktop install: `tunnel` (dev-tunnels relay), `serve-web` (local web server), and `command-shell` (control server over stdio).
3. **Agent Host supervision (fork-local)** — `agent host` daemonizes a long-lived supervisor that binds a TCP/loopback listener, mints a connection token, manages the downloaded Agent Host backend child (with a background update loop), and optionally exposes it over a dev tunnel. The lockfile it writes (`agent-host-<quality>.lock`) is the rendezvous point for every other `agent` subcommand and for `tunnel`/bridge callers.
4. **Agent Host client (fork-local)** — `agent ps|stop|logs` connect to a running agent host over a WebSocket AHP transport, auto-handle `AUTH_REQUIRED` via device-flow login, and render session lists / live event streams / turn cancellation. `agent kill` tears the supervisor down.
5. **Cross-cutting infrastructure** — auth (`auth.rs`, keyring + device flow), update/self-update (`update_service.rs`, `self_update.rs`), download caching (`download_cache.rs`), RPC (`json_rpc.rs`, `msgpack_rpc.rs`, `rpc.rs`), singleton coordination (`singleton.rs`), platform utilities (`util/`), and terminal output/logging (`log.rs`, `commands/output.rs`, `util/input.rs`).

---

## Public interfaces / entry points

### Process entry point
- `src/bin/code/main.rs` — `#[tokio::main] async fn main()`. Parses argv into `args::AnyCli` (`Integrated` vs `Standalone`), builds a `CommandContext`, and dispatches to one command handler. Exit code is the handler's `Result<i32, AnyError>`. Falls through to `start_code()` (exec the editor) for editor passthrough commands.

### CLI command surface (clap — `src/commands/args.rs`)
Top-level `enum Commands`:
- `tunnel` (`TunnelArgs` → `commands::tunnels`) — subcommands `prune|unregister|kill|restart|status|rename|user|service|forward-internal`, default `serve`.
- `ext` / `Extension` (`ExtensionArgs`) — manage editor extensions (forwarded to the editor).
- `status` (`Commands::Status`) — process diagnostics (forwarded as `--status`).
- `version` (`VersionArgs` → `commands::version`) — `use|show`.
- `serve-web` (`ServeWebArgs` → `commands::serve_web`).
- `command-shell` (`CommandShellArgs`, `hide = true`; control server over stdio → `commands::tunnels::command_shell`).
- **`agent` (`AgentArgs` → `commands::agent_*`)** — fork-local. `enum AgentSubcommand`:
  - `Host(AgentHostArgs)` → `agent_host::agent_host` — also the default when `agent` is run with no subcommand (`flatten` of `AgentHostArgs`).
  - `Ps(AgentPsArgs)` → `agent_ps::agent_ps`
  - `Stop(AgentStopArgs)` → `agent_stop::agent_stop`
  - `Kill` → `agent_kill::agent_kill`
  - `Logs(AgentLogsArgs)` → `agent_logs::agent_logs`

`enum StandaloneCommands` has the single standalone-only `Update(StandaloneUpdateArgs)`.

### Library exports (`src/lib.rs`)
Public modules: `auth`, `constants`, `log` (macro-exporting, `#[macro_use]`), `commands`, `desktop`, `options`, `self_update`, `state`, `tunnels`, `update_service`, `util`. Private: `async_pipe`, `download_cache`, `json_rpc`, `msgpack_rpc`, `rpc`, `singleton`. Per the file's header comment, the exported surface is intentionally being narrowed over time.

### Key public functions (fork-local agent surface)
- `commands::agent::connect(ctx, address, tunnel_name) -> Client` — open + initialize an AHP session via direct address, dev tunnel, or lockfile discovery.
- `commands::agent::request_with_auth(ctx, client, method, params)` — issue an AHP request, transparently running login + retry exactly once on `AUTH_REQUIRED` (`ahp_error_codes::AUTH_REQUIRED`, `-32007`).
- `commands::agent_host::agent_host(ctx, args)` — foreground/supervisor dispatch (branches on `SUPERVISOR_ENV`).
- `commands::agent_host::ensure_supervisor_running(paths, log) -> ActiveAgentHost` — used by `tunnel`/bridge callers to guarantee a live supervisor.
- `commands::agent_host::{ActiveAgentHost, dial_host}` — endpoint description + wildcard→loopback dial mapping; `ActiveAgentHost::apply_to_bridge` populates `CodeServerArgs.agent_host_bridge_*`.
- `tunnels::agent_host_metadata::{read,write,remove}_agent_host_metadata` — lockfile (de)serialization with owner-only permissions.

---

## Products

| Product doc | Relationship |
|---|---|
| `SC_PRODUCT_CODE_OSS_DEV.md` | The only product. `cli` is the Rust `code` binary package alongside `extensions`, `remote`, `scripts`, `test`. It owns CLI flows **C1–C7** and supervises the Agent Host that the GUI/SSH surfaces connect to. |

---

## Views

This module renders terminal-output views only (no GUI). From the current `SC_VIEWS.md`, it owns **Surface family D — Rust `code` CLI (`cli/`)**:

| View | Title | Rendered by |
|---|---|---|
| **V23** | CLI: `agent host` Supervisor Banner | `commands/agent_host.rs` (`run_supervisor`, `print_reuse_banner`) + `commands/output.rs` (`print_banner_header`, `print_banner_line`, `print_network_lines`, `Styles`) |
| **V24** | CLI: `agent ps` Session List | `commands/agent_ps.rs` (`agent_ps`, `format_sessions_list`, `status_styled`); pager via `commands/output.rs::print_paged` |
| **V25** | CLI: `agent logs` Event Stream | `commands/agent_logs.rs` (`agent_logs`, `print_initial_state`, `print_action`, `action_style`) |
| **V26** | CLI: `agent stop` / `agent kill` Result | `commands/agent_stop.rs`, `commands/agent_kill.rs` (`ctx.log.result(...)`) |
| **V27** | CLI: `tunnel` / `serve-web` / `status` / `version` / `update` | `commands/tunnels.rs`, `commands/serve_web.rs`, `commands/version.rs`, `commands/update.rs`, `bin/code/main.rs` |

Shared rendering infra: `src/log.rs` (`StdioLogSink`/`FileLogSink`, `log.result(...)`, `log.emit(...)`), `src/commands/output.rs` (styled banners, `Styles`, `print_paged`, `print_banner_*`/`print_network_lines`), `src/util/input.rs` (`dialoguer`/`indicatif` prompts + spinners).

The CLI does **not** render the GUI surfaces (Agents Window, agent terminal selector, chat dialogs) — those live in `src/vs/...` and `extensions/copilot/`. The CLI's relationship to them is operational: it launches the editor and supervises the agent host that those surfaces (and the TS SSH client) connect to. The handshake strings it prints (`__VSCODE_AGENT_HOST_READY__`, `Web UI available at …`) are a cross-surface contract consumed by `scripts/` and CI (`AX-REPO-SERVER-LAUNCH-HANDSHAKE`).

---

## Integration points

**Upstream / external contracts**
- **AHP (Agent Host Protocol)** — the `ahp` + `ahp-types` crates (`commands::{AuthenticateParams, ListSessionsParams, SubscribeParams, ...}`, `state::*`, `actions::StateAction`, `errors::ahp_error_codes`, `ROOT_RESOURCE_URI`). The CLI is an AHP **client** (ps/stop/logs) and supervises an AHP **server** (the downloaded agent-host child). `AGENT_HOST_PROTOCOL_VERSION = "0.1.0"` (`tunnels/agent_host_metadata.rs`).
- **dev-tunnels** — `tunnels` crate (Microsoft dev-tunnels, git-pinned) for relay connectivity; `DevTunnels` opens direct-tcpip channels to `AGENT_HOST_PORT` (`constants.rs` = `31546`).
- **Update service** — `update_service.rs` resolves/downloads server + agent-host releases over HTTP (`reqwest`), cached in `state::LauncherPaths` (server/download caches).
- **Auth** — `keyring` for credential storage; GitHub/Microsoft device flow (`auth::AuthProvider`, `provider_for_resource`); namespaced credentials (`agent-host` namespace for AHP).
- **Desktop editor** — `desktop::CodeVersionManager` resolves the installed editor binary, which `start_code` execs.

**Cross-language contract (must stay in sync)**
- `src/tunnels/agent_host_metadata.rs::AgentHostMetadata` is the lockfile schema **shared with the TypeScript SSH client** at `src/vs/platform/agentHost/common/remoteAgentHostMetadata.ts` (verified present). `#[serde(rename_all = "camelCase")]`; field renames/removals must be coordinated across both languages. Optional fields (`host`, `connection_token`, `quality`, `tunnel_name`) use `skip_serializing_if = "Option::is_none"` so older lockfiles degrade gracefully. Schema version `AGENT_HOST_METADATA_SCHEMA_VERSION = 1`. Governed at repo level by `AX-MOD-CLI-001` / `AX-REPO-CROSS-LANGUAGE-CONTRACTS` / `AX-PROD-CODE-OSS-DEV-005`.

**Internal coordination contracts**
- `SUPERVISOR_ENV = "VSCODE_AGENT_HOST_SUPERVISOR"` and stdout sentinel `SUPERVISOR_READY_LINE = "__VSCODE_AGENT_HOST_READY__"` — the foreground↔supervisor handshake (`commands/agent_host.rs`). Changing either silently breaks daemonization (foreground hangs until `SUPERVISOR_READY_TIMEOUT = 5min`).
- `MANAGEMENT_SOCKET_ENV = "VSCODE_AGENT_HOST_MANAGEMENT_SOCKET"` — tells the agent-host child it has a managing CLI (`tunnels/agent_host.rs`).
- `VSCODE_CLI_INITIAL_AH_VERSION` / `VSCODE_CLI_OVERRIDE_SERVER_PATH` — version/path overrides for testing the upgrade flow.
- `--agent-host-bridge-{host,port,connection-token}` on `CodeServerArgs` — the bridge channel a spawned VS Code server uses to dial the supervisor (`ActiveAgentHost::apply_to_bridge`).
- Ports: `CONTROL_PORT = 31545`, `AGENT_HOST_PORT = 31546` (`constants.rs`). Build-time `option_env!` overrides (`VSCODE_CLI_*`) are wired in `build.rs` from `product.json` / `package.json`.

---

## Key source files

| File | Why it matters |
|---|---|
| `src/bin/code/main.rs` | Process entry; argv parsing, `CommandContext` construction, command dispatch (`match c.subcommand`), editor exec via `start_code`. |
| `src/bin/code/legacy_args.rs` | Back-compat translation of the old Node CLI argv into the new clap surface. |
| `src/commands/args.rs` | The entire clap command/flag contract (`Commands`, `AgentSubcommand`, `*Args`, `StandaloneCommands`). Public CLI surface. |
| `src/commands/agent_host.rs` | Foreground vs supervisor modes, daemonization handshake, `mint_connection_token`, config-conflict detection, `ensure_supervisor_running`, `ActiveAgentHost`/`dial_host`. Renders V23. |
| `src/tunnels/agent_host.rs` | Supervisor internals: `AgentHostManager` (download/update loop), `AgentHostSidecar` (loopback/tunnel proxy accept loop), env-var contracts, server lifecycle, `MANAGEMENT_SOCKET_ENV`. |
| `src/tunnels/agent_host_metadata.rs` | Lockfile schema (`AgentHostMetadata`) + owner-only atomic read/write — cross-language contract with the TS SSH client; well-covered by `#[cfg(test)]`. |
| `src/commands/agent.rs` | AHP client plumbing: `connect`, `WsTransport`, `request_with_auth`, device-flow auth-on-`-32007`, lockfile discovery. |
| `src/commands/agent_ps.rs` / `agent_stop.rs` / `agent_logs.rs` / `agent_kill.rs` | The four AHP client commands (list / cancel-turn / stream / kill). Render V24–V26. |
| `src/commands/output.rs` | Banner/table/pager rendering + `Styles`. Shared by all status views. |
| `src/auth.rs` | Credential storage (keyring), device flow, `AuthProvider`, namespaced credentials. |
| `src/state.rs` | `LauncherPaths` — canonical path resolution (lockfiles, logs, caches, agent-host root). |
| `src/constants.rs` | Ports (`CONTROL_PORT = 31545`, `AGENT_HOST_PORT = 31546`), product names, `EDITOR_WEB_URL`, build-time `option_env!` overrides. |
| `src/util/errors.rs` | `AnyError`/`CodeError` taxonomy (e.g. `NoRunningAgentHost`, `CouldNotListenOnInterface`, `*ConnectionToken*`); these strings are user-facing. |
| `Cargo.toml` | Dependency contract (tokio, clap, reqwest, tokio-tungstenite, `ahp`/`ahp-types`, dev-tunnels git pin, russh patch). |
| `build.rs` | Build-time env injection: reads `package.json` version and `product.json`/overrides into `VSCODE_CLI_*` `rustc-env` vars; embeds Windows resources via `winresource`. |

---

## Change impact

When this module changes, validate the following:

- **Command surface (`args.rs`)** — renaming/removing a command, subcommand, or flag is a breaking contract change for users and scripts; legacy-arg translation (`legacy_args.rs`) and any docs/help text must be updated together (`AX-MOD-CLI-004`).
- **Agent-host lockfile (`AgentHostMetadata`)** — any field change must be mirrored in `src/vs/platform/agentHost/common/remoteAgentHostMetadata.ts`; otherwise the TS SSH client fails to parse running supervisors. Bump `AGENT_HOST_METADATA_SCHEMA_VERSION` for incompatible changes and verify older lockfiles still degrade gracefully (e.g. `host: None`) (`AX-MOD-CLI-001`).
- **Supervisor handshake** — changing `SUPERVISOR_ENV`, `SUPERVISOR_READY_LINE`, or the stdout-sentinel protocol breaks daemonization silently (foreground hangs until `SUPERVISOR_READY_TIMEOUT`). Test fresh-start, `--replace`, and reuse paths (`AX-MOD-CLI-002`).
- **AHP method names / params / error codes** — `agent.rs` and the command handlers rely on the `ahp`/`ahp-types` request types and on `ahp_error_codes::AUTH_REQUIRED`. Keep aligned with the crate versions; route auth-gated calls through `request_with_auth` (`AX-MOD-CLI-003`).
- **Auth flow** — changes to `AuthProvider` selection (`provider_for_resource`) or namespacing (`agent-host`) can break the auto-login-and-retry path; verify the `-32007`→login→retry cycle still works.
- **Token / permission handling** — `mint_connection_token` and lockfile writes must remain owner-only (`0o600` file / `0o700` dir) and never log token values (`AX-MOD-CLI-005`).
- **Output rendering** — status-dot logic (`agent_ps::status_styled`), JSON output shape (`--json`), and banner lines are observed behavior covered by views V23–V27; verify TTY and non-TTY paths.
- **Error messages** — `CodeError` strings and the inline guidance ("Start one with `code agent host`", "pass `--replace`") are observable; update referencing docs/tests when reworded.
- **Build** — run `cargo build` and `cargo test` (≈46 `#[test]` functions across ≈17 modules, e.g. `agent_host::mint_connection_token_*`, `agent_host_metadata::*`, `msgpack_rpc`, `singleton`, `util/*`). Cross-platform `cfg` branches (Windows/macOS/Linux in `agent_host.rs::redirect_stdio_to_null`, `tunnels/nosleep_*`, `tunnels/service_*`, target-specific deps) need per-OS validation when touched.

---

## Notes

- Per `SC_TEST.md` and `AX-REPO-FORK-TDD-SCOPE`, upstream Rust code is largely covered by Microsoft and is re-verified rather than re-tested; the fork-local **value-add is the `agent` family** — that is where new tests belong. Keep new logic in pure, unit-testable functions (cf. `mint_connection_token`, `detect_config_conflict`, `dial_host`, `agent_ps::is_active`/`status_styled`, `agent_host_metadata` round-trip) so behavior can be tested without spawning processes or binding sockets.
- The lockfile and supervisor handshake are cross-language contracts; the cli-local invariants live in `cli/.axioms.md` and roll up to repo-wide `AX-REPO-CROSS-LANGUAGE-CONTRACTS` / `AX-REPO-SERVER-LAUNCH-HANDSHAKE` in `.stokd/meta/SC_AXIOMS.md`.
