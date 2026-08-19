$ErrorActionPreference = "Stop"

$packRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$worldSource = Join-Path $packRoot "3d-world-source"
$worldBuild = Join-Path $worldSource "dist"
$worldTarget = Join-Path $packRoot "world"
$targetAssets = Join-Path $worldTarget "assets"

Push-Location $worldSource
try {
  if (-not (Test-Path -LiteralPath (Join-Path $worldSource "node_modules"))) {
    npm.cmd install
  }
  npm.cmd run build
} finally {
  Pop-Location
}

if (-not (Test-Path -LiteralPath (Join-Path $worldBuild "index.html"))) {
  throw "The 3D production build was not created."
}

New-Item -ItemType Directory -Path $targetAssets -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $worldBuild "index.html") -Destination (Join-Path $worldTarget "index.html") -Force
Copy-Item -Path (Join-Path $worldBuild "assets\*") -Destination $targetAssets -Recurse -Force

Write-Host "3D world rebuilt and synced into the invitation's world folder."

