#!/usr/bin/env python3
"""Independent syntax/authority variants for P10-COMP-00 RESUBMIT-5."""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path


REPO = Path(__file__).resolve().parents[6]
sys.path.insert(0, str(REPO / "scripts" / "implementation"))

from phase10_component_source_gate_test import ACTIONS, fixture, run, write  # noqa: E402


GATE = REPO / "scripts" / "implementation" / "phase10_component_source_gate.py"
P006_PAGE = Path("technical-platform/web/src/platform/pages/P006MeetingPage.vue")
ROUTER = Path("technical-platform/web/src/router/portal-router.ts")
P007_SQL = Path("technical-platform/database/flyway-overlays/oms/V116__phase10_p007_shift_change.sql")
P007_SERVICE = Path(
    "technical-platform/backend/modules/attendance/src/main/java/"
    "cn/shangjingu/platform/attendance/ShiftChangeService.java"
)


def probe(name: str, mutate) -> dict[str, object]:
    with tempfile.TemporaryDirectory(prefix=f"reviewer-r5-{name}-") as directory:
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


def lowercase_single_word_component(root: Path) -> None:
    page = root / P006_PAGE
    write(
        page,
        """<template><section><unsafe/></section></template>
<script setup>import Unsafe from './Unsafe.vue'</script>""",
    )
    write(page.parent / "Unsafe.vue", "<template><main>unexpected main</main></template>")


def external_template_src(root: Path) -> None:
    page = root / P006_PAGE
    write(page, '<template src="./P006MeetingPage.template.html"></template>')
    write(page.parent / "P006MeetingPage.template.html", "<section><main>unexpected external main</main></section>")


def quoted_path_key_extra_route(root: Path) -> None:
    router = root / ROUTER
    text = router.read_text(encoding="utf-8")
    text = text.rsplit("\n]", 1)[0] + (
        ",\n{ 'path': '/employee/quoted-hidden', component: P006MeetingPage, "
        "meta: { permission: 'p006.meeting.read' } }\n]\n"
    )
    write(router, text)


def imported_spread_route_array(root: Path) -> None:
    router = root / ROUTER
    text = router.read_text(encoding="utf-8")
    text = (
        "import { hiddenP006Routes } from './hidden-p006-routes'\n"
        + text.replace("export const routes = [", "export const routes = [\n...hiddenP006Routes,")
    )
    write(router, text)
    write(
        router.parent / "hidden-p006-routes.ts",
        """import P006MeetingPage from '../platform/pages/P006MeetingPage.vue'
export const hiddenP006Routes = [{
  path: '/employee/imported-hidden',
  component: P006MeetingPage,
  meta: { permission: 'p006.meeting.read' },
}]
""",
    )


def local_actions_variable_not_domain_field(root: Path) -> None:
    service = root / P007_SERVICE
    quoted = ",".join(f'"{item}"' for item in sorted(ACTIONS["P007"]))
    write(
        service,
        "class ShiftChangeService { void helper() { "
        f"var ACTIONS=Map.of(\"S01\",Set.of({quoted}));"
        " } }\n",
    )


def unrelated_sql_triple_hides_missing_transition(root: Path) -> None:
    sql = root / P007_SQL
    actions = sorted(ACTIONS["P007"] - {"SUBMIT_DEMAND"})
    tuples = ",\n".join(
        f"(gen_random_uuid(),'tenant',v,'S01','{action}','END',false)" for action in actions
    )
    write(
        sql,
        "INSERT INTO workflow.wf_transition(from_node_code,action_code,to_node_code) VALUES\n"
        + tuples
        + ";\nSELECT audit_event('S01','SUBMIT_DEMAND','END');\n",
    )


def main() -> int:
    probes = [
        probe("lowercase-single-word-component", lowercase_single_word_component),
        probe("external-template-src", external_template_src),
        probe("quoted-path-key-extra-route", quoted_path_key_extra_route),
        probe("imported-spread-route-array", imported_spread_route_array),
        probe("local-actions-variable-not-domain-field", local_actions_variable_not_domain_field),
        probe("unrelated-sql-triple-hides-missing-transition", unrelated_sql_triple_hides_missing_transition),
    ]
    payload = {
        "schema_version": "1.0",
        "gate": "reviewer-p10-comp-00-resubmit5-variants",
        "probe_count": len(probes),
        "fail_open_count": sum(1 for item in probes if item["fail_open"]),
        "probes": probes,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 1 if payload["fail_open_count"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
