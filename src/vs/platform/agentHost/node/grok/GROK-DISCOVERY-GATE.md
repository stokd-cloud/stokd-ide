# Grok CLI discovery gate — RESULT

> **Project:** chat-panel-as-multi-provider-llm-cli — **Work item 4.1** (Grok discovery gate)
> **Acceptance criterion AC-P3.0:** *Storage path/format + flags documented and pinned before
> committing to file-watch listing.*
> **Date:** 2026-06-25 · **Status:** COMPLETE — evidence below; gate decision recorded as
> [`DESIGN-DECISIONS.md` DN-5](../../DESIGN-DECISIONS.md).

This is the discovery gate's documented outcome. It answers exactly the three questions the gate
requires, against a **pinned** grok binary, **before** any code commits to a session-listing
strategy:

1. **Where/how does grok persist sessions on disk** (path + format)?
2. **What is the headless (non-interactive, machine-readable) output flag**?
3. **What is the resume flag**?

…and then it makes the gate call: **is file-watch listing of the on-disk session tree the right
strategy, or should the provider shell out to the CLI / read a database instead?**

**Answer:** the authoritative, current session catalogue is the **per-session directory tree**
(`~/.grok/sessions/<encodeURIComponent(cwd)>/<session-uuid-v7>/`), one small `summary.json` per
session. **File-watch listing of that tree is viable and is the recommended strategy.** The two
SQLite stores are derived/stale, and `grok sessions list` emits no machine-readable output. See
[Verdict](#verdict).

---

## Pinned target

| Field | Value | Source |
|---|---|---|
| CLI | xAI **Grok** (`grok`) — "Grok Build TUI" | `~/.grok/bin/grok` → `downloads/grok-0.2.51-macos-aarch64` (Mach-O arm64) |
| **Version (pin)** | **`0.2.51`** (build `f4f85a6492e`, channel `[stable]`) | `grok --version`; `~/.grok/version.json`; `~/.grok/.metadata_version` |
| Install root | `~/.grok` (`grok_home`) | `summary.json` `grok_home`; `--leader-socket` default `~/.grok/leader.sock` |
| **Headless single-turn flag (pin)** | **`-p` / `--single <PROMPT>`** — "Single-turn prompt. Prints the response to stdout and exits" | `grok --help` |
| **Headless output-format flag (pin)** | **`--output-format <plain\|json\|streaming-json>`** (`default: plain`) — "Output format for headless mode" | `grok --help` |
| Headless agent subcommands | `grok agent {stdio,headless,serve,leader}` — "Run Grok without the interactive UI" | `grok agent --help` |
| **Resume flag (pin)** | **`-r` / `--resume [<SESSION_ID>]`** — "Resume a session by ID, or the most recent if omitted" | `grok --help` |
| Continue-most-recent flag | `-c` / `--continue` — "Continue the most recent session for the current working directory" | `grok --help` |
| Resume side-effect flag | `--restore-code` — "Check out the original session's commit when resuming" | `grok --help` |
| **Session store (pin)** | **per-session directory tree** under `~/.grok/sessions/` (authoritative) | on-disk inspection (81 sessions) |
| Session id format | **UUID v7** (time-ordered; `019e…` prefix encodes the timestamp) | session dir names; `summary.json` `info.id` |
| Transcript format | newline-delimited JSON (`chat_history.jsonl`, `events.jsonl`, `updates.jsonl`); `chat_format_version: 1` | on-disk inspection |

---

## Q1 — Storage path / format

### Layout

```
~/.grok/                                  # grok_home
├─ grok.db                                # global SQLite — LEGACY/STALE (see Verdict)
└─ sessions/
   ├─ session_search.sqlite               # FTS5 search index — DERIVED, lags (see Verdict)
   └─ <encodeURIComponent(cwd)>/          # one dir per workspace; e.g. %2Fopt%2Fworktrees%2F…
      ├─ prompt_history.jsonl             # workspace-level input history (not per session)
      └─ <session-uuid-v7>/               # one dir per session, e.g. 019e7fe3-ff18-7cc0-…
         ├─ summary.json                  # ← session-list HEADER (title, timestamps, model, git)
         ├─ chat_history.jsonl            # conversation transcript (replay source)
         ├─ events.jsonl                  # structured event stream (live-event analogue)
         ├─ updates.jsonl                 # fine-grained UI updates (large)
         ├─ rewind_points.jsonl           # checkpoint/rewind markers
         ├─ hunk_records.jsonl            # edit hunks
         ├─ signals.json                  # per-session metrics (turn/token/tool counts)
         ├─ resources_state.json
         ├─ prompt_context.json
         ├─ announcement_state.json
         ├─ system_prompt.txt
         ├─ terminal/                     # per-tool-call terminal logs (call-<uuid>-<n>.log)
         └─ images/                       # attached/generated images
```

### Workspace-directory key — percent-encoded cwd

Each workspace's sessions live under a directory whose name is the **percent-encoded absolute
working directory**. Verified: `encodeURIComponent('/opt/worktrees/stokd-cloud/stokd-ide/project-prd-chat-panel-as-multi-provider-llm-cli')`
produces exactly the observed on-disk name `%2Fopt%2Fworktrees%2Fstokd-cloud%2Fstokd-ide%2Fproject-prd-chat-panel-as-multi-provider-llm-cli`
(`/` → `%2F`; `-`, `.`, alphanumerics pass through). **A consumer must encode the cwd the same way to
locate a workspace's sessions** — do not assume a flat slug. (On a pin bump, re-confirm the exact
encoder for edge characters — spaces, unicode — from the CLI; the common `/`→`%2F` case is pinned
here.)

### `summary.json` — the session-list header (this is what a listing UI reads)

Keys (pinned at this version):
`info{ id, cwd }`, `session_summary`, `generated_title`, `created_at`, `updated_at`,
`last_active_at`, `num_messages`, `num_chat_messages`, `current_model_id`, `chat_format_version`,
`git_root_dir`, `git_remotes[]`, `head_commit`, `head_branch`, `agent_name`, `request_id`,
`grok_home`, `next_trace_turn`.

Example:

```json
{
  "info": { "id": "019e7fe3-ff18-7cc0-a3a7-8e0e4280fd9d",
            "cwd": "/opt/worktrees/brian-stoker/mic-n-stand-recordings/mic-n-stand-recordings-main" },
  "session_summary": "unsuck.py Sandbox Testing for Automator Audio Video Processing",
  "generated_title": "unsuck.py Sandbox Testing for Automator Audio Video Processing",
  "created_at": "2026-05-31T21:15:09.151116Z",
  "updated_at": "2026-05-31T22:07:39.788418Z",
  "last_active_at": "2026-05-31T22:07:39.788418Z",
  "num_messages": 655, "num_chat_messages": 313,
  "current_model_id": "grok-build", "chat_format_version": 1,
  "head_branch": "main", "agent_name": "grok-build-plan"
}
```

Everything a session-list row needs — **title** (`generated_title` / `session_summary`), **id**,
**cwd**, **created/updated timestamps**, **model**, **message count**, **git branch** — is in this
one small file. Session ids are **UUID v7**, so a lexical sort of the dir names is ≈ chronological,
which gives "most recent first" almost for free.

### Transcript / event format (downstream replay+normalize input — not consumed by this gate)

- `chat_history.jsonl` — the conversation transcript. Record `type`/`role` vocabulary observed:
  `system`, `user`, `assistant`, `reasoning`, `tool_result`, `backend_tool_call`.
  Header `chat_format_version: 1`.
- `events.jsonl` — structured event stream (each line `{ ts, type, … }`). `type` vocabulary
  observed: `mcp_config_resolved`, `mcp_server_starting/connected/failed`, `mcp_init_completed`,
  `turn_started`, `turn_ended`, `loop_started`, `first_token`, `phase_changed`, `tool_started`,
  `tool_completed`, `permission_requested`, `permission_resolved`.

These shapes are recorded here for the **downstream** replay/normalizer work item; this gate does not
freeze them (that belongs with the listing/replay implementation, mirroring codex's
`codexVersionContract.test.ts`).

---

## Q2 — Headless output flag

Two complementary headless surfaces, both pinned from `grok --help` / `grok agent --help`:

1. **Top-level single-turn** (the simple "ask once, print, exit" path):
   - `-p` / `--single <PROMPT>` — *"Single-turn prompt. Prints the response to stdout and exits"*.
   - `--prompt-file <PATH>` / `--prompt-json <JSON>` — same, prompt sourced from a file / JSON blocks.
   - **`--output-format <plain|json|streaming-json>`** — *"Output format for headless mode"*,
     `default: plain`. → **`--output-format json`** for a single JSON result, **`streaming-json`**
     for an NDJSON event stream.
   - Related headless-only modifiers: `--best-of-n <N>`, `--check`, `--max-turns <N>`.

2. **Agent subcommand** (the structured, long-lived agent loop):
   - `grok agent stdio` — run the agent over **stdio** (in-process JSON-RPC-style transport).
   - `grok agent headless` — run headlessly over the Grok WebSocket relay.
   - `grok agent serve` — run as a WebSocket server.
   - `grok agent leader` — run as the shared leader process other clients attach to.

For a chat-panel adapter the natural fit is `grok agent stdio` (structured, steerable, local
transport) for the live turn, with `--output-format json|streaming-json` available for simpler
one-shot needs. (Transport/steering tier selection is a **downstream** work item — out of scope for
this gate, which only had to confirm a machine-readable headless surface exists. It does.)

---

## Q3 — Resume flag

Pinned from `grok --help`:

- **`-r` / `--resume [<SESSION_ID>]`** — *"Resume a session by ID, or the most recent if omitted."*
  The `<SESSION_ID>` is the UUID v7 that names the session directory and appears as
  `summary.json` `info.id`.
- **`-c` / `--continue`** — *"Continue the most recent session for the current working directory."*
  (no id needed; cwd-scoped.)
- **`--restore-code`** — *"Check out the original session's commit when resuming"* (resume
  side-effect; off by default — resume does **not** touch the working tree unless asked).

So resume is keyed by the **same session id** that the on-disk tree and `summary.json` expose — the
listing strategy and the resume strategy share one identifier, no extra mapping needed. There is also
`grok export <SESSION_ID>` (transcript → Markdown) and `grok sessions restore`, both keyed by the
same id.

---

## Verdict

**File-watch the per-session `summary.json` tree. Do not depend on `grok sessions list` or the
SQLite stores for listing.**

### Why file-watch the directory tree (recommended)

- It is the **authoritative, current** source: **81** session directories on disk, **81**
  `summary.json` files — a 1:1, complete catalogue, written live by the running CLI.
- Each session is a single small JSON header (`summary.json`) — cheap to read, trivially watchable
  (watch `~/.grok/sessions/<encodeURIComponent(cwd)>/`; react to `summary.json`
  create/update). UUID-v7 dir names sort ≈ chronologically.
- It is **offline and local** — no leader process, no network, no auth required to enumerate.
- Resume keys (`info.id`) come straight from the same files — listing and resume share one id.

### Why NOT `grok sessions list`

- `grok sessions list` / `grok sessions search` expose **only** `-n/--limit` — **no
  `--output-format json`**. Output is human/TUI text, not a machine-readable contract; parsing it
  would be brittle.
- It routes through the **leader socket** (`--leader-socket`, default `~/.grok/leader.sock`), i.e. it
  may spawn/attach a backend rather than being a pure local read. (Not run live in this gate to avoid
  a backend/network side-effect; the absence of a JSON output mode is established from `--help` and
  is sufficient to disqualify it as the *primary* listing source.)

### Why NOT the SQLite stores (`grok.db`, `session_search.sqlite`)

Both are **derived and currently stale** relative to the on-disk tree:

| Source | Rows | Recency | Role |
|---|---|---|---|
| on-disk `summary.json` | **81** | live (latest matches newest session) | **authoritative** |
| `~/.grok/grok.db` → `sessions` | **6** (1 workspace) | `max(updated_at)` = **2026-05-07** | legacy/abandoned relational store — frozen for ~7 weeks |
| `~/.grok/sessions/session_search.sqlite` → `session_docs` | **51** | lags by 30 (FTS5 index, `last_indexed_offset`) | search index, not a complete list |

`grok.db` has a clean `STRICT` schema (`workspaces`, `sessions`, `messages`, `tool_calls`,
`tool_results`, `usage_events`, `compactions`) and *would* be the nicest source **if it were
maintained** — but at this pin it holds only 6 of 81 sessions and has not been written since May 7,
so it cannot back a live list. `session_search.sqlite` is an FTS5 index (`session_docs` +
`session_docs_fts`) that trails the tree (51/81) — good for **search**, not for an authoritative
**list**. Treat both as optional accelerators layered *on top of* the file-watch source, never as the
source of truth, and never without reconciling against the directory tree.

### Net gate decision

AC-P3.0 is **satisfied**: storage path/format and the headless + resume flags are documented and
pinned (table above) against grok `0.2.51`, and the file-watch strategy is now an evidence-backed
choice rather than an assumption. The downstream listing work item is **unblocked** to implement
file-watch listing of `~/.grok/sessions/<encodeURIComponent(cwd)>/<uuid>/summary.json`.

---

## Re-running when the pin changes

This result is bound to **grok `0.2.51` (`f4f85a6492e`)**. When the pin bumps, re-verify:

1. **Flags** — `grok --help`: do `-p/--single`, `--output-format`, `-r/--resume`, `-c/--continue`
   still exist with the same semantics? Did `grok sessions list` gain a `--output-format json`
   (if so, the CLI-command path becomes viable and the verdict should be revisited)?
2. **Layout** — is the per-session tree still
   `~/.grok/sessions/<encodeURIComponent(cwd)>/<uuid>/summary.json`? Re-check the cwd encoder for
   edge characters. Did `summary.json` keys change (esp. `generated_title`/`session_summary`,
   `info.id`, `created_at`/`updated_at`)?
3. **Authority** — re-run the counts (on-disk `summary.json` vs `grok.db.sessions` vs
   `session_search.session_docs`). If `grok.db` becomes complete and current, a DB-backed list may
   supersede file-watch; re-derive the verdict from the counts, not from this document.

---

## Appendix — raw evidence pointers (captured 2026-06-25, read-only)

- **Version:** `grok --version` → `grok 0.2.51 (f4f85a6492e) [stable]`; `~/.grok/version.json`
  (`"version": "0.2.51"`); `~/.grok/.metadata_version` (`0.2.51`).
- **Binary:** `~/.grok/bin/grok` → symlink `downloads/grok-0.2.51-macos-aarch64`,
  `file` → `Mach-O 64-bit executable arm64`.
- **Flags:** `grok --help`, `grok agent --help`, `grok sessions --help`,
  `grok sessions list --help`, `grok export --help` (no model invoked — help only).
- **Layout / counts:** `find ~/.grok/sessions -name summary.json | wc -l` → **81**;
  `find ~/.grok/sessions -mindepth 2 -maxdepth 2 -type d` UUID dirs → **81**.
- **`grok.db`:** `sqlite3 ~/.grok/grok.db` — `.schema` (STRICT tables: workspaces, sessions,
  messages, tool_calls, tool_results, usage_events, compactions); `SELECT count(*) FROM sessions`
  → **6**; `SELECT count(*) FROM workspaces` → **1**; `SELECT max(updated_at) FROM sessions`
  → **2026-05-07T06:31:26.844Z**.
- **`session_search.sqlite`:** `.schema` (`session_docs(session_id, cwd, updated_at, title,
  content, content_hash, last_indexed_offset)` + `session_docs_fts` FTS5);
  `SELECT count(*) FROM session_docs` → **51**.
- **`summary.json` / `signals.json` / `events.jsonl` / `chat_history.jsonl`:** sampled from
  `~/.grok/sessions/%2Fopt%2Fworktrees%2Fbrian-stoker%2Fmic-n-stand-recordings%2Fmic-n-stand-recordings-main/019e7fe3-ff18-7cc0-a3a7-8e0e4280fd9d/`
  (key lists + record-type histograms above).
- **cwd encoding:** `node -e "encodeURIComponent('/opt/worktrees/stokd-cloud/stokd-ide/project-prd-chat-panel-as-multi-provider-llm-cli')"`
  matched the observed workspace dir name byte-for-byte.
