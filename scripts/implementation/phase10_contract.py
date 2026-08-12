#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import phase10_preparation_extract as source_extract

ROOT = Path(__file__).resolve().parents[2]
PHASE = ROOT / "docs/implementation/phases/PHASE-10"
IA_ROOT = ROOT / "Knowledge Base" / "01 完整的页面架构"
PAGE_INDEX = ROOT / "docs/implementation/MASTER_PAGE_CATALOG.json"
BINDINGS = PHASE / "PHASE10_PAGE_BINDINGS.json"
CONTRACT = ROOT / "docs/implementation/contracts/phase-10/PHASE10_HTTP_PERMISSION_CONTRACT.md"
PROGRESS = ROOT / "docs/implementation/MASTER_PROGRESS.md"

EXPECTED_STATES = {
    "P006": [("S01","议题征集"),("S02","材料完整性检查"),("S03","会议发布"),("S04","签到与请假"),("S05","会议召开"),("S06","主持人确认纪要"),("S07","行动项生成"),("S08","责任人执行"),("S09","验收与返工"),("S10","逾期升级"),("S11","归档复盘")],
    "P007": [("S01","业务量与活动需求输入"),("S02","班次模板匹配"),("S03","资格与连续工时校验"),("S04","主管发布排班"),("S05","员工确认"),("S06","换班/替班申请"),("S07","变更审批"),("S08","考勤与餐饮/班车联动"),("S09","日结")],
    "P008": [("S01","请假申请"),("S02","假期额度预占"),("S03","工作交接与代理"),("S04","审批"),("S05","预占转扣减/驳回释放"),("S06","排班与考勤标记"),("S07","实际休假"),("S08","销假/提前返岗/变更"),("S09","差额账本调整"),("S10","考勤日结与归档")],
    "P009": [("S01","事前申请/紧急事实登记"),("S02","必要性与任务校验"),("S03","主管审批"),("S04","实际考勤与劳动事实"),("S05","成果验收"),("S06","人事复核"),("S07","法定工资/调休方案"),("S08","薪酬回执"),("S09","归档")],
    "P010": [("S01","课程/制度版本发布"),("S02","按岗位风险指派"),("S03","员工学习"),("S04","1000分制考试"),("S05","线下实操"),("S06","主管/专业人员认证"),("S07","资格生效"),("S08","岗位权限联动"),("S09","到期复训/复证"),("S10","归档")],
}
REQUIRED = {code: {"employee","center","tech"} for code in EXPECTED_STATES}
SOURCE_KEY = re.compile(r"^(?P<file>[^:]+\.xlsx):(?P<sheet>[^:]+):R(?P<row>\d+):(?P<digest>[0-9a-f]{12})$")
PORTAL_PREFIX = {"employee":"1-", "center":"2-", "tech":"3-"}


def source_states(payload: dict[str, Any], code: str) -> list[tuple[str,str]]:
    process = next(item for item in payload["processes"] if item["process_code"] == code)
    sheet = next(item for item in process["portals"]["employee"]["sheets"] if item["sheet"] == "03_状态与审批")
    result: list[tuple[str,str]] = []
    for row in sheet["rows"]:
        values = row["values"]
        if len(values) >= 3 and re.fullmatch(r"S\d\d", values[1] or ""):
            result.append((values[1], values[2]))
    return result


def row_contains_route(row: list[str], route: str) -> bool:
    return any(str(value).strip() == route for value in row)


def validate_binding_source(binding: dict[str, Any], cache: dict[str, dict[str, list[list[str]]]]) -> None:
    portal = str(binding.get("portal", ""))
    key = str(binding.get("source_key", ""))
    route = str(binding.get("route_path", ""))
    match = SOURCE_KEY.fullmatch(key)
    if match is None:
        raise RuntimeError(f"invalid PHASE-10 source_key: {key}")
    source_name = match.group("file")
    sheet_name = match.group("sheet")
    source_row = int(match.group("row"))
    if not source_name.startswith(PORTAL_PREFIX[portal]):
        raise RuntimeError(f"binding portal/source mismatch: {portal}/{source_name}")
    path = IA_ROOT / source_name
    if not path.is_file():
        raise RuntimeError(f"binding IA source missing: {path.relative_to(ROOT)}")
    if source_name not in cache:
        cache[source_name] = source_extract.xlsx.parse_workbook(path)
    workbook = cache[source_name]
    if sheet_name not in workbook:
        raise RuntimeError(f"binding sheet missing: {source_name}/{sheet_name}")
    rows = workbook[sheet_name]
    candidates: list[list[str]] = []
    if 1 <= source_row <= len(rows):
        candidates.append(rows[source_row - 1])
    nonempty = [row for row in rows if any(str(value).strip() for value in row)]
    if 1 <= source_row <= len(nonempty):
        candidates.append(nonempty[source_row - 1])
    if any(row_contains_route(row, route) for row in candidates):
        return
    matching_rows = [index + 1 for index, row in enumerate(rows) if row_contains_route(row, route)]
    raise RuntimeError(
        f"binding route/source row drift: {key} expected route={route}; raw matching rows={matching_rows[:5]}"
    )


def verify_page_index() -> None:
    if not PAGE_INDEX.is_file():
        raise RuntimeError("MASTER_PAGE_CATALOG.json missing")
    index = json.loads(PAGE_INDEX.read_text(encoding="utf-8"))
    canonical = index.get("canonical_business_records") or {}
    if canonical.get("page_count") != 7126 or canonical.get("trace_record_count") != 7126:
        raise RuntimeError("PHASE-01 canonical page counts drifted")
    current = index.get("current_business_phase") or {}
    if current.get("phase") != "PHASE-10" or current.get("process_codes") != list(EXPECTED_STATES):
        raise RuntimeError("MASTER_PAGE_CATALOG current PHASE-10 scope drifted")


def verify() -> None:
    for path in [PHASE/"README.md", PHASE/"PREPARATION_REPORT.md", PHASE/"SOURCE_CONTRACT.md", PHASE/"IMPACT_MATRIX.md", PHASE/"GAP_MATRIX.md", PHASE/"START_CHECKLIST.md", BINDINGS, CONTRACT, PAGE_INDEX]:
        if not path.is_file() or path.stat().st_size == 0:
            raise RuntimeError(f"missing PHASE-10 C0 artifact: {path.relative_to(ROOT)}")

    source = source_extract.build_payload()
    if source["process_codes"] != ["P006","P007","P008","P009","P010"]:
        raise RuntimeError("P006-P010 source scope drifted")
    if source["workbook_count"] != 15 or source["sheet_count"] != 90 or source["nonempty_row_count"] != 4745 or source["parse_failures"] != 0:
        raise RuntimeError("authoritative 15-XLSX parse facts drifted")
    for code, expected in EXPECTED_STATES.items():
        if source_states(source, code) != expected:
            raise RuntimeError(f"source state machine drifted: {code}")

    verify_page_index()
    data = json.loads(BINDINGS.read_text(encoding="utf-8"))
    bindings = data.get("bindings")
    if not isinstance(bindings, list) or not bindings:
        raise RuntimeError("PHASE10 page bindings missing")
    covered = {code:set() for code in REQUIRED}
    cache: dict[str, dict[str, list[list[str]]]] = {}
    for binding in bindings:
        code = str(binding.get("process_code", "")); portal = str(binding.get("portal", ""))
        if code not in REQUIRED or portal not in REQUIRED[code]:
            raise RuntimeError(f"out-of-scope binding {code}/{portal}")
        validate_binding_source(binding, cache)
        covered[code].add(portal)
    for code, portals in covered.items():
        if portals != REQUIRED[code]:
            raise RuntimeError(f"missing portal binding: {code}={portals}")

    v10 = (ROOT/"technical-platform/database/flyway/oms/V10__collaboration_tables.sql").read_text(encoding="utf-8")
    v5 = (ROOT/"technical-platform/database/flyway/oms/V5__attendance_tables.sql").read_text(encoding="utf-8")
    v28 = (ROOT/"technical-platform/database/flyway/oms/V28__learning_tables.sql").read_text(encoding="utf-8")
    for needle, text in [("CREATE TABLE IF NOT EXISTS collaboration.meeting (",v10),("CREATE TABLE IF NOT EXISTS attendance.shift_change_request (",v5),("CREATE TABLE IF NOT EXISTS attendance.leave_request (",v5),("CREATE TABLE IF NOT EXISTS attendance.overtime_request (",v5),("CREATE TABLE IF NOT EXISTS learning.learning_assignment (",v28)]:
        if needle not in text:
            raise RuntimeError(f"canonical DB contract missing: {needle}")
    if "score_1000 bigint" not in v28 or "qualification_expire_date date" not in v28:
        raise RuntimeError("P010 canonical learning fields drifted")

    contract = CONTRACT.read_text(encoding="utf-8")
    for code in EXPECTED_STATES:
        if f"/api/v1/processes/{code}/" not in contract or f"p{code[1:]}." not in contract:
            raise RuntimeError(f"HTTP/permission engineering contract missing: {code}")
    if "Idempotency-Key" not in contract or "Tech monitor permissions never imply" not in contract:
        raise RuntimeError("HTTP safety contract incomplete")

    progress = PROGRESS.read_text(encoding="utf-8")
    if "| PHASE-09 | COMPLETE |" not in progress:
        raise RuntimeError("PHASE-09 must remain COMPLETE")
    if not re.search(r"\| PHASE-10 \| (IN_PROGRESS|READY_FOR_GATE|COMPLETE) \|", progress):
        raise RuntimeError("PHASE-10 must be in formal construction lifecycle")
    if "| PHASE-11 | NOT_STARTED |" not in progress:
        raise RuntimeError("PHASE-11 must remain NOT_STARTED")


def main() -> None:
    argparse.ArgumentParser().parse_args()
    verify()
    print("PHASE-10 C0 source/page/API/permission/database contract is frozen and current")


if __name__ == "__main__":
    main()
