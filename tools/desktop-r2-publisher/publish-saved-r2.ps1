[CmdletBinding()]
param(
  [ValidateRange(1, 16)]
  [int]$Concurrency = 3,

  [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$credentialPath = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'ONEPIECE-Tabletop\publisher\r2-credentials.json'
$publisherPath = Join-Path $PSScriptRoot 'publish.js'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path

if (-not (Test-Path -LiteralPath $credentialPath -PathType Leaf)) {
  throw "Encrypted R2 credentials were not found at $credentialPath"
}

$credential = Get-Content -Raw -LiteralPath $credentialPath | ConvertFrom-Json
if ([int]$credential.schema -ne 1 -or [string]$credential.provider -ne 'cloudflare-r2') {
  throw 'The encrypted R2 credential document is not supported.'
}

function Convert-ProtectedStringToPlainText([string]$ProtectedValue) {
  if ([string]::IsNullOrWhiteSpace($ProtectedValue)) {
    throw 'The encrypted R2 credential document is incomplete.'
  }
  $secure = ConvertTo-SecureString -String $ProtectedValue
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
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
  $env:R2_ACCESS_KEY_ID = Convert-ProtectedStringToPlainText ([string]$credential.accessKeyIdProtected)
  $env:R2_SECRET_ACCESS_KEY = Convert-ProtectedStringToPlainText ([string]$credential.secretAccessKeyProtected)

  $arguments = @($publisherPath, '--live', '--repo-root', $repoRoot, '--concurrency', [string]$Concurrency)
  if ($Json) { $arguments += '--json' }
  & node @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "R2 publisher exited with code $LASTEXITCODE."
  }
} finally {
  foreach ($name in $previous.Keys) {
    [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process')
  }
}
