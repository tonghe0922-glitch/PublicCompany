#!/usr/bin/env python3
"""PHASE-06 completed source/scope validator after independent Gate PASS."""
from pathlib import Path
import argparse,csv
ROOT=Path(__file__).resolve().parents[2];PHASE=ROOT/'docs/implementation/phases/PHASE-06';SCHEDULE=ROOT/'Construction Master Schedule.csv';WORKLIST=ROOT/'docs/implementation/PHASE_02_29_WORKLIST.md'
def require(text,*terms):
    for term in terms: assert term in text,f'missing required term: {term}'
def check():
    progress=(ROOT/'docs/implementation/MASTER_PROGRESS.md').read_text(encoding='utf-8');require(progress,'| PHASE-05 | COMPLETE |','| PHASE-06 | COMPLETE |','| PHASE-07 | NOT_STARTED |')
    source=(PHASE/'SOURCE_CONTRACT.md').read_text(encoding='utf-8');require(source,'Current state: `COMPLETE`','process_code: `PLATFORM/基础工程`','P021–P025','Transactional Outbox','MinIO','SAFE','Webhook','correlation_id','trace_id')
    gaps=(PHASE/'GAP_MATRIX.md').read_text(encoding='utf-8');require(gaps,'Current state: `COMPLETE`','CLOSED_C2','CLOSED_C3','CLOSED_C4','CLOSED_C5','CLOSED_C6','CLOSED_C7','CLOSED_C8','CLOSED_GATE_PASS')
    report=(PHASE/'PHASE_REPORT.md').read_text(encoding='utf-8');require(report,'Report state: `COMPLETE`','Formal Gate: `PASS`','PHASE-07: `NOT_STARTED`')
    gate=(PHASE/'PHASE_GATE.md').read_text(encoding='utf-8');require(gate,'Current Gate state: `PASS`','PHASE GATE: PASS')
    with SCHEDULE.open('r',encoding='gb18030',newline='') as h: rows={r['阶段'].strip():r for r in csv.DictReader(h)}
    assert rows['PHASE-06']['范围'].strip()=='Document/Outbox/Worker';assert rows['PHASE-13']['范围'].strip()=='P021–P023';assert rows['PHASE-14']['范围'].strip()=='P024–P027'
    section=WORKLIST.read_text(encoding='utf-8').split('## PHASE-06｜',1)[1].split('## PHASE-07｜',1)[0]
    for code in ('P021','P022','P023','P024','P025'): assert f'| {code} |' not in section
    assert (ROOT/'.github/workflows/phase06-gate.yml').is_file();assert (ROOT/'scripts/implementation/phase06_complete_contract.py').is_file()
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');p.parse_args();check();print('PHASE-06 completed source contract: PASS')
