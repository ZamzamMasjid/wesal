<#
.SYNOPSIS
  Starts the WhatSend WhatsApp worker for local development and links your phone.

.DESCRIPTION
  One command does everything (ADR-031):
    1. Creates the worker's secret, storage key and session id the first time and
       keeps them in a private folder (never in git). Later runs reuse them, so the
       linked WhatsApp session survives restarts.
    2. Writes the matching MESSAGING_PROVIDER / WHATSEND_* lines into Wesal's
       .env.local, so Wesal and the worker always agree.
    3. Installs the worker's packages if needed, starts it, and waits until it answers.
    4. If the phone is not linked yet, shows the QR code and waits for the scan.
    5. Optionally sends a test message.
  Leave the window open; Ctrl+C stops the worker.

.EXAMPLE
  .\scripts\whatsend-dev.ps1
  .\scripts\whatsend-dev.ps1 -TestTo +201001234567
#>
[CmdletBinding()]
param(
  # The WhatSend project's worker folder.
  [string]$WorkerDir = "C:\Users\zaydo\Projects\whatsend\whatsapp-worker",
  # Where the generated values and the encrypted WhatsApp session are kept.
  [string]$DataDir = "C:\Users\zaydo\whatsapp-data",
  # Wesal's local env file, updated with the worker settings.
  [string]$EnvFile = (Join-Path $PSScriptRoot "..\.env.local"),
  [int]$Port = 3001,
  # Send a "test from wesal" message to this number (international format).
  [string]$TestTo
)

$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:$Port"

function New-SecureHex {
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  -join ($bytes | ForEach-Object { "{0:x2}" -f $_ })
}

# --- 1. Values: generated once, then reused --------------------------------
New-Item -ItemType Directory -Force $DataDir | Out-Null
$stateFile = Join-Path $DataDir "worker.json"
if (Test-Path $stateFile) {
  $state = Get-Content $stateFile -Raw | ConvertFrom-Json
} else {
  $state = [pscustomobject]@{
    secret     = New-SecureHex
    storageKey = New-SecureHex
    sessionId  = [guid]::NewGuid().ToString()
  }
  $state | ConvertTo-Json | Set-Content $stateFile -Encoding utf8
  Write-Host "Generated new worker values in $stateFile (keep this file: it holds the key to your linked session)."
}

# --- 2. Keep Wesal's .env.local in step ------------------------------------
$wanted = [ordered]@{
  MESSAGING_PROVIDER     = "whatsend"
  WHATSEND_WORKER_URL    = $base
  WHATSEND_WORKER_SECRET = $state.secret
  WHATSEND_SESSION_ID    = $state.sessionId
}
$lines = if (Test-Path $EnvFile) { @(Get-Content $EnvFile) } else { @() }
foreach ($key in $wanted.Keys) {
  $line = "$key=$($wanted[$key])"
  $index = -1
  for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match "^$key=") { $index = $i; break } }
  if ($index -ge 0) { $lines[$index] = $line } else { $lines += $line }
}
Set-Content $EnvFile $lines -Encoding utf8
Write-Host "Updated $EnvFile (MESSAGING_PROVIDER, WHATSEND_*)."

# --- 3. Start the worker ----------------------------------------------------
$headers = @{ Authorization = "Bearer $($state.secret)" }
$session = "$base/api/v1/sessions/$($state.sessionId)"

function Test-Worker {
  try { Invoke-RestMethod -Headers $headers "$base/health" -TimeoutSec 2 | Out-Null; $true } catch { $false }
}

$process = $null
if (Test-Worker) {
  Write-Host "A worker is already answering on port $Port; using it."
} else {
  if (-not (Test-Path (Join-Path $WorkerDir "node_modules"))) {
    Write-Host "Installing worker packages (npm ci)..."
    Push-Location $WorkerDir; npm ci; Pop-Location
  }
  $env:WHATSAPP_WORKER_SECRET = $state.secret
  $env:WHATSAPP_STORAGE_KEY   = $state.storageKey
  $env:WHATSAPP_DATA_DIR      = Join-Path $DataDir "sessions"
  $env:WHATSAPP_WORKER_PORT   = "$Port"
  $log = Join-Path $DataDir "worker.log"
  $process = Start-Process node -ArgumentList "server.mjs" -WorkingDirectory $WorkerDir `
    -PassThru -NoNewWindow -RedirectStandardOutput $log -RedirectStandardError "$log.err"
  for ($i = 0; $i -lt 30 -and -not (Test-Worker); $i++) { Start-Sleep 1 }
  if (-not (Test-Worker)) { throw "The worker did not start. See $log and $log.err" }
  Write-Host "Worker started (log: $log)."
}

try {
  # --- 4. Link the phone if needed -----------------------------------------
  $status = (Invoke-RestMethod -Headers $headers "$session/status").data
  if ($status.state -ne "connected") {
    Invoke-RestMethod -Method Post -Headers $headers "$session/connect" | Out-Null
    Write-Host "Scan the QR code: WhatsApp > Linked devices > Link a device. Use the venue number, not your personal one."
    $deadline = (Get-Date).AddMinutes(5)
    $shownFor = $null
    while ((Get-Date) -lt $deadline) {
      $status = (Invoke-RestMethod -Headers $headers "$session/status").data
      if ($status.state -eq "connected") { break }
      try {
        $qr = (Invoke-RestMethod -Headers $headers "$session/qr").data
        if ($qr.expires_at -ne $shownFor) {
          $png = Join-Path $env:TEMP "whatsend-qr.png"
          [IO.File]::WriteAllBytes($png, [Convert]::FromBase64String($qr.png_base64))
          Start-Process $png
          $shownFor = $qr.expires_at
          Write-Host "QR code shown (valid about 45 seconds; a new one appears automatically)."
        }
      } catch { }  # not ready yet; try again
      Start-Sleep 2
    }
    if ($status.state -ne "connected") { throw "The phone was not linked within 5 minutes. Run the script again." }
  }
  $who = if ($status.phone) { "+$($status.phone)" } else { "the linked number" }
  Write-Host "WhatsApp is connected as $who."

  # --- 5. Optional test message --------------------------------------------
  if ($TestTo) {
    $body = @{ recipient = $TestTo; text = "test from wesal" } | ConvertTo-Json
    $send = Invoke-RestMethod -Method Post -Uri "$session/messages" -ContentType "application/json" `
      -Headers ($headers + @{ "Idempotency-Key" = [guid]::NewGuid().ToString() }) -Body $body
    Start-Sleep 3
    $result = (Invoke-RestMethod -Headers $headers "$session/messages/$($send.data.id)").data
    Write-Host "Test message to ${TestTo}: $($result.status) $($result.error)"
  }

  Write-Host "Ready. Wesal can now send WhatsApp messages. Leave this window open; press Ctrl+C to stop the worker."
  if ($process) { $process.WaitForExit() } else { while ($true) { Start-Sleep 60 } }
} finally {
  if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force }
}

