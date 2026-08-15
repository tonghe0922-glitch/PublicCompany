#!/usr/bin/env python3
"""Independent RESUBMIT-9B exposure/route-object probes; reviewer-owned."""
from __future__ import annotations

import importlib.util
import json
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[6]
TEST_PATH = ROOT / "scripts/implementation/phase10_component_source_gate_test.py"
GATE_PATH = ROOT / "scripts/implementation/phase10_component_source_gate.py"


def load_fixture():
    spec = importlib.util.spec_from_file_location("phase10_gate_fixture_r9b", TEST_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def record(name: str, expected: set[str], exit_code: int, payload: dict[str, object]) -> dict[str, object]:
    actual = {str(item["code"]) for item in payload["violations"]}  # type: ignore[index]
    return {
        "name": name,
        "source_gate_exit": exit_code,
        "status": payload.get("status"),
        "expected_any": sorted(expected),
        "actual_codes": sorted(actual),
        "fail_open": exit_code == 0 or not bool(expected & actual),
    }


def main() -> int:
    f = load_fixture()
    results: list[dict[str, object]] = []
    with tempfile.TemporaryDirectory(prefix="reviewer-resubmit9b-") as directory:
        repo = Path(directory)
        page = repo / "technical-platform/web/src/platform/pages/P006MeetingPage.vue"
        router = repo / "technical-platform/web/src/router/portal-router.ts"

        # Imports in a normal script are not template bindings unless Options API exposes them.
        f.fixture(repo)
        f.write(
            page,
            "<template><section><unsafe/></section></template>"
            "<script>import Unsafe from './Safe.vue'; export default {}</script>",
        )
        f.write(page.parent / "Safe.vue", "<template><section>safe</section></template>")
        code, payload = f.run(GATE_PATH, repo)
        results.append(record("normal-script-unregistered-import",
                              {"COMPONENT_GRAPH_CUSTOM_BINDING_MISSING", "COMPONENT_GRAPH_OPTIONS_BINDING_UNRESOLVED"},
                              code, payload))

        # Unsupported script languages must never be lexed as JavaScript bindings.
        f.fixture(repo)
        f.write(
            page,
            "<template><section><unsafe/></section></template>"
            "<script setup lang='coffee'>import Unsafe from './Safe.vue'</script>",
        )
        f.write(page.parent / "Safe.vue", "<template><section>safe</section></template>")
        code, payload = f.run(GATE_PATH, repo)
        results.append(record("unsupported-script-language-import",
                              {"COMPONENT_GRAPH_SFC_STRUCTURE_INVALID", "COMPONENT_GRAPH_SCRIPT_LANGUAGE_UNSUPPORTED"},
                              code, payload))

        # A balanced object is not a proven route object when path/component keys are dynamic.
        f.fixture(repo)
        text = router.read_text(encoding="utf-8").replace(
            "export const routes = [",
            "const routeKey='path', componentKey='component'\n"
            "const hiddenRoutes=[{[routeKey]:'/employee/hidden-p006',"
            "[componentKey]:P006MeetingPage,meta:{permission:'p006.meeting.read'}}]\n"
            "export const routes = [\n...hiddenRoutes,",
        )
        f.write(router, text)
        code, payload = f.run(GATE_PATH, repo)
        results.append(record("dynamic-keys-inside-route-object",
                              {"ROUTER_CONTRIBUTOR_OPAQUE", "ROUTER_PHASE10_PATH_NON_LITERAL"}, code, payload))

        # A contributor must not recursively prove itself as a static spread.
        f.fixture(repo)
        text = router.read_text(encoding="utf-8").replace(
            "export const routes = [",
            "function hiddenRoutes(){return [...hiddenRoutes()]}\n"
            "export const routes = [\n...hiddenRoutes(),",
        )
        f.write(router, text)
        code, payload = f.run(GATE_PATH, repo)
        results.append(record("recursive-route-contributor",
                              {"ROUTER_CONTRIBUTOR_OPAQUE", "ROUTER_CONTRIBUTOR_CYCLE"}, code, payload))

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
