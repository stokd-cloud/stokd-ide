# Phase 4: P3 — Grok (spawn-per-turn, emulated steering; discovery-gated)

**Project:** PRD: Chat Panel as Multi-Provider LLM CLI Surface
**Slug:** prd-chat-panel-as-multi-provider-llm-cli
**Review Mode:** complete

## Work Items

### 4.1: Grok discovery gate

**Dependencies:** 1.8

**Implementation Details**

Determine Grok on-disk session path/format, headless output flag, and resume flag against a pinned grok-cli before committing to file-watch listing.

**Acceptance Criteria**

- AC-P3.0 — Storage path/format + flags documented and pinned before committing to file-watch listing.

### 4.2: Implement Grok spawn-per-turn adapter with file-watch listing

**Dependencies:** 4.1

**Implementation Details**

Implement the spawn-per-turn adapter plus correlated file-watch listing and descriptor; deliver list + click-to-resume + streaming. Steering emulated (abort+resume). Benefits from P1's normalizer. Use args arrays, never shell:true.

**Acceptance Criteria**

- AC-P3.1 — Grok sessions appear and replay/stream. AC-P3.2 — Resume via -s <id> works from a click. AC-P3.3 — Emulated steering labeled best-effort and verifiably aborts+resumes.

### 4.3: Implement Grok shell-security mitigation (DN-4)

**Dependencies:** 4.2

**Implementation Details**

Grok's shell runs outside the existing sandbox/approver. Ship default-deny auto-approve with explicit per-command confirmation (use a CLI permission-hook flag where one exists). Terminal-first is explicitly not used (DN-1).

**Acceptance Criteria**

- AC-P3.4 — Grok's shell runs outside the existing sandbox/approver; auto-approve is default-deny with explicit per-command confirmation.

