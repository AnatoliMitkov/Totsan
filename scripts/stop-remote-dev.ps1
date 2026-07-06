$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$stateFile = Join-Path $root "outputs\remote-dev\state.json"
$hostFile = Join-Path $root "outputs\remote-dev\current-host.txt"

if (-not (Test-Path $stateFile)) {
  if (Test-Path $hostFile) {
    Remove-Item $hostFile -Force -ErrorAction SilentlyContinue
  }
  Write-Host "No remote dev state file found."
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
if (Test-Path $hostFile) {
  Remove-Item $hostFile -Force -ErrorAction SilentlyContinue
}
Write-Host "Remote dev stopped."
