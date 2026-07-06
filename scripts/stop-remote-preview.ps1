$root = Split-Path -Parent $PSScriptRoot
$stateFile = Join-Path $root "outputs\remote-preview\state.json"

$ErrorActionPreference = "Stop"

if (-not (Test-Path $stateFile)) {
  Write-Host "No remote preview state file found."
  exit 0
}

$state = Get-Content $stateFile | ConvertFrom-Json

foreach ($processId in @($state.tunnelPid, $state.vitePid)) {
  if ($processId) {
    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
    } catch {
    }
  }
}

Remove-Item $stateFile -Force
Write-Host "Remote preview stopped."
