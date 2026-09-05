[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('AccessKeyId', 'SecretAccessKey')]
  [string]$Field,

  [string]$AccountId = '31616eafa5f0b75688a72a31ce037cd7',
  [string]$Bucket = 'onepiece-game-assets'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$credentialRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'ONEPIECE-Tabletop\publisher'
$credentialPath = Join-Path $credentialRoot 'r2-credentials.json'
$clipboardValue = ([string](Get-Clipboard -Raw)).Trim()

try {
  if ($Field -eq 'AccessKeyId' -and $clipboardValue -notmatch '^[a-f0-9]{32}$') {
    throw 'The clipboard does not contain a valid R2 access key id.'
  }
  if ($Field -eq 'SecretAccessKey' -and $clipboardValue -notmatch '^[a-f0-9]{64}$') {
    throw 'The clipboard does not contain a valid R2 secret access key.'
  }
  if ($AccountId -notmatch '^[a-f0-9]{32}$') {
    throw 'AccountId must be a 32-character hexadecimal value.'
  }
  if ($Bucket -notmatch '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$') {
    throw 'Bucket has an invalid name.'
  }

  $document = [ordered]@{
    schema = 1
    provider = 'cloudflare-r2'
    accountId = $AccountId
    bucket = $Bucket
    accessKeyIdProtected = ''
    secretAccessKeyProtected = ''
  }

  if (Test-Path -LiteralPath $credentialPath -PathType Leaf) {
    $existing = Get-Content -Raw -LiteralPath $credentialPath | ConvertFrom-Json
    foreach ($name in @('accessKeyIdProtected', 'secretAccessKeyProtected')) {
      if ($existing.PSObject.Properties.Name -contains $name) {
        $document[$name] = [string]$existing.$name
      }
    }
  }

  $secureValue = ConvertTo-SecureString -String $clipboardValue -AsPlainText -Force
  $protectedValue = ConvertFrom-SecureString -SecureString $secureValue
  if ($Field -eq 'AccessKeyId') {
    $document.accessKeyIdProtected = $protectedValue
  } else {
    $document.secretAccessKeyProtected = $protectedValue
  }

  New-Item -ItemType Directory -Path $credentialRoot -Force | Out-Null
  $json = $document | ConvertTo-Json -Depth 3
  [IO.File]::WriteAllText($credentialPath, "$json`n", [Text.UTF8Encoding]::new($false))

  $persisted = Get-Content -Raw -LiteralPath $credentialPath
  if ($persisted.Contains($clipboardValue)) {
    throw 'Credential protection verification failed: plaintext was detected.'
  }

  Write-Output "R2_CREDENTIAL_SAVE=PASS field=$Field path=$credentialPath"
} finally {
  Set-Clipboard -Value '' -ErrorAction SilentlyContinue
}
