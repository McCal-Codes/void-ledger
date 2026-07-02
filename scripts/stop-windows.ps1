$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$DataDir = Join-Path $ProjectRoot ".void-ledger"
$PidPath = Join-Path $DataDir "void-ledger-server.pid"

if (-not (Test-Path -LiteralPath $PidPath)) {
  Write-Host "No Void Ledger PID file was found at $PidPath"
  Write-Host "If the app is still running, close the terminal or process that started it."
  exit 0
}

$rawPid = (Get-Content -LiteralPath $PidPath -Raw).Trim()
$serverPid = 0

if (-not [int]::TryParse($rawPid, [ref]$serverPid) -or $serverPid -le 0) {
  Remove-Item -LiteralPath $PidPath -Force
  Write-Host "Removed invalid PID file: $PidPath"
  exit 0
}

$process = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
if ($null -eq $process) {
  Remove-Item -LiteralPath $PidPath -Force
  Write-Host "Void Ledger process $serverPid was not running. Removed stale PID file."
  exit 0
}

Write-Host "Stopping Void Ledger process tree $serverPid..."
& taskkill.exe /PID $serverPid /T /F | Out-Host

if ($LASTEXITCODE -eq 0) {
  Remove-Item -LiteralPath $PidPath -Force
  Write-Host "Void Ledger stopped." -ForegroundColor Green
} else {
  Write-Host "taskkill failed for PID $serverPid. PID file left in place: $PidPath" -ForegroundColor Red
  exit $LASTEXITCODE
}
