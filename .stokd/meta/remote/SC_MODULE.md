# SC_MODULE — `remote`

> Module classification document. Meta version 0.6.0 (upgraded 0.5.0 → 0.6.0; content
> preserved and re-verified against current source — added the `disturl` contract, the
> manifest-only structural invariant, the no-test-companion note, and corrected the
> Windows Node-checksum keying — `win-<arch>/node.exe` entries are resolved via
> `ms_build_id`/`product.nodejsRepository`, not version-stamped like the `.tar.gz` entries).
> Scope: the `remote/` package of the `code-oss-dev` thin-patch fork of `microsoft/vscode`.

## Module name & location

- **Name:** `remote`
- **Package location:** `remote/` (monorepo root: `/opt/worktrees/stokd-cloud/stokd-ide/main`)
- **npm package name:** `vscode-reh` (`remote/package.json`) — the **R**emote **E**xtension **H**ost / headless server build.
- **Sub-package:** `vscode-web` (`remote/web/package.json`) — the browser-served web build's narrower, browser-safe dependency subset.

This is a **manifest-only module**: the only git-tracked files (excluding installed `node_modules/`)
are dependency manifests, lockfiles, npm config, and the axiom file:

```
remote/.npmrc
remote/package.json
remote/package-lock.json
remote/web/.npmrc
remote/web/package.json
remote/web/package-lock.json
remote/.axioms.md
```

There is **no `.ts`/`.js`/`.mjs`/`.cjs` source committed under `remote/`** — confirmed by
`git ls-files remote/`. This structural invariant is enforced by `AX-MOD-REMOTE-006`.

There is **no `SC_TEST.md` companion** for this module under `.stokd/meta/remote/` because the
package contains no unit tests (see [Change impact](#change-impact)); its validation gate is the
build itself, not a test runner.

## Responsibility

`remote` is a **build-input dependency-manifest module**, not application source. It ships **no
TypeScript/JavaScript source of its own** — its entire job is to declare, pin, version, and lock the
runtime artifacts bundled into the two server-side distributions of the product:

1. **The Remote Extension Host (REH) / server build (`vscode-reh`)** — the headless VS Code server
   that runs on a remote machine, in a container, or behind a tunnel and hosts extensions plus a
   `node-pty` terminal backend for a desktop or browser client. Its full production runtime closure
   (native modules, the Copilot SDK, terminal/PTY, SSH, ripgrep, telemetry, archive/compression,
   etc.) is declared in `remote/package.json`.
2. **The web build (`vscode-web`)** — the browser-served workbench assets. Its narrower,
   browser-safe dependency subset (no native modules, no PTY, no SSH) is declared in
   `remote/web/package.json`.

It is also the **single source of truth for the server's Node.js runtime**: `remote/.npmrc` pins the
exact `node` target version (`target="24.15.0"`), the internal Microsoft build id
(`ms_build_id="438265"`), the runtime kind (`runtime="node"`), the Node distribution source used to
fetch headers/binaries for native compilation (`disturl="https://nodejs.org/dist"`), and the
"compile native modules from source" policy (`build_from_source="true"`). The repo build
(`build/gulpfile.reh.ts`) reads this file verbatim to choose, download, and checksum the Node binary
shipped inside the server package.

**Design intent:** keep the server/web runtime dependency closure **separate from and minimal
relative to** the desktop (Electron) app's root `package.json`. The desktop build ships an Electron
runtime; the server build ships a plain Node runtime and only the dependencies a headless host needs.
Splitting them into `remote/` (and `remote/web/`) prevents heavy/Electron-only dependencies from
leaking into the server and browser images.

## Public interfaces / entry points

This module exposes **files consumed by the build pipeline**, not code APIs. The "interface" is the
contract those files present to `build/`:

| File | Contract | Consumed by |
|------|----------|-------------|
| `remote/package.json` (`vscode-reh`) | Production `dependencies` + `overrides` for the server build | `build/gulpfile.reh.ts` |
| `remote/web/package.json` (`vscode-web`) | Production dependencies for the web build | `build/gulpfile.vscode.web.ts` |
| `remote/.npmrc` | `disturl=`, `target=` (Node version), `ms_build_id=`, `runtime=node`, `build_from_source=true` (+ `legacy-peer-deps`, `timeout`, `min-release-age`) | `getNodeVersion()` in `build/gulpfile.reh.ts:141` (regexes `target`/`ms_build_id`); node-gyp at install time (`disturl`/`build_from_source`) |
| `remote/web/.npmrc` | npm config for the web sub-package install (`legacy-peer-deps`, `timeout`, `min-release-age`) | npm during dependency install |
| `remote/package-lock.json`, `remote/web/package-lock.json` | Locked, reproducible dependency closure per build | npm `ci` / production-dependency walk |
| `remote/node_modules/**` (installed) | The actual prebuilt/compiled artifacts copied into the server image | `getProductionDependencies(REMOTE_FOLDER)` (`build/lib/dependencies.ts:40`) |

There are **no exported functions, commands, controllers, providers, or runtime entry points** in
this package. Its observable behavior is realized only when `build/` packages it.

## Products

- **`SC_PRODUCT_CODE_OSS_DEV.md`** — `code-oss-dev` (packages: `cli`, `extensions`, **`remote`**,
  `scripts`, `test`, layered on the primary `src/` app). This module supplies the runtime dependency
  closure for the product's **server (REH)** and **web** distributions.

## Views

`remote` renders **no** views directly — it ships no UI code. It **materially shapes** the following
`SC_VIEWS.md` views indirectly, by supplying the runtime dependencies they require when the workbench
runs against a remote server or inside a browser. The relationship is "supplies runtime deps for,"
not "renders."

- **V1 — Agents Window: Shell / Layout** and **V17 — Mobile / Phone Layout** (web) — the web build
  (`vscode-web`) is the dependency closure that serves these shells in a browser.
- **V14 — Sessions Panel / Terminal** — backed server-side by `node-pty` (declared in `vscode-reh`)
  and rendered with the `@xterm/*` family (declared in both manifests).
- **V18 — Agent Terminal Selector** — uses the same `@xterm/*` terminal renderer stack shipped here.
  (Per the 0.6.0 SC_VIEWS update, V18 is now an opt-in escape hatch behind the multi-provider chat
  default surface, but its renderer dependency closure still comes from this module.)
- Workbench **search** (ripgrep-backed) — `@vscode/ripgrep-universal` is bundled via `vscode-reh`.

## Integration points

**Downstream (who depends on `remote`):**
- `build/gulpfile.reh.ts` — `REMOTE_FOLDER = path.join(REPO_ROOT, 'remote')` (line 41); packages
  `remote/package.json` (rewriting `name`/`version`, forcing `type: module`), walks
  `getProductionDependencies(REMOTE_FOLDER)` (line 391) to copy `node_modules`, reads
  `remote/.npmrc` via `getNodeVersion()` (lines 141–144, regexes `/^target="(.*)"$/m` and
  `/^ms_build_id="(.*)"$/m`), and downloads/checksums the Node binary via `getNodeChecksum()`
  (lines 148–149, 260).
- `build/gulpfile.vscode.web.ts` — `WEB_FOLDER = path.join(REPO_ROOT, 'remote', 'web')` (line 26);
  globs `remote/web/package.json` (line 186) and walks `getProductionDependencies(WEB_FOLDER)`
  (line 191) for the web distribution.
- `build/lib/dependencies.ts` — `getProductionDependencies(folderPath)` (line 40) resolves the
  production dependency tree rooted at `remote/` or `remote/web/`.
- `build/checksums/nodejs.txt` — `getNodeChecksum(expectedName)` (`build/gulpfile.reh.ts:148`,
  called from `nodejs()` at line 260) looks up the downloaded Node binary by name. darwin/linux
  are keyed by the **public** version string from `.npmrc` (4 entries:
  `node-v24.15.0-{darwin,linux}-{arm64,x64}.tar.gz`); the two **Windows** binaries are keyed by
  bare `win-arm64/node.exe` / `win-x64/node.exe` (built via `expectedName = win-<arch>/node.exe`
  in `nodejs()`, `gulpfile.reh.ts:243`) and fetched through the internal `ms_build_id` build via
  `product.nodejsRepository`, so their checksum keys are **not** version-stamped.
- `build/.moduleignore[.{darwin,linux,win32}]` — prune lists applied to the copied `node_modules`.

**Upstream (what `remote` depends on / is constrained by):**
- The npm registry + native toolchains: `kerberos`, `ssh2`→`cpu-features`, `node-pty`,
  `@vscode/spdlog`, `@vscode/sqlite3`, `@parcel/watcher`, `@vscode/native-watchdog`,
  `@vscode/windows-process-tree`, `@vscode/windows-registry`, `@vscode/deviceid` are compiled
  **from source** per `build_from_source="true"` against the `disturl` Node headers.
- The Node.js / `node-gyp` ABI implied by the pinned `target` version — every native module must
  build against it.
- External runtime contracts: `@github/copilot`, `@github/copilot-sdk`, `@vscode/copilot-api`,
  `@microsoft/1ds-*` and `@microsoft/mxc-sdk` (`0.6.0`) telemetry/agent SDKs.

**Cross-manifest contract:** the **19** dependencies present in **both** `vscode-reh` and `vscode-web`
(the `@microsoft/1ds-*` pair, `@vscode/iconv-lite-umd`, `@vscode/tree-sitter-wasm`,
`@vscode/vscode-languagedetection`, the eight `@xterm/addon-*` packages, `@xterm/xterm`, `jschardet`,
`katex`, `tas-client`, `vscode-oniguruma`, `vscode-textmate`) declare **identical** version ranges
so the same frontend renders consistently in the desktop-server and browser builds.
`@xterm/headless` is server-only (`vscode-reh`); `@vscode/codicons` is web-only (`vscode-web`).

**Contracts that must not silently change:**
- Package names `vscode-reh` / `vscode-web` and the folder layout `remote/` + `remote/web/`.
- The `.npmrc` keys `disturl`, `target`, `ms_build_id`, `runtime`, `build_from_source`.
- The `overrides` block that fixes transitive native-build dependencies.

## Key source files

| File | Why it matters |
|------|----------------|
| `remote/package.json` | Declares the server build's entire production runtime closure (native modules, Copilot SDK, terminal/PTY, SSH, telemetry, ripgrep, `tar`/`yauzl`/`yazl`, `ws`, `zod`) plus the `overrides` that make native modules build. The most important file in the module. |
| `remote/.npmrc` | Single source of truth for the server's Node.js version (`target="24.15.0"`), internal build id (`ms_build_id="438265"`), `runtime="node"`, `disturl="https://nodejs.org/dist"`, and `build_from_source="true"`. Read by the build to pick/checksum the Node binary and by node-gyp to compile native modules. |
| `remote/web/package.json` | The browser-safe dependency subset for the web build (`vscode-web`). |
| `remote/web/.npmrc` | npm config governing the web sub-package install. |
| `remote/package-lock.json` / `remote/web/package-lock.json` | Lock the exact, reproducible dependency closure for each build. |
| `remote/.axioms.md` | Directory-scoped invariants every future agent must respect when editing this module. |

`overrides` highlights in `remote/package.json`: `node-gyp-build` pinned to `4.8.1`;
`kerberos@2.1.1` forced onto `node-addon-api@7.1.0`; `ssh2` pinned to `cpu-features@0.0.0`;
`yauzl` floored at `^3.3.1`. These exist to make native compilation succeed and must be preserved.

## Change impact

Because there are **no unit tests in this package**, validation is the **build itself** (server REH
packaging + web packaging) plus a smoke launch of the resulting server. Failures here break the
**server/web build**, not the editor's TypeScript compile.

When this module changes, validate:

- **Adding/removing/bumping a dependency** in `remote/package.json` or `remote/web/package.json`:
  - Re-run the dependency install and confirm the matching `package-lock.json` updates and stays
    committed (AX-MOD-REMOTE-004).
  - Confirm `build/gulpfile.reh.ts` (and `gulpfile.vscode.web.ts` for web) still packages without
    missing-module errors; the new dep is now shipped inside the server/web tarball (size + license
    impact).
  - For native modules: confirm they compile from source on **all** REH target platforms covered by
    `build/checksums/nodejs.txt` (`darwin` x64/arm64, `linux` x64/arm64, `win32` x64/arm64).
  - If the dependency is shared between both manifests, keep the version ranges aligned
    (AX-MOD-REMOTE-005).
- **Changing `remote/.npmrc` `target` (Node version):** requires refreshed entries in
  `build/checksums/nodejs.txt` — new version-stamped `node-v<target>-{darwin,linux}-*.tar.gz`
  rows **and** refreshed `win-<arch>/node.exe` SHA-256s (the Windows keys are not version-stamped
  but their binary content changes). Native modules must also rebuild against the new ABI. A
  missing/mismatched checksum fails `getNodeChecksum()` in the build (AX-MOD-REMOTE-001;
  AX-MOD-REMOTE-007 grep-verifies the four nix `.tar.gz` rows exist for the current `target`).
- **Editing `overrides`:** high risk — these gate native compilation (`kerberos`, `ssh2`,
  `node-gyp-build`). Removing one can break the build on a subset of platforms only
  (AX-MOD-REMOTE-003).
- **Renaming the package or moving the folder:** breaks the hard-coded `REMOTE_FOLDER` / `WEB_FOLDER`
  paths and the `remote/package.json` / `remote/web/package.json` globs in `build/`
  (AX-MOD-REMOTE-002).
- **Adding non-manifest source under `remote/`:** prohibited — this is a manifest-only module
  (AX-MOD-REMOTE-006). Server/web runtime code belongs in `src/vs/server/**` and `src/vs/workbench/**`,
  not here.
- **Smoke validation:** launch the packaged server (`./scripts/code-server.sh`) and confirm a
  headless workbench is served and the integrated terminal (`node-pty`) and search (ripgrep) work.
