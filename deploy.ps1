$ErrorActionPreference = "Stop"

$ServerUser = "root"
$ServerHost = "192.168.1.210"
$ServerPort = 22
$RemoteAppDir = "/opt/test-report"
$RemoteReleaseFile = "/tmp/test-report-release.tar.gz"
$ReleaseFile = Join-Path $env:TEMP "test-report-release.tar.gz"

$IncludePaths = @(
  "app.js",
  "index.html",
  "styles.css",
  "server.js",
  "package.json",
  "package-lock.json",
  "README.md",
  "LICENSE",
  ".env.example",
  "app-state.json",
  "team-members.json",
  "tmp"
)

if (Test-Path $ReleaseFile) {
  Remove-Item $ReleaseFile -Force
}

Write-Host "Building release archive..."
tar.exe -czf $ReleaseFile @IncludePaths

Write-Host "Uploading release package to $ServerHost..."
scp -P $ServerPort $ReleaseFile "${ServerUser}@${ServerHost}:${RemoteReleaseFile}"

$RemoteScript = @"
set -e
mkdir -p '$RemoteAppDir'

if [ -f '$RemoteAppDir/.env' ]; then
  cp '$RemoteAppDir/.env' '/tmp/test-report.env.backup'
fi

tar -xzf '$RemoteReleaseFile' -C '$RemoteAppDir'

if [ -f '/tmp/test-report.env.backup' ]; then
  mv '/tmp/test-report.env.backup' '$RemoteAppDir/.env'
fi

cd '$RemoteAppDir'

npm install --omit=dev

if [ ! -d '.venv' ]; then
  python3 -m venv .venv
fi

'$RemoteAppDir/.venv/bin/pip' install python-docx >/dev/null

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

rm -f '$RemoteReleaseFile'

echo 'Deploy finished.'
pm2 status test-report
"@

Write-Host "Deploying and restarting service..."
ssh -p $ServerPort "${ServerUser}@${ServerHost}" $RemoteScript

Write-Host ""
Write-Host "Done. Open: http://${ServerHost}:4173"
