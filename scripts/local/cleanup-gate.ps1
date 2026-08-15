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

function Get-ListeningPortFacts {
    param([int[]]$Ports)
    $facts = @()
    foreach ($port in $Ports) {
        $listeners = @()
        $probeErrors = @()
        $successfulProbeCount = 0
        try {
            $managedListeners = @([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() |
                Where-Object { $_.Port -eq $port } | ForEach-Object {
                    [ordered]@{ source = 'IPGlobalProperties'; localAddress = $_.Address.ToString(); localPort = $_.Port; processId = $null }
                })
            $listeners += $managedListeners
            $successfulProbeCount++
        }
        catch { $probeErrors += "IPGlobalProperties: $($_.Exception.Message)" }
        try {
            if ($null -ne (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) {
                $listeners += @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction Stop | ForEach-Object {
                    [ordered]@{ source = 'Get-NetTCPConnection'; localAddress = $_.LocalAddress; localPort = $_.LocalPort; processId = $_.OwningProcess }
                })
                $successfulProbeCount++
            }
        }
        catch { $probeErrors += "Get-NetTCPConnection: $($_.Exception.Message)" }
        try {
            $listeners += @(& netstat -ano -p tcp 2>&1 | Select-String -Pattern (":$port\s+.*LISTENING") | ForEach-Object {
                [ordered]@{ source = 'netstat'; localAddress = "$_"; localPort = $port; processId = $null }
            })
            if ($LASTEXITCODE -ne 0) { $probeErrors += "netstat: exit $LASTEXITCODE" }
            else { $successfulProbeCount++ }
        }
        catch { $probeErrors += "netstat: $($_.Exception.Message)" }
        $deduplicated = @($listeners | Group-Object { "$($_.localAddress)|$($_.localPort)|$($_.processId)" } | ForEach-Object { $_.Group[0] })
        $probeStatus = if ($successfulProbeCount -gt 0) { 'AVAILABLE' } else { 'UNAVAILABLE' }
        $facts += [ordered]@{
            port = $port
            listenerCount = $deduplicated.Count
            listeners = $deduplicated
            probeStatus = $probeStatus
            probeErrors = $probeErrors
        }
    }
    return $facts
}

function Get-DockerCleanupFacts {
    $containers = @()
    $status = 'UNAVAILABLE'
    $errors = @()
    try {
        $rows = @(& docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Labels}}' 2>&1)
        if ($LASTEXITCODE -eq 0) {
            $status = 'AVAILABLE'
            foreach ($row in $rows) {
                $parts = "$row" -split '\|', 4
                if ($parts.Count -eq 4) {
                    $containers += [ordered]@{ id = $parts[0]; name = $parts[1]; image = $parts[2]; labels = $parts[3] }
                }
            }
        }
        else { $errors += "docker ps exit $LASTEXITCODE" }
    }
    catch { $errors += $_.Exception.Message }
    $testcontainers = @($containers | Where-Object { $_.labels -match 'org\.testcontainers' -or $_.name -match 'testcontainers' })
    $ryuk = @($containers | Where-Object { $_.image -match 'testcontainers/ryuk' -or $_.name -match 'ryuk' })
    return [pscustomobject]@{
        status = $status
        errors = [object[]]@($errors)
        containers = [object[]]@($containers)
        testcontainers = [object[]]@($testcontainers)
        ryuk = [object[]]@($ryuk)
    }
}

function Get-LauncherFacts {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [string[]]$Patterns
    )
    $launchers = @()
    $status = 'UNAVAILABLE'
    $errors = @()
    try {
        $candidates = @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
            $_.ProcessId -ne $PID -and $_.CommandLine -and $_.Name -match 'java|node|cmd|powershell' -and
            $_.CommandLine -like "*$RepoRoot*" -and
            $_.CommandLine -notmatch 'scripts[\\/]local[\\/](release-gate|cleanup-gate)\.ps1'
        })
        foreach ($candidate in $candidates) {
            if ($Patterns.Count -eq 0 -or @($Patterns | Where-Object { $candidate.CommandLine -match [regex]::Escape($_) }).Count -gt 0) {
                $launchers += [ordered]@{ name = $candidate.Name; processId = $candidate.ProcessId; commandLine = $candidate.CommandLine }
            }
        }
        $status = 'AVAILABLE'
    }
    catch { $errors += $_.Exception.Message }
    return [pscustomobject]@{
        status = $status
        errors = [object[]]@($errors)
        launchers = [object[]]@($launchers)
    }
}

function Resolve-CleanupProbeOutcome {
    param(
        [Parameter(Mandatory = $true)][string]$CleanupStepVerdict,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$PortFacts,
        [Parameter(Mandatory = $true)][object]$DockerFacts,
        [Parameter(Mandatory = $true)][object]$LauncherFacts
    )
    $portResiduals = @($PortFacts | Where-Object { $_.listenerCount -gt 0 }).Count
    $residualCount = $portResiduals + @($DockerFacts.testcontainers).Count + @($DockerFacts.ryuk).Count + @($LauncherFacts.launchers).Count
    $unavailable = [System.Collections.Generic.List[string]]::new()
    if (@($PortFacts | Where-Object { $_.probeStatus -ne 'AVAILABLE' }).Count -gt 0) { $unavailable.Add('ports') }
    if ($DockerFacts.status -ne 'AVAILABLE') { $unavailable.Add('docker') }
    if ($LauncherFacts.status -ne 'AVAILABLE') { $unavailable.Add('launchers') }
    if ($residualCount -gt 0) {
        return [pscustomobject]@{ verdict = 'FAIL'; classification = 'RESIDUAL_RESOURCE'; residualCount = $residualCount; unavailableProbes = [object[]]@($unavailable) }
    }
    if ($CleanupStepVerdict -eq 'FAIL') {
        return [pscustomobject]@{ verdict = 'FAIL'; classification = 'CLEANUP_STEP_FAILURE'; residualCount = 0; unavailableProbes = [object[]]@($unavailable) }
    }
    if ($CleanupStepVerdict -eq 'ENVIRONMENT_BLOCKED' -or $unavailable.Count -gt 0) {
        return [pscustomobject]@{ verdict = 'ENVIRONMENT_BLOCKED'; classification = 'ENVIRONMENT_BLOCKED'; residualCount = 0; unavailableProbes = [object[]]@($unavailable) }
    }
    return [pscustomobject]@{ verdict = 'PASS'; classification = 'NONE'; residualCount = 0; unavailableProbes = [object[]]@() }
}

function Invoke-CleanupGateMain {
    param(
        [string]$ConfigPath,
        [string]$EvidenceRoot,
        [string]$RunId,
        [string]$ExistingEvidencePath,
        [switch]$NoLock
    )
    try {
        $config = Read-GateConfig -ConfigPath $ConfigPath
        $script:activeGateConfig = $config
        if ([string]::IsNullOrWhiteSpace($RunId)) { $RunId = New-GateRunId -GateName 'CLEANUP' }
        $standalone = [string]::IsNullOrWhiteSpace($ExistingEvidencePath)
        $evidencePath = if ($standalone) {
            New-GateEvidencePath -Config $config -RunId $RunId -EvidenceRoot $EvidenceRoot
        } else { Resolve-GatePath -Path $ExistingEvidencePath }
        $lockPath = Resolve-GatePath -Path ([string]$config.lockPath) -AllowMissing
        $lockHandle = $null
        try {
            if (-not $NoLock) { $lockHandle = Enter-GateLock -Path $lockPath }
            $cleanupStepGroup = Invoke-GateGroup -Config $config -GroupName 'cleanup' -EvidencePath $evidencePath -RunId $RunId -AllowEmpty
            $ports = Get-ListeningPortFacts -Ports @($config.cleanup.ports | ForEach-Object { [int]$_ })
            $docker = Get-DockerCleanupFacts
            $launcherFacts = Get-LauncherFacts -RepoRoot (Get-GateRepoRoot) -Patterns @($config.cleanup.processPatterns)
            $outcome = Resolve-CleanupProbeOutcome -CleanupStepVerdict $cleanupStepGroup.verdict -PortFacts $ports -DockerFacts $docker -LauncherFacts $launcherFacts
            $cleanupGroup = [pscustomobject]@{
                group = 'cleanup'
                verdict = $outcome.verdict
                results = @($cleanupStepGroup.results)
                path = $cleanupStepGroup.path
            }
            $cleanupRecord = [ordered]@{ schemaVersion = '1.0'; group = 'cleanup'; verdict = $outcome.verdict; classification = $outcome.classification; results = @($cleanupStepGroup.results) }
            [IO.File]::WriteAllText($cleanupStepGroup.path, ($cleanupRecord | ConvertTo-Json -Depth 12), [Text.UTF8Encoding]::new($false))
            $report = [ordered]@{
                schemaVersion = '1.0'; runId = $RunId; verdict = $outcome.verdict; classification = $outcome.classification
                checkedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
                ports = [object[]]@($ports)
                testcontainers = [object[]]@($docker.testcontainers)
                ryuk = [object[]]@($docker.ryuk)
                launchers = [object[]]@($launcherFacts.launchers)
                dockerAvailable = $docker.status -eq 'AVAILABLE'
                dockerProbeStatus = $docker.status
                dockerProbeErrors = [object[]]@($docker.errors)
                launcherProbeAvailable = $launcherFacts.status -eq 'AVAILABLE'
                launcherProbeStatus = $launcherFacts.status
                launcherProbeErrors = [object[]]@($launcherFacts.errors)
                unavailableProbes = [object[]]@($outcome.unavailableProbes)
                cleanupStepVerdict = $cleanupStepGroup.verdict
                residualCount = $outcome.residualCount
                temporaryArtifacts = @(Get-ChildItem -LiteralPath (Join-Path $evidencePath 'temp') -Force -Recurse -ErrorAction SilentlyContinue).Count
            }
            [IO.File]::WriteAllText((Join-Path $evidencePath 'cleanup-report.json'), ($report | ConvertTo-Json -Depth 12), [Text.UTF8Encoding]::new($false))
            if ($standalone) {
                Complete-GateEvidence -GateName 'CLEANUP' -EvidencePath $evidencePath -RunId $RunId -GroupResults @($cleanupGroup) -Verdict $outcome.verdict
            }
            return [pscustomobject]@{
                exitCode = Get-GateExitCode -Verdict $outcome.verdict
                output = @("CLEANUP_VERDICT=$($outcome.verdict)", "EVIDENCE_PATH=$evidencePath")
            }
        }
        finally {
            if ($null -ne $lockHandle) { Exit-GateLock -Handle $lockHandle -Path $lockPath }
        }
    }
    catch {
        $failure = Write-StructuredGateException -GateName 'CLEANUP' -Exception $_.Exception
        return [pscustomobject]@{ exitCode = Get-GateExitCode -Verdict $failure.verdict; output = @($failure.json) }
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    $mainResult = Invoke-CleanupGateMain -ConfigPath $ConfigPath -EvidenceRoot $EvidenceRoot -RunId $RunId -ExistingEvidencePath $ExistingEvidencePath -NoLock:$NoLock
    $mainResult.output | Write-Output
    exit ([int]$mainResult.exitCode)
}
