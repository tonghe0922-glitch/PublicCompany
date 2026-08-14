#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "docs" / "implementation" / "phases" / "PHASE-11"
OUT_JSON = OUT_DIR / "P011_P016_IMPLEMENTATION_PROBE.json"
OUT_MD = OUT_DIR / "P011_P016_IMPLEMENTATION_PROBE.md"
PROCESS_CATALOG = ROOT / "docs" / "implementation" / "MASTER_PROCESS_CATALOG.json"
TARGET_CODES = ("P011", "P012", "P013", "P014", "P015", "P016")
PHASE10_BASE_SHA = "79edc420802bfb9d2e47a0976b6198a67e80c4c2"
TEXT_SUFFIXES = {
    ".java", ".kt", ".ts", ".tsx", ".vue", ".js", ".mjs", ".cjs",
    ".sql", ".xml", ".json", ".yml", ".yaml", ".properties",
}
ROOTS = {
    "backend_main": (
        ROOT / "technical-platform" / "backend",
    ),
    "web_src": (
        ROOT / "technical-platform" / "web" / "src",
    ),
    "database": (
        ROOT / "technical-platform" / "database",
    ),
    "backend_tests": (
        ROOT / "technical-platform" / "backend",
    ),
    "web_e2e": (
        ROOT / "technical-platform" / "web" / "e2e",
    ),
}


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8-sig", errors="ignore")


def text_files(root: Path) -> list[Path]:
    if not root.exists():
        return []
    return sorted(
        path for path in root.rglob("*")
        if path.is_file() and path.suffix.lower() in TEXT_SUFFIXES
    )


def in_backend_main(path: Path) -> bool:
    text = path.as_posix()
    return "/src/main/" in text


def in_backend_test(path: Path) -> bool:
    text = path.as_posix()
    return "/src/test/" in text


def code_hits(code: str, area: str) -> list[str]:
    hits: list[str] = []
    for root in ROOTS[area]:
        for path in text_files(root):
            if area == "backend_main" and not in_backend_main(path):
                continue
            if area == "backend_tests" and not in_backend_test(path):
                continue
            if re.search(rf"\b{re.escape(code)}\b", read_text(path), re.IGNORECASE):
                hits.append(str(path.relative_to(ROOT)))
    return sorted(set(hits))


def load_mappings() -> dict[str, list[str]]:
    payload = json.loads(PROCESS_CATALOG.read_text(encoding="utf-8"))
    result: dict[str, list[str]] = {}
    for item in payload.get("processes", []):
        if not isinstance(item, dict) or item.get("process_code") not in TARGET_CODES:
            continue
        tables: list[str] = []
        for mapping in item.get("database_mappings", []):
            if not isinstance(mapping, dict):
                continue
            table = str(mapping.get("table") or "")
            schema = str(mapping.get("schema") or "")
            if table and "." not in table and schema:
                table = f"{schema}.{table}"
            if table:
                tables.append(table)
        result[str(item["process_code"])] = tables
    return result


def ddl_files(table: str) -> list[str]:
    schema, name = table.split(".", 1)
    pattern = re.compile(
        rf"create\s+table(?:\s+if\s+not\s+exists)?\s+"
        rf"\"?{re.escape(schema)}\"?\s*\.\s*\"?{re.escape(name)}\"?\b",
        re.IGNORECASE | re.DOTALL,
    )
    hits: list[str] = []
    for path in text_files(ROOT / "technical-platform" / "database"):
        if path.suffix.lower() == ".sql" and pattern.search(read_text(path)):
            hits.append(str(path.relative_to(ROOT)))
    return hits


def changed_production_files() -> list[str]:
    command = [
        "git", "diff", "--name-only", f"{PHASE10_BASE_SHA}...HEAD", "--",
        "technical-platform/backend",
        "technical-platform/web/src",
        "technical-platform/web/e2e",
        "technical-platform/database",
    ]
    result = subprocess.run(
        command,
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return [line for line in result.stdout.splitlines() if line.strip()]


def build_payload() -> dict[str, Any]:
    mappings = load_mappings()
    changed = changed_production_files()
    processes: dict[str, Any] = {}
    for code in TARGET_CODES:
        area_hits = {
            area: code_hits(code, area)
            for area in ("backend_main", "web_src", "database", "backend_tests", "web_e2e")
        }
        tables = [
            {"table": table, "create_table_files": ddl_files(table)}
            for table in mappings.get(code, [])
        ]
        executable_hits = (
            area_hits["backend_main"]
            + area_hits["web_src"]
            + area_hits["backend_tests"]
            + area_hits["web_e2e"]
        )
        canonical_tables_exist = bool(tables) and all(
            item["create_table_files"] for item in tables
        )
        processes[code] = {
            "canonical_tables": tables,
            "canonical_tables_status": (
                "EXISTING_BASELINE_DDL" if canonical_tables_exist else "DDL_GAP"
            ),
            "exact_process_code_hits": area_hits,
            "backend_status": (
                "EXISTING_EXACT_MARKER" if area_hits["backend_main"] else "MISSING"
            ),
            "web_status": (
                "EXISTING_EXACT_MARKER" if area_hits["web_src"] else "MISSING"
            ),
            "test_status": (
                "EXISTING_EXACT_MARKER"
                if area_hits["backend_tests"] or area_hits["web_e2e"]
                else "MISSING"
            ),
            "implementation_status": (
                "EXECUTABLE_MARKER_PRESENT"
                if executable_hits
                else (
                    "BASELINE_TABLE_ONLY"
                    if canonical_tables_exist
                    else "NOT_IMPLEMENTED"
                )
            ),
        }

    if changed:
        raise RuntimeError(
            "PHASE-11 preparation checkpoint modified production code before C0: "
            + ", ".join(changed)
        )
    return {
        "phase": "PHASE-11",
        "state": "PREPARATION_IMPLEMENTATION_PROBE",
        "baseline_sha": PHASE10_BASE_SHA,
        "scope": list(TARGET_CODES),
        "changed_production_files_since_phase10": changed,
        "processes": processes,
        "rules": {
            "table_exists_is_not_implementation": True,
            "exact_process_marker_required_for_existing_claim": True,
            "filename_or_domain_keyword_inference": "FORBIDDEN",
            "production_change_during_preparation": "FORBIDDEN",
        },
    }


def build_markdown(payload: dict[str, Any]) -> str:
    lines = [
        "# PHASE-11 P011–P016 IMPLEMENTATION PROBE",
        "",
        "> Probe baseline: PHASE-10 maintenance HEAD "
        f"`{payload['baseline_sha']}`.",
        "> “主表已存在”只表示数据库基线存在，不等价于 Service、Controller、页面、Workflow 或测试已经实现。",
        "",
        "| Process | Canonical DDL | Backend | Web | Tests | Preparation verdict |",
        "|---|---|---|---|---|---|",
    ]
    for code in TARGET_CODES:
        item = payload["processes"][code]
        lines.append(
            f"| {code} | {item['canonical_tables_status']} | "
            f"{item['backend_status']} | {item['web_status']} | "
            f"{item['test_status']} | **{item['implementation_status']}** |"
        )
    lines.extend([
        "",
        "## Production boundary",
        "",
        f"- Changed production files since baseline: "
        f"**{len(payload['changed_production_files_since_phase10'])}**.",
        "- Preparation is valid only when this value remains zero.",
        "- Exact P011–P016 code markers are evidence candidates only; C0 must still inspect behavior and source trace.",
        "- Domain-keyword or filename similarity is not accepted as implementation evidence.",
        "",
        "Machine evidence: `P011_P016_IMPLEMENTATION_PROBE.json`.",
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
        raise RuntimeError("PHASE-11 implementation probe outputs are missing")
    if json.loads(OUT_JSON.read_text(encoding="utf-8")) != expected:
        raise RuntimeError("P011_P016_IMPLEMENTATION_PROBE.json is stale")
    if OUT_MD.read_text(encoding="utf-8") != build_markdown(expected):
        raise RuntimeError("P011_P016_IMPLEMENTATION_PROBE.md is stale")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check_outputs()
        print("PHASE-11 implementation probe is deterministic and current")
    else:
        write_outputs()
        print("PHASE-11 implementation probe generated")


if __name__ == "__main__":
    main()
