[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$FilePath,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$')]
  [string]$Version,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[A-Fa-f0-9]{64}$')]
  [string]$ExpectedSha256,

  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 268435456)]
  [long]$ExpectedBytes,

  [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$credentialPath = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'ONEPIECE-Tabletop\publisher\r2-credentials.json'
$publisherPath = Join-Path $PSScriptRoot 'publish-launcher-artifact.js'
$resolvedFile = (Resolve-Path -LiteralPath $FilePath -ErrorAction Stop).Path

if (-not (Test-Path -LiteralPath $credentialPath -PathType Leaf)) {
  throw "Encrypted R2 credentials were not found at $credentialPath"
}
if ([IO.Path]::GetExtension($resolvedFile) -ine '.exe') {
  throw 'Launcher artifact must be an .exe file.'
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

  $arguments = @(
    $publisherPath,
    '--live',
    '--file', $resolvedFile,
    '--version', $Version,
    '--expected-sha256', $ExpectedSha256.ToLowerInvariant(),
    '--expected-bytes', [string]$ExpectedBytes
  )
  if ($Json) { $arguments += '--json' }
  & node @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "R2 launcher publisher exited with code $LASTEXITCODE."
  }
} finally {
  foreach ($name in $previous.Keys) {
    [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process')
  }
}
