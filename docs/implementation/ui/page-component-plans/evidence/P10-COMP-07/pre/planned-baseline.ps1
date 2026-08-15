param(
    [Parameter(Mandatory=$true)][string]$RepositoryRoot,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [int]$PackageLocal00Exit=1,
    [int]$PackageLocal01Exit=1,
    [int]$ProjectPreflightExit=0
)
$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath $RepositoryRoot).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$planned=@(
    'technical-platform/web/src/router/portal-router.ts',
    'technical-platform/web/src/router/core-routes.ts',
    'technical-platform/web/src/router/phase09-routes.ts',
    'technical-platform/web/src/router/phase10-routes.ts',
    'technical-platform/web/src/router/route-meta.d.ts',
    'technical-platform/web/src/contracts/route.ts',
    'technical-platform/web/src/contracts/index.ts',
    'technical-platform/web/src/router/route-module-boundary.test.ts',
    'technical-platform/web/src/router/route-semantics.test.ts',
    'technical-platform/web/src/router/phase10-tech-monitor-router.test.ts',
    'scripts/implementation/phase08_portal_contract.py',
    'docs/implementation/ui/L0-L5_COVERAGE_MATRIX.md',
    'docs/implementation/ui/page-component-plans/P10-COMP-07_REPORT.md'
)
$excludedNames=@('.git','.runlogs','__pycache__','node_modules','target','dist','reports','test-results','playwright-report','coverage')
$excludedPrefixes=@(
    'docs/implementation/phases/PHASE-10/evidence/P10-COMP-00/',
    'technical-platform/web/src/design-system/evidence/P10-COMP-01/',
    'technical-platform/web/src/router/evidence/P10-COMP-02/',
    'docs/implementation/ui/evidence/P10-COMP-03A/',
    'docs/implementation/ui/evidence/P10-COMP-03/',
    'docs/implementation/ui/page-component-plans/evidence/P10-COMP-04/',
    'docs/implementation/ui/page-component-plans/evidence/P10-COMP-05/',
    'docs/implementation/ui/page-component-plans/evidence/P10-COMP-06/',
    'docs/implementation/ui/page-component-plans/evidence/P10-COMP-07/'
)
function Get-ManifestId([object[]]$Items){
    $json=$Items | ConvertTo-Json -Depth 6 -Compress
    if($null -eq $json){$json='[]'}
    return ([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($json)))).Replace('-','')
}
function Get-RelativePath([string]$FullPath){
    $prefix=$root.TrimEnd('\')+'\'
    if(-not $FullPath.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)){throw "OUTSIDE: $FullPath"}
    return $FullPath.Substring($prefix.Length).Replace('\','/')
}
function Test-Excluded([string]$RelativePath){
    if($RelativePath -match '(^|/)\.env(?:\..*)?$'){return $true}
    foreach($prefix in $excludedPrefixes){if($RelativePath.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)){return $true}}
    return $false
}
if(@($planned | Sort-Object -Unique).Count -ne 13){throw 'PLANNED_PATHS_NOT_UNIQUE_13'}
$workspace=@()
$seen=@{}
$stack=New-Object 'System.Collections.Generic.Stack[System.IO.DirectoryInfo]'
$stack.Push((Get-Item -LiteralPath $root))
while($stack.Count -gt 0){
    $directory=$stack.Pop()
    foreach($childDirectory in @(Get-ChildItem -LiteralPath $directory.FullName -Directory -Force)){
        if($childDirectory.Attributes -band [IO.FileAttributes]::ReparsePoint){continue}
        if($excludedNames -contains $childDirectory.Name){continue}
        $relativeDirectory=(Get-RelativePath $childDirectory.FullName)+'/'
        $skip=$false
        foreach($prefix in $excludedPrefixes){if($relativeDirectory.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)){$skip=$true;break}}
        if(-not $skip){$stack.Push($childDirectory)}
    }
    foreach($file in @(Get-ChildItem -LiteralPath $directory.FullName -File -Force)){
        $relative=Get-RelativePath $file.FullName
        if(Test-Excluded $relative){continue}
        $key=$relative.ToLowerInvariant()
        if($seen.ContainsKey($key)){throw "DUPLICATE: $relative"}
        $seen[$key]=$relative
        $workspace += [ordered]@{path=$relative;sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash;bytes=$file.Length}
    }
}
$workspace=@($workspace | Sort-Object path)
$task=@()
foreach($relative in $planned){
    $fullPath=Join-Path $root $relative
    if(Test-Path -LiteralPath $fullPath -PathType Leaf){
        $item=Get-Item -LiteralPath $fullPath
        $task += [ordered]@{path=$relative;exists=$true;sha256=(Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash;bytes=$item.Length}
    } else {
        $task += [ordered]@{path=$relative;exists=$false;sha256=$null;bytes=0}
    }
}
$task=@($task | Sort-Object path)
$metadata=@()
$manifest=[ordered]@{
    schema_version='1.0';kind='P10-COMP-07-pre-baseline';repository_root=$root;generated_at_utc=(Get-Date).ToUniversalTime().ToString('o')
    git_present=(Test-Path -LiteralPath (Join-Path $root '.git'));git_status=if(Test-Path -LiteralPath (Join-Path $root '.git')){'PRESENT_NOT_QUERIED'}else{'ABSENT'}
    workspace_source_id=Get-ManifestId $workspace;task_source_id=Get-ManifestId $task;evidence_metadata_id=Get-ManifestId $metadata
    workspace_file_count=$workspace.Count;task_source_path_count=$task.Count
    task_source_existing_file_count=@($task | Where-Object {$_.exists}).Count;task_source_missing_file_count=@($task | Where-Object {-not $_.exists}).Count
    evidence_metadata_file_count=0;package_local_00_exit=$PackageLocal00Exit;package_local_01_exit=$PackageLocal01Exit;project_preflight_exit=$ProjectPreflightExit
    runtime_boundary='pre-existing active runtime / source-baseline non-writer';runtime_before='runtime-before.json';runtime_after='runtime-after.json'
    fixture_ports=@();excluded_directories=$excludedNames;excluded_evidence_prefixes=$excludedPrefixes
    files=[ordered]@{workspace_source=$workspace;task_source=$task;evidence_metadata=$metadata}
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'baseline-manifest.json') -Encoding utf8
$manifest.workspace_source_id | Set-Content -LiteralPath (Join-Path $OutputDirectory 'WORKSPACE_SOURCE_ID.txt') -NoNewline -Encoding ascii
$manifest.task_source_id | Set-Content -LiteralPath (Join-Path $OutputDirectory 'TASK_SOURCE_ID.txt') -NoNewline -Encoding ascii
$manifest.evidence_metadata_id | Set-Content -LiteralPath (Join-Path $OutputDirectory 'EVIDENCE_METADATA_ID.txt') -NoNewline -Encoding ascii

$expectedProcessIds=@(15196,35248,36432,40796,41392,43248,44872)
$processes=@(Get-CimInstance Win32_Process | Where-Object {$expectedProcessIds -contains [int]$_.ProcessId} | Sort-Object ProcessId | ForEach-Object {[ordered]@{pid=[int]$_.ProcessId;parent_pid=[int]$_.ParentProcessId;name=$_.Name;created=$_.CreationDate.ToUniversalTime().ToString('o');command_line=$_.CommandLine}})
$listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object {$expectedProcessIds -contains [int]$_.OwningProcess} | Sort-Object LocalPort,OwningProcess | ForEach-Object {[ordered]@{address=$_.LocalAddress;port=[int]$_.LocalPort;owner_pid=[int]$_.OwningProcess}})
$runningContainers=@(docker ps --format '{{json .}}' | ForEach-Object {$_ | ConvertFrom-Json})
if($LASTEXITCODE -ne 0){throw "DOCKER_PS_FAILED exit=$LASTEXITCODE"}
$testcontainersRyuk=@($runningContainers | Where-Object {($_.Labels -match 'org\.testcontainers') -or ($_.Names -match 'ryuk') -or ($_.Image -match 'testcontainers/ryuk')})
$after=[ordered]@{captured_at_utc=(Get-Date).ToUniversalTime().ToString('o');classification='pre-existing active runtime / source-baseline non-writer';expected_process_ids=$expectedProcessIds;process_count=$processes.Count;processes=$processes;listener_count=$listeners.Count;listeners=$listeners;listener_ports=@($listeners | ForEach-Object {$_.port} | Sort-Object -Unique);running_container_count=$runningContainers.Count;testcontainers_ryuk_count=$testcontainersRyuk.Count;status='PASS'}
$after | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'runtime-after.json') -Encoding utf8
$before=Get-Content -LiteralPath (Join-Path $OutputDirectory 'runtime-before.json') -Raw -Encoding utf8 | ConvertFrom-Json
$candidateDiff=@()
foreach($entry in @($manifest.files.task_source)){
    $path=Join-Path $root ($entry.path -replace '/','\')
    $exists=Test-Path -LiteralPath $path -PathType Leaf
    if($exists -ne [bool]$entry.exists){$candidateDiff += [ordered]@{path=$entry.path;reason='exists';before=$entry.exists;after=$exists};continue}
    if($exists){
        $sha=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
        $bytes=(Get-Item -LiteralPath $path).Length
        if($sha -ne $entry.sha256 -or $bytes -ne [int64]$entry.bytes){$candidateDiff += [ordered]@{path=$entry.path;reason='content';before_sha=$entry.sha256;after_sha=$sha;before_bytes=$entry.bytes;after_bytes=$bytes}}
    }
}
$candidateCheck=[ordered]@{checked_at_utc=(Get-Date).ToUniversalTime().ToString('o');planned_count=$task.Count;existing_count=@($task | Where-Object {$_.exists}).Count;missing_count=@($task | Where-Object {-not $_.exists}).Count;mismatch_count=$candidateDiff.Count;mismatches=$candidateDiff}
$candidateCheck | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'candidate-after-check.json') -Encoding utf8
$beforeProcessIds=@($before.processes.pid | Sort-Object)
$afterProcessIds=@($after.processes.pid | Sort-Object)
$beforeListeners=@($before.listeners | ForEach-Object {"$($_.port):$($_.owner_pid)"} | Sort-Object)
$afterListeners=@($after.listeners | ForEach-Object {"$($_.port):$($_.owner_pid)"} | Sort-Object)
$expectedPorts=@(5173,5174,5175)
$afterPorts=@($after.listener_ports | Sort-Object -Unique)
$summary=[ordered]@{
    workspace_id=$manifest.workspace_source_id;workspace_count=$manifest.workspace_file_count;task_id=$manifest.task_source_id;task_count=$manifest.task_source_path_count
    task_existing=$manifest.task_source_existing_file_count;task_missing=$manifest.task_source_missing_file_count;metadata_id=$manifest.evidence_metadata_id;metadata_count=$manifest.evidence_metadata_file_count
    git_status=$manifest.git_status;package_local_00_exit=$manifest.package_local_00_exit;package_local_01_exit=$manifest.package_local_01_exit;project_preflight_exit=$manifest.project_preflight_exit
    before_process_count=$before.process_count;after_process_count=$after.process_count;same_process_ids=(Compare-Object $beforeProcessIds $afterProcessIds).Count -eq 0
    before_listener_count=$before.listener_count;after_listener_count=$after.listener_count;same_listener_owners=(Compare-Object $beforeListeners $afterListeners).Count -eq 0
    listener_ports_exact=(Compare-Object $expectedPorts $afterPorts).Count -eq 0;testcontainers_ryuk_count=$after.testcontainers_ryuk_count;candidate_mismatch_count=$candidateDiff.Count
}
$summary | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'baseline-summary.json') -Encoding utf8
$summary | ConvertTo-Json -Compress
if($manifest.task_source_path_count -ne 13 -or $manifest.task_source_existing_file_count -ne 7 -or $manifest.task_source_missing_file_count -ne 6 -or $after.process_count -ne 7 -or -not $summary.same_process_ids -or -not $summary.same_listener_owners -or -not $summary.listener_ports_exact -or $after.testcontainers_ryuk_count -ne 0 -or $candidateDiff.Count -ne 0){exit 9}
