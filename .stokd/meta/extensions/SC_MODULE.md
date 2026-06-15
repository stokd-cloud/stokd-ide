<!-- stokd-meta: SC_MODULE.md | module: extensions | metaVersion 0.4.0 | generated: FRESH -->
# SC_MODULE.md — Module: `extensions`

## Module Name & Location

- **Module**: `extensions` (workspace identity: `vscode-extensions`, `extensions/package.json`)
- **Location**: `extensions/` (repo root: `/opt/worktrees/stokd-cloud/stokd-ide/main`)
- **Type**: Multi-package folder — ~105 entries, each a self-contained **built-in VS Code extension** (or shared build/types infra), not a single npm package.
- **Product**: `SC_PRODUCT_CODE_OSS_DEV.md` — `code-oss-dev` (this is the `extensions` package of that product).

The root `extensions/package.json` only declares **dependencies shared by all extensions** (`typescript`, build deps `esbuild`, `@parcel/watcher`, `vscode-grammar-updater`). It is **not** an aggregator — each subdirectory has its own `package.json`.

---

## Responsibility

This folder holds the **built-in extensions** that ship inside the editor. In VS Code's architecture, large amounts of editor functionality are intentionally implemented as extensions running in the **extension host** (`src/vs/workbench/api/`), against the public `vscode` API, rather than baked into the core workbench. This module is the home of that functionality.

Design intent for the fork: the overwhelming majority of these extensions are **inherited upstream** from `microsoft/vscode` and are treated as read-only under the thin-patch fork discipline (see `SC_OVERVIEW.md`, `SC_TEST.md` §0). Writing tests for or refactoring upstream extensions is **out of scope** — it widens the rebase conflict surface. The single **fork-owned** extension is **`copilot`** (`copilot-chat`, the first-party Copilot Chat / AI agent extension), which is built and tested separately from the rest.

Categories of content in this folder:

| Category | Examples | What it does |
|---|---|---|
| **Language features** (rich) | `typescript-language-features`, `html-language-features`, `css-language-features`, `json-language-features`, `markdown-language-features`, `php-language-features` | Client extensions wiring language servers / TS server into the editor (completions, diagnostics, formatting) |
| **Grammars / basics** (declarative) | `*-basics` (`markdown-basics`, `typescript-basics`, `prompt-basics`), plus per-language dirs (`go`, `rust`, `python`, `java`, `cpp`, `csharp`, …) | TextMate grammars, language configuration, snippets — mostly JSON/`.tmLanguage`, no runtime code |
| **Themes** | `theme-*` (`theme-defaults`, `theme-monokai`, `theme-seti`, …) | Color/icon theme contributions only |
| **Tooling / providers** | `git`, `git-base`, `github`, `github-authentication`, `microsoft-authentication`, `debug-auto-launch`, `debug-server-ready`, `emmet`, `npm`, `grunt`, `gulp`, `jake`, `merge-conflict`, `references-view`, `search-result`, `terminal-suggest`, `simple-browser`, `media-preview`, `ipynb`, `notebook-renderers`, `tunnel-forwarding`, `configuration-editing`, `extension-editing` | Extensions with real `src/` runtime code contributing commands, providers, views |
| **Fork-owned (first-party)** | **`copilot`** (`copilot-chat`) | AI chat / agent features powering the stokd agentic experience |
| **Test fixtures** | `vscode-api-tests`, `vscode-colorize-tests`, `vscode-colorize-perf-tests`, `vscode-test-resolver` | Integration tests against a real extension host (run via `vscode-test`) |
| **Shared build/types infra** | `esbuild-common.mts`, `esbuild-extension-common.mts`, `esbuild-webview-common.mts`, `postinstall.mjs`, `tsconfig.base.json`, `cgmanifest.json`, `types/` | Shared esbuild runner, TS pruning, base tsconfig, component-governance manifest |

---

## Public Interfaces / Entry Points

Each extension declares its own contract in **`package.json`** (`main`, `contributes`, `activationEvents`, `enabledApiProposals`, `extensionDependencies`). There is no single module-level export — the "public interface" is the union of each extension's manifest.

Key conventions an editor agent must respect:

- **`main`** — JS entry compiled from `src/` (only the ~30 extensions listed by `for d in */; do [ -d $d/src ]` carry runtime code; the rest are declarative).
- **`contributes`** — commands, menus, views, languages, grammars, themes, configuration, debuggers, etc. This is the user-visible surface.
- **`activationEvents`** — when the extension host loads the extension (e.g. `git` uses `*`, `onFileSystem:git`, `onEditSession:file`).
- **`enabledApiProposals`** — proposed (unstable) `vscode` API surfaces the extension opts into. These names (e.g. `git`'s `scmHistoryProvider`, `quickDiffProvider`; `vscode-api-tests`' long list) form a **contract with `src/vs/workbench/api/`** — they must match a proposal `.d.ts` shipped by core.
- **`extensionDependencies`** — load-order contract (e.g. `git` depends on `vscode.git-base`).

**Build entry points** (shared infra):
- `esbuild-common.mts` — `runBuild(config, baseOptions, args, didBuild?)`: the shared esbuild build/watch runner; `--watch` uses `@parcel/watcher` (lower idle CPU than esbuild watch), `--outputRoot` redirects output. Used by per-extension `esbuild.mts` scripts.
- `esbuild-extension-common.mts`, `esbuild-webview-common.mts` — extension- and webview-specific base options layered on `runBuild`.
- `postinstall.mjs` — prunes the shared `node_modules/typescript` install down to `lib/` + `package.json` (keeps `lib.*.d.ts`, `typescript.js/.d.ts` for html & extension-editing); runs on `postinstall`.

**Repo-level build/test entry points** (from root `package.json`):
- `transpile-extensions` / `watch-extensions` → `npm run gulp transpile-extensions` / `watch-extensions` (gulp drives the bulk of extensions via `build/lib/extensions.ts`).
- `compile-copilot` / `watch-copilot` → `npm --prefix extensions/copilot run compile|watch` — **copilot is built independently** of the gulp pipeline.
- `test-extension` → `vscode-test` — integration tests (`vscode-api-tests`, `copilot/test`, colorize tests) against a real extension host.
- `download-builtin-extensions` → `build/lib/builtInExtensions.ts`; built-ins are also listed in `product.json` (`builtInExtensions`, `builtInExtensionsEnabledWithAutoUpdates`).

---

## Products

- **`SC_PRODUCT_CODE_OSS_DEV.md`** — `code-oss-dev`. This folder *is* the `extensions` package named in that product's package list (`cli`, `extensions`, `remote`, `scripts`, `test`). Every extension here belongs to that single product.

---

## Views (from SC_VIEWS.md)

This module does not own a workbench *part*, but several extensions materially shape views catalogued in `SC_VIEWS.md`:

- **B3. Webview / Custom Editor** — extensions that contribute webviews (`simple-browser`, `media-preview`, `markdown-language-features` preview, `mermaid-markdown-features`, `notebook-renderers`) render inside the sandboxed webview editor. (`SC_VIEWS.md` B3 explicitly names `extensions/` contributors.)
- **A8. Status Bar** / **A3. Activity Bar** / **A4. Side Bar** — `git`/`github` contribute SCM views, status-bar entries, and the Source Control view container; `references-view` contributes the References/Call-Hierarchy tree view; `search-result` shapes search-result editors.
- **C. Terminal view** — `terminal-suggest` contributes terminal completions (via `terminalCompletionProvider` / `terminalShellEnv` proposed API) into the terminal surface (the same surface the fork's **C2 Agent terminal selector** customizes — but that selector lives in `src/vs/`, not here).
- **D. Agents Window** — the fork-owned **`copilot`** extension supplies the AI chat/agent capability surfaced by the Agents Window (`src/vs/sessions/`, views D1/D3/D5). The Agents Window is rendered in `src/vs/sessions/`, but its chat content is powered by this extension and the API proposals it (and `git`) enable (`agentSessionsWorkspace`, `agentsWindowConfiguration`).

This module renders **no view by itself** — views are owned by `src/vs/workbench/` and `src/vs/sessions/`; extensions populate them via the `vscode` API.

---

## Integration Points

**Upstream (this module depends on):**
- **`src/vs/workbench/api/`** — the extension host and the public `vscode` API surface. Every `main`-carrying extension runs there. `enabledApiProposals` must correspond to proposal `.d.ts` files shipped by core, or activation fails.
- **`build/lib/extensions.ts`** + the gulp pipeline — compiles/bundles all extensions except copilot; `build/lib/builtInExtensions.ts` + `product.json` decide what ships.
- Shared `typescript` install (pruned by `postinstall.mjs`) and the shared esbuild runners (`esbuild-*.mts`).

**Downstream (consumers of this module):**
- The **workbench** loads these as built-in extensions at runtime; behavior changes here change observable editor behavior.
- **`vscode-api-tests`** asserts the stability of the `vscode` API — it is the contract test between `src/vs/workbench/api/` and all extensions.
- **`copilot`** integrates with the **Agents Window** (`src/vs/sessions/`) and depends on the agent/chat API proposals enabled in core.

**Cross-extension contracts:**
- `extensionDependencies` declares load order (`git` → `git-base`; language-feature clients → their `*-basics` grammars).
- `*-authentication` extensions (`github-authentication`, `microsoft-authentication`) provide auth sessions consumed by `git`, `github`, and `copilot`.

---

## Key Source Files

| Path | Why it matters |
|---|---|
| `extensions/package.json` | Declares shared deps + `postinstall`; the only **root** manifest — edits here affect every extension's shared toolchain. |
| `extensions/esbuild-common.mts` | `runBuild()` — shared esbuild build/watch runner all extension build scripts call; controls `--watch`/`--outputRoot` behavior. |
| `extensions/esbuild-extension-common.mts`, `esbuild-webview-common.mts` | Base esbuild option sets for extension and webview bundles. |
| `extensions/postinstall.mjs` | Prunes shared `node_modules/typescript`; over-pruning breaks `html-language-features` / `extension-editing`. |
| `extensions/tsconfig.base.json` | Base TS config inherited by extension `tsconfig.json` files. |
| `extensions/copilot/` (`copilot-chat`) | **Fork-owned** AI chat/agent extension — built & tested independently (`compile-copilot`, `watch-copilot`, `copilot/test`). The one in-scope extension under fork test strategy. |
| `extensions/git/` & `git-base/` | SCM provider; broadest API-proposal footprint (`scmHistoryProvider`, `quickDiffProvider`, `agentSessionsWorkspace`, …); powers SCM views + the Agents Window Changes view feed. |
| `extensions/typescript-language-features/` | Largest language client; wires the TS server; high-traffic. |
| `extensions/terminal-suggest/` | Terminal completion provider (`terminalSuggestMain.ts`, `completions/`, `fig/`, `shell/`); ties into the terminal surface. |
| `extensions/vscode-api-tests/` | Integration tests guarding the `vscode` API contract; its `enabledApiProposals` list mirrors the proposals extensions rely on. |
| `extensions/types/` (`lib.textEncoder.d.ts`, `lib.url.d.ts`) | Shared ambient type shims for extensions. |
| `extensions/cgmanifest.json` | Component-governance manifest for bundled third-party code. |

---

## Change Impact — what to validate when this module changes

- **Upstream extension edited?** Stop — this widens the rebase surface (`SC_OVERVIEW.md`, `SC_TEST.md` §0). Only `copilot/**` is fork-owned and freely editable. Editing any other extension needs a governed task with explicit justification and should be reflected against `SEAM_MANIFEST.md` discipline.
- **`copilot/**` changed** → run `npm run compile-copilot` and `npm run test-extension` (its `test/` runs under `vscode-test`). This is the in-scope test target per `SC_TEST.md` §1 (Extension integration harness).
- **Shared build infra (`esbuild-*.mts`, `postinstall.mjs`, `tsconfig.base.json`) changed** → rebuild **all** extensions: `npm run transpile-extensions` (+ `compile-copilot`) and `npm run watch-extensions`; verify `--watch` and `--outputRoot` paths still resolve. `postinstall.mjs` changes risk breaking `html-language-features`/`extension-editing` (they need `typescript.js`/`.d.ts` retained).
- **`package.json` manifest changed** (`contributes`, `activationEvents`, `enabledApiProposals`, `main`, `extensionDependencies`) → validate the extension still **activates** and that any `enabledApiProposals` name resolves to a proposal `.d.ts` in core (`src/vscode-dts/`); run `vscode-api-tests` if the `vscode` API surface is involved.
- **New built-in extension added/removed** → update `product.json` (`builtInExtensions` / `builtInExtensionsEnabledWithAutoUpdates`) and the gulp/`build/lib/extensions.ts` pipeline, or it won't ship.
- **Grammar/theme-only change** (declarative dirs) → no test needed (documentation/config exemption per `SC_AXIOMS.md` §5.2), but verify the contributed grammar/theme loads in the editor.

> Re-run meta generation for this module after changes to the shared esbuild runners, `postinstall.mjs`, the set of built-in extensions, or the `copilot` extension.
