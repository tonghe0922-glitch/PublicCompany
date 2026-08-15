#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[7]
GATE_PATH = REPO / "scripts/implementation/ui_component_access_gate.py"
SPEC = importlib.util.spec_from_file_location("p10_comp_03a_resubmit2_probe", GATE_PATH)
assert SPEC and SPEC.loader
GATE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = GATE
SPEC.loader.exec_module(GATE)


def main() -> int:
    probes = []
    mutations = {
        "nested-fake-export": lambda root: GATE.write(
            root / GATE.DESIGN_INDEX_REL,
            "function fake(){ export { default as SgjButton } from './components/Button.vue' }\n",
        ),
        "fake-test-strings": lambda root: GATE.write(
            root / GATE.ALIAS_TEST_REL,
            "const fake=\"import * as Ui from '@sgj/ui'; test('x',()=>expect(Ui['SgjButton']))\"\n",
        ),
        "object-static-spread-native": lambda root: GATE.write(
            root / "technical-platform/web/src/platform/pages/P006MeetingPage.vue",
            "<script setup>const tag='button';const base={is:tag};const attrs={...base}</script>"
            "<template><component v-bind=\"attrs\" /></template>\n",
        ),
        "object-dynamic-spread": lambda root: GATE.write(
            root / "technical-platform/web/src/platform/pages/P006MeetingPage.vue",
            "<script setup>const attrs=makeAttrs()</script><template><component v-bind=\"attrs\" /></template>\n",
        ),
        "schema-top-level-loosen": lambda root: weaken_schema(root),
    }
    with tempfile.TemporaryDirectory() as temp:
        base = Path(temp)
        for name, mutation in mutations.items():
            root = base / name
            GATE.make_fixture(root)
            mutation(root)
            payload = GATE.scan_repository(root)
            probes.append({"probe": name, "status": payload["status"], "codes": sorted({x["code"] for x in payload["findings"]})})
    print(json.dumps(probes, ensure_ascii=False, indent=2))
    return 0 if all(item["status"] == "FAIL" for item in probes) else 1


def weaken_schema(root: Path) -> None:
    schema = GATE.read_json(root / GATE.SCHEMA_REL)
    schema["additionalProperties"] = True
    GATE.write(root / GATE.SCHEMA_REL, json.dumps(schema, indent=2))


if __name__ == "__main__":
    raise SystemExit(main())
