param(
  [string]$OutputRoot = "dist"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PackageName = "void-ledger-portable"
$OutputDirectory = Join-Path $ProjectRoot $OutputRoot
$PackageDirectory = Join-Path $OutputDirectory $PackageName
$ZipPath = Join-Path $OutputDirectory "$PackageName.zip"

Set-Location $ProjectRoot
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$ResolvedProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$ResolvedOutputDirectory = (Resolve-Path -LiteralPath $OutputDirectory).Path

if (-not $ResolvedOutputDirectory.StartsWith($ResolvedProjectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  Write-Host "Refusing to package outside the project root: $ResolvedOutputDirectory" -ForegroundColor Red
  exit 1
}

if (Test-Path $PackageDirectory) {
  Remove-Item -LiteralPath $PackageDirectory -Recurse -Force
}
if (Test-Path $ZipPath) {
  Remove-Item -LiteralPath $ZipPath -Force
}

$excludeDirectories = @(
  ".claw",
  ".git",
  ".next",
  ".playwright-mcp",
  ".superpowers",
  ".void-ledger",
  "coverage",
  "dist",
  "node_modules"
)
$excludeFiles = @(
  ".env",
  ".env.local",
  ".env.production",
  "next-env.d.ts",
  "*.tsbuildinfo",
  "*.log"
)

Write-Host "Creating portable package in $PackageDirectory"

New-Item -ItemType Directory -Force -Path $PackageDirectory | Out-Null

Get-ChildItem -LiteralPath $ProjectRoot -Force | ForEach-Object {
  $name = $_.Name
  if ($_.PSIsContainer -and $excludeDirectories -contains $name) {
    return
  }
  foreach ($pattern in $excludeFiles) {
    if ($name -like $pattern) {
      return
    }
  }

  $destination = Join-Path $PackageDirectory $name
  Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse -Force
}

Compress-Archive -LiteralPath $PackageDirectory -DestinationPath $ZipPath -Force

Write-Host ""
Write-Host "Portable package created:" -ForegroundColor Green
Write-Host "  $ZipPath"
Write-Host ""
Write-Host "A user should unzip it, run scripts\setup-windows.ps1, then scripts\start-windows.ps1."
