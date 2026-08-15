param(
    [Parameter(Mandatory = $true)][string]$PreManifest,
    [Parameter(Mandatory = $true)][string]$PostManifest
)

$ErrorActionPreference = 'Stop'
$pre = Get-Content -LiteralPath $PreManifest -Raw -Encoding UTF8 | ConvertFrom-Json
$post = Get-Content -LiteralPath $PostManifest -Raw -Encoding UTF8 | ConvertFrom-Json
$postByPath = @{}
foreach ($entry in $post.files.task_source) { $postByPath[$entry.path] = $entry }

$ordered = @()
foreach ($before in $pre.files.task_source) {
    if (-not $postByPath.ContainsKey($before.path)) { throw "TASK_PATH_MISSING: $($before.path)" }
    $after = $postByPath[$before.path]
    if ($before.sha256 -ne $after.sha256 -or [long]$before.bytes -ne [long]$after.bytes -or [bool]$before.exists -ne [bool]$after.exists) {
        throw "TASK_CONTENT_CHANGED: $($before.path)"
    }
    $ordered += [ordered]@{
        path = $after.path
        exists = [bool]$after.exists
        sha256 = $after.sha256
        bytes = [long]$after.bytes
    }
}

$canonical = $ordered | ConvertTo-Json -Depth 6 -Compress
$bytes = [Text.Encoding]::UTF8.GetBytes($canonical)
$taskId = ([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($bytes))).Replace('-', '')
$post.files.task_source = $ordered
$post.task_source_id = $taskId
$post | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $PostManifest -Encoding UTF8
$taskId | Set-Content -LiteralPath (Join-Path (Split-Path -Parent $PostManifest) 'TASK_SOURCE_ID.txt') -NoNewline -Encoding ASCII

if ($taskId -ne $pre.task_source_id) { throw "TASK_ID_MISMATCH: pre=$($pre.task_source_id) post=$taskId" }
Write-Output "TASK_ORDER_NORMALIZED content_diff=0 task=$taskId/$($ordered.Count)"
