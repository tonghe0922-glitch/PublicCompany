param(
    [Parameter(Mandatory=$true)][string]$RepositoryRoot,
    [Parameter(Mandatory=$true)][string]$EvidenceDirectory
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $RepositoryRoot).Path
New-Item -ItemType Directory -Force -Path $EvidenceDirectory | Out-Null

$requiredFiles = @(
    'AGENT.md',
    'DESIGN.md',
    'technical-platform/web/package.json',
    'docs/implementation/phases/PHASE-07/SOURCE_CONTRACT.md',
    'docs/implementation/phases/PHASE-07/ADR_DESIGN_SYSTEM_BOUNDARY.md',
    'docs/implementation/phases/PHASE-10/SOURCE_CONTRACT.md',
    'docs/implementation/phases/PHASE-10/START_CHECKLIST.md',
    'docs/implementation/phases/PHASE-10/PHASE_GATE.md'
)
$findings = @()
$fileResults = @()
foreach ($relative in $requiredFiles) {
    $path = Join-Path $root $relative
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        $findings += [ordered]@{code='REQUIRED_FILE_MISSING'; path=$relative; message='Required authority file is missing'}
        $fileResults += [ordered]@{path=$relative; readable=$false; sha256=$null}
        continue
    }
    try {
        $stream = [IO.File]::Open($path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
        $stream.Dispose()
        $fileResults += [ordered]@{path=$relative; readable=$true; sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash}
    } catch {
        $findings += [ordered]@{code='REQUIRED_FILE_UNREADABLE'; path=$relative; message=$_.Exception.Message}
        $fileResults += [ordered]@{path=$relative; readable=$false; sha256=$null}
    }
}

$toolResults = @()
foreach ($tool in @('python','node','pnpm')) {
    $command = Get-Command $tool -ErrorAction SilentlyContinue
    if ($null -eq $command) {
        $findings += [ordered]@{code='TOOL_MISSING'; path=$tool; message='Required tool is not available'}
        $toolResults += [ordered]@{tool=$tool; exit_code=$null; version=$null}
        continue
    }
    try {
        $output = (& $tool --version 2>&1 | Out-String).Trim()
        $exitCode = $LASTEXITCODE
        $toolResults += [ordered]@{tool=$tool; exit_code=$exitCode; version=$output}
        if ($exitCode -ne 0) {
            $findings += [ordered]@{code='TOOL_PROBE_FAILED'; path=$tool; message="Version probe exited $exitCode"}
        }
    } catch {
        $findings += [ordered]@{code='TOOL_PROBE_FAILED'; path=$tool; message=$_.Exception.Message}
        $toolResults += [ordered]@{tool=$tool; exit_code=$null; version=$null}
    }
}

$gitPresent = Test-Path -LiteralPath (Join-Path $root '.git')
$payload = [ordered]@{
    schema_version='2.0'
    kind='phase10-component-preflight'
    repository_root=$root
    timestamp_utc=(Get-Date).ToUniversalTime().ToString('o')
    status=if($findings.Count -eq 0){'PASS'}else{'FAIL'}
    git_present=$gitPresent
    git_status=if($gitPresent){'PRESENT'}else{'ABSENT'}
    powershell_version=$PSVersionTable.PSVersion.ToString()
    required_files=$fileResults
    tools=$toolResults
    findings=$findings
}
$payload | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $EvidenceDirectory 'preflight.json') -Encoding utf8
if ($findings.Count -ne 0) {
    Write-Output "PRECHECK FAIL findings=$($findings.Count)"
    exit 1
}
Write-Output 'PRECHECK PASS'
exit 0
