# SC_MODULE — `remote`

> Module classification document. Generated for meta version 0.4.0 (fresh generation).

## Module name & location

- **Name:** `remote`
- **Package location:** `remote/` (monorepo root: `/opt/worktrees/stokd-cloud/stokd-ide/main`)
- **npm package name:** `vscode-reh` (`remote/package.json`) — the **R**emote **E**xtension **H**ost / server build
- **Sub-package:** `vscode-web` (`remote/web/package.json`) — the browser-served web build dependency subset

## Responsibility

`remote` is a **build-input dependency-manifest module**, not application source. It contains
**no TypeScript/JavaScript source of its own** — its entire job is to declare, pin, and version
the runtime artifacts that get bundled into the two server-side distributions of the product:

1. **The Remote Extension Host (REH) / server build** — the headless VS Code server that runs
   on a remote machine, in a container, or behind a tunnel, and hosts extensions + a node-pty
   terminal backend for a desktop or browser client. Its production runtime dependencies
   (native modules, the Copilot SDK, terminal/PTY, SSH, ripgrep, telemetry, etc.) are declared
   in `remote/package.json`.
2. **The web build (`vscode-web`)** — the browser-served workbench assets. Its narrower,
   browser-safe dependency subset is declared in `remote/web/package.json`.

It also acts as the **single source of truth for the server's Node.js runtime**: `remote/.npmrc`
pins the exact `node` target version, the internal MS build id, and the "build native modules from
source" policy. The repo build (`build/gulpfile.reh.ts`) reads this file to know which Node binary
to download, checksum, and ship inside the server package.

Design intent: keep the server/web runtime dependency closure **separate and minimal** relative to
the desktop (Electron) app's root `package.json`. The desktop build ships an Electron runtime; the
server build ships a plain Node runtime and only the dependencies a headless host needs. Splitting
them into `remote/` prevents the heavy/Electron-only dependencies from leaking into the server image.

## Public interfaces / entry points

This module exposes **files consumed by the build pipeline**, not code APIs. The "interface" is the
contract those files present to `build/`:

| File | Contract | Consumed by |
|------|----------|-------------|
| `remote/package.json` (`vscode-reh`) | Production `dependencies` + `overrides` for the server build | `build/gulpfile.reh.ts` |
| `remote/web/package.json` (`vscode-web`) | Production dependencies for the web build | `build/gulpfile.vscode.web.ts` |
| `remote/.npmrc` | `target=` (Node version), `ms_build_id=`, `runtime=node`, `build_from_source=true` | `getNodeVersion()` in `build/gulpfile.reh.ts` |
| `remote/web/.npmrc` | npm config for the web sub-package install | npm during dependency install |
| `remote/package-lock.json`, `remote/web/package-lock.json` | Locked, reproducible dependency closure | npm `ci` / production-dependency walk |
| `remote/node_modules/**` (installed) | The actual prebuilt/compiled artifacts bundled into the server | `getProductionDependencies(REMOTE_FOLDER)` |

There are **no exported functions, commands, controllers, or providers** in this package.

## Products

- **`SC_PRODUCT_CODE_OSS_DEV.md`** — `code-oss-dev` (packages: `cli`, `extensions`, **`remote`**, `scripts`, `test`).
  This module supplies the runtime dependency closure for the product's **server (REH)** and **web** distributions.

## Views

`remote` renders no views directly (it ships no UI code). It **materially shapes** the following
views from `SC_VIEWS.md` indirectly, by providing the runtime dependencies those views depend on
when the workbench runs against a remote server or in the browser:

- **View A — Main Workbench window** (`src/vs/workbench/`), in its **remote** and **browser/web**
  modes. The web build's asset/dependency closure (`vscode-web`) is what serves this view in a browser.
- **Integrated terminal views** — backed by `node-pty` (server-side PTY) and the `@xterm/*` family
  (frontend terminal renderer) declared here.
- **Search/results views** — backed by `@vscode/ripgrep-universal` bundled via this module.

When citing views, the relationship is "supplies runtime deps for," not "renders."

## Integration points

**Downstream (who depends on `remote`):**
- `build/gulpfile.reh.ts` — packages `remote/package.json` (rewriting `name`/`version`, stripping
  `dependencies`/`optionalDependencies`, forcing `type: module`), walks `getProductionDependencies(REMOTE_FOLDER)`
  to copy `node_modules`, downloads the Node binary pinned by `remote/.npmrc`, and assembles the server tarball.
- `build/gulpfile.vscode.web.ts` — uses `WEB_FOLDER = remote/web` and packages `remote/web/package.json`
  for the web distribution.
- `build/lib/dependencies.ts` (`getProductionDependencies`) — resolves the production dependency tree rooted at `remote/`.
- `build/checksums/nodejs.txt` — the Node version from `.npmrc` is matched against this checksum table (`getNodeChecksum`).
- `build/.moduleignore[.{darwin,linux,win32}]` — prune lists applied to the copied `node_modules`.

**Upstream (what `remote` depends on / is constrained by):**
- The npm registry + native toolchains (kerberos, ssh2/cpu-features, node-pty, `@vscode/spdlog`,
  `@vscode/sqlite3`, etc. are compiled **from source** per `build_from_source=true`).
- The Node.js / `node-gyp` ABI implied by the pinned `target` version — native modules must build against it.
- `@github/copilot*`, `@vscode/copilot-api`, `@microsoft/*` telemetry SDKs — external runtime contracts.

**Key contracts that must not silently change:**
- Package names `vscode-reh` / `vscode-web` and the folder layout `remote/` + `remote/web/`.
- The `.npmrc` keys `target`, `ms_build_id`, `runtime`, `build_from_source`.
- The `overrides` block that fixes transitive native-build dependencies.

## Key source files

| File | Why it matters |
|------|----------------|
| `remote/package.json` | Declares the server build's entire production runtime closure (native modules, Copilot SDK, terminal/PTY, SSH, telemetry, ripgrep) plus the `overrides` that make native modules build. The most important file in the module. |
| `remote/.npmrc` | Single source of truth for the server's Node.js version (`target=24.15.0`), internal build id (`ms_build_id=438265`), `runtime=node`, and `build_from_source=true`. Read by the build to pick/checksum the Node binary. |
| `remote/web/package.json` | The browser-safe dependency subset for the web build (`vscode-web`). |
| `remote/web/.npmrc` | npm config governing the web sub-package install. |
| `remote/package-lock.json` / `remote/web/package-lock.json` | Lock the exact, reproducible dependency closure for each build. |

`overrides` highlights in `remote/package.json`: `node-gyp-build` pinned to `4.8.1`;
`kerberos@2.1.1` forced onto `node-addon-api@7.1.0`; `ssh2` pinned to `cpu-features@0.0.0`;
`yauzl` floored at `^3.3.1`. These exist to make native compilation succeed and must be preserved.

## Change impact

When this module changes, validate the following — failures here break the **server/web build**, not the editor's TypeScript compile:

- **Adding/removing/bumping a dependency** in `remote/package.json` or `remote/web/package.json`:
  - Re-run the dependency install and confirm the matching `package-lock.json` updates and stays committed.
  - Confirm `build/gulpfile.reh.ts` (and `gulpfile.vscode.web.ts` for web) still packages without
    missing-module errors; the new dep is now shipped inside the server/web tarball (size + license impact).
  - For native modules: confirm they compile from source on **all** REH target platforms
    (`win32` x64/arm64, `darwin` x64/arm64, `linux` x64/arm64, `alpine`/musl arm64).
- **Changing `remote/.npmrc` `target` (Node version)**: requires a matching entry in
  `build/checksums/nodejs.txt`; native modules must rebuild against the new ABI. A mismatch fails
  `getNodeVersion()`/`getNodeChecksum()` in the build.
- **Editing `overrides`**: high risk — these gate native compilation (kerberos, ssh2, node-gyp-build).
  Removing one can break the build on a subset of platforms only.
- **Renaming the package or moving the folder**: breaks the hard-coded `REMOTE_FOLDER` / `WEB_FOLDER`
  paths and the `gulp.src(['remote/package.json'])` / `remote/web/package.json` globs in `build/`.
- General: because there are no unit tests in this package, validation is the **build itself**
  (server REH packaging + web packaging) plus a smoke launch of the resulting server
  (`./scripts/code-server.sh`).
