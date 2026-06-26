# Phase 3: P1 — Gemini via ACP (proof of generalization; spike-gated)

**Project:** PRD: Chat Panel as Multi-Provider LLM CLI Surface
**Slug:** prd-chat-panel-as-multi-provider-llm-cli
**Review Mode:** complete

## Work Items

### 3.1: ACP live-vs-resume spike gate

**Dependencies:** 1.8

**Implementation Details**

Build a throwaway ACP handshake against a pinned gemini-cli and confirm whether a second prompt mid-turn injects vs queues. If it queues, Gemini drops to emulated steering and/or falls back to SDK/headless. Pin the version (--acp vs --experimental-acp).

**Acceptance Criteria**

- AC-P1.0 — Documented result of the live-vs-resume spike against a pinned version; the steering tier is set from this evidence, not assumed.

### 3.2: Implement Gemini ACP adapter, descriptor, history builder/tool formatter

**Dependencies:** 3.1

**Implementation Details**

Implement the ACP adapter plus descriptor, history builder/tool formatter, model catalog via BYOK geminiNativeProvider.ts, and permission modes. Fallbacks: @google/gemini-cli-sdk or headless --output-format stream-json. Any ACP code-gen follows AX-REPO-VENDORED-AHP-PROTOCOL (never hand-edited).

**Acceptance Criteria**

- AC-P1.1 — A gemini --acp session appears, is clickable, replays full history with thinking/tool parts, and streams a live turn incrementally. AC-P1.3 — model picker shows only Gemini models; permission picker shows Gemini-declared modes.

### 3.3: Verify Gemini steering per spike result

**Dependencies:** 3.1, 3.2

**Implementation Details**

If AC-P1.0 confirms injection, verify mid-flight steering against the pinned version; otherwise label and verify emulated steering.

**Acceptance Criteria**

- AC-P1.2 — If spike confirms injection: mid-flight steering verified; otherwise emulated steering labeled and verified.

### 3.4: Gemini normalized telemetry recorded-event test

**Dependencies:** 3.2

**Implementation Details**

Verify a Gemini turn emits the same normalized turn-lifecycle events as Claude.

**Acceptance Criteria**

- AC-P1.4 — A Gemini turn emits the same normalized turn-lifecycle events as Claude, verified by a recorded-event test.

