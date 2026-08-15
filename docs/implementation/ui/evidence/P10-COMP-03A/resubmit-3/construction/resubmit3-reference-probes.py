"""Independent-style RESUBMIT-3 Vue factory/reference probes."""
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[7]
SPEC = importlib.util.spec_from_file_location("resubmit3_access_gate", ROOT / "scripts/implementation/ui_component_access_gate.py")
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("cannot load access gate")
GATE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = GATE
SPEC.loader.exec_module(GATE)


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


NEGATIVE = (
    ("callback-object-escape", "DYNAMIC_COMPONENT_UNRESOLVED", "<script setup>const attrs={is:'SgjButton'};[attrs].forEach(x=>x.is='button')</script><template><component v-bind=\"attrs\"/></template>"),
    ("create-vnode", "PROGRAMMATIC_NATIVE_INTERACTIVE", "<script setup>import {createVNode} from 'vue';createVNode('button')</script><template><section/></template>"),
    ("resolve-dynamic", "PROGRAMMATIC_NATIVE_INTERACTIVE", "<script setup>import {resolveDynamicComponent} from 'vue';resolveDynamicComponent('input')</script><template><section/></template>"),
    ("resolve-component", "PROGRAMMATIC_NATIVE_INTERACTIVE", "<script setup>import {resolveComponent} from 'vue';resolveComponent('textarea')</script><template><section/></template>"),
    ("h-alias", "PROGRAMMATIC_NATIVE_INTERACTIVE", "<script setup>import {h} from 'vue';const renderNode=h;renderNode('button')</script><template><section/></template>"),
    ("namespace-optional", "PROGRAMMATIC_NATIVE_INTERACTIVE", "<script setup>import * as Vue from 'vue';Vue?.h?.('button')</script><template><section/></template>"),
    ("namespace-let", "PROGRAMMATIC_COMPONENT_UNRESOLVED", "<script setup>import * as Vue from 'vue';let V=Vue;V.h('button')</script><template><section/></template>"),
    ("namespace-reassign", "PROGRAMMATIC_COMPONENT_UNRESOLVED", "<script setup>import * as Vue from 'vue';const V=Vue;V=getVue();V.h('button')</script><template><section/></template>"),
    ("conditional", "PROGRAMMATIC_COMPONENT_UNRESOLVED", "<script setup>import {h} from 'vue';const x=flag?h:other;x('button')</script><template><section/></template>"),
    ("bind", "PROGRAMMATIC_COMPONENT_UNRESOLVED", "<script setup>import {h} from 'vue';const x=h.bind(null);x('button')</script><template><section/></template>"),
    ("array", "PROGRAMMATIC_COMPONENT_UNRESOLVED", "<script setup>import {h} from 'vue';const xs=[h];xs[0]('button')</script><template><section/></template>"),
    ("argument", "PROGRAMMATIC_COMPONENT_UNRESOLVED", "<script setup>import {h} from 'vue';const call=f=>f('button');call(h)</script><template><section/></template>"),
    ("return", "PROGRAMMATIC_COMPONENT_UNRESOLVED", "<script setup>import {h} from 'vue';const get=()=>h;get()('button')</script><template><section/></template>"),
    ("object", "PROGRAMMATIC_COMPONENT_UNRESOLVED", "<script setup>import {h} from 'vue';const box={h};box.h('button')</script><template><section/></template>"),
    ("sequence", "PROGRAMMATIC_COMPONENT_UNRESOLVED", "<script setup>import {h} from 'vue';const x=(void 0,h);x('button')</script><template><section/></template>"),
    ("logical", "PROGRAMMATIC_COMPONENT_UNRESOLVED", "<script setup>import {h} from 'vue';const x=h||other;x('button')</script><template><section/></template>"),
    ("namespace-argument", "PROGRAMMATIC_COMPONENT_UNRESOLVED", "<script setup>import * as Vue from 'vue';consume(Vue)</script><template><section/></template>"),
    ("namespace-return", "PROGRAMMATIC_COMPONENT_UNRESOLVED", "<script setup>import * as Vue from 'vue';const get=()=>Vue;get().h('button')</script><template><section/></template>"),
)

POSITIVE = (
    ("recursive-alias-component", "<script setup>import {h} from 'vue';import {SgjButton} from '@sgj/ui';const a=h;const b=a;b(SgjButton)</script><template><section/></template>"),
    ("recursive-namespace-component", "<script setup>import * as Vue from 'vue';import {SgjButton} from '@sgj/ui';const V=Vue;const W=V;W.createVNode(SgjButton)</script><template><section/></template>"),
)


def main() -> int:
    results = []
    with tempfile.TemporaryDirectory() as temp:
        base = Path(temp)
        for name, expected, source in NEGATIVE:
            fixture = base / name
            GATE.make_fixture(fixture)
            write(fixture / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", source)
            payload = GATE.scan_repository(fixture)
            codes = sorted({item["code"] for item in payload["findings"]})
            results.append({"name": name, "expected": expected, "status": payload["status"], "codes": codes, "pass": payload["status"] == "FAIL" and expected in codes})
        for name, source in POSITIVE:
            fixture = base / name
            GATE.make_fixture(fixture)
            write(fixture / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", source)
            payload = GATE.scan_repository(fixture)
            results.append({"name": name, "expected": "PASS", "status": payload["status"], "codes": sorted({item["code"] for item in payload["findings"]}), "pass": payload["status"] == "PASS"})
    failures = [item for item in results if not item["pass"]]
    print(json.dumps({"probe_count": len(results), "negative_count": len(NEGATIVE), "positive_count": len(POSITIVE), "failure_count": len(failures), "results": results}, ensure_ascii=False, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
