#!/usr/bin/env bash
# verify-agent-tabs.sh — fully autonomous end-to-end check for the agent-terminal-tabs seam
# (AX-IDE-WEBVIEW-TERMINAL-SELECTOR). No human babysitting, no UI driving:
#
#   1. Builds a throwaway workspace whose .vscode/tasks.json has a `runOn: folderOpen` task and
#      whose .vscode/settings.json turns the agent-tabs flag ON.
#   2. Launches Code OSS from sources with workspace trust disabled and code-ext as a dev extension.
#   3. VS Code itself auto-runs the task at startup -> the terminal panel renders -> the seam fires.
#      (No keybindings/commands — those don't dispatch reliably to a background CDP window.)
#   4. Polls the renderer DOM until the agent dashboard webview is hosted in the terminal strip.
#
# Exit 0 = PASS (agent view hosted), 1 = FAIL, 2 = setup error.
set -uo pipefail
export TMPDIR="/tmp"   # keep the IPC socket path under macOS' ~104-char limit

REPO="/opt/worktrees/stokd-cloud/stokd-ide/main"
CODE_EXT="/opt/worktrees/stokd-cloud/stokd-mono/main/apps/code-ext"
LAUNCH="$REPO/.claude/skills/launch/scripts/launch.sh"
PW="npx @playwright/cli"
SESSION="agenttabs-verify-$$"
AGENT_STRIP=".agent-terminal-tabs-webview"
KEEP=0
[ "${1:-}" = "--keep" ] && KEEP=1

fail()  { echo "RESULT: FAIL — $*"; exit 1; }
seterr(){ echo "RESULT: SETUP-ERROR — $*"; exit 2; }

command -v jq >/dev/null || seterr "jq not found"
[ -x "$LAUNCH" ] || seterr "launch.sh missing at $LAUNCH"
[ -f "$CODE_EXT/dist/extension.js" ] || seterr "code-ext not built ($CODE_EXT/dist/extension.js)"

WS=$(mktemp -d /tmp/agenttabs-ws-XXXXXX)
PROFILE=$(mktemp -d /tmp/agenttabs-profile-XXXXXX)
cleanup() {
  if [ "$KEEP" = 1 ]; then echo "[keep] window: pid=${PID:-?} cdp=${CDP:-?} ws=$WS"; return; fi
  $PW -s="$SESSION" close >/dev/null 2>&1 || true
  [ -n "${PID:-}" ] && kill "$PID" 2>/dev/null || true
  [ -n "${RUNDIR:-}" ] && rm -rf "$RUNDIR" 2>/dev/null || true
  rm -rf "$WS" "$PROFILE" 2>/dev/null || true
}
trap cleanup EXIT

echo "[1/5] building throwaway workspace ($WS) + seed profile with a folderOpen task + agent-tabs on..."
mkdir -p "$WS/.vscode"
cat > "$WS/.vscode/settings.json" <<'JSON'
{ "terminal.integrated.agentTabs.enabled": true, "terminal.integrated.tabs.enabled": true }
JSON
cat > "$WS/.vscode/tasks.json" <<'JSON'
{
  "version": "2.0.0",
  "tasks": [{
    "label": "agenttabs-keepalive",
    "type": "shell",
    "command": "echo agenttabs-terminal-ready; sleep 100000",
    "runOptions": { "runOn": "folderOpen" },
    "presentation": { "reveal": "always", "panel": "dedicated", "focus": false },
    "problemMatcher": []
  }]
}
JSON
# Seed USER settings the launcher will clone: task.allowAutomaticTasks must exist BEFORE first
# startup (it's machine-scoped, so a workspace .vscode/settings.json can't set it, and a renderer
# reload doesn't re-fire folderOpen tasks). With it 'on' + trust off, VS Code auto-runs the task.
mkdir -p "$PROFILE/User"
cat > "$PROFILE/User/settings.json" <<'JSON'
{
  "task.allowAutomaticTasks": "on",
  "security.workspace.trust.enabled": false,
  "terminal.integrated.agentTabs.enabled": true,
  "terminal.integrated.tabs.enabled": true,
  "files.simpleDialog.enable": true,
  "workbench.startupEditor": "none",
  "workbench.welcomePage.walkthroughs.openOnInstall": false
}
JSON

echo "[2/5] launching Code OSS (seeded profile, trust disabled, code-ext dev extension, workspace open)..."
INFO=$("$LAUNCH" --source-user-data-dir "$PROFILE" -- "$WS" --disable-workspace-trust --extensionDevelopmentPath="$CODE_EXT" | tail -n1) || seterr "launch failed"
CDP=$(jq -r .cdpPort <<<"$INFO"); PID=$(jq -r .pid <<<"$INFO"); RUNDIR=$(jq -r .runDir <<<"$INFO")
[ -n "$CDP" ] && [ "$CDP" != null ] || seterr "no cdpPort in launch JSON: $INFO"
echo "      pid=$PID cdp=$CDP"

echo "[3/5] attaching + dismissing the optional sign-in modal (not needed for terminals)..."
$PW -s="$SESSION" attach --cdp="http://127.0.0.1:$CDP" >/dev/null 2>&1 || seterr "playwright attach failed"
$PW -s="$SESSION" eval '(() => { const e=[...document.querySelectorAll("a,button,div,span")].find(x=>x.textContent.trim()==="Continue without Signing In"); if(e){e.click(); return "dismissed";} return "no-modal"; })()' >/dev/null 2>&1 || true

echo "[4/5] waiting for VS Code to auto-run the task and host the agent dashboard (up to 40s)..."
AGENT_OK=0
for i in $(seq 1 40); do
  STATE=$($PW -s="$SESSION" eval "(() => { const s=document.querySelector('$AGENT_STRIP'); const r=s&&s.getBoundingClientRect(); return JSON.stringify({ term: !!document.querySelector('.xterm,.terminal-outer-container'), agent: !!s, stripW: r?Math.round(r.width):0, stripH: r?Math.round(r.height):0, webview: !!document.querySelector('iframe') }); })()" 2>/dev/null | grep -A1 Result | tail -1 | tr -d '\\')
  echo "      t=${i}s $STATE"
  # Require the strip to be present AND actually sized (not collapsed to 0px = mounted-but-invisible).
  H=$(echo "$STATE" | sed -n 's/.*"stripH":\([0-9]*\).*/\1/p')
  if echo "$STATE" | grep -q '"agent":true' && [ "${H:-0}" -gt 50 ]; then AGENT_OK=1; break; fi
  sleep 1
done

echo "[5/5] capturing screenshot..."
SHOTS="$REPO/.stokd/verify/screenshots"; mkdir -p "$SHOTS"
STAMP=$(node -e 'process.stdout.write(String(Date.now()))')
$PW -s="$SESSION" screenshot --filename="$SHOTS/agent-tabs-$STAMP.png" >/dev/null 2>&1 && echo "      screenshot: $SHOTS/agent-tabs-$STAMP.png"

echo
[ "$AGENT_OK" = 1 ] && { echo "RESULT: PASS — agent dashboard hosted AND visibly sized in the terminal strip ($AGENT_STRIP, height > 50px)."; exit 0; }
fail "agent strip not present-and-sized within 40s. Last DOM state above (stripH=0 means it mounted but collapsed to zero height = invisible)."
