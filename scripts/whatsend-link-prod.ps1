<#
.SYNOPSIS
  Links the venue's WhatsApp number to the production worker (wesal-worker on Fly).

.DESCRIPTION
  Opens a private tunnel to the worker, shows the QR code, and waits for the scan.
  Needs the values saved in C:\Users\zaydo\whatsapp-data\production.json (ADR-031).
  Scan with the venue's number: WhatsApp > Linked devices > Link a device.
  A new QR appears automatically every 45 seconds. Run it again any time to
  check the link; if the number is already linked it just says so.
#>
[CmdletBinding()]
param(
  [string]$ValuesFile = "C:\Users\zaydo\whatsapp-data\production.json",
  [int]$LocalPort = 3002
)

$ErrorActionPreference = "Stop"
$v = Get-Content $ValuesFile -Raw | ConvertFrom-Json
$headers = @{ Authorization = "Bearer $($v.secret)" }
$base = "http://127.0.0.1:$LocalPort"
$session = "$base/api/v1/sessions/$($v.sessionId)"

$proxy = Start-Process fly -ArgumentList "proxy", "${LocalPort}:3001", "-a", "wesal-worker" -PassThru -WindowStyle Hidden
try {
  for ($i = 0; $i -lt 20; $i++) {
    try { Invoke-RestMethod -Headers $headers "$base/health" -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep 1 }
  }
  $status = (Invoke-RestMethod -Headers $headers "$session/status").data
  if ($status.state -ne "connected") {
    Invoke-RestMethod -Method Post -Headers $headers "$session/connect" | Out-Null
    Write-Host "Scan the QR code with the venue's number (WhatsApp > Linked devices > Link a device)."
    $deadline = (Get-Date).AddMinutes(5)
    $shownFor = $null
    while ((Get-Date) -lt $deadline) {
      $status = (Invoke-RestMethod -Headers $headers "$session/status").data
      if ($status.state -eq "connected") { break }
      try {
        $qr = (Invoke-RestMethod -Headers $headers "$session/qr").data
        if ($qr.expires_at -ne $shownFor) {
          $png = Join-Path $env:TEMP "wesal-prod-qr.png"
          [IO.File]::WriteAllBytes($png, [Convert]::FromBase64String($qr.png_base64))
          Start-Process $png
          $shownFor = $qr.expires_at
          Write-Host "QR code shown (valid about 45 seconds; a new one appears automatically)."
        }
      } catch { }
      Start-Sleep 2
    }
    if ($status.state -ne "connected") { throw "Not linked within 5 minutes. Run the script again." }
  }
  $who = if ($status.phone) { "+$($status.phone)" } else { "the venue number" }
  Write-Host "Production WhatsApp is connected as $who."
} finally {
  if ($proxy -and -not $proxy.HasExited) { Stop-Process -Id $proxy.Id -Force }
}
