#!/usr/bin/env python3
from pathlib import Path
import argparse,csv
ROOT=Path(__file__).resolve().parents[2];PHASE=ROOT/'docs/implementation/phases/PHASE-06';CONTRACTS=ROOT/'docs/implementation/contracts/phase-06'
def require(text,*terms):
    for term in terms: assert term in text,f'missing required term: {term}'
def check():
    progress=(ROOT/'docs/implementation/MASTER_PROGRESS.md').read_text(encoding='utf-8')
    require(progress,'| PHASE-05 | COMPLETE |','| PHASE-06 | READY_FOR_GATE |','| PHASE-07 | NOT_STARTED |','C8 full real regression + READY_FOR_GATE = READY_FOR_GATE','Formal Gate = READY_TO_RUN / NOT_RUN')
    gap=(PHASE/'GAP_MATRIX.md').read_text(encoding='utf-8');require(gap,'G06-18 | full phase integration proof | CLOSED_C8_READY_FOR_GATE','G06-19 | PHASE-06 Formal Gate | READY_FOR_FORMAL_GATE')
    assert 'IN_PROGRESS_C' not in gap
    report=(PHASE/'PHASE_REPORT.md').read_text(encoding='utf-8');require(report,'Report state: `READY_FOR_GATE`','C8 | READY_FOR_GATE','PHASE-07: `NOT_STARTED`')
    gate=(PHASE/'PHASE_GATE.md').read_text(encoding='utf-8');require(gate,'Current Gate state: `READY_TO_RUN / NOT_RUN`','PHASE GATE: NOT_RUN','PHASE-06 = READY_FOR_GATE','PHASE-07 = NOT_STARTED')
    c8=(PHASE/'C8_CHECKPOINT.md').read_text(encoding='utf-8');require(c8,'Construction state: `READY_FOR_GATE`','Exact candidate rule','independent PHASE-06 Formal Gate')
    for n in range(1,9): assert (PHASE/f'C{n}_CHECKPOINT.md').is_file(),f'missing C{n} checkpoint'
    required=[
      ROOT/'technical-platform/backend/modules/database-baseline/src/test/java/cn/shangjingu/platform/database/Phase06OutboxInboxDatabaseIT.java',
      ROOT/'technical-platform/backend/modules/database-baseline/src/test/java/cn/shangjingu/platform/database/Phase06FileObjectDatabaseIT.java',
      ROOT/'technical-platform/backend/modules/database-baseline/src/test/java/cn/shangjingu/platform/database/Phase06NotificationDatabaseIT.java',
      ROOT/'technical-platform/backend/modules/database-baseline/src/test/java/cn/shangjingu/platform/database/Phase06IntegrationDatabaseIT.java',
      ROOT/'technical-platform/backend/modules/database-baseline/src/test/java/cn/shangjingu/platform/database/Phase06AuditTraceDatabaseIT.java',
      ROOT/'technical-platform/backend/modules/document/src/test/java/cn/shangjingu/platform/document/MinioFileObjectStorageIT.java',
      ROOT/'technical-platform/backend/apps/api/src/test/java/cn/shangjingu/platform/api/platform/PlatformFileDownloadGuardTest.java',
      ROOT/'technical-platform/backend/apps/api/src/test/java/cn/shangjingu/platform/api/security/OpaqueAccessTokenFilterTraceTest.java',
      ROOT/'technical-platform/backend/modules/iam/src/test/java/cn/shangjingu/platform/iam/stepup/StepUpMinimumMfaTest.java',
      ROOT/'technical-platform/backend/apps/worker/src/test/java/cn/shangjingu/platform/worker/WebhookReceiptHandlerTest.java',
      CONTRACTS/'AUDIT_TRACE.md',CONTRACTS/'PLATFORM_HTTP_SECURITY.md',ROOT/'.github/workflows/phase06-gate.yml']
    for path in required: assert path.is_file() and path.stat().st_size>200,f'missing final evidence {path}'
    api=(ROOT/'docs/implementation/MASTER_API_CATALOG.md').read_text(encoding='utf-8');require(api,'Business API-like records: **0**','/api/v1/platform/files/{fileId}/download','/api/v1/platform/webhooks/{tenantId}/{endpointCode}')
    with (ROOT/'Construction Master Schedule.csv').open('r',encoding='gb18030',newline='') as h: rows={r['阶段'].strip():r for r in csv.DictReader(h)}
    assert rows['PHASE-06']['范围'].strip()=='Document/Outbox/Worker';assert rows['PHASE-13']['范围'].strip()=='P021–P023';assert rows['PHASE-14']['范围'].strip()=='P024–P027'
    workflow=(ROOT/'.github/workflows/phase06-gate.yml').read_text(encoding='utf-8');require(workflow,'Phase 06 Independent Gate','CANDIDATE_SHA','remote_sha','PHASE-06 formal gate verdict','phase06_final_gate_candidate.py')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');p.parse_args();check();print('PHASE-06 READY_FOR_GATE final candidate contract: PASS')
