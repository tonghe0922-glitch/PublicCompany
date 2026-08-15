#!/usr/bin/env python3
"""Independent RESUBMIT-13 template and route-factory parameter probes."""
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


fixture_lib = load("phase10_component_source_gate_test_r13", TESTS)


def run(mutator) -> tuple[int, dict[str, object]]:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        fixture_lib.fixture(root)
        mutator(root)
        return fixture_lib.run(GATE, root)


def replace_route_factory_body(root: Path, statement: str) -> None:
    router = root / "technical-platform/web/src/router/portal-router.ts"
    text = router.read_text(encoding="utf-8")
    replacement = (
        "function staticPortalRoutes(portal: PortalDefinition){"
        + statement
        + "return[{name:'portal-static',props:{portal}}]}\n"
        + "export const routes = [\n...staticPortalRoutes(employee),"
    )
    text = text.replace("export const routes = [", replacement, 1)
    fixture_lib.write(router, text)


def portal_method_call(root: Path) -> None:
    replace_route_factory_body(root, "portal.normalize();")


def portal_prefix_property_update(root: Path) -> None:
    replace_route_factory_body(root, "++portal.code;")


def portal_property_constructor(root: Path) -> None:
    replace_route_factory_body(root, "new portal.Builder();")


def tagged_dynamic_template(root: Path) -> None:
    router = root / "technical-platform/web/src/router/portal-router.ts"
    text = router.read_text(encoding="utf-8")
    text = "let suffix='meeting.read'; const tag=(v:TemplateStringsArray)=>v[0]\n" + text
    text = text.replace(
        "meta: { permission: 'p006.read' }",
        "meta: { permission: tag`p006.${suffix}` }",
        1,
    )
    fixture_lib.write(router, text)


probes = {
    "portal-method-call": portal_method_call,
    "portal-prefix-property-update": portal_prefix_property_update,
    "portal-property-constructor": portal_property_constructor,
    "tagged-dynamic-template": tagged_dynamic_template,
}

results: list[dict[str, object]] = []
for name, mutator in probes.items():
    exit_code, payload = run(mutator)
    fail_open = exit_code == 0 and payload["status"] == "PASS"
    results.append({
        "probe": name,
        "gate_exit": exit_code,
        "gate_status": payload["status"],
        "finding_codes": sorted({item["code"] for item in payload["violations"]}),
        "fail_open": fail_open,
    })

summary = {
    "schema_version": "1.0",
    "review_round": "RESUBMIT-13",
    "probe_count": len(results),
    "fail_open_count": sum(bool(item["fail_open"]) for item in results),
    "results": results,
}
rendered = json.dumps(summary, ensure_ascii=False, indent=2)
live = Path(__file__).with_name("reviewer-resubmit13-live")
live.mkdir(parents=True, exist_ok=True)
(live / "variants.json").write_text(rendered + "\n", encoding="utf-8")
print(rendered)
raise SystemExit(1 if summary["fail_open_count"] else 0)
