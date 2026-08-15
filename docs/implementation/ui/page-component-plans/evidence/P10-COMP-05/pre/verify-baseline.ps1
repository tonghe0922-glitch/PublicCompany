param(
    [Parameter(Mandatory=$true)][string]$RepositoryRoot,
    [Parameter(Mandatory=$true)][string]$EvidenceDirectory
)
$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath $RepositoryRoot).Path
$manifest=Get-Content -LiteralPath (Join-Path $EvidenceDirectory 'baseline-manifest.json') -Raw|ConvertFrom-Json
$expectedPids=@(15196,35248,36432,40796,41392,43248,44872)
$freshPorts=@(18088,5316,5317,5318,18089,5326,5327,5328,18090,5330,5331,5332)
$trackedPorts=@(5173,5174,5175)+$freshPorts

function RuntimeSnapshot {
    $processes=@(Get-CimInstance Win32_Process|Where-Object{$expectedPids-contains[int]$_.ProcessId}|Sort-Object ProcessId|ForEach-Object{
        [ordered]@{pid=[int]$_.ProcessId;parent_pid=[int]$_.ParentProcessId;name=$_.Name;created=$_.CreationDate.ToUniversalTime().ToString('o');command_line=$_.CommandLine}
    })
    $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue|Where-Object{$_.LocalPort-in$trackedPorts}|Sort-Object LocalPort|ForEach-Object{
        [ordered]@{address=$_.LocalAddress;port=[int]$_.LocalPort;pid=[int]$_.OwningProcess}
    })
    $testcontainers=@(docker ps -q --filter 'label=org.testcontainers=true')
    $ryuk=@(docker ps -q --filter 'ancestor=testcontainers/ryuk:0.12.0')
    return [ordered]@{
        captured_at_utc=(Get-Date).ToUniversalTime().ToString('o')
        classification='pre-existing active runtime / source-baseline non-writer'
        expected_process_ids=$expectedPids
        process_count=$processes.Count
        processes=$processes
        listener_count=$listeners.Count
        listeners=$listeners
        fresh_ports=$freshPorts
        fresh_listener_count=@($listeners|Where-Object{$_.port-in$freshPorts}).Count
        running_testcontainers_count=$testcontainers.Count
        running_testcontainers=$testcontainers
        running_ryuk_count=$ryuk.Count
        running_ryuk=$ryuk
    }
}

$after=RuntimeSnapshot
$after|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $EvidenceDirectory 'active-runtime-boundary-after.json') -Encoding UTF8
$before=Get-Content -LiteralPath (Join-Path $EvidenceDirectory 'active-runtime-boundary-before.json') -Raw|ConvertFrom-Json

$diff=@()
foreach($entry in @($manifest.files.task_source)){
    $path=Join-Path $root ($entry.path-replace'/','\')
    $exists=Test-Path -LiteralPath $path -PathType Leaf
    if($exists-ne[bool]$entry.exists){
        $diff+=[ordered]@{path=$entry.path;reason='exists';before=$entry.exists;after=$exists}
        continue
    }
    if($exists){
        $sha=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
        $bytes=(Get-Item -LiteralPath $path).Length
        if($sha-ne$entry.sha256-or$bytes-ne[int64]$entry.bytes){
            $diff+=[ordered]@{path=$entry.path;reason='content';before_sha=$entry.sha256;after_sha=$sha;before_bytes=$entry.bytes;after_bytes=$bytes}
        }
    }
}
$check=[ordered]@{
    checked_at_utc=(Get-Date).ToUniversalTime().ToString('o')
    planned_count=@($manifest.files.task_source).Count
    existing_count=@($manifest.files.task_source|Where-Object exists).Count
    missing_count=@($manifest.files.task_source|Where-Object{-not$_.exists}).Count
    mismatch_count=$diff.Count
    mismatches=$diff
}
$check|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $EvidenceDirectory 'candidate-after-check.json') -Encoding UTF8

$beforePids=@($before.processes.pid|Sort-Object)
$afterPids=@($after.processes.pid|Sort-Object)
$beforeListeners=@($before.listeners|ForEach-Object{"$($_.port):$($_.pid)"}|Sort-Object)
$afterListeners=@($after.listeners|ForEach-Object{"$($_.port):$($_.pid)"}|Sort-Object)
$summary=[ordered]@{
    workspace_id=$manifest.workspace_source_id
    workspace_count=$manifest.workspace_file_count
    task_id=$manifest.task_source_id
    task_count=$manifest.task_source_path_count
    task_existing=$manifest.task_source_existing_file_count
    task_missing=$manifest.task_source_missing_file_count
    metadata_id=$manifest.evidence_metadata_id
    metadata_count=$manifest.evidence_metadata_file_count
    git_status=$manifest.git_status
    package_local_00_exit=$manifest.package_local_00_exit
    package_local_01_exit=$manifest.package_local_01_exit
    project_preflight_exit=$manifest.project_preflight_exit
    before_process_count=$before.process_count
    after_process_count=$after.process_count
    same_process_ids=(Compare-Object $beforePids $afterPids).Count-eq0
    before_listener_count=$before.listener_count
    after_listener_count=$after.listener_count
    same_listener_owners=(Compare-Object $beforeListeners $afterListeners).Count-eq0
    fresh_listener_count=$after.fresh_listener_count
    running_testcontainers_count=$after.running_testcontainers_count
    running_ryuk_count=$after.running_ryuk_count
    candidate_mismatch_count=$diff.Count
}
$summary|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $EvidenceDirectory 'baseline-summary.json') -Encoding UTF8
$summary|ConvertTo-Json -Compress
if($after.process_count-ne7-or-not$summary.same_process_ids-or-not$summary.same_listener_owners-or$after.fresh_listener_count-ne0-or$after.running_testcontainers_count-ne0-or$after.running_ryuk_count-ne0-or$diff.Count-ne0){exit 9}
