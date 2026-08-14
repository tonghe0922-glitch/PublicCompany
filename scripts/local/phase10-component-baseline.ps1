param(
    [Parameter(Mandatory=$true)][string]$RepositoryRoot,
    [Parameter(Mandatory=$true)][string]$EvidenceDirectory,
    [string]$CompareManifest,
    [string[]]$ConcurrentCorePaths=@()
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $RepositoryRoot).Path
New-Item -ItemType Directory -Force -Path $EvidenceDirectory | Out-Null
$taskSourcePaths = @(
    'scripts/implementation/phase10_component_source_gate.py',
    'scripts/implementation/phase10_component_source_gate_test.py',
    'scripts/implementation/phase10_component_local_tools_test.py',
    'scripts/local/phase10-component-preflight.ps1',
    'scripts/local/phase10-component-baseline.ps1'
)

function Get-DeterministicId([object[]]$entries) {
    $canonical = $entries | ConvertTo-Json -Depth 5 -Compress
    if ($null -eq $canonical) { $canonical = '[]' }
    $bytes = [Text.Encoding]::UTF8.GetBytes($canonical)
    return ([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($bytes))).Replace('-','')
}
function Test-TaskScope([string]$relative) {
    return ($taskSourcePaths -contains $relative)
}
function Compare-Entries([object[]]$before, [object[]]$after, [string]$classification) {
    $beforeMap = @{}; foreach ($item in $before) { $beforeMap[$item.path] = $item }
    $afterMap = @{}; foreach ($item in $after) { $afterMap[$item.path] = $item }
    $paths = @($beforeMap.Keys + $afterMap.Keys | Sort-Object -Unique)
    $changes = @()
    foreach ($path in $paths) {
        if (-not $beforeMap.ContainsKey($path)) { $changes += [ordered]@{path=$path; change='added'; classification=$classification}; continue }
        if (-not $afterMap.ContainsKey($path)) { $changes += [ordered]@{path=$path; change='removed'; classification=$classification}; continue }
        if ($beforeMap[$path].sha256 -ne $afterMap[$path].sha256) { $changes += [ordered]@{path=$path; change='modified'; classification=$classification} }
    }
    return @($changes)
}

$generatedPattern = '(^|/)(node_modules|target|dist|reports|test-results|playwright-report|coverage|\.runlogs|__pycache__|\.git)(/|$)'
$secretPattern = '(^|/)\.env(?:\..*)?$'
$evidencePrefix = 'docs/implementation/phases/PHASE-10/evidence/P10-COMP-00/'
$reportRelative = 'docs/implementation/phases/PHASE-10/P10-COMP-00_UI_GATE_REVALIDATION.md'
$workspaceEntries = @()
$evidenceMetadataEntries = @()
$relativePathIndex = @{}
$sourceFiles = @(Get-ChildItem -LiteralPath $root -Recurse -File | Sort-Object FullName)
Push-Location -LiteralPath $root
try {
    foreach ($file in $sourceFiles) {
        $providerRelative = (Resolve-Path -LiteralPath $file.FullName -Relative).Replace('\','/')
        if ($providerRelative.StartsWith('./', [StringComparison]::Ordinal)) {
            $relative = $providerRelative.Substring(2)
        } elseif ($providerRelative.StartsWith('/', [StringComparison]::Ordinal)) {
            $relative = $providerRelative.Substring(1)
        } else {
            $relative = $providerRelative
        }
        $relativeKey = $relative.ToLowerInvariant()
        if ($relativePathIndex.ContainsKey($relativeKey)) {
            throw "DUPLICATE_RELATIVE_PATH: $relative conflicts with $($relativePathIndex[$relativeKey])"
        }
        $relativePathIndex[$relativeKey] = $relative
        if ($relative -match $generatedPattern -or $relative -match $secretPattern -or
            $relative.StartsWith($evidencePrefix, [StringComparison]::OrdinalIgnoreCase)) { continue }
        $entry = [ordered]@{path=$relative; sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash; bytes=$file.Length}
        if ($relative -eq $reportRelative) {
            $evidenceMetadataEntries += $entry
            continue
        }
        $workspaceEntries += $entry
    }
} finally {
    Pop-Location
}
$taskSourceEntries = @($workspaceEntries | Where-Object { Test-TaskScope -relative $_.path })
foreach ($requiredTaskSource in $taskSourcePaths) {
    if ($taskSourceEntries.path -notcontains $requiredTaskSource) { throw "TASK_SOURCE_MISSING: $requiredTaskSource" }
}
if ($evidenceMetadataEntries.Count -ne 1) { throw "EVIDENCE_METADATA_MISSING: $reportRelative" }
$workspaceId = Get-DeterministicId $workspaceEntries
$taskSourceId = Get-DeterministicId $taskSourceEntries
$evidenceMetadataId = Get-DeterministicId $evidenceMetadataEntries
$gitPresent = Test-Path -LiteralPath (Join-Path $root '.git')
$manifest = [ordered]@{
    schema_version='3.0'
    kind='phase10-component-baseline'
    baseline_id=$workspaceId
    workspace_source_id=$workspaceId
    task_source_id=$taskSourceId
    evidence_metadata_id=$evidenceMetadataId
    repository_root=$root
    generated_at_utc=(Get-Date).ToUniversalTime().ToString('o')
    git_present=$gitPresent
    git_status=if($gitPresent){'PRESENT_NOT_QUERIED_BY_BASELINE'}else{'ABSENT'}
    evidence_tree_excluded=$evidencePrefix
    excluded_generated_directories=@('node_modules','target','dist','reports','test-results','playwright-report','coverage','.runlogs','__pycache__','.git')
    excluded_secret_patterns=@('.env','.env.*')
    task_source_paths=$taskSourcePaths
    evidence_metadata_paths=@($reportRelative)
    workspace_file_count=$workspaceEntries.Count
    task_source_file_count=$taskSourceEntries.Count
    evidence_metadata_file_count=$evidenceMetadataEntries.Count
    files=[ordered]@{workspace_source=$workspaceEntries; task_source=$taskSourceEntries; evidence_metadata=$evidenceMetadataEntries}
}
$manifestPath = Join-Path $EvidenceDirectory 'baseline-manifest.json'
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding utf8
$workspaceId | Set-Content -LiteralPath (Join-Path $EvidenceDirectory 'BASELINE_ID.txt') -NoNewline -Encoding ascii
$taskSourceId | Set-Content -LiteralPath (Join-Path $EvidenceDirectory 'TASK_SOURCE_ID.txt') -NoNewline -Encoding ascii
$evidenceMetadataId | Set-Content -LiteralPath (Join-Path $EvidenceDirectory 'EVIDENCE_METADATA_ID.txt') -NoNewline -Encoding ascii

if ($CompareManifest) {
    $before = Get-Content -Raw -LiteralPath $CompareManifest | ConvertFrom-Json
    if ([string]$before.schema_version -ne '3.0') { throw "COMPARE_SCHEMA_UNSUPPORTED: $($before.schema_version)" }
    $taskChanges = Compare-Entries @($before.files.task_source) $taskSourceEntries 'ui_task_source'
    $workspaceChanges = Compare-Entries @($before.files.workspace_source) $workspaceEntries 'workspace_source'
    $metadataChanges = Compare-Entries @($before.files.evidence_metadata) $evidenceMetadataEntries 'evidence_metadata'
    $taskPaths = @($taskChanges | ForEach-Object {$_.path})
    $concurrentCore = @($ConcurrentCorePaths | ForEach-Object {
        $corePath = $_
        $matched = @($workspaceChanges | Where-Object {$_.path -eq $corePath})
        [ordered]@{path=$corePath; change=if($matched.Count -gt 0){$matched[0].change}else{'unchanged'}; classification='concurrent_core'}
    })
    $unrelated = @($workspaceChanges | Where-Object {$taskPaths -notcontains $_.path -and $ConcurrentCorePaths -notcontains $_.path} | ForEach-Object {
        [ordered]@{path=$_.path; change=$_.change; classification='unrelated_workspace_change'}
    })
    $diff = [ordered]@{
        schema_version='2.0'
        before_baseline_id=$before.baseline_id
        after_baseline_id=$workspaceId
        before_task_source_id=$before.task_source_id
        after_task_source_id=$taskSourceId
        before_evidence_metadata_id=$before.evidence_metadata_id
        after_evidence_metadata_id=$evidenceMetadataId
        task_changes=@($taskChanges)
        evidence_metadata_changes=@($metadataChanges)
        concurrent_core=@($concurrentCore)
        unrelated_workspace_changes=@($unrelated)
        evidence_tree_changes_included=$false
    }
    $diff | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $EvidenceDirectory 'scoped-diff.json') -Encoding utf8
}
Write-Output "BASELINE PASS $workspaceId TASK_SOURCE $taskSourceId EVIDENCE_METADATA $evidenceMetadataId"
exit 0
