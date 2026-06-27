# AX-IDE-PACKAGE-INSTALL-WINDOWS: build the Stokd Code fork into an unpackaged win32 build, kill the
# running instance, install it into a per-user Programs dir, and relaunch. Windows port of
# scripts/package-and-install-macos.sh.
#
# Each run: (1) build the win32 bundle via the fork's gulp target, (2) kill the running app,
# (3) atomically replace <InstallDir>\Stokd Code, (4) relaunch it.
#
# Env knobs (mirror the macOS script; normal use needs none):
#   STOKD_IDE_DEPLOY_DRY_RUN=1     skip the destructive kill + GUI launch (still installs the copy)
#   STOKD_IDE_SKIP_BUILD=1         skip the gulp build (use an existing/stub bundle)
#   STOKD_IDE_MINIFY=1             build the minified release target (vscode-win32-<arch>-min)
#   STOKD_IDE_BUNDLE_DIR=<dir>     dir containing the unpackaged build (default: <parent>\VSCode-win32-<arch>)
#   STOKD_IDE_INSTALL_DIR=<dir>    install dir (default: %LOCALAPPDATA%\Programs)
#   STOKD_IDE_HEAP_MB=<mb>         V8 old-space heap (MB) for the gulp build (default: 12288)
$ErrorActionPreference = 'Stop'

$ForkDir   = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$AppName   = 'Stokd Code'   # product.json win32DirName / nameLong
$ExeName   = 'Stokd.exe'    # product.json nameShort -> ExeBasename
$ProcName  = 'Stokd'        # process name (exe without extension)
$DryRun    = $env:STOKD_IDE_DEPLOY_DRY_RUN

$InstallDir = if ($env:STOKD_IDE_INSTALL_DIR) { $env:STOKD_IDE_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'Programs' }

# Resolve the gulp win32 task by arch.
$ProcArch = $env:PROCESSOR_ARCHITECTURE
switch ($ProcArch) {
	'AMD64' { $GulpArch = 'x64' }
	'ARM64' { $GulpArch = 'arm64' }
	default { Write-Error "unsupported arch '$ProcArch'"; exit 1 }
}
$GulpTask = "vscode-win32-$GulpArch"
if ($env:STOKD_IDE_MINIFY) { $GulpTask = "$GulpTask-min" }

$BundleDir = if ($env:STOKD_IDE_BUNDLE_DIR) { $env:STOKD_IDE_BUNDLE_DIR } else { Join-Path (Split-Path $ForkDir -Parent) "VSCode-win32-$GulpArch" }
$BundleExe = Join-Path $BundleDir $ExeName
$InstallApp = Join-Path $InstallDir $AppName

# 1. Build the unpackaged app.
if ($env:STOKD_IDE_SKIP_BUILD) {
	Write-Host "package: skip build (would run gulp $GulpTask)"
} else {
	# Invoke gulp directly rather than via `npm run gulp`: that npm script hardcodes
	# `--max-old-space-size=8192`, which overrides any heap set through NODE_OPTIONS and
	# OOMs the packaging step. A direct invocation lets our heap flag actually apply.
	$HeapMb = if ($env:STOKD_IDE_HEAP_MB) { $env:STOKD_IDE_HEAP_MB } else { '12288' }
	Write-Host "package: building gulp $GulpTask (heap ${HeapMb}MB) ..."
	Push-Location $ForkDir
	try {
		& node --experimental-strip-types "--max-old-space-size=$HeapMb" ./node_modules/gulp/bin/gulp.js $GulpTask
		if ($LASTEXITCODE -ne 0) { Write-Error "gulp $GulpTask failed (exit $LASTEXITCODE)"; exit 1 }
	} finally {
		Pop-Location
	}
}

# 2. Verify the bundle was produced.
if (-not (Test-Path -LiteralPath $BundleExe)) {
	Write-Error "expected build not found at $BundleExe"
	exit 1
}

# 3. Kill the running instance BEFORE swapping the bundle (avoids replacing an in-use app).
if ($DryRun) {
	Write-Host "dry-run: skip stop (would kill $ProcName)"
} else {
	Write-Host "stop: killing running $AppName ..."
	try { Stop-Process -Name $ProcName -Force -ErrorAction Stop } catch {}
	Start-Sleep -Seconds 1
}

# 4. Install: replace the bundle in the install dir.
Write-Host "install: $AppName -> $InstallDir ..."
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
if (Test-Path -LiteralPath $InstallApp) { Remove-Item -LiteralPath $InstallApp -Recurse -Force }
Copy-Item -LiteralPath $BundleDir -Destination $InstallApp -Recurse -Force

# 5. Relaunch from the installed location.
$InstalledExe = Join-Path $InstallApp $ExeName
if ($DryRun) {
	Write-Host "dry-run: skip launch (would open $InstalledExe)"
} else {
	Write-Host "launch: opening $AppName ..."
	Start-Process -FilePath $InstalledExe
}

Write-Host "done: installed $AppName to $InstallDir"
