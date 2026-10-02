[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$keyPath = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'ONEPIECE-Tabletop\publisher\launcher-signing-key.json'
$signer = Join-Path $PSScriptRoot 'launcher-content-manifest.js'
if (-not (Test-Path -LiteralPath $keyPath -PathType Leaf)) { throw 'DPAPI launcher signing key was not found.' }
$key = Get-Content -Raw -LiteralPath $keyPath | ConvertFrom-Json
if ([int]$key.schema -ne 1 -or [string]$key.provider -ne 'windows-dpapi' -or [string]$key.algorithm -ne 'Ed25519') {
  throw 'Unsupported launcher signing key document.'
}
$inputResolved = (Resolve-Path -LiteralPath $InputPath -ErrorAction Stop).Path
$outputResolved = [IO.Path]::GetFullPath($OutputPath)
if ($inputResolved -eq $outputResolved) { throw 'Signed output must be a new candidate file.' }

$previousPrivate = $env:LAUNCHER_SIGNING_PRIVATE_KEY_PKCS8_BASE64
$previousPublic = $env:LAUNCHER_SIGNING_PUBLIC_KEY_SPKI_BASE64
$previousKeyId = $env:LAUNCHER_SIGNING_KEY_ID
$plain = $null
$protected = $null
try {
  [void][Reflection.Assembly]::Load('System.Security, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a')
  $protected = [Convert]::FromBase64String([string]$key.privateKeyPkcs8Protected)
  $plain = [Security.Cryptography.ProtectedData]::Unprotect(
    $protected, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser
  )
  $env:LAUNCHER_SIGNING_PRIVATE_KEY_PKCS8_BASE64 = [Text.Encoding]::UTF8.GetString($plain)
  $env:LAUNCHER_SIGNING_PUBLIC_KEY_SPKI_BASE64 = [string]$key.publicKeySpkiBase64
  $env:LAUNCHER_SIGNING_KEY_ID = [string]$key.keyId
  & node $signer sign --input $inputResolved --output $outputResolved
  if ($LASTEXITCODE -ne 0) { throw 'Content manifest signing failed.' }
} finally {
  if ($null -ne $plain) { [Array]::Clear($plain, 0, $plain.Length) }
  if ($null -ne $protected) { [Array]::Clear($protected, 0, $protected.Length) }
  $env:LAUNCHER_SIGNING_PRIVATE_KEY_PKCS8_BASE64 = $previousPrivate
  $env:LAUNCHER_SIGNING_PUBLIC_KEY_SPKI_BASE64 = $previousPublic
  $env:LAUNCHER_SIGNING_KEY_ID = $previousKeyId
}
