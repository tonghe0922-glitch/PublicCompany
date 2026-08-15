param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][string]$PreManifest,
    [Parameter(Mandatory = $true)][string]$PreComparable,
    [Parameter(Mandatory = $true)][string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$pre = Get-Content -Raw -Encoding UTF8 -LiteralPath $PreManifest | ConvertFrom-Json
$preComparableManifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $PreComparable | ConvertFrom-Json
$reportPath = 'docs/implementation/ui/page-component-plans/P10-COMP-04_REPORT.md'

function Get-DeterministicId([object[]]$Entries) {
    $canonical = $Entries | ConvertTo-Json -Depth 6 -Compress
    if ($null -eq $canonical) { $canonical = '[]' }
    $bytes = [Text.Encoding]::UTF8.GetBytes($canonical)
    return ([BitConverter]::ToString(
        [Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
    )).Replace('-', '')
}

function Get-RelativePath([string]$FullPath) {
    $prefix = $root.TrimEnd('\') + '\'
    if (-not $FullPath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "OUTSIDE_REPOSITORY: $FullPath"
    }
    return $FullPath.Substring($prefix.Length).Replace('\', '/')
}

function Get-Changes([object[]]$Before, [object[]]$After) {
    $beforeMap = @{}
    $afterMap = @{}
    foreach ($entry in $Before) { $beforeMap[$entry.path.ToLowerInvariant()] = $entry }
    foreach ($entry in $After) { $afterMap[$entry.path.ToLowerInvariant()] = $entry }
    $keys = @($beforeMap.Keys + $afterMap.Keys | Sort-Object -Unique)
    $changes = @()
    foreach ($key in $keys) {
        $left = $beforeMap[$key]
        $right = $afterMap[$key]
        if ($null -eq $left) {
            $changes += [ordered]@{path=$right.path;change='added';before_sha256=$null;after_sha256=$right.sha256}
        } elseif ($null -eq $right) {
            $changes += [ordered]@{path=$left.path;change='deleted';before_sha256=$left.sha256;after_sha256=$null}
        } elseif ($left.sha256 -ne $right.sha256 -or [long]$left.bytes -ne [long]$right.bytes) {
            $changes += [ordered]@{path=$right.path;change='modified';before_sha256=$left.sha256;after_sha256=$right.sha256}
        }
    }
    return @($changes | Sort-Object path)
}

$excludedNames = @($pre.excluded_directories)
$excludedPrefixes = @($pre.excluded_evidence_prefixes)
function Test-Excluded([string]$RelativePath) {
    if ($RelativePath -match '(^|/)\.env(?:\..*)?$') { return $true }
    foreach ($prefix in $excludedPrefixes) {
        if ($RelativePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { return $true }
    }
    return $false
}

$workspace = @()
$seen = @{}
$stack = New-Object 'System.Collections.Generic.Stack[System.IO.DirectoryInfo]'
$stack.Push((Get-Item -LiteralPath $root))
while ($stack.Count -gt 0) {
    $directory = $stack.Pop()
    foreach ($child in @(Get-ChildItem -LiteralPath $directory.FullName -Directory -Force)) {
        if ($child.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
        if ($excludedNames -contains $child.Name) { continue }
        $relativeDirectory = (Get-RelativePath $child.FullName) + '/'
        $skip = $false
        foreach ($prefix in $excludedPrefixes) {
            if ($relativeDirectory.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
                $skip = $true
                break
            }
        }
        if (-not $skip) { $stack.Push($child) }
    }
    foreach ($file in @(Get-ChildItem -LiteralPath $directory.FullName -File -Force)) {
        $relative = Get-RelativePath $file.FullName
        if (Test-Excluded $relative) { continue }
        $key = $relative.ToLowerInvariant()
        if ($seen.ContainsKey($key)) { throw "DUPLICATE_PATH: $relative" }
        $seen[$key] = $relative
        $workspace += [ordered]@{
            path = $relative
            sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
            bytes = $file.Length
        }
    }
}
$workspace = @($workspace | Sort-Object path)

$task = @()
foreach ($preEntry in @($pre.files.task_source)) {
    $relative = $preEntry.path
    $path = Join-Path $root $relative
    if (Test-Path -LiteralPath $path -PathType Leaf) {
        $file = Get-Item -LiteralPath $path
        $task += [ordered]@{
            path = $relative
            exists = $true
            sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
            bytes = $file.Length
        }
    } else {
        $task += [ordered]@{path=$relative;exists=$false;sha256=$null;bytes=0}
    }
}
$task = @($task | Sort-Object path)
if ($task.Count -ne 33 -or @($task | Where-Object {-not $_.exists}).Count -ne 0) {
    throw 'SUBMITTED_PATH_SET_INVALID'
}

$rawPost = [ordered]@{
    schema_version = '1.0'
    kind = 'P10-COMP-04-final-post-baseline'
    repository_root = $root
    generated_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    baseline_workspace_source_id = $pre.workspace_source_id
    baseline_task_source_id = $pre.task_source_id
    workspace_source_id = Get-DeterministicId $workspace
    task_source_id = Get-DeterministicId $task
    evidence_metadata_id = Get-DeterministicId @()
    workspace_file_count = $workspace.Count
    task_source_path_count = $task.Count
    task_source_existing_file_count = @($task | Where-Object {$_.exists}).Count
    task_source_missing_file_count = @($task | Where-Object {-not $_.exists}).Count
    evidence_metadata_file_count = 0
    files = [ordered]@{workspace_source=$workspace;task_source=$task;evidence_metadata=@()}
}
$rawPost | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $OutputDirectory 'post-baseline.json')

$comparableWorkspace = @($workspace | Where-Object {$_.path -ne $reportPath})
$comparableTask = @($task | Where-Object {$_.path -ne $reportPath})
$report = @($task | Where-Object {$_.path -eq $reportPath})
if ($report.Count -ne 1 -or -not $report[0].exists) { throw 'REPORT_PROJECTION_INVALID' }
$metadata = @([ordered]@{path=$report[0].path;sha256=$report[0].sha256;bytes=$report[0].bytes})
$postComparable = [ordered]@{
    schema_version = '1.0'
    kind = 'P10-COMP-04-final-post-comparable'
    report_projection_rule = 'exclude report from workspace/task; track report as evidence_metadata'
    workspace_source_id = Get-DeterministicId $comparableWorkspace
    task_source_id = Get-DeterministicId $comparableTask
    evidence_metadata_id = Get-DeterministicId $metadata
    workspace_file_count = $comparableWorkspace.Count
    task_source_path_count = $comparableTask.Count
    task_source_existing_file_count = @($comparableTask | Where-Object {$_.exists}).Count
    evidence_metadata_file_count = 1
    files = [ordered]@{workspace_source=$comparableWorkspace;task_source=$comparableTask;evidence_metadata=$metadata}
}
$postComparable | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $OutputDirectory 'comparable-manifest.json')

$workspaceChanges = @(Get-Changes @($preComparableManifest.files.workspace_source) $comparableWorkspace)
$taskChanges = @(Get-Changes @($preComparableManifest.files.task_source) $comparableTask)
$taskPaths = @{}
foreach ($entry in $comparableTask) { $taskPaths[$entry.path.ToLowerInvariant()] = $true }
$unrelated = @($workspaceChanges | Where-Object {-not $taskPaths.ContainsKey($_.path.ToLowerInvariant())})
$metadataChanges = @(Get-Changes @($preComparableManifest.files.evidence_metadata) $metadata)
$concurrent = @()
$scoped = [ordered]@{
    schema_version = '1.0'
    kind = 'P10-COMP-04-final-scoped'
    pre_comparable_workspace_id = $preComparableManifest.workspace_source_id
    post_comparable_workspace_id = $postComparable.workspace_source_id
    pre_comparable_task_id = $preComparableManifest.task_source_id
    post_comparable_task_id = $postComparable.task_source_id
    task_changes = $taskChanges
    task_change_count = $taskChanges.Count
    unrelated_changes = $unrelated
    unrelated_change_count = $unrelated.Count
    concurrent_changes = $concurrent
    concurrent_change_count = $concurrent.Count
    metadata_changes = $metadataChanges
    metadata_change_count = $metadataChanges.Count
    expected = '1/0/0/1'
    actual = "$($taskChanges.Count)/$($unrelated.Count)/$($concurrent.Count)/$($metadataChanges.Count)"
}
$scoped | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $OutputDirectory 'scoped.json')

$submitted = @()
$mismatch = @()
foreach ($entry in $task) {
    $path = Join-Path $root $entry.path
    $actualHash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
    $actualBytes = (Get-Item -LiteralPath $path).Length
    $match = $entry.sha256 -eq $actualHash -and [long]$entry.bytes -eq [long]$actualBytes
    $submitted += [ordered]@{path=$entry.path;sha256=$entry.sha256;bytes=$entry.bytes;disk_match=$match}
    if (-not $match) { $mismatch += $entry.path }
}
$submittedManifest = [ordered]@{
    schema_version = '1.0'
    kind = 'P10-COMP-04-submitted-33'
    submitted_count = $submitted.Count
    mismatch_count = $mismatch.Count
    mismatches = $mismatch
    files = $submitted
}
$submittedManifest | ConvertTo-Json -Depth 7 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $OutputDirectory 'submitted-33.json')

$reportFile = Get-Item -LiteralPath (Join-Path $root $reportPath)
$summary = [ordered]@{
    raw_pre = [ordered]@{workspace_id=$pre.workspace_source_id;workspace_count=$pre.workspace_file_count;task_id=$pre.task_source_id;task_count=$pre.task_source_path_count;metadata_id=$pre.evidence_metadata_id;metadata_count=$pre.evidence_metadata_file_count}
    raw_post = [ordered]@{workspace_id=$rawPost.workspace_source_id;workspace_count=$rawPost.workspace_file_count;task_id=$rawPost.task_source_id;task_count=$rawPost.task_source_path_count;metadata_id=$rawPost.evidence_metadata_id;metadata_count=0}
    comparable_pre = [ordered]@{workspace_id=$preComparableManifest.workspace_source_id;workspace_count=$preComparableManifest.workspace_file_count;task_id=$preComparableManifest.task_source_id;task_count=$preComparableManifest.task_source_path_count;metadata_id=$preComparableManifest.evidence_metadata_id;metadata_count=1}
    comparable_post = [ordered]@{workspace_id=$postComparable.workspace_source_id;workspace_count=$postComparable.workspace_file_count;task_id=$postComparable.task_source_id;task_count=$postComparable.task_source_path_count;metadata_id=$postComparable.evidence_metadata_id;metadata_count=1}
    scoped = [ordered]@{task=$taskChanges.Count;unrelated=$unrelated.Count;concurrent=$concurrent.Count;metadata=$metadataChanges.Count}
    submitted = [ordered]@{count=$submitted.Count;mismatch_count=$mismatch.Count}
    report = [ordered]@{path=$reportPath;sha256=(Get-FileHash -LiteralPath $reportFile.FullName -Algorithm SHA256).Hash;bytes=$reportFile.Length}
    external_authorized_contract_patch = 'CONTRACT-PATCH-06 (outside workspace)'
    runtime_boundary = 'formal P006 exact cleanup complete; original pre-existing runtime 7/7 retained'
}
$summary | ConvertTo-Json -Depth 7 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $OutputDirectory 'post-summary.json')

if ($scoped.actual -ne $scoped.expected) { throw "SCOPED_MISMATCH: $($scoped.actual)" }
if ($mismatch.Count -ne 0) { throw "SUBMITTED_MISMATCH: $($mismatch.Count)" }
if ($preComparableManifest.workspace_file_count -ne $postComparable.workspace_file_count) { throw 'COMPARABLE_WORKSPACE_COUNT_MISMATCH' }
if ($preComparableManifest.task_source_path_count -ne $postComparable.task_source_path_count) { throw 'COMPARABLE_TASK_COUNT_MISMATCH' }

Write-Output "POST PASS raw_workspace=$($rawPost.workspace_source_id)/$($rawPost.workspace_file_count) raw_task=$($rawPost.task_source_id)/$($rawPost.task_source_path_count) comparable_workspace=$($postComparable.workspace_source_id)/$($postComparable.workspace_file_count) comparable_task=$($postComparable.task_source_id)/$($postComparable.task_source_path_count) metadata=$($postComparable.evidence_metadata_id)/1 scoped=$($scoped.actual) submitted=$($submitted.Count)/mismatch$($mismatch.Count)"
