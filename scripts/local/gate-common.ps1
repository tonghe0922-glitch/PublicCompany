Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)

function Get-GateRepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

function Get-OptionalProperty {
    param(
        [Parameter(Mandatory = $true)][object]$Object,
        [Parameter(Mandatory = $true)][string]$Name,
        $Default = $null
    )
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $Default }
    return $property.Value
}

function Resolve-GatePath {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string]$BasePath = (Get-GateRepoRoot),
        [switch]$AllowMissing
    )
    if ([IO.Path]::IsPathRooted($Path)) {
        $candidate = [IO.Path]::GetFullPath($Path)
    }
    else {
        $candidate = [IO.Path]::GetFullPath((Join-Path $BasePath $Path))
    }
    if (-not $AllowMissing -and -not (Test-Path -LiteralPath $candidate)) {
        throw "required path does not exist: $candidate"
    }
    return $candidate
}

function Read-GateConfig {
    param([Parameter(Mandatory = $true)][string]$ConfigPath)
    $resolved = Resolve-GatePath -Path $ConfigPath
    $config = Get-Content -Raw -Encoding UTF8 -LiteralPath $resolved | ConvertFrom-Json
    if ((Get-OptionalProperty -Object $config -Name 'schemaVersion') -ne '1.0') {
        throw 'local gate config schemaVersion must equal 1.0'
    }
    foreach ($name in @('evidenceRoot', 'lockPath', 'redaction', 'bootstrap', 'gates', 'cleanup')) {
        if ($null -eq $config.PSObject.Properties[$name]) {
            throw "local gate config missing required field: $name"
        }
    }
    return $config
}

function Get-GateCommit {
    param([string]$RepoRoot = (Get-GateRepoRoot))
    $output = @(& git -C $RepoRoot rev-parse HEAD 2>&1)
    if ($LASTEXITCODE -ne 0 -or $output.Count -ne 1 -or "$($output[0])" -notmatch '^[0-9a-f]{40}$') {
        throw "cannot resolve exact Git commit for evidence: $($output -join ' ')"
    }
    return "$($output[0])"
}

function New-GateRunId {
    param([Parameter(Mandatory = $true)][string]$GateName)
    $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
    return "$stamp-$($GateName.ToUpperInvariant())-$([Guid]::NewGuid().ToString('N').Substring(0, 8))"
}

function Enter-GateLock {
    param([Parameter(Mandatory = $true)][string]$Path)
    $resolved = Resolve-GatePath -Path $Path -AllowMissing
    $parent = Split-Path -Parent $resolved
    [void][IO.Directory]::CreateDirectory($parent)
    try {
        $handle = [IO.File]::Open($resolved, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        $payload = [Text.Encoding]::UTF8.GetBytes("PID=$PID`nSTART_UTC=$((Get-Date).ToUniversalTime().ToString('o'))`n")
        $handle.SetLength(0)
        $handle.Write($payload, 0, $payload.Length)
        $handle.Flush()
        return $handle
    }
    catch {
        throw "another local gate instance owns lock $resolved"
    }
}

function Exit-GateLock {
    param(
        [Parameter(Mandatory = $true)]$Handle,
        [Parameter(Mandatory = $true)][string]$Path
    )
    $Handle.Dispose()
    $resolved = Resolve-GatePath -Path $Path -AllowMissing
    if (Test-Path -LiteralPath $resolved -PathType Leaf) {
        Remove-Item -LiteralPath $resolved -Force
    }
}

function Protect-GateText {
    param(
        [AllowEmptyString()][string]$Text,
        [Parameter(Mandatory = $true)][object]$Config
    )
    $value = $Text
    $value = [regex]::Replace($value, '(?i)(authorization\s*:\s*bearer\s+)\S+', '$1[REDACTED]')
    $value = [regex]::Replace($value, '(?i)((?:token|password|cookie|secret)\s*[=:]\s*)\S+', '$1[REDACTED]')
    $redaction = Get-OptionalProperty -Object $Config -Name 'redaction'
    if ($null -ne $redaction) {
        $replacement = [string](Get-OptionalProperty -Object $redaction -Name 'replacement' -Default '[REDACTED]')
        foreach ($pattern in @(Get-OptionalProperty -Object $redaction -Name 'patterns' -Default @())) {
            $value = [regex]::Replace($value, [string]$pattern, $replacement)
        }
    }
    return $value
}

function Expand-GateValue {
    param(
        [Parameter(Mandatory = $true)][string]$Value,
        [Parameter(Mandatory = $true)][hashtable]$Context
    )
    $expanded = $Value
    foreach ($key in $Context.Keys) {
        $expanded = $expanded.Replace("{$key}", [string]$Context[$key])
    }
    return $expanded
}

function New-GateEvidencePath {
    param(
        [Parameter(Mandatory = $true)][object]$Config,
        [Parameter(Mandatory = $true)][string]$RunId,
        [string]$EvidenceRoot
    )
    $repoRoot = Get-GateRepoRoot
    $rootValue = if ([string]::IsNullOrWhiteSpace($EvidenceRoot)) { [string]$Config.evidenceRoot } else { $EvidenceRoot }
    $resolvedRoot = Resolve-GatePath -Path $rootValue -BasePath $repoRoot -AllowMissing
    $commit = Get-GateCommit -RepoRoot $repoRoot
    $attempt = Join-Path (Join-Path $resolvedRoot $commit) $RunId
    if (Test-Path -LiteralPath $attempt) {
        throw "evidence attempt already exists and will not be overwritten: $attempt"
    }
    foreach ($directory in @('', 'commands', 'surefire', 'failsafe', 'frontend', 'ui-source', 'traces')) {
        [void][IO.Directory]::CreateDirectory((Join-Path $attempt $directory))
    }
    return $attempt
}

function Get-GateRuntimeTempPath {
    param(
        [Parameter(Mandatory = $true)][object]$Config,
        [Parameter(Mandatory = $true)][string]$EvidencePath,
        [Parameter(Mandatory = $true)][string]$RunId
    )
    $configured = Get-OptionalProperty -Object $Config -Name 'runtimeTempRoot'
    if ([string]::IsNullOrWhiteSpace([string]$configured)) {
        $root = Join-Path (Split-Path -Parent $EvidencePath) '.runtime-temp'
    }
    else {
        $root = Resolve-GatePath -Path ([string]$configured) -BasePath (Get-GateRepoRoot) -AllowMissing
    }
    return Join-Path $root $RunId
}

function Get-GateSteps {
    param(
        [Parameter(Mandatory = $true)][object]$Config,
        [Parameter(Mandatory = $true)][string]$GroupName
    )
    if ($GroupName -eq 'bootstrap') {
        $group = $Config.bootstrap
    }
    elseif ($GroupName -eq 'cleanup') {
        $group = $Config.cleanup
    }
    else {
        $property = $Config.gates.PSObject.Properties[$GroupName]
        if ($null -eq $property) { throw "unknown gate group: $GroupName" }
        $group = $property.Value
    }
    if ($null -eq $group.PSObject.Properties['steps']) {
        throw "gate group $GroupName is missing steps"
    }
    return @($group.steps)
}

function New-InvalidStepResult {
    param(
        [string]$Id,
        [string]$Message,
        [string]$Classification = 'CODE_FAILURE'
    )
    return [pscustomobject]@{
        id = $Id
        status = 'FAIL'
        exitCode = 125
        classification = $Classification
        mandatory = $true
        startedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
        endedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
        log = $null
        message = $Message
    }
}

function ConvertTo-NativeArgument {
    param([AllowEmptyString()][string]$Value)
    if ($Value -notmatch '[\s\"]') { return $Value }
    $builder = [Text.StringBuilder]::new()
    [void]$builder.Append('"')
    $slashes = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq '\') { $slashes++; continue }
        if ($character -eq '"') {
            [void]$builder.Append(('\' * (($slashes * 2) + 1)))
            [void]$builder.Append('"')
            $slashes = 0
            continue
        }
        if ($slashes -gt 0) { [void]$builder.Append(('\' * $slashes)); $slashes = 0 }
        [void]$builder.Append($character)
    }
    if ($slashes -gt 0) { [void]$builder.Append(('\' * ($slashes * 2))) }
    [void]$builder.Append('"')
    return $builder.ToString()
}

function ConvertFrom-NativeOutputBytes {
    param([byte[]]$Bytes)
    if ($null -eq $Bytes -or $Bytes.Length -eq 0) {
        return [pscustomobject]@{ text = ''; encoding = 'NONE'; fallbackUsed = $false; status = 'VALID'; rawByteCount = 0 }
    }
    try {
        return [pscustomobject]@{
            text = [Text.UTF8Encoding]::new($false, $true).GetString($Bytes)
            encoding = 'UTF-8'; fallbackUsed = $false; status = 'VALID'; rawByteCount = $Bytes.Length
        }
    }
    catch [Text.DecoderFallbackException] {
        if ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) {
            try {
                $systemEncoding = [Text.Encoding]::GetEncoding(
                    [Text.Encoding]::Default.CodePage,
                    [Text.EncoderExceptionFallback]::new(),
                    [Text.DecoderExceptionFallback]::new()
                )
                return [pscustomobject]@{
                    text = $systemEncoding.GetString($Bytes)
                    encoding = $systemEncoding.WebName; fallbackUsed = $true; status = 'VALID'; rawByteCount = $Bytes.Length
                }
            }
            catch [Text.DecoderFallbackException] { }
        }
        return [pscustomobject]@{
            text = "[UNDECODABLE_NATIVE_BYTES_BASE64=$([Convert]::ToBase64String($Bytes))]"
            encoding = 'UNDECODABLE'; fallbackUsed = $false; status = 'INVALID'; rawByteCount = $Bytes.Length
        }
    }
}

function Invoke-CapturedProcess {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [string[]]$Arguments = @(),
        [string]$WorkingDirectory,
        [hashtable]$Environment = @{}
    )
    $resolvedExecutable = $Executable
    if (-not [IO.Path]::IsPathRooted($resolvedExecutable)) {
        $command = Get-Command $resolvedExecutable -CommandType Application -ErrorAction Stop | Select-Object -First 1
        $resolvedExecutable = $command.Source
    }
    $nativeArguments = ($Arguments | ForEach-Object { ConvertTo-NativeArgument -Value $_ }) -join ' '
    $extension = [IO.Path]::GetExtension($resolvedExecutable)
    if ($extension -in @('.cmd', '.bat')) {
        $inner = '"' + $resolvedExecutable + '"'
        if (-not [string]::IsNullOrWhiteSpace($nativeArguments)) { $inner += ' ' + $nativeArguments }
        $nativeArguments = '/d /s /c "' + $inner + '"'
        $resolvedExecutable = $env:ComSpec
    }
    elseif ($extension -eq '.ps1') {
        $nativeArguments = '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ' + (ConvertTo-NativeArgument -Value $resolvedExecutable) + ' ' + $nativeArguments
        $resolvedExecutable = Join-Path $PSHOME 'powershell.exe'
    }
    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $resolvedExecutable
    $startInfo.Arguments = $nativeArguments
    if (-not [string]::IsNullOrWhiteSpace($WorkingDirectory)) { $startInfo.WorkingDirectory = $WorkingDirectory }
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    $priorEnvironment = @{}
    foreach ($name in $Environment.Keys) {
        $priorEnvironment[$name] = [Environment]::GetEnvironmentVariable([string]$name, 'Process')
        [Environment]::SetEnvironmentVariable([string]$name, [string]($Environment[$name]), 'Process')
    }
    try {
        if (-not $process.Start()) { throw "failed to start executable: $resolvedExecutable" }
    }
    finally {
        foreach ($name in $priorEnvironment.Keys) {
            [Environment]::SetEnvironmentVariable([string]$name, $priorEnvironment[$name], 'Process')
        }
    }
    $stdoutBuffer = [IO.MemoryStream]::new()
    $stderrBuffer = [IO.MemoryStream]::new()
    $stdoutTask = $process.StandardOutput.BaseStream.CopyToAsync($stdoutBuffer)
    $stderrTask = $process.StandardError.BaseStream.CopyToAsync($stderrBuffer)
    $process.WaitForExit()
    [void]$stdoutTask.GetAwaiter().GetResult()
    [void]$stderrTask.GetAwaiter().GetResult()
    $stdoutDecoded = ConvertFrom-NativeOutputBytes -Bytes $stdoutBuffer.ToArray()
    $stderrDecoded = ConvertFrom-NativeOutputBytes -Bytes $stderrBuffer.ToArray()
    $exitCode = $process.ExitCode
    $stdoutBuffer.Dispose()
    $stderrBuffer.Dispose()
    $process.Dispose()
    return [pscustomobject]@{
        exitCode = $exitCode
        stdout = $stdoutDecoded.text
        stderr = $stderrDecoded.text
        stdoutEncoding = $stdoutDecoded.encoding
        stderrEncoding = $stderrDecoded.encoding
        stdoutFallbackUsed = $stdoutDecoded.fallbackUsed
        stderrFallbackUsed = $stderrDecoded.fallbackUsed
        stdoutDecodeStatus = $stdoutDecoded.status
        stderrDecodeStatus = $stderrDecoded.status
        stdoutByteCount = $stdoutDecoded.rawByteCount
        stderrByteCount = $stderrDecoded.rawByteCount
    }
}

function Invoke-GateStep {
    param(
        [Parameter(Mandatory = $true)][object]$Step,
        [Parameter(Mandatory = $true)][object]$Config,
        [Parameter(Mandatory = $true)][string]$EvidencePath,
        [Parameter(Mandatory = $true)][string]$GroupName,
        [Parameter(Mandatory = $true)][int]$Index,
        [Parameter(Mandatory = $true)][hashtable]$Context
    )
    $id = [string](Get-OptionalProperty -Object $Step -Name 'id' -Default "step-$Index")
    $mandatoryProperty = $Step.PSObject.Properties['mandatory']
    if ($null -eq $mandatoryProperty) {
        return New-InvalidStepResult -Id $id -Message 'step does not declare mandatory'
    }
    $mandatory = [bool]$mandatoryProperty.Value
    $enabled = [bool](Get-OptionalProperty -Object $Step -Name 'enabled' -Default $true)
    $kind = [string](Get-OptionalProperty -Object $Step -Name 'kind' -Default '')
    $classificationHint = [string](Get-OptionalProperty -Object $Step -Name 'failureClassification' -Default 'CODE_FAILURE')
    if ($classificationHint -notin @('CODE_FAILURE', 'ENVIRONMENT_BLOCKED')) {
        return New-InvalidStepResult -Id $id -Message "unknown failure classification: $classificationHint"
    }
    # A configured environment hint never overrides the captured facts. Ordinary
    # non-zero exits remain code failures unless their output carries a narrow,
    # auditable environment signature below.
    $classification = 'CODE_FAILURE'
    if (-not $enabled) {
        if ($mandatory) {
            return New-InvalidStepResult -Id $id -Message 'mandatory step is disabled/skipped'
        }
        return [pscustomobject]@{
            id = $id; status = 'SKIPPED'; exitCode = 0; classification = 'NONE'; mandatory = $false
            startedAtUtc = (Get-Date).ToUniversalTime().ToString('o'); endedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
            log = $null; message = 'optional step disabled'
        }
    }
    if ($kind -notin @('command', 'script')) {
        return New-InvalidStepResult -Id $id -Message "unknown step kind: $kind"
    }
    $executableValue = [string](Get-OptionalProperty -Object $Step -Name 'executable' -Default '')
    if ([string]::IsNullOrWhiteSpace($executableValue)) {
        return New-InvalidStepResult -Id $id -Message 'step executable is missing'
    }
    $repoRoot = [string]$Context.repoRoot
    $workingValue = [string](Get-OptionalProperty -Object $Step -Name 'workingDirectory' -Default '.')
    $workingDirectory = Resolve-GatePath -Path (Expand-GateValue -Value $workingValue -Context $Context) -BasePath $repoRoot
    $expandedExecutable = Expand-GateValue -Value $executableValue -Context $Context
    if ($kind -eq 'script' -or $expandedExecutable -match '[/\\]') {
        $executable = Resolve-GatePath -Path $expandedExecutable -BasePath $repoRoot
    }
    else {
        $executable = $expandedExecutable
    }
    $arguments = @()
    foreach ($argument in @(Get-OptionalProperty -Object $Step -Name 'arguments' -Default @())) {
        $arguments += Expand-GateValue -Value ([string]$argument) -Context $Context
    }
    $expected = @(Get-OptionalProperty -Object $Step -Name 'expectedExitCodes' -Default @(0)) | ForEach-Object { [int]$_ }
    $safeId = $id -replace '[^A-Za-z0-9._-]', '_'
    $logRelative = "commands/$safeId.log"
    $logPath = Join-Path $EvidencePath $logRelative.Replace('/', '\')
    if (Test-Path -LiteralPath $logPath) {
        return New-InvalidStepResult -Id $id -Message "duplicate step id would overwrite evidence log: $id"
    }
    $started = (Get-Date).ToUniversalTime().ToString('o')
    $runTemp = Get-GateRuntimeTempPath -Config $Config -EvidencePath $EvidencePath -RunId ([string]$Context.runId)
    $stepTemp = Join-Path $runTemp $safeId
    [void][IO.Directory]::CreateDirectory($stepTemp)
    $processEnvironment = @{ TEMP = $stepTemp; TMP = $stepTemp; PYTHONIOENCODING = 'utf-8'; PYTHONUTF8 = '1' }
    $stdout = ''
    $stderr = ''
    $stdoutEncoding = 'NONE'
    $stderrEncoding = 'NONE'
    $stdoutFallbackUsed = $false
    $stderrFallbackUsed = $false
    $stdoutDecodeStatus = 'VALID'
    $stderrDecodeStatus = 'VALID'
    $stdoutByteCount = 0
    $stderrByteCount = 0
    $exitCode = 127
    $message = ''
    Push-Location $workingDirectory
    try {
        try {
            $captured = Invoke-CapturedProcess -Executable $executable -Arguments $arguments -WorkingDirectory $workingDirectory -Environment $processEnvironment
            $stdout = $captured.stdout
            $stderr = $captured.stderr
            $exitCode = [int]$captured.exitCode
            $stdoutEncoding = $captured.stdoutEncoding
            $stderrEncoding = $captured.stderrEncoding
            $stdoutFallbackUsed = $captured.stdoutFallbackUsed
            $stderrFallbackUsed = $captured.stderrFallbackUsed
            $stdoutDecodeStatus = $captured.stdoutDecodeStatus
            $stderrDecodeStatus = $captured.stderrDecodeStatus
            $stdoutByteCount = $captured.stdoutByteCount
            $stderrByteCount = $captured.stderrByteCount
        }
        catch {
            $stderr = $_.Exception.Message
            $exitCode = 127
        }
    }
    finally {
        Pop-Location
    }
    $ended = (Get-Date).ToUniversalTime().ToString('o')
    $status = if ($expected -contains $exitCode) { 'PASS' } else { 'FAIL' }
    $combinedOutput = "$stdout`n$stderr"
    $outputDecodeFailure = $stdoutDecodeStatus -ne 'VALID' -or $stderrDecodeStatus -ne 'VALID'
    if ($outputDecodeFailure) {
        $status = 'FAIL'
        $classification = 'EVIDENCE_ENCODING_FAILURE'
    }
    $environmentFailurePattern = '(?i)WinError\s*5|EACCES|EPERM|access.*denied|permission.*denied|拒绝访问|ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|Could not resolve host|UnknownHostException|Temporary failure in name resolution|Name or service not known|network\s+is\s+unreachable|connect(?:ion)?[^\r\n]*(?:timed out|timeout|refused)|PKIX path building failed|unable to get local issuer certificate'
    if ($status -eq 'FAIL' -and -not $outputDecodeFailure -and $combinedOutput -match $environmentFailurePattern) {
        $classification = 'ENVIRONMENT_BLOCKED'
    }
    if ($outputDecodeFailure) { $message = 'native stdout/stderr bytes failed strict UTF-8 and Windows system-codepage decoding' }
    elseif ($status -eq 'FAIL') { $message = "unexpected exit $exitCode; expected $($expected -join ',')" }
    $logLines = [System.Collections.Generic.List[string]]::new()
    $logLines.Add("STEP_ID=$id")
    $logLines.Add("GROUP=$GroupName")
    $logLines.Add("MANDATORY=$mandatory")
    $logLines.Add("START_UTC=$started")
    $logLines.Add("STDOUT_ENCODING=$stdoutEncoding")
    $logLines.Add("STDOUT_FALLBACK_USED=$stdoutFallbackUsed")
    $logLines.Add("STDOUT_DECODE_STATUS=$stdoutDecodeStatus")
    $logLines.Add("STDOUT_BYTE_COUNT=$stdoutByteCount")
    $logLines.Add("STDERR_ENCODING=$stderrEncoding")
    $logLines.Add("STDERR_FALLBACK_USED=$stderrFallbackUsed")
    $logLines.Add("STDERR_DECODE_STATUS=$stderrDecodeStatus")
    $logLines.Add("STDERR_BYTE_COUNT=$stderrByteCount")
    $logLines.Add('[STDOUT]')
    foreach ($line in @($stdout -split "`r?`n")) { if ($line.Length -gt 0) { $logLines.Add((Protect-GateText -Text $line -Config $Config)) } }
    $logLines.Add('[STDERR]')
    foreach ($line in @($stderr -split "`r?`n")) { if ($line.Length -gt 0) { $logLines.Add((Protect-GateText -Text $line -Config $Config)) } }
    $logLines.Add("END_UTC=$ended")
    $logLines.Add("EXIT_CODE=$exitCode")
    $logLines.Add("STATUS=$status")
    $logLines.Add("CLASSIFICATION=$(if ($status -eq 'PASS') { 'NONE' } else { $classification })")
    [IO.File]::WriteAllLines($logPath, $logLines, [Text.UTF8Encoding]::new($false))
    return [pscustomobject]@{
        id = $id; status = $status; exitCode = $exitCode
        classification = $(if ($status -eq 'PASS') { 'NONE' } else { $classification })
        mandatory = $mandatory; startedAtUtc = $started; endedAtUtc = $ended
        log = $logRelative; message = $message
        outputEncoding = [pscustomobject]@{
            stdout = $stdoutEncoding; stderr = $stderrEncoding
            stdoutFallbackUsed = $stdoutFallbackUsed; stderrFallbackUsed = $stderrFallbackUsed
            stdoutDecodeStatus = $stdoutDecodeStatus; stderrDecodeStatus = $stderrDecodeStatus
            stdoutByteCount = $stdoutByteCount; stderrByteCount = $stderrByteCount
        }
    }
}

function Get-GateVerdict {
    param([Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$Results)
    if (@($Results | Where-Object { $_.status -eq 'FAIL' -and $_.classification -eq 'CODE_FAILURE' }).Count -gt 0) { return 'FAIL' }
    if (@($Results | Where-Object { $_.status -eq 'FAIL' -and $_.classification -eq 'ENVIRONMENT_BLOCKED' }).Count -gt 0) { return 'ENVIRONMENT_BLOCKED' }
    if (@($Results | Where-Object { $_.mandatory -and $_.status -ne 'PASS' }).Count -gt 0) { return 'FAIL' }
    return 'PASS'
}

function Invoke-GateGroup {
    param(
        [Parameter(Mandatory = $true)][object]$Config,
        [Parameter(Mandatory = $true)][string]$GroupName,
        [Parameter(Mandatory = $true)][string]$EvidencePath,
        [Parameter(Mandatory = $true)][string]$RunId,
        [switch]$AllowEmpty
    )
    $repoRoot = Get-GateRepoRoot
    $commit = Get-GateCommit -RepoRoot $repoRoot
    $context = @{ repoRoot = $repoRoot; evidencePath = $EvidencePath; commit = $commit; runId = $RunId }
    try { $steps = @(Get-GateSteps -Config $Config -GroupName $GroupName) }
    catch { $steps = @(); $results = @(New-InvalidStepResult -Id "$GroupName-config" -Message $_.Exception.Message) }
    if (-not (Get-Variable results -ErrorAction SilentlyContinue)) { $results = @() }
    if ($steps.Count -eq 0 -and -not $AllowEmpty -and $results.Count -eq 0) {
        $results += New-InvalidStepResult -Id "$GroupName-empty" -Message "mandatory gate group $GroupName has no steps"
    }
    for ($index = 0; $index -lt $steps.Count; $index++) {
        $results += Invoke-GateStep -Step $steps[$index] -Config $Config -EvidencePath $EvidencePath -GroupName $GroupName -Index ($index + 1) -Context $context
    }
    $verdict = Get-GateVerdict -Results $results
    $record = [ordered]@{ schemaVersion = '1.0'; group = $GroupName; verdict = $verdict; results = $results }
    $path = Join-Path $EvidencePath "gate-result-$GroupName.json"
    [IO.File]::WriteAllText($path, ($record | ConvertTo-Json -Depth 12), [Text.UTF8Encoding]::new($false))
    return [pscustomobject]@{ group = $GroupName; verdict = $verdict; results = $results; path = $path }
}

function Copy-GateArtifacts {
    param([Parameter(Mandatory = $true)][string]$EvidencePath)
    $repoRoot = Get-GateRepoRoot
    $mappings = @(
        @{ Pattern = 'surefire-reports'; Target = 'surefire'; Filter = '*.xml' },
        @{ Pattern = 'failsafe-reports'; Target = 'failsafe'; Filter = '*.xml' }
    )
    foreach ($mapping in $mappings) {
        Get-ChildItem -LiteralPath (Join-Path $repoRoot 'technical-platform') -Directory -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -eq $mapping.Pattern } |
            ForEach-Object {
                Get-ChildItem -LiteralPath $_.FullName -File -Filter $mapping.Filter -ErrorAction SilentlyContinue | ForEach-Object {
                    $relative = $_.FullName.Substring($repoRoot.Length + 1) -replace '[:/\\]', '__'
                    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path (Join-Path $EvidencePath $mapping.Target) $relative) -Force
                }
            }
    }
    $traceRoot = Join-Path $repoRoot 'technical-platform\web\test-results'
    if (Test-Path -LiteralPath $traceRoot) {
        Get-ChildItem -LiteralPath $traceRoot -File -Filter 'trace.zip' -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
            $relative = $_.FullName.Substring($traceRoot.Length + 1) -replace '[:/\\]', '__'
            Copy-Item -LiteralPath $_.FullName -Destination (Join-Path (Join-Path $EvidencePath 'traces') $relative) -Force
        }
    }
}

function Write-EvidenceChecksums {
    param([Parameter(Mandatory = $true)][string]$EvidencePath)
    $root = (Resolve-Path $EvidencePath).Path
    $checksumPath = Join-Path $root 'checksums.sha256'
    $lines = Get-ChildItem -LiteralPath $root -File -Recurse |
        Where-Object { $_.FullName -ne $checksumPath } |
        Sort-Object { $_.FullName.Substring($root.Length + 1) } |
        ForEach-Object {
            $relative = $_.FullName.Substring($root.Length + 1).Replace('\', '/')
            "$((Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash)  $relative"
        }
    [IO.File]::WriteAllLines($checksumPath, @($lines), [Text.UTF8Encoding]::new($false))
}

function Test-EvidenceChecksums {
    param([Parameter(Mandatory = $true)][string]$EvidencePath)
    $root = (Resolve-Path $EvidencePath).Path
    $checksumPath = Join-Path $root 'checksums.sha256'
    if (-not (Test-Path -LiteralPath $checksumPath -PathType Leaf)) { return $false }
    foreach ($line in Get-Content -Encoding UTF8 -LiteralPath $checksumPath) {
        if ($line -notmatch '^([0-9A-F]{64})  (.+)$') { return $false }
        $path = Join-Path $root $Matches[2].Replace('/', '\')
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $false }
        if ((Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash -ne $Matches[1]) { return $false }
    }
    return $true
}

function Complete-GateEvidence {
    param(
        [Parameter(Mandatory = $true)][string]$GateName,
        [Parameter(Mandatory = $true)][string]$EvidencePath,
        [Parameter(Mandatory = $true)][string]$RunId,
        [Parameter(Mandatory = $true)][object[]]$GroupResults,
        [Parameter(Mandatory = $true)][string]$Verdict
    )
    Copy-GateArtifacts -EvidencePath $EvidencePath
    $configPathForMetadata = $null
    $runtimeTemp = $null
    $tempCleanup = [ordered]@{ attempted = $false; removed = $false; error = $null }
    $activeConfigVariable = Get-Variable -Name activeGateConfig -Scope Script -ErrorAction SilentlyContinue
    if ($null -ne $activeConfigVariable -and $null -ne $activeConfigVariable.Value) {
        $runtimeTemp = Get-GateRuntimeTempPath -Config $activeConfigVariable.Value -EvidencePath $EvidencePath -RunId $RunId
        if (Test-Path -LiteralPath $runtimeTemp) {
            $tempCleanup.attempted = $true
            try {
                $tempRoot = Split-Path -Parent $runtimeTemp
                $resolvedRoot = [IO.Path]::GetFullPath($tempRoot).TrimEnd('\')
                $resolvedTarget = [IO.Path]::GetFullPath($runtimeTemp)
                if (-not $resolvedTarget.StartsWith($resolvedRoot + '\', [StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $resolvedTarget) -ne $RunId) {
                    throw "unsafe runtime temp cleanup target: $resolvedTarget"
                }
                Remove-Item -LiteralPath $resolvedTarget -Recurse -Force -ErrorAction Stop
                $tempCleanup.removed = -not (Test-Path -LiteralPath $resolvedTarget)
            }
            catch { $tempCleanup.error = $_.Exception.Message }
        }
    }
    $metadata = [ordered]@{
        schemaVersion = '1.0'; gate = $GateName; runId = $RunId
        commit = Get-GateCommit; repoRoot = Get-GateRepoRoot
        startedAtUtc = ($GroupResults | ForEach-Object { $_.results } | ForEach-Object { $_.startedAtUtc } | Select-Object -First 1)
        completedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
        verdict = $Verdict
        groups = @($GroupResults | ForEach-Object { [ordered]@{ name = $_.group; verdict = $_.verdict; resultCount = @($_.results).Count } })
        independentGatePassClaimed = $false
        commitOrPushPerformed = $false
        runtimeTempPath = $runtimeTemp
        runtimeTempCleanup = $tempCleanup
    }
    [IO.File]::WriteAllText((Join-Path $EvidencePath 'metadata.json'), ($metadata | ConvertTo-Json -Depth 10), [Text.UTF8Encoding]::new($false))
    $verdictLines = @(
        "# Local $GateName verdict",
        '',
        "- Verdict: $Verdict",
        "- Commit: $($metadata.commit)",
        "- Run ID: $RunId",
        '- Independent review: NOT_PERFORMED',
        '- Commit/push: NOT_PERFORMED'
    )
    [IO.File]::WriteAllLines((Join-Path $EvidencePath 'VERDICT.md'), $verdictLines, [Text.UTF8Encoding]::new($false))
    Write-EvidenceChecksums -EvidencePath $EvidencePath
    if (-not (Test-EvidenceChecksums -EvidencePath $EvidencePath)) { throw 'evidence checksum self-verification failed' }
}

function Invoke-StandaloneGate {
    param(
        [Parameter(Mandatory = $true)][string]$GateName,
        [Parameter(Mandatory = $true)][string]$GroupName,
        [Parameter(Mandatory = $true)][string]$ConfigPath,
        [string]$EvidenceRoot,
        [string]$RunId,
        [string]$ExistingEvidencePath,
        [switch]$NoLock
    )
    $config = Read-GateConfig -ConfigPath $ConfigPath
    $script:activeGateConfig = $config
    if ([string]::IsNullOrWhiteSpace($RunId)) { $RunId = New-GateRunId -GateName $GateName }
    $evidencePath = if ([string]::IsNullOrWhiteSpace($ExistingEvidencePath)) {
        New-GateEvidencePath -Config $config -RunId $RunId -EvidenceRoot $EvidenceRoot
    } else { Resolve-GatePath -Path $ExistingEvidencePath }
    $lockHandle = $null
    $lockPath = Resolve-GatePath -Path ([string]$config.lockPath) -AllowMissing
    try {
        if (-not $NoLock) { $lockHandle = Enter-GateLock -Path $lockPath }
        $result = Invoke-GateGroup -Config $config -GroupName $GroupName -EvidencePath $evidencePath -RunId $RunId
        if ([string]::IsNullOrWhiteSpace($ExistingEvidencePath)) {
            Complete-GateEvidence -GateName $GateName -EvidencePath $evidencePath -RunId $RunId -GroupResults @($result) -Verdict $result.verdict
        }
        return [pscustomobject]@{ evidencePath = $evidencePath; verdict = $result.verdict; result = $result }
    }
    finally {
        if ($null -ne $lockHandle) { Exit-GateLock -Handle $lockHandle -Path $lockPath }
    }
}

function Get-GateExitCode {
    param([Parameter(Mandatory = $true)][string]$Verdict)
    if ($Verdict -eq 'PASS') { return 0 }
    if ($Verdict -eq 'ENVIRONMENT_BLOCKED') { return 2 }
    return 1
}

function Get-GateExceptionVerdict {
    param([Parameter(Mandatory = $true)][Exception]$Exception)
    $cursor = $Exception
    while ($null -ne $cursor) {
        if ($cursor -is [UnauthorizedAccessException] -or $cursor.Message -match '(?i)access.*denied|permission.*denied|拒绝访问') {
            return 'ENVIRONMENT_BLOCKED'
        }
        $cursor = $cursor.InnerException
    }
    return 'FAIL'
}

function Write-StructuredGateException {
    param(
        [Parameter(Mandatory = $true)][string]$GateName,
        [Parameter(Mandatory = $true)][Exception]$Exception
    )
    $verdict = Get-GateExceptionVerdict -Exception $Exception
    $payload = [ordered]@{
        schemaVersion = '1.0'
        gate = $GateName
        verdict = $verdict
        classification = $(if ($verdict -eq 'ENVIRONMENT_BLOCKED') { 'EVIDENCE_ROOT_UNAVAILABLE' } else { 'ORCHESTRATOR_FAILURE' })
        message = $Exception.Message
        independentGatePassClaimed = $false
    }
    return [pscustomobject]@{ verdict = $verdict; json = ($payload | ConvertTo-Json -Compress) }
}
