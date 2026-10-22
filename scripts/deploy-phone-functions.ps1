# Large functions/index.js can exceed Firebase CLI's 10s discovery limit on Windows.
$env:FUNCTIONS_DISCOVERY_TIMEOUT = "120"
Set-Location (Join-Path $PSScriptRoot "..")
npx firebase deploy --only functions:resolvePhoneAccess,functions:updateMyWelcomeProfile --project lmsironlady
