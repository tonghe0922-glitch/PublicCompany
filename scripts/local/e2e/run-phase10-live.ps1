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
. (Join-Path $PSScriptRoot '..\gate-common.ps1')

try {
    $outcome = Invoke-StandaloneGate -GateName 'PHASE10-LIVE' -GroupName 'phase10Live' -ConfigPath $ConfigPath -EvidenceRoot $EvidenceRoot -RunId $RunId -ExistingEvidencePath $ExistingEvidencePath -NoLock:$NoLock
    Write-Output "PHASE10_LIVE_VERDICT=$($outcome.verdict)"
    Write-Output "EVIDENCE_PATH=$($outcome.evidencePath)"
    exit (Get-GateExitCode -Verdict $outcome.verdict)
}
catch {
    $failure = Write-StructuredGateException -GateName 'PHASE10-LIVE' -Exception $_.Exception
    Write-Output $failure.json
    exit (Get-GateExitCode -Verdict $failure.verdict)
}
