#Requires -Version 5.1
<#
.SYNOPSIS
  Builds and deploys CONTENT OS (backend + studio frontend) to one public Cloud Run service.

.DESCRIPTION
  Cloud Build builds the Dockerfile in this folder (no local Docker needed). The service runs as a
  dedicated service account, reads the YouTube API key from Secret Manager, and is configured for
  evaluation reliability: one always-warm instance with CPU always allocated so background video jobs
  keep running and every progress poll reaches the instance that holds the job.

.EXAMPLE
  .\deploy.ps1
  .\deploy.ps1 -Project my-project -Bucket gs://my-bucket/generated-videos -Region us-central1
#>
param(
    [string]$Project = "nexus-ai-builder-511215",
    [string]$Region = "us-east1",
    [string]$Service = "content-os",
    [string]$Bucket = "gs://nexus12/generated-videos",
    [int]$MaxVideoSeconds = 120,
    [int]$MaxConcurrentVideoJobs = 2,
    # Leave empty to read YOUTUBE_API_KEY from the local .env (it is only uploaded to Secret Manager).
    [string]$YouTubeApiKey = ""
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

# gcloud prints progress to stderr; with "Stop", Windows PowerShell would treat that as a failure.
# Judge success by the exit code instead.
function Invoke-Gcloud {
    $ErrorActionPreference = "Continue"
    & gcloud @args
    if ($LASTEXITCODE -ne 0) { throw "gcloud $($args -join ' ') failed (exit $LASTEXITCODE)" }
}

function Test-Gcloud {
    $ErrorActionPreference = "Continue"
    & gcloud @args *> $null
    return $LASTEXITCODE -eq 0
}

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    throw "gcloud CLI not found on PATH. Install the Google Cloud SDK or add its bin folder to PATH."
}

$runtimeAccountName = "content-os-runtime"
$runtimeAccount = "$runtimeAccountName@$Project.iam.gserviceaccount.com"
$bucketName = ($Bucket -replace '^gs://', '').Split('/')[0]
$secretName = "youtube-api-key"

Write-Host "==> Project $Project, region $Region, service $Service" -ForegroundColor Cyan
Invoke-Gcloud config set project $Project --quiet

Write-Host "==> Enabling required APIs" -ForegroundColor Cyan
Invoke-Gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com `
    aiplatform.googleapis.com texttospeech.googleapis.com storage.googleapis.com `
    youtube.googleapis.com secretmanager.googleapis.com --quiet

Write-Host "==> Runtime service account $runtimeAccount" -ForegroundColor Cyan
if (-not (Test-Gcloud iam service-accounts describe $runtimeAccount)) {
    Invoke-Gcloud iam service-accounts create $runtimeAccountName --display-name "CONTENT OS runtime"
    Start-Sleep -Seconds 10  # let the new account propagate before granting roles
}
foreach ($role in @("roles/aiplatform.user", "roles/serviceusage.serviceUsageConsumer")) {
    Invoke-Gcloud projects add-iam-policy-binding $Project --member "serviceAccount:$runtimeAccount" `
        --role $role --condition None --quiet *> $null
}
Invoke-Gcloud storage buckets add-iam-policy-binding "gs://$bucketName" --member "serviceAccount:$runtimeAccount" `
    --role roles/storage.objectAdmin --quiet *> $null

Write-Host "==> YouTube API key in Secret Manager ($secretName)" -ForegroundColor Cyan
if (-not $YouTubeApiKey -and (Test-Path .env)) {
    $line = Get-Content .env | Where-Object { $_ -match '^\s*YOUTUBE_API_KEY\s*=' } | Select-Object -First 1
    if ($line) { $YouTubeApiKey = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'") }
}
$secretExists = Test-Gcloud secrets describe $secretName
if (-not $secretExists) {
    Invoke-Gcloud secrets create $secretName --replication-policy automatic --quiet
}
if ($YouTubeApiKey) {
    $tmp = New-TemporaryFile
    try {
        [IO.File]::WriteAllText($tmp.FullName, $YouTubeApiKey)
        Invoke-Gcloud secrets versions add $secretName --data-file $tmp.FullName --quiet *> $null
    } finally {
        Remove-Item $tmp.FullName -Force
    }
} elseif (-not $secretExists) {
    throw "No YouTube API key found. Pass -YouTubeApiKey or set YOUTUBE_API_KEY in .env."
}
Invoke-Gcloud secrets add-iam-policy-binding $secretName --member "serviceAccount:$runtimeAccount" `
    --role roles/secretmanager.secretAccessor --quiet *> $null

Write-Host "==> Building with Cloud Build and deploying to Cloud Run (this takes several minutes)" -ForegroundColor Cyan
$envVars = @(
    "GOOGLE_CLOUD_PROJECT=$Project",
    "GOOGLE_CLOUD_LOCATION=global",
    "GEMINI_MODEL=gemini-2.5-flash",
    "VEO_MODEL=veo-3.1-generate-001",
    "GENERATED_VIDEOS_BUCKET=$Bucket",
    "MAX_VIDEO_SECONDS=$MaxVideoSeconds",
    "MAX_CONCURRENT_VIDEO_JOBS=$MaxConcurrentVideoJobs",
    "VEO_GENERATE_AUDIO=false"
) -join ","

Invoke-Gcloud run deploy $Service `
    --source . `
    --region $Region `
    --service-account $runtimeAccount `
    --allow-unauthenticated `
    --min-instances 1 `
    --max-instances 1 `
    --no-cpu-throttling `
    --cpu 2 `
    --memory 4Gi `
    --timeout 3600 `
    --concurrency 80 `
    --set-env-vars $envVars `
    --set-secrets "YOUTUBE_API_KEY=${secretName}:latest" `
    --quiet

$url = (& gcloud run services describe $Service --region $Region --format "value(status.url)" 2>$null | Out-String).Trim()
Write-Host "==> Deployed: $url" -ForegroundColor Green

Write-Host "==> Smoke test" -ForegroundColor Cyan
$health = Invoke-RestMethod "$url/health" -TimeoutSec 60
Write-Host ("    /health: {0} (project {1}, max video {2}s)" -f $health.status, $health.project, $health.max_video_seconds)
$page = Invoke-WebRequest "$url/" -UseBasicParsing -TimeoutSec 60
Write-Host ("    studio page: HTTP {0}" -f $page.StatusCode)
Write-Host "Open $url in a browser to use CONTENT OS." -ForegroundColor Green
