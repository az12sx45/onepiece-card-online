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
  [ValidateScript({
    $parsed = 0L
    if ($_ -notmatch '^[1-9][0-9]*$' -or
        -not [long]::TryParse($_, [ref]$parsed) -or
        $parsed -gt 9007199254740991L) {
      throw 'ExpectedBytes must be a positive safe integer.'
    }
    $true
  })]
  [string]$ExpectedBytes,

  [string]$BlockmapPath,

  [ValidatePattern('^[A-Fa-f0-9]{64}$')]
  [string]$ExpectedBlockmapSha256,

  [string]$ExpectedBlockmapBytes,

  [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$credentialPath = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'ONEPIECE-Tabletop\publisher\r2-credentials.json'
$publisherPath = Join-Path $PSScriptRoot 'publish-launcher-artifact.js'
$blockmapPublisherPath = Join-Path $PSScriptRoot 'publish-launcher-blockmap.js'
$resolvedFile = (Resolve-Path -LiteralPath $FilePath -ErrorAction Stop).Path
$withBlockmap = [bool]$BlockmapPath -or [bool]$ExpectedBlockmapSha256 -or [bool]$ExpectedBlockmapBytes
if ($withBlockmap -and (-not $BlockmapPath -or -not $ExpectedBlockmapSha256 -or -not $ExpectedBlockmapBytes)) {
  throw 'BlockmapPath, ExpectedBlockmapSha256 and ExpectedBlockmapBytes must be supplied together.'
}
$resolvedBlockmap = if ($withBlockmap) { (Resolve-Path -LiteralPath $BlockmapPath -ErrorAction Stop).Path } else { $null }
if ($withBlockmap) {
  $parsedBlockmapBytes = 0L
  if ($ExpectedBlockmapBytes -notmatch '^[1-9][0-9]*$' -or
      -not [long]::TryParse($ExpectedBlockmapBytes, [ref]$parsedBlockmapBytes) -or
      $parsedBlockmapBytes -gt 2097152L) {
    throw 'ExpectedBlockmapBytes must be between 1 and 2097152.'
  }
}

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
    '--expected-bytes', $ExpectedBytes
  )
  if ($Json) { $arguments += '--json' }
  & node @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "R2 launcher publisher exited with code $LASTEXITCODE."
  }
  if ($withBlockmap) {
    $blockmapArguments = @(
      $blockmapPublisherPath,
      '--live',
      '--installer', $resolvedFile,
      '--blockmap', $resolvedBlockmap,
      '--version', $Version,
      '--installer-sha256', $ExpectedSha256.ToLowerInvariant(),
      '--installer-bytes', $ExpectedBytes,
      '--blockmap-sha256', $ExpectedBlockmapSha256.ToLowerInvariant(),
      '--blockmap-bytes', $ExpectedBlockmapBytes
    )
    if ($Json) { $blockmapArguments += '--json' }
    & node @blockmapArguments
    if ($LASTEXITCODE -ne 0) {
      throw "R2 launcher blockmap publisher exited with code $LASTEXITCODE."
    }
  }
} finally {
  foreach ($name in $previous.Keys) {
    [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process')
  }
}
