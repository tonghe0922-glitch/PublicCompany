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
 'technical-platform/web/src/platform/processes/p008/contracts.ts',
 'technical-platform/web/src/platform/processes/p008/service.ts',
 'technical-platform/web/src/platform/processes/p008/selectors.ts',
 'technical-platform/web/src/platform/processes/p008/useP008Leave.ts',
 'technical-platform/web/src/platform/processes/p008/P008LeaveCreateForm.vue',
 'technical-platform/web/src/platform/processes/p008/P008LeaveRecordList.vue',
 'technical-platform/web/src/platform/processes/p008/P008LeaveActionPanel.vue',
 'technical-platform/web/src/platform/processes/p008/P008LeaveQuotaPanel.vue',
 'technical-platform/web/src/platform/processes/p008/index.ts',
 'technical-platform/web/src/platform/processes/p008/p008-contracts.test.ts',
 'technical-platform/web/src/platform/processes/p008/p008-service.test.ts',
 'technical-platform/web/src/platform/processes/p008/p008-components.test.ts',
 'technical-platform/web/src/platform/processes/p008/p008-page.test.ts',
 'technical-platform/web/src/platform/processes/p009/contracts.ts',
 'technical-platform/web/src/platform/processes/p009/service.ts',
 'technical-platform/web/src/platform/processes/p009/selectors.ts',
 'technical-platform/web/src/platform/processes/p009/useP009Overtime.ts',
 'technical-platform/web/src/platform/processes/p009/P009OvertimeCreateForm.vue',
 'technical-platform/web/src/platform/processes/p009/P009OvertimeRecordList.vue',
 'technical-platform/web/src/platform/processes/p009/P009OvertimeActionPanel.vue',
 'technical-platform/web/src/platform/processes/p009/P009OvertimeCompensationPanel.vue',
 'technical-platform/web/src/platform/processes/p009/index.ts',
 'technical-platform/web/src/platform/processes/p009/p009-contracts.test.ts',
 'technical-platform/web/src/platform/processes/p009/p009-service.test.ts',
 'technical-platform/web/src/platform/processes/p009/p009-components.test.ts',
 'technical-platform/web/src/platform/processes/p009/p009-page.test.ts',
 'technical-platform/web/src/platform/processes/p010/contracts.ts',
 'technical-platform/web/src/platform/processes/p010/service.ts',
 'technical-platform/web/src/platform/processes/p010/selectors.ts',
 'technical-platform/web/src/platform/processes/p010/useP010Learning.ts',
 'technical-platform/web/src/platform/processes/p010/P010LearningCreateForm.vue',
 'technical-platform/web/src/platform/processes/p010/P010LearningRecordList.vue',
 'technical-platform/web/src/platform/processes/p010/P010LearningActionPanel.vue',
 'technical-platform/web/src/platform/processes/p010/P010QualificationPanel.vue',
 'technical-platform/web/src/platform/processes/p010/index.ts',
 'technical-platform/web/src/platform/processes/p010/p010-contracts.test.ts',
 'technical-platform/web/src/platform/processes/p010/p010-service.test.ts',
 'technical-platform/web/src/platform/processes/p010/p010-components.test.ts',
 'technical-platform/web/src/platform/processes/p010/p010-page.test.ts',
 'technical-platform/web/src/platform/pages/P008LeavePage.vue',
 'technical-platform/web/src/platform/pages/P009OvertimePage.vue',
 'technical-platform/web/src/platform/pages/P010LearningPage.vue',
 'docs/implementation/ui/page-component-plans/P008LeavePage.ui-plan.json',
 'docs/implementation/ui/page-component-plans/P009OvertimePage.ui-plan.json',
 'docs/implementation/ui/page-component-plans/P010LearningPage.ui-plan.json',
 'docs/implementation/ui/L0-L5_COVERAGE_MATRIX.md',
 'docs/implementation/ui/page-component-plans/P10-COMP-05_REPORT.md',
 'technical-platform/web/e2e/phase10-p008-live.spec.ts',
 'technical-platform/web/e2e/phase10-p009-live.spec.ts',
 'technical-platform/web/e2e/phase10-p010-live.spec.ts'
)
$excludedNames=@('.git','.runlogs','__pycache__','node_modules','target','dist','reports','test-results','playwright-report','coverage')
$excludedPrefixes=@(
 'docs/implementation/phases/PHASE-10/evidence/P10-COMP-00/',
 'technical-platform/web/src/design-system/evidence/P10-COMP-01/',
 'technical-platform/web/src/router/evidence/P10-COMP-02/',
 'docs/implementation/ui/evidence/P10-COMP-03A/',
 'docs/implementation/ui/evidence/P10-COMP-03/',
 'docs/implementation/ui/page-component-plans/evidence/P10-COMP-04/',
 'docs/implementation/ui/page-component-plans/evidence/P10-COMP-05/'
)
function Id([object[]]$x){$j=$x|ConvertTo-Json -Depth 6 -Compress;if($null-eq$j){$j='[]'};([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($j)))).Replace('-','')}
function Rel([string]$full){$prefix=$root.TrimEnd('\')+'\';if(-not$full.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)){throw "OUTSIDE: $full"};$full.Substring($prefix.Length).Replace('\','/')}
function Excluded([string]$rel){if($rel-match'(^|/)\.env(?:\..*)?$'){return $true};foreach($p in $excludedPrefixes){if($rel.StartsWith($p,[StringComparison]::OrdinalIgnoreCase)){return $true}};return $false}
$workspace=@();$seen=@{};$stack=New-Object 'System.Collections.Generic.Stack[System.IO.DirectoryInfo]';$stack.Push((Get-Item $root))
while($stack.Count){$d=$stack.Pop();foreach($cd in @(Get-ChildItem -LiteralPath $d.FullName -Directory -Force)){if($cd.Attributes-band[IO.FileAttributes]::ReparsePoint){continue};if($excludedNames-contains$cd.Name){continue};$r=(Rel $cd.FullName)+'/';$skip=$false;foreach($p in $excludedPrefixes){if($r.StartsWith($p,[StringComparison]::OrdinalIgnoreCase)){$skip=$true;break}};if(-not$skip){$stack.Push($cd)}};foreach($f in @(Get-ChildItem -LiteralPath $d.FullName -File -Force)){$r=Rel $f.FullName;if(Excluded $r){continue};$k=$r.ToLowerInvariant();if($seen.ContainsKey($k)){throw "DUPLICATE: $r"};$seen[$k]=$r;$workspace+=[ordered]@{path=$r;sha256=(Get-FileHash $f.FullName -Algorithm SHA256).Hash;bytes=$f.Length}}}
$workspace=@($workspace|Sort-Object path)
$task=@();foreach($r in $planned){$f=Join-Path $root $r;if(Test-Path -LiteralPath $f -PathType Leaf){$i=Get-Item $f;$task+=[ordered]@{path=$r;exists=$true;sha256=(Get-FileHash $f -Algorithm SHA256).Hash;bytes=$i.Length}}else{$task+=[ordered]@{path=$r;exists=$false;sha256=$null;bytes=0}}};$task=@($task|Sort-Object path);$meta=@()
$m=[ordered]@{schema_version='1.0';kind='P10-COMP-05-pre-baseline';repository_root=$root;generated_at_utc=(Get-Date).ToUniversalTime().ToString('o');git_present=(Test-Path (Join-Path $root '.git'));git_status=if(Test-Path (Join-Path $root '.git')){'PRESENT_NOT_QUERIED'}else{'ABSENT'};workspace_source_id=Id $workspace;task_source_id=Id $task;evidence_metadata_id=Id $meta;workspace_file_count=$workspace.Count;task_source_path_count=$task.Count;task_source_existing_file_count=@($task|?{$_.exists}).Count;task_source_missing_file_count=@($task|?{-not$_.exists}).Count;evidence_metadata_file_count=0;package_local_00_exit=$PackageLocal00Exit;package_local_01_exit=$PackageLocal01Exit;project_preflight_exit=$ProjectPreflightExit;runtime_boundary='pre-existing active runtime / source-baseline non-writer';runtime_before='active-runtime-boundary-before.json';runtime_after='active-runtime-boundary-after.json';excluded_directories=$excludedNames;excluded_evidence_prefixes=$excludedPrefixes;files=[ordered]@{workspace_source=$workspace;task_source=$task;evidence_metadata=$meta}}
$m|ConvertTo-Json -Depth 8|Set-Content -Encoding UTF8 (Join-Path $OutputDirectory 'baseline-manifest.json');$m.workspace_source_id|Set-Content -NoNewline -Encoding ASCII (Join-Path $OutputDirectory 'WORKSPACE_SOURCE_ID.txt');$m.task_source_id|Set-Content -NoNewline -Encoding ASCII (Join-Path $OutputDirectory 'TASK_SOURCE_ID.txt');$m.evidence_metadata_id|Set-Content -NoNewline -Encoding ASCII (Join-Path $OutputDirectory 'EVIDENCE_METADATA_ID.txt')
Write-Output "BASELINE PASS workspace=$($m.workspace_source_id)/$($m.workspace_file_count) task=$($m.task_source_id)/$($m.task_source_path_count) existing=$($m.task_source_existing_file_count) missing=$($m.task_source_missing_file_count) metadata=$($m.evidence_metadata_id)/0 git=$($m.git_status)"
