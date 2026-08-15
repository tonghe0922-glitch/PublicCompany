#!/usr/bin/env python3
"""Independent RESUBMIT-11 semantic fail-open probes."""
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


fixture_lib = load("phase10_component_source_gate_test_r11", TESTS)


def run(mutator) -> tuple[int, dict[str, object]]:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        fixture_lib.fixture(root)
        mutator(root)
        return fixture_lib.run(GATE, root)


def options_export_expression_tail(root: Path) -> None:
    pages = root / "technical-platform/web/src/platform/pages"
    fixture_lib.write(pages / "Safe.vue", "<template><section>safe</section></template>")
    fixture_lib.write(pages / "Unsafe.vue", "<template><main>runtime main</main></template>")
    fixture_lib.write(
        pages / "P006MeetingPage.vue",
        """<template><section><registered/></section></template>
<script lang="ts">
import Safe from './Safe.vue'
import Unsafe from './Unsafe.vue'
export default defineComponent({components:{Registered:Safe}}) &&
  defineComponent({components:{Registered:Unsafe}})
</script>""",
    )


def mutate_route(root: Path, declarations: str, insertion: str) -> None:
    router = root / "technical-platform/web/src/router/portal-router.ts"
    text = router.read_text(encoding="utf-8")
    text = declarations + "\n" + text
    text = text.replace(
        "{ path: '/employee/p006', component: P006MeetingPage, meta:",
        "{ path: '/employee/p006', component: P006MeetingPage, " + insertion + ", meta:",
        1,
    )
    fixture_lib.write(router, text)


def mutable_meta_value(root: Path) -> None:
    router = root / "technical-platform/web/src/router/portal-router.ts"
    text = router.read_text(encoding="utf-8")
    text = "let runtimePermission='p006.meeting.read'\n" + text
    text = text.replace(
        "meta: { permission: 'p006.read' }",
        "meta: { permission: runtimePermission }",
        1,
    )
    fixture_lib.write(router, text)


def mutable_props_nested_value(root: Path) -> None:
    mutate_route(root, "let runtimeTenant='other-tenant'", "props:{tenantId:runtimeTenant}")


def mutable_redirect_value(root: Path) -> None:
    mutate_route(root, "let runtimeRedirect='/runtime-target'", "redirect:runtimeRedirect")


probes = {
    "options-export-expression-tail-overrides-safe-object": options_export_expression_tail,
    "meta-nested-mutable-identifier": mutable_meta_value,
    "props-nested-mutable-identifier": mutable_props_nested_value,
    "redirect-mutable-identifier": mutable_redirect_value,
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
    "review_round": "RESUBMIT-11",
    "probe_count": len(results),
    "fail_open_count": sum(bool(item["fail_open"]) for item in results),
    "results": results,
}
rendered = json.dumps(summary, ensure_ascii=False, indent=2)
live = Path(__file__).with_name("reviewer-resubmit11-live")
live.mkdir(parents=True, exist_ok=True)
(live / "variants.json").write_text(rendered + "\n", encoding="utf-8")
print(rendered)
raise SystemExit(1 if summary["fail_open_count"] else 0)
