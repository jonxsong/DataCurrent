[CmdletBinding()]
param(
    [string]$Domain = "datacurrent.jonzhang.dev"
)

$ErrorActionPreference = "Stop"
$origin = "https://$Domain"
$landing = Invoke-WebRequest -Uri "$origin/" -UseBasicParsing
$health = Invoke-RestMethod -Uri "$origin/api/v1/healthz"
$ready = Invoke-RestMethod -Uri "$origin/api/v1/readyz"
$auth = Invoke-RestMethod -Uri "$origin/api/v1/auth/config"

if ($landing.StatusCode -ne 200) { throw "Landing page returned $($landing.StatusCode)." }
if ($health.status -ne "ok") { throw "API liveness failed." }
if ($ready.status -ne "ready") { throw "API readiness failed." }
if ($auth.registration_enabled) { throw "Public registration must be disabled after bootstrap." }
if ($landing.Headers["Strict-Transport-Security"] -notmatch "max-age=31536000") {
    throw "HSTS is missing from the public origin."
}

[ordered]@{
    origin = $origin
    landing = [int]$landing.StatusCode
    api = $health.status
    readiness = $ready.status
    registration_enabled = [bool]$auth.registration_enabled
    hsts = $true
} | ConvertTo-Json
