#!/usr/bin/env bash
# AX-IDE-PACKAGE-INSTALL-MACOS guard: exercises package-and-install-macos.sh headlessly via
# STOKD_IDE_DEPLOY_DRY_RUN + stub knobs (no gulp build, no real /Applications, no GUI launch, and
# stubbed pkill/open/osascript on PATH to PROVE the destructive steps are skipped in dry-run).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$SCRIPT_DIR/package-and-install-macos.sh"

fail() { echo "FAIL: $*" >&2; exit 1; }

# ── Structural ───────────────────────────────────────────────────────────────
[ -f "$SCRIPT" ] || fail "missing $SCRIPT"
[ -x "$SCRIPT" ] || fail "script not executable: $SCRIPT"

ARCH="$(uname -m)"
case "$ARCH" in
  arm64)  EXPECT_TASK="vscode-darwin-arm64" ;;
  x86_64) EXPECT_TASK="vscode-darwin-x64" ;;
  *)      EXPECT_TASK="" ;;
esac

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Stand-in bundle so the build can be skipped and install proceeds.
BUNDLE_DIR="$WORK/build"
APP="$BUNDLE_DIR/Stokd Code.app"
mkdir -p "$APP/Contents/MacOS"
printf '#!/bin/sh\nexit 0\n' > "$APP/Contents/MacOS/stokd-code"
chmod +x "$APP/Contents/MacOS/stokd-code"

APPS_DIR="$WORK/Applications"
mkdir -p "$APPS_DIR"

run() {
  STOKD_IDE_SKIP_BUILD=1 \
  STOKD_IDE_DEPLOY_DRY_RUN=1 \
  STOKD_IDE_BUNDLE_DIR="$BUNDLE_DIR" \
  STOKD_IDE_APPLICATIONS_DIR="$APPS_DIR" \
    bash "$SCRIPT"
}

# ── Functional: dry-run install ──────────────────────────────────────────────
OUT="$(run)" || fail "dry-run exited non-zero; got: $OUT"

if [ -n "$EXPECT_TASK" ]; then
  echo "$OUT" | grep -q "$EXPECT_TASK" \
    || fail "output must surface the arch gulp task $EXPECT_TASK; got: $OUT"
fi
echo "$OUT" | grep -qi "dry-run" \
  || fail "dry-run must report skipping the destructive steps; got: $OUT"
[ -d "$APPS_DIR/Stokd Code.app" ] \
  || fail "install must copy the .app into the Applications dir"

# ── Dry-run must NOT invoke pkill/open/osascript (stub them on PATH) ──────────
STUB_BIN="$WORK/bin"; mkdir -p "$STUB_BIN"
for tool in pkill open osascript; do
  printf '#!/bin/sh\necho "STUB_CALLED:%s" >> "%s/calls.log"\nexit 0\n' "$tool" "$WORK" > "$STUB_BIN/$tool"
  chmod +x "$STUB_BIN/$tool"
done
: > "$WORK/calls.log"
PATH="$STUB_BIN:$PATH" run >/dev/null 2>&1 || fail "dry-run with stubs exited non-zero"
if grep -qE "STUB_CALLED:(pkill|open|osascript)" "$WORK/calls.log"; then
  fail "dry-run must NOT invoke pkill/open/osascript: $(cat "$WORK/calls.log")"
fi

# ── Timestamp normalization: installed bundle must not carry the 1980 DOS/zip epoch ──
# The bundled Electron app inherits the 1980 DOS/zip epoch on the .app dir and renamed
# binary; ditto preserves it, so Finder shows an invalid date. Stamp the source bundle
# with that epoch and assert the install refreshes it to a real date.
touch -t 198001010000 "$APP/Contents/MacOS/stokd-code" "$APP"
run >/dev/null 2>&1 || fail "dry-run (timestamp case) exited non-zero"
INSTALLED="$APPS_DIR/Stokd Code.app"
for target in "$INSTALLED" "$INSTALLED/Contents/MacOS/stokd-code"; do
  yr="$(stat -f '%Sm' -t '%Y' "$target")"
  [ "$yr" != "1980" ] || fail "installed bundle must not carry the 1980 epoch: $target"
done

# ── Missing-bundle guard: empty bundle dir must exit non-zero ─────────────────
EMPTY="$WORK/empty"; mkdir -p "$EMPTY"
if STOKD_IDE_SKIP_BUILD=1 STOKD_IDE_DEPLOY_DRY_RUN=1 \
   STOKD_IDE_BUNDLE_DIR="$EMPTY" STOKD_IDE_APPLICATIONS_DIR="$APPS_DIR" \
   bash "$SCRIPT" >/dev/null 2>&1; then
  fail "missing bundle must exit non-zero"
fi

echo "PASS: package-and-install-macos.sh dry-run install + guards"
