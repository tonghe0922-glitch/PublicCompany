[CmdletBinding()]
param(
    [string]$ConfigPath = 'local-gate.config.json',
    [string]$EvidenceRoot,
    [string]$RunId,
    [switch]$SkipBootstrap,
    [switch]$SkipFull,
    [switch]$SkipLive
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'gate-common.ps1')

function New-SkipFailureGroup {
    param([Parameter(Mandatory = $true)][string]$Name)
    $result = New-InvalidStepResult -Id "$Name-skipped" -Message "mandatory release stage $Name was explicitly skipped"
    return [pscustomobject]@{ group = $Name; verdict = 'FAIL'; results = @($result); path = $null }
}

function Invoke-ChildGate {
    param(
        [Parameter(Mandatory = $true)][string]$ScriptPath,
        [Parameter(Mandatory = $true)][string]$ConfigPath,
        [Parameter(Mandatory = $true)][string]$RunId,
        [Parameter(Mandatory = $true)][string]$EvidencePath,
        [Parameter(Mandatory = $true)][string]$GroupName
    )
    $powerShell = Join-Path $PSHOME 'powershell.exe'
    if (-not (Test-Path -LiteralPath $powerShell)) { $powerShell = (Get-Process -Id $PID).Path }
    $output = @(& $powerShell -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $ScriptPath -ConfigPath $ConfigPath -RunId $RunId -ExistingEvidencePath $EvidencePath -NoLock 2>&1)
    $exitCode = $LASTEXITCODE
    $logPath = Join-Path $EvidencePath "commands/release-invoke-$GroupName.log"
    $safeOutput = $output | ForEach-Object { Protect-GateText -Text "$_" -Config $script:releaseConfig }
    [IO.File]::WriteAllLines($logPath, @("START_UTC=$((Get-Date).ToUniversalTime().ToString('o'))") + $safeOutput + @("END_UTC=$((Get-Date).ToUniversalTime().ToString('o'))", "EXIT_CODE=$exitCode"), [Text.UTF8Encoding]::new($false))
    $resultPath = Join-Path $EvidencePath "gate-result-$GroupName.json"
    if (-not (Test-Path -LiteralPath $resultPath)) {
        $failure = New-InvalidStepResult -Id "$GroupName-child" -Message "child gate exited $exitCode without result JSON"
        return [pscustomobject]@{ group = $GroupName; verdict = 'FAIL'; results = @($failure); path = $resultPath }
    }
    $record = Get-Content -Raw -Encoding UTF8 -LiteralPath $resultPath | ConvertFrom-Json
    return [pscustomobject]@{ group = $record.group; verdict = $record.verdict; results = @($record.results); path = $resultPath }
}

$lockHandle = $null
$evidencePath = $null
$groups = [System.Collections.Generic.List[object]]::new()
$cleanupExit = 1
$orchestratorVerdict = 'FAIL'
try {
    $script:releaseConfig = Read-GateConfig -ConfigPath $ConfigPath
    $script:activeGateConfig = $releaseConfig
    $resolvedConfig = Resolve-GatePath -Path $ConfigPath
    if ([string]::IsNullOrWhiteSpace($RunId)) { $RunId = New-GateRunId -GateName 'RELEASE' }
    $evidencePath = New-GateEvidencePath -Config $releaseConfig -RunId $RunId -EvidenceRoot $EvidenceRoot
    $lockPath = Resolve-GatePath -Path ([string]$releaseConfig.lockPath) -AllowMissing
    $lockHandle = Enter-GateLock -Path $lockPath

    if ($SkipBootstrap) { $groups.Add((New-SkipFailureGroup -Name 'bootstrap')) }
    else { $groups.Add((Invoke-GateGroup -Config $releaseConfig -GroupName 'bootstrap' -EvidencePath $evidencePath -RunId $RunId)) }

    $quickScript = Join-Path $PSScriptRoot 'quick-gate.ps1'
    $groups.Add((Invoke-ChildGate -ScriptPath $quickScript -ConfigPath $resolvedConfig -RunId $RunId -EvidencePath $evidencePath -GroupName 'quick'))

    if ($SkipFull) { $groups.Add((New-SkipFailureGroup -Name 'full')) }
    else {
        $fullScript = Join-Path $PSScriptRoot 'full-gate.ps1'
        $groups.Add((Invoke-ChildGate -ScriptPath $fullScript -ConfigPath $resolvedConfig -RunId $RunId -EvidencePath $evidencePath -GroupName 'full'))
    }

    if ($SkipLive) {
        $groups.Add((New-SkipFailureGroup -Name 'phase10Live'))
        $groups.Add((New-SkipFailureGroup -Name 'phase11Live'))
    }
    else {
        $phase10Script = Join-Path $PSScriptRoot 'e2e\run-phase10-live.ps1'
        $phase11Script = Join-Path $PSScriptRoot 'e2e\run-phase11-live.ps1'
        $groups.Add((Invoke-ChildGate -ScriptPath $phase10Script -ConfigPath $resolvedConfig -RunId $RunId -EvidencePath $evidencePath -GroupName 'phase10Live'))
        $groups.Add((Invoke-ChildGate -ScriptPath $phase11Script -ConfigPath $resolvedConfig -RunId $RunId -EvidencePath $evidencePath -GroupName 'phase11Live'))
    }
}
catch {
    $orchestratorVerdict = Get-GateExceptionVerdict -Exception $_.Exception
    $classification = if ($orchestratorVerdict -eq 'ENVIRONMENT_BLOCKED') { 'ENVIRONMENT_BLOCKED' } else { 'CODE_FAILURE' }
    $groups.Add([pscustomobject]@{ group = 'release-orchestrator'; verdict = $orchestratorVerdict; results = @(New-InvalidStepResult -Id 'release-exception' -Message $_.Exception.Message -Classification $classification); path = $null })
}
finally {
    if ($null -ne $evidencePath) {
        try {
            $powerShell = Join-Path $PSHOME 'powershell.exe'
            if (-not (Test-Path -LiteralPath $powerShell)) { $powerShell = (Get-Process -Id $PID).Path }
            $cleanupScript = Join-Path $PSScriptRoot 'cleanup-gate.ps1'
            $cleanupOutput = @(& $powerShell -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $cleanupScript -ConfigPath (Resolve-GatePath -Path $ConfigPath) -RunId $RunId -ExistingEvidencePath $evidencePath -NoLock 2>&1)
            $cleanupExit = $LASTEXITCODE
            [IO.File]::WriteAllLines((Join-Path $evidencePath 'commands/release-invoke-cleanup.log'), @($cleanupOutput | ForEach-Object { Protect-GateText -Text "$_" -Config $script:releaseConfig }) + @("EXIT_CODE=$cleanupExit"), [Text.UTF8Encoding]::new($false))
            $cleanupResultPath = Join-Path $evidencePath 'gate-result-cleanup.json'
            if (Test-Path -LiteralPath $cleanupResultPath) {
                $cleanupRecord = Get-Content -Raw -Encoding UTF8 -LiteralPath $cleanupResultPath | ConvertFrom-Json
                $expectedCleanupExit = Get-GateExitCode -Verdict $cleanupRecord.verdict
                if ($cleanupExit -ne $expectedCleanupExit) {
                    $mismatch = New-InvalidStepResult -Id 'cleanup-exit-mismatch' -Message "cleanup record verdict $($cleanupRecord.verdict) requires exit $expectedCleanupExit but child returned $cleanupExit"
                    $groups.Add([pscustomobject]@{ group = 'cleanup'; verdict = 'FAIL'; results = @($cleanupRecord.results) + @($mismatch); path = $cleanupResultPath })
                }
                else {
                    $groups.Add([pscustomobject]@{ group = 'cleanup'; verdict = $cleanupRecord.verdict; results = @($cleanupRecord.results); path = $cleanupResultPath })
                }
            }
            else {
                $groups.Add([pscustomobject]@{ group = 'cleanup'; verdict = 'FAIL'; results = @(New-InvalidStepResult -Id 'cleanup-missing-result' -Message "cleanup exited $cleanupExit without result JSON"); path = $cleanupResultPath })
            }
        }
        catch {
            $groups.Add([pscustomobject]@{ group = 'cleanup'; verdict = 'FAIL'; results = @(New-InvalidStepResult -Id 'cleanup-exception' -Message $_.Exception.Message); path = $null })
        }
        $allStepResults = @($groups | ForEach-Object { $_.results })
        $verdict = Get-GateVerdict -Results $allStepResults
        if (@($groups | Where-Object { $_.verdict -eq 'FAIL' }).Count -gt 0) { $verdict = 'FAIL' }
        elseif (@($groups | Where-Object { $_.verdict -eq 'ENVIRONMENT_BLOCKED' }).Count -gt 0) { $verdict = 'ENVIRONMENT_BLOCKED' }
        try { Complete-GateEvidence -GateName 'RELEASE' -EvidencePath $evidencePath -RunId $RunId -GroupResults @($groups) -Verdict $verdict }
        catch { $verdict = 'FAIL'; Write-Error $_ }
        Write-Output "RELEASE_VERDICT=$verdict"
        Write-Output "EVIDENCE_PATH=$evidencePath"
    }
    else {
        $failure = Write-StructuredGateException -GateName 'RELEASE' -Exception ([UnauthorizedAccessException]::new('evidence root is unavailable'))
        Write-Output $failure.json
        $verdict = $failure.verdict
        if ($orchestratorVerdict -eq 'FAIL') { $verdict = 'FAIL' }
    }
    if ($null -ne $lockHandle) { Exit-GateLock -Handle $lockHandle -Path (Resolve-GatePath -Path ([string]$script:releaseConfig.lockPath) -AllowMissing) }
}

exit (Get-GateExitCode -Verdict $verdict)
