param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][string]$ManifestPath,
    [Parameter(Mandatory = $true)][string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $ManifestPath | ConvertFrom-Json
$items = @()
foreach ($entry in @($manifest.files.planned_paths | Sort-Object path)) {
    $absolute = Join-Path $root ([string]$entry.path).Replace('/', [IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path -LiteralPath $absolute -PathType Leaf)) {
        throw "SUBMITTED_PATH_MISSING: $($entry.path)"
    }
    $hash = (Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash
    $bytes = (Get-Item -LiteralPath $absolute).Length
    if ($hash -ne $entry.sha256 -or $bytes -ne $entry.bytes) {
        throw "SUBMITTED_MANIFEST_MISMATCH: $($entry.path)"
    }
    $items += [ordered]@{path=$entry.path; sha256=$hash; bytes=$bytes}
}
$payload = [ordered]@{
    schema_version = '1.0'
    task_id = 'P10-COMP-03A'
    generated_at_utc = [DateTime]::UtcNow.ToString('o')
    workspace_source_id = $manifest.workspace_source_id
    task_source_id = $manifest.task_source_id
    evidence_metadata_id = $manifest.evidence_metadata_id
    submitted_file_count = $items.Count
    mismatch_count = 0
    files = $items
}
$payload | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Output "SUBMITTED HASH PASS files=$($items.Count) mismatch=0"
