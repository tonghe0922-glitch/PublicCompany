#!/usr/bin/env python3
from pathlib import Path
import argparse
ROOT=Path(__file__).resolve().parents[2];PHASE=ROOT/'docs/implementation/phases/PHASE-06'
CANDIDATE='d9a953c2da9bb560ed6c284a2adf1451ed09a7a4';CONSTRUCTION='31260482194';GATE_RUN='31260482190'
def require(text,*terms):
    for term in terms: assert term in text,f'missing PHASE-06 completion term: {term}'
def check():
    progress=(ROOT/'docs/implementation/MASTER_PROGRESS.md').read_text(encoding='utf-8');require(progress,'| PHASE-05 | COMPLETE |','| PHASE-06 | COMPLETE |','| PHASE-07 | NOT_STARTED |',CANDIDATE,CONSTRUCTION,GATE_RUN,'main = not merged')
    source=(PHASE/'SOURCE_CONTRACT.md').read_text(encoding='utf-8');require(source,'Current state: `COMPLETE`',CANDIDATE,'Construction run: `31260482194 = PASS`','Independent Formal Gate run: `31260482190 = PASS`','PHASE-07 = NOT_STARTED')
    c8=(PHASE/'C8_CHECKPOINT.md').read_text(encoding='utf-8');require(c8,'Canonical C8 state: `COMPLETE / GATE_PASSED`',CANDIDATE,'31260482194','31260482190')
    gate=(PHASE/'PHASE_GATE.md').read_text(encoding='utf-8');require(gate,'Current Gate state: `PASS`','PHASE GATE: PASS',CANDIDATE,CONSTRUCTION,GATE_RUN,'PHASE-07: `NOT_STARTED`')
    gaps=(PHASE/'GAP_MATRIX.md').read_text(encoding='utf-8');require(gaps,'Current state: `COMPLETE`','G06-18 | full phase integration proof | CLOSED_C8','G06-19 | PHASE-06 Formal Gate | CLOSED_GATE_PASS')
    assert 'IN_PROGRESS_C' not in gaps and 'READY_FOR_FORMAL_GATE' not in gaps
    impact=(PHASE/'IMPACT_MATRIX.md').read_text(encoding='utf-8');require(impact,'Current state: `COMPLETE`','Formal Gate: `PASS`','P021–P025: `OUT_OF_SCOPE_FOR_PHASE_06`')
    report=(PHASE/'PHASE_REPORT.md').read_text(encoding='utf-8');require(report,'Report state: `COMPLETE`','Formal Gate: `PASS`','C8 | COMPLETE / GATE_PASSED',CANDIDATE,CONSTRUCTION,GATE_RUN,'PHASE-07: `NOT_STARTED`')
    for n in range(1,9): assert (PHASE/f'C{n}_CHECKPOINT.md').is_file(),f'missing C{n} checkpoint'
    assert (ROOT/'.github/workflows/phase06-gate.yml').is_file();assert (ROOT/'scripts/implementation/phase06_final_gate_candidate.py').is_file()
    api=(ROOT/'docs/implementation/MASTER_API_CATALOG.md').read_text(encoding='utf-8');require(api,'Business API-like records: **0**')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');p.parse_args();check();print('PHASE-06 completion contract: PASS')
