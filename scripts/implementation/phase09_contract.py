#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PHASE = ROOT / "docs/implementation/phases/PHASE-09"
CONTRACT = ROOT / "docs/implementation/contracts/phase-09/PHASE09_HTTP_PERMISSION_CONTRACT.md"
ADR = ROOT / "docs/implementation/contracts/phase-09/ADR-PHASE09-001-P001-MFA-TOTP.md"
PAGES = ROOT / "docs/implementation/contracts/phase-01/pages.json"
BINDINGS = PHASE / "PHASE09_PAGE_BINDINGS.json"
PROGRESS = ROOT / "docs/implementation/MASTER_PROGRESS.md"

REQUIRED = {
    "P001": {"employee", "center", "tech"},
    "P002": {"employee", "center", "tech"},
    "P003": {"employee", "center", "tech"},
    "P004": {"employee", "center", "tech"},
    "P005": {"employee", "center", "tech"},
}


def load_pages() -> dict[str, dict[str, object]]:
    data = json.loads(PAGES.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise RuntimeError("pages.json must be a list")
    result: dict[str, dict[str, object]] = {}
    for item in data:
        if isinstance(item, dict) and isinstance(item.get("source_key"), str):
            result[item["source_key"]] = item
    return result


def verify() -> None:
    for path in (
        PHASE / "P001_P005_SOURCE_SNAPSHOT.json",
        PHASE / "SOURCE_CONTRACT.md",
        PHASE / "IMPACT_MATRIX.md",
        PHASE / "GAP_MATRIX.md",
        BINDINGS,
        CONTRACT,
        ADR,
    ):
        if not path.is_file() or path.stat().st_size == 0:
            raise RuntimeError(f"required C0 artifact missing: {path.relative_to(ROOT)}")

    snapshot = json.loads((PHASE / "P001_P005_SOURCE_SNAPSHOT.json").read_text(encoding="utf-8"))
    if snapshot.get("process_codes") != ["P001", "P002", "P003", "P004", "P005"]:
        raise RuntimeError("source snapshot process codes drifted")
    if snapshot.get("workbook_count") != 15 or snapshot.get("parse_failures") != 0:
        raise RuntimeError("15-XLSX source snapshot is incomplete")

    pages = load_pages()
    data = json.loads(BINDINGS.read_text(encoding="utf-8"))
    bindings = data.get("bindings")
    if not isinstance(bindings, list):
        raise RuntimeError("page bindings must be a list")
    covered: dict[str, set[str]] = {key: set() for key in REQUIRED}
    for binding in bindings:
        if not isinstance(binding, dict):
            raise RuntimeError("invalid page binding")
        process = str(binding.get("process_code", ""))
        portal = str(binding.get("portal", ""))
        source_key = str(binding.get("source_key", ""))
        route = str(binding.get("route_path", ""))
        if process not in REQUIRED or portal not in REQUIRED[process]:
            raise RuntimeError(f"out-of-scope binding: {process}/{portal}")
        page = pages.get(source_key)
        if page is None:
            raise RuntimeError(f"binding source key not found: {source_key}")
        if str(page.get("portal_code")) != portal:
            raise RuntimeError(f"portal mismatch for {source_key}")
        if str(page.get("route_path")) != route:
            raise RuntimeError(f"route mismatch for {source_key}")
        covered[process].add(portal)
    for process, portals in REQUIRED.items():
        if covered[process] != portals:
            raise RuntimeError(f"missing portal binding for {process}: {covered[process]}")

    contract = CONTRACT.read_text(encoding="utf-8")
    for process in REQUIRED:
        if f"/api/v1/processes/{process}/" not in contract and process != "P001":
            raise RuntimeError(f"HTTP contract missing process namespace: {process}")
    if "mfaCode" not in contract or "Idempotency-Key" not in contract:
        raise RuntimeError("C0 HTTP safety contract incomplete")

    progress = PROGRESS.read_text(encoding="utf-8")
    if "| PHASE-08 | COMPLETE |" not in progress:
        raise RuntimeError("PHASE-08 must remain COMPLETE")
    if not re.search(r"\| PHASE-09 \| (IN_PROGRESS|READY_FOR_GATE|COMPLETE) \|", progress):
        raise RuntimeError("PHASE-09 must be in a valid formal construction state")
    if "| PHASE-10 | NOT_STARTED |" not in progress:
        raise RuntimeError("PHASE-10 must remain NOT_STARTED")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    verify()
    print("PHASE-09 C0 source/page/API/MFA contract is frozen and current")


if __name__ == "__main__":
    main()
