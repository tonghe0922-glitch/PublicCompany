#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from phase10_page_trace import OUT_DIR, PORTAL_ORDER, TARGET_CODES, load_validated_bindings

OUT_JSON = OUT_DIR / "P006_P010_PAGE_CANDIDATES.json"
OUT_MD = OUT_DIR / "P006_P010_PAGE_CANDIDATES.md"


def build_payload() -> dict[str, Any]:
    bindings = load_validated_bindings()
    processes: dict[str, dict[str, Any]] = {}
    for code in TARGET_CODES:
        processes[code] = {}
        for portal in PORTAL_ORDER:
            selected = [item for item in bindings if item["process_code"] == code and item["portal"] == portal]
            candidates = [
                {
                    "selection_mode": "frozen_binding",
                    "source_key": item["source_key"],
                    "source_file": item["source_file"],
                    "source_sheet": item["source_sheet"],
                    "source_row": item["source_row"],
                    "route_path": item["route_path"],
                    "purpose": item["purpose"],
                    "validation": item["validation"],
                }
                for item in selected
            ]
            processes[code][portal] = {
                "candidate_count": len(candidates),
                "selection_mode": "C0_FROZEN_EXPLICIT_BINDING",
                "top_candidates": candidates,
            }
    return {
        "phase": "PHASE-10",
        "status": "C0_FROZEN_BINDINGS",
        "source": "docs/implementation/phases/PHASE-10/PHASE10_PAGE_BINDINGS.json",
        "physical_source_root": "Knowledge Base/01 完整的页面架构",
        "rule": "Candidates are the already reviewed C0 frozen bindings. Every entry is revalidated against its physical XLSX sheet/row and exact route_path. Fuzzy keyword discovery and route/permission inference are forbidden after C0 freeze.",
        "processes": processes,
    }


def esc(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def build_markdown(payload: dict[str, Any]) -> str:
    lines = [
        "# PHASE-10 P006–P010 PAGE CANDIDATES",
        "",
        "> C0 已冻结：本文件不再执行关键词候选发现，而是把经过人工冻结且通过物理 XLSX 坐标校验的 binding 作为唯一候选证据。",
        "> 禁止模糊匹配、自动 route 推断、自动 permission 推断。",
        "",
    ]
    for code in TARGET_CODES:
        lines.extend([f"## {code}", ""])
        for portal in PORTAL_ORDER:
            info = payload["processes"][code][portal]
            lines.extend([
                f"### {portal} — frozen bindings {info['candidate_count']}",
                "",
                "| Source coordinate | Route | Purpose | Validation |",
                "|---|---|---|---|",
            ])
            for item in info["top_candidates"]:
                lines.append(
                    f"| `{esc(item['source_key'])}` | `{esc(item['route_path'])}` | {esc(item['purpose'])} | {item['validation']} |"
                )
            lines.append("")
    return "\n".join(lines) + "\n"


def write_outputs() -> None:
    payload = build_payload()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    OUT_MD.write_text(build_markdown(payload), encoding="utf-8")


def check_outputs() -> None:
    expected = build_payload()
    if not OUT_JSON.is_file() or not OUT_MD.is_file():
        raise RuntimeError("PHASE-10 candidate evidence missing")
    if json.loads(OUT_JSON.read_text(encoding="utf-8")) != expected:
        raise RuntimeError("P006_P010_PAGE_CANDIDATES.json is stale")
    if OUT_MD.read_text(encoding="utf-8") != build_markdown(expected):
        raise RuntimeError("P006_P010_PAGE_CANDIDATES.md is stale")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check_outputs()
        print("PHASE-10 frozen page candidate evidence is deterministic and current")
    else:
        write_outputs()
        print("PHASE-10 frozen page candidates generated from validated bindings")


if __name__ == "__main__":
    main()
