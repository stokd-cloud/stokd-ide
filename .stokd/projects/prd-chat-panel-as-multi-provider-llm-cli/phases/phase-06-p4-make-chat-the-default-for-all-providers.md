# Phase 6: P4 — Make chat the default for ALL providers; terminal becomes opt-in escape hatch

**Project:** PRD: Chat Panel as Multi-Provider LLM CLI Surface
**Slug:** prd-chat-panel-as-multi-provider-llm-cli
**Review Mode:** complete

## Work Items

### 6.1: Make chat the default launch surface for all providers

**Dependencies:** 3.2, 4.2

**Implementation Details**

Make the chat-session surface the default for all provider launches (Claude, Copilot, Codex, Gemini, Grok, and Bedrock-backed sessions) behind a revertible setting. Depends on ≥2 new providers proven (P1–P3); P5 (Bedrock) is independent.

**Acceptance Criteria**

- AC-P4.1 — Default launch for every provider (incl. Grok and Bedrock-backed sessions) opens an Agents Window chat session, not a terminal tab; behind a revertible setting (no rebuild rollback).

### 6.2: Demote terminal agentTabs to opt-in escape hatch, preserve reverse channel

**Dependencies:** 6.1

**Implementation Details**

Demote agentTerminalTabbedView.ts to an explicit, opt-in 'Open in terminal' escape hatch, never a default for any provider. Preserve the IDE↔CLI MCP reverse channel so the terminal CLI still reaches editor tools.

**Acceptance Criteria**

- AC-P4.2 — 'Open in terminal' still works and the terminal CLI still reaches editor tools via the reverse-channel lock file. AC-P4.3 — existing agentTabs tests pass for the contractually frozen escape-hatch behaviors (launch, reverse-channel, highlight bridge); behaviors allowed to deprecate are listed.

### 6.3: Decide and document terminal.integrated.agentTabs.enabled deprecation mechanics

**Dependencies:** 6.1

**Implementation Details**

Decide and document whether terminal.integrated.agentTabs.enabled is retained / repurposed / removed; define the deprecation timeline, user-facing messaging, and migration of in-flight terminal sessions.

**Acceptance Criteria**

- AC-P4.4 — Deprecation flag decision is implemented and documented; in-flight terminal sessions migrate or are explicitly out-of-scope with a stated reason.

