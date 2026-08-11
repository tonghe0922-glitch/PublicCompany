#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
PAGES = ROOT / "docs" / "implementation" / "contracts" / "phase-01" / "pages.json"
PROCESS_CATALOG = ROOT / "docs" / "implementation" / "MASTER_PROCESS_CATALOG.json"
OUT_DIR = ROOT / "docs" / "implementation" / "phases" / "PHASE-10"
OUT_JSON = OUT_DIR / "P006_P010_PAGE_TRACE.json"
OUT_MD = OUT_DIR / "P006_P010_PAGE_TRACE.md"
TARGET_CODES = {"P006", "P007", "P008", "P009", "P010"}
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


def source_index() -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    payload = json.loads(PROCESS_CATALOG.read_text(encoding="utf-8"))
    source_to_codes: dict[str, set[str]] = defaultdict(set)
    code_to_sources: dict[str, set[str]] = defaultdict(set)
    for item in payload.get("processes", []):
        if not isinstance(item, dict):
            continue
        code = str(item.get("process_code") or "")
        if code not in TARGET_CODES:
            continue
        portal_sources = item.get("portal_sources")
        if not isinstance(portal_sources, dict):
            continue
        for source in portal_sources.values():
            if not isinstance(source, dict):
                continue
            source_file = str(source.get("source_file") or "")
            if source_file:
                source_to_codes[source_file].add(code)
                code_to_sources[code].add(source_file)
    missing = [code for code in sorted(TARGET_CODES) if not code_to_sources.get(code)]
    if missing:
        raise RuntimeError(f"missing source-file mapping for {missing}")
    return dict(source_to_codes), dict(code_to_sources)


def direct_codes(record: dict[str, Any]) -> set[str]:
    raw = record.get("process_codes")
    if isinstance(raw, list):
        return {str(item) for item in raw if str(item) in TARGET_CODES}
    return set()


def public(record: dict[str, Any]) -> dict[str, Any]:
    return {key: record.get(key) for key in PUBLIC_KEYS if key in record}


def build_payload() -> dict[str, Any]:
    all_pages = records(json.loads(PAGES.read_text(encoding="utf-8")))
    source_to_codes, code_to_sources = source_index()
    matched: list[tuple[dict[str, Any], set[str], str]] = []
    for record in all_pages:
        codes = direct_codes(record)
        source_codes = source_to_codes.get(str(record.get("source_file") or ""), set())
        match_codes = codes | source_codes
        if match_codes:
            method = "process_codes+source_file" if codes and source_codes else ("process_codes" if codes else "source_file")
            matched.append((record, match_codes, method))

    selected = [item[0] for item in matched]
    by_portal = Counter(str(item.get("portal_code")) for item in selected)
    by_status = Counter(str(item.get("status")) for item in selected)
    by_method = Counter(method for _, _, method in matched)
    by_process: dict[str, dict[str, Any]] = {}
    for code in sorted(TARGET_CODES):
        process_pairs = [(record, method) for record, codes, method in matched if code in codes]
        process_pages = [item[0] for item in process_pairs]
        portal_counts = Counter(str(item.get("portal_code")) for item in process_pages)
        status_counts = Counter(str(item.get("status")) for item in process_pages)
        method_counts = Counter(method for _, method in process_pairs)
        missing_route = sum(1 for item in process_pages if not item.get("route_path"))
        missing_permission = sum(1 for item in process_pages if not item.get("permission_code") and not item.get("permission_codes"))
        implemented = [item for item in process_pages if str(item.get("status", "")).upper() == "IMPLEMENTED"]
        by_process[code] = {
            "page_record_count": len(process_pages),
            "portal_counts": dict(sorted(portal_counts.items())),
            "status_counts": dict(sorted(status_counts.items())),
            "match_method_counts": dict(sorted(method_counts.items())),
            "source_files": sorted(code_to_sources[code]),
            "missing_route_path_count": missing_route,
            "missing_permission_count": missing_permission,
            "implemented_record_count": len(implemented),
            "records": [public(item) for item in process_pages],
        }
    return {
        "phase": "PHASE-10",
        "state": "PREPARATION_ONLY_NOT_STARTED",
        "source": "docs/implementation/contracts/phase-01/pages.json",
        "process_source": "docs/implementation/MASTER_PROCESS_CATALOG.json",
        "total_phase01_page_records": len(all_pages),
        "target_process_codes": sorted(TARGET_CODES),
        "matched_page_records": len(selected),
        "portal_counts": dict(sorted(by_portal.items())),
        "status_counts": dict(sorted(by_status.items())),
        "match_method_counts": dict(sorted(by_method.items())),
        "processes": by_process,
        "rules": {
            "source_file_coordinate_match": "AUTHORITATIVE_WHEN_PROCESS_CODES_MISSING",
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
        "# PHASE-10 P006–P010 PAGE TRACE",
        "",
        "> PHASE-01 页面记录未保证 P006–P010 都回填 process_codes；本 trace 用 MASTER_PROCESS_CATALOG 的三端 source_file 做权威来源坐标匹配，并保留已有 process_codes 作附加校验。",
        "> 准备阶段不猜 route/permission，不把 planned 页面提升为 implemented。",
        "",
        "## Result",
        "",
        f"- Total PHASE-01 page records: **{payload['total_phase01_page_records']}**",
        f"- P006–P010 matched page records: **{payload['matched_page_records']}**",
        f"- Match methods: `{json.dumps(payload['match_method_counts'], ensure_ascii=False, sort_keys=True)}`",
        f"- Portal counts: `{json.dumps(payload['portal_counts'], ensure_ascii=False, sort_keys=True)}`",
        f"- Status counts: `{json.dumps(payload['status_counts'], ensure_ascii=False, sort_keys=True)}`",
        "- Route inference: **FORBIDDEN**",
        "- Permission inference: **FORBIDDEN**",
        "",
        "## Per-process trace",
        "",
        "| Process | Pages | Portal counts | Status counts | Match method | Missing route | Missing permission | Implemented |",
        "|---|---:|---|---|---|---:|---:|---:|",
    ]
    for code, info in payload["processes"].items():
        lines.append(
            f"| {code} | {info['page_record_count']} | `{esc(json.dumps(info['portal_counts'], ensure_ascii=False, sort_keys=True))}` | "
            f"`{esc(json.dumps(info['status_counts'], ensure_ascii=False, sort_keys=True))}` | "
            f"`{esc(json.dumps(info['match_method_counts'], ensure_ascii=False, sort_keys=True))}` | {info['missing_route_path_count']} | "
            f"{info['missing_permission_count']} | {info['implemented_record_count']} |"
        )
    lines.extend([
        "",
        "## Opening rule",
        "",
        "正式施工只允许把已经完成真实闭环并具备 implementation_path、真实 Router、服务端权限/API/数据库证据的页面更新为 IMPLEMENTED。",
        "任何当前为空的 route_name/route_path/permission_code 必须回到 Knowledge Base / ADR / 已批准合同确认，禁止按中文标题生成。",
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
        print("PHASE-10 P006-P010 page trace is deterministic and current")
    else:
        write_outputs()
        print("PHASE-10 P006-P010 page trace generated from canonical source coordinates")


if __name__ == "__main__":
    main()
