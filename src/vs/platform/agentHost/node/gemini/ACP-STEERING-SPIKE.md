# Gemini ACP live-vs-resume steering spike — RESULT

> **Project:** chat-panel-as-multi-provider-llm-cli — **Work item 3.1** (ACP live-vs-resume spike gate)
> **Acceptance criterion AC-P1.0:** *Documented result of the live-vs-resume spike against a
> pinned version; the steering tier is set from this evidence, not assumed.*
> **Date:** 2026-06-25 · **Status:** COMPLETE — evidence below; gate decision recorded as
> [`DESIGN-DECISIONS.md` DN-4](../../DESIGN-DECISIONS.md).

This is the throwaway spike's documented outcome. It answers exactly one question:

> When a **second `session/prompt` is sent mid-turn** (while the first prompt's turn is still
> streaming), does the pinned gemini-cli ACP agent **inject** it into the running turn (true live
> steering) or **queue** it until the first turn ends (resume-style)?

**Answer:** it does **neither**. It **aborts the in-flight turn and replaces it** with the new
prompt (cancel-and-replace). See [Verdict](#verdict).

---

## Pinned target

| Field | Value | Source |
|---|---|---|
| CLI | `@google/gemini-cli` | `bundle/gemini.js` |
| **Version (pin)** | **`0.47.0`** | `package.json` `version`; ACP `agentInfo.version` from a live handshake |
| **ACP flag (pin)** | **`--acp`** | `gemini --help`: *"Starts the agent in ACP mode"* |
| ACP flag (deprecated alias) | `--experimental-acp` | `gemini --help`: *"deprecated, use --acp instead"*. Verified still live on 0.47.0 — it also enters ACP mode and completes the same `initialize` handshake. Retained only for pins older than the `--acp` rename. |
| ACP wire | newline-delimited JSON-RPC 2.0 over stdio | `agent-client-protocol` `ndJsonStream` / `AgentSideConnection` |
| **ACP protocol version** | **`1`** | `initialize` result (live) |

---

## Method

Two complementary lines of evidence, because the live model turn could not be completed in this
environment (the available OAuth-personal credential is server-side deprecated on 0.47.0 — see
[Auth caveat](#auth-caveat-orthogonal-but-gating-for-the-live-path)):

1. **Black-box (live):** a throwaway ACP client ([harness below](#appendix-a--throwaway-harness))
   spawned `gemini --acp`, completed the `initialize` handshake, captured advertised capabilities
   and auth methods, and attempted `session/new`.
2. **White-box (authoritative):** read the **pinned 0.47.0 bundle's** ACP agent implementation to
   determine deterministically how a concurrent `session/prompt` is dispatched and handled. Source
   reading of the exact installed binary is stronger than a single black-box observation: it shows
   the mechanism for *all* inputs, not one run.

> **Honesty note (per SC verification policy):** the inject-vs-queue determination is **white-box
> verified** against the pinned bundle; it is **not** a completed live black-box turn, because
> `session/prompt` was unreachable under the only available credential (auth block below). The
> `initialize` handshake, advertised capabilities, auth-method list, and the `session/new` auth
> rejection **are** real live observations.

---

## Evidence

### E1 — Live `initialize` handshake (black-box, real)

```json
{
  "flag": "--acp",
  "agentInfo": { "name": "gemini-cli", "title": "Gemini CLI", "version": "0.47.0" },
  "protocolVersion": 1,
  "agentCapabilities": {
    "loadSession": true,
    "promptCapabilities": { "image": true, "audio": true, "embeddedContext": true },
    "mcpCapabilities": { "http": true, "sse": true }
  },
  "authMethodIds": ["oauth-personal", "gemini-api-key", "vertex-ai", "gateway"]
}
```

The agent advertises **no** steering / concurrent-prompt / mid-turn-injection capability. ACP models
`session/prompt` as a single request → single turn → single `stopReason`; there is no protocol-level
"inject into the running turn" primitive.

### E2 — `session/new` is server-side rejected on the available credential (black-box, real)

```json
{ "code": -32000,
  "message": "This client is no longer supported for Gemini Code Assist for individuals. To continue using Gemini, please migrate to the Antigravity suite of products: https://antigravity.google" }
```

So a *completed live turn* via **OAuth-personal** is not reachable on 0.47.0; the live ACP path
requires `gemini-api-key`, `vertex-ai`, or `gateway` auth.

### E3 — Concurrent dispatch (white-box, pinned bundle)

The ACP receive loop dispatches each incoming request **without awaiting** the previous handler, so a
second `session/prompt` is processed while the first turn's promise is still pending:

```js
// bundle/gemini-PDNY7O5B.js  (AgentSideConnection from agent-client-protocol)
async #receive() {
  ...
  while (true) {
    const { value: message, done } = await reader.read();
    ...
    this.#processMessage(message);   // line 12468 — NOT awaited → concurrent dispatch
  }
}
```

### E4 — A new prompt aborts the in-flight turn (white-box, pinned bundle)

```js
// bundle/gemini-PDNY7O5B.js
async prompt(params) {            // line 13952 (session-level handler)
  this.pendingPrompt?.abort();    // line 13953 — cancels the in-flight turn
  const pendingSend = new AbortController();
  this.pendingPrompt = pendingSend;
  ...
}
async cancelPendingPrompt() {     // line 13858 — session/cancel maps here, same abort
  if (!this.pendingPrompt) { throw new Error("Not currently generating"); }
  this.pendingPrompt.abort();
  this.pendingPrompt = null;
}
```

The `GeminiAgent.prompt` ACP entry point (line 15368) simply forwards to `session.prompt(params)`
(line 15376), so every `session/prompt` runs the abort-first path above.

### E5 — The aborted turn resolves with `stopReason: "cancelled"` (white-box, pinned bundle)

```js
// bundle/gemini-PDNY7O5B.js — inside the in-flight turn loop
if (pendingSend.signal.aborted) { return { stopReason: "cancelled" }; }   // line 14015
...
for await (const event of responseStream) {
  if (pendingSend.signal.aborted) { return { stopReason: "cancelled" }; } // line 14030
  ...
}
```

So prompt #1's `session/prompt` request **resolves with `stopReason: "cancelled"`** the moment
prompt #2 aborts it; prompt #2 then runs as a fresh turn from the (now-truncated) session history.

---

## Verdict

**A second `session/prompt` sent mid-turn → ABORT-AND-REPLACE.**

| Possibility (work item's framing) | Observed? | Why |
|---|---|---|
| **Inject** (turn continues, augmented mid-flight — true live steering) | **NO** | the prior turn is *terminated* (`stopReason: cancelled`), not augmented/continued |
| **Queue** (prior turn runs to completion, then the new prompt) | **NO** | the prior turn does **not** complete; it is aborted on the next signal check |
| **Reject** (busy error) | **NO** | `prompt()` uses `this.pendingPrompt?.abort()` (optional chaining) — the second prompt is accepted, not refused |
| **Abort-and-replace** (cancel in-flight, start the new prompt now) | **YES** | E3 + E4 + E5 |

This third behavior is the same primitive Claude's steering is built on (abort the in-flight turn,
proceed with the steering message) — but in ACP it surfaces as **two distinct turns**: turn #1 ends
with `stopReason: "cancelled"`, turn #2 is its own `session/prompt` request. There is no single
continuous query that dequeues the steering message next (contrast Claude's `priority: 'now'`
`SDKUserMessage` inside one `query()` iterable — see [DN-2](../../DESIGN-DECISIONS.md)).

---

## Steering tier — set from this evidence (not assumed)

**Tier 2 — EMULATED STEERING, realized via ACP abort-and-replace.**

- **Not Tier 1 (native live injection).** ACP exposes no inject-into-running-turn primitive, and the
  agent does not augment-and-continue; it cancels. The adapter, not the protocol, must orchestrate
  steering and reconcile the `cancelled` stop reason of the pre-empted turn.
- **Is Tier 2 (emulated).** The abstraction implements `IAgent.setPendingMessages()` for Gemini by
  issuing a fresh `session/prompt` (which aborts the running turn) — equivalently `session/cancel`
  then `session/prompt`. Crucially this is **low-latency**: because the protocol cancels the
  in-flight turn natively (E4/E5), the adapter does **not** have to wait for a turn to drain, so this
  is materially better than a protocol that truly queues. The work item's "if it queues → emulated
  steering" branch applies, but the emulation primitive is cheap and reliable here.
- **Tier 3 (SDK/headless fallback) is *not* mandated on steering grounds.** It is, however, required
  on **auth** grounds for OAuth-personal-only environments — see the caveat below.

### Implication for the Gemini provider descriptor (downstream work — not done here)

`IAgentCliProviderDescriptor.capabilities.steering`
(`extensions/copilot/src/extension/chatSessions/common/agentCliProvider.ts`):

- The Gemini adapter **can** present `setPendingMessages`, so `steering: true` is defensible — **but
  it must be documented/treated as emulated** (cancel-and-replace), not Claude-grade native
  injection. Downstream UI/behavior must not assume the pre-empted turn "continues"; it ends
  `cancelled` and the adapter reconciles. If the abstraction's steering contract is defined as
  *native injection only*, then `steering: false` + emulated-steering shim is the correct encoding.
  Either way, **the tier is Tier 2**; this spike fixes the tier, the descriptor work item fixes the
  boolean's exact semantics.

---

## Auth caveat (orthogonal, but gating for the live path)

The pinned 0.47.0 **rejects `session/new` under OAuth-personal** ("Gemini Code Assist for
individuals … migrate to Antigravity"; E2). This is independent of steering, but it gates whether the
**live ACP transport** is usable at all:

- Live ACP path requires `gemini-api-key`, `vertex-ai`, or `gateway` auth.
- For environments with **only** OAuth-personal credentials, the live ACP path cannot open a
  session → Gemini must **fall back to SDK/headless** (Tier 3) regardless of the steering finding,
  or the user must supply a key/Vertex/gateway credential.

This belongs in the Gemini auth/enablement design as a hard gate, recorded here so the downstream
provider work does not assume OAuth-personal works on this pin.

---

## Re-running when the pin changes

This result is bound to **gemini-cli 0.47.0**. When the pin bumps:

1. Re-run the [harness](#appendix-a--throwaway-harness): `node acp-steering-spike.mjs --flag=--acp`.
2. Re-check E3 (receive loop awaits `#processMessage`?) and E4 (`prompt()` abort-first?) in the new
   bundle. If the bundle no longer aborts-first, or the receive loop becomes serial, the verdict and
   tier must be re-derived.
3. Re-check E2 — if a usable auth method changes, the Tier-3 auth gate may relax.

---

## Appendix A — throwaway harness

Disposable. Not product code, not wired into any build. ACP transport = ndjson JSON-RPC 2.0 over
stdio. Sends prompt #1 (long, attributable), then a second `session/prompt` mid-stream, and records
the timeline + classifies inject / queue / reject / abort-and-replace. (In this environment it stops
at the E2 auth block before a turn streams; the harness is retained for re-runs against a
key/Vertex-authenticated pin, where it will exercise the full live path.)

```js
#!/usr/bin/env node
// THROWAWAY ACP live-vs-resume steering spike (work item 3.1, AC-P1.0).
// Spawns a PINNED gemini-cli in ACP mode and tests whether a SECOND session/prompt
// sent mid-turn INJECTS into the running turn or QUEUES until it ends.
// Usage: node acp-steering-spike.mjs [--flag=--acp|--experimental-acp]
import { spawn } from 'node:child_process';
import process from 'node:process';

const GEMINI_BIN = process.env.GEMINI_BIN || 'gemini';
const ACP_FLAG = (process.argv.find(a => a.startsWith('--flag=')) || '--flag=--acp').split('=')[1];
const CWD = process.cwd();
const T0 = Date.now();
const ts = () => `+${String(Date.now() - T0).padStart(6, ' ')}ms`;
const transcript = [];
const rec = (dir, payload, note) => transcript.push({ t: Date.now() - T0, dir, note, payload });
const log = (...a) => console.error(ts(), ...a);

log(`spawning: ${GEMINI_BIN} ${ACP_FLAG}`);
const child = spawn(GEMINI_BIN, [ACP_FLAG], { cwd: CWD, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } });
let stderrBuf = '';
child.stderr.on('data', d => { stderrBuf += d.toString(); });
child.on('exit', (c, s) => log(`child exit code=${c} sig=${s}`));

let nextId = 1;
const pending = new Map();
const updates = [];
const updateWaiters = [];
const send = obj => { rec('-> agent', obj); child.stdin.write(JSON.stringify(obj) + '\n'); };
const request = (method, params) => {
  const id = nextId++; const sentAt = Date.now() - T0;
  send({ jsonrpc: '2.0', id, method, params });
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject, method, sentAt }));
};
const respondOk = (id, result) => send({ jsonrpc: '2.0', id, result });
const respondErr = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

let rxBuf = '';
child.stdout.on('data', chunk => {
  rxBuf += chunk.toString();
  let nl;
  while ((nl = rxBuf.indexOf('\n')) >= 0) {
    const line = rxBuf.slice(0, nl).trim(); rxBuf = rxBuf.slice(nl + 1);
    if (!line) { continue; }
    let msg; try { msg = JSON.parse(line); } catch { rec('<- RAW', line); continue; }
    handle(msg);
  }
});
function handle(msg) {
  rec('<- agent', msg);
  if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
    const p = pending.get(msg.id);
    if (p) { pending.delete(msg.id); const dt = (Date.now() - T0) - p.sentAt;
      if (msg.error) { log(`RESPONSE id=${msg.id} (${p.method}) ERROR after ${dt}ms:`, JSON.stringify(msg.error)); p.reject(msg.error); }
      else { log(`RESPONSE id=${msg.id} (${p.method}) OK after ${dt}ms:`, JSON.stringify(msg.result).slice(0, 200)); p.resolve(msg.result); } }
    return;
  }
  if (msg.method && msg.id !== undefined) { // agent->client request: deny so nothing executes
    if (msg.method === 'session/request_permission') { respondOk(msg.id, { outcome: { outcome: 'cancelled' } }); }
    else { respondErr(msg.id, -32601, `method ${msg.method} not handled by spike client`); }
    return;
  }
  if (msg.method === 'session/update') {
    const u = msg.params?.update; const text = u?.content?.text ?? (typeof u?.content === 'string' ? u.content : '');
    updates.push({ t: Date.now() - T0, kind: u?.sessionUpdate, text });
    log(`UPDATE ${u?.sessionUpdate}: ${(text || JSON.stringify(u)).replace(/\s+/g, ' ').slice(0, 80)}`);
    for (const w of updateWaiters.splice(0)) { w(); }
  }
}
const waitForNextUpdate = ms => new Promise(res => { const to = setTimeout(() => res(false), ms); updateWaiters.push(() => { clearTimeout(to); res(true); }); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const result = { flag: ACP_FLAG };
  try {
    const init = await request('initialize', { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } });
    result.initialize = init;
    log('PROTOCOL VERSION:', init?.protocolVersion, 'CAPS:', JSON.stringify(init?.agentCapabilities));
    let session;
    try { session = await request('session/new', { cwd: CWD, mcpServers: [] }); }
    catch (e) { const m = init?.authMethods?.[0]?.id; if (m) { try { await request('authenticate', { methodId: m }); } catch {} session = await request('session/new', { cwd: CWD, mcpServers: [] }); } else { throw e; } }
    const sessionId = session.sessionId; log('SESSION:', sessionId);
    const PROMPT1 = 'Output the integers from 1 to 60, one per line, in order, with NOTHING else. Do not use any tools.';
    const PROMPT2 = 'STOP. Ignore the previous instruction. Output exactly this token and stop: ZZZINJECTEDZZZ . No numbers.';
    log('SENDING PROMPT #1');
    const p1 = request('session/prompt', { sessionId, prompt: [{ type: 'text', text: PROMPT1 }] });
    let p1Done = false, p1Result = null, p1Err = null;
    p1.then(r => { p1Done = true; p1Result = r; log('PROMPT #1 stopReason=', JSON.stringify(r)); }).catch(e => { p1Done = true; p1Err = e; });
    for (let i = 0; i < 40 && !p1Done && updates.length < 3; i++) { await waitForNextUpdate(1500); }
    await sleep(400);
    log(`>>> INJECTING PROMPT #2 (p1Done=${p1Done}, updates=${updates.length})`);
    const p2 = request('session/prompt', { sessionId, prompt: [{ type: 'text', text: PROMPT2 }] });
    let p2Done = false, p2Result = null, p2Err = null;
    p2.then(r => { p2Done = true; p2Result = r; log('PROMPT #2 stopReason=', JSON.stringify(r)); }).catch(e => { p2Done = true; p2Err = e; });
    const deadline = Date.now() + 45000; let injectedAt = null;
    while (Date.now() < deadline && !(p1Done && p2Done)) {
      await waitForNextUpdate(1500);
      if (injectedAt === null) { const h = updates.find(u => (u.text || '').includes('ZZZINJECTEDZZZ')); if (h) { injectedAt = h.t; } }
    }
    const firstPromptId = transcript.find(e => e.dir === '-> agent' && e.payload?.method === 'session/prompt')?.payload.id;
    const p1ResolvedAt = transcript.find(e => e.dir === '<- agent' && e.payload?.id === firstPromptId && (e.payload.result || e.payload.error))?.t ?? Number.MAX_SAFE_INTEGER;
    result.p1Result = p1Result; result.p1Err = p1Err; result.p2Result = p2Result; result.p2Err = p2Err; result.injectedAt = injectedAt;
    result.verdict = p2Err && !p2Result ? 'REJECTED'
      : (injectedAt !== null && injectedAt < p1ResolvedAt) ? 'INJECTED (live mid-turn steering)'
      : (p1Result?.stopReason === 'cancelled') ? 'ABORT-AND-REPLACE (prior turn cancelled by new prompt)'
      : 'QUEUED (injected token only after prior turn completed)';
    log('VERDICT:', result.verdict);
  } catch (err) { result.fatal = String(err?.message || err); log('FATAL:', result.fatal); }
  finally {
    result.transcript = transcript; result.updates = updates; result.stderrTail = stderrBuf.slice(-1500);
    process.stdout.write('\n===RESULT_JSON_BEGIN===\n' + JSON.stringify(result, null, 2) + '\n===RESULT_JSON_END===\n');
    try { child.stdin.end(); } catch {}
    setTimeout(() => { try { child.kill('SIGKILL'); } catch {} process.exit(0); }, 800);
  }
})();
```

## Appendix B — raw evidence pointers

- Live handshake captured 2026-06-25 against `gemini --acp` and `gemini --experimental-acp`
  (identical `initialize` result; both blocked at `session/new` under OAuth-personal).
- White-box citations are against the installed pin
  `@google/gemini-cli@0.47.0` → `bundle/gemini-PDNY7O5B.js` (three near-identical entry chunks
  `gemini-PDNY7O5B.js` / `gemini-VTIJURKH.js` / `gemini-FOEJAXHE.js` share the same ACP agent
  code): receive loop **12468**, session `prompt()` **13952–13955**, `cancelPendingPrompt()`
  **13858–13864**, aborted-turn `stopReason: "cancelled"` **14015 / 14030**, ACP `GeminiAgent.prompt`
  **15368–15377**, transport wiring `runAcpClient` **15400–15411**.
