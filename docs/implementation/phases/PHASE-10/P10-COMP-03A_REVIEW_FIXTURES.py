#!/usr/bin/env python3
"""Independent fail-open probes for the P10-COMP-03A UI access gate."""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
from pathlib import Path


REPO = Path(__file__).resolve().parents[4]
GATE_PATH = REPO / "scripts/implementation/ui_component_access_gate.py"
SPEC = importlib.util.spec_from_file_location("ui_component_access_gate", GATE_PATH)
assert SPEC and SPEC.loader
GATE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = GATE
SPEC.loader.exec_module(GATE)


def mutate_unregistered_platform_component(root: Path) -> None:
    GATE.write(
        root / "technical-platform/web/src/platform/processes/shared/NewComposite.vue",
        "<template><section>new shared composite</section></template>\n",
    )


def mutate_schema_required_gap(root: Path) -> None:
    path = root / GATE.SCHEMA_REL
    payload = GATE.read_json(path)
    payload["required"].remove("source_facts")
    payload["required"].remove("responsive_projection")
    GATE.write(path, json.dumps(payload, indent=2))


def mutate_plan_shape(root: Path) -> None:
    path = root / GATE.PLANS_REL / "P006MeetingPage.ui-plan.json"
    payload = GATE.read_json(path)
    payload["field_component_map"] = "not-an-array"
    payload["state_component_map"] = None
    payload["action_component_map"] = {}
    payload["process_codes"] = "P006"
    payload["gaps"] = "none"
    payload["decision"] = 42
    GATE.write(path, json.dumps(payload, indent=2))


def mutate_unknown_registry_status(root: Path) -> None:
    path = root / GATE.REGISTRY_REL
    payload = GATE.read_json(path)
    button = payload["components"][0]
    button["status"] = "invented-status"
    button["public"] = False
    button["public_import"] = None
    button["export_name"] = None
    button["required_tests"] = []
    GATE.write(path, json.dumps(payload, indent=2))


def mutate_dynamic_native_control(root: Path) -> None:
    GATE.write(
        root / "technical-platform/web/src/platform/pages/P006MeetingPage.vue",
        "<script setup lang=\"ts\">const tag = 'button'</script>"
        "<template><component :is=\"tag\">bad</component></template>\n",
    )


def mutate_nonliteral_deep_import(root: Path) -> None:
    GATE.write(
        root / "technical-platform/web/src/platform/pages/P006MeetingPage.vue",
        "<script setup lang=\"ts\">"
        "const source = '../../design-system/components/Button.vue'; "
        "const load = () => import(source)"
        "</script><template><section>bad import</section></template>\n",
    )


PROBES = {
    "unregistered-platform-component": mutate_unregistered_platform_component,
    "schema-required-gap": mutate_schema_required_gap,
    "malformed-plan-shape": mutate_plan_shape,
    "unknown-registry-status": mutate_unknown_registry_status,
    "dynamic-native-control": mutate_dynamic_native_control,
    "nonliteral-deep-import": mutate_nonliteral_deep_import,
}


def main() -> int:
    results = []
    with tempfile.TemporaryDirectory() as temp:
        base = Path(temp)
        for name, mutate in PROBES.items():
            root = base / name
            GATE.make_fixture(root)
            mutate(root)
            payload = GATE.scan_repository(root)
            results.append(
                {
                    "probe": name,
                    "gate_status": payload["status"],
                    "error_count": payload["error_count"],
                    "codes": sorted({finding["code"] for finding in payload["findings"]}),
                    "fail_open": payload["status"] == "PASS",
                }
            )
    output = {
        "probe_count": len(results),
        "fail_open_count": sum(item["fail_open"] for item in results),
        "results": results,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 1 if output["fail_open_count"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
