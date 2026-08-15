"""Local, non-temp reproduction for the six RESUBMIT-3 factory/escape probes."""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[7]
GATE_PATH = ROOT / "scripts/implementation/ui_component_access_gate.py"
SPEC = importlib.util.spec_from_file_location("access_gate", GATE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("cannot load access Gate")
GATE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = GATE
SPEC.loader.exec_module(GATE)


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def main() -> int:
    base = Path(__file__).with_name("manual-p1-fixtures")
    cases = (
        ("callback-escape", "DYNAMIC_COMPONENT_UNRESOLVED", "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<script setup>const attrs={is:'SgjButton'};[attrs].forEach(x=>x.is='button')</script><template><component v-bind=\"attrs\" /></template>"),
        ("create-vnode", "PROGRAMMATIC_NATIVE_INTERACTIVE", "technical-platform/web/src/platform/widgets/Factory.ts", "import { createVNode } from 'vue';export const node=()=>createVNode('button')"),
        ("resolve-dynamic", "PROGRAMMATIC_NATIVE_INTERACTIVE", "technical-platform/web/src/platform/widgets/Factory.ts", "import { resolveDynamicComponent } from 'vue';export const node=()=>resolveDynamicComponent('input')"),
        ("resolve-component", "PROGRAMMATIC_NATIVE_INTERACTIVE", "technical-platform/web/src/platform/widgets/Factory.ts", "import { resolveComponent } from 'vue';export const node=()=>resolveComponent('textarea')"),
        ("h-alias", "PROGRAMMATIC_NATIVE_INTERACTIVE", "technical-platform/web/src/platform/widgets/Factory.ts", "import { h } from 'vue';const renderNode=h;export const node=()=>renderNode('button')"),
        ("require-resolve", "DEEP_COMPONENT_IMPORT", "technical-platform/web/src/platform/widgets/Factory.js", "const Button=require.resolve('../../design-system/components/Button.vue');void Button"),
    )
    probes = []
    for name, expected, relative, source in cases:
        fixture = base / name
        GATE.make_fixture(fixture)
        write(fixture / relative, source)
        payload = GATE.scan_repository(fixture)
        codes = sorted({finding["code"] for finding in payload["findings"]})
        probes.append({"name": name, "expected": expected, "status": payload["status"], "codes": codes})
    failures = [probe for probe in probes if probe["status"] == "PASS" or probe["expected"] not in probe["codes"]]
    print(json.dumps({"probe_count": len(probes), "fail_open_count": len(failures), "probes": probes}, ensure_ascii=False, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
