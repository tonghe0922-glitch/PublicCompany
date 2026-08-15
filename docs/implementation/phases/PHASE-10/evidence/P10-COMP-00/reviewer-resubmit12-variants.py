#!/usr/bin/env python3
"""Independent RESUBMIT-12 dynamic-string and props-binding probes."""
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


fixture_lib = load("phase10_component_source_gate_test_r12", TESTS)


def run(mutator) -> tuple[int, dict[str, object]]:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        fixture_lib.fixture(root)
        mutator(root)
        return fixture_lib.run(GATE, root)


def mutate_p006(root: Path, declaration: str, extra: str, replacement_meta: str | None = None) -> None:
    router = root / "technical-platform/web/src/router/portal-router.ts"
    text = router.read_text(encoding="utf-8")
    if declaration:
        text = declaration + "\n" + text
    marker = "{ path: '/employee/p006', component: P006MeetingPage, meta: { permission: 'p006.read' } }"
    meta = replacement_meta or "meta: { permission: 'p006.read' }"
    replacement = "{ path: '/employee/p006', component: P006MeetingPage, " + extra + meta + " }"
    assert marker in text
    fixture_lib.write(router, text.replace(marker, replacement, 1))


def interpolated_meta_permission(root: Path) -> None:
    mutate_p006(
        root,
        "let permissionSuffix='meeting.read'",
        "",
        "meta:{permission:`p006.${permissionSuffix}`}",
    )


def interpolated_permissions_array(root: Path) -> None:
    mutate_p006(
        root,
        "let permissionSuffix='meeting.read'",
        "",
        "meta:{permissionsAny:[`p006.${permissionSuffix}`]}",
    )


def interpolated_redirect(root: Path) -> None:
    mutate_p006(root, "let target='runtime'", "redirect:`/${target}`, ")


def reassigned_portal_shorthand(root: Path) -> None:
    mutate_p006(
        root,
        "let portal={code:'employee'}; portal={code:'tech'}",
        "props:{portal}, ",
    )


probes = {
    "meta-interpolated-permission": interpolated_meta_permission,
    "meta-interpolated-permissions-array": interpolated_permissions_array,
    "redirect-interpolated-template": interpolated_redirect,
    "props-reassigned-portal-shorthand": reassigned_portal_shorthand,
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
    "review_round": "RESUBMIT-12",
    "probe_count": len(results),
    "fail_open_count": sum(bool(item["fail_open"]) for item in results),
    "results": results,
}
rendered = json.dumps(summary, ensure_ascii=False, indent=2)
live = Path(__file__).with_name("reviewer-resubmit12-live")
live.mkdir(parents=True, exist_ok=True)
(live / "variants.json").write_text(rendered + "\n", encoding="utf-8")
print(rendered)
raise SystemExit(1 if summary["fail_open_count"] else 0)
