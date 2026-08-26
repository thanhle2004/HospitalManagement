[CmdletBinding()]
param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$OutputDirectory
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
    Database = [Uri]::UnescapeDataString($uri.AbsolutePath.Trim('/'))
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

$connection = Get-ConnectionParts (Get-DatabaseUrl $DatabaseUrl)
$mysql = (Get-Command mysql -ErrorAction Stop).Source
$mysqldump = (Get-Command mysqldump -ErrorAction Stop).Source
$OutputDirectory = if ($OutputDirectory) {
  $OutputDirectory
} else {
  Join-Path $PSScriptRoot '..\..\..\artifacts\db-backups'
}
$resolvedOutput = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = Join-Path $resolvedOutput "hospital-management-$timestamp.sql"
$manifestPath = "$backupPath.json"
$env:MYSQL_PWD = $connection.Password

try {
  $tables = & $mysql "--host=$($connection.Host)" "--port=$($connection.Port)" "--user=$($connection.User)" "--database=$($connection.Database)" '--batch' '--skip-column-names' '--execute=SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = ''BASE TABLE'' ORDER BY TABLE_NAME;'
  if ($LASTEXITCODE -ne 0) { throw 'Could not enumerate source tables' }

  $recordCounts = [ordered]@{}
  $quote = [char]96
  foreach ($table in $tables) {
    $safeTable = $table.Replace([string]$quote, ([string]$quote + [string]$quote))
    $count = & $mysql "--host=$($connection.Host)" "--port=$($connection.Port)" "--user=$($connection.User)" "--database=$($connection.Database)" '--batch' '--skip-column-names' "--execute=SELECT COUNT(*) FROM $quote$safeTable$quote;"
    if ($LASTEXITCODE -ne 0) { throw "Could not count table $table" }
    $recordCounts[$table] = [long]$count
  }

  & $mysqldump "--host=$($connection.Host)" "--port=$($connection.Port)" "--user=$($connection.User)" '--single-transaction' '--quick' '--routines' '--triggers' '--events' '--hex-blob' '--no-tablespaces' '--set-gtid-purged=OFF' '--default-character-set=utf8mb4' "--result-file=$backupPath" $connection.Database
  if ($LASTEXITCODE -ne 0) { throw 'mysqldump failed' }

  $checksum = Get-Sha256 $backupPath
  $manifest = [ordered]@{
    formatVersion = 1
    createdAt = (Get-Date).ToUniversalTime().ToString('o')
    database = $connection.Database
    backupFile = [IO.Path]::GetFileName($backupPath)
    sha256 = $checksum
    recordCounts = $recordCounts
  }
  $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding utf8
  [pscustomobject]@{ backupPath = $backupPath; manifestPath = $manifestPath; sha256 = $checksum; tableCount = $recordCounts.Count } | ConvertTo-Json
}
finally {
  Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
}
