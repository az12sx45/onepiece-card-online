[CmdletBinding()]
param([switch]$Live)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$qaRoot = 'D:\Codex_QA\launcher-profile-r62\release'
$manifestPath = Join-Path $qaRoot 'signed-r62.json'
$manifestSha = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
$publisherArgs = @((Join-Path $repoRoot 'tools\desktop-r2-publisher\publish-launcher-content.js'), '--repo-root', $repoRoot, '--manifest', $manifestPath, '--json')
if (-not $Live) {
  $raw = & node @publisherArgs
  if ($LASTEXITCODE -ne 0) { throw 'Publisher dry run failed.' }
  $report = ($raw -join [Environment]::NewLine) | ConvertFrom-Json
  if (-not $report.ok -or [int]$report.revision -ne 62 -or $report.manifestSha256 -ne $manifestSha) { throw 'Unexpected dry-run identity.' }
  [IO.File]::WriteAllText((Join-Path $qaRoot 'publisher-dry-run.json'), ($report | ConvertTo-Json -Depth 10), [Text.UTF8Encoding]::new($false))
  $report | ConvertTo-Json -Compress
  exit 0
}
$reviewed = Get-Content -Raw -LiteralPath (Join-Path $qaRoot 'publisher-dry-run.json') | ConvertFrom-Json
if (-not $reviewed.ok -or $reviewed.mode -ne 'dry-run' -or $reviewed.manifestSha256 -ne $manifestSha) { throw 'Matching successful dry run required.' }
$credentialPath = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'ONEPIECE-Tabletop\publisher\r2-credentials.json'
$credential = Get-Content -Raw -LiteralPath $credentialPath | ConvertFrom-Json
if ([int]$credential.schema -ne 1 -or [string]$credential.provider -ne 'cloudflare-r2') { throw 'Unsupported R2 credential document.' }
function Unprotect-Value([string]$encrypted) {
  $secure = ConvertTo-SecureString -String $encrypted
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
$previous = @{ NODE_PATH = $env:NODE_PATH; R2_ACCOUNT_ID = $env:R2_ACCOUNT_ID; R2_BUCKET = $env:R2_BUCKET; R2_ACCESS_KEY_ID = $env:R2_ACCESS_KEY_ID; R2_SECRET_ACCESS_KEY = $env:R2_SECRET_ACCESS_KEY }
try {
  $env:NODE_PATH = 'D:\Codex_QA\launcher-aquarium-r14\publisher-deps\node_modules'
  $env:R2_ACCOUNT_ID = [string]$credential.accountId
  $env:R2_BUCKET = [string]$credential.bucket
  $env:R2_ACCESS_KEY_ID = Unprotect-Value ([string]$credential.accessKeyIdProtected)
  $env:R2_SECRET_ACCESS_KEY = Unprotect-Value ([string]$credential.secretAccessKeyProtected)
  $publisherArgs += @('--live', '--expected-manifest-sha256', $manifestSha)
  $raw = & node @publisherArgs
  if ($LASTEXITCODE -ne 0) { throw 'Content publisher failed.' }
  $report = ($raw -join [Environment]::NewLine) | ConvertFrom-Json
  if (-not $report.ok -or [int]$report.revision -ne 62 -or $report.manifestSha256 -ne $manifestSha) { throw 'Unexpected live publication identity.' }
  $report | Add-Member -NotePropertyName status -NotePropertyValue PASS
  [IO.File]::WriteAllText((Join-Path $qaRoot 'publication-report.json'), ($report | ConvertTo-Json -Depth 10), [Text.UTF8Encoding]::new($false))
  $report | ConvertTo-Json -Compress
} finally {
  foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
