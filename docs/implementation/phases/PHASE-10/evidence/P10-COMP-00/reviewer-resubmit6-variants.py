#!/usr/bin/env python3
"""Independent RESUBMIT-6 fail-closed probes; reviewer-owned evidence."""
from __future__ import annotations

import importlib.util
import json
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[6]
TEST_PATH = ROOT / "scripts/implementation/phase10_component_source_gate_test.py"
GATE_PATH = ROOT / "scripts/implementation/phase10_component_source_gate.py"


def load_fixture_module():
    spec = importlib.util.spec_from_file_location("phase10_gate_fixture", TEST_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def result(name: str, expected_codes: set[str], code: int, payload: dict[str, object]) -> dict[str, object]:
    actual = {str(item["code"]) for item in payload["violations"]}  # type: ignore[index]
    return {
        "name": name,
        "exit": code,
        "status": payload.get("status"),
        "expected_any": sorted(expected_codes),
        "actual_codes": sorted(actual),
        "fail_open": code == 0 or not (expected_codes & actual),
    }


def main() -> int:
    fixture = load_fixture_module()
    results: list[dict[str, object]] = []
    with tempfile.TemporaryDirectory(prefix="reviewer-resubmit6-") as directory:
        repo = Path(directory)
        page = repo / "technical-platform/web/src/platform/pages/P006MeetingPage.vue"
        router = repo / "technical-platform/web/src/router/portal-router.ts"
        service = repo / "technical-platform/backend/modules/attendance/src/main/java/cn/shangjingu/platform/attendance/ShiftChangeService.java"

        # Import-shaped text in script strings/comments is not a real SFC binding.
        fixture.fixture(repo)
        fixture.write(
            page,
            "<template><section><unsafe/></section></template>"
            "<script setup>const note=\"import Unsafe from './Safe.vue'\";</script>",
        )
        fixture.write(page.parent / "Safe.vue", "<template><section>safe</section></template>")
        code, payload = fixture.run(GATE_PATH, repo)
        results.append(result("script-string-fake-import", {"COMPONENT_GRAPH_CUSTOM_BINDING_MISSING"}, code, payload))

        # A locally declared opaque spread is a route contributor and must not be silently skipped.
        fixture.fixture(repo)
        text = router.read_text(encoding="utf-8")
        text = text.replace(
            "export const routes = [",
            "const hiddenRoutes = buildRoutes('p006.meeting.read')\nexport const routes = [\n...hiddenRoutes,",
        )
        fixture.write(router, text)
        code, payload = fixture.run(GATE_PATH, repo)
        results.append(result("opaque-local-route-spread", {"ROUTER_CONTRIBUTOR_OPAQUE", "ROUTER_CONTRIBUTOR_UNRESOLVED"}, code, payload))

        # ACTIONS in a sibling top-level helper class cannot satisfy ShiftChangeService's contract.
        fixture.fixture(repo)
        action_args = ",".join(f'"{item}"' for item in sorted(fixture.ACTIONS["P007"]))
        fixture.write(
            service,
            "class ShiftChangeService {}\n"
            f"class Helper {{ private static final Object ACTIONS=Map.of(\"S01\",Set.of({action_args})); }}\n",
        )
        code, payload = fixture.run(GATE_PATH, repo)
        results.append(result("sibling-top-level-actions", {"ACTION_CONTRACT_DEFINITION_MISSING", "ACTION_CONTRACT_NON_FIELD_ASSIGNMENT"}, code, payload))

    summary = {
        "schema_version": "1.0",
        "probe_count": len(results),
        "fail_open_count": sum(bool(item["fail_open"]) for item in results),
        "results": results,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 1 if summary["fail_open_count"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
