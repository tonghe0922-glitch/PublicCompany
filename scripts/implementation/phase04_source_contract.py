#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[2]
KB = ROOT / "Knowledge Base"
OUTPUT_JSON = ROOT / "docs/implementation/evidence/PHASE-04_SOURCE_CONTRACT.json"
OUTPUT_MD = ROOT / "docs/implementation/phases/PHASE-04/SOURCE_CONTRACT.md"

ORG_WORKBOOK = KB / "00 企业架构及员工/01 企业组织架构数据表_TM.xlsx"
EMPLOYEE_WORKBOOK = KB / "00 企业架构及员工/02 员工的工号_TM.xlsx"
PROCESS_NAMES = {
    "P001": "001_统一登录与多岗位身份切换.xlsx",
    "P002": "002_权限申请、复核与回收.xlsx",
    "P003": "003_个人资料变更.xlsx",
}
PORTALS = {"employee": "01_员工端", "center": "02_中心管理端", "tech": "03_技术后台端"}
EXPECTED_PROCESS_SHEETS = [
    "00_流程总览", "01_表单清单", "02_字段字典",
    "03_状态与审批", "04_规则与接口", "05_三端联动",
]
NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
CELL_REF = re.compile(r"([A-Z]+)(\d+)")
SAFE_ORG_HEADER = re.compile(
    r"(?:组织|中心|部门|岗位|职务|职级|层级|上级|父级|编码|代码|类型|类别|状态|序号|排序|名称)$|^(?:组织|中心|部门|岗位|职务|职级|层级|上级|父级|编码|代码|类型|类别|状态|序号|排序|名称)",
    re.I,
)
PII_HEADER = re.compile(
    r"姓名|员工|工号|人员|负责人|经理|主任|电话|手机|邮箱|证件|身份证|地址|生日|出生|性别|薪|工资|银行|卡号|健康|紧急联系人",
    re.I,
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def col_index(ref: str) -> int:
    match = CELL_REF.fullmatch(ref)
    if match is None:
        raise ValueError(f"invalid XLSX cell reference: {ref}")
    value = 0
    for char in match.group(1):
        value = value * 26 + ord(char) - ord("A") + 1
    return value - 1


def normalize_target(target: str) -> str:
    raw = target.replace("\\", "/").lstrip("/")
    path = PurePosixPath(raw) if raw.startswith("xl/") else PurePosixPath("xl") / raw
    parts: list[str] = []
    for part in path.parts:
        if part in ("", ".", "/"):
            continue
        if part == "..":
            if parts:
                parts.pop()
            continue
        parts.append(part)
    return "/".join(parts)


def shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return ["".join(node.text or "" for node in item.iter(f"{{{NS_MAIN}}}t"))
            for item in root.findall(f"{{{NS_MAIN}}}si")]


def workbook_sheets(archive: zipfile.ZipFile) -> list[tuple[str, str]]:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    rel_root = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    rels = {
        rel.attrib["Id"]: normalize_target(rel.attrib["Target"])
        for rel in rel_root.findall(f"{{{NS_PKG_REL}}}Relationship")
    }
    sheets_node = workbook.find(f"{{{NS_MAIN}}}sheets")
    if sheets_node is None:
        raise RuntimeError("XLSX workbook has no sheets node")
    result: list[tuple[str, str]] = []
    for sheet in sheets_node:
        name = sheet.attrib["name"]
        rel_id = sheet.attrib[f"{{{NS_REL}}}id"]
        target = rels.get(rel_id)
        if target is None:
            raise RuntimeError(f"missing relationship target for sheet {name}")
        if target not in archive.namelist():
            raise RuntimeError(f"sheet relationship target not in XLSX archive: {target}")
        result.append((name, target))
    return result


def cell_text(cell: ET.Element, strings: list[str]) -> str:
    kind = cell.attrib.get("t")
    if kind == "inlineStr":
        inline = cell.find(f"{{{NS_MAIN}}}is")
        return "" if inline is None else "".join(node.text or "" for node in inline.iter(f"{{{NS_MAIN}}}t"))
    value = cell.find(f"{{{NS_MAIN}}}v")
    raw = "" if value is None or value.text is None else value.text
    if kind == "s" and raw:
        index = int(raw)
        return strings[index] if 0 <= index < len(strings) else raw
    if kind == "b":
        return "TRUE" if raw == "1" else "FALSE"
    return raw


def parse_sheet(archive: zipfile.ZipFile, target: str, strings: list[str]) -> list[list[str]]:
    root = ET.fromstring(archive.read(target))
    data = root.find(f"{{{NS_MAIN}}}sheetData")
    if data is None:
        return []
    parsed: list[list[str]] = []
    for row in data.findall(f"{{{NS_MAIN}}}row"):
        values: dict[int, str] = {}
        max_index = -1
        for cell in row.findall(f"{{{NS_MAIN}}}c"):
            ref = cell.attrib.get("r")
            if not ref:
                continue
            index = col_index(ref)
            values[index] = cell_text(cell, strings).strip()
            max_index = max(max_index, index)
        if max_index >= 0:
            dense = [values.get(i, "") for i in range(max_index + 1)]
            if any(dense):
                parsed.append(dense)
    return parsed


def parse_workbook(path: Path) -> dict[str, list[list[str]]]:
    if not path.is_file():
        raise FileNotFoundError(path)
    with zipfile.ZipFile(path) as archive:
        strings = shared_strings(archive)
        return {name: parse_sheet(archive, target, strings) for name, target in workbook_sheets(archive)}


def first_nonempty_row(rows: list[list[str]]) -> tuple[int | None, list[str]]:
    for index, row in enumerate(rows):
        if any(row):
            return index, row
    return None, []


def structural_sheet(name: str, rows: list[list[str]], expose_rows: bool) -> dict[str, object]:
    header_index, headers = first_nonempty_row(rows)
    result: dict[str, object] = {
        "sheet": name,
        "nonempty_row_count": len(rows),
        "header_row_index_1_based": None if header_index is None else header_index + 1,
        "headers": headers,
    }
    if expose_rows:
        result["rows"] = rows
    return result


def safe_org_sheet(name: str, rows: list[list[str]]) -> dict[str, object]:
    header_index, headers = first_nonempty_row(rows)
    result = structural_sheet(name, rows, expose_rows=False)
    if header_index is None:
        result["safe_headers"] = []
        result["safe_rows"] = []
        return result
    safe_indexes = [i for i, header in enumerate(headers)
                    if header and SAFE_ORG_HEADER.search(header) and not PII_HEADER.search(header)]
    result["safe_headers"] = [headers[i] for i in safe_indexes]
    safe_rows: list[dict[str, str]] = []
    for row in rows[header_index + 1:]:
        record = {headers[i]: row[i] for i in safe_indexes if i < len(row) and row[i]}
        if record:
            safe_rows.append(record)
    result["safe_rows"] = safe_rows
    result["redaction_policy"] = (
        "Only organization/department/position hierarchy and code/name/type/status columns are emitted; "
        "employee/person/contact/salary fields are excluded."
    )
    return result


def process_path(portal_dir: str, file_name: str) -> Path:
    return (KB / "02 业务流程 表单 字段/S1 三端业务流程表单字段包" /
            portal_dir / "01_平台公共能力" / file_name)


def build_payload() -> dict[str, object]:
    sources = [ORG_WORKBOOK, EMPLOYEE_WORKBOOK]
    sources.extend(process_path(portal_dir, file_name)
                   for portal_dir in PORTALS.values() for file_name in PROCESS_NAMES.values())
    if len(sources) != 11:
        raise AssertionError(f"expected 11 sources, got {len(sources)}")
    missing = [str(path.relative_to(ROOT)) for path in sources if not path.is_file()]
    if missing:
        raise RuntimeError("missing PHASE-04 XLSX sources: " + ", ".join(missing))

    org_sheets = parse_workbook(ORG_WORKBOOK)
    employee_sheets = parse_workbook(EMPLOYEE_WORKBOOK)
    process_evidence: list[dict[str, object]] = []
    for process_code, file_name in PROCESS_NAMES.items():
        for portal, portal_dir in PORTALS.items():
            path = process_path(portal_dir, file_name)
            sheets = parse_workbook(path)
            missing_sheets = [name for name in EXPECTED_PROCESS_SHEETS if name not in sheets]
            if missing_sheets:
                raise RuntimeError(f"{path}: missing sheets {missing_sheets}; actual={list(sheets)}")
            parsed = [structural_sheet(name, sheets[name], expose_rows=True) for name in EXPECTED_PROCESS_SHEETS]
            if any(int(item["nonempty_row_count"]) == 0 for item in parsed):
                raise RuntimeError(f"{path}: expected process sheet contains no parsed rows")
            process_evidence.append({
                "process_code": process_code,
                "portal": portal,
                "source_path": path.relative_to(ROOT).as_posix(),
                "sha256": sha256(path),
                "sheet_names": list(sheets),
                "sheets": parsed,
            })

    employee_structure = [structural_sheet(name, rows, expose_rows=False)
                          for name, rows in employee_sheets.items()]
    for item in employee_structure:
        item["redaction_policy"] = (
            "Real employee row values are intentionally excluded from repository evidence; "
            "only workbook SHA, sheet names, headers, and counts are recorded."
        )

    return {
        "phase": "PHASE-04",
        "scope": "PLATFORM/基础工程",
        "parser": "python-stdlib-zipfile-xml",
        "source_count": 11,
        "parse_failures": 0,
        "expected_process_sheets": EXPECTED_PROCESS_SHEETS,
        "organization_workbook": {
            "source_path": ORG_WORKBOOK.relative_to(ROOT).as_posix(),
            "sha256": sha256(ORG_WORKBOOK),
            "sheet_names": list(org_sheets),
            "sheets": [safe_org_sheet(name, rows) for name, rows in org_sheets.items()],
        },
        "real_employee_workbook": {
            "source_path": EMPLOYEE_WORKBOOK.relative_to(ROOT).as_posix(),
            "sha256": sha256(EMPLOYEE_WORKBOOK),
            "sheet_names": list(employee_sheets),
            "sheets": employee_structure,
            "contains_real_employee_facts": True,
            "row_values_committed": False,
        },
        "process_workbooks": process_evidence,
        "privacy": {"real_employee_values_in_output": False, "test_fixture_policy": "synthetic-only"},
    }


def build_markdown(payload: dict[str, object]) -> str:
    org = payload["organization_workbook"]
    emp = payload["real_employee_workbook"]
    process = payload["process_workbooks"]
    assert isinstance(org, dict) and isinstance(emp, dict) and isinstance(process, list)
    lines = [
        "# PHASE-04 SOURCE CONTRACT", "",
        "> Focused current-head XLSX reparse required before IAM runtime code.", "",
        "## Result", "",
        "- XLSX sources parsed: **11 / 11**",
        "- Parse failures: **0**",
        "- P001/P002/P003: employee / center / tech workbooks all parsed from the six required sheets.",
        "- Real employee workbook values are **not** written to repository evidence.", "",
        "## Enterprise/employee sources", "",
        f"- `{org['source_path']}` — SHA-256 `{org['sha256']}` — sheets: {', '.join(org['sheet_names'])}",
        f"- `{emp['source_path']}` — SHA-256 `{emp['sha256']}` — sheets: {', '.join(emp['sheet_names'])}; row values redacted",
        "", "## Process workbook parse", "",
        "| process | portal | source | sheets | nonempty rows by sheet |",
        "|---|---|---|---:|---|",
    ]
    for item in process:
        counts = ", ".join(f"{sheet['sheet']}={sheet['nonempty_row_count']}" for sheet in item["sheets"])
        lines.append(f"| {item['process_code']} | {item['portal']} | `{item['source_path']}` | {len(item['sheet_names'])} | {counts} |")
    lines += [
        "", "## Privacy and implementation gate", "",
        "- Organization evidence emits only hierarchy/code/name/type/status-like columns and excludes person/contact/salary fields.",
        "- The real employee-number workbook is parsed structurally, but employee row values are never copied into evidence or test fixtures.",
        "- PHASE-04 tests must use synthetic tenant/account/employee/appointment data.",
        "- PHASE-04 runtime code may start only when this evidence is current and deterministic.", "",
        "Machine evidence: `docs/implementation/evidence/PHASE-04_SOURCE_CONTRACT.json`.",
    ]
    return "\n".join(lines) + "\n"


def write_outputs(json_path: Path, md_path: Path) -> None:
    payload = build_payload()
    json_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    md_path.write_text(build_markdown(payload), encoding="utf-8", newline="\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if not args.check:
        write_outputs(OUTPUT_JSON, OUTPUT_MD)
        print("PHASE-04 focused XLSX source contract generated")
        return
    if not OUTPUT_JSON.exists() or not OUTPUT_MD.exists():
        raise RuntimeError("committed PHASE-04 source contract evidence is missing")
    with tempfile.TemporaryDirectory(prefix="phase04-source-") as temp:
        expected_json = Path(temp) / "source.json"
        expected_md = Path(temp) / "source.md"
        write_outputs(expected_json, expected_md)
        if expected_json.read_bytes() != OUTPUT_JSON.read_bytes():
            raise RuntimeError("PHASE-04_SOURCE_CONTRACT.json is stale")
        if expected_md.read_bytes() != OUTPUT_MD.read_bytes():
            raise RuntimeError("SOURCE_CONTRACT.md is stale")
    print("PHASE-04 source contract is deterministic and current")


if __name__ == "__main__":
    main()
