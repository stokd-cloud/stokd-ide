#!/usr/bin/env bash
# AX-IDE-PACKAGE-INSTALL-MACOS: build the Stokd Code fork into a macOS .app, kill the running
# instance, install it into /Applications, and relaunch. Mirrors apps/menubar/scripts/deploy.sh.
#
# Each run: (1) build the darwin bundle via the fork's gulp target, (2) quit/kill the running app,
# (3) atomically replace $APPLICATIONS_DIR/Stokd Code.app, (4) relaunch it.
#
# Steps 2-4 (the "install phase") are DESTRUCTIVE: they quit the running app. When this script is
# run from a terminal hosted *inside* the very app it ships (e.g. the integrated terminal), that
# quit would tear down the terminal's pty and kill the script before it finished installing. To
# avoid that, the normal path re-execs the install phase as a DETACHED background process
# (`nohup … & disown`, SIGHUP ignored) so it survives the quit, completes the install, and
# relaunches — even when the host terminal dies. The build runs in the foreground first so its
# progress and exit status are visible.
#
# Env knobs (the validation test drives these; normal use needs none):
#   STOKD_IDE_DEPLOY_DRY_RUN=1     skip the destructive kill + GUI launch; also skips the install
#                                  unless STOKD_IDE_APPLICATIONS_DIR points at a scratch dir (so a
#                                  bare dry-run never clobbers the live /Applications copy)
#   STOKD_IDE_SKIP_BUILD=1         skip the gulp build (use an existing/stub bundle)
#   STOKD_IDE_NO_DETACH=1          run the install phase inline instead of detached (preserves the
#                                  install exit status; only safe when NOT run from inside the app)
#   STOKD_IDE_MINIFY=1             build the minified release target (vscode-darwin-<arch>-min)
#   STOKD_IDE_BUNDLE_DIR=<dir>     dir containing "Stokd Code.app" (default: <parent>/VSCode-darwin-<arch>)
#   STOKD_IDE_APPLICATIONS_DIR=<d> install dir (default: /Applications)
#   STOKD_IDE_HEAP_MB=<mb>         V8 old-space heap (MB) for the gulp build (default: 12288)
set -euo pipefail

# An internal re-exec flag: when set, this invocation runs ONLY the destructive install phase
# (quit/install/relaunch) and skips the build. Used to run that phase detached from the caller's
# terminal — never pass it by hand.
INSTALL_PHASE=""
if [ "${1:-}" = "--install-phase" ]; then
  INSTALL_PHASE=1
fi

FORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="Stokd Code"   # product.json nameLong
BIN_NAME="stokd-code"   # product.json applicationName
DRY_RUN="${STOKD_IDE_DEPLOY_DRY_RUN:-}"
APPLICATIONS_DIR="${STOKD_IDE_APPLICATIONS_DIR:-/Applications}"

# Resolve the gulp darwin task by arch.
ARCH="$(uname -m)"
case "$ARCH" in
  arm64)  GULP_ARCH="arm64" ;;
  x86_64) GULP_ARCH="x64" ;;
  *) echo "error: unsupported arch '$ARCH'" >&2; exit 1 ;;
esac
GULP_TASK="vscode-darwin-${GULP_ARCH}${STOKD_IDE_MINIFY:+-min}"

BUNDLE_DIR="${STOKD_IDE_BUNDLE_DIR:-$(dirname "$FORK_DIR")/VSCode-darwin-${GULP_ARCH}}"
APP_BUNDLE="$BUNDLE_DIR/$APP_NAME.app"

# The destructive install phase: quit the running app, replace the bundle, relaunch. Factored into
# a function so it can run either inline or as the detached re-exec (--install-phase).
run_install_phase() {
  # Ignore SIGHUP for this phase and its children so that, when run detached, tearing down the
  # terminal's pty (the app being quit) cannot abort the install (nohup already does this on the
  # re-exec; this covers the inline path too).
  trap '' HUP

  # 1. Kill the running instance BEFORE swapping the bundle (avoids replacing an in-use app).
  if [ -n "$DRY_RUN" ]; then
    echo "dry-run: skip stop (would quit/pkill $APP_NAME)"
  else
    echo "stop: quitting running $APP_NAME ..."
    osascript -e "quit app \"$APP_NAME\"" >/dev/null 2>&1 || true
    sleep 1
    pkill -x "$BIN_NAME" >/dev/null 2>&1 || true
    pkill -f "$APPLICATIONS_DIR/$APP_NAME.app" >/dev/null 2>&1 || true
  fi

  # 2. Install: replace the bundle in the Applications dir.
  # SAFETY: a bare dry-run (no explicit install dir) must NEVER replace the live install — doing so
  # `rm -rf`s the running app's bundle out from under it and corrupts its webview service worker.
  # So skip the install entirely when dry-run AND the install dir is the default. The validation
  # test sets STOKD_IDE_APPLICATIONS_DIR to a scratch dir, so it still exercises the real install.
  if [ -n "$DRY_RUN" ] && [ -z "${STOKD_IDE_APPLICATIONS_DIR:-}" ]; then
    echo "dry-run: skip install (would replace $APPLICATIONS_DIR/$APP_NAME.app) — set STOKD_IDE_APPLICATIONS_DIR to install to a scratch dir"
    return 0
  fi
  echo "install: $APP_NAME.app -> $APPLICATIONS_DIR ..."
  mkdir -p "$APPLICATIONS_DIR"
  rm -rf "$APPLICATIONS_DIR/$APP_NAME.app"
  ditto "$APP_BUNDLE" "$APPLICATIONS_DIR/$APP_NAME.app"

  # Normalize timestamps: the bundled Electron app carries the 1980 DOS/zip epoch on the
  # .app dir and renamed binary, and ditto preserves it, so Finder shows an invalid date.
  # Refresh the whole tree so the installed app shows a real created/modified date.
  find "$APPLICATIONS_DIR/$APP_NAME.app" -exec touch {} +

  # 3. Relaunch from the installed location.
  if [ -n "$DRY_RUN" ]; then
    echo "dry-run: skip launch (would open $APPLICATIONS_DIR/$APP_NAME.app)"
  else
    echo "launch: opening $APP_NAME ..."
    open "$APPLICATIONS_DIR/$APP_NAME.app"
  fi

  echo "done: installed $APP_NAME.app to $APPLICATIONS_DIR"
}

# Detached re-exec: run only the install phase and exit.
if [ -n "$INSTALL_PHASE" ]; then
  if [ ! -d "$APP_BUNDLE" ]; then
    echo "error: expected bundle not found at $APP_BUNDLE" >&2
    exit 1
  fi
  run_install_phase
  exit 0
fi

# --- Normal path -----------------------------------------------------------------------------

# Build the .app.
if [ -n "${STOKD_IDE_SKIP_BUILD:-}" ]; then
  echo "package: skip build (would run gulp $GULP_TASK)"
else
  # Invoke gulp directly rather than via `npm run gulp`: that npm script hardcodes
  # `--max-old-space-size=8192` on node's command line, which overrides any heap set
  # through NODE_OPTIONS and OOMs the darwin packaging step. A direct invocation lets
  # our heap flag actually apply.
  HEAP_MB="${STOKD_IDE_HEAP_MB:-12288}"
  echo "package: building gulp $GULP_TASK (heap ${HEAP_MB}MB) ..."
  ( cd "$FORK_DIR" && node --experimental-strip-types "--max-old-space-size=${HEAP_MB}" ./node_modules/gulp/bin/gulp.js "$GULP_TASK" )
fi

# Verify the bundle was produced.
if [ ! -d "$APP_BUNDLE" ]; then
  echo "error: expected bundle not found at $APP_BUNDLE" >&2
  exit 1
fi

# Run the destructive install phase. Inline when it cannot clobber its own terminal (dry-run, which
# never quits the app) or when explicitly requested; otherwise DETACHED so quitting the app that may
# host this terminal cannot abort the install before it finishes + relaunches.
if [ -n "$DRY_RUN" ] || [ -n "${STOKD_IDE_NO_DETACH:-}" ]; then
  run_install_phase
else
  LOG="${TMPDIR:-/tmp}/stokd-ide-ship-install.log"
  : > "$LOG"
  # nohup + </dev/null + & + disown: the install phase ignores SIGHUP and is detached from this
  # shell's job control, so it survives the app (and any hosting terminal) being quit. Its command
  # line is the script path — NOT "$APPLICATIONS_DIR/$APP_NAME.app" — so the pkill -f inside it
  # cannot match (and kill) itself.
  STOKD_IDE_SKIP_BUILD=1 nohup bash "${BASH_SOURCE[0]}" --install-phase >"$LOG" 2>&1 </dev/null &
  disown 2>/dev/null || true
  echo "build done. Install phase detached (survives quitting $APP_NAME):"
  echo "  it will quit, replace, and relaunch $APP_NAME."
  echo "  progress:  tail -f \"$LOG\""
fi
