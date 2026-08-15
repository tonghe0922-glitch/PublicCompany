#!/usr/bin/env python3
"""Independent RESUBMIT-14 portal parameter use/escape probes."""
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[6]
GATE = ROOT / "scripts/implementation/phase10_component_source_gate.py"
TESTS = ROOT / "scripts/implementation/phase10_component_source_gate_test.py"


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


fixture_lib = load("phase10_component_source_gate_test_r14", TESTS)


def run(statement: str) -> tuple[int, dict[str, object]]:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        fixture_lib.fixture(root)
        router = root / "technical-platform/web/src/router/portal-router.ts"
        source = router.read_text(encoding="utf-8")
        replacement = (
            "function staticPortalRoutes(portal: PortalDefinition){"
            + statement
            + "return[{name:'portal-static',props:{portal}}]}\n"
            + "export const routes = [\n...staticPortalRoutes(employee),"
        )
        source = source.replace("export const routes = [", replacement, 1)
        fixture_lib.write(router, source)
        return fixture_lib.run(GATE, root)


negative_probes = {
    "computed-code-read": "const code=portal['code'];void code;",
    "optional-code-read": "const code=portal?.code;void code;",
    "code-member-call": "portal.code();",
    "code-member-chain": "const size=portal.code.length;void size;",
    "compound-assignment": "portal.code += '';",
    "object-spread-escape": "const clone={...portal};void clone;",
    "reflect-get-escape": "Reflect.get(portal,'code');",
    "object-keys-escape": "Object.keys(portal);",
}

results: list[dict[str, object]] = []
for name, statement in negative_probes.items():
    exit_code, payload = run(statement)
    fail_open = exit_code == 0 and payload["status"] == "PASS"
    results.append({
        "probe": name,
        "expected": "FAIL",
        "gate_exit": exit_code,
        "gate_status": payload["status"],
        "finding_codes": sorted({item["code"] for item in payload["violations"]}),
        "fail_open": fail_open,
    })

positive_exit, positive_payload = run("if(portal.code==='employee'){void 0;}")
positive_failed = positive_exit != 0 or positive_payload["status"] != "PASS"
results.append({
    "probe": "readonly-dot-code-guard",
    "expected": "PASS",
    "gate_exit": positive_exit,
    "gate_status": positive_payload["status"],
    "finding_codes": sorted({item["code"] for item in positive_payload["violations"]}),
    "fail_open": positive_failed,
})

summary = {
    "schema_version": "1.0",
    "review_round": "RESUBMIT-14",
    "probe_count": len(results),
    "fail_open_count": sum(bool(item["fail_open"]) for item in results),
    "results": results,
}
rendered = json.dumps(summary, ensure_ascii=False, indent=2)
live = Path(__file__).with_name("reviewer-resubmit14-live")
live.mkdir(parents=True, exist_ok=True)
(live / "variants.json").write_text(rendered + "\n", encoding="utf-8")
print(rendered)
raise SystemExit(1 if summary["fail_open_count"] else 0)
