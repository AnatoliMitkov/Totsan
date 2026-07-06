param(
  [int]$Port = 4173,
  [string]$LocalHost = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $root "outputs\remote-preview"
$viteLog = Join-Path $stateDir "vite-preview.log"
$tunnelLog = Join-Path $stateDir "localtunnel.log"
$stateFile = Join-Path $stateDir "state.json"
$urlFile = Join-Path $stateDir "public-url.txt"

New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

if (Test-Path $stateFile) {
  Write-Host "Existing remote preview state found. Stop it first with scripts/stop-remote-preview.ps1."
  exit 1
}

Push-Location $root
try {
  npm run build | Out-Host

  $viteArgs = @(
    "/c",
    "npm run preview -- --host 0.0.0.0 --port $Port 1>> `"$viteLog`" 2>&1"
  )

  $viteProcess = Start-Process -FilePath "cmd.exe" -ArgumentList $viteArgs -PassThru -WindowStyle Hidden

  $portReady = $false
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
      $connection = Test-NetConnection -ComputerName $LocalHost -Port $Port -WarningAction SilentlyContinue
      if ($connection.TcpTestSucceeded) {
        $portReady = $true
        break
      }
    } catch {
    }
  }

  if (-not $portReady) {
    Stop-Process -Id $viteProcess.Id -Force -ErrorAction SilentlyContinue
    throw "Vite preview did not start on port $Port."
  }

  $tunnelArgs = @(
    "/c",
    "npx localtunnel --port $Port --local-host $LocalHost 1>> `"$tunnelLog`" 2>&1"
  )

  $tunnelProcess = Start-Process -FilePath "cmd.exe" -ArgumentList $tunnelArgs -PassThru -WindowStyle Hidden

  $publicUrl = $null
  for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $tunnelLog) {
      $match = Select-String -Path $tunnelLog -Pattern "your url is:\s+(https://\S+)" | Select-Object -Last 1
      if ($match) {
        $publicUrl = $match.Matches[0].Groups[1].Value
        break
      }
    }
  }

  if (-not $publicUrl) {
    Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $viteProcess.Id -Force -ErrorAction SilentlyContinue
    throw "Localtunnel did not return a public URL."
  }

  $state = @{
    startedAt = (Get-Date).ToString("o")
    port = $Port
    localHost = $LocalHost
    vitePid = $viteProcess.Id
    tunnelPid = $tunnelProcess.Id
    publicUrl = $publicUrl
    viteLog = $viteLog
    tunnelLog = $tunnelLog
  }

  $state | ConvertTo-Json | Set-Content -Path $stateFile
  $publicUrl | Set-Content -Path $urlFile

  Write-Host ""
  Write-Host "Remote preview is running."
  Write-Host "Public URL: $publicUrl"
  Write-Host "State file: $stateFile"
} finally {
  Pop-Location
}
