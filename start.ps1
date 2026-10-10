#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Start the Stride To-Do List app (Next.js).

.DESCRIPTION
    Convenience launcher. Checks prerequisites, installs dependencies on first run,
    then starts the Next.js dev server (default) or a production build.

.PARAMETER Prod
    Build and run the optimized production server instead of the dev server.

.PARAMETER Port
    Port to serve on. Defaults to 3000.

.PARAMETER NoInstall
    Skip the automatic `npm install` step.

.EXAMPLE
    ./start.ps1
    ./start.ps1 -Port 4000
    ./start.ps1 -Prod
#>
[CmdletBinding()]
param(
    [switch]$Prod,
    [int]$Port = 3000,
    [switch]$NoInstall
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Write-Step { param([string]$Message) Write-Host "> $Message" -ForegroundColor Cyan }
function Write-Err  { param([string]$Message) Write-Host "x $Message" -ForegroundColor Red }

Write-Host "Stride - Focused task manager" -ForegroundColor Magenta
Write-Host ("-" * 40)

# --- Prerequisites -----------------------------------------------------------
$node = Get-Command node -ErrorAction SilentlyContinue
$npm  = Get-Command npm  -ErrorAction SilentlyContinue
if (-not $node) { Write-Err "Node.js not found. Install Node 18+ from https://nodejs.org"; exit 1 }
if (-not $npm)  { Write-Err "npm not found (expected alongside Node.js)."; exit 1 }
Write-Step "Node $(node -v) / npm $(npm -v)"

# --- Dependencies ------------------------------------------------------------
if ((-not (Test-Path -LiteralPath 'node_modules')) -and (-not $NoInstall)) {
    Write-Step "First run detected - installing dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) { Write-Err "npm install failed."; exit $LASTEXITCODE }
}

if (-not (Test-Path -LiteralPath 'node_modules')) {
    Write-Err "Dependencies are not installed. Run 'npm install' or drop -NoInstall."
    exit 1
}

# --- Run ---------------------------------------------------------------------
$url = "http://localhost:$Port"

if ($Prod) {
    Write-Step "Building for production..."
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Err "Build failed."; exit $LASTEXITCODE }
    Write-Step "Starting production server at $url (Ctrl+C to stop)"
    npm run start -- -p $Port
} else {
    Write-Step "Starting dev server at $url (Ctrl+C to stop)"
    npm run dev -- -p $Port
}
