#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import tempfile
from pathlib import Path

import phase04_source_contract as source

ROOT = Path(__file__).resolve().parents[2]
OUT_JSON = ROOT / "docs/implementation/evidence/PHASE-04_IAM_SOURCE_FACTS.json"
OUT_MD = ROOT / "docs/implementation/phases/PHASE-04/IAM_SOURCE_FACTS.md"
KEYWORDS = re.compile(
    r"登录|会话|session|refresh|token|密码|password|身份|任职|岗位|组织|中心|部门|权限|permission|角色|role|范围|scope|MFA|Step[-_ ]?Up|二次认证|验证码|手机|邮箱|敏感|P2|P3|跨中心|本人|当前任职",
    re.I,
)
SELECTED_SHEETS = {"00_流程总览", "03_状态与审批", "04_规则与接口", "05_三端联动"}


def compact_rows(rows: list[list[str]]) -> list[list[str]]:
    return [[value for value in row] for row in rows if any(row)]


def build() -> dict[str, object]:
    payload = source.build_payload()
    facts: list[dict[str, object]] = []
    for item in payload["process_workbooks"]:
        selected: dict[str, list[list[str]]] = {}
        relevant_fields: list[list[str]] = []
        for sheet in item["sheets"]:
            name = sheet["sheet"]
            rows = compact_rows(sheet.get("rows", []))
            if name in SELECTED_SHEETS:
                selected[name] = rows
            if name == "02_字段字典":
                relevant_fields = [row for row in rows if KEYWORDS.search(" | ".join(row))]
        facts.append({
            "process_code": item["process_code"],
            "portal": item["portal"],
            "source_path": item["source_path"],
            "selected_sheets": selected,
            "relevant_field_rows": relevant_fields,
        })
    return {
        "phase": "PHASE-04",
        "source_contract_sha_policy": "recomputed from current XLSX sources",
        "process_facts": facts,
        "organization_safe_facts": payload["organization_workbook"]["sheets"],
        "real_employee_row_values_included": False,
    }


def md_row(row: list[str]) -> str:
    # Keep meaningful interior empty cells, but never let a trailing empty XLSX
    # cell generate Markdown trailing whitespace. This belongs in the
    # deterministic generator so a later regeneration cannot reintroduce it.
    return " | ".join(value.replace("\n", " ") for value in row).rstrip()


def render(payload: dict[str, object]) -> str:
    lines = [
        "# PHASE-04 IAM SOURCE FACTS", "",
        "> Derived directly from the 11 current-head XLSX sources. This is a compact engineering reading aid; the XLSX remains authoritative.", "",
        "## Privacy", "",
        "- Real employee row values included: **NO**.",
        "- Organization rows are limited by the source-contract safe-column policy.", "",
    ]
    for fact in payload["process_facts"]:
        lines += [f"## {fact['process_code']} / {fact['portal']}", "", f"Source: `{fact['source_path']}`", ""]
        for sheet_name in ("00_流程总览", "03_状态与审批", "04_规则与接口", "05_三端联动"):
            lines += [f"### {sheet_name}", "", "```text"]
            for row in fact["selected_sheets"].get(sheet_name, []):
                lines.append(md_row(row))
            lines += ["```", ""]
        lines += ["### 02_字段字典（IAM 相关行）", "", "```text"]
        for row in fact["relevant_field_rows"]:
            lines.append(md_row(row))
        lines += ["```", ""]
    lines += ["## Organization safe facts", ""]
    for sheet in payload["organization_safe_facts"]:
        lines += [f"### {sheet['sheet']}", "", f"Safe headers: `{json.dumps(sheet.get('safe_headers', []), ensure_ascii=False)}`", "", "```json"]
        lines.append(json.dumps(sheet.get("safe_rows", []), ensure_ascii=False, indent=2))
        lines += ["```", ""]
    return "\n".join(lines)


def write(json_path: Path, md_path: Path) -> None:
    payload = build()
    json_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    md_path.write_text(render(payload).rstrip() + "\n", encoding="utf-8", newline="\n")


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if not args.check:
        write(OUT_JSON, OUT_MD)
        print("PHASE-04 compact IAM source facts generated")
        return
    if not OUT_JSON.exists() or not OUT_MD.exists():
        raise RuntimeError("PHASE-04 IAM source facts are missing")
    with tempfile.TemporaryDirectory(prefix="phase04-iam-facts-") as temp:
        j = Path(temp) / "facts.json"
        m = Path(temp) / "facts.md"
        write(j, m)
        if j.read_bytes() != OUT_JSON.read_bytes() or m.read_bytes() != OUT_MD.read_bytes():
            raise RuntimeError("PHASE-04 IAM source facts are stale")
    print("PHASE-04 IAM source facts are deterministic and current")


if __name__ == "__main__":
    main()
