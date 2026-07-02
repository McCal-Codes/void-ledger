param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

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

Set-Location $ProjectRoot

$nodePath = Get-CommandPath "node"
$npmPath = Get-CommandPath "npm.cmd"
if (-not $npmPath) {
  $npmPath = Get-CommandPath "npm"
}

if (-not $nodePath) {
  Fail "Node.js was not found. Install Node.js 20 or newer, then run scripts\setup-windows.ps1 again."
}

if (-not $npmPath) {
  Fail "npm was not found. Reinstall Node.js with npm enabled, then run scripts\setup-windows.ps1 again."
}

$nodeVersionText = & $nodePath --version
$nodeMajor = [int]($nodeVersionText.TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 20) {
  Fail "Void Ledger needs Node.js 20 or newer. Found $nodeVersionText."
}

Write-Host "Void Ledger setup" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"
Write-Host "Node: $nodeVersionText"
Write-Host ""

Write-Host "Installing dependencies..."
& $npmPath install
if ($LASTEXITCODE -ne 0) {
  Fail "npm install failed."
}

if (-not $SkipBuild) {
  Write-Host ""
  Write-Host "Building the local app..."
  & $npmPath run build
  if ($LASTEXITCODE -ne 0) {
    Fail "npm run build failed."
  }
}

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "Start Void Ledger with:"
Write-Host "  scripts\start-windows.ps1"
