param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][string]$OutputDirectory,
    [int]$PackagePreflightExit = 1,
    [int]$PackageBaselineExit = 1,
    [int]$ProjectPreflightExit = 0
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $RepositoryRoot).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$plannedPaths = @(
    'technical-platform/web/src/design-system/components/Select.vue',
    'technical-platform/web/src/design-system/components/PersonPicker.vue',
    'technical-platform/web/src/design-system/components/OrganizationPicker.vue',
    'technical-platform/web/src/design-system/components/Drawer.vue',
    'technical-platform/web/src/design-system/component-vtu.test.ts',
    'technical-platform/web/src/design-system/runtime-primitives.test.ts',
    'technical-platform/web/src/design-system/tokens.css',
    'technical-platform/web/src/design-system/foundation.test.ts',
    'technical-platform/web/src/design-system/COMPONENT_CONTRACTS.md',
    'technical-platform/web/src/router/PortalNavigation.vue'
)

$excludedDirectoryNames = @(
    '.git', '.runlogs', '__pycache__', 'node_modules', 'target', 'dist',
    'reports', 'test-results', 'playwright-report', 'coverage'
)
$excludedPrefixes = @(
    'docs/implementation/phases/PHASE-10/evidence/P10-COMP-00/',
    'technical-platform/web/src/design-system/evidence/P10-COMP-01/'
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
            if ($childRelative.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
                $prefixExcluded = $true
                break
            }
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
    if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
        $file = Get-Item -LiteralPath $fullPath
        $taskEntries += [ordered]@{
            path = $relative
            exists = $true
            sha256 = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash
            bytes = $file.Length
        }
    } else {
        $taskEntries += [ordered]@{
            path = $relative
            exists = $false
            sha256 = $null
            bytes = 0
        }
    }
}
$taskEntries = @($taskEntries | Sort-Object path)
$evidenceMetadataEntries = @()

$workspaceId = Get-DeterministicId $workspaceEntries
$taskId = Get-DeterministicId $taskEntries
$metadataId = Get-DeterministicId $evidenceMetadataEntries
$gitPresent = Test-Path -LiteralPath (Join-Path $root '.git')
$manifest = [ordered]@{
    schema_version = '1.0'
    kind = 'P10-COMP-01-pre-claim-baseline'
    repository_root = $root
    generated_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    git_present = $gitPresent
    git_status = if ($gitPresent) { 'PRESENT_NOT_QUERIED' } else { 'ABSENT' }
    workspace_source_id = $workspaceId
    task_source_id = $taskId
    evidence_metadata_id = $metadataId
    workspace_file_count = $workspaceEntries.Count
    task_source_path_count = $taskEntries.Count
    task_source_existing_file_count = @($taskEntries | Where-Object { $_.exists }).Count
    evidence_metadata_file_count = 0
    package_local_preflight_exit = $PackagePreflightExit
    package_local_baseline_exit = $PackageBaselineExit
    project_preflight_exit = $ProjectPreflightExit
    excluded_directories = $excludedDirectoryNames
    excluded_secret_patterns = @('.env', '.env.*')
    excluded_evidence_prefixes = $excludedPrefixes
    files = [ordered]@{
        workspace_source = $workspaceEntries
        task_source = $taskEntries
        evidence_metadata = $evidenceMetadataEntries
    }
}

$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'baseline-manifest.json') -Encoding utf8
$workspaceId | Set-Content -LiteralPath (Join-Path $OutputDirectory 'WORKSPACE_SOURCE_ID.txt') -NoNewline -Encoding ascii
$taskId | Set-Content -LiteralPath (Join-Path $OutputDirectory 'TASK_SOURCE_ID.txt') -NoNewline -Encoding ascii
$metadataId | Set-Content -LiteralPath (Join-Path $OutputDirectory 'EVIDENCE_METADATA_ID.txt') -NoNewline -Encoding ascii
Write-Output "BASELINE PASS workspace=$workspaceId/$($workspaceEntries.Count) task=$taskId/$($taskEntries.Count) existing=$(@($taskEntries | Where-Object { $_.exists }).Count) metadata=$metadataId/0"
exit 0
