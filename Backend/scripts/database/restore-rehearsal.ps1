[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupPath,
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [switch]$KeepRehearsalDatabase
)

$ErrorActionPreference = 'Stop'

function Get-DatabaseUrl {
  param([string]$ExplicitUrl)
  if ($ExplicitUrl) { return $ExplicitUrl.Trim('"') }

  $envPath = Join-Path $PSScriptRoot '..\..\.env'
  $line = Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
  if (-not $line) { throw 'DATABASE_URL is not available' }
  return (($line -split '=', 2)[1]).Trim().Trim('"')
}

function Get-ConnectionParts {
  param([string]$Url)
  $uri = [Uri]$Url
  if ($uri.Scheme -ne 'mysql') { throw 'Only mysql:// DATABASE_URL values are supported' }
  $credentials = $uri.UserInfo -split ':', 2
  if ($credentials.Count -ne 2) { throw 'DATABASE_URL must contain a username and password' }
  return [pscustomobject]@{
    Host = $uri.Host
    Port = if ($uri.Port -gt 0) { $uri.Port } else { 3306 }
    User = [Uri]::UnescapeDataString($credentials[0])
    Password = [Uri]::UnescapeDataString($credentials[1])
  }
}

function Get-Sha256 {
  param([string]$Path)
  $stream = [IO.File]::OpenRead($Path)
  $algorithm = [Security.Cryptography.SHA256]::Create()
  try {
    return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
  }
  finally {
    $stream.Dispose()
    $algorithm.Dispose()
  }
}

$resolvedBackup = [IO.Path]::GetFullPath($BackupPath)
if (-not (Test-Path -LiteralPath $resolvedBackup -PathType Leaf)) { throw 'Backup file does not exist' }
$manifestPath = "$resolvedBackup.json"
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw 'Backup manifest does not exist' }

$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$actualChecksum = Get-Sha256 $resolvedBackup
if ($actualChecksum -ne $manifest.sha256) { throw 'Backup checksum does not match its manifest' }

$connection = Get-ConnectionParts (Get-DatabaseUrl $DatabaseUrl)
$mysql = (Get-Command mysql -ErrorAction Stop).Source
$databaseName = "hm_restore_$((Get-Date).ToUniversalTime().ToString('yyyyMMdd_HHmmss'))_$(([Guid]::NewGuid().ToString('N')).Substring(0, 8))"
if ($databaseName -notmatch '^hm_restore_[0-9]{8}_[0-9]{6}_[a-f0-9]{8}$') { throw 'Unsafe rehearsal database name' }

$env:MYSQL_PWD = $connection.Password
$created = $false
$startedAt = Get-Date

try {
  & $mysql "--host=$($connection.Host)" "--port=$($connection.Port)" "--user=$($connection.User)" "--execute=CREATE DATABASE $databaseName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  if ($LASTEXITCODE -ne 0) { throw 'Could not create rehearsal database' }
  $created = $true

  $arguments = @(
    "--host=$($connection.Host)",
    "--port=$($connection.Port)",
    "--user=$($connection.User)",
    "--database=$databaseName",
    '--default-character-set=utf8mb4'
  )
  $process = Start-Process -FilePath $mysql -ArgumentList $arguments -RedirectStandardInput $resolvedBackup -WindowStyle Hidden -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw 'Restore import failed' }

  $quote = [char]96
  $mismatches = @()
  foreach ($property in $manifest.recordCounts.PSObject.Properties) {
    $table = $property.Name
    $safeTable = $table.Replace([string]$quote, ([string]$quote + [string]$quote))
    $actualCount = & $mysql "--host=$($connection.Host)" "--port=$($connection.Port)" "--user=$($connection.User)" "--database=$databaseName" '--batch' '--skip-column-names' "--execute=SELECT COUNT(*) FROM $quote$safeTable$quote;"
    if ($LASTEXITCODE -ne 0) { throw "Could not count restored table $table" }
    if ([long]$actualCount -ne [long]$property.Value) {
      $mismatches += [pscustomobject]@{ table = $table; expected = [long]$property.Value; actual = [long]$actualCount }
    }
  }

  if ($mismatches.Count -gt 0) {
    throw "Restore count reconciliation failed for $($mismatches.Count) table(s)"
  }

  [pscustomobject]@{
    status = 'passed'
    rehearsalDatabase = $databaseName
    tableCount = @($manifest.recordCounts.PSObject.Properties).Count
    durationSeconds = [Math]::Round(((Get-Date) - $startedAt).TotalSeconds, 3)
    kept = [bool]$KeepRehearsalDatabase
  } | ConvertTo-Json
}
finally {
  if ($created -and -not $KeepRehearsalDatabase) {
    if ($databaseName -notmatch '^hm_restore_[0-9]{8}_[0-9]{6}_[a-f0-9]{8}$') { throw 'Refusing to drop an unsafe database name' }
    & $mysql "--host=$($connection.Host)" "--port=$($connection.Port)" "--user=$($connection.User)" "--execute=DROP DATABASE $databaseName;" | Out-Null
  }
  Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
}
