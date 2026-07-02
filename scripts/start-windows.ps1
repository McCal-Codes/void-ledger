param(
  [int]$Port = 3000,
  [string]$HostName = "127.0.0.1",
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$DataDir = Join-Path $ProjectRoot ".void-ledger"
$LogDir = Join-Path $DataDir "logs"
$PidPath = Join-Path $DataDir "void-ledger-server.pid"
$StdOutLog = Join-Path $LogDir "next-start.stdout.log"
$StdErrLog = Join-Path $LogDir "next-start.stderr.log"
$AppUrl = "http://${HostName}:${Port}"

function Fail($Message) {
  Write-Host ""
  Write-Host $Message -ForegroundColor Red
  exit 1
}

function Get-CommandPath($Name) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($null -eq $command) {
    return $null
  }
  return $command.Source
}

function Test-AppReady($Url) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500 -and $response.Content -like "*Void Ledger*"
  } catch {
    return $false
  }
}

function Get-ListeningProcessId($Port) {
  try {
    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
      Select-Object -First 1

    if ($null -ne $connection -and $connection.OwningProcess -gt 0) {
      return $connection.OwningProcess
    }
  } catch {
    return $null
  }

  return $null
}

Set-Location $ProjectRoot

$npmPath = Get-CommandPath "npm.cmd"
if (-not $npmPath) {
  $npmPath = Get-CommandPath "npm"
}

if (-not $npmPath) {
  Fail "npm was not found. Run scripts\setup-windows.ps1 after installing Node.js 20 or newer."
}

if (-not (Test-Path (Join-Path $ProjectRoot "node_modules"))) {
  Fail "Dependencies are missing. Run scripts\setup-windows.ps1 first."
}

if (-not (Test-Path (Join-Path $ProjectRoot ".next\BUILD_ID"))) {
  Write-Host "No production build found. Building before start..."
  & $npmPath run build
  if ($LASTEXITCODE -ne 0) {
    Fail "npm run build failed."
  }
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

if (-not (Test-AppReady $AppUrl)) {
  Write-Host "Starting Void Ledger at $AppUrl"
  $arguments = @("run", "start", "--", "-H", $HostName, "-p", [string]$Port)
  $process = Start-Process `
    -FilePath $npmPath `
    -ArgumentList $arguments `
    -WorkingDirectory $ProjectRoot `
    -RedirectStandardOutput $StdOutLog `
    -RedirectStandardError $StdErrLog `
    -WindowStyle Hidden `
    -PassThru

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Seconds 1
    if ($process.HasExited) {
      Fail "Void Ledger stopped during startup. Check $StdErrLog."
    }
    if (Test-AppReady $AppUrl) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    Fail "Void Ledger did not respond at $AppUrl. Check $StdOutLog and $StdErrLog."
  }

  Set-Content -LiteralPath $PidPath -Value $process.Id -Encoding ASCII
} else {
  Write-Host "Void Ledger is already responding at $AppUrl"
  $existingPid = Get-ListeningProcessId $Port
  if ($existingPid) {
    Set-Content -LiteralPath $PidPath -Value $existingPid -Encoding ASCII
  }
}

if (-not $NoBrowser) {
  Start-Process $AppUrl
}

Write-Host ""
Write-Host "Void Ledger is running: $AppUrl" -ForegroundColor Green
Write-Host "Logs:"
Write-Host "  $StdOutLog"
Write-Host "  $StdErrLog"
Write-Host "Stop with:"
Write-Host "  scripts\stop-windows.ps1"
