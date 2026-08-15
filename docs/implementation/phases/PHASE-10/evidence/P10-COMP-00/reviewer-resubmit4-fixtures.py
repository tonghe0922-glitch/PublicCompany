#!/usr/bin/env python3
"""Independent fail-open probes for P10-COMP-00 RESUBMIT-4."""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path


REPO = Path(__file__).resolve().parents[6]
sys.path.insert(0, str(REPO / "scripts" / "implementation"))

from phase10_component_source_gate_test import ACTIONS, fixture, run, write  # noqa: E402


GATE = REPO / "scripts" / "implementation" / "phase10_component_source_gate.py"
PAGE_RELATIVE = Path("technical-platform/web/src/platform/pages/P006MeetingPage.vue")
LAYOUT_RELATIVE = Path("technical-platform/web/src/platform/AuthenticatedPortalLayout.vue")
ROUTER_RELATIVE = Path("technical-platform/web/src/router/portal-router.ts")
P007_SERVICE_RELATIVE = Path(
    "technical-platform/backend/modules/attendance/src/main/java/"
    "cn/shangjingu/platform/attendance/ShiftChangeService.java"
)


def probe(name: str, mutate) -> dict[str, object]:
    with tempfile.TemporaryDirectory(prefix=f"reviewer-{name}-") as directory:
        root = Path(directory)
        fixture(root)
        mutate(root)
        exit_code, payload = run(GATE, root)
        return {
            "name": name,
            "exit_code": exit_code,
            "status": payload["status"],
            "violation_count": payload["violation_count"],
            "codes": sorted({str(item["code"]) for item in payload["violations"]}),
            "fail_open": exit_code == 0 and payload["status"] == "PASS",
        }


def nested_template_then_main(root: Path) -> None:
    page = root / PAGE_RELATIVE
    write(
        page,
        """<template><section><template v-if=\"ready\"><span>safe</span></template><UnsafeLandmark/></section></template>
<script setup>import UnsafeLandmark from './UnsafeLandmark.vue'</script>""",
    )
    write(page.parent / "UnsafeLandmark.vue", "<template><main>unexpected main</main></template>")


def kebab_case_component_main(root: Path) -> None:
    page = root / PAGE_RELATIVE
    write(
        page,
        """<template><section><unsafe-landmark/></section></template>
<script setup>import UnsafeLandmark from './UnsafeLandmark.vue'</script>""",
    )
    write(page.parent / "UnsafeLandmark.vue", "<template><main>unexpected main</main></template>")


def dynamic_component_main(root: Path) -> None:
    page = root / PAGE_RELATIVE
    write(
        page,
        """<template><section><component :is=\"UnsafeLandmark\"/></section></template>
<script setup>import UnsafeLandmark from './UnsafeLandmark.vue'</script>""",
    )
    write(page.parent / "UnsafeLandmark.vue", "<template><main>unexpected main</main></template>")


def nested_layout_slot_then_main(root: Path) -> None:
    layout = root / LAYOUT_RELATIVE
    write(
        layout,
        """<template><ShellFrame><template #header><span>safe</span></template><UnsafeLandmark/></ShellFrame></template>
<script setup>import { ShellFrame } from './layout-barrel'; import UnsafeLandmark from './UnsafeLandmark.vue'</script>""",
    )
    write(layout.parent / "UnsafeLandmark.vue", "<template><main>unexpected main</main></template>")


def computed_unbound_phase10_route(root: Path) -> None:
    router = root / ROUTER_RELATIVE
    text = router.read_text(encoding="utf-8")
    text = text.replace("export const routes = [", "const hiddenPhase10Path = '/employee/hidden-p006'\nexport const routes = [")
    text = text.rsplit("\n]", 1)[0] + (
        ",\n{ path: hiddenPhase10Path, component: P006MeetingPage, "
        "meta: { permission: 'p006.meeting.read' } }\n]\n"
    )
    write(router, text)


def commented_fake_actions_hide_real_mismatch(root: Path) -> None:
    service = root / P007_SERVICE_RELATIVE
    text = service.read_text(encoding="utf-8")
    text = text.replace('"SUBMIT_DEMAND"', '"ACTUAL_ONLY"')
    quoted = ",".join(f'"{item}"' for item in sorted(ACTIONS["P007"]))
    text = f"// ACTIONS=Map.of(\"S01\",Set.of({quoted})); fake comment\n" + text
    write(service, text)


def main() -> int:
    probes = [
        probe("nested-template-then-main", nested_template_then_main),
        probe("kebab-case-component-main", kebab_case_component_main),
        probe("dynamic-component-main", dynamic_component_main),
        probe("nested-layout-slot-then-main", nested_layout_slot_then_main),
        probe("computed-unbound-phase10-route", computed_unbound_phase10_route),
        probe("commented-fake-actions-hide-real-mismatch", commented_fake_actions_hide_real_mismatch),
    ]
    payload = {
        "schema_version": "1.0",
        "gate": "reviewer-p10-comp-00-resubmit4-fail-open-probes",
        "probe_count": len(probes),
        "fail_open_count": sum(1 for item in probes if item["fail_open"]),
        "probes": probes,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 1 if payload["fail_open_count"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
