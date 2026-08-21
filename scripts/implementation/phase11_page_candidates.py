#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import phase04_source_contract as xlsx

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "docs" / "implementation" / "phases" / "PHASE-11"
OUT_JSON = OUT_DIR / "P011_P016_PAGE_CANDIDATES.json"
OUT_MD = OUT_DIR / "P011_P016_PAGE_CANDIDATES.md"
PROCESS_CATALOG = ROOT / "docs" / "implementation" / "MASTER_PROCESS_CATALOG.json"
TARGET_CODES = ("P011", "P012", "P013", "P014", "P015", "P016")
IA_FILES = {
    "employee": "Knowledge Base/01 完整的页面架构/1-2员工全层级页面.xlsx",
    "center": "Knowledge Base/01 完整的页面架构/2-2中心全层级页面.xlsx",
    "tech": "Knowledge Base/01 完整的页面架构/3-2技术-全层级页面.xlsx",
}
ROUTE_PATTERN = re.compile(r"^/(?:employee|center|tech|admin)(?:/|$)")


def load_terms() -> dict[str, list[str]]:
    payload = json.loads(PROCESS_CATALOG.read_text(encoding="utf-8"))
    result: dict[str, list[str]] = {}
    for item in payload.get("processes", []):
        if not isinstance(item, dict) or item.get("process_code") not in TARGET_CODES:
            continue
        terms = {str(item.get("canonical_name") or "").strip()}
        source_names = item.get("source_names")
        if isinstance(source_names, dict):
            for values in source_names.values():
                if isinstance(values, list):
                    terms.update(str(value).strip() for value in values if str(value).strip())
        result[str(item["process_code"])] = sorted(term for term in terms if term)
    return result


def build_payload() -> dict[str, Any]:
    terms = load_terms()
    parsed = {
        portal: xlsx.parse_workbook(ROOT / source_file)
        for portal, source_file in IA_FILES.items()
    }
    processes: dict[str, Any] = {}
    for code in TARGET_CODES:
        processes[code] = {}
        for portal, source_file in IA_FILES.items():
            candidates: list[dict[str, Any]] = []
            for sheet_name, rows in parsed[portal].items():
                for row_index, row in enumerate(rows, start=1):
                    values = [str(value).strip() for value in row]
                    matched_terms = sorted({
                        term for term in terms[code]
                        if any(term in value for value in values if value)
                    })
                    if not matched_terms:
                        continue
                    candidates.append({
                        "source_file": source_file,
                        "source_sheet": sheet_name,
                        "source_row_1_based": row_index,
                        "source_key": f"{source_file}#{sheet_name}:{row_index}",
                        "matched_exact_source_terms": matched_terms,
                        "explicit_route_cells": [
                            value for value in values if ROUTE_PATTERN.match(value)
                        ],
                        "row_values": values,
                        "selection_status": "CANDIDATE_ONLY_NOT_FROZEN",
                    })
            processes[code][portal] = {
                "candidate_count": len(candidates),
                "candidates": candidates,
            }
    return {
        "phase": "PHASE-11",
        "state": "PREPARATION_PAGE_CANDIDATES_NOT_FROZEN",
        "match_rule": (
            "Exact canonical/source-name substring in a physical IA XLSX row. "
            "Results are candidates only; no route or permission inference."
        ),
        "ia_files": IA_FILES,
        "processes": processes,
        "rules": {
            "candidate_is_binding": False,
            "route_inference": "FORBIDDEN",
            "permission_inference": "FORBIDDEN",
            "c0_manual_source_coordinate_freeze_required": True,
        },
    }


def escape(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def build_markdown(payload: dict[str, Any]) -> str:
    lines = [
        "# PHASE-11 P011–P016 PAGE CANDIDATES",
        "",
        "> 候选来自三端物理 IA XLSX 中对 canonical/source name 的精确文本命中。",
        "> 候选不等于页面绑定；禁止自动推断 route、permission 或 implementation 状态。",
        "",
        "| Process | Employee candidates | Center candidates | Tech candidates |",
        "|---|---:|---:|---:|",
    ]
    for code in TARGET_CODES:
        portals = payload["processes"][code]
        lines.append(
            f"| {code} | {portals['employee']['candidate_count']} | "
            f"{portals['center']['candidate_count']} | "
            f"{portals['tech']['candidate_count']} |"
        )
    lines.extend(["", "## Candidate details", ""])
    for code in TARGET_CODES:
        lines.append(f"### {code}")
        lines.append("")
        for portal in ("employee", "center", "tech"):
            info = payload["processes"][code][portal]
            lines.append(f"#### {portal} — {info['candidate_count']}")
            lines.append("")
            if not info["candidates"]:
                lines.append("- No exact-name IA row candidate. C0 must not invent one.")
                lines.append("")
                continue
            lines.extend([
                "| Source coordinate | Matched term | Explicit route cells | Row excerpt |",
                "|---|---|---|---|",
            ])
            for item in info["candidates"]:
                excerpt = " / ".join(value for value in item["row_values"] if value)[:260]
                lines.append(
                    f"| `{escape(item['source_key'])}` | "
                    f"{escape(', '.join(item['matched_exact_source_terms']))} | "
                    f"`{escape(', '.join(item['explicit_route_cells']))}` | "
                    f"{escape(excerpt)} |"
                )
            lines.append("")
    lines.extend([
        "## Freeze rule",
        "",
        "- C0 must review each candidate against the process workbook and DESIGN/AGENT constraints.",
        "- Only an explicit source-coordinate binding can become the construction route contract.",
        "- A zero-candidate result is a real GAP, not permission to invent a page.",
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
        raise RuntimeError("PHASE-11 page candidate outputs are missing")
    if json.loads(OUT_JSON.read_text(encoding="utf-8")) != expected:
        raise RuntimeError("P011_P016_PAGE_CANDIDATES.json is stale")
    if OUT_MD.read_text(encoding="utf-8") != build_markdown(expected):
        raise RuntimeError("P011_P016_PAGE_CANDIDATES.md is stale")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check_outputs()
        print("PHASE-11 page candidates are deterministic and current")
    else:
        write_outputs()
        print("PHASE-11 page candidates generated; no bindings frozen")


if __name__ == "__main__":
    main()
