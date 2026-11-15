[CmdletBinding()]
param(
    [string]$ProjectId = "chicago-business-intel-real",
    [string]$Region = "us-west1",
    [string]$Zone = "us-west1-b",
    [string]$InstanceName = "datacurrent-prod",
    [string]$MachineType = "e2-medium",
    [string]$EnvironmentFile = ".env.production.local"
)

$ErrorActionPreference = "Stop"
$deploymentDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryRoot = Resolve-Path (Join-Path $deploymentDirectory "..\..")
$environmentPath = Join-Path $deploymentDirectory $EnvironmentFile
$bootstrapPath = Join-Path $deploymentDirectory "bootstrap-gce.sh"
$gcloud = "C:\Users\jz\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"

if (-not (Test-Path -LiteralPath $gcloud)) {
    throw "Google Cloud CLI was not found at the expected installation path."
}
if (-not (Test-Path -LiteralPath $environmentPath)) {
    throw "Missing production environment file: $environmentPath"
}
if ((git -C $repositoryRoot status --porcelain)) {
    throw "The repository must be clean before deployment."
}

$addressName = "$InstanceName-ip"
$webFirewall = "$InstanceName-web"
$iapFirewall = "$InstanceName-iap-ssh"

& $gcloud services enable compute.googleapis.com --project $ProjectId

& $gcloud compute addresses describe $addressName --region $Region --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    & $gcloud compute addresses create $addressName --region $Region --project $ProjectId
}
$publicIp = (& $gcloud compute addresses describe $addressName --region $Region --project $ProjectId --format="value(address)").Trim()

& $gcloud compute firewall-rules describe $webFirewall --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    & $gcloud compute firewall-rules create $webFirewall --project $ProjectId --network default --allow tcp:80,tcp:443 --source-ranges 0.0.0.0/0 --target-tags datacurrent-web
}
& $gcloud compute firewall-rules describe $iapFirewall --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    & $gcloud compute firewall-rules create $iapFirewall --project $ProjectId --network default --allow tcp:22 --source-ranges 35.235.240.0/20 --target-tags datacurrent-iap
}

& $gcloud compute instances describe $InstanceName --zone $Zone --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    & $gcloud compute instances create $InstanceName `
        --project $ProjectId `
        --zone $Zone `
        --machine-type $MachineType `
        --address $publicIp `
        --image-family ubuntu-2404-lts-amd64 `
        --image-project ubuntu-os-cloud `
        --boot-disk-size 30GB `
        --boot-disk-type pd-balanced `
        --tags datacurrent-web,datacurrent-iap `
        --metadata-from-file "startup-script=$bootstrapPath"
}

& $gcloud compute instances add-metadata $InstanceName --zone $Zone --project $ProjectId --metadata "datacurrent-release=$(git -C $repositoryRoot rev-parse HEAD)"
& $gcloud compute scp --project $ProjectId --zone $Zone --tunnel-through-iap $environmentPath "${InstanceName}:/tmp/datacurrent.env"
& $gcloud compute ssh $InstanceName --project $ProjectId --zone $Zone --tunnel-through-iap --command "sudo install -m 600 /tmp/datacurrent.env /opt/datacurrent/infrastructure/deployment/.env.production.local && rm -f /tmp/datacurrent.env && sudo git -C /opt/datacurrent pull --ff-only origin main && cd /opt/datacurrent/infrastructure/deployment && sudo docker compose --env-file .env.production.local -f compose.prod.yml up -d --build"

[ordered]@{
    project = $ProjectId
    instance = $InstanceName
    zone = $Zone
    public_ip = $publicIp
    release = (git -C $repositoryRoot rev-parse HEAD)
} | ConvertTo-Json
