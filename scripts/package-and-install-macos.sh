#!/usr/bin/env bash
# AX-IDE-PACKAGE-INSTALL-MACOS: build the Stokd Code fork into a macOS .app, kill the running
# instance, install it into /Applications, and relaunch. Mirrors apps/menubar/scripts/deploy.sh.
#
# Each run: (1) build the darwin bundle via the fork's gulp target, (2) quit/kill the running app,
# (3) atomically replace $APPLICATIONS_DIR/Stokd Code.app, (4) relaunch it.
#
# Env knobs (the validation test drives these; normal use needs none):
#   STOKD_IDE_DEPLOY_DRY_RUN=1     skip the destructive kill + GUI launch (still installs the copy)
#   STOKD_IDE_SKIP_BUILD=1         skip the gulp build (use an existing/stub bundle)
#   STOKD_IDE_MINIFY=1             build the minified release target (vscode-darwin-<arch>-min)
#   STOKD_IDE_BUNDLE_DIR=<dir>     dir containing "Stokd Code.app" (default: <parent>/VSCode-darwin-<arch>)
#   STOKD_IDE_APPLICATIONS_DIR=<d> install dir (default: /Applications)
#   STOKD_IDE_HEAP_MB=<mb>         V8 old-space heap (MB) for the gulp build (default: 12288)
set -euo pipefail

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

# 1. Build the .app.
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

# 2. Verify the bundle was produced.
if [ ! -d "$APP_BUNDLE" ]; then
  echo "error: expected bundle not found at $APP_BUNDLE" >&2
  exit 1
fi

# 3. Kill the running instance BEFORE swapping the bundle (avoids replacing an in-use app).
if [ -n "$DRY_RUN" ]; then
  echo "dry-run: skip stop (would quit/pkill $APP_NAME)"
else
  echo "stop: quitting running $APP_NAME ..."
  osascript -e "quit app \"$APP_NAME\"" >/dev/null 2>&1 || true
  sleep 1
  pkill -x "$BIN_NAME" >/dev/null 2>&1 || true
  pkill -f "$APPLICATIONS_DIR/$APP_NAME.app" >/dev/null 2>&1 || true
fi

# 4. Install: replace the bundle in the Applications dir.
echo "install: $APP_NAME.app -> $APPLICATIONS_DIR ..."
mkdir -p "$APPLICATIONS_DIR"
rm -rf "$APPLICATIONS_DIR/$APP_NAME.app"
ditto "$APP_BUNDLE" "$APPLICATIONS_DIR/$APP_NAME.app"

# Normalize timestamps: the bundled Electron app carries the 1980 DOS/zip epoch on the
# .app dir and renamed binary, and ditto preserves it, so Finder shows an invalid date.
# Refresh the whole tree so the installed app shows a real created/modified date.
find "$APPLICATIONS_DIR/$APP_NAME.app" -exec touch {} +

# 5. Relaunch from the installed location.
if [ -n "$DRY_RUN" ]; then
  echo "dry-run: skip launch (would open $APPLICATIONS_DIR/$APP_NAME.app)"
else
  echo "launch: opening $APP_NAME ..."
  open "$APPLICATIONS_DIR/$APP_NAME.app"
fi

echo "done: installed $APP_NAME.app to $APPLICATIONS_DIR"
