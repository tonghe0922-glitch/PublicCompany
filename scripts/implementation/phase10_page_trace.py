#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

import phase10_contract as contract

ROOT = contract.ROOT
BINDINGS = contract.BINDINGS
OUT_DIR = ROOT / "docs" / "implementation" / "phases" / "PHASE-10"
OUT_JSON = OUT_DIR / "P006_P010_PAGE_TRACE.json"
OUT_MD = OUT_DIR / "P006_P010_PAGE_TRACE.md"
TARGET_CODES = ("P006", "P007", "P008", "P009", "P010")
PORTAL_ORDER = ("employee", "center", "tech")


def load_validated_bindings() -> list[dict[str, Any]]:
    payload = json.loads(BINDINGS.read_text(encoding="utf-8"))
    raw = payload.get("bindings")
    if not isinstance(raw, list) or not raw:
        raise RuntimeError("PHASE10_PAGE_BINDINGS.json has no frozen bindings")

    cache: dict[str, dict[str, dict[int, list[str]]]] = {}
    validated: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            raise RuntimeError("PHASE-10 binding must be an object")
        code = str(item.get("process_code") or "")
        portal = str(item.get("portal") or "")
        if code not in TARGET_CODES or portal not in PORTAL_ORDER:
            raise RuntimeError(f"out-of-scope frozen binding: {code}/{portal}")
        contract.validate_binding_source(item, cache)
        match = contract.SOURCE_KEY.fullmatch(str(item.get("source_key") or ""))
        if match is None:
            raise RuntimeError(f"invalid frozen source_key: {item.get('source_key')}")
        validated.append({
            "process_code": code,
            "portal": portal,
            "purpose": str(item.get("purpose") or ""),
            "source_key": str(item.get("source_key") or ""),
            "source_file": match.group("file"),
            "source_sheet": match.group("sheet"),
            "source_row": int(match.group("row")),
            "route_path": str(item.get("route_path") or ""),
            "validation": "PHYSICAL_IA_ROW_ROUTE_MATCH",
        })

    coverage = {code: {portal: 0 for portal in PORTAL_ORDER} for code in TARGET_CODES}
    for item in validated:
        coverage[item["process_code"]][item["portal"]] += 1
    missing = [f"{code}/{portal}" for code in TARGET_CODES for portal in PORTAL_ORDER if coverage[code][portal] == 0]
    if missing:
        raise RuntimeError(f"frozen binding coverage missing: {missing}")
    return validated


def build_payload() -> dict[str, Any]:
    bindings = load_validated_bindings()
    portal_counts = Counter(item["portal"] for item in bindings)
    processes: dict[str, dict[str, Any]] = {}
    for code in TARGET_CODES:
        records = [item for item in bindings if item["process_code"] == code]
        counts = Counter(item["portal"] for item in records)
        processes[code] = {
            "page_record_count": len(records),
            "portal_counts": {portal: counts.get(portal, 0) for portal in PORTAL_ORDER},
            "records": records,
        }
    return {
        "phase": "PHASE-10",
        "state": "C0_FROZEN_BINDING_TRACE",
        "source": "docs/implementation/phases/PHASE-10/PHASE10_PAGE_BINDINGS.json",
        "physical_source_root": "Knowledge Base/01 完整的页面架构",
        "validation_method": "source_key physical XLSX sheet/row + exact route_path match",
        "target_process_codes": list(TARGET_CODES),
        "matched_page_records": len(bindings),
        "portal_counts": {portal: portal_counts.get(portal, 0) for portal in PORTAL_ORDER},
        "processes": processes,
        "rules": {
            "fuzzy_matching": "FORBIDDEN",
            "route_inference": "FORBIDDEN",
            "permission_inference": "FORBIDDEN",
            "binding_source": "C0_FROZEN_EXPLICIT_SOURCE_COORDINATES",
        },
    }


def esc(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def build_markdown(payload: dict[str, Any]) -> str:
    lines = [
        "# PHASE-10 P006–P010 PAGE TRACE",
        "",
        "> 本 trace 仅使用 C0 已冻结的 PHASE10_PAGE_BINDINGS.json，并逐条回查 Knowledge Base/01 完整的页面架构中的物理 XLSX 工作表、行号和 route_path。",
        "> 不再依赖已不存在的 PHASE-01 pages.json，不做关键词模糊匹配，不推断 route/permission。",
        "",
        "## Result",
        "",
        f"- Validated frozen bindings: **{payload['matched_page_records']}**",
        f"- Portal counts: `{json.dumps(payload['portal_counts'], ensure_ascii=False, sort_keys=True)}`",
        f"- Validation: **{payload['validation_method']}**",
        "",
        "## Per-process trace",
        "",
        "| Process | Bindings | Employee | Center | Tech |",
        "|---|---:|---:|---:|---:|",
    ]
    for code in TARGET_CODES:
        info = payload["processes"][code]
        counts = info["portal_counts"]
        lines.append(f"| {code} | {info['page_record_count']} | {counts['employee']} | {counts['center']} | {counts['tech']} |")
    lines.extend(["", "## Frozen binding details", "", "| Process | Portal | Purpose | Source coordinate | Route |", "|---|---|---|---|---|"])
    for code in TARGET_CODES:
        for item in payload["processes"][code]["records"]:
            lines.append(
                f"| {code} | {item['portal']} | {esc(item['purpose'])} | `{esc(item['source_key'])}` | `{esc(item['route_path'])}` |"
            )
    lines.extend([
        "",
        "Machine evidence: `docs/implementation/phases/PHASE-10/P006_P010_PAGE_TRACE.json`.",
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
        raise RuntimeError("PHASE-10 page trace is missing")
    if json.loads(OUT_JSON.read_text(encoding="utf-8")) != expected:
        raise RuntimeError("P006_P010_PAGE_TRACE.json is stale")
    if OUT_MD.read_text(encoding="utf-8") != build_markdown(expected):
        raise RuntimeError("P006_P010_PAGE_TRACE.md is stale")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check_outputs()
        print("PHASE-10 frozen page trace is deterministic and current")
    else:
        write_outputs()
        print("PHASE-10 frozen page trace generated from validated physical IA coordinates")


if __name__ == "__main__":
    main()
