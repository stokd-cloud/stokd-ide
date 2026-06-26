# Phase 5: P5 — AWS Bedrock model access (BYOK; chat-first; parallelizable after P0)

**Project:** PRD: Chat Panel as Multi-Provider LLM CLI Surface
**Slug:** prd-chat-panel-as-multi-provider-llm-cli
**Review Mode:** complete

## Work Items

### 5.1: Ship Bedrock BYOK LanguageModelChatProvider

**Dependencies:** 1.6

**Implementation Details**

Ship a Bedrock BYOK LanguageModelChatProvider over the AWS Bedrock Runtime SDK, registered like geminiNativeProvider.ts / xAIProvider.ts and scoped via targetChatSessionType, so Bedrock-hosted models are selectable in the same chat surface. No new editor-proxy adapter; no terminal path. Discover the catalog at runtime and surface only enabled models.

**Acceptance Criteria**

- AC-P5.1 — Bedrock models appear in the model picker and complete a streaming turn rendered through the unchanged ChatWidget. AC-P5.4 — Bedrock sessions are chat-first: no terminal launch path is introduced.

### 5.2: Keep Bedrock inference within the AWS perimeter

**Dependencies:** 5.1

**Implementation Details**

Route model calls to the Bedrock endpoint via the AWS SDK so data/inference does not leave the AWS perimeter; verify with a network-assertion/unit test against a mocked Bedrock client.

**Acceptance Criteria**

- AC-P5.2 — Model calls go to the Bedrock endpoint via the AWS SDK and do not leave the AWS perimeter, verified by a network-assertion/unit test against a mocked Bedrock client.

### 5.3: Resolve AWS auth via standard credential chain with degraded states

**Dependencies:** 5.1

**Implementation Details**

Resolve AWS auth via the standard credential chain (profile / region / SSO). Surface a missing/invalid credential as an actionable degraded state rather than a silent failure.

**Acceptance Criteria**

- AC-P5.3 — AWS auth resolves via the standard credential chain; a missing/invalid credential surfaces an actionable degraded state (R7.1.5), not a silent failure.

