#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import phase04_source_contract as xlsx

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "docs" / "implementation" / "phases" / "PHASE-11"
OUT_JSON = OUT_DIR / "P011_P016_SOURCE_SNAPSHOT.json"
OUT_MD = OUT_DIR / "P011_P016_SOURCE_SNAPSHOT.md"
PROCESS_CATALOG = ROOT / "docs" / "implementation" / "MASTER_PROCESS_CATALOG.json"
API_RECORDS = ROOT / "docs" / "implementation" / "contracts" / "phase-01" / "api_records.jsonl"
TARGET_CODES = ("P011", "P012", "P013", "P014", "P015", "P016")
PORTALS = ("employee", "center", "tech")
SECTION_ORDER = ("overview", "forms", "fields", "states", "rules", "linkage")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


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


def parse_source(source_file: str, expected_sheets: list[str]) -> dict[str, Any]:
    path = ROOT / source_file
    if not path.is_file():
        raise FileNotFoundError(path)
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
        "sha256": sha256(path),
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
            record = parse_source(source_file, expected_sheets)
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

    if workbook_count != 18:
        raise RuntimeError(f"expected 18 workbooks, got {workbook_count}")
    if API_RECORDS.is_file() and API_RECORDS.stat().st_size != 0:
        raise RuntimeError(
            "PHASE-01 api_records.jsonl is no longer empty; preparation contract must be revisited"
        )

    return {
        "phase": "PHASE-11",
        "state": "PREPARATION_SOURCE_PROBE",
        "scope": "P011-P016 绩效成长福利",
        "parser": "phase04_source_contract.parse_workbook/python-stdlib-zipfile-xml",
        "process_codes": list(TARGET_CODES),
        "process_count": len(TARGET_CODES),
        "portal_count": len(PORTALS),
        "workbook_count": workbook_count,
        "parse_failures": 0,
        "sheet_count": sheet_count,
        "nonempty_row_count": row_count,
        "business_api_records": 0,
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
            "next_phase_coupling": "P017_AND_LATER_FORBIDDEN",
        },
    }


def md_escape(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def build_markdown(payload: dict[str, Any]) -> str:
    lines = [
        "# PHASE-11 P011–P016 XLSX ACTUAL PARSE SNAPSHOT",
        "",
        "> 18 份三端业务流程 XLSX 由仓库内解析器在当前 GitHub checkout 上实际读取，不按文件名猜业务。",
        "> 本文件只做 PHASE-11 开工前来源探针；在 IMPACT/GAP 与 C0 冻结完成前，不代表任何流程已实现。",
        "",
        "## Result",
        "",
        f"- Processes: **{payload['process_count']} / 6**",
        f"- Portals: **{payload['portal_count']} / 3**",
        f"- XLSX workbooks parsed: **{payload['workbook_count']} / 18**",
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
            f"| {process['process_code']} | {md_escape(process['canonical_name'])} | "
            f"`{md_escape(mappings)}` | "
            f"{portals['employee']['sheet_count']} sheets / "
            f"{portals['employee']['nonempty_row_count']} rows | "
            f"{portals['center']['sheet_count']} sheets / "
            f"{portals['center']['nonempty_row_count']} rows | "
            f"{portals['tech']['sheet_count']} sheets / "
            f"{portals['tech']['nonempty_row_count']} rows |"
        )

    lines.extend([
        "",
        "## Required sheet contract",
        "",
        "Every portal workbook is verified to contain the current catalog-declared sections: "
        "`00_流程总览 / 01_表单清单 / 02_字段字典 / 03_状态与审批 / "
        "04_规则与接口 / 05_三端联动`.",
        "",
        "## Preparation boundary",
        "",
        "- This snapshot does not invent REST paths, permission codes, route paths, states, "
        "approvers, formulas, point values, reward amounts, welfare levels, or data scopes.",
        "- P011–P016 must be converted into formal SOURCE_CONTRACT / IMPACT_MATRIX / "
        "GAP_MATRIX only after this snapshot is reviewed with current code and master ledgers.",
        "- P017 and later processes remain out of scope.",
        "- Machine evidence: "
        "`docs/implementation/phases/PHASE-11/P011_P016_SOURCE_SNAPSHOT.json`.",
    ])
    return "\n".join(lines) + "\n"


def write_outputs() -> None:
    payload = build_payload()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    OUT_MD.write_text(build_markdown(payload), encoding="utf-8")


def check_outputs() -> None:
    expected = build_payload()
    if not OUT_JSON.is_file() or not OUT_MD.is_file():
        raise RuntimeError("PHASE-11 source snapshot is missing")
    actual = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    if actual != expected:
        raise RuntimeError("P011_P016_SOURCE_SNAPSHOT.json is stale")
    if OUT_MD.read_text(encoding="utf-8") != build_markdown(expected):
        raise RuntimeError("P011_P016_SOURCE_SNAPSHOT.md is stale")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check_outputs()
        print("PHASE-11 P011-P016 XLSX snapshot is deterministic and current")
        return
    write_outputs()
    print("PHASE-11 P011-P016: 18 XLSX workbooks parsed and source snapshot generated")


if __name__ == "__main__":
    main()
