# Phase 2: P2 — Codex (validate the registry on in-tree code)

**Project:** PRD: Chat Panel as Multi-Provider LLM CLI Surface
**Slug:** prd-chat-panel-as-multi-provider-llm-cli
**Review Mode:** complete

## Work Items

### 2.1: Resolve Codex model sourcing (DN-3 gate)

**Dependencies:** 1.8

**Implementation Details**

Resolve Codex model sourcing as a gate per DN-3: reuse existing BYOK LanguageModelChatProviders scoped via targetChatSessionType, with no new editor-proxy adapters.

**Acceptance Criteria**

- Codex model sourcing decision documented (BYOK reuse) before adapter work proceeds.

### 2.2: Bring codexAgent onto the P0 registry/descriptor

**Dependencies:** 1.8, 2.1

**Implementation Details**

Register codexAgent.ts via the P0 registry/descriptor; wire list/click/resume/steer/abort through the registry (createSession→thread/start, steer→turn/steer, abort→turn/interrupt, resume→thread/resume). Protocol regeneration via npm run codex:gen-protocol; generated types never hand-edited.

**Acceptance Criteria**

- AC-P2.1 — Codex list/click/resume/steer/abort all work via the registry.

### 2.3: Wire Codex history builder/tool formatter into normalized vocabulary

**Dependencies:** 2.2

**Implementation Details**

Wire Codex history builder and tool formatter into the shared normalized event vocabulary so Codex renders structured tool/thinking/text parts.

**Acceptance Criteria**

- AC-P2.2 — Codex renders structured tool/thinking/text parts through the shared normalizer.

### 2.4: Reconcile Codex across all agentSessions.ts switches

**Dependencies:** 2.2

**Implementation Details**

Reconcile the half-wired Codex across name/icon/family/first-party/continue-in switches so it appears consistently.

**Acceptance Criteria**

- AC-P2.3 — Codex appears consistently across name/icon/family/first-party/continue-in (the half-wiring is reconciled).

### 2.5: Codex pinned-version contract test

**Dependencies:** 2.2

**Implementation Details**

Add a pinned-version smoke test asserting Codex exec --json event schema and ~/.codex/sessions format; CI fails on drift.

**Acceptance Criteria**

- AC-P2.4 — pinned-version smoke test asserts exec --json event schema + ~/.codex/sessions format; CI fails on drift.

