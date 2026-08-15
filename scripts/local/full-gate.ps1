[CmdletBinding()]
param(
    [string]$ConfigPath = 'local-gate.config.json',
    [string]$EvidenceRoot,
    [string]$RunId,
    [string]$ExistingEvidencePath,
    [switch]$NoLock
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'gate-common.ps1')

try {
    $config = Read-GateConfig -ConfigPath $ConfigPath
    $script:activeGateConfig = $config
    if ([string]::IsNullOrWhiteSpace($RunId)) { $RunId = New-GateRunId -GateName 'FULL' }
    $standalone = [string]::IsNullOrWhiteSpace($ExistingEvidencePath)
    $evidencePath = if ($standalone) { New-GateEvidencePath -Config $config -RunId $RunId -EvidenceRoot $EvidenceRoot } else { Resolve-GatePath -Path $ExistingEvidencePath }
    $lockPath = Resolve-GatePath -Path ([string]$config.lockPath) -AllowMissing
    $lockHandle = $null
    try {
        if (-not $NoLock) { $lockHandle = Enter-GateLock -Path $lockPath }
        $groups = @()
        if ($standalone) { $groups += Invoke-GateGroup -Config $config -GroupName 'quick' -EvidencePath $evidencePath -RunId $RunId }
        $groups += Invoke-GateGroup -Config $config -GroupName 'full' -EvidencePath $evidencePath -RunId $RunId
        $allResults = @($groups | ForEach-Object { $_.results })
        $verdict = Get-GateVerdict -Results $allResults
        if ($standalone) { Complete-GateEvidence -GateName 'FULL' -EvidencePath $evidencePath -RunId $RunId -GroupResults $groups -Verdict $verdict }
        Write-Output "FULL_VERDICT=$verdict"
        Write-Output "EVIDENCE_PATH=$evidencePath"
        exit (Get-GateExitCode -Verdict $verdict)
    }
    finally {
        if ($null -ne $lockHandle) { Exit-GateLock -Handle $lockHandle -Path $lockPath }
    }
}
catch {
    $failure = Write-StructuredGateException -GateName 'FULL' -Exception $_.Exception
    Write-Output $failure.json
    exit (Get-GateExitCode -Verdict $failure.verdict)
}
