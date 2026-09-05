[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [string]$OutputPath,

  [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$keyStorePath = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'ONEPIECE-Tabletop\publisher\launcher-signing-key.json'
$signerPath = Join-Path $PSScriptRoot 'launcher-manifest-signature.js'
$resolvedInput = (Resolve-Path -LiteralPath $InputPath -ErrorAction Stop).Path

if (-not (Test-Path -LiteralPath $keyStorePath -PathType Leaf)) {
  throw "DPAPI launcher signing key was not found at $keyStorePath. Run initialize-launcher-signing-key.js first."
}
if ([IO.Path]::GetExtension($resolvedInput) -ine '.json') {
  throw 'Launcher manifest input must be a JSON file.'
}

$keyDocument = Get-Content -Raw -LiteralPath $keyStorePath | ConvertFrom-Json
if (
  [int]$keyDocument.schema -ne 1 -or
  [string]$keyDocument.provider -ne 'windows-dpapi' -or
  [string]$keyDocument.algorithm -ne 'Ed25519'
) {
  throw 'The DPAPI launcher signing-key document is not supported.'
}

$manifestDocument = Get-Content -Raw -LiteralPath $resolvedInput | ConvertFrom-Json
$safeVersion = ([string]$manifestDocument.version) -replace '[^0-9A-Za-z._-]', '_'
if ([string]::IsNullOrWhiteSpace($safeVersion)) {
  throw 'The launcher manifest does not contain a usable version.'
}
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $candidateRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'ONEPIECE-Tabletop\publisher\candidates'
  $OutputPath = Join-Path $candidateRoot "launcher-release-v1-$safeVersion.signed-candidate.json"
}
$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)

function Convert-ProtectedStringToPlainText([string]$ProtectedValue) {
  if ([string]::IsNullOrWhiteSpace($ProtectedValue)) {
    throw 'The DPAPI launcher signing-key document is incomplete.'
  }
  [void][Reflection.Assembly]::Load('System.Security, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a')
  $protectedBytes = [Convert]::FromBase64String($ProtectedValue)
  $plainBytes = $null
  try {
    $plainBytes = [Security.Cryptography.ProtectedData]::Unprotect(
      $protectedBytes,
      $null,
      [Security.Cryptography.DataProtectionScope]::CurrentUser
    )
    return [Text.Encoding]::UTF8.GetString($plainBytes)
  } finally {
    if ($null -ne $protectedBytes) { [Array]::Clear($protectedBytes, 0, $protectedBytes.Length) }
    if ($null -ne $plainBytes) { [Array]::Clear($plainBytes, 0, $plainBytes.Length) }
  }
}

$environmentNames = @(
  'LAUNCHER_SIGNING_PRIVATE_KEY_PKCS8_BASE64',
  'LAUNCHER_SIGNING_KEY_ID',
  'LAUNCHER_SIGNING_PUBLIC_KEY_SPKI_BASE64'
)
$previous = @{}
foreach ($name in $environmentNames) {
  $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
$privateKeyPlaintext = $null

try {
  $privateKeyPlaintext = Convert-ProtectedStringToPlainText ([string]$keyDocument.privateKeyPkcs8Protected)
  $env:LAUNCHER_SIGNING_PRIVATE_KEY_PKCS8_BASE64 = $privateKeyPlaintext
  $env:LAUNCHER_SIGNING_KEY_ID = [string]$keyDocument.keyId
  $env:LAUNCHER_SIGNING_PUBLIC_KEY_SPKI_BASE64 = [string]$keyDocument.publicKeySpkiBase64

  $arguments = @(
    $signerPath,
    'sign',
    '--input', $resolvedInput,
    '--output', $resolvedOutput
  )
  if ($Json) { $arguments += '--json' }
  & node @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Launcher manifest signer exited with code $LASTEXITCODE."
  }
} finally {
  foreach ($name in $environmentNames) {
    [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process')
  }
  $privateKeyPlaintext = $null
}
