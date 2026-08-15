param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][string]$OutputDirectory,
    [Parameter(Mandatory = $true)][string]$CompareManifest,
    [string[]]$ConcurrentCorePaths = @()
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $RepositoryRoot).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$plannedPaths = @(
    'AGENT.md',
    'DESIGN.md',
    'docs/implementation/ui/README.md',
    'docs/implementation/ui/UI_COMPONENT_CONSTRUCTION_STANDARD.md',
    'docs/implementation/ui/UI_PAGE_COMPOSITION_STANDARD.md',
    'docs/implementation/ui/UI_AI_IMPLEMENTATION_GUARDRAILS.md',
    'docs/implementation/ui/UI_COMPONENT_REGISTRY.json',
    'docs/implementation/ui/UI_COMPONENT_REUSE_RULES.json',
    'docs/implementation/ui/PAGE_COMPONENT_USAGE_PLAN.schema.json',
    'docs/implementation/ui/UI_NATIVE_ELEMENT_EXCEPTIONS.json',
    'docs/implementation/ui/page-component-plans/P006MeetingPage.ui-plan.json',
    'docs/implementation/ui/page-component-plans/P007SchedulePage.ui-plan.json',
    'docs/implementation/ui/page-component-plans/P008LeavePage.ui-plan.json',
    'docs/implementation/ui/page-component-plans/P009OvertimePage.ui-plan.json',
    'docs/implementation/ui/page-component-plans/P010LearningPage.ui-plan.json',
    'docs/implementation/ui/CURRENT_UI_COMPONENT_VIOLATIONS.json',
    'docs/implementation/ui/P10-COMP-03A_REPORT.md',
    'technical-platform/web/tsconfig.app.json',
    'technical-platform/web/vite.config.ts',
    'technical-platform/web/src/design-system/index.ts',
    'technical-platform/web/src/platform/processes/shared/index.ts',
    'technical-platform/web/src/design-system/ui-component-access.test.ts',
    'scripts/implementation/ui_component_access_gate.py'
)
$reportRelative = 'docs/implementation/ui/P10-COMP-03A_REPORT.md'
$taskPaths = @($plannedPaths | Where-Object { $_ -ne $reportRelative })

$excludedDirectoryNames = @(
    '.git', '.runlogs', '__pycache__', 'node_modules', 'target', 'dist',
    'reports', 'test-results', 'playwright-report', 'coverage'
)
$excludedPrefixes = @(
    'docs/implementation/phases/PHASE-10/evidence/P10-COMP-00/',
    'technical-platform/web/src/design-system/evidence/P10-COMP-01/',
    'technical-platform/web/src/router/evidence/P10-COMP-02/',
    'docs/implementation/ui/evidence/P10-COMP-03A/'
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
    if ($RelativePath -eq $reportRelative) { return $true }
    if ($RelativePath -match '(^|/)\.env(?:\..*)?$') { return $true }
    foreach ($prefix in $excludedPrefixes) {
        if ($RelativePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { return $true }
    }
    return $false
}

function Get-Entry([string]$RelativePath, [bool]$IncludeExists) {
    $full = Join-Path $root $RelativePath
    $exists = Test-Path -LiteralPath $full -PathType Leaf
    $entry = [ordered]@{path=$RelativePath}
    if ($IncludeExists) { $entry.exists = $exists }
    if ($exists) {
        $file = Get-Item -LiteralPath $full
        $entry.sha256 = (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash
        $entry.bytes = $file.Length
    } else {
        $entry.sha256 = $null
        $entry.bytes = 0
    }
    return $entry
}

function Compare-Entries([object[]]$Before, [object[]]$After, [string]$Classification) {
    $beforeMap=@{}; foreach($item in $Before){$beforeMap[$item.path]=$item}
    $afterMap=@{}; foreach($item in $After){$afterMap[$item.path]=$item}
    $paths=@($beforeMap.Keys+$afterMap.Keys|Sort-Object -Unique)
    $changes=@()
    foreach($path in $paths){
        if(-not $beforeMap.ContainsKey($path)){$changes += [ordered]@{path=$path;change='added';classification=$Classification};continue}
        if(-not $afterMap.ContainsKey($path)){$changes += [ordered]@{path=$path;change='removed';classification=$Classification};continue}
        if($beforeMap[$path].sha256 -ne $afterMap[$path].sha256){$changes += [ordered]@{path=$path;change='modified';classification=$Classification}}
    }
    return @($changes)
}

$workspaceEntries=@()
$relativePathIndex=@{}
$pending=New-Object 'System.Collections.Generic.Stack[System.IO.DirectoryInfo]'
$pending.Push((Get-Item -LiteralPath $root))
while($pending.Count -gt 0){
    $directory=$pending.Pop()
    foreach($childDirectory in @(Get-ChildItem -LiteralPath $directory.FullName -Directory -Force)){
        if($childDirectory.Attributes -band [IO.FileAttributes]::ReparsePoint){continue}
        if($excludedDirectoryNames -contains $childDirectory.Name){continue}
        $childRelative=(Get-RelativePath $childDirectory.FullName)+'/'
        $prefixExcluded=$false
        foreach($prefix in $excludedPrefixes){if($childRelative.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)){$prefixExcluded=$true;break}}
        if(-not $prefixExcluded){$pending.Push($childDirectory)}
    }
    foreach($file in @(Get-ChildItem -LiteralPath $directory.FullName -File -Force)){
        $relative=Get-RelativePath $file.FullName
        if(Test-ExcludedFile $relative){continue}
        $key=$relative.ToLowerInvariant()
        if($relativePathIndex.ContainsKey($key)){throw "DUPLICATE_RELATIVE_PATH: $relative conflicts with $($relativePathIndex[$key])"}
        $relativePathIndex[$key]=$relative
        $workspaceEntries += [ordered]@{path=$relative;sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash;bytes=$file.Length}
    }
}
$workspaceEntries=@($workspaceEntries|Sort-Object path)
$plannedEntries=@($plannedPaths|ForEach-Object{Get-Entry $_ $true}|Sort-Object { $_.path })
$taskEntries=@($taskPaths|ForEach-Object{Get-Entry $_ $false}|Sort-Object { $_.path })
foreach($entry in $plannedEntries){if(-not $entry.exists){throw "PLANNED_PATH_MISSING: $($entry.path)"}}
$metadataEntries=@(Get-Entry $reportRelative $false)

$workspaceId=Get-DeterministicId $workspaceEntries
$taskId=Get-DeterministicId $taskEntries
$metadataId=Get-DeterministicId $metadataEntries
$before=Get-Content -Raw -Encoding UTF8 -LiteralPath $CompareManifest|ConvertFrom-Json
$beforeTask=@($before.files.task_source|Where-Object{$_.path -ne $reportRelative}|ForEach-Object{[ordered]@{path=$_.path;sha256=$_.sha256;bytes=$_.bytes}}|Sort-Object { $_.path })
$beforeWorkspace=@($before.files.workspace_source|Where-Object{$_.path -ne $reportRelative})
$beforeHadReport=@($before.files.workspace_source|Where-Object{$_.path -eq $reportRelative}).Count -gt 0
$taskChanges=Compare-Entries $beforeTask $taskEntries 'ui_task_source'
$workspaceChanges=Compare-Entries $beforeWorkspace $workspaceEntries 'workspace_source'
$taskChangedPaths=@($taskChanges|ForEach-Object{$_.path})
$coreChanges=@()
foreach($corePath in $ConcurrentCorePaths){
    $match=@($workspaceChanges|Where-Object{$_.path -eq $corePath})
    if($match.Count -ne 1){throw "CONCURRENT_CORE_CHANGE_NOT_FOUND: $corePath"}
    $coreChanges += [ordered]@{path=$corePath;change=$match[0].change;classification='concurrent_core'}
}
$unrelated=@($workspaceChanges|Where-Object{$taskChangedPaths -notcontains $_.path -and $ConcurrentCorePaths -notcontains $_.path}|ForEach-Object{[ordered]@{path=$_.path;change=$_.change;classification='unrelated_workspace_change'}})
$metadataChanges=@([ordered]@{path=$reportRelative;change=if($beforeHadReport){'modified'}else{'added'};classification='evidence_metadata'})

$manifest=[ordered]@{
    schema_version='2.0';kind='P10-COMP-03A-post-baseline';repository_root=$root
    generated_at_utc=(Get-Date).ToUniversalTime().ToString('o');git_present=(Test-Path -LiteralPath (Join-Path $root '.git'))
    git_status=if(Test-Path -LiteralPath (Join-Path $root '.git')){'PRESENT_NOT_QUERIED'}else{'ABSENT'}
    workspace_source_id=$workspaceId;task_source_id=$taskId;evidence_metadata_id=$metadataId
    workspace_file_count=$workspaceEntries.Count;planned_path_count=$plannedEntries.Count
    task_source_file_count=$taskEntries.Count;evidence_metadata_file_count=$metadataEntries.Count
    excluded_directories=$excludedDirectoryNames;excluded_secret_patterns=@('.env','.env.*');excluded_evidence_prefixes=$excludedPrefixes
    files=[ordered]@{workspace_source=$workspaceEntries;planned_paths=$plannedEntries;task_source=$taskEntries;evidence_metadata=$metadataEntries}
}
$diff=[ordered]@{
    schema_version='2.0';before_workspace_source_id=$before.workspace_source_id;after_workspace_source_id=$workspaceId
    before_task_source_id=(Get-DeterministicId $beforeTask);after_task_source_id=$taskId
    before_evidence_metadata_id=$before.evidence_metadata_id;after_evidence_metadata_id=$metadataId
    task_changes=$taskChanges;evidence_metadata_changes=$metadataChanges;concurrent_core=$coreChanges;unrelated_workspace_changes=$unrelated
    counts=[ordered]@{task=$taskChanges.Count;concurrent_core=$coreChanges.Count;unrelated=$unrelated.Count;evidence_metadata=$metadataChanges.Count}
}
$manifest|ConvertTo-Json -Depth 9|Set-Content -Encoding UTF8 -LiteralPath (Join-Path $OutputDirectory 'baseline-manifest.json')
$diff|ConvertTo-Json -Depth 8|Set-Content -Encoding UTF8 -LiteralPath (Join-Path $OutputDirectory 'scoped-diff.json')
$workspaceId|Set-Content -NoNewline -Encoding ascii -LiteralPath (Join-Path $OutputDirectory 'WORKSPACE_SOURCE_ID.txt')
$taskId|Set-Content -NoNewline -Encoding ascii -LiteralPath (Join-Path $OutputDirectory 'TASK_SOURCE_ID.txt')
$metadataId|Set-Content -NoNewline -Encoding ascii -LiteralPath (Join-Path $OutputDirectory 'EVIDENCE_METADATA_ID.txt')
Write-Output "POST BASELINE PASS workspace=$workspaceId/$($workspaceEntries.Count) task=$taskId/$($taskEntries.Count) planned=$($plannedEntries.Count) metadata=$metadataId/$($metadataEntries.Count) scoped=$($taskChanges.Count)/$($coreChanges.Count)/$($unrelated.Count)/$($metadataChanges.Count)"
exit 0
