#!/usr/bin/env python3
"""Independent adversarial probes for P10-COMP-03A RESUBMIT-1."""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
from pathlib import Path


REPO = Path(__file__).resolve().parents[4]
GATE_PATH = REPO / "scripts/implementation/ui_component_access_gate.py"
SPEC = importlib.util.spec_from_file_location("ui_component_access_gate_resubmit1", GATE_PATH)
assert SPEC and SPEC.loader
GATE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = GATE
SPEC.loader.exec_module(GATE)


def commented_barrel(root: Path) -> None:
    GATE.write(
        root / GATE.DESIGN_INDEX_REL,
        "// export { default as SgjButton } from './components/Button.vue'\n"
        "// export { default as SgjFormPageTemplate } from './templates/FormPageTemplate.vue'\n",
    )


def string_only_barrel(root: Path) -> None:
    GATE.write(
        root / GATE.DESIGN_INDEX_REL,
        "const fake = \"export { default as SgjButton } from './components/Button.vue'\"\n"
        "const fake2 = \"export { default as SgjFormPageTemplate } from './templates/FormPageTemplate.vue'\"\n",
    )


def comment_only_access_test(root: Path) -> None:
    GATE.write(root / GATE.ALIAS_TEST_REL, "// 'SgjButton' 'SgjFormPageTemplate' -- no executable test\n")


def source_file_as_required_test(root: Path) -> None:
    registry = GATE.read_json(root / GATE.REGISTRY_REL)
    registry["components"][0]["required_tests"] = [
        "technical-platform/web/src/design-system/components/Button.vue"
    ]
    GATE.write(root / GATE.REGISTRY_REL, json.dumps(registry, indent=2))


def object_bound_native_component(root: Path) -> None:
    GATE.write(
        root / "technical-platform/web/src/platform/pages/P006MeetingPage.vue",
        "<script setup lang=\"ts\">const tag = 'button'</script>"
        "<template><component v-bind=\"{ is: tag }\">bad</component></template>\n",
    )


def weaken_page_type_enum(root: Path) -> None:
    schema = GATE.read_json(root / GATE.SCHEMA_REL)
    schema["properties"]["page_type"].pop("enum")
    GATE.write(root / GATE.SCHEMA_REL, json.dumps(schema, indent=2))


def weaken_component_map(root: Path) -> None:
    schema = GATE.read_json(root / GATE.SCHEMA_REL)
    schema["$defs"]["componentMap"] = {"type": "object"}
    GATE.write(root / GATE.SCHEMA_REL, json.dumps(schema, indent=2))


PROBES = {
    "commented-barrel": commented_barrel,
    "string-only-barrel": string_only_barrel,
    "comment-only-access-test": comment_only_access_test,
    "source-file-as-required-test": source_file_as_required_test,
    "object-bound-native-component": object_bound_native_component,
    "weaken-page-type-enum": weaken_page_type_enum,
    "weaken-component-map": weaken_component_map,
}


def main() -> int:
    results = []
    with tempfile.TemporaryDirectory() as temp:
        base = Path(temp)
        clean = base / "clean"
        GATE.make_fixture(clean)
        clean_payload = GATE.scan_repository(clean)
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
        "clean_status": clean_payload["status"],
        "probe_count": len(results),
        "fail_open_count": sum(item["fail_open"] for item in results),
        "results": results,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 1 if clean_payload["status"] != "PASS" or output["fail_open_count"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
