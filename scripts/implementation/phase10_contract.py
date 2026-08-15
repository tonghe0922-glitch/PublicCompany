#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import xml.etree.ElementTree as ET
import zipfile
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
XLSX = source_extract.xlsx

EXPECTED_STATES = {
    "P006": [("S01", "议题征集"), ("S02", "材料完整性检查"), ("S03", "会议发布"), ("S04", "签到与请假"), ("S05", "会议召开"), ("S06", "主持人确认纪要"), ("S07", "行动项生成"), ("S08", "责任人执行"), ("S09", "验收与返工"), ("S10", "逾期升级"), ("S11", "归档复盘")],
    "P007": [("S01", "业务量与活动需求输入"), ("S02", "班次模板匹配"), ("S03", "资格与连续工时校验"), ("S04", "主管发布排班"), ("S05", "员工确认"), ("S06", "换班/替班申请"), ("S07", "变更审批"), ("S08", "考勤与餐饮/班车联动"), ("S09", "日结")],
    "P008": [("S01", "请假申请"), ("S02", "假期额度预占"), ("S03", "工作交接与代理"), ("S04", "审批"), ("S05", "预占转扣减/驳回释放"), ("S06", "排班与考勤标记"), ("S07", "实际休假"), ("S08", "销假/提前返岗/变更"), ("S09", "差额账本调整"), ("S10", "考勤日结与归档")],
    "P009": [("S01", "事前申请/紧急事实登记"), ("S02", "必要性与任务校验"), ("S03", "主管审批"), ("S04", "实际考勤与劳动事实"), ("S05", "成果验收"), ("S06", "人事复核"), ("S07", "法定工资/调休方案"), ("S08", "薪酬回执"), ("S09", "归档")],
    "P010": [("S01", "课程/制度版本发布"), ("S02", "按岗位风险指派"), ("S03", "员工学习"), ("S04", "1000分制考试"), ("S05", "线下实操"), ("S06", "主管/专业人员认证"), ("S07", "资格生效"), ("S08", "岗位权限联动"), ("S09", "到期复训/复证"), ("S10", "归档")],
}
REQUIRED = {code: {"employee", "center", "tech"} for code in EXPECTED_STATES}
SOURCE_KEY = re.compile(r"^(?P<file>[^:]+\.xlsx):(?P<sheet>[^:]+):R(?P<row>\d+):(?P<digest>[0-9a-f]{12})$")
PORTAL_PREFIX = {"employee": "1-", "center": "2-", "tech": "3-"}
BASELINE_FACTS = {"workbook_count": 15, "sheet_count": 90, "nonempty_row_count": 4745, "page_count": 7126}


def warn_drift(name: str, actual: int, baseline: int) -> None:
    if actual != baseline:
        print(f"::warning title=PHASE-10 source drift::{name} is {actual}; reviewed baseline was {baseline}")


def source_states(payload: dict[str, Any], code: str) -> list[tuple[str, str]]:
    process = next(item for item in payload["processes"] if item["process_code"] == code)
    sheet = next(item for item in process["portals"]["employee"]["sheets"] if item["sheet"] == "03_状态与审批")
    result: list[tuple[str, str]] = []
    for row in sheet["rows"]:
        values = row["values"]
        if len(values) >= 3 and re.fullmatch(r"S\d\d", values[1] or ""):
            result.append((values[1], values[2]))
    return result


def physical_workbook(path: Path) -> dict[str, dict[int, list[str]]]:
    result: dict[str, dict[int, list[str]]] = {}
    with zipfile.ZipFile(path) as archive:
        strings = XLSX.shared_strings(archive)
        for sheet_name, target in XLSX.workbook_sheets(archive):
            root = ET.fromstring(archive.read(target))
            data = root.find(f"{{{XLSX.NS_MAIN}}}sheetData")
            physical: dict[int, list[str]] = {}
            if data is not None:
                for row in data.findall(f"{{{XLSX.NS_MAIN}}}row"):
                    row_no_text = row.attrib.get("r")
                    if not row_no_text:
                        continue
                    values: dict[int, str] = {}
                    max_index = -1
                    for cell in row.findall(f"{{{XLSX.NS_MAIN}}}c"):
                        ref = cell.attrib.get("r")
                        if not ref:
                            continue
                        index = XLSX.col_index(ref)
                        values[index] = XLSX.cell_text(cell, strings).strip()
                        max_index = max(max_index, index)
                    if max_index >= 0:
                        dense = [values.get(index, "") for index in range(max_index + 1)]
                        if any(dense):
                            physical[int(row_no_text)] = dense
            result[sheet_name] = physical
    return result


def validate_binding_source(binding: dict[str, Any], cache: dict[str, dict[str, dict[int, list[str]]]]) -> None:
    portal = str(binding.get("portal", ""))
    key = str(binding.get("source_key", ""))
    route = str(binding.get("route_path", ""))
    match = SOURCE_KEY.fullmatch(key)
    if match is None:
        raise RuntimeError(f"invalid PHASE-10 source_key: {key}")
    source_name, sheet_name, source_row = match.group("file"), match.group("sheet"), int(match.group("row"))
    if not source_name.startswith(PORTAL_PREFIX[portal]):
        raise RuntimeError(f"binding portal/source mismatch: {portal}/{source_name}")
    path = IA_ROOT / source_name
    if not path.is_file():
        raise RuntimeError(f"binding IA source missing: {path.relative_to(ROOT)}")
    if source_name not in cache:
        cache[source_name] = physical_workbook(path)
    workbook = cache[source_name]
    if sheet_name not in workbook:
        raise RuntimeError(f"binding sheet missing: {source_name}/{sheet_name}")
    row = workbook[sheet_name].get(source_row)
    if row is None:
        raise RuntimeError(f"binding physical Excel row missing: {key}")
    if not any(str(value).strip() == route for value in row):
        matching = [row_no for row_no, values in workbook[sheet_name].items() if any(str(value).strip() == route for value in values)]
        raise RuntimeError(f"binding route/source row drift: {key} expected route={route}; physical matching rows={matching[:5]}")


def phase_number(value: object) -> int:
    match = re.fullmatch(r"PHASE-(\d{2})", str(value or ""))
    if match is None:
        raise RuntimeError(f"invalid phase identifier: {value}")
    return int(match.group(1))


def verify_page_index() -> None:
    index = json.loads(PAGE_INDEX.read_text(encoding="utf-8"))
    canonical = index.get("canonical_business_records") or {}
    page_count = canonical.get("page_count")
    trace_count = canonical.get("trace_record_count")
    if not isinstance(page_count, int) or page_count < 7000 or page_count != trace_count:
        raise RuntimeError(f"canonical page trace integrity drifted: pages={page_count}, traces={trace_count}")
    warn_drift("canonical page_count", page_count, BASELINE_FACTS["page_count"])

    phase10 = index.get("phase10") or {}
    if phase10.get("state") != "COMPLETE" or phase10.get("formal_gate") != "PASS":
        raise RuntimeError("MASTER_PAGE_CATALOG PHASE-10 closure regressed")

    current = index.get("current_business_phase") or {}
    current_phase = str(current.get("phase", ""))
    if phase_number(current_phase) < 10:
        raise RuntimeError("MASTER_PAGE_CATALOG current phase regressed before PHASE-10")
    if current_phase == "PHASE-10" and current.get("process_codes") != list(EXPECTED_STATES):
        raise RuntimeError("MASTER_PAGE_CATALOG current PHASE-10 scope drifted")


def verify_source_facts(source: dict[str, Any]) -> None:
    if source["parse_failures"] != 0:
        raise RuntimeError(f"authoritative XLSX parse failures: {source['parse_failures']}")
    workbook_count = int(source["workbook_count"])
    sheet_count = int(source["sheet_count"])
    row_count = int(source["nonempty_row_count"])
    if not 15 <= workbook_count <= 24:
        raise RuntimeError(f"authoritative workbook count outside reviewed range: {workbook_count}")
    if not workbook_count * 4 <= sheet_count <= workbook_count * 10:
        raise RuntimeError(f"authoritative sheet count outside structural range: {sheet_count}")
    if not 4000 <= row_count <= 8000:
        raise RuntimeError(f"authoritative non-empty row count outside reviewed range: {row_count}")
    warn_drift("workbook_count", workbook_count, BASELINE_FACTS["workbook_count"])
    warn_drift("sheet_count", sheet_count, BASELINE_FACTS["sheet_count"])
    warn_drift("nonempty_row_count", row_count, BASELINE_FACTS["nonempty_row_count"])


def verify() -> None:
    artifacts = [
        PHASE / "README.md", PHASE / "PREPARATION_REPORT.md", PHASE / "SOURCE_CONTRACT.md",
        PHASE / "IMPACT_MATRIX.md", PHASE / "GAP_MATRIX.md", PHASE / "START_CHECKLIST.md",
        BINDINGS, CONTRACT, PAGE_INDEX,
    ]
    for path in artifacts:
        if not path.is_file() or path.stat().st_size == 0:
            raise RuntimeError(f"missing PHASE-10 C0 artifact: {path.relative_to(ROOT)}")

    source = source_extract.build_payload()
    if source["process_codes"] != list(EXPECTED_STATES):
        raise RuntimeError("P006-P010 source scope drifted")
    verify_source_facts(source)
    for code, expected in EXPECTED_STATES.items():
        if source_states(source, code) != expected:
            raise RuntimeError(f"source state machine drifted: {code}")

    verify_page_index()
    data = json.loads(BINDINGS.read_text(encoding="utf-8"))
    bindings = data.get("bindings")
    if not isinstance(bindings, list) or not bindings:
        raise RuntimeError("PHASE10 page bindings missing")
    covered = {code: set() for code in REQUIRED}
    cache: dict[str, dict[str, dict[int, list[str]]]] = {}
    for binding in bindings:
        code, portal = str(binding.get("process_code", "")), str(binding.get("portal", ""))
        if code not in REQUIRED or portal not in REQUIRED[code]:
            raise RuntimeError(f"out-of-scope binding {code}/{portal}")
        validate_binding_source(binding, cache)
        covered[code].add(portal)
    for code, portals in covered.items():
        if portals != REQUIRED[code]:
            raise RuntimeError(f"missing portal binding: {code}={portals}")

    v10 = (ROOT / "technical-platform/database/flyway/oms/V10__collaboration_tables.sql").read_text(encoding="utf-8")
    v5 = (ROOT / "technical-platform/database/flyway/oms/V5__attendance_tables.sql").read_text(encoding="utf-8")
    v28 = (ROOT / "technical-platform/database/flyway/oms/V28__learning_tables.sql").read_text(encoding="utf-8")
    contracts = [
        ("CREATE TABLE IF NOT EXISTS collaboration.meeting (", v10),
        ("CREATE TABLE IF NOT EXISTS attendance.shift_change_request (", v5),
        ("CREATE TABLE IF NOT EXISTS attendance.leave_request (", v5),
        ("CREATE TABLE IF NOT EXISTS attendance.overtime_request (", v5),
        ("CREATE TABLE IF NOT EXISTS learning.learning_assignment (", v28),
    ]
    for needle, text in contracts:
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
    if "| PHASE-10 | COMPLETE |" not in progress:
        raise RuntimeError("PHASE-10 closure must remain COMPLETE")
    if not re.search(r"\| PHASE-11 \| (NOT_STARTED|IN_PROGRESS|READY_FOR_GATE|COMPLETE) \|", progress):
        raise RuntimeError("PHASE-11 must remain in a valid construction lifecycle state")


def main() -> None:
    argparse.ArgumentParser().parse_args()
    verify()
    print("PHASE-10 source/page/API/permission/database contract is current; benign source-volume drift is warning-only")


if __name__ == "__main__":
    main()
