<!-- stokd-meta: extensions/SC_MODULE.md | metaVersion 0.6.0 | generated: UPGRADE (from 0.5.0) -->
# SC_MODULE.md — `extensions`

> Module classification document. Upgraded 0.5.0 → 0.6.0 (accurate 0.5.0 content preserved; the multi-provider LLM CLI work — PRs #4/#5, Grok/Gemini providers, the `chatSessions/common` provider-registry seam, the four copilot-owned SQLite databases, and the chat-default launch surface — is folded into the copilot sections, Views, Integration, Key source files, and Change impact).

## Module name & location

- **Module**: `extensions` (workspace identity `vscode-extensions`, `extensions/package.json`)
- **Package location**: `extensions/` (repo root `/opt/worktrees/stokd-cloud/stokd-ide/main`)
- **Type**: Multi-package folder — **95** top-level subdirectories carry a `package.json` (built-in VS Code extensions, language-feature client/server pairs, test fixtures); counting the nested `client/`/`server/` manifests of the language-feature extensions there are **116** manifests in total, plus shared build/types infra files. It is **not** a single npm package.
- **Product**: `SC_PRODUCT_CODE_OSS_DEV.md` (code-oss-dev — packages: `cli`, `extensions`, `remote`, `scripts`, `test`)

The root `extensions/package.json` (`vscode-extensions`, v0.0.1) is described as "Dependencies shared by all extensions": it declares only the shared `typescript` (`^6.0.3`) runtime dep, build devDeps (`esbuild` `0.27.2`, `@parcel/watcher`, `vscode-grammar-updater`), a `node-gyp-build` override (`4.8.1`), and a single `postinstall` hook (`node ./postinstall.mjs`). It is **not an aggregator** — every extension subdirectory has its own `package.json` (`AX-MOD-EXT-005`).

This module is the home of VS Code's **built-in extensions**. The overwhelming majority are **inherited upstream** from `microsoft/vscode` and are treated as read-only under thin-patch fork discipline (`SC_OVERVIEW.md`, `SC_TEST.md` §0, `AX-REPO-THIN-PATCH-FORK`). The single **fork-owned** extension is **`copilot`** (`copilot-chat`, GitHub Copilot Chat) — the first-party AI chat/agent extension that powers the Agents Window chat content. As of 0.6.0 it hosts a **multi-provider LLM CLI chat surface**: session providers for `claude`, `copilotcli`, `gemini`, and `grok` wired through a shared, fork-owned provider-registry seam (`chatSessions/common/agentCliProvider*.ts`), with the Agents Window **chat** the default launch surface for every provider. It is built and tested independently of the gulp pipeline (`AX-MOD-EXT-001`/`002`).

---

## Responsibility

VS Code intentionally implements large amounts of editor functionality as extensions running in the **extension host** (`src/vs/workbench/api/`), against the public `vscode` API, rather than baking it into the core workbench. This folder is where that functionality lives. Categories present:

| Category | Examples | What it does |
|---|---|---|
| **Language features** (rich, runtime) | `typescript-language-features`, `html-language-features`, `css-language-features`, `json-language-features`, `markdown-language-features`, `php-language-features` | Client (and server) extensions wiring language servers / the TS server into the editor — completions, diagnostics, formatting. The `*-language-features` for html/css/json use a `client/` + `server/` layout (not `src/`). |
| **Grammars / basics** (declarative) | `*-basics` (`markdown-basics`, `typescript-basics`, `prompt-basics`), per-language dirs (`go`, `rust`, `python`, `java`, `cpp`, `csharp`, `swift`, `ruby`, …) | TextMate grammars, language config, snippets — JSON / `.tmLanguage`, no runtime code |
| **Themes** | `theme-*` (`theme-defaults`, `theme-monokai`, `theme-seti`, `theme-abyss`, …) | Color / icon theme contributions only |
| **Tooling / providers** (runtime) | `git`, `git-base`, `github`, `github-authentication`, `microsoft-authentication`, `debug-auto-launch`, `debug-server-ready`, `emmet`, `npm`, `grunt`, `gulp`, `jake`, `merge-conflict`, `references-view`, `search-result`, `terminal-suggest`, `simple-browser`, `media-preview`, `mermaid-markdown-features`, `ipynb`, `notebook-renderers`, `tunnel-forwarding`, `configuration-editing`, `extension-editing` | Extensions with real `src/` runtime code contributing commands, providers, views |
| **Fork-owned (first-party)** | **`copilot`** (`copilot-chat`) | Multi-provider AI chat / agent features powering the stokd agentic experience (Claude, Copilot CLI, Gemini, Grok) |
| **Test fixtures** | `vscode-api-tests`, `vscode-colorize-tests`, `vscode-colorize-perf-tests`, `vscode-test-resolver` | Integration tests against a real extension host (run via `vscode-test`) |
| **Shared build / types infra** | `esbuild-common.mts`, `esbuild-extension-common.mts`, `esbuild-webview-common.mts`, `postinstall.mjs`, `tsconfig.base.json`, `cgmanifest.json`, `types/` | Shared esbuild runner, TS-install pruning, base tsconfig, component-governance manifest, ambient type shims |

Extensions that ship runtime code (carry a `src/`): `configuration-editing`, `copilot`, `debug-auto-launch`, `debug-server-ready`, `emmet`, `extension-editing`, `git-base`, `git`, `github-authentication`, `github`, `grunt`, `gulp`, `ipynb`, `markdown-language-features`, `markdown-math`, `media-preview`, `merge-conflict`, `mermaid-markdown-features`, `microsoft-authentication`, `notebook-renderers`, `npm`, `php-language-features`, `references-view`, `search-result`, `simple-browser`, `terminal-suggest`, `tunnel-forwarding`, `typescript-language-features`, and the four `vscode-*-test*` fixtures. The remainder are declarative (grammars/themes/snippets).

---

## Public interfaces / entry points

There is no single module-level export — each extension's contract is its own **`package.json`**. The "public interface" is the union of those manifests.

### Per-extension manifest contract (`extensions/*/package.json`)
- **`main`** — JS entry compiled from `src/` (or `client/`/`server/`). Only runtime extensions declare it (e.g. copilot `./dist/extension`, terminal-suggest `./out/terminalSuggestMain`).
- **`contributes`** — commands, menus, views, languages, grammars, themes, configuration, debuggers. The user-visible surface.
- **`activationEvents`** — when the extension host loads the extension (e.g. `git` uses `*`, `onFileSystem:git`, `onEditSession:file`).
- **`enabledApiProposals`** — proposed (unstable) `vscode` API surfaces the extension opts into. Each name **must** resolve to a proposal `.d.ts` shipped by core (`src/vscode-dts/`) or activation fails — a contract with `src/vs/workbench/api/` (`AX-MOD-EXT-003`).
- **`extensionDependencies`** — load-order contract (e.g. `git` → `["vscode.git-base"]`).

### Shared build infra (entry points)
- `esbuild-common.mts` — `runBuild(config: RunConfig, baseOptions, args, didBuild?)`: the shared esbuild build/watch runner all per-extension `esbuild.mts` scripts call. `--watch` uses `@parcel/watcher` (lower idle CPU than esbuild's own watch) with a 100 ms debounce; `--outputRoot <dir>` redirects output (`outdir = join(outputRoot, basename(outdir))`).
- `esbuild-extension-common.mts`, `esbuild-webview-common.mts` — extension- and webview-specific base option sets layered on `runBuild`.
- `postinstall.mjs` — `processRoot()` prunes `node_modules/typescript` to `lib/` + `package.json`; `processLib()` deletes `tsc.js`/`typescriptServices.js` and most `.d.ts` but **deliberately keeps** `lib.d.ts` / `lib.*.d.ts` / `protocol.d.ts` and `typescript.js` / `typescript.d.ts` ("used by html and extension editing"). Over-pruning breaks `html-language-features` / `extension-editing`.
- `tsconfig.base.json` — base TS config inherited by extension tsconfigs (`target`/`lib` ES2024, `module` commonjs, `strict`, `experimentalDecorators`, `noUnusedLocals`/`noUnusedParameters`).

### Repo-level build / test entry points (root `package.json`)
- `transpile-extensions` → `npm run gulp transpile-extensions compile-extension-media`; `watch-extensions` → `npm run gulp watch-extensions watch-extension-media` (gulp drives the bulk of extensions via `build/lib/extensions.ts`).
- `compile-copilot` → `npm --prefix extensions/copilot run compile`; `watch-copilot` → `npm --prefix extensions/copilot run watch` — **copilot is built independently** of the gulp pipeline (`AX-MOD-EXT-002`).
- `test-extension` → `vscode-test` — integration tests (`vscode-api-tests`, colorize tests, the copilot extension-host suite) against a real extension host.
- `download-builtin-extensions` → `build/lib/builtInExtensions.ts`; marketplace built-ins are listed in `product.json` (`builtInExtensions`: `ms-vscode.js-debug-companion`, `ms-vscode.js-debug`, `ms-vscode.vscode-js-profile-table`) and downloaded, not stored in this folder. `product.json` also references `GitHub.copilot-chat` in its bundle/exclusion gates (the packaged GitHub Copilot Chat is excluded from packaged builds; the fork's `copilot-chat` ships from this folder).
- `update-grammars` → `build/npm/update-all-grammars.ts`.

### Fork-owned `copilot` extension (`copilot-chat`)
- Manifest: `name` `copilot-chat`, `displayName` "GitHub Copilot Chat", `version` 0.53.0, `main` `./dist/extension`, **63** `enabledApiProposals`, no `extensionDependencies`. `engines`: `vscode ^1.125.0`, `node >=22.14.0`, `npm >=9.0.0`. Overrides: `node-gyp` → `12.3.0` (bumped for VS 2026 support, commit `2136cbc`), `@aminya/node-gyp-build`→`node-gyp-build@4.8.1`, `string_decoder@1.2.0`, `zod@3.25.76`.
- Build/test scripts are its own: `compile` (`node .esbuild.mts --dev`), `watch` (esbuild + `tsgo --watch` typecheck), `test:extension` (`vscode-test`), `test:unit` (`vitest --run --pool=forks`), `simulate*` (AI prompt/quality simulation harness), `lint` (eslint, `--max-warnings=0`). Test naming is load-bearing (`SC_TEST.md` §1): **`*.spec.ts` → vitest** (`test:unit`, **398** files), while the **95** `.test.ts` files across copilot are split across harnesses — vscode-test extension-host (the `**/test/vscode-node/**` files bundled into `dist/test-extension.js`) plus completions-core mocha — so a new pure copilot test must be named `*.spec.ts` or vitest never sees it.
- Source layout `src/extension/`: `extension`, `lib`, `platform`, `shared-fetch-utils`, `util`, `vscodeTypes.ts`, plus `byok/` (bring-your-own-key providers, e.g. `byok/vscode-node/xAIProvider.ts` for xAI/Grok keys).

#### Multi-provider chat-session surface (`src/extension/chatSessions/`)
The fork's chat/agent value-add. Provider subtrees plus shared infrastructure, each layered `common/` (pure, vitest-testable) → `node/` (Node I/O) → `vscode-node/` (VS Code API):

| Provider dir | Layers present | Role |
|---|---|---|
| `claude/` | `common`, `node`, `vscode-node` | Claude Code session provider (see `claude/AGENTS.md`): session parser, slash commands, permission/question handlers, MCP-server contributors, hooks. |
| `copilotcli/` | `common`, `node`, `vscode-node` | Copilot CLI session provider (see `copilotcli/AGENTS.md`): SDK session wrapper, permission handlers, steering, worktree/checkpoint services. |
| `gemini/` | `common` only | Gemini provider (ACP — Agent Client Protocol based): `geminiProviderDescriptor`, `geminiModelCatalog`, `geminiAcpEvents`/`geminiAcpTypes`, `geminiPermissionModes`, `geminiSteering`. No node adapter yet. |
| `grok/` | `common`, `node` | **New (PR #5, `d88c67b`).** Grok provider — 8 pure `common/` modules (`grokProviderDescriptor`, `grokModelCatalog`, `grokSessionListing`, `grokShellSecurity`, `grokStreamTypes`, `grokStreamingEvents`, `grokSteering`, `grokPermissionModes`) backed by **8** vitest `common/test/*.spec.ts`, plus `node/grokAgentRegistration.ts` binding to the platform `IAgent` in `src/vs/platform/agentHost/node/grok/grokAgent.ts`. |
| `common/` | — | **Shared multi-provider seam.** `agentCliProvider.ts` (`IAgentCliProviderDescriptor`, `NormalizedEvent`, `IEventNormalizer`, `AgentCliProviderId` union, `providerEnabledSettingId(id)` → `chat.agentHost.${id}Agent.enabled`); `agentCliProviderRegistry.ts` (`AgentCliProviderRegistry` + `applyRegistryToAgentService()` — pure-data registration that replaces the hand-copied DI blocks per provider). Also the session services shared by all providers: `chatSessionMetadataStore`, `chatSessionWorktreeService`, `chatSessionWorktreeCheckpointService`, `chatSessionWorkspaceFolderService`, `folderRepositoryManager`, `agentSessionsWorkspace`, `builtinSlashCommands`, `sessionEventRenderer`, `externalEditTracker`, `skillConfigLocations`, `workspaceInfo`. |
| `vscode/`, `vscode-node/` | — | Cross-provider VS Code-side glue (content providers, chat-history builder, item controllers). |

**Provider-extension design contract** (from `agentCliProvider.ts` docs): ONE renderer consumes `NormalizedEvent`s; each provider ships exactly ONE `IEventNormalizer`; **the renderer is never modified when a new provider is added**. A new provider derives its enable-gate via `providerEnabledSettingId()` rather than a hand-written constant. The default launch surface is **chat** for every provider (`AX-MOD-EXT-007`).

#### Persistent data owned by `copilot` (see `.stokd/meta/extensions/SC_SCHEMA.puml`)
The fork-owned extension owns **four physically distinct SQLite databases** (created with `node:sqlite` `DatabaseSync`), with **no cross-database FKs** and no shared tables/connections with the core `src/` databases:
- **Chronicle session store** — `src/platform/chronicle/node/sessionStore.ts` (`sessions`/`turns`/`checkpoints`/`session_files`/`session_refs`, `schema_version`).
- **Copilot OTel spans sink** — `src/platform/otel/node/sqlite/otelSqliteStore.ts` (`spans`/`span_attributes`/`span_events`, `schema_version`; mirrors core agentHost OTel but independent).
- **Workspace chunk + embedding cache** — `src/platform/workspaceChunkSearch/node/workspaceChunkAndEmbeddingCache.ts` (`CacheMeta`/`Files`/`FileChunks`).
- **External ingest index** — `src/platform/workspaceChunkSearch/node/codeSearch/externalIngestIndex.ts` (`Metadata`/`Files`; `cacheVersion` gates reuse).

---

## Products

| Product doc | Relationship |
|---|---|
| `SC_PRODUCT_CODE_OSS_DEV.md` | The only product. This folder **is** the `extensions` package (alongside `cli`, `remote`, `scripts`, `test`). Every extension here belongs to that single product. The fork-owned `copilot` extension powers the Agents Window multi-provider chat content (flows S3–S5); the rest are inherited built-ins exercised by workbench flows W1–W4 and re-verified, not re-documented. |

---

## Views

This module owns **no workbench part** — views are owned by `src/vs/workbench/` and `src/vs/sessions/`; extensions populate them via the `vscode` API. From `SC_VIEWS.md` (now at 0.6.0), the **fork-distinguishing** views materially shaped by this module are the Copilot Chat extension dialogs (Surface family C, `extensions/copilot/`) plus the multi-provider content that feeds the Agents Window pickers:

| View | Title | How this module shapes it | Flows |
|---|---|---|---|
| **V4** | Sessions List (Sidebar) | Provider **descriptors / icons** (`*ProviderDescriptor.ts` per provider; consumed by core `agentSessionProviderCodicons.ts`) drive the per-session provider icon for Claude/Copilot/Gemini/Grok. | S5–S7 |
| **V6** | New Chat / New Session | Provider-agnostic **type/model pickers** — provider descriptors + `*ModelCatalog.ts` (e.g. `grokModelCatalog`, `geminiModelCatalog`) and `*PermissionModes.ts` supply the available providers, models, and permission modes the picker renders. | S3, S4 |
| **V18** | Agent Terminal Selector | Demoted to opt-in: providers now default to **chat** (`chat.agentSessions.defaultSurface = 'chat'`). The extension's provider descriptors feed both surfaces; the terminal remains the escape hatch. | T1 |
| **V21** | Copilot Slash-Command Dialogs | `extensions/copilot/src/extension/chatSessions/claude/vscode-node/slashCommands/` (`agentsCommand.ts` `/agents`, `hooksCommand.ts` `/hooks`, `memoryCommand.ts` `/memory`, `terminalCommand.ts` `/terminal`, `claudeSlashCommandRegistry.ts`) plus the shared `common/builtinSlashCommands.ts`. | S3–S5 |
| **V22** | Copilot Permission / Question Carousel | `chatSessions/copilotcli/node/` (`permissionHelpers.ts`, `userInputHelpers.ts`) + Claude-side `claude/common/toolPermissionHandlers/askUserQuestionHandler.ts` (delegates to the core `vscode_askQuestions` carousel); per-provider `*PermissionModes.ts`. | S3–S5 |

The copilot chat **transcript** itself renders through VS Code's native chat UI inside the Agents Window (`src/vs/sessions/`, views V5/V6/V8) — the extension supplies the *content* (normalized events), the window supplies the *surface*. The default-launch-surface decision is core-owned (`src/vs/workbench/contrib/chat/browser/agentSessions/defaultLaunchSurface.ts`, `DEFAULT_AGENT_LAUNCH_SURFACE = 'chat'`, setting `chat.agentSessions.defaultSurface`); the extension feeds it provider descriptors. Other inherited extensions shape upstream (non-fork-distinguishing) views and are out of `SC_VIEWS.md` scope: `git`/`github` (SCM views, status-bar entries — and the `agentSessionsWorkspace` / `agentsWindowConfiguration` / `scmHistoryProvider` / `quickDiffProvider` proposals that feed the Agents Window Changes view), `references-view`, `search-result`, `simple-browser` / `media-preview` / `markdown-language-features` / `mermaid-markdown-features` / `notebook-renderers`. `terminal-suggest` contributes terminal completions into the terminal surface — note the fork's **V18 Agent Terminal Selector** lives in `src/vs/.../agentTabs/`, not here.

---

## Integration points

**Upstream (this module depends on)**
- **`src/vs/workbench/api/`** — the extension host and the public `vscode` API. Every `main`-carrying extension runs there. `enabledApiProposals` names must correspond to proposal `.d.ts` files in `src/vscode-dts/` or activation fails (`AX-MOD-EXT-003`).
- **`src/vs/platform/agentHost/node/`** — the agent host utility process. `copilot`'s `chatSessions/grok/node/grokAgentRegistration.ts` binds the extension-side Grok provider id/descriptor to the platform `IAgent` at `src/vs/platform/agentHost/node/grok/grokAgent.ts` (the spawn-per-turn child-process adapter; see `GROK-DISCOVERY-GATE.md`). The `agentCliProviderRegistry` targets the platform `IAgentService.registerProvider` seam.
- **`src/vs/workbench/contrib/chat/browser/agentSessions/`** — the P4 chat-default launch surface (`defaultLaunchSurface.ts`) and the provider/builtins registries (`agentSessionProviderRegistry.ts`, `agentSessionProviderBuiltins.ts`, `agentSessionProviderCodicons.ts`) that render the extension's provider descriptors.
- **`build/lib/extensions.ts`** + the gulp pipeline (`transpile-extensions`/`watch-extensions`) — compiles/bundles all extensions **except** copilot; `build/lib/builtInExtensions.ts` + `product.json` decide which marketplace built-ins ship.
- Shared `node_modules/typescript` (pruned by `postinstall.mjs`) and the shared esbuild runners (`esbuild-*.mts`) (`AX-MOD-EXT-004`).

**Downstream (consumers of this module)**
- The **workbench** loads these as built-in extensions at runtime; behavior changes here change observable editor behavior.
- **`vscode-api-tests`** is the contract test between `src/vs/workbench/api/` and all extensions — it asserts the stability of the `vscode` API surface.
- **`copilot`** integrates with the **Agents Window** (`src/vs/sessions/`) and depends on the agent/chat/session API proposals enabled in core (`agentSessionsWorkspace`, `agentsWindowConfiguration`, `chatSessionsProvider`, `chatProvider`, `defaultChatParticipant`, `mcpServerDefinitions`, `languageModel*`, …).

**Cross-extension contracts**
- `extensionDependencies` declares load order (`git` → `vscode.git-base`; rich language clients → their `*-basics` grammars).
- `*-authentication` extensions (`github-authentication`, `microsoft-authentication`) provide auth sessions consumed by `git`, `github`, and `copilot` — mirroring the device-flow/keyring auth the CLI (`auth.rs`) performs.

**External integration contracts (copilot)**
- Provider-enable settings follow `chat.agentHost.${id}Agent.enabled`; the default launch surface is `chat.agentSessions.defaultSurface` (`'chat' | 'terminal'`, default `'chat'`, revertible) (`AX-MOD-EXT-007`).
- AI SDKs `@anthropic-ai/sdk`, `@github/copilot`, `@github/copilot-sdk`, `@vscode/copilot-api` (root + `remote/`), plus xAI/Grok and Gemini SDK/CLI adapters power the chat/session providers; BYOK keys flow through `byok/`.
- The session adapters speak to external agent SDKs/CLIs and to MCP servers; their HTTP endpoints, env-var names, and session-file path conventions are integration contracts (see the `AGENTS.md` docs under `chatSessions/`).
- The four copilot-owned SQLite schemas (`schema_version`/`CacheMeta.version`/`Metadata.cacheVersion`) are a persistence contract — migrate forward, never cross-DB FK (`AX-MOD-EXT-008`).

---

## Key source files

| Path | Why it matters |
|---|---|
| `extensions/package.json` | The only **root** manifest — shared deps + `postinstall`. Edits affect every extension's shared toolchain. Deps-only, not an aggregator (`AX-MOD-EXT-005`). |
| `extensions/esbuild-common.mts` | `runBuild()` — shared esbuild build/watch runner all extension build scripts call; controls `--watch` (parcel) / `--outputRoot` behavior. |
| `extensions/esbuild-extension-common.mts`, `esbuild-webview-common.mts` | Base esbuild option sets for extension and webview bundles. |
| `extensions/postinstall.mjs` | Prunes shared `node_modules/typescript`; over-pruning breaks `html-language-features` / `extension-editing` (which need `typescript.js`/`.d.ts` retained). |
| `extensions/tsconfig.base.json` | Base TS config (ES2024, commonjs, strict, decorators) inherited by extension tsconfigs. |
| `extensions/copilot/` (`copilot-chat`) | **Fork-owned** AI chat/agent extension — built & tested independently (`compile-copilot`, `watch-copilot`, `vscode-test`, `vitest`, `simulate`). The one in-scope extension under fork test strategy. `main` → `./dist/extension`; 63 API proposals; no extensionDependencies. |
| `extensions/copilot/src/extension/chatSessions/common/agentCliProvider.ts`, `agentCliProviderRegistry.ts` | **Multi-provider seam** — provider descriptor/normalized-event vocabulary + pure-data registry that maps descriptors onto `IAgentService.registerProvider`. SC_TEST priority #3; the seam that makes new providers generic (`AX-MOD-EXT-006`/`007`). |
| `extensions/copilot/src/extension/chatSessions/grok/` | **Grok provider** (SC_TEST priority #2) — 8 pure `common/` modules + 8 vitest specs; `node/grokAgentRegistration.ts` binds to the platform `IAgent`. |
| `extensions/copilot/src/extension/chatSessions/gemini/common/` | **Gemini provider** (ACP-based) — descriptor, model catalog, ACP events/types, permission modes, steering. |
| `extensions/copilot/src/extension/chatSessions/{claude,copilotcli}/` | Claude / Copilot-CLI session providers — slash commands (V21), permission/question dialogs (V22), MCP contributors, hooks. Each has an `AGENTS.md` design doc. |
| `extensions/copilot/src/platform/{chronicle,otel,workspaceChunkSearch}/node/` | The four copilot-owned SQLite stores (session chronicle, OTel spans, workspace chunk/embedding cache, external ingest index). See `.stokd/meta/extensions/SC_SCHEMA.puml`. |
| `extensions/copilot/src/extension/byok/vscode-node/xAIProvider.ts` | BYOK xAI/Grok key provider. |
| `extensions/git/` & `git-base/` | SCM provider; broadest API-proposal footprint (`scmHistoryProvider`, `quickDiffProvider`, `scmArtifactProvider`, `agentSessionsWorkspace`, `agentsWindowConfiguration`, …); `git` depends on `vscode.git-base`; powers SCM views + the Agents Window Changes feed. |
| `extensions/typescript-language-features/` | Largest language client; wires the TS server; high-traffic. |
| `extensions/terminal-suggest/` | Terminal completion provider (`terminalSuggestMain.ts`, `completions/`, `fig/`, `shell/`); `terminalCompletionProvider`/`terminalShellEnv` proposals; ties into the terminal surface. |
| `extensions/vscode-api-tests/` | Integration tests guarding the `vscode` API contract; its `enabledApiProposals` list mirrors the proposals extensions rely on. |
| `extensions/types/` | Shared ambient type shims (`lib.textEncoder.d.ts`, `lib.url.d.ts`). |
| `extensions/cgmanifest.json` | Component-governance manifest for bundled third-party code. |

---

## Change impact

When this module changes, validate the following:

- **Editing an upstream extension?** Stop — this widens the rebase conflict surface (`AX-MOD-EXT-001`, `AX-REPO-THIN-PATCH-FORK`, `SC_TEST.md` §0). Only `copilot/**` is fork-owned and freely editable; any other extension edit needs a governed task with an explicit rebase-impact justification and `SEAM_MANIFEST.md` accounting.
- **`copilot/**` changed** → run `npm run compile-copilot` and the copilot suites: `cd extensions/copilot && npm run test:unit` (**vitest**, for `*.spec.ts` — Grok `common/` and the registry seam) and `npm run test:extension` (**vscode-test**, for `test/vscode-node/**/*.test.ts` — activation/commands). Behavioral changes require a red→green test per `AX-REPO-FORK-TDD-SCOPE`. Naming is load-bearing: a pure copilot test must be `*.spec.ts` or vitest never sees it (`SC_TEST.md` §1).
- **New / changed chat-session provider** → keep provider-specific logic in `<provider>/common/` (vitest `.spec.ts`), I/O in `node/`; do **not** modify the shared renderer; derive the enable-gate via `providerEnabledSettingId()`; register through `AgentCliProviderRegistry`/`applyRegistryToAgentService` (`AX-MOD-EXT-006`/`007`). For a Node `IAgent`, also touch `src/vs/platform/agentHost/node/<provider>/`.
- **Copilot SQLite schema changed** → bump the store's `schema_version` (or `CacheMeta.version` / `Metadata.cacheVersion`) and migrate forward; never add a cross-database FK or share a connection with the core `src/` databases (`AX-MOD-EXT-008`). Re-generate `.stokd/meta/extensions/SC_SCHEMA.puml` if entities change.
- **Shared build infra (`esbuild-*.mts`, `postinstall.mjs`, `tsconfig.base.json`) changed** → rebuild **all** extensions: `npm run transpile-extensions` **and** `npm run compile-copilot`; verify `--watch` and `--outputRoot` paths still resolve (`AX-MOD-EXT-004`). After `postinstall.mjs` edits, confirm `html-language-features`/`extension-editing` still resolve `typescript.js`/`typescript.d.ts`.
- **`package.json` manifest changed** (`contributes`, `activationEvents`, `enabledApiProposals`, `main`, `extensionDependencies`) → validate the extension still **activates**; every `enabledApiProposals` name must resolve to a proposal `.d.ts` in `src/vscode-dts/`; run `vscode-api-tests` if the `vscode` API surface is involved (`AX-MOD-EXT-003`).
- **New built-in extension added/removed** → update `product.json` (`builtInExtensions` / `builtInExtensionsEnabledWithAutoUpdates`) and the gulp/`build/lib/extensions.ts` + `build/lib/builtInExtensions.ts` pipeline, or it won't ship.
- **Grammar/theme/snippet-only change** (declarative dirs) → no test needed (documentation/config exemption per `SC_AXIOMS.md` §5.2), but verify the contributed grammar/theme/snippet loads in the editor.

---

## Notes

- Per `SC_TEST.md` and `AX-REPO-FORK-TDD-SCOPE`, inherited upstream extensions are covered by Microsoft and are **re-verified, not re-tested**; the fork's value-add — and therefore where new tests belong — is `extensions/copilot/**`, with the Grok provider (priority #2) and the multi-provider CLI registry (priority #3) the current focus.
- The copilot extension is the bridge between the GUI Agents Window (`src/vs/sessions/`) and the agent backends the CLI (`cli/`) and platform agent host (`src/vs/platform/agentHost/`) supervise. Its session adapters (`chatSessions/{claude,copilotcli}`) are documented in their own `AGENTS.md` files; `gemini`/`grok` follow the same `common`→`node`→`vscode-node` layering.
- 0.6.0 product context: PRs #4/#5 made the Agents Window **chat** the default launch surface for every provider (`chat.agentSessions.defaultSurface = 'chat'`, revertible), and the 0.6.0 branding pass renamed user-visible "VS Code" → "Stokd Code" (product identity lives in `product.json`, `AX-REPO-PRODUCT-IDENTITY`).
- The module-local invariants live in `extensions/.axioms.md` (`AX-MOD-EXT-001..008`) and roll up to repo-wide `AX-REPO-THIN-PATCH-FORK` / `AX-REPO-FORK-TDD-SCOPE` in `.stokd/meta/SC_AXIOMS.md`.
- The copilot persistent data model is documented in `.stokd/meta/extensions/SC_SCHEMA.puml` (four independent SQLite databases).
