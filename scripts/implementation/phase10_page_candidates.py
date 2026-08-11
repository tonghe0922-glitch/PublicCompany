#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
PAGES = ROOT / "docs" / "implementation" / "contracts" / "phase-01" / "pages.json"
OUT_DIR = ROOT / "docs" / "implementation" / "phases" / "PHASE-10"
OUT_JSON = OUT_DIR / "P006_P010_PAGE_CANDIDATES.json"
OUT_MD = OUT_DIR / "P006_P010_PAGE_CANDIDATES.md"

KEYWORDS = {
    "P006": ["会议", "议题", "纪要", "行动项"],
    "P007": ["排班", "班次", "换班", "替班"],
    "P008": ["请假", "销假", "假期", "考勤"],
    "P009": ["加班", "调休", "薪酬", "考勤"],
    "P010": ["学习", "考试", "培训", "资格", "认证", "课程"],
}
TECH_CAPABILITY_KEYWORDS = ["流程", "监控", "权限", "审计", "集成", "通知", "任务"]
FIELDS = ("display_name", "level_1", "level_2", "level_3", "aliases", "notes")


def load_pages() -> list[dict[str, Any]]:
    payload = json.loads(PAGES.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise RuntimeError("pages.json must be a list")
    return [item for item in payload if isinstance(item, dict)]


def text(record: dict[str, Any]) -> str:
    values: list[str] = []
    for field in FIELDS:
        value = record.get(field)
        if isinstance(value, list):
            values.extend(str(item) for item in value)
        elif value is not None:
            values.append(str(value))
    return " | ".join(values)


def score(record: dict[str, Any], process: str, portal: str) -> tuple[int, list[str], str]:
    haystack = text(record)
    business_hits = [word for word in KEYWORDS[process] if word in haystack]
    tech_hits = [word for word in TECH_CAPABILITY_KEYWORDS if word in haystack] if portal == "tech" else []
    if business_hits:
        value = len(business_hits) * 10 + len(tech_hits)
        method = "business-keyword"
    elif portal == "tech" and tech_hits:
        value = len(tech_hits)
        method = "tech-capability-fallback"
    else:
        return 0, [], "none"
    if record.get("route_path"):
        value += 2
    if str(record.get("status", "")).upper() == "IMPLEMENTED":
        value += 1
    return value, business_hits + tech_hits, method


def public(record: dict[str, Any], value: int, hits: list[str], method: str) -> dict[str, Any]:
    return {
        "score": value,
        "match_method": method,
        "hits": hits,
        "source_key": record.get("source_key"),
        "source_file": record.get("source_file"),
        "source_sheet": record.get("source_sheet"),
        "source_row": record.get("source_row"),
        "portal_code": record.get("portal_code"),
        "level_1": record.get("level_1"),
        "level_2": record.get("level_2"),
        "level_3": record.get("level_3"),
        "display_name": record.get("display_name"),
        "aliases": record.get("aliases"),
        "route_path": record.get("route_path"),
        "route_name": record.get("route_name"),
        "permission_code": record.get("permission_code"),
        "permission_codes": record.get("permission_codes"),
        "data_scope": record.get("data_scope"),
        "sensitive_level": record.get("sensitive_level"),
        "mobile_access": record.get("mobile_access"),
        "status": record.get("status"),
        "implementation_path": record.get("implementation_path"),
    }


def build_payload() -> dict[str, Any]:
    pages = load_pages()
    result: dict[str, dict[str, Any]] = {}
    for process in sorted(KEYWORDS):
        result[process] = {}
        for portal in ("employee", "center", "tech"):
            candidates: list[dict[str, Any]] = []
            for record in pages:
                if str(record.get("portal_code")) != portal:
                    continue
                value, hits, method = score(record, process, portal)
                if value <= 0:
                    continue
                candidates.append(public(record, value, hits, method))
            candidates.sort(key=lambda item: (-int(item["score"]), str(item.get("route_path") or ""), str(item.get("source_key") or "")))
            result[process][portal] = {
                "keyword_set": KEYWORDS[process],
                "candidate_count": len(candidates),
                "top_candidates": candidates[:100],
            }
    return {
        "phase": "PHASE-10",
        "status": "C0_CANDIDATE_DISCOVERY_ONLY",
        "source": "docs/implementation/contracts/phase-01/pages.json",
        "total_pages": len(pages),
        "rule": "Candidate discovery is not a binding. Employee/Center candidates require business-semantic hits. Tech may also expose generic configuration/monitoring capability candidates because source XLSX assigns Tech configuration/support rather than business ownership. Only explicit reviewed source_key + exact route_path selections may enter PHASE10_PAGE_BINDINGS.json.",
        "processes": result,
    }


def esc(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def build_markdown(payload: dict[str, Any]) -> str:
    lines = [
        "# PHASE-10 P006–P010 PAGE CANDIDATES",
        "",
        "> C0 candidate discovery only. Keyword hits are never runtime fuzzy matching or automatic bindings.",
        "> Employee/Center must hit process business semantics. Tech may list generic workflow/permission/audit/integration monitoring pages because the authoritative XLSX assigns Tech configuration/support responsibilities.",
        "",
    ]
    for process, portals in payload["processes"].items():
        lines.extend([f"## {process}", ""])
        for portal, info in portals.items():
            lines.extend([
                f"### {portal} — candidates {info['candidate_count']}",
                "",
                "| Score | Method | Hits | Source key | Route | L1 | L2 | L3 | Status |",
                "|---:|---|---|---|---|---|---|---|---|",
            ])
            for item in info["top_candidates"][:30]:
                lines.append(
                    f"| {item['score']} | {item['match_method']} | {esc(','.join(item['hits']))} | `{esc(item.get('source_key'))}` | `{esc(item.get('route_path'))}` | "
                    f"{esc(item.get('level_1'))} | {esc(item.get('level_2'))} | {esc(item.get('level_3'))} | {esc(item.get('status'))} |"
                )
            lines.append("")
    return "\n".join(lines) + "\n"


def write_outputs() -> None:
    payload = build_payload()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    OUT_MD.write_text(build_markdown(payload), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    expected = build_payload()
    if args.check:
        if not OUT_JSON.is_file() or not OUT_MD.is_file():
            raise RuntimeError("candidate evidence missing")
        if json.loads(OUT_JSON.read_text(encoding="utf-8")) != expected:
            raise RuntimeError("candidate JSON stale")
        if OUT_MD.read_text(encoding="utf-8") != build_markdown(expected):
            raise RuntimeError("candidate markdown stale")
        print("PHASE-10 page candidate evidence is deterministic and current")
    else:
        write_outputs()
        print("PHASE-10 page candidates generated for explicit C0 review")


if __name__ == "__main__":
    main()
