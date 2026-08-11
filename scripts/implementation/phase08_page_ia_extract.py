#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import phase04_source_contract as xlsx

ROOT = Path(__file__).resolve().parents[2]
IA_ROOT = ROOT / "Knowledge Base" / "01 完整的页面架构"
OUT_DIR = ROOT / "docs" / "implementation" / "phases" / "PHASE-08"
OUT_JSON = OUT_DIR / "PAGE_IA_EXTRACT.json"
OUT_MD = OUT_DIR / "PAGE_IA_EXTRACT.md"
PHASE01_PAGES = ROOT / "docs" / "implementation" / "contracts" / "phase-01" / "pages.json"

SOURCES = (
    ("employee", "employee", "1-1 员工首页.xlsx"),
    ("employee", "employee", "1-2员工全层级页面.xlsx"),
    ("center", "center", "2-1 中心首页.xlsx"),
    ("center", "center", "2-2中心全层级页面.xlsx"),
    ("tech", "admin", "3-1技术-首页.xlsx"),
    ("tech", "admin", "3-2技术-全层级页面.xlsx"),
)


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
    if not rows:
        return None, []
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


def normalize_pages(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("pages", "records", "items", "data"):
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return []


def source_matches(record: dict[str, Any], source_name: str) -> bool:
    source = str(record.get("source_file") or record.get("source_path") or "")
    return source.endswith(source_name) or Path(source).name == source_name


def public_route_record(record: dict[str, Any]) -> dict[str, Any]:
    keys = (
        "portal_code", "runtime_portal", "source_file", "source_sheet", "source_key",
        "level_1", "level_2", "level_3", "display_name", "aliases", "route_name",
        "route_path", "implementation_path", "permission_codes", "permission_code",
        "process_codes", "data_scope", "sensitive_level", "mobile_access", "status", "notes",
    )
    return {key: record.get(key) for key in keys if key in record}


def build_payload() -> dict[str, Any]:
    pages_payload = json.loads(PHASE01_PAGES.read_text(encoding="utf-8"))
    phase01_pages = normalize_pages(pages_payload)
    workbooks: list[dict[str, Any]] = []
    route_records: list[dict[str, Any]] = []

    for portal_code, runtime_portal, name in SOURCES:
        path = IA_ROOT / name
        if not path.is_file():
            raise FileNotFoundError(path)
        sheets = xlsx.parse_workbook(path)
        sheet_records: list[dict[str, Any]] = []
        total_rows = 0
        for sheet_name, rows in sheets.items():
            normalized_rows = [trim_row(row) for row in rows if any(row)]
            total_rows += len(normalized_rows)
            candidate_row, candidate_values = header_candidate(normalized_rows)
            sheet_records.append({
                "sheet": sheet_name,
                "nonempty_row_count": len(normalized_rows),
                "max_columns": max((len(row) for row in normalized_rows), default=0),
                "header_candidate_row_1_based": candidate_row,
                "header_candidate_values": candidate_values,
                "rows": [
                    {"source_row_1_based": index + 1, "values": row}
                    for index, row in enumerate(normalized_rows)
                ],
            })

        derived = [public_route_record(item) for item in phase01_pages if source_matches(item, name)]
        route_records.extend(derived)
        workbooks.append({
            "portal_code": portal_code,
            "runtime_portal": runtime_portal,
            "source_file": f"Knowledge Base/01 完整的页面架构/{name}",
            "sha256": sha256(path),
            "sheet_names": list(sheets),
            "sheet_count": len(sheets),
            "nonempty_row_count": total_rows,
            "phase01_page_record_count": len(derived),
            "sheets": sheet_records,
        })

    if len(workbooks) != 6:
        raise RuntimeError(f"expected six IA workbooks, got {len(workbooks)}")
    if any(item["sheet_count"] == 0 or item["nonempty_row_count"] == 0 for item in workbooks):
        raise RuntimeError("one or more IA workbooks parsed with no sheet/data rows")

    return {
        "phase": "PHASE-08",
        "scope": "PLATFORM/Portal-Router-Session-API-Client",
        "parser": "phase04_source_contract.parse_workbook/python-stdlib-zipfile-xml",
        "source_count": 6,
        "parse_failures": 0,
        "workbooks": workbooks,
        "phase01_cross_check": {
            "pages_json_source": "docs/implementation/contracts/phase-01/pages.json",
            "total_phase01_page_records": len(phase01_pages),
            "matching_ia_page_records": len(route_records),
        },
        "route_source_records": route_records,
        "rules": {
            "permission_inference": "FORBIDDEN",
            "process_inference": "FORBIDDEN",
            "route_source": "raw XLSX + existing PHASE-01 page catalog cross-check",
            "tech_runtime_alias": "admin",
        },
    }


def md_escape(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def build_markdown(payload: dict[str, Any]) -> str:
    lines = [
        "# PHASE-08 PAGE IA XLSX ACTUAL PARSE EVIDENCE",
        "",
        "> 六份页面 IA XLSX 由仓库内可复现解析器直接读取 Sheet XML；不是按文件名或聊天记忆猜测。",
        "",
        "## Result",
        "",
        f"- XLSX sources parsed: **{payload['source_count']} / 6**",
        f"- Parse failures: **{payload['parse_failures']}**",
        f"- PHASE-01 page records cross-checked: **{payload['phase01_cross_check']['matching_ia_page_records']}**",
        "- Permission/process inference: **FORBIDDEN**",
        "- Canonical portals: `employee / center / tech`; tech runtime alias remains `admin`.",
        "",
        "## Workbook / Sheet evidence",
        "",
        "| portal | source | SHA-256 | sheets | nonempty rows | PHASE-01 page records |",
        "|---|---|---|---:|---:|---:|",
    ]
    for book in payload["workbooks"]:
        lines.append(
            f"| {book['portal_code']} | `{md_escape(book['source_file'])}` | `{book['sha256']}` | "
            f"{book['sheet_count']} | {book['nonempty_row_count']} | {book['phase01_page_record_count']} |"
        )
        for sheet in book["sheets"]:
            headers = " / ".join(str(value) for value in sheet["header_candidate_values"][:12])
            lines.append(
                f"| ↳ | `{md_escape(sheet['sheet'])}` | header row {sheet['header_candidate_row_1_based']} | "
                f"cols {sheet['max_columns']} | {sheet['nonempty_row_count']} | `{md_escape(headers)}` |"
            )

    lines.extend([
        "",
        "## Route-source discipline",
        "",
        "`route_source_records` 只复用 PHASE-01 已从同一批工作簿派生的页面记录，并用本次当前 HEAD 的原始 XLSX 解析结果交叉验证。",
        "本证据不会把中文页面名自动转换成 permission/process/data-scope；这些字段没有 canonical 来源时继续保持空/阻断状态。",
        "",
        "Machine evidence: `docs/implementation/phases/PHASE-08/PAGE_IA_EXTRACT.json`.",
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
        raise RuntimeError("PAGE_IA_EXTRACT evidence is missing")
    actual = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    if actual != expected:
        raise RuntimeError("PAGE_IA_EXTRACT.json is stale")
    if OUT_MD.read_text(encoding="utf-8") != build_markdown(expected):
        raise RuntimeError("PAGE_IA_EXTRACT.md is stale")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check_outputs()
        print("PHASE-08 PAGE IA extract is deterministic and current")
        return
    write_outputs()
    print("PHASE-08 six IA XLSX workbooks parsed and evidence generated")


if __name__ == "__main__":
    main()
