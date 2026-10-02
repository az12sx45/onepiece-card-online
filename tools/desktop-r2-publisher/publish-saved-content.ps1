[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ManifestPath,
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedManifestSha256,
  [string]$RepoRoot = (Join-Path $PSScriptRoot '..\..')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$credentialPath = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'ONEPIECE-Tabletop\publisher\r2-credentials.json'
if (-not (Test-Path -LiteralPath $credentialPath -PathType Leaf)) { throw 'Saved R2 credentials were not found.' }
$credential = Get-Content -Raw -LiteralPath $credentialPath | ConvertFrom-Json
if ([int]$credential.schema -ne 1 -or [string]$credential.provider -ne 'cloudflare-r2') {
  throw 'Unsupported saved R2 credentials.'
}
$manifest = (Resolve-Path -LiteralPath $ManifestPath -ErrorAction Stop).Path
$source = (Resolve-Path -LiteralPath $RepoRoot -ErrorAction Stop).Path
$publisher = Join-Path $PSScriptRoot 'publish-launcher-content.js'

function Unprotect-String([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { throw 'Saved R2 credential field is missing.' }
  $secure = ConvertTo-SecureString -String $Value
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

$previous = @{
  R2_ACCOUNT_ID = $env:R2_ACCOUNT_ID
  R2_BUCKET = $env:R2_BUCKET
  R2_ACCESS_KEY_ID = $env:R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY = $env:R2_SECRET_ACCESS_KEY
}
try {
  $env:R2_ACCOUNT_ID = [string]$credential.accountId
  $env:R2_BUCKET = [string]$credential.bucket
  $env:R2_ACCESS_KEY_ID = Unprotect-String ([string]$credential.accessKeyIdProtected)
  $env:R2_SECRET_ACCESS_KEY = Unprotect-String ([string]$credential.secretAccessKeyProtected)
  & node $publisher --live --repo-root $source --manifest $manifest --expected-manifest-sha256 $ExpectedManifestSha256 --json
  if ($LASTEXITCODE -ne 0) { throw 'Content blob publishing failed.' }
} finally {
  foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
