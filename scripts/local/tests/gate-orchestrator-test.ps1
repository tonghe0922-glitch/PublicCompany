[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$failures = [System.Collections.Generic.List[string]]::new()

function Assert-True {
    param(
        [Parameter(Mandatory = $true)][bool]$Condition,
        [Parameter(Mandatory = $true)][string]$Message
    )
    if (-not $Condition) {
        $script:failures.Add($Message)
    }
}

function Invoke-TestScript {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string[]]$Arguments = @()
    )
    $lines = @(& $script:PowerShellExe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Path @Arguments 2>&1)
    [pscustomobject]@{
        ExitCode = $LASTEXITCODE
        Output = ($lines | ForEach-Object { "$_" }) -join [Environment]::NewLine
    }
}

function Write-FixtureConfig {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$EvidenceRoot,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$QuickSteps,
        [object[]]$FullSteps = @(),
        [object[]]$BootstrapSteps = @(),
        [object[]]$Phase10Steps = @(),
        [object[]]$Phase11Steps = @(),
        [object[]]$CleanupSteps = @()
    )
    $config = [ordered]@{
        schemaVersion = '1.0'
        evidenceRoot = $EvidenceRoot
        lockPath = (Join-Path $EvidenceRoot 'fixture.lock')
        redaction = [ordered]@{
            replacement = '[REDACTED]'
            patterns = @('(?i)(authorization\s*:\s*bearer\s+)\S+', '(?i)(token|password|cookie|secret)\s*[=:]\s*\S+')
        }
        bootstrap = [ordered]@{ steps = $BootstrapSteps }
        gates = [ordered]@{
            quick = [ordered]@{ steps = $QuickSteps }
            full = [ordered]@{ steps = $FullSteps }
            phase10Live = [ordered]@{ steps = $Phase10Steps }
            phase11Live = [ordered]@{ steps = $Phase11Steps }
        }
        cleanup = [ordered]@{
            ports = @(18090, 5330)
            processPatterns = @('fixture-launcher')
            steps = $CleanupSteps
        }
    }
    [IO.File]::WriteAllText($Path, ($config | ConvertTo-Json -Depth 20), [Text.UTF8Encoding]::new($false))
}

function New-CommandStep {
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [Parameter(Mandatory = $true)][string]$CommandText,
        [bool]$Mandatory = $true,
        [bool]$Enabled = $true,
        [string]$FailureClassification = 'CODE_FAILURE',
        [string]$Kind = 'command'
    )
    [ordered]@{
        id = $Id
        kind = $Kind
        mandatory = $Mandatory
        enabled = $Enabled
        executable = $script:PowerShellExe
        arguments = @('-NoLogo', '-NoProfile', '-NonInteractive', '-Command', $CommandText)
        workingDirectory = '.'
        expectedExitCodes = @(0)
        failureClassification = $FailureClassification
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$script:PowerShellExe = Join-Path $PSHOME 'powershell.exe'
if (-not (Test-Path -LiteralPath $script:PowerShellExe -PathType Leaf)) {
    $script:PowerShellExe = (Get-Process -Id $PID).Path
}

$requiredPaths = @(
    'scripts/local/gate-common.ps1',
    'scripts/local/quick-gate.ps1',
    'scripts/local/full-gate.ps1',
    'scripts/local/release-gate.ps1',
    'scripts/local/cleanup-gate.ps1',
    'scripts/local/e2e/run-phase10-live.ps1',
    'scripts/local/e2e/run-phase11-live.ps1',
    'scripts/local/tests/gate-orchestrator-test.ps1',
    'local-gate.config.json',
    'docs/implementation/remediation/LOCAL_GATE_RUNBOOK.md'
)

foreach ($relativePath in $requiredPaths) {
    Assert-True (Test-Path -LiteralPath (Join-Path $repoRoot $relativePath) -PathType Leaf) "required CXR-01 artifact missing: $relativePath"
}

$powerShellScripts = $requiredPaths | Where-Object { $_ -like '*.ps1' }
foreach ($relativePath in $powerShellScripts) {
    $path = Join-Path $repoRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        continue
    }
    $tokens = $null
    $parseErrors = $null
    [void][Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$parseErrors)
    $parseMessage = if ($parseErrors.Count -eq 0) { 'none' } else { ($parseErrors | ForEach-Object { $_.Message }) -join '; ' }
    Assert-True ($parseErrors.Count -eq 0) "$relativePath has PowerShell parser errors: $parseMessage"
    $source = [IO.File]::ReadAllText($path)
    Assert-True ($source -match 'Set-StrictMode\s+-Version\s+Latest') "$relativePath must enable Set-StrictMode -Version Latest"
    Assert-True ($source -match '\$ErrorActionPreference\s*=\s*[\x27\x22]Stop[\x27\x22]') "$relativePath must set ErrorActionPreference to Stop"
}

$ownedGateScripts = $powerShellScripts | Where-Object { $_ -ne 'scripts/local/tests/gate-orchestrator-test.ps1' }
foreach ($relativePath in $ownedGateScripts) {
    $path = Join-Path $repoRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        continue
    }
    $source = [IO.File]::ReadAllText($path)
    Assert-True ($source -notmatch '(?im)^\s*git(?:\.exe)?\s+(?:commit|push)\b') "$relativePath must not commit or push"
    Assert-True ($source -notmatch 'INDEPENDENT_GATE_PASS') "$relativePath must not write an independent PASS claim"
}

$configPath = Join-Path $repoRoot 'local-gate.config.json'
if (Test-Path -LiteralPath $configPath -PathType Leaf) {
    try {
        $config = Get-Content -Raw -Encoding UTF8 -LiteralPath $configPath | ConvertFrom-Json
        Assert-True ($config.schemaVersion -eq '1.0') 'local-gate.config.json schemaVersion must be 1.0'
        foreach ($gateName in @('quick', 'full', 'phase10Live', 'phase11Live')) {
            Assert-True ($null -ne $config.gates.$gateName.steps) "config missing gates.$gateName.steps"
            foreach ($step in @($config.gates.$gateName.steps)) {
                Assert-True ($null -ne $step.mandatory) "config step $($step.id) must declare mandatory"
                Assert-True ($step.kind -in @('command', 'script')) "config step $($step.id) has unknown kind $($step.kind)"
            }
        }
        $configText = [IO.File]::ReadAllText($configPath)
        Assert-True ($configText -notmatch '(?i)\"(?:password|token|secret|cookie|authorization)\"\s*:\s*\"(?!\s*\")') 'config must not contain default credentials'
    }
    catch {
        $failures.Add("local-gate.config.json parse/schema check failed: $($_.Exception.Message)")
    }
}

$commonPath = Join-Path $repoRoot 'scripts/local/gate-common.ps1'
$quickPath = Join-Path $repoRoot 'scripts/local/quick-gate.ps1'
$releasePath = Join-Path $repoRoot 'scripts/local/release-gate.ps1'
$cleanupPath = Join-Path $repoRoot 'scripts/local/cleanup-gate.ps1'
$behaviorReady = (Test-Path -LiteralPath $commonPath) -and (Test-Path -LiteralPath $quickPath) -and (Test-Path -LiteralPath $releasePath) -and (Test-Path -LiteralPath $cleanupPath)

if ($behaviorReady) {
    $tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("cxr01-gate-test-" + [Guid]::NewGuid().ToString('N'))
    [void][IO.Directory]::CreateDirectory($tempRoot)
    try {
        $evidenceRoot = Join-Path $tempRoot 'evidence'
        [void][IO.Directory]::CreateDirectory($evidenceRoot)

        $passConfig = Join-Path $tempRoot 'pass.json'
        Write-FixtureConfig -Path $passConfig -EvidenceRoot $evidenceRoot -QuickSteps @(
            (New-CommandStep -Id 'pass-step' -CommandText "Write-Output 'ok'; exit 0")
        )
        $passRunId = 'quick-pass'
        $result = Invoke-TestScript -Path $quickPath -Arguments @('-ConfigPath', $passConfig, '-RunId', $passRunId)
        Assert-True ($result.ExitCode -eq 0) "Quick fixture PASS should exit 0; output=$($result.Output)"
        $passAttempt = Get-ChildItem -LiteralPath $evidenceRoot -Directory -Recurse | Where-Object { $_.Name -eq $passRunId } | Select-Object -First 1
        Assert-True ($null -ne $passAttempt) 'Quick PASS must create commit/run-id evidence directory'
        if ($null -ne $passAttempt) {
            foreach ($requiredEvidence in @('metadata.json', 'checksums.sha256', 'VERDICT.md')) {
                Assert-True (Test-Path -LiteralPath (Join-Path $passAttempt.FullName $requiredEvidence)) "Quick evidence missing $requiredEvidence"
            }
            Assert-True (@(Get-ChildItem -LiteralPath (Join-Path $passAttempt.FullName 'commands') -Filter '*.log').Count -ge 1) 'Quick evidence must contain independent command logs'
        }

        $skipConfig = Join-Path $tempRoot 'mandatory-skip.json'
        Write-FixtureConfig -Path $skipConfig -EvidenceRoot $evidenceRoot -QuickSteps @(
            (New-CommandStep -Id 'mandatory-skip' -CommandText 'exit 0' -Mandatory $true -Enabled $false)
        )
        $result = Invoke-TestScript -Path $quickPath -Arguments @('-ConfigPath', $skipConfig, '-RunId', 'mandatory-skip')
        Assert-True ($result.ExitCode -ne 0) 'skipped mandatory step must fail closed'

        $unknownConfig = Join-Path $tempRoot 'unknown-kind.json'
        Write-FixtureConfig -Path $unknownConfig -EvidenceRoot $evidenceRoot -QuickSteps @(
            (New-CommandStep -Id 'unknown-kind' -CommandText 'exit 0' -Kind 'invented')
        )
        $result = Invoke-TestScript -Path $quickPath -Arguments @('-ConfigPath', $unknownConfig, '-RunId', 'unknown-kind')
        Assert-True ($result.ExitCode -ne 0) 'unknown mandatory step kind must fail closed'

        $stderrConfig = Join-Path $tempRoot 'stderr-exit.json'
        Write-FixtureConfig -Path $stderrConfig -EvidenceRoot $evidenceRoot -QuickSteps @(
            (New-CommandStep -Id 'stderr-exit-two' -CommandText "[Console]::Error.WriteLine('expected-stderr'); exit 2")
        )
        $result = Invoke-TestScript -Path $quickPath -Arguments @('-ConfigPath', $stderrConfig, '-RunId', 'stderr-exit')
        Assert-True ($result.ExitCode -ne 0) 'stderr plus exit 2 must fail without losing the native exit'
        $stderrResultPath = Get-ChildItem -LiteralPath $evidenceRoot -Filter 'gate-result-quick.json' -File -Recurse | Where-Object { $_.FullName -match 'stderr-exit' } | Select-Object -First 1
        Assert-True ($null -ne $stderrResultPath) 'stderr exit fixture must retain structured result'
        if ($null -ne $stderrResultPath) {
            $stderrResult = Get-Content -Raw -Encoding UTF8 -LiteralPath $stderrResultPath.FullName | ConvertFrom-Json
            Assert-True ($stderrResult.results[0].exitCode -eq 2) 'stderr exit 2 must remain exit 2, not synthetic 127'
            Assert-True ($stderrResult.results[0].classification -eq 'CODE_FAILURE') 'ordinary stderr exit 2 must remain CODE_FAILURE'
        }

        $ordinaryConfig = Join-Path $tempRoot 'ordinary-exit.json'
        Write-FixtureConfig -Path $ordinaryConfig -EvidenceRoot $evidenceRoot -QuickSteps @(
            (New-CommandStep -Id 'ordinary-exit-one' -CommandText "Write-Output 'ordinary failure'; exit 1" -FailureClassification 'ENVIRONMENT_BLOCKED')
        )
        $result = Invoke-TestScript -Path $quickPath -Arguments @('-ConfigPath', $ordinaryConfig, '-RunId', 'ordinary-exit')
        $ordinaryResultPath = Get-ChildItem -LiteralPath $evidenceRoot -Filter 'gate-result-quick.json' -File -Recurse | Where-Object { $_.FullName -match 'ordinary-exit' } | Select-Object -First 1
        if ($null -ne $ordinaryResultPath) {
            $ordinaryResult = Get-Content -Raw -Encoding UTF8 -LiteralPath $ordinaryResultPath.FullName | ConvertFrom-Json
            Assert-True ($ordinaryResult.results[0].exitCode -eq 1) 'ordinary exit 1 must remain exit 1'
            Assert-True ($ordinaryResult.results[0].classification -eq 'CODE_FAILURE') 'ordinary exit 1 must remain CODE_FAILURE'
        }
        else { $failures.Add('ordinary exit fixture must retain structured result') }

        $accessConfig = Join-Path $tempRoot 'access-denied.json'
        Write-FixtureConfig -Path $accessConfig -EvidenceRoot $evidenceRoot -QuickSteps @(
            (New-CommandStep -Id 'access-denied' -CommandText "[Console]::Error.WriteLine('WinError 5: Access is denied'); exit 1")
        )
        $result = Invoke-TestScript -Path $quickPath -Arguments @('-ConfigPath', $accessConfig, '-RunId', 'access-denied')
        $accessResultPath = Get-ChildItem -LiteralPath $evidenceRoot -Filter 'gate-result-quick.json' -File -Recurse | Where-Object { $_.FullName -match 'access-denied' } | Select-Object -First 1
        if ($null -ne $accessResultPath) {
            $accessResult = Get-Content -Raw -Encoding UTF8 -LiteralPath $accessResultPath.FullName | ConvertFrom-Json
            Assert-True ($accessResult.results[0].exitCode -eq 1) 'AccessDenied exit must retain native exit 1'
            Assert-True ($accessResult.results[0].classification -eq 'ENVIRONMENT_BLOCKED') 'explicit WinError 5 must classify ENVIRONMENT_BLOCKED'
        }
        else { $failures.Add('AccessDenied fixture must retain structured result') }

        $nativeEncodingConfig = Join-Path $tempRoot 'native-encoding.json'
        $utf8Phrase = -join @([char]0x4E2D, [char]0x6587, 'UTF8')
        $gb2312Phrase = -join @([char]0x62D2, [char]0x7EDD, [char]0x8BBF, [char]0x95EE)
        $utf8Command = '$bytes=[Text.UTF8Encoding]::new($false,$true).GetBytes("' + $utf8Phrase + '"); $stream=[Console]::OpenStandardOutput(); $stream.Write($bytes,0,$bytes.Length); exit 0'
        $gb2312Command = '$bytes=[Text.Encoding]::GetEncoding(936).GetBytes("' + $gb2312Phrase + '"); $stream=[Console]::OpenStandardError(); $stream.Write($bytes,0,$bytes.Length); exit 0'
        Write-FixtureConfig -Path $nativeEncodingConfig -EvidenceRoot $evidenceRoot -QuickSteps @(
            (New-CommandStep -Id 'native-utf8' -CommandText $utf8Command),
            (New-CommandStep -Id 'native-gb2312' -CommandText $gb2312Command),
            (New-CommandStep -Id 'native-invalid' -CommandText '$bytes=[byte[]]@(0x81); $stream=[Console]::OpenStandardError(); $stream.Write($bytes,0,$bytes.Length); exit 6')
        )
        $result = Invoke-TestScript -Path $quickPath -Arguments @('-ConfigPath', $nativeEncodingConfig, '-RunId', 'native-encoding')
        Assert-True ($result.ExitCode -ne 0) 'undecodable native bytes must fail the Gate without hiding the process exit'
        $nativeEncodingResultPath = Get-ChildItem -LiteralPath $evidenceRoot -Filter 'gate-result-quick.json' -File -Recurse | Where-Object { $_.FullName -match 'native-encoding' } | Select-Object -First 1
        Assert-True ($null -ne $nativeEncodingResultPath) 'native encoding fixture must retain structured results'
        if ($null -ne $nativeEncodingResultPath) {
            $nativeEncodingResult = Get-Content -Raw -Encoding UTF8 -LiteralPath $nativeEncodingResultPath.FullName | ConvertFrom-Json
            $utf8Result = @($nativeEncodingResult.results | Where-Object id -eq 'native-utf8')[0]
            $gb2312Result = @($nativeEncodingResult.results | Where-Object id -eq 'native-gb2312')[0]
            $invalidResult = @($nativeEncodingResult.results | Where-Object id -eq 'native-invalid')[0]
            Assert-True ($utf8Result.exitCode -eq 0 -and $utf8Result.outputEncoding.stdout -eq 'UTF-8' -and -not $utf8Result.outputEncoding.stdoutFallbackUsed) 'UTF-8 native stdout must remain exit 0 with no fallback'
            Assert-True ($gb2312Result.exitCode -eq 0 -and $gb2312Result.outputEncoding.stderr -match 'gb2312|gbk' -and $gb2312Result.outputEncoding.stderrFallbackUsed) "GB2312 native stderr must remain exit 0 with explicit system-codepage fallback metadata; actual exit=$($gb2312Result.exitCode) encoding=$($gb2312Result.outputEncoding.stderr) fallback=$($gb2312Result.outputEncoding.stderrFallbackUsed)"
            Assert-True ($invalidResult.exitCode -eq 6) 'invalid native bytes must preserve real exit 6'
            Assert-True ($invalidResult.classification -eq 'EVIDENCE_ENCODING_FAILURE' -and $invalidResult.outputEncoding.stderrDecodeStatus -eq 'INVALID') 'invalid native bytes must be explicitly classified and recorded'
        }
        $utf8EncodingLog = Get-ChildItem -LiteralPath $evidenceRoot -Filter 'native-utf8.log' -File -Recurse | Select-Object -First 1
        if ($null -ne $utf8EncodingLog) {
            $utf8EncodingText = [IO.File]::ReadAllText($utf8EncodingLog.FullName, [Text.UTF8Encoding]::new($false, $true))
            Assert-True ($utf8EncodingText -match [regex]::Escape($utf8Phrase)) 'UTF-8 native stdout must preserve Chinese text'
            Assert-True ($utf8EncodingText -match 'STDOUT_ENCODING=UTF-8' -and $utf8EncodingText -match 'STDOUT_FALLBACK_USED=False') 'UTF-8 native stdout log must disclose encoding metadata without fallback'
        }
        else { $failures.Add('UTF-8 native encoding fixture must retain its step log') }
        $nativeEncodingLog = Get-ChildItem -LiteralPath $evidenceRoot -Filter 'native-gb2312.log' -File -Recurse | Select-Object -First 1
        Assert-True ($null -ne $nativeEncodingLog) 'native encoding fixture must retain its step log'
        if ($null -ne $nativeEncodingLog) {
            $nativeEncodingText = [IO.File]::ReadAllText($nativeEncodingLog.FullName, [Text.UTF8Encoding]::new($false, $true))
            Assert-True ($nativeEncodingText -match [regex]::Escape($gb2312Phrase)) "GB2312 stderr must be decoded without semantic loss; log=$nativeEncodingText"
            Assert-True ($nativeEncodingText -match 'STDERR_FALLBACK_USED=True') "GB2312 stderr log must disclose system-codepage fallback; log=$nativeEncodingText"
            Assert-True ($nativeEncodingText -notmatch [char]0xfffd) 'native stderr log must not contain replacement characters'
        }
        $invalidEncodingLog = Get-ChildItem -LiteralPath $evidenceRoot -Filter 'native-invalid.log' -File -Recurse | Select-Object -First 1
        if ($null -ne $invalidEncodingLog) {
            $invalidEncodingText = [IO.File]::ReadAllText($invalidEncodingLog.FullName, [Text.UTF8Encoding]::new($false, $true))
            Assert-True ($invalidEncodingText -match 'STDERR_DECODE_STATUS=INVALID' -and $invalidEncodingText -match 'UNDECODABLE_NATIVE_BYTES_BASE64=') 'invalid native stderr log must retain explicit decode metadata and raw-byte Base64'
            Assert-True ($invalidEncodingText -notmatch [char]0xfffd) 'invalid native stderr log must not contain replacement characters'
        }
        else { $failures.Add('invalid native encoding fixture must retain its step log') }

        $secretConfig = Join-Path $tempRoot 'redaction.json'
        Write-FixtureConfig -Path $secretConfig -EvidenceRoot $evidenceRoot -QuickSteps @(
            (New-CommandStep -Id 'secret-failure' -CommandText "Write-Output 'Authorization: Bearer abc123'; Write-Output 'password=secret-value'; exit 9")
        )
        $result = Invoke-TestScript -Path $quickPath -Arguments @('-ConfigPath', $secretConfig, '-RunId', 'redaction')
        Assert-True ($result.ExitCode -ne 0) 'failing mandatory command must fail the gate'
        $secretLog = Get-ChildItem -LiteralPath $evidenceRoot -Filter 'secret-failure.log' -File -Recurse | Select-Object -First 1
        Assert-True ($null -ne $secretLog) 'failing step must retain its log'
        if ($null -ne $secretLog) {
            $logText = [IO.File]::ReadAllText($secretLog.FullName)
            Assert-True ($logText -notmatch 'abc123|secret-value') 'gate log leaked a token or password'
            Assert-True ($logText -match '\[REDACTED\]') 'gate log must mark redacted values'
            Assert-True ($logText -match 'START_UTC=.*END_UTC=.*EXIT_CODE=' -or (($logText -match 'START_UTC=') -and ($logText -match 'END_UTC=') -and ($logText -match 'EXIT_CODE='))) 'step log must contain start/end/exit'
        }

        $blockedConfig = Join-Path $tempRoot 'environment-blocked.json'
        Write-FixtureConfig -Path $blockedConfig -EvidenceRoot $evidenceRoot -QuickSteps @(
            (New-CommandStep -Id 'dependency-download' -CommandText "[Console]::Error.WriteLine('Could not resolve host: dependency.example'); exit 7" -FailureClassification 'ENVIRONMENT_BLOCKED')
        )
        $result = Invoke-TestScript -Path $quickPath -Arguments @('-ConfigPath', $blockedConfig, '-RunId', 'environment-blocked')
        Assert-True ($result.ExitCode -ne 0) 'environment dependency failure must be nonzero'
        $blockedVerdict = Get-ChildItem -LiteralPath $evidenceRoot -Filter 'VERDICT.md' -File -Recurse | Where-Object { $_.FullName -match 'environment-blocked' } | Select-Object -First 1
        Assert-True ($null -ne $blockedVerdict) 'environment-blocked run must retain verdict'
        if ($null -ne $blockedVerdict) {
            $verdictText = [IO.File]::ReadAllText($blockedVerdict.FullName)
            Assert-True ($verdictText -match 'ENVIRONMENT_BLOCKED') 'dependency failure must be classified ENVIRONMENT_BLOCKED'
            Assert-True ($verdictText -notmatch 'Gate PASS') 'dependency failure must not claim Gate PASS'
        }

        . $commonPath
        foreach ($functionName in @('Enter-GateLock', 'Exit-GateLock', 'Write-EvidenceChecksums', 'Test-EvidenceChecksums')) {
            Assert-True ($null -ne (Get-Command $functionName -ErrorAction SilentlyContinue)) "gate-common missing function $functionName"
        }
        Assert-True ((Get-GateVerdict -Results @()) -eq 'PASS') 'empty configured cleanup step list must defer to mandatory cleanup probes without binding failure'
        if ($null -ne (Get-Command Enter-GateLock -ErrorAction SilentlyContinue)) {
            $lockPath = Join-Path $tempRoot 'exclusive.lock'
            $lockHandle = Enter-GateLock -Path $lockPath
            $secondFailed = $false
            try { $null = Enter-GateLock -Path $lockPath } catch { $secondFailed = $true }
            Assert-True $secondFailed 'second concurrent lock acquisition must fail closed'
            Exit-GateLock -Handle $lockHandle -Path $lockPath
        }
        if (($null -ne (Get-Command Write-EvidenceChecksums -ErrorAction SilentlyContinue)) -and ($null -ne (Get-Command Test-EvidenceChecksums -ErrorAction SilentlyContinue))) {
            $tamperRoot = Join-Path $tempRoot 'tamper'
            [void][IO.Directory]::CreateDirectory($tamperRoot)
            [IO.File]::WriteAllText((Join-Path $tamperRoot 'artifact.txt'), 'before', [Text.UTF8Encoding]::new($false))
            Write-EvidenceChecksums -EvidencePath $tamperRoot
            Assert-True (Test-EvidenceChecksums -EvidencePath $tamperRoot) 'fresh evidence checksums must validate'
            [IO.File]::AppendAllText((Join-Path $tamperRoot 'artifact.txt'), 'after')
            Assert-True (-not (Test-EvidenceChecksums -EvidencePath $tamperRoot)) 'tampered evidence must fail checksum verification'
        }

        $cleanupConfig = Join-Path $tempRoot 'cleanup.json'
        Write-FixtureConfig -Path $cleanupConfig -EvidenceRoot $evidenceRoot -QuickSteps @() -CleanupSteps @()

        $cleanupSource = [IO.File]::ReadAllText($cleanupPath)
        if ($cleanupSource -notmatch 'function\s+Resolve-CleanupProbeOutcome' -or $cleanupSource -notmatch 'InvocationName\s+-ne\s+[''"]\.[''"]') {
            $failures.Add('cleanup must expose a dot-sourceable pure probe-outcome function without a production fake-mode switch')
        }
        else {
            $pureProbeTestPath = Join-Path $tempRoot 'cleanup-probe-outcome-test.ps1'
            $escapedCleanupPath = $cleanupPath.Replace("'", "''")
            $pureProbeSource = @"
Set-StrictMode -Version Latest
`$ErrorActionPreference = 'Stop'
. '$escapedCleanupPath'
function Assert-Outcome([bool]`$condition, [string]`$message) { if (-not `$condition) { throw `$message } }
`$portsAvailable = @([pscustomobject]@{ port = 18090; listenerCount = 0; probeStatus = 'AVAILABLE'; probeErrors = @() })
`$portsResidual = @([pscustomobject]@{ port = 18090; listenerCount = 1; probeStatus = 'AVAILABLE'; probeErrors = @() })
`$dockerAvailable = [pscustomobject]@{ status = 'AVAILABLE'; errors = @(); testcontainers = @(); ryuk = @() }
`$dockerUnavailable = [pscustomobject]@{ status = 'UNAVAILABLE'; errors = @('docker denied'); testcontainers = @(); ryuk = @() }
`$launchersAvailable = [pscustomobject]@{ status = 'AVAILABLE'; errors = @(); launchers = @() }
`$launchersUnavailable = [pscustomobject]@{ status = 'UNAVAILABLE'; errors = @('cim denied'); launchers = @() }
`$pass = Resolve-CleanupProbeOutcome -CleanupStepVerdict 'PASS' -PortFacts `$portsAvailable -DockerFacts `$dockerAvailable -LauncherFacts `$launchersAvailable
Assert-Outcome (`$pass.verdict -eq 'PASS' -and `$pass.residualCount -eq 0) 'all probes available with zero residual must PASS'
`$dockerBlocked = Resolve-CleanupProbeOutcome -CleanupStepVerdict 'PASS' -PortFacts `$portsAvailable -DockerFacts `$dockerUnavailable -LauncherFacts `$launchersAvailable
Assert-Outcome (`$dockerBlocked.verdict -eq 'ENVIRONMENT_BLOCKED' -and `$dockerBlocked.classification -eq 'ENVIRONMENT_BLOCKED') 'docker unavailable must be ENVIRONMENT_BLOCKED'
`$launcherBlocked = Resolve-CleanupProbeOutcome -CleanupStepVerdict 'PASS' -PortFacts `$portsAvailable -DockerFacts `$dockerAvailable -LauncherFacts `$launchersUnavailable
Assert-Outcome (`$launcherBlocked.verdict -eq 'ENVIRONMENT_BLOCKED' -and `$launcherBlocked.classification -eq 'ENVIRONMENT_BLOCKED') 'launcher unavailable must be ENVIRONMENT_BLOCKED'
`$residual = Resolve-CleanupProbeOutcome -CleanupStepVerdict 'PASS' -PortFacts `$portsResidual -DockerFacts `$dockerAvailable -LauncherFacts `$launchersAvailable
Assert-Outcome (`$residual.verdict -eq 'FAIL' -and `$residual.residualCount -gt 0) 'known residual listener must take precedence as FAIL'
exit 0
"@
            [IO.File]::WriteAllText($pureProbeTestPath, $pureProbeSource, [Text.UTF8Encoding]::new($false))
            $pureProbeResult = Invoke-TestScript -Path $pureProbeTestPath
            Assert-True ($pureProbeResult.ExitCode -eq 0) "pure cleanup probe outcome cases must pass; output=$($pureProbeResult.Output)"
        }

        $result = Invoke-TestScript -Path $cleanupPath -Arguments @('-ConfigPath', $cleanupConfig, '-RunId', 'cleanup-direct')
        $cleanupReport = Get-ChildItem -LiteralPath $evidenceRoot -Filter 'cleanup-report.json' -File -Recurse | Where-Object { $_.FullName -match 'cleanup-direct' } | Select-Object -First 1
        Assert-True ($null -ne $cleanupReport) 'cleanup must emit cleanup-report.json'
        if ($null -ne $cleanupReport) {
            $report = Get-Content -Raw -Encoding UTF8 -LiteralPath $cleanupReport.FullName | ConvertFrom-Json
            foreach ($field in @('ports', 'testcontainers', 'ryuk', 'launchers')) {
                Assert-True ($null -ne $report.$field) "cleanup report missing $field"
                Assert-True ($report.$field -is [Array]) "cleanup report field $field must remain a JSON array"
            }
            foreach ($field in @('dockerProbeStatus', 'dockerProbeErrors', 'launcherProbeStatus', 'launcherProbeErrors', 'launcherProbeAvailable')) {
                Assert-True ($null -ne $report.$field) "cleanup report missing $field"
            }
            $allAvailable = @($report.ports | Where-Object { $_.probeStatus -ne 'AVAILABLE' }).Count -eq 0 -and $report.dockerProbeStatus -eq 'AVAILABLE' -and $report.launcherProbeStatus -eq 'AVAILABLE'
            if ($allAvailable -and $report.residualCount -eq 0) {
                Assert-True ($result.ExitCode -eq 0 -and $report.verdict -eq 'PASS') 'direct cleanup may PASS only when every mandatory probe is available with zero residual'
            }
            else {
                Assert-True ($result.ExitCode -ne 0 -and $report.verdict -eq 'ENVIRONMENT_BLOCKED') 'unavailable mandatory cleanup probe must be nonzero ENVIRONMENT_BLOCKED'
            }
        }

        $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 18090)
        try {
            $listener.Start()
            $result = Invoke-TestScript -Path $cleanupPath -Arguments @('-ConfigPath', $cleanupConfig, '-RunId', 'cleanup-residual')
            Assert-True ($result.ExitCode -ne 0) 'cleanup must fail when a configured port still has a listener'
            $residualReport = Get-ChildItem -LiteralPath $evidenceRoot -Filter 'cleanup-report.json' -File -Recurse | Where-Object { $_.FullName -match 'cleanup-residual' } | Select-Object -First 1
            Assert-True ($null -ne $residualReport) 'residual cleanup run must retain cleanup report'
            if ($null -ne $residualReport) {
                $residualPayload = Get-Content -Raw -Encoding UTF8 -LiteralPath $residualReport.FullName | ConvertFrom-Json
                Assert-True ($residualPayload.verdict -eq 'FAIL') 'cleanup residual report must be FAIL'
                Assert-True ($residualPayload.residualCount -gt 0) 'cleanup residual report must count the listener'
            }
        }
        finally { $listener.Stop() }

        $releaseConfig = Join-Path $tempRoot 'release-finally.json'
        Write-FixtureConfig -Path $releaseConfig -EvidenceRoot $evidenceRoot -QuickSteps @(
            (New-CommandStep -Id 'release-main-failure' -CommandText 'exit 4')
        ) -CleanupSteps @(
            (New-CommandStep -Id 'release-cleanup' -CommandText "Write-Output 'cleanup-ran'; exit 0")
        )
        $result = Invoke-TestScript -Path $releasePath -Arguments @('-ConfigPath', $releaseConfig, '-RunId', 'release-finally', '-SkipBootstrap', '-SkipFull', '-SkipLive')
        Assert-True ($result.ExitCode -ne 0) 'release must preserve a main-step failure'
        $releaseCleanup = Get-ChildItem -LiteralPath $evidenceRoot -Filter 'cleanup-report.json' -File -Recurse | Where-Object { $_.FullName -match 'release-finally' } | Select-Object -First 1
        Assert-True ($null -ne $releaseCleanup) 'release must execute cleanup in finally after main failure'
        if ($null -ne $releaseCleanup) {
            $releaseCleanupPayload = Get-Content -Raw -Encoding UTF8 -LiteralPath $releaseCleanup.FullName | ConvertFrom-Json
            Assert-True ($releaseCleanupPayload.verdict -ne 'PASS' -or ($releaseCleanupPayload.dockerProbeStatus -eq 'AVAILABLE' -and $releaseCleanupPayload.launcherProbeStatus -eq 'AVAILABLE')) 'release cleanup must not PASS when a mandatory probe is unavailable'
            $releaseMetadata = Get-ChildItem -LiteralPath $evidenceRoot -Filter 'metadata.json' -File -Recurse | Where-Object { $_.FullName -match 'release-finally' } | Select-Object -First 1
            if ($null -ne $releaseMetadata) {
                $releaseMetadataPayload = Get-Content -Raw -Encoding UTF8 -LiteralPath $releaseMetadata.FullName | ConvertFrom-Json
                $cleanupMetadataGroup = @($releaseMetadataPayload.groups | Where-Object name -eq 'cleanup')[0]
                Assert-True ($cleanupMetadataGroup.verdict -eq $releaseCleanupPayload.verdict) 'release metadata must propagate the exact cleanup verdict'
                Assert-True ($releaseMetadataPayload.verdict -eq 'FAIL') 'release main failure must remain overall FAIL even when cleanup is environment-blocked'
            }
            else { $failures.Add('release fixture must retain metadata for cleanup verdict propagation') }
        }
    }
    catch {
        $failures.Add("behavior test harness failed: $($_.Exception.Message)")
    }
    finally {
        if (Test-Path -LiteralPath $tempRoot) {
            Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

if ($failures.Count -gt 0) {
    Write-Output "gate orchestrator tests: FAIL ($($failures.Count))"
    foreach ($failure in $failures) {
        Write-Output "FAIL: $failure"
    }
    exit 1
}

Write-Output 'gate orchestrator tests: PASS (schema, mandatory fail-closed, cleanup-finally, per-step evidence, lock, redaction, checksums/tamper, environment classification, cleanup probes)'
exit 0
