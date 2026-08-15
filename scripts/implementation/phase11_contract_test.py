#!/usr/bin/env python3
"""Executable CXR-02 contract regression tests (stdlib only, read-only)."""
from __future__ import annotations

import hashlib
import importlib.util
import ast
import json
import locale
import re
import subprocess
import sys
from types import SimpleNamespace
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[2]
EXPECTED_CODES = [f"P{value:03d}" for value in range(11, 17)]
CONTRACT_DIR = ROOT / "docs/implementation/contracts/phase-01"
P10_DIR = ROOT / "docs/implementation/phases/PHASE-10"
P11_DIR = ROOT / "docs/implementation/phases/PHASE-11"
P11_SNAPSHOT = P11_DIR / "P011_P016_SOURCE_SNAPSHOT.json"
P11_SNAPSHOT_MD = P11_DIR / "P011_P016_SOURCE_SNAPSHOT.md"
P11_BINDINGS = P11_DIR / "PHASE11_PAGE_BINDINGS.json"
PAGES = CONTRACT_DIR / "pages.json"
API_RECORDS = CONTRACT_DIR / "api_records.jsonl"
SUMMARY = CONTRACT_DIR / "summary.json"
PHASE01_GENERATOR = ROOT / "scripts/knowledge_base/phase01_parse.py"
ROUTER_DIR = ROOT / "technical-platform/web/src/router"

MACHINE_FILES = [
    API_RECORDS,
    PAGES,
    P10_DIR / "P006_P010_SOURCE_SNAPSHOT.json",
    P10_DIR / "P006_P010_SOURCE_SNAPSHOT.md",
    P10_DIR / "PHASE10_PAGE_BINDINGS.json",
    P11_SNAPSHOT,
    P11_SNAPSHOT_MD,
    P11_BINDINGS,
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical_sha(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def decode_process_bytes(data: bytes) -> tuple[str, str]:
    if not data:
        return "", "utf-8"
    try:
        return data.decode("utf-8", errors="strict"), "utf-8"
    except UnicodeDecodeError:
        encoding = locale.getpreferredencoding(False)
        try:
            return data.decode(encoding, errors="strict"), encoding
        except UnicodeDecodeError:
            return f"<undecodable bytes sha256={hashlib.sha256(data).hexdigest()} hex={data.hex()}>", "binary-hex"


def run(command: list[str]) -> SimpleNamespace:
    completed = subprocess.run(command, cwd=ROOT, capture_output=True)
    stdout, stdout_encoding = decode_process_bytes(completed.stdout)
    stderr, stderr_encoding = decode_process_bytes(completed.stderr)
    return SimpleNamespace(
        returncode=completed.returncode,
        stdout=stdout,
        stderr=stderr,
        stdout_encoding=stdout_encoding,
        stderr_encoding=stderr_encoding,
    )


def load_module(path: Path, name: str) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    require(spec is not None and spec.loader is not None, f"cannot import {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_phase11_source_facts() -> None:
    payload = load_json(P11_SNAPSHOT)
    require(payload["phase"] == "PHASE-11", "snapshot phase mismatch")
    require(payload["process_codes"] == EXPECTED_CODES, "snapshot must contain exactly P011-P016")
    require(payload["process_count"] == 6, "process count must be 6")
    require(payload["workbook_count"] == 18, "workbook count must be 18")
    require(payload["sheet_count"] == 108, "sheet count must be 108")
    require(payload["nonempty_row_count"] == 5655, "non-empty row count must be 5655")
    require(payload["parse_failures"] == 0, "parse failures must be zero")
    require(payload["raw_workbook_count"] == 18 and payload["cached_workbook_count"] == 0,
            "all 18 workbooks must be raw parsed")
    encoded = json.dumps(payload, ensure_ascii=False)
    require(not any(f"P{value:03d}" in encoded for value in range(17, 127)), "P017+ leaked into snapshot")


def test_generated_snapshot_identity() -> None:
    payload = load_json(P11_SNAPSHOT)
    require(payload.get("generated") is True, "snapshot must be marked generated")
    require(payload.get("do_not_edit") is True, "snapshot must be marked do-not-edit")
    require(payload.get("generator") == "scripts/implementation/phase11_preparation_extract.py",
            "snapshot generator identity mismatch")
    content = payload.get("content")
    require(isinstance(content, dict), "snapshot must carry a canonical content envelope")
    require(payload.get("content_sha256") == canonical_sha(content), "snapshot content SHA is not recomputable")
    provenance = payload.get("machine_contract")
    require(isinstance(provenance, dict), "snapshot must record machine-contract provenance")
    require(provenance.get("pages_sha256") == sha256(PAGES), "pages SHA provenance mismatch")
    require(provenance.get("api_records_sha256") == sha256(API_RECORDS), "API SHA provenance mismatch")
    require(provenance.get("phase01_generator_sha256") == sha256(PHASE01_GENERATOR),
            "PHASE-01 generator SHA provenance mismatch")
    markdown = P11_SNAPSHOT_MD.read_text(encoding="utf-8")
    require("GENERATED" in markdown and "DO NOT EDIT" in markdown, "snapshot markdown lacks generated warning")
    require(payload["content_sha256"] in markdown, "snapshot markdown lacks content SHA")


def test_phase01_machine_contract_chain() -> None:
    summary = load_json(SUMMARY)
    pages = load_json(PAGES)
    require(summary["pages"]["records"] == 7126 == len(pages), "pages count must be generated 7126")
    require(summary["api_records"] == 0, "authoritative parser must report zero explicit API records")
    require(API_RECORDS.read_bytes() == b"", "zero-record API JSONL must be exactly empty")
    require(sha256(API_RECORDS) == hashlib.sha256(b"").hexdigest(), "empty API SHA mismatch")
    tree = ast.parse(PHASE01_GENERATOR.read_text(encoding="utf-8"), filename=str(PHASE01_GENERATOR))
    writes: set[tuple[str, str]] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Name) or not node.args:
            continue
        if node.func.id not in {"jwrite", "jlwrite"}:
            continue
        destination = node.args[0]
        if (isinstance(destination, ast.BinOp) and isinstance(destination.op, ast.Div)
                and isinstance(destination.right, ast.Constant) and isinstance(destination.right.value, str)):
            writes.add((node.func.id, destination.right.value))
    require(("jwrite", "pages.json") in writes, "PHASE-01 generator AST must write pages.json")
    require(("jlwrite", "api_records.jsonl") in writes,
            "PHASE-01 generator AST must write api_records.jsonl")
    source_keys = [record.get("source_key") for record in pages]
    require(all(isinstance(key, str) and key for key in source_keys), "pages source_key must be non-empty")
    require(len(source_keys) == len(set(source_keys)), "pages source_key must be unique")


def test_bindings_and_router() -> None:
    ledger = load_json(P11_BINDINGS)
    bindings = ledger["bindings"]
    multi_process = ledger.get("multi_process_bindings")
    pages = {record["source_key"]: record for record in load_json(PAGES)}
    route_sources = [
        ROUTER_DIR / "core-routes.ts",
        ROUTER_DIR / "phase09-routes.ts",
        ROUTER_DIR / "phase10-routes.ts",
        ROUTER_DIR / "navigation-source.ts",
    ]
    authoritative_paths: set[str] = set()
    for source in route_sources:
        text = source.read_text(encoding="utf-8")
        authoritative_paths.update(re.findall(r"['\"](/(?:employee|center|tech)/[^'\"]+)['\"]", text))
    navigation = load_json(ROUTER_DIR / "generated/portal-ia-navigation.json")
    def collect_route_paths(value: Any) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                if key == "routePath" and isinstance(child, str):
                    authoritative_paths.add(child)
                collect_route_paths(child)
        elif isinstance(value, list):
            for child in value:
                collect_route_paths(child)
    collect_route_paths(navigation)
    require(len(bindings) == 31, "Phase 11 must have exactly 31 explicit bindings")
    require({binding["process_code"] for binding in bindings} == set(EXPECTED_CODES),
            "bindings must cover exactly P011-P016")
    require(len({(binding["process_code"], binding["portal"], binding["route_path"])
                 for binding in bindings}) == 31, "binding coordinates must be unique")
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
    shared_rows = [binding for binding in bindings
                   if binding["source_key"] == shared["source_key"]
                   and binding["portal"] == shared["portal"]
                   and binding["route_path"] == shared["route_path"]]
    require([binding["process_code"] for binding in shared_rows] == shared["process_codes"],
            "shared descriptor and process binding rows disagree")
    for binding in bindings:
        require(binding["source_key"] in pages, f"unknown source_key: {binding['source_key']}")
        page = pages[binding["source_key"]]
        require(page["portal_code"] == binding["portal"], f"portal mismatch: {binding['source_key']}")
        require(page["route_path"] == binding["route_path"], f"route mismatch: {binding['source_key']}")
        require(binding["route_path"].startswith(f"/{binding['portal']}/"),
                f"route portal prefix mismatch: {binding['route_path']}")
        require(binding["route_path"] in authoritative_paths,
                f"route absent from composed router authority: {binding['route_path']}")
    encoded = json.dumps(ledger, ensure_ascii=False)
    require(not any(f"P{value:03d}" in encoded for value in range(17, 127)), "P017+ leaked into bindings")


def test_check_mode_zero_write_and_acceptance() -> None:
    before = {str(path): sha256(path) for path in MACHINE_FILES}
    commands = [
        [sys.executable, "scripts/implementation/phase10_preparation_extract.py", "--check"],
        [sys.executable, "scripts/implementation/phase10_contract.py", "--mode", "sealed-regression"],
        [sys.executable, "scripts/implementation/phase11_preparation_extract.py", "--check"],
        [sys.executable, "scripts/implementation/phase11_contract.py"],
    ]
    failures: list[str] = []
    for command in commands:
        result = run(command)
        if result.returncode != 0:
            failures.append(f"{' '.join(command[1:])}: exit {result.returncode}: {(result.stderr or result.stdout).strip()}")
    after = {str(path): sha256(path) for path in MACHINE_FILES}
    require(before == after, "--check/contract acceptance commands modified machine contracts")
    require(not failures, "acceptance command failures:\n" + "\n".join(failures))


def test_phase10_modes() -> None:
    contract = load_module(ROOT / "scripts/implementation/phase10_contract.py", "cxr02_phase10_contract")
    verifier = getattr(contract, "verify_phase_lifecycle", None)
    require(callable(verifier), "phase10_contract must expose verify_phase_lifecycle")
    verifier("construction", "NOT_STARTED")
    verifier("sealed-regression", "CONSTRUCTION_COMPLETE")
    try:
        verifier("construction", "CONSTRUCTION_COMPLETE")
    except (AssertionError, ValueError):
        pass
    else:
        raise AssertionError("construction mode accepted an already-started Phase 11")


def main() -> int:
    tests: list[tuple[str, Callable[[], None]]] = [
        ("phase11-source-facts", test_phase11_source_facts),
        ("generated-snapshot-identity", test_generated_snapshot_identity),
        ("phase01-machine-contract-chain", test_phase01_machine_contract_chain),
        ("bindings-and-router", test_bindings_and_router),
        ("check-mode-zero-write-and-acceptance", test_check_mode_zero_write_and_acceptance),
        ("phase10-modes", test_phase10_modes),
    ]
    failures: list[str] = []
    for name, test in tests:
        try:
            test()
            print(f"PASS {name}")
        except Exception as exc:  # an executable harness must report every independent lock
            failures.append(f"{name}: {type(exc).__name__}: {exc}")
            print(f"FAIL {failures[-1]}")
    print(f"RESULT tests={len(tests)} failures={len(failures)}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
