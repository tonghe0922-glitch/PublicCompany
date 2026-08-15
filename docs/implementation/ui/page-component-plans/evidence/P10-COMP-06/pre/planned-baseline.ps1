param(
    [Parameter(Mandatory=$true)][string]$RepositoryRoot,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [int]$PackageLocal00Exit=1,
    [int]$PackageLocal01Exit=1,
    [int]$ProjectPreflightExit=0
)
$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath $RepositoryRoot).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory|Out-Null
$planned=@(
 'docs/implementation/ui/page-component-plans/Phase10TechMonitorPage.ui-plan.json',
 'docs/implementation/ui/page-component-plans/P10-COMP-06_REPORT.md',
 'technical-platform/web/src/contracts/monitoring.ts',
 'technical-platform/web/src/contracts/index.ts',
 'technical-platform/web/src/platform/processes/shared/monitoring/index.ts',
 'technical-platform/web/src/platform/processes/shared/monitoring/monitor-service.ts',
 'technical-platform/web/src/platform/processes/shared/monitoring/useMonitorProjection.ts',
 'technical-platform/web/src/platform/processes/shared/monitoring/MonitorStatusTable.vue',
 'technical-platform/web/src/platform/processes/shared/monitoring/MonitorPanel.vue',
 'technical-platform/web/src/platform/processes/shared/monitoring/monitor-service.test.ts',
 'technical-platform/web/src/platform/processes/shared/monitoring/monitor-components.test.ts',
 'technical-platform/web/src/platform/processes/shared/monitoring/monitor-page.test.ts',
 'technical-platform/web/src/platform/pages/Phase10TechMonitorPage.vue',
 'technical-platform/backend/apps/api/src/main/java/cn/shangjingu/platform/api/phase10/MonitorProjection.java',
 'technical-platform/backend/apps/api/src/main/java/cn/shangjingu/platform/api/phase10/Phase10TechMonitorController.java',
 'technical-platform/web/src/platform/pages/Phase09TechWorkflowMonitorPage.vue',
 'technical-platform/web/src/platform/pages/Phase09TechWorkflowMonitorPage.ui-plan.json',
 'technical-platform/web/src/router/portal-router.ts',
 'technical-platform/web/src/router/phase10-tech-monitor-router.test.ts',
 'technical-platform/web/src/platform/processes/shared/index.ts',
 'technical-platform/web/src/design-system/ui-component-access.test.ts',
 'docs/implementation/ui/UI_COMPONENT_REGISTRY.json',
 'docs/implementation/ui/L0-L5_COVERAGE_MATRIX.md',
 'technical-platform/backend/apps/api/src/test/java/cn/shangjingu/platform/api/Phase10TechMonitorIntegrationTest.java',
 'technical-platform/backend/apps/api/src/test/java/cn/shangjingu/platform/api/Phase10TechMonitorBrowserBackendFixture.java',
 'technical-platform/web/e2e/phase10-tech-monitor-live.spec.ts',
 'technical-platform/web/playwright.phase10-tech-monitor-live.config.ts',
 'technical-platform/web/src/design-system/layout/PortalShell.landmark.test.ts',
 'scripts/implementation/phase10_component_source_gate_test.py',
 'technical-platform/web/knip.json'
)
$excludedNames=@('.git','.runlogs','__pycache__','node_modules','target','dist','reports','test-results','playwright-report','coverage')
$excludedPrefixes=@(
 'docs/implementation/phases/PHASE-10/evidence/P10-COMP-00/',
 'technical-platform/web/src/design-system/evidence/P10-COMP-01/',
 'technical-platform/web/src/router/evidence/P10-COMP-02/',
 'docs/implementation/ui/evidence/P10-COMP-03A/',
 'docs/implementation/ui/evidence/P10-COMP-03/',
 'docs/implementation/ui/page-component-plans/evidence/P10-COMP-04/',
 'docs/implementation/ui/page-component-plans/evidence/P10-COMP-05/',
 'docs/implementation/ui/page-component-plans/evidence/P10-COMP-06/'
)
function Id([object[]]$x){$j=$x|ConvertTo-Json -Depth 6 -Compress;if($null-eq$j){$j='[]'};([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($j)))).Replace('-','')}
function Rel([string]$full){$prefix=$root.TrimEnd('\')+'\';if(-not$full.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)){throw "OUTSIDE: $full"};$full.Substring($prefix.Length).Replace('\','/')}
function Excluded([string]$rel){if($rel-match'(^|/)\.env(?:\..*)?$'){return $true};foreach($p in $excludedPrefixes){if($rel.StartsWith($p,[StringComparison]::OrdinalIgnoreCase)){return $true}};return $false}
$workspace=@();$seen=@{};$stack=New-Object 'System.Collections.Generic.Stack[System.IO.DirectoryInfo]';$stack.Push((Get-Item $root))
while($stack.Count){
 $d=$stack.Pop()
 foreach($cd in @(Get-ChildItem -LiteralPath $d.FullName -Directory -Force)){
  if($cd.Attributes-band[IO.FileAttributes]::ReparsePoint){continue};if($excludedNames-contains$cd.Name){continue}
  $r=(Rel $cd.FullName)+'/';$skip=$false;foreach($p in $excludedPrefixes){if($r.StartsWith($p,[StringComparison]::OrdinalIgnoreCase)){$skip=$true;break}};if(-not$skip){$stack.Push($cd)}
 }
 foreach($f in @(Get-ChildItem -LiteralPath $d.FullName -File -Force)){
  $r=Rel $f.FullName;if(Excluded $r){continue};$k=$r.ToLowerInvariant();if($seen.ContainsKey($k)){throw "DUPLICATE: $r"};$seen[$k]=$r
  $workspace+=[ordered]@{path=$r;sha256=(Get-FileHash $f.FullName -Algorithm SHA256).Hash;bytes=$f.Length}
 }
}
$workspace=@($workspace|Sort-Object path)
$task=@();foreach($r in $planned){$f=Join-Path $root $r;if(Test-Path -LiteralPath $f -PathType Leaf){$i=Get-Item $f;$task+=[ordered]@{path=$r;exists=$true;sha256=(Get-FileHash $f -Algorithm SHA256).Hash;bytes=$i.Length}}else{$task+=[ordered]@{path=$r;exists=$false;sha256=$null;bytes=0}}};$task=@($task|Sort-Object path);$meta=@()
$m=[ordered]@{schema_version='1.0';kind='P10-COMP-06-pre-baseline';repository_root=$root;generated_at_utc=(Get-Date).ToUniversalTime().ToString('o');git_present=(Test-Path (Join-Path $root '.git'));git_status=if(Test-Path (Join-Path $root '.git')){'PRESENT_NOT_QUERIED'}else{'ABSENT'};workspace_source_id=Id $workspace;task_source_id=Id $task;evidence_metadata_id=Id $meta;workspace_file_count=$workspace.Count;task_source_path_count=$task.Count;task_source_existing_file_count=@($task|Where-Object{$_.exists}).Count;task_source_missing_file_count=@($task|Where-Object{-not$_.exists}).Count;evidence_metadata_file_count=0;package_local_00_exit=$PackageLocal00Exit;package_local_01_exit=$PackageLocal01Exit;project_preflight_exit=$ProjectPreflightExit;runtime_boundary='pre-existing active runtime / source-baseline non-writer';runtime_before='active-runtime-boundary-before.json';runtime_after='active-runtime-boundary-after.json';fixture_ports=@(18093,5370,5371,5372);excluded_directories=$excludedNames;excluded_evidence_prefixes=$excludedPrefixes;files=[ordered]@{workspace_source=$workspace;task_source=$task;evidence_metadata=$meta}}
$m|ConvertTo-Json -Depth 8|Set-Content -Encoding UTF8 (Join-Path $OutputDirectory 'baseline-manifest.json')
$m.workspace_source_id|Set-Content -NoNewline -Encoding ASCII (Join-Path $OutputDirectory 'WORKSPACE_SOURCE_ID.txt')
$m.task_source_id|Set-Content -NoNewline -Encoding ASCII (Join-Path $OutputDirectory 'TASK_SOURCE_ID.txt')
$m.evidence_metadata_id|Set-Content -NoNewline -Encoding ASCII (Join-Path $OutputDirectory 'EVIDENCE_METADATA_ID.txt')

$expected=@(15196,35248,36432,40796,41392,43248,44872);$ports=@(5173,5174,5175,18093,5370,5371,5372)
$procs=@(Get-CimInstance Win32_Process|Where-Object{$expected-contains[int]$_.ProcessId}|Sort-Object ProcessId|ForEach-Object{[ordered]@{pid=[int]$_.ProcessId;parent_pid=[int]$_.ParentProcessId;name=$_.Name;created=$_.CreationDate.ToUniversalTime().ToString('o');command_line=$_.CommandLine}})
$listeners=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue|Where-Object{$ports-contains[int]$_.LocalPort}|Sort-Object LocalPort|ForEach-Object{[ordered]@{address=$_.LocalAddress;port=[int]$_.LocalPort;pid=[int]$_.OwningProcess}})
$tc=@(docker ps -q --filter 'label=org.testcontainers=true');$ryuk=@(docker ps -q --filter 'ancestor=testcontainers/ryuk:0.12.0')
$after=[ordered]@{captured_at_utc=(Get-Date).ToUniversalTime().ToString('o');classification='pre-existing active runtime / source-baseline non-writer';expected_process_ids=$expected;process_count=$procs.Count;processes=$procs;tracked_ports=$ports;listener_count=$listeners.Count;listeners=$listeners;fresh_ports=@(18093,5370,5371,5372);fresh_listener_count=@($listeners|Where-Object{$_.port-in@(18093,5370,5371,5372)}).Count;running_testcontainers_count=$tc.Count;running_testcontainers=$tc;running_ryuk_count=$ryuk.Count;running_ryuk=$ryuk}
$after|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $OutputDirectory 'active-runtime-boundary-after.json') -Encoding UTF8
$before=Get-Content -LiteralPath (Join-Path $OutputDirectory 'active-runtime-boundary-before.json') -Raw|ConvertFrom-Json
$diff=@();foreach($entry in @($m.files.task_source)){$path=Join-Path $root ($entry.path-replace'/','\');$exists=Test-Path -LiteralPath $path -PathType Leaf;if($exists-ne[bool]$entry.exists){$diff+=[ordered]@{path=$entry.path;reason='exists';before=$entry.exists;after=$exists};continue};if($exists){$sha=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash;$bytes=(Get-Item -LiteralPath $path).Length;if($sha-ne$entry.sha256-or$bytes-ne[int64]$entry.bytes){$diff+=[ordered]@{path=$entry.path;reason='content';before_sha=$entry.sha256;after_sha=$sha;before_bytes=$entry.bytes;after_bytes=$bytes}}}}
$check=[ordered]@{checked_at_utc=(Get-Date).ToUniversalTime().ToString('o');planned_count=@($m.files.task_source).Count;existing_count=@($m.files.task_source|Where-Object exists).Count;missing_count=@($m.files.task_source|Where-Object{-not$_.exists}).Count;mismatch_count=$diff.Count;mismatches=$diff};$check|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $OutputDirectory 'candidate-after-check.json') -Encoding UTF8
$beforePids=@($before.processes.pid|Sort-Object);$afterPids=@($after.processes.pid|Sort-Object);$beforeListeners=@($before.listeners|ForEach-Object{"$($_.port):$($_.pid)"}|Sort-Object);$afterListeners=@($after.listeners|ForEach-Object{"$($_.port):$($_.pid)"}|Sort-Object)
$summary=[ordered]@{workspace_id=$m.workspace_source_id;workspace_count=$m.workspace_file_count;task_id=$m.task_source_id;task_count=$m.task_source_path_count;task_existing=$m.task_source_existing_file_count;task_missing=$m.task_source_missing_file_count;metadata_id=$m.evidence_metadata_id;metadata_count=$m.evidence_metadata_file_count;git_status=$m.git_status;package_local_00_exit=$m.package_local_00_exit;package_local_01_exit=$m.package_local_01_exit;project_preflight_exit=$m.project_preflight_exit;before_process_count=$before.process_count;after_process_count=$after.process_count;same_process_ids=(Compare-Object $beforePids $afterPids).Count-eq0;before_listener_count=$before.listener_count;after_listener_count=$after.listener_count;same_listener_owners=(Compare-Object $beforeListeners $afterListeners).Count-eq0;fresh_listener_count=$after.fresh_listener_count;running_testcontainers_count=$after.running_testcontainers_count;running_ryuk_count=$after.running_ryuk_count;candidate_mismatch_count=$diff.Count}
$summary|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $OutputDirectory 'baseline-summary.json') -Encoding UTF8
$summary|ConvertTo-Json -Compress
if($m.task_source_path_count-ne30-or$m.task_source_existing_file_count-ne11-or$m.task_source_missing_file_count-ne19-or$after.process_count-ne7-or-not$summary.same_process_ids-or-not$summary.same_listener_owners-or$after.fresh_listener_count-ne0-or$after.running_testcontainers_count-ne0-or$after.running_ryuk_count-ne0-or$diff.Count-ne0){exit 9}
