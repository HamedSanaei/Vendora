param(
    [string]$OutputDirectory = "",
    [string]$ApiImage = "vendora-api-pdf-qa:local",
    [string]$ProbeImage = "vendora-pdf-smoke:local"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $repoRoot "artifacts/questpdf-community/linux" }
$outputPath = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $outputPath | Out-Null

# Build the exact production runtime locally. Never run compose, migrations, seeds or the API entrypoint.
docker build --file (Join-Path $repoRoot "deploy/docker/API.Dockerfile") --tag $ApiImage $repoRoot
if ($LASTEXITCODE -ne 0) { throw "Production API image build failed." }
docker build --file (Join-Path $repoRoot "deploy/docker/pdf-smoke.Dockerfile") --build-arg "API_IMAGE=$ApiImage" --tag $ProbeImage $repoRoot
if ($LASTEXITCODE -ne 0) { throw "PDF probe image build failed." }

# Only an output directory is mounted; the probe uses synthetic in-memory snapshots and no database configuration.
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --tmpfs /tmp:rw,noexec,nosuid,size=128m --mount "type=bind,source=$outputPath,target=/out" $ProbeImage
if ($LASTEXITCODE -ne 0) { throw "Offline PDF generation failed." }
Write-Output "PDF fixtures saved to $outputPath"
