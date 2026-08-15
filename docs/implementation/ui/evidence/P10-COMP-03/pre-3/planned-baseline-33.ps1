param(
    [Parameter(Mandatory=$true)][string]$RepositoryRoot,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [int]$ProjectPreflightExit=0
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$legacy = Join-Path $OutputDirectory 'legacy-32'
$legacyScript = Join-Path $root 'docs/implementation/ui/evidence/P10-COMP-03/pre-2/planned-baseline-32-corrected.ps1'
& powershell -NoProfile -ExecutionPolicy Bypass -File $legacyScript `
    -RepositoryRoot $root -OutputDirectory $legacy -ProjectPreflightExit $ProjectPreflightExit
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $legacy 'baseline-manifest.json') | ConvertFrom-Json
$relative = 'scripts/implementation/ui_component_access_gate.py'
$path = Join-Path $root ($relative -replace '/', '\')
$item = Get-Item -LiteralPath $path
$task = @($manifest.files.task_source) + [pscustomobject]@{
    path = $relative
    exists = $true
    sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash
    bytes = $item.Length
}
$task = @($task | Sort-Object path)
function Get-Id([object[]]$items) {
    $json = $items | ConvertTo-Json -Depth 6 -Compress
    if ($null -eq $json) { $json = '[]' }
    return ([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($json)))).Replace('-', '')
}
$manifest.kind = 'P10-COMP-03-fresh-pre-3-baseline'
$manifest.generated_at_utc = (Get-Date).ToUniversalTime().ToString('o')
$manifest.task_source_id = Get-Id $task
$manifest.task_source_path_count = $task.Count
$manifest.task_source_existing_file_count = @($task | Where-Object exists).Count
$manifest.task_source_missing_file_count = @($task | Where-Object { -not $_.exists }).Count
$manifest.files.task_source = $task
$manifest | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $OutputDirectory 'baseline-manifest.json')
$manifest.workspace_source_id | Set-Content -NoNewline -Encoding ASCII -LiteralPath (Join-Path $OutputDirectory 'WORKSPACE_SOURCE_ID.txt')
$manifest.task_source_id | Set-Content -NoNewline -Encoding ASCII -LiteralPath (Join-Path $OutputDirectory 'TASK_SOURCE_ID.txt')
$manifest.evidence_metadata_id | Set-Content -NoNewline -Encoding ASCII -LiteralPath (Join-Path $OutputDirectory 'EVIDENCE_METADATA_ID.txt')
Write-Output "BASELINE PASS workspace=$($manifest.workspace_source_id)/$($manifest.workspace_file_count) task=$($manifest.task_source_id)/$($manifest.task_source_path_count) existing=$($manifest.task_source_existing_file_count) missing=$($manifest.task_source_missing_file_count) metadata=$($manifest.evidence_metadata_id)/0 git=$($manifest.git_status)"
