param([string]$OutputDirectory = (Join-Path $PSScriptRoot "..\assets"))
$ErrorActionPreference = "Stop"
# The SVG is the only artwork source. Keep the legacy command as a thin wrapper.
& node (Join-Path $PSScriptRoot "generate-brand-assets.cjs") $OutputDirectory
if ($LASTEXITCODE -ne 0) { throw "CyberGrid icon generation failed." }
