param([Parameter(Mandatory = $true)][string]$PreDirectory)
$ErrorActionPreference = 'Stop'

function Get-DeterministicId([object[]]$Entries) {
    $canonical = $Entries | ConvertTo-Json -Depth 6 -Compress
    if ($null -eq $canonical) { $canonical = '[]' }
    $bytes = [Text.Encoding]::UTF8.GetBytes($canonical)
    return ([BitConverter]::ToString(
        [Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
    )).Replace('-', '')
}

$raw = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PreDirectory 'baseline-manifest.json') | ConvertFrom-Json
$reportPath = 'docs/implementation/ui/P10-COMP-03A_REPORT.md'
$workspace = @($raw.files.workspace_source | Where-Object { $_.path -ne $reportPath })
$task = @($raw.files.task_source | Where-Object { $_.path -ne $reportPath })
$report = @($raw.files.task_source | Where-Object { $_.path -eq $reportPath })
if ($report.Count -ne 1 -or -not $report[0].exists) { throw 'REPORT_PROJECTION_INVALID' }
$metadata = @([ordered]@{
    path = $report[0].path
    sha256 = $report[0].sha256
    bytes = $report[0].bytes
})
$manifest = [ordered]@{
    schema_version = '1.0'
    kind = 'P10-COMP-03A-resubmit-3-pre-2-comparable'
    raw_pre_manifest = 'baseline-manifest.json'
    report_projection_rule = 'exclude report from workspace/task; track report as evidence_metadata'
    workspace_source_id = Get-DeterministicId $workspace
    task_source_id = Get-DeterministicId $task
    evidence_metadata_id = Get-DeterministicId $metadata
    workspace_file_count = $workspace.Count
    task_source_path_count = $task.Count
    task_source_existing_file_count = @($task | Where-Object { $_.exists }).Count
    evidence_metadata_file_count = $metadata.Count
    active_runtime_boundary_before = 'active-runtime-boundary-before.json'
    active_runtime_boundary_after = 'active-runtime-boundary-after.json'
    files = [ordered]@{
        workspace_source = $workspace
        task_source = $task
        evidence_metadata = $metadata
    }
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $PreDirectory 'comparable-manifest.json')
$manifest.workspace_source_id | Set-Content -NoNewline -Encoding ASCII -LiteralPath (Join-Path $PreDirectory 'COMPARABLE_WORKSPACE_SOURCE_ID.txt')
$manifest.task_source_id | Set-Content -NoNewline -Encoding ASCII -LiteralPath (Join-Path $PreDirectory 'COMPARABLE_TASK_SOURCE_ID.txt')
$manifest.evidence_metadata_id | Set-Content -NoNewline -Encoding ASCII -LiteralPath (Join-Path $PreDirectory 'COMPARABLE_EVIDENCE_METADATA_ID.txt')
Write-Output "COMPARABLE PASS workspace=$($manifest.workspace_source_id)/$($workspace.Count) task=$($manifest.task_source_id)/$($task.Count) metadata=$($manifest.evidence_metadata_id)/$($metadata.Count)"
