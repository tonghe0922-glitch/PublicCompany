#!/usr/bin/env python3
"""Independent RESUBMIT-7 scope/immutability probes; reviewer-owned."""
from __future__ import annotations

import importlib.util
import json
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[6]
TEST_PATH = ROOT / "scripts/implementation/phase10_component_source_gate_test.py"
GATE_PATH = ROOT / "scripts/implementation/phase10_component_source_gate.py"


def fixture_module():
    spec = importlib.util.spec_from_file_location("phase10_gate_fixture_r7", TEST_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def record(name: str, expected: set[str], exit_code: int, payload: dict[str, object]) -> dict[str, object]:
    codes = {str(item["code"]) for item in payload["violations"]}  # type: ignore[index]
    return {
        "name": name,
        "source_gate_exit": exit_code,
        "status": payload.get("status"),
        "expected_any": sorted(expected),
        "actual_codes": sorted(codes),
        "fail_open": exit_code == 0 or not (codes & expected),
    }


def main() -> int:
    f = fixture_module()
    results: list[dict[str, object]] = []
    with tempfile.TemporaryDirectory(prefix="reviewer-resubmit7-") as directory:
        repo = Path(directory)
        page = repo / "technical-platform/web/src/platform/pages/P006MeetingPage.vue"
        router = repo / "technical-platform/web/src/router/portal-router.ts"
        service = repo / "technical-platform/backend/modules/attendance/src/main/java/cn/shangjingu/platform/attendance/ShiftChangeService.java"

        # A template descendant script is not an SFC top-level script block.
        f.fixture(repo)
        f.write(
            page,
            "<template><section>"
            "<script type=\"application/json\">import Unsafe from './Safe.vue'</script>"
            "<unsafe/>"
            "</section></template>",
        )
        f.write(page.parent / "Safe.vue", "<template><section>safe</section></template>")
        code, payload = f.run(GATE_PATH, repo)
        results.append(record("template-descendant-script-fake-import",
                              {"COMPONENT_GRAPH_CUSTOM_BINDING_MISSING", "COMPONENT_GRAPH_SFC_SCRIPT_UNSUPPORTED"},
                              code, payload))

        # const does not prove immutability when opaque APIs can mutate the array.
        f.fixture(repo)
        text = router.read_text(encoding="utf-8").replace(
            "export const routes = [",
            "const hiddenRoutes=[]\nObject.assign(hiddenRoutes, loadRoutes())\n"
            "export const routes = [\n...hiddenRoutes,",
        )
        f.write(router, text)
        code, payload = f.run(GATE_PATH, repo)
        results.append(record("const-route-array-opaque-mutation", {"ROUTER_CONTRIBUTOR_OPAQUE"}, code, payload))

        # A nested function's return cannot prove that the spread function returns an array.
        f.fixture(repo)
        text = router.read_text(encoding="utf-8").replace(
            "export const routes = [",
            "function hiddenRoutes(){function nested(){return []}}\n"
            "export const routes = [\n...hiddenRoutes(),",
        )
        f.write(router, text)
        code, payload = f.run(GATE_PATH, repo)
        results.append(record("nested-function-return-substitution", {"ROUTER_CONTRIBUTOR_OPAQUE"}, code, payload))

        # The filename-matching class must be a top-level type, not a nested same-name class.
        f.fixture(repo)
        action_args = ",".join(f'"{item}"' for item in sorted(f.ACTIONS["P007"]))
        f.write(
            service,
            "class Wrapper { static class ShiftChangeService { "
            f"private static final Object ACTIONS=Map.of(\"S01\",Set.of({action_args})); "
            "} }",
        )
        code, payload = f.run(GATE_PATH, repo)
        results.append(record("nested-expected-class-substitution",
                              {"ACTION_CONTRACT_SERVICE_CLASS_MISSING", "ACTION_CONTRACT_DEFINITION_MISSING"},
                              code, payload))

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
