#!/usr/bin/env python3
"""Independent RESUBMIT-8 malformed/escape/scope probes; reviewer-owned."""
from __future__ import annotations

import importlib.util
import json
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[6]
TEST_PATH = ROOT / "scripts/implementation/phase10_component_source_gate_test.py"
GATE_PATH = ROOT / "scripts/implementation/phase10_component_source_gate.py"


def load_fixture():
    spec = importlib.util.spec_from_file_location("phase10_gate_fixture_r8", TEST_PATH)
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
    with tempfile.TemporaryDirectory(prefix="reviewer-resubmit8-") as directory:
        repo = Path(directory)
        page = repo / "technical-platform/web/src/platform/pages/P006MeetingPage.vue"
        router = repo / "technical-platform/web/src/router/portal-router.ts"

        # Vue SFC permits at most one script and one script-setup block.
        f.fixture(repo)
        f.write(
            page,
            "<template><section><unsafe/></section></template>"
            "<script setup>import Unsafe from './Safe.vue'</script>"
            "<script setup>const duplicate=true</script>",
        )
        f.write(page.parent / "Safe.vue", "<template><section>safe</section></template>")
        code, payload = f.run(GATE_PATH, repo)
        results.append(record("duplicate-top-level-script-setup",
                              {"COMPONENT_GRAPH_SFC_STRUCTURE_INVALID"}, code, payload))

        # A function contributor binding is mutable unless reassignment is rejected.
        f.fixture(repo)
        text = router.read_text(encoding="utf-8").replace(
            "export const routes = [",
            "function hiddenRoutes(){return []}\nhiddenRoutes=buildRoutes\n"
            "export const routes = [\n...hiddenRoutes(),",
        )
        f.write(router, text)
        code, payload = f.run(GATE_PATH, repo)
        results.append(record("function-contributor-reassigned", {"ROUTER_CONTRIBUTOR_OPAQUE"}, code, payload))

        # A quoted nested object method owns its return; the outer function has no return.
        f.fixture(repo)
        text = router.read_text(encoding="utf-8").replace(
            "export const routes = [",
            "function hiddenRoutes(){const holder={'nested'(){return []}}}\n"
            "export const routes = [\n...hiddenRoutes(),",
        )
        f.write(router, text)
        code, payload = f.run(GATE_PATH, repo)
        results.append(record("quoted-nested-method-return-substitution",
                              {"ROUTER_CONTRIBUTOR_OPAQUE"}, code, payload))

        # Spreading route objects into an unknown call leaks mutable object references.
        f.fixture(repo)
        text = router.read_text(encoding="utf-8").replace(
            "export const routes = [",
            "const hiddenRoutes=[{}]\nmutate(...hiddenRoutes)\n"
            "export const routes = [\n...hiddenRoutes,",
        )
        f.write(router, text)
        code, payload = f.run(GATE_PATH, repo)
        results.append(record("const-route-elements-escape-via-call",
                              {"ROUTER_CONTRIBUTOR_OPAQUE"}, code, payload))

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
