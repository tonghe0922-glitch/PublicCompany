#!/usr/bin/env python3
from __future__ import annotations
import json, re, sys
from pathlib import Path
import phase04_source_contract as xlsx
ROOT=Path(__file__).resolve().parents[2]
PHASE=ROOT/'docs/implementation/phases/PHASE-11'
CONTRACT=ROOT/'docs/implementation/contracts/phase-11'
CODES=[f'P{i:03d}' for i in range(11,17)]
PORTALS={'employee','center','tech'}
SOURCE_RE=re.compile(r'^(?P<file>.+\.xlsx)#(?P<sheet>[^:]+):(?P<row>\d+)$')

def fail(message:str)->None: raise SystemExit('PHASE-11 C0 contract failed: '+message)
def main()->None:
    required=[
      PHASE/'PHASE11_PAGE_BINDINGS.json',PHASE/'PHASE11_HTTP_PERMISSION_CONTRACT.json',
      PHASE/'PHASE11_WORKFLOW_CONTRACT.json',PHASE/'DATABASE_CONTRACT.md',PHASE/'TEST_MATRIX.md',
      CONTRACT/'C0_DECISION_LOG.md',CONTRACT/'HTTP_PERMISSION_DATA_SCOPE.md',
      ROOT/'docs/implementation/phases/PHASE-11/IMPACT_MATRIX.md',ROOT/'docs/implementation/phases/PHASE-11/GAP_MATRIX.md']
    missing=[str(p.relative_to(ROOT)) for p in required if not p.is_file() or p.stat().st_size==0]
    if missing: fail('missing files: '+', '.join(missing))
    page=json.loads((PHASE/'PHASE11_PAGE_BINDINGS.json').read_text(encoding='utf-8'))
    records=page.get('bindings')
    if not isinstance(records,list) or len(records)!=18: fail('expected 18 frozen page bindings')
    seen=set(); cache={}
    for item in records:
      key=(item.get('process_code'),item.get('portal'))
      if key in seen: fail(f'duplicate binding {key}')
      seen.add(key)
      if key[0] not in CODES or key[1] not in PORTALS: fail(f'out-of-scope binding {key}')
      match=SOURCE_RE.fullmatch(str(item.get('source_key') or ''))
      if not match: fail(f'invalid source key {item.get("source_key")}')
      path=ROOT/match.group('file')
      if path not in cache: cache[path]=xlsx.parse_workbook(path)
      rows=cache[path].get(match.group('sheet'))
      row_no=int(match.group('row'))
      if rows is None or row_no<1 or row_no>len(rows): fail(f'missing physical row {item["source_key"]}')
      route=str(item.get('route_path') or '')
      physical=' | '.join(str(v) for v in rows[row_no-1])
      if route not in physical: fail(f'route mismatch {item["source_key"]} -> {route}')
    expected={(c,p) for c in CODES for p in PORTALS}
    if seen!=expected: fail('binding coverage mismatch')
    api=json.loads((PHASE/'PHASE11_HTTP_PERMISSION_CONTRACT.json').read_text(encoding='utf-8'))
    if set(api.get('processes',{}))!=set(CODES): fail('HTTP process coverage mismatch')
    for code,info in api['processes'].items():
      if not str(info.get('base','')).startswith(f'/api/v1/processes/{code}/'): fail(f'{code} API namespace invalid')
      perms=info.get('permissions',[])
      if not perms or not all(str(p).startswith(code.lower()+'.') for p in perms): fail(f'{code} permission namespace invalid')
    wf=json.loads((PHASE/'PHASE11_WORKFLOW_CONTRACT.json').read_text(encoding='utf-8'))
    if set(wf.get('processes',{}))!=set(CODES): fail('workflow coverage mismatch')
    for code,info in wf['processes'].items():
      nodes=info.get('nodes',[]); transitions=info.get('transitions',[])
      if not nodes or nodes[-1]!='END' or len(transitions)!=len(nodes)-1: fail(f'{code} workflow chain invalid')
      for t in transitions:
        if t.get('from') not in nodes or t.get('to') not in nodes: fail(f'{code} transition references unknown node')
    decision=(CONTRACT/'C0_DECISION_LOG.md').read_text(encoding='utf-8')
    for index in range(1,9):
      if f'C0-{index:02d}' not in decision: fail(f'C0-{index:02d} decision missing')
    if 'P017' in decision or 'PHASE-12' in decision and 'LOCKED' not in (ROOT/'docs/implementation/MASTER_PROGRESS.md').read_text(encoding='utf-8'):
      fail('later phase boundary is not locked')
    print('PHASE-11 C0 PASS: 18 page bindings, 6 API/permission contracts, 6 workflows, C0-01..C0-08 resolved')
if __name__=='__main__': main()
