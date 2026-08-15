#!/usr/bin/env python3
"""Independent RESUBMIT-10 fail-open probes for the PHASE-10 source gate."""
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[6]
GATE_PATH = ROOT / "scripts/implementation/phase10_component_source_gate.py"
TEST_PATH = ROOT / "scripts/implementation/phase10_component_source_gate_test.py"


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


gate = load("phase10_component_source_gate", GATE_PATH)
fixture_lib = load("phase10_component_source_gate_test", TEST_PATH)


def codes(payload: dict[str, object]) -> set[str]:
    return {item["code"] for item in payload["violations"]}


def run_fixture(mutator) -> tuple[int, dict[str, object]]:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        fixture_lib.fixture(root)
        mutator(root)
        return fixture_lib.run(GATE_PATH, root)


def options_registry_mutation(root: Path) -> None:
    pages = root / "technical-platform/web/src/platform/pages"
    fixture_lib.write(pages / "Safe.vue", "<template><section>safe</section></template>")
    fixture_lib.write(pages / "Unsafe.vue", "<template><main>hidden main</main></template>")
    fixture_lib.write(
        pages / "P006MeetingPage.vue",
        """<template><section><registered/></section></template>
<script lang="ts">
import Safe from './Safe.vue'
import Unsafe from './Unsafe.vue'
const registry={Registered:Safe}
Object.assign(registry,{Registered:Unsafe})
export default {components:{...registry}}
</script>""",
    )


def duplicate_path_override(root: Path) -> None:
    router = root / "technical-platform/web/src/router/portal-router.ts"
    text = router.read_text(encoding="utf-8")
    text = text.replace(
        "{ path: '/employee/p006', component: P006MeetingPage, meta:",
        "{ path: '/employee/p006', component: P006MeetingPage, path: '/employee/runtime-hidden-p006', meta:",
        1,
    )
    fixture_lib.write(router, text)


def duplicate_component_override(root: Path) -> None:
    pages = root / "technical-platform/web/src/platform/pages"
    fixture_lib.write(pages / "RuntimeHiddenPage.vue", "<template><main>runtime hidden main</main></template>")
    router = root / "technical-platform/web/src/router/portal-router.ts"
    text = router.read_text(encoding="utf-8")
    text = "import RuntimeHiddenPage from '../platform/pages/RuntimeHiddenPage.vue'\n" + text
    text = text.replace(
        "{ path: '/employee/p006', component: P006MeetingPage, meta:",
        "{ path: '/employee/p006', component: P006MeetingPage, component: RuntimeHiddenPage, meta:",
        1,
    )
    fixture_lib.write(router, text)


def dynamic_route_property(root: Path) -> None:
    router = root / "technical-platform/web/src/router/portal-router.ts"
    text = router.read_text(encoding="utf-8")
    text = text.replace(
        "{ path: '/employee/p006', component: P006MeetingPage, meta:",
        "{ path: '/employee/p006', component: P006MeetingPage, beforeEnter: buildGuard(), meta:",
        1,
    )
    fixture_lib.write(router, text)


probes = {
    "options-registry-mutated-before-export": options_registry_mutation,
    "duplicate-path-runtime-override": duplicate_path_override,
    "duplicate-component-runtime-override": duplicate_component_override,
    "dynamic-route-property-call": dynamic_route_property,
}

results: list[dict[str, object]] = []
for name, mutator in probes.items():
    exit_code, payload = run_fixture(mutator)
    fail_open = exit_code == 0 and payload["status"] == "PASS"
    results.append(
        {
            "probe": name,
            "gate_exit": exit_code,
            "gate_status": payload["status"],
            "finding_codes": sorted(codes(payload)),
            "fail_open": fail_open,
        }
    )

summary = {
    "schema_version": "1.0",
    "review_round": "RESUBMIT-10",
    "probe_count": len(results),
    "fail_open_count": sum(bool(item["fail_open"]) for item in results),
    "results": results,
}
rendered = json.dumps(summary, ensure_ascii=False, indent=2)
live = Path(__file__).with_name("reviewer-resubmit10-live")
live.mkdir(parents=True, exist_ok=True)
(live / "variants.json").write_text(rendered + "\n", encoding="utf-8")
print(rendered)
raise SystemExit(1 if summary["fail_open_count"] else 0)
