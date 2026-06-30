<#
.SYNOPSIS
  Test zohoLeadWebhook — partial, full, or custom provisioning.

.EXAMPLE
  # Read secret from functions/.env (ZOHO_WEBHOOK_SECRET=...)
  .\scripts\test-zoho-webhook.ps1 -Scenario partial

.EXAMPLE
  .\scripts\test-zoho-webhook.ps1 -Scenario full -Email "mbw-full@test.ironlady.in"

.EXAMPLE
  .\scripts\test-zoho-webhook.ps1 -Scenario full -WebhookSecret "your-secret"
#>
param(
  [ValidateSet('partial', 'full', 'custom')]
  [string]$Scenario = 'partial',

  [string]$WebhookUrl = 'https://us-central1-lmsironlady.cloudfunctions.net/zohoLeadWebhook',
  [string]$WebhookSecret = '',
  [string]$Email = '',
  [string]$Password = 'TestPass123#xX',
  [string]$Program = 'Master of Business Warfare',
  [string]$FullName = '',
  [string]$Phone = '9999999999',
  [string]$Batch = '01/01/2026 - 30/06/2026'
)

$ErrorActionPreference = 'Stop'

function Get-WebhookSecretFromEnvFile {
  $envPath = Join-Path $PSScriptRoot '..\functions\.env'
  if (-not (Test-Path $envPath)) { return '' }
  foreach ($line in Get-Content $envPath) {
    if ($line -match '^\s*ZOHO_WEBHOOK_SECRET\s*=\s*(.+)\s*$') {
      return $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
  return ''
}

if (-not $WebhookSecret) {
  $WebhookSecret = $env:ZOHO_WEBHOOK_SECRET
}
if (-not $WebhookSecret) {
  $WebhookSecret = Get-WebhookSecretFromEnvFile
}
if (-not $WebhookSecret) {
  Write-Error 'Set -WebhookSecret or ZOHO_WEBHOOK_SECRET in functions/.env'
}

$timestamp = Get-Date -Format 'yyyyMMddHHmmss'

switch ($Scenario) {
  'partial' {
    if (-not $Email) { $Email = "mbw-partial-$timestamp@test.ironlady.in" }
    if (-not $FullName) { $FullName = 'MBW Partial Test' }
    $body = @{
      email          = $Email
      username       = $Email
      password       = $Password
      program        = $Program
      paymentstatus  = 'Completed'   # registration fee only → partial access
      fullname       = $FullName
      phone          = $Phone
      batch          = $Batch
    }
    Write-Host "Scenario: PARTIAL (registration fee) — expect paymentStatus=register, accessTier=registration" -ForegroundColor Cyan
  }
  'full' {
    if (-not $Email) { $Email = "mbw-full-$timestamp@test.ironlady.in" }
    if (-not $FullName) { $FullName = 'MBW Full Test' }
    $body = @{
      email                 = $Email
      username              = $Email
      password              = $Password
      program               = $Program
      MBWPaymentStatus      = 'Completed'   # full program paid → full access
      fullname              = $FullName
      phone                 = $Phone
      batch                 = $Batch
    }
    Write-Host "Scenario: FULL — expect paymentStatus=paid, accessTier=full" -ForegroundColor Cyan
  }
  'custom' {
    if (-not $Email) { $Email = "test@example.com" }
    if (-not $FullName) { $FullName = 'Test User' }
    $body = @{
      email                 = $Email
      username              = $Email
      password              = $Password
      program               = $Program
      programPaymentStatus  = 'Completed'
      MBWPaymentStatus      = 'Completed'
      fullname              = $FullName
      phone                 = $Phone
      batch                 = $Batch
      lmsUserId             = '123'
    }
    Write-Host "Scenario: CUSTOM (your original payload — full access)" -ForegroundColor Cyan
  }
}

$headers = @{
  'Content-Type'          = 'application/json'
  'x-zoho-webhook-secret' = $WebhookSecret
}

$jsonBody = $body | ConvertTo-Json -Depth 5

Write-Host ""
Write-Host "POST $WebhookUrl" -ForegroundColor DarkGray
Write-Host $jsonBody
Write-Host ""

try {
  $response = Invoke-RestMethod -Uri $WebhookUrl -Method POST -Headers $headers -Body $jsonBody
  Write-Host "SUCCESS" -ForegroundColor Green
  $response | ConvertTo-Json -Depth 6
  Write-Host ""
  Write-Host "Login check:" -ForegroundColor Yellow
  Write-Host "  Email:    $($body.email)"
  Write-Host "  Password: $($body.password)"
  if ($response.paymentStatus) {
    Write-Host "  paymentStatus: $($response.paymentStatus)"
  }
  if ($response.accessTier) {
    Write-Host "  accessTier:    $($response.accessTier)"
  }
  if ($response.program) {
    Write-Host "  program:       $($response.program)"
  }
}
catch {
  Write-Host "FAILED" -ForegroundColor Red
  if ($_.Exception.Response) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $errBody = $reader.ReadToEnd()
    Write-Host $errBody
  }
  else {
    Write-Host $_.Exception.Message
  }
  exit 1
}
