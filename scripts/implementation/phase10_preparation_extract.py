#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import phase04_source_contract as xlsx

ROOT = Path(__file__).resolve().parents[2]
PHASE_CODE = "PHASE-10"
RANGE_LABEL = "P006–P010"
RANGE_FILE_LABEL = "P006_P010"
SCOPE_LABEL = "P006-P010 公共能力 B"
NEXT_PROCESS_BOUNDARY = "P011 and later processes remain out of scope."
OUT_DIR = ROOT / "docs" / "implementation" / "phases" / PHASE_CODE
OUT_JSON = OUT_DIR / f"{RANGE_FILE_LABEL}_SOURCE_SNAPSHOT.json"
OUT_MD = OUT_DIR / f"{RANGE_FILE_LABEL}_SOURCE_SNAPSHOT.md"
PROCESS_CATALOG = ROOT / "docs" / "implementation" / "MASTER_PROCESS_CATALOG.json"
API_RECORDS = ROOT / "docs" / "implementation" / "contracts" / "phase-01" / "api_records.jsonl"
PAGES = ROOT / "docs" / "implementation" / "contracts" / "phase-01" / "pages.json"
PHASE01_GENERATOR = ROOT / "scripts" / "knowledge_base" / "phase01_parse.py"
GENERATOR_RELATIVE = "scripts/implementation/phase10_preparation_extract.py"
PHASE01_CONTRACTS = ROOT / "docs" / "implementation" / "contracts" / "phase-01"
WORKBOOK_CACHE = PHASE01_CONTRACTS / "process_workbook_sheets.jsonl"
CACHE_ROWS = {
    "01_表单清单": PHASE01_CONTRACTS / "forms.jsonl",
    "02_字段字典": None,
    "03_状态与审批": PHASE01_CONTRACTS / "states_approvals.jsonl",
    "04_规则与接口": PHASE01_CONTRACTS / "rules_interfaces.jsonl",
    "05_三端联动": PHASE01_CONTRACTS / "three_endpoint_linkage.jsonl",
}
TARGET_CODES = ("P006", "P007", "P008", "P009", "P010")
PORTALS = ("employee", "center", "tech")
SECTION_ORDER = ("overview", "forms", "fields", "states", "rules", "linkage")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def canonical_sha256(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def trim_row(row: list[str]) -> list[str]:
    values = list(row)
    while values and not values[-1]:
        values.pop()
    return values


def header_candidate(rows: list[list[str]]) -> tuple[int | None, list[str]]:
    candidates: list[tuple[int, int, list[str]]] = []
    for index, row in enumerate(rows[:30]):
        trimmed = trim_row(row)
        nonempty = sum(1 for value in trimmed if value)
        if nonempty:
            candidates.append((nonempty, -index, trimmed))
    if not candidates:
        return None, []
    _, negative_index, values = max(candidates, key=lambda item: (item[0], item[1]))
    return -negative_index + 1, values


def load_processes() -> dict[str, dict[str, Any]]:
    payload = json.loads(PROCESS_CATALOG.read_text(encoding="utf-8"))
    records = payload.get("processes")
    if not isinstance(records, list):
        raise RuntimeError("MASTER_PROCESS_CATALOG.json processes is missing")
    index = {
        str(item.get("process_code")): item
        for item in records
        if isinstance(item, dict) and item.get("process_code") in TARGET_CODES
    }
    missing = [code for code in TARGET_CODES if code not in index]
    if missing:
        raise RuntimeError(f"missing target processes: {missing}")
    return index


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        raise FileNotFoundError(path)
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def cached_workbook(process_code: str, portal: str) -> dict[str, Any]:
    records = load_jsonl(WORKBOOK_CACHE)
    matches = [
        item for item in records
        if item.get("process_code") == process_code and item.get("portal_code") == portal
    ]
    if len(matches) != 1:
        raise RuntimeError(f"cached workbook contract is not unique: {process_code}/{portal}")
    return matches[0]


def cached_sheet_rows(process_code: str, portal: str, sheet_name: str) -> list[dict[str, Any]]:
    source = CACHE_ROWS.get(sheet_name)
    if source is None:
        return []
    records = load_jsonl(source)
    result: list[dict[str, Any]] = []
    for item in records:
        if (item.get("process_code"), item.get("portal_code"), item.get("source_sheet")) != (
                process_code, portal, sheet_name):
            continue
        data = item.get("data")
        if not isinstance(data, dict):
            raise RuntimeError(f"cached source row is malformed: {process_code}/{portal}/{sheet_name}")
        result.append({
            "source_row_1_based": item.get("source_row"),
            "values": ["" if value is None else str(value) for value in data.values()],
            "data": data,
        })
    return result


def parse_cached_source(process_code: str, portal: str, expected_sheets: list[str]) -> dict[str, Any]:
    cached = cached_workbook(process_code, portal)
    sheet_index = {item.get("sheet"): item for item in cached.get("sheets", [])}
    missing = [name for name in expected_sheets if name not in sheet_index]
    if missing:
        raise RuntimeError(f"cached {process_code}/{portal}: missing expected sheets {missing}")
    sheet_records: list[dict[str, Any]] = []
    for sheet_name in expected_sheets:
        metadata = sheet_index[sheet_name]
        sheet_records.append({
            "sheet": sheet_name,
            "nonempty_row_count": int(metadata.get("rows") or 0),
            "max_columns": len(metadata.get("headers") or []),
            "header_candidate_row_1_based": metadata.get("header_row"),
            "header_candidate_values": metadata.get("headers") or [],
            "rows": cached_sheet_rows(process_code, portal, sheet_name),
            "row_contract_available": sheet_name in CACHE_ROWS and CACHE_ROWS[sheet_name] is not None,
        })
    payload = {
        "source_file": cached.get("source_file"),
        "source_file_present": False,
        "source_sha256": None,
        "evidence_mode": "PHASE01_MACHINE_CONTRACT_CACHE",
        "sheet_names": expected_sheets,
        "sheet_count": len(sheet_records),
        "nonempty_row_count": sum(item["nonempty_row_count"] for item in sheet_records),
        "expected_sheets": expected_sheets,
        "missing_expected_sheets": [],
        "sheets": sheet_records,
    }
    return payload


def parse_source(
        process_code: str, portal: str, source_file: str, expected_sheets: list[str]) -> dict[str, Any]:
    path = ROOT / source_file
    if not path.is_file():
        cached = cached_workbook(process_code, portal)
        canonical_source_file = str(cached.get("source_file") or "")
        canonical_path = ROOT / canonical_source_file
        if not canonical_path.is_file():
            return parse_cached_source(process_code, portal, expected_sheets)
        source_file = canonical_source_file
        path = canonical_path
    parsed = xlsx.parse_workbook(path)
    missing = [name for name in expected_sheets if name not in parsed]
    if missing:
        raise RuntimeError(f"{source_file}: missing expected sheets {missing}")

    sheet_records: list[dict[str, Any]] = []
    for sheet_name, rows in parsed.items():
        normalized = [trim_row(row) for row in rows if any(str(value).strip() for value in row)]
        header_row, header_values = header_candidate(normalized)
        sheet_records.append({
            "sheet": sheet_name,
            "nonempty_row_count": len(normalized),
            "max_columns": max((len(row) for row in normalized), default=0),
            "header_candidate_row_1_based": header_row,
            "header_candidate_values": header_values,
            "rows": [
                {"source_row_1_based": index + 1, "values": row}
                for index, row in enumerate(normalized)
            ],
        })

    return {
        "source_file": source_file,
        "source_file_present": True,
        "source_sha256": sha256(path),
        "evidence_mode": "RAW_XLSX",
        "sheet_names": list(parsed),
        "sheet_count": len(parsed),
        "nonempty_row_count": sum(item["nonempty_row_count"] for item in sheet_records),
        "expected_sheets": expected_sheets,
        "missing_expected_sheets": [],
        "sheets": sheet_records,
    }


def build_payload() -> dict[str, Any]:
    index = load_processes()
    process_records: list[dict[str, Any]] = []
    workbook_count = 0
    sheet_count = 0
    row_count = 0

    for code in TARGET_CODES:
        process = index[code]
        portal_sources = process.get("portal_sources")
        if not isinstance(portal_sources, dict):
            raise RuntimeError(f"{code}: portal_sources is missing")
        portal_records: dict[str, Any] = {}
        for portal in PORTALS:
            portal_source = portal_sources.get(portal)
            if not isinstance(portal_source, dict):
                raise RuntimeError(f"{code}/{portal}: source is missing")
            sections = portal_source.get("sections")
            if not isinstance(sections, dict):
                raise RuntimeError(f"{code}/{portal}: sections are missing")
            expected_sheets: list[str] = []
            for section in SECTION_ORDER:
                names = sections.get(section)
                if not isinstance(names, list) or not names:
                    raise RuntimeError(f"{code}/{portal}: section {section} is missing")
                expected_sheets.extend(str(name) for name in names)
            source_file = str(portal_source.get("source_file") or "")
            record = parse_source(code, portal, source_file, expected_sheets)
            record["sections"] = sections
            portal_records[portal] = record
            workbook_count += 1
            sheet_count += record["sheet_count"]
            row_count += record["nonempty_row_count"]

        process_records.append({
            "process_code": code,
            "canonical_name": process.get("canonical_name"),
            "database_mappings": process.get("database_mappings", []),
            "portals": portal_records,
        })

    expected_workbook_count = len(TARGET_CODES) * len(PORTALS)
    if workbook_count != expected_workbook_count:
        raise RuntimeError(f"expected {expected_workbook_count} workbooks, got {workbook_count}")
    if API_RECORDS.stat().st_size != 0:
        raise RuntimeError("PHASE-01 api_records.jsonl is no longer empty; preparation contract must be revisited")

    payload = {
        "phase": PHASE_CODE,
        "state": "CONSTRUCTION_SOURCE_BASELINE",
        "scope": SCOPE_LABEL,
        "parser": "phase04_source_contract.parse_workbook/python-stdlib-zipfile-xml",
        "process_codes": list(TARGET_CODES),
        "process_count": len(TARGET_CODES),
        "portal_count": len(PORTALS),
        "workbook_count": workbook_count,
        "parse_failures": 0,
        "sheet_count": sheet_count,
        "nonempty_row_count": row_count,
        "business_api_records": 0,
        "raw_workbook_count": sum(
            1 for process in process_records for item in process["portals"].values()
            if item["source_file_present"]
        ),
        "cached_workbook_count": sum(
            1 for process in process_records for item in process["portals"].values()
            if not item["source_file_present"]
        ),
        "api_contract_rule": "DO_NOT_INFER_HTTP_PATHS_FROM_PROCESS_NAMES_OR_SHEET_TEXT",
        "processes": process_records,
        "rules": {
            "xlsx_actual_parse_required": True,
            "permission_inference": "FORBIDDEN",
            "route_inference": "FORBIDDEN",
            "api_path_inference": "FORBIDDEN",
            "state_inference": "FORBIDDEN",
            "database_mapping_source": "MASTER_PROCESS_CATALOG / KB process-table mapping",
            "three_portal_single_business_truth": True,
        },
    }
    content = {
        "phase": payload["phase"],
        "process_codes": payload["process_codes"],
        "workbook_count": payload["workbook_count"],
        "sheet_count": payload["sheet_count"],
        "nonempty_row_count": payload["nonempty_row_count"],
        "parse_failures": payload["parse_failures"],
        "raw_workbook_count": payload["raw_workbook_count"],
        "cached_workbook_count": payload["cached_workbook_count"],
        "processes_sha256": canonical_sha256(payload["processes"]),
    }
    payload.update({
        "generated": True,
        "do_not_edit": True,
        "generator": GENERATOR_RELATIVE,
        "content": content,
        "content_sha256": canonical_sha256(content),
        "machine_contract": {
            "pages_path": "docs/implementation/contracts/phase-01/pages.json",
            "pages_sha256": sha256(PAGES),
            "api_records_path": "docs/implementation/contracts/phase-01/api_records.jsonl",
            "api_records_sha256": sha256(API_RECORDS),
            "phase01_generator_path": "scripts/knowledge_base/phase01_parse.py",
            "phase01_generator_sha256": sha256(PHASE01_GENERATOR),
        },
    })
    return payload


def md_escape(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def build_markdown(payload: dict[str, Any]) -> str:
    lines = [
        f"# {PHASE_CODE} {RANGE_LABEL} XLSX ACTUAL PARSE SNAPSHOT",
        "",
        "<!-- GENERATED: DO NOT EDIT. Regenerate with the generator recorded in the JSON contract. -->",
        f"> Content SHA-256: `{payload['content_sha256']}`",
        "",
        "> 优先读取当前仓库中的原始 XLSX；原件缺失时只使用 PHASE-01 已落盘、逐行且带来源坐标的机器合同缓存。",
        "> 缓存模式不会伪称重新解析原始 XLSX；本文件只冻结施工来源，不代表业务流程已实现。",
        "",
        "## Result",
        "",
        f"- Processes: **{payload['process_count']} / {len(TARGET_CODES)}**",
        f"- Portals: **{payload['portal_count']} / 3**",
        f"- XLSX workbooks parsed: **{payload['workbook_count']} / {len(TARGET_CODES) * len(PORTALS)}**",
        f"- Raw XLSX currently present: **{payload['raw_workbook_count']} / {len(TARGET_CODES) * len(PORTALS)}**",
        f"- PHASE-01 machine-contract cache used: **{payload['cached_workbook_count']} / {len(TARGET_CODES) * len(PORTALS)}**",
        f"- Parse failures: **{payload['parse_failures']}**",
        f"- Parsed sheets: **{payload['sheet_count']}**",
        f"- Non-empty source rows: **{payload['nonempty_row_count']}**",
        f"- PHASE-01 business API-like records: **{payload['business_api_records']}**",
        "- API path inference from process/sheet text: **FORBIDDEN**",
        "",
        "## Process / database / workbook evidence",
        "",
        "| Process | Canonical name | Database mapping | Employee | Center | Tech |",
        "|---|---|---|---|---|---|",
    ]
    for process in payload["processes"]:
        mappings = ", ".join(
            f"{item.get('schema')}.{str(item.get('table', '')).split('.')[-1]}"
            for item in process.get("database_mappings", [])
        )
        portals = process["portals"]
        lines.append(
            f"| {process['process_code']} | {md_escape(process['canonical_name'])} | `{md_escape(mappings)}` | "
            f"{portals['employee']['sheet_count']} sheets / {portals['employee']['nonempty_row_count']} rows / {portals['employee']['evidence_mode']} | "
            f"{portals['center']['sheet_count']} sheets / {portals['center']['nonempty_row_count']} rows / {portals['center']['evidence_mode']} | "
            f"{portals['tech']['sheet_count']} sheets / {portals['tech']['nonempty_row_count']} rows / {portals['tech']['evidence_mode']} |"
        )

    lines.extend([
        "",
        "## Required sheet contract",
        "",
        "Every portal workbook is verified to contain the current catalog-declared sections:",
        "`00_流程总览 / 01_表单清单 / 02_字段字典 / 03_状态与审批 / 04_规则与接口 / 05_三端联动`.",
        "",
        "## Preparation boundary",
        "",
        "- This snapshot does not invent REST paths, permission codes, route paths, states, approvers, or data scopes.",
        "- Current checkout may not contain the original XLSX files. In that case the exact PHASE-01 row contracts and workbook metadata are the only accepted fallback, and the absence remains explicit.",
        f"- {RANGE_LABEL} must be converted into formal SOURCE_CONTRACT / IMPACT_MATRIX / GAP_MATRIX only after this snapshot is reviewed with current code and master ledgers.",
        f"- {NEXT_PROCESS_BOUNDARY}",
        f"- Machine evidence: `docs/implementation/phases/{PHASE_CODE}/{RANGE_FILE_LABEL}_SOURCE_SNAPSHOT.json`.",
    ])
    return "\n".join(lines) + "\n"


def write_outputs() -> None:
    payload = build_payload()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    OUT_MD.write_text(build_markdown(payload), encoding="utf-8")


def check_outputs() -> None:
    expected = build_payload()
    if not OUT_JSON.is_file() or not OUT_MD.is_file():
        raise RuntimeError(f"{PHASE_CODE} source snapshot is missing")
    actual = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    if actual != expected:
        raise RuntimeError(f"{RANGE_FILE_LABEL}_SOURCE_SNAPSHOT.json is stale")
    if OUT_MD.read_text(encoding="utf-8") != build_markdown(expected):
        raise RuntimeError(f"{RANGE_FILE_LABEL}_SOURCE_SNAPSHOT.md is stale")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check_outputs()
        print(f"{PHASE_CODE} {RANGE_LABEL} XLSX snapshot is deterministic and current")
        return
    write_outputs()
    print(f"{PHASE_CODE} {RANGE_LABEL}: {len(TARGET_CODES) * len(PORTALS)} XLSX workbooks parsed and preparation snapshot generated")


if __name__ == "__main__":
    main()
