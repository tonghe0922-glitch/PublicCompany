param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][string]$PreManifest,
    [Parameter(Mandatory = $true)][string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$pre = Get-Content -LiteralPath $PreManifest -Raw -Encoding UTF8 | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$plannedPaths = @($pre.files.task_source | ForEach-Object { $_.path })
$concurrentCorePaths = @(
    'technical-platform/web/src/platform/pages/P011PerformancePage.vue',
    'technical-platform/web/src/platform/phase11/process-pages.test.ts',
    'technical-platform/web/e2e/phase11-p011-live.spec.ts',
    'technical-platform/web/e2e/phase11-p012-live.spec.ts',
    'technical-platform/web/e2e/phase11-p013-live.spec.ts',
    'technical-platform/web/e2e/phase11-p014-live.spec.ts',
    'technical-platform/web/e2e/phase11-p015-live.spec.ts',
    'technical-platform/web/e2e/phase11-p016-live.spec.ts'
)
$reportRelative = 'technical-platform/web/src/router/evidence/P10-COMP-02/P10-COMP-02_REPORT.md'
$excludedDirectoryNames = @(
    '.git', '.runlogs', '__pycache__', 'node_modules', 'target', 'dist',
    'reports', 'test-results', 'playwright-report', 'coverage'
)
$excludedPrefixes = @(
    'docs/implementation/phases/PHASE-10/evidence/P10-COMP-00/',
    'technical-platform/web/src/design-system/evidence/P10-COMP-01/',
    'technical-platform/web/src/router/evidence/P10-COMP-02/'
)

function Get-DeterministicId([object[]]$Entries) {
    $canonical = $Entries | ConvertTo-Json -Depth 6 -Compress
    if ($null -eq $canonical) { $canonical = '[]' }
    $bytes = [Text.Encoding]::UTF8.GetBytes($canonical)
    return ([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($bytes))).Replace('-', '')
}

function Get-RelativePath([string]$FullName) {
    $rootWithSeparator = $root.TrimEnd('\') + '\'
    if (-not $FullName.StartsWith($rootWithSeparator, [StringComparison]::OrdinalIgnoreCase)) {
        throw "PATH_OUTSIDE_REPOSITORY: $FullName"
    }
    return $FullName.Substring($rootWithSeparator.Length).Replace('\', '/')
}

function Test-ExcludedFile([string]$RelativePath) {
    if ($RelativePath -match '(^|/)\.env(?:\..*)?$') { return $true }
    foreach ($prefix in $excludedPrefixes) {
        if ($RelativePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { return $true }
    }
    return $false
}

function Compare-Entries([object[]]$Before, [object[]]$After) {
    $beforeMap = @{}; foreach ($entry in $Before) { $beforeMap[$entry.path] = $entry }
    $afterMap = @{}; foreach ($entry in $After) { $afterMap[$entry.path] = $entry }
    $changes = @()
    foreach ($path in @($beforeMap.Keys + $afterMap.Keys | Sort-Object -Unique)) {
        $change = $null
        if (-not $beforeMap.ContainsKey($path)) { $change = 'added' }
        elseif (-not $afterMap.ContainsKey($path)) { $change = 'removed' }
        elseif ($beforeMap[$path].sha256 -ne $afterMap[$path].sha256) { $change = 'modified' }
        if ($null -eq $change) { continue }
        $classification = if ($plannedPaths -contains $path) { 'ui_task' }
            elseif ($concurrentCorePaths -contains $path) { 'concurrent_core' }
            else { 'unrelated' }
        $changes += [ordered]@{ path = $path; change = $change; classification = $classification }
    }
    return @($changes)
}

$workspaceEntries = @()
$relativePathIndex = @{}
$pending = New-Object 'System.Collections.Generic.Stack[System.IO.DirectoryInfo]'
$pending.Push((Get-Item -LiteralPath $root))
while ($pending.Count -gt 0) {
    $directory = $pending.Pop()
    foreach ($childDirectory in @(Get-ChildItem -LiteralPath $directory.FullName -Directory -Force)) {
        if ($childDirectory.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
        if ($excludedDirectoryNames -contains $childDirectory.Name) { continue }
        $childRelative = (Get-RelativePath $childDirectory.FullName) + '/'
        $prefixExcluded = $false
        foreach ($prefix in $excludedPrefixes) {
            if ($childRelative.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { $prefixExcluded = $true; break }
        }
        if (-not $prefixExcluded) { $pending.Push($childDirectory) }
    }
    foreach ($file in @(Get-ChildItem -LiteralPath $directory.FullName -File -Force)) {
        $relative = Get-RelativePath $file.FullName
        if (Test-ExcludedFile $relative) { continue }
        $key = $relative.ToLowerInvariant()
        if ($relativePathIndex.ContainsKey($key)) {
            throw "DUPLICATE_RELATIVE_PATH: $relative conflicts with $($relativePathIndex[$key])"
        }
        $relativePathIndex[$key] = $relative
        $workspaceEntries += [ordered]@{
            path = $relative
            sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
            bytes = $file.Length
        }
    }
}
$workspaceEntries = @($workspaceEntries | Sort-Object path)

$taskEntries = @()
foreach ($relative in $plannedPaths) {
    $fullPath = Join-Path $root $relative
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { throw "TASK_SOURCE_MISSING: $relative" }
    $file = Get-Item -LiteralPath $fullPath
    $taskEntries += [ordered]@{
        path = $relative
        exists = $true
        sha256 = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash
        bytes = $file.Length
    }
}
$taskEntries = @($taskEntries | Sort-Object path)

$reportPath = Join-Path $root $reportRelative
if (-not (Test-Path -LiteralPath $reportPath -PathType Leaf)) { throw "REPORT_MISSING: $reportRelative" }
$reportFile = Get-Item -LiteralPath $reportPath
$metadataEntries = @([ordered]@{
    path = $reportRelative
    sha256 = (Get-FileHash -LiteralPath $reportPath -Algorithm SHA256).Hash
    bytes = $reportFile.Length
})

$changes = Compare-Entries -Before $pre.files.workspace_source -After $workspaceEntries
$scoped = [ordered]@{
    schema_version = '1.0'
    pre_workspace_source_id = $pre.workspace_source_id
    post_workspace_source_id = Get-DeterministicId $workspaceEntries
    ui_task_count = @($changes | Where-Object { $_.classification -eq 'ui_task' }).Count
    concurrent_core_count = @($changes | Where-Object { $_.classification -eq 'concurrent_core' }).Count
    unrelated_count = @($changes | Where-Object { $_.classification -eq 'unrelated' }).Count
    metadata_count = 1
    changes = $changes
    evidence_metadata = $metadataEntries
}
if ($scoped.unrelated_count -ne 0) { throw "UNRELATED_CHANGES: $($scoped.unrelated_count)" }

$manifest = [ordered]@{
    schema_version = '1.0'
    kind = 'P10-COMP-02-post-baseline'
    repository_root = $root
    generated_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    git_status = if (Test-Path -LiteralPath (Join-Path $root '.git')) { 'PRESENT_NOT_QUERIED' } else { 'ABSENT' }
    workspace_source_id = Get-DeterministicId $workspaceEntries
    task_source_id = Get-DeterministicId $taskEntries
    evidence_metadata_id = Get-DeterministicId $metadataEntries
    workspace_file_count = $workspaceEntries.Count
    task_source_path_count = $taskEntries.Count
    evidence_metadata_file_count = $metadataEntries.Count
    files = [ordered]@{ workspace_source = $workspaceEntries; task_source = $taskEntries; evidence_metadata = $metadataEntries }
}

$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'baseline-manifest.json') -Encoding utf8
$scoped | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'scoped-diff.json') -Encoding utf8
$manifest.workspace_source_id | Set-Content -LiteralPath (Join-Path $OutputDirectory 'WORKSPACE_SOURCE_ID.txt') -NoNewline -Encoding ascii
$manifest.task_source_id | Set-Content -LiteralPath (Join-Path $OutputDirectory 'TASK_SOURCE_ID.txt') -NoNewline -Encoding ascii
$manifest.evidence_metadata_id | Set-Content -LiteralPath (Join-Path $OutputDirectory 'EVIDENCE_METADATA_ID.txt') -NoNewline -Encoding ascii
Write-Output "POST PASS workspace=$($manifest.workspace_source_id)/$($manifest.workspace_file_count) task=$($manifest.task_source_id)/$($manifest.task_source_path_count) metadata=$($manifest.evidence_metadata_id)/1 scoped=$($scoped.ui_task_count)/$($scoped.unrelated_count)/$($scoped.concurrent_core_count)/1"
exit 0
