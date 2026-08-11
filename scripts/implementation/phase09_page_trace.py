#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
PAGES = ROOT / "docs" / "implementation" / "contracts" / "phase-01" / "pages.json"
OUT_DIR = ROOT / "docs" / "implementation" / "phases" / "PHASE-09"
OUT_JSON = OUT_DIR / "P001_P005_PAGE_TRACE.json"
OUT_MD = OUT_DIR / "P001_P005_PAGE_TRACE.md"
TARGET_CODES = {"P001", "P002", "P003", "P004", "P005"}
PUBLIC_KEYS = (
    "portal_code", "runtime_portal", "source_file", "source_sheet", "source_row", "source_key",
    "level_1", "level_2", "level_3", "display_name", "aliases", "route_name", "route_path",
    "implementation_path", "permission_codes", "permission_code", "process_codes", "data_scope",
    "sensitive_level", "mobile_access", "status", "notes",
)


def records(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in ("pages", "records", "items", "data"):
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
    raise RuntimeError("unsupported PHASE-01 pages.json shape")


def codes(record: dict[str, Any]) -> set[str]:
    raw = record.get("process_codes")
    if isinstance(raw, list):
        return {str(item) for item in raw if str(item) in TARGET_CODES}
    return set()


def public(record: dict[str, Any]) -> dict[str, Any]:
    return {key: record.get(key) for key in PUBLIC_KEYS if key in record}


def build_payload() -> dict[str, Any]:
    all_pages = records(json.loads(PAGES.read_text(encoding="utf-8")))
    selected = [record for record in all_pages if codes(record)]
    by_portal = Counter(str(item.get("portal_code")) for item in selected)
    by_status = Counter(str(item.get("status")) for item in selected)
    by_process: dict[str, dict[str, Any]] = {}
    for code in sorted(TARGET_CODES):
        process_pages = [item for item in selected if code in codes(item)]
        portal_counts = Counter(str(item.get("portal_code")) for item in process_pages)
        status_counts = Counter(str(item.get("status")) for item in process_pages)
        by_process[code] = {
            "page_record_count": len(process_pages),
            "portal_counts": dict(sorted(portal_counts.items())),
            "status_counts": dict(sorted(status_counts.items())),
            "records": [public(item) for item in process_pages],
        }
    return {
        "phase": "PHASE-09",
        "state": "PREPARATION_ONLY_NOT_STARTED",
        "source": "docs/implementation/contracts/phase-01/pages.json",
        "total_phase01_page_records": len(all_pages),
        "target_process_codes": sorted(TARGET_CODES),
        "matched_page_records": len(selected),
        "portal_counts": dict(sorted(by_portal.items())),
        "status_counts": dict(sorted(by_status.items())),
        "processes": by_process,
        "rules": {
            "route_inference": "FORBIDDEN",
            "permission_inference": "FORBIDDEN",
            "planned_to_implemented_promotion": "FORBIDDEN_DURING_PREPARATION",
            "trace_fields_preserved": list(PUBLIC_KEYS),
        },
    }


def esc(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def build_markdown(payload: dict[str, Any]) -> str:
    lines = [
        "# PHASE-09 P001–P005 PAGE TRACE",
        "",
        "> 来源仅为 PHASE-01 已解析的 7,126 条页面事实；本准备阶段不猜 route/permission，不把 planned 页面提升为 implemented。",
        "",
        "## Result",
        "",
        f"- Total PHASE-01 page records: **{payload['total_phase01_page_records']}**",
        f"- P001–P005 matched page records: **{payload['matched_page_records']}**",
        f"- Portal counts: `{json.dumps(payload['portal_counts'], ensure_ascii=False, sort_keys=True)}`",
        f"- Status counts: `{json.dumps(payload['status_counts'], ensure_ascii=False, sort_keys=True)}`",
        "- Route inference: **FORBIDDEN**",
        "- Permission inference: **FORBIDDEN**",
        "",
        "## Per-process trace",
        "",
        "| Process | Page records | Portal counts | Status counts |",
        "|---|---:|---|---|",
    ]
    for code, info in payload["processes"].items():
        lines.append(
            f"| {code} | {info['page_record_count']} | `{esc(json.dumps(info['portal_counts'], ensure_ascii=False, sort_keys=True))}` | "
            f"`{esc(json.dumps(info['status_counts'], ensure_ascii=False, sort_keys=True))}` |"
        )
    lines.extend([
        "",
        "## Opening rule",
        "",
        "正式施工只允许把已经完成真实闭环并具备 implementation_path、真实 Router、服务端权限/API/数据库证据的页面更新为 IMPLEMENTED。",
        "任何当前为空的 route_name/route_path/permission_code 必须回到 Knowledge Base / ADR / 已批准合同确认，禁止按中文标题生成。",
        "",
        "Machine evidence: `docs/implementation/phases/PHASE-09/P001_P005_PAGE_TRACE.json`.",
    ])
    return "\n".join(lines) + "\n"


def write_outputs() -> None:
    payload = build_payload()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    OUT_MD.write_text(build_markdown(payload), encoding="utf-8")


def check_outputs() -> None:
    expected = build_payload()
    if json.loads(OUT_JSON.read_text(encoding="utf-8")) != expected:
        raise RuntimeError("P001_P005_PAGE_TRACE.json is stale")
    if OUT_MD.read_text(encoding="utf-8") != build_markdown(expected):
        raise RuntimeError("P001_P005_PAGE_TRACE.md is stale")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check_outputs()
        print("PHASE-09 P001-P005 page trace is deterministic and current")
    else:
        write_outputs()
        print("PHASE-09 P001-P005 page trace generated from PHASE-01 records")


if __name__ == "__main__":
    main()
