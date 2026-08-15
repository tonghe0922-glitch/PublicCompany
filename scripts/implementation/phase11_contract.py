#!/usr/bin/env python3
"""Verify the sealed PHASE-11 preparation and page-binding machine contract."""
from __future__ import annotations

import ast
import hashlib
import json
import re
from pathlib import Path
from typing import Any

import phase10_contract

ROOT = Path(__file__).resolve().parents[2]
CONTRACT_DIR = ROOT / "docs/implementation/contracts/phase-01"
PHASE_DIR = ROOT / "docs/implementation/phases/PHASE-11"
SNAPSHOT = PHASE_DIR / "P011_P016_SOURCE_SNAPSHOT.json"
SNAPSHOT_MD = PHASE_DIR / "P011_P016_SOURCE_SNAPSHOT.md"
BINDINGS = PHASE_DIR / "PHASE11_PAGE_BINDINGS.json"
PAGES = CONTRACT_DIR / "pages.json"
API_RECORDS = CONTRACT_DIR / "api_records.jsonl"
SUMMARY = CONTRACT_DIR / "summary.json"
PHASE01_GENERATOR = ROOT / "scripts/knowledge_base/phase01_parse.py"
ROUTER_DIR = ROOT / "technical-platform/web/src/router"
EXPECTED_CODES = [f"P{value:03d}" for value in range(11, 17)]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical_sha(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def phase01_write_targets() -> set[tuple[str, str]]:
    tree = ast.parse(PHASE01_GENERATOR.read_text(encoding="utf-8"), filename=str(PHASE01_GENERATOR))
    targets: set[tuple[str, str]] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Name) or not node.args:
            continue
        destination = node.args[0]
        if (node.func.id in {"jwrite", "jlwrite"}
                and isinstance(destination, ast.BinOp) and isinstance(destination.op, ast.Div)
                and isinstance(destination.right, ast.Constant) and isinstance(destination.right.value, str)):
            targets.add((node.func.id, destination.right.value))
    return targets


def composed_route_paths() -> set[str]:
    paths: set[str] = set()
    for name in ("core-routes.ts", "phase09-routes.ts", "phase10-routes.ts", "phase11-routes.ts", "navigation-source.ts"):
        text = (ROUTER_DIR / name).read_text(encoding="utf-8")
        paths.update(re.findall(r"['\"](/(?:employee|center|tech)/[^'\"]+)['\"]", text))

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                if key == "routePath" and isinstance(child, str):
                    paths.add(child)
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(load_json(ROUTER_DIR / "generated/portal-ia-navigation.json"))
    return paths


def verify_phase01_chain() -> dict[str, dict[str, Any]]:
    summary = load_json(SUMMARY)
    page_records = load_json(PAGES)
    require(isinstance(page_records, list), "pages.json must be a list")
    require(summary["pages"]["records"] == 7126 == len(page_records), "PHASE-01 pages count drifted")
    require(summary["api_records"] == 0, "PHASE-01 explicit API count drifted")
    require(API_RECORDS.read_bytes() == b"", "zero-record api_records.jsonl is not exactly empty")
    targets = phase01_write_targets()
    require(("jwrite", "pages.json") in targets, "PHASE-01 generator does not own pages.json")
    require(("jlwrite", "api_records.jsonl") in targets, "PHASE-01 generator does not own api_records.jsonl")
    pages: dict[str, dict[str, Any]] = {}
    for record in page_records:
        require(isinstance(record, dict) and isinstance(record.get("source_key"), str),
                "page record lacks source_key")
        key = record["source_key"]
        require(key not in pages, f"duplicate page source_key: {key}")
        pages[key] = record
    return pages


def verify_snapshot(phase11_extract: Any) -> None:
    expected = phase11_extract.extract.build_payload()
    actual = load_json(SNAPSHOT)
    require(actual == expected, "PHASE-11 snapshot JSON is stale")
    require(SNAPSHOT_MD.read_text(encoding="utf-8") == phase11_extract.extract.build_markdown(expected),
            "PHASE-11 snapshot markdown is stale")
    require(actual["process_codes"] == EXPECTED_CODES, "snapshot scope must be exactly P011-P016")
    require((actual["workbook_count"], actual["sheet_count"], actual["nonempty_row_count"],
             actual["parse_failures"]) == (18, 108, 5655, 0), "PHASE-11 workbook facts drifted")
    require(actual.get("generated") is True and actual.get("do_not_edit") is True,
            "snapshot generation markers are missing")
    require(actual.get("generator") == "scripts/implementation/phase11_preparation_extract.py",
            "snapshot generator identity drifted")
    require(actual.get("content_sha256") == canonical_sha(actual.get("content")),
            "snapshot content SHA is not recomputable")
    machine = actual.get("machine_contract")
    require(isinstance(machine, dict), "snapshot provenance is missing")
    require(machine.get("pages_sha256") == sha256(PAGES), "pages provenance SHA drifted")
    require(machine.get("api_records_sha256") == sha256(API_RECORDS), "API provenance SHA drifted")
    require(machine.get("phase01_generator_sha256") == sha256(PHASE01_GENERATOR),
            "PHASE-01 generator provenance SHA drifted")
    encoded = json.dumps(actual, ensure_ascii=False)
    require(not any(f"P{value:03d}" in encoded for value in range(17, 127)), "P017+ leaked into snapshot")


def verify_bindings(pages: dict[str, dict[str, Any]]) -> None:
    ledger = load_json(BINDINGS)
    bindings = ledger.get("bindings")
    multi_process = ledger.get("multi_process_bindings")
    require(isinstance(bindings, list) and len(bindings) == 31, "PHASE-11 requires 31 explicit bindings")
    require({item.get("process_code") for item in bindings} == set(EXPECTED_CODES),
            "bindings must cover exactly P011-P016")
    require(isinstance(multi_process, list) and len(multi_process) == 1,
            "Phase 11 must explicitly declare one multi-process source binding")
    shared = multi_process[0]
    require(shared.get("source_key") == "2-2中心全层级页面.xlsx:三级页面明细:R338:15e6269002de",
            "shared supervision source key drifted")
    require(shared.get("portal") == "center" and shared.get("route_path") == "/center/06/03/09",
            "shared supervision route coordinate drifted")
    require(shared.get("process_codes") == ["P014", "P016"],
            "shared supervision process set must be exactly P014/P016")
    require(shared.get("component") == "Phase11DisciplineCareSupervisionPage",
            "shared supervision component identity drifted")
    require((ROOT / "technical-platform/web/src/platform/pages/Phase11DisciplineCareSupervisionPage.vue").is_file(),
            "shared supervision component is missing")
    shared_rows = [item for item in bindings
                   if item.get("source_key") == shared.get("source_key")
                   and item.get("portal") == shared.get("portal")
                   and item.get("route_path") == shared.get("route_path")]
    require([item.get("process_code") for item in shared_rows] == shared.get("process_codes"),
            "shared descriptor and process binding rows disagree")
    routes = composed_route_paths()
    coordinates: set[tuple[str, str, str]] = set()
    for binding in bindings:
        code = str(binding.get("process_code", ""))
        portal = str(binding.get("portal", ""))
        key = str(binding.get("source_key", ""))
        route = str(binding.get("route_path", ""))
        require(code in EXPECTED_CODES and portal in {"employee", "center", "tech"},
                f"out-of-scope binding: {code}/{portal}")
        require(key in pages, f"unknown binding source_key: {key}")
        page = pages[key]
        require(page.get("portal_code") == portal and page.get("route_path") == route,
                f"binding/page drift: {code}/{portal}/{key}")
        require(route.startswith(f"/{portal}/") and route in routes,
                f"binding route absent from composed authority: {route}")
        coordinate = (code, portal, route)
        require(coordinate not in coordinates, f"duplicate binding coordinate: {coordinate}")
        coordinates.add(coordinate)
    encoded = json.dumps(ledger, ensure_ascii=False)
    require(not any(f"P{value:03d}" in encoded for value in range(17, 127)), "P017+ leaked into bindings")


def verify() -> None:
    for path in (SNAPSHOT, SNAPSHOT_MD, BINDINGS, PAGES, API_RECORDS, SUMMARY, PHASE01_GENERATOR):
        require(path.is_file(), f"required contract artifact is missing: {path.relative_to(ROOT)}")
    phase10_contract.verify("sealed-regression")
    import phase11_preparation_extract as phase11_extract
    pages = verify_phase01_chain()
    verify_snapshot(phase11_extract)
    verify_bindings(pages)


def main() -> None:
    verify()
    print("PHASE-11 P011-P016 source/page snapshot contract is deterministic and current")


if __name__ == "__main__":
    main()
