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

$manifestPath = Join-Path $PreDirectory 'baseline-manifest.json'
$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestPath | ConvertFrom-Json
$relative = 'technical-platform/web/knip.json'
if (@($manifest.files.task_source | Where-Object { $_.path -eq $relative }).Count -ne 0) {
    throw 'KNIP_ALREADY_PRESENT'
}
$workspaceEntry = @($manifest.files.workspace_source | Where-Object { $_.path -eq $relative })
if ($workspaceEntry.Count -ne 1) { throw 'KNIP_WORKSPACE_ENTRY_MISSING' }
$task = @($manifest.files.task_source) + @([ordered]@{
    path = $relative
    exists = $true
    sha256 = $workspaceEntry[0].sha256
    bytes = $workspaceEntry[0].bytes
})
$task = @($task | Sort-Object path)
$manifest.kind = 'P10-COMP-03A-resubmit-3-pre-3-baseline'
$manifest.task_source_id = Get-DeterministicId $task
$manifest.task_source_path_count = $task.Count
$manifest.task_source_existing_file_count = @($task | Where-Object { $_.exists }).Count
$manifest.files.task_source = $task
$manifest | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -LiteralPath $manifestPath
$manifest.task_source_id | Set-Content -NoNewline -Encoding ASCII -LiteralPath (Join-Path $PreDirectory 'TASK_SOURCE_ID.txt')
Write-Output "PRE3 UPGRADE PASS workspace=$($manifest.workspace_source_id)/$($manifest.workspace_file_count) task=$($manifest.task_source_id)/$($task.Count) existing=$($manifest.task_source_existing_file_count) metadata=$($manifest.evidence_metadata_id)/$($manifest.evidence_metadata_file_count)"
