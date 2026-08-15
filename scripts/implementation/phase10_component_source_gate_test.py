#!/usr/bin/env python3
"""Executable positive and fail-closed fixtures for the PHASE-10 source gate."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

PAGES = {
    "P006": ("/employee/p006", "P006MeetingPage"),
    "P007": ("/employee/p007", "P007SchedulePage"),
    "P008": ("/employee/p008", "P008LeavePage"),
    "P009": ("/employee/p009", "P009OvertimePage"),
    "P010": ("/employee/p010", "P010LearningPage"),
}
EXTRA_ROUTES = (
    ("P006", "/center/p006", "P006MeetingPage"),  # same component, multiple authoritative routes
    ("P006", "/tech/workflow-monitor", "Phase10TechMonitorPage"),
    ("P009", "/tech/attendance-monitor", "Phase10AttendanceMonitorPage"),
)
P007_REQUIRED = {"CONFIRM", "LINK", "MATCH_TEMPLATE", "NO_CHANGE", "REQUEST_CHANGE", "SUBMIT_DEMAND"}
ACTIONS = {
    "P006": {"PUBLISH", "SUBMIT"},
    "P007": P007_REQUIRED | {"APPROVE"},
    "P008": {"CONFIRM_HANDOVER", "DEDUCT"},
    "P009": {"HR_CONFIRM", "RECORD_FACT"},
    "P010": {"CERTIFY", "SUBMIT_EXAM"},
}


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def contract_paths(process: str) -> tuple[str, str]:
    return {
        "P006": ("V115__phase10_p006_meeting_action.sql", "collaboration/MeetingService.java"),
        "P007": ("V116__phase10_p007_shift_change.sql", "attendance/ShiftChangeService.java"),
        "P008": ("V117__phase10_p008_leave_quota.sql", "attendance/LeaveService.java"),
        "P009": ("V118__phase10_p009_overtime_flow.sql", "attendance/OvertimeService.java"),
        "P010": ("V119__phase10_p010_learning_qualification_flow.sql", "learning/LearningAssignmentService.java"),
    }[process]


def write_contracts(root: Path) -> None:
    module_roots = {
        "collaboration": "cn/shangjingu/platform/collaboration",
        "attendance": "cn/shangjingu/platform/attendance",
        "learning": "cn/shangjingu/platform/learning",
    }
    for process, actions in ACTIONS.items():
        sql_name, service_short = contract_paths(process)
        tuples = ",\n".join(
            f"('S01','{action}','END')" for action in sorted(actions)
        )
        write(root / "technical-platform/database/flyway-overlays/oms" / sql_name,
              "-- ('S01','COMMENT_ONLY','END') must not become a transition\n"
              "/* ('S01','BLOCK_COMMENT_ONLY','END') */\n"
              "INSERT INTO workflow.wf_transition(from_node_code,action_code,to_node_code) VALUES\n" + tuples + ";\n")
        module, service_name = service_short.split("/")
        action_args = ",".join(f'\"{action}\"' for action in sorted(actions))
        java = (f'// ACTIONS=Map.of(\"S01\",Set.of(\"COMMENT_ONLY\"));\n'
                f'/* ACTIONS=Map.of(\"S01\",Set.of(\"BLOCK_COMMENT_ONLY\")); */\n'
                f'class {service_name[:-5]} {{ String fake=\"ACTIONS=Map.of STRING_ONLY\"; '
                f'private static final Map<String,Set<String>> ACTIONS=Map.of(\"S01\",Set.of({action_args})); }}\n')
        write(root / f"technical-platform/backend/modules/{module}/src/main/java" / module_roots[module] / service_name, java)


def write_router_and_bindings(root: Path, *, lazy_p007: bool = True, duplicate_p007: bool = False,
                              extra_unbound: bool = False) -> None:
    imports = ["import AuthenticatedPortalLayout from '../platform/AuthenticatedPortalLayout.vue'"]
    route_lines = ["{ path: '/', component: AuthenticatedPortalLayout, children: [] }"]
    bindings: list[dict[str, str]] = []
    all_routes = [(process, path, component) for process, (path, component) in PAGES.items()] + list(EXTRA_ROUTES)
    for process, path, component in all_routes:
        if component == "P007SchedulePage" and lazy_p007:
            route_lines.append(f"{{ path: '{path}', component: () => import('../platform/pages/{component}.vue'), meta: {{ permission: 'p007.schedule.read' }} }}")
        else:
            imports.append(f"import {component} from '../platform/pages/{component}.vue'")
            route_lines.append(f"{{ path: '{path}', component: {component}, meta: {{ permission: '{process.lower()}.read' }} }}")
        bindings.append({"process_code": process, "route_path": path})
    if duplicate_p007:
        route_lines.append("{ path: '/employee/p007', component: () => import('../platform/pages/P007SchedulePage.vue'), meta: { permission: 'p007.schedule.read' } }")
    if extra_unbound:
        route_lines.append("{ path: '/employee/unbound', component: P006MeetingPage }")
    router = "\n".join(dict.fromkeys(imports)) + "\nexport const routes = [\n" + ",\n".join(route_lines) + "\n]\n"
    write(root / "technical-platform/web/src/router/portal-router.ts", router)
    write(root / "docs/implementation/phases/PHASE-10/PHASE10_PAGE_BINDINGS.json",
          json.dumps({"bindings": bindings}, ensure_ascii=False))


def fixture(root: Path, unsafe: bool = False) -> None:
    write_contracts(root)
    write_router_and_bindings(root)
    pages = root / "technical-platform/web/src/platform/pages"
    components = {component for _, component in PAGES.values()} | {item[2] for item in EXTRA_ROUTES}
    safe = "<template><section>safe</section></template>"
    bad = """<template><main><Phase99NestedPage/><AliasWidget v-if=\"ready\"/><input/><select/><textarea/><button>x</button><table/><dialog/></main></template>
<script setup lang=\"ts\">import { NestedWidget as AliasWidget } from './widgets'
// @ts-ignore
session.request('/api/x'); const permission='p007.schedule.read'; const transitions=['SUBMIT_DEMAND']; const computedActions=computed(()=>['MATCH_TEMPLATE']); const actionMap={CONFIRM: true}; submit('REQUEST_CHANGE'); JSON.stringify([]); const rows: unknown[]=[]</script>"""
    for component in components:
        write(pages / f"{component}.vue", bad if unsafe else safe)
    write(pages / "widgets/index.ts", "export { NestedWidget } from './middle'\n")
    write(pages / "widgets/middle.ts", "export { default as NestedWidget } from './NestedWidget.vue'\n")
    write(pages / "widgets/NestedWidget.vue", "<template><main v-if=\"true\">nested</main></template>")
    write(root / "technical-platform/web/src/platform/AuthenticatedPortalLayout.vue",
          "<template><ShellFrame><slot/></ShellFrame></template><script setup>import { ShellFrame } from './layout-barrel'</script>")
    write(root / "technical-platform/web/src/platform/layout-barrel/index.ts",
          "export { default as ShellFrame } from './ShellFrame.vue'\n")
    write(root / "technical-platform/web/src/platform/layout-barrel/ShellFrame.vue",
          "<template><main><slot/></main></template>")


def write_public_alias_graph(root: Path, paths: dict[str, list[str]] | None = None) -> None:
    aliases = paths if paths is not None else {
        "@sgj/ui": ["src/design-system/index.ts"],
        "@sgj/platform-ui": ["src/platform/processes/shared/index.ts"],
    }
    write(root / "technical-platform/web/tsconfig.app.json",
          json.dumps({"compilerOptions": {"paths": aliases}}, ensure_ascii=False))
    write(root / "technical-platform/web/src/design-system/index.ts",
          "export { default as SgjPortalShell } from './layout/PortalShell.vue'\n")
    write(root / "technical-platform/web/src/design-system/layout/PortalShell.vue",
          "<template><main><slot/></main></template>\n")
    write(root / "technical-platform/web/src/platform/processes/shared/index.ts",
          "export { default as Phase10PublicRouteFeature } from './monitoring/Phase10PublicRouteFeature.vue'\n")
    write(root / "technical-platform/web/src/platform/processes/shared/monitoring/Phase10PublicRouteFeature.vue",
          "<template><section>public process feature</section></template>\n")
    write(root / "technical-platform/web/src/platform/AuthenticatedPortalLayout.vue",
          "<template><SgjPortalShell><slot/></SgjPortalShell></template>"
          "<script setup>import { SgjPortalShell } from '@sgj/ui'</script>\n")
    write(root / "technical-platform/web/src/platform/pages/P006MeetingPage.vue",
          "<template><Phase10PublicRouteFeature/></template>"
          "<script setup>import { Phase10PublicRouteFeature } from '@sgj/platform-ui'</script>\n")


def run(gate: Path, root: Path) -> tuple[int, dict[str, object]]:
    process = subprocess.run([sys.executable, str(gate), "--repo-root", str(root)], capture_output=True,
                             text=True, encoding="utf-8", errors="replace", check=False)
    if not process.stdout.strip():
        raise AssertionError(process.stderr)
    return process.returncode, json.loads(process.stdout)


def codes(payload: dict[str, object]) -> set[str]:
    return {str(item["code"]) for item in payload["violations"]}  # type: ignore[index]


def main() -> int:
    gate = Path(__file__).with_name("phase10_component_source_gate.py")
    with tempfile.TemporaryDirectory(prefix="phase10-source-gate-") as directory:
        root = Path(directory)
        fixture(root)
        code, payload = run(gate, root)
        assert code == 0 and payload["status"] == "PASS", payload
        discovered = set(payload["discovered_route_pages"])
        assert "technical-platform/web/src/platform/pages/P007SchedulePage.vue" in discovered
        assert "technical-platform/web/src/platform/pages/Phase10TechMonitorPage.vue" in discovered
        assert P007_REQUIRED <= set(payload["derived_action_codes"]), payload["derived_action_codes"]

        # All source categories plus named-alias -> two-level barrel -> child-main graph.
        fixture(root, unsafe=True)
        code, payload = run(gate, root)
        assert code == 1 and payload["status"] == "FAIL", payload
        expected = {"SESSION_REQUEST", "API_PATH", "JSON_DUMP", "UNKNOWN_ARRAY", "TYPE_BYPASS",
                    "RAW_INPUT", "RAW_SELECT", "RAW_TEXTAREA", "RAW_BUTTON", "RAW_TABLE", "RAW_DIALOG",
                    "PAGE_NESTING", "BARE_PERMISSION", "BARE_ACTION", "PAGE_MAIN",
                    "NESTED_COMPONENT_MAIN", "ROUTE_MAIN_COUNT"}
        assert expected <= codes(payload), codes(payload)
        assert sum(1 for item in payload["violations"] if item["code"] == "BARE_ACTION") >= 4

        # The actual lazy router target cannot be bypassed by safe decoy filenames.
        fixture(root)
        write(root / "technical-platform/web/src/platform/pages/P007SchedulePage.vue",
              "<template><section><button>unsafe</button></section></template>")
        write(root / "technical-platform/web/src/platform/pages/P007ShiftPage.vue",
              "<template><section>decoy</section></template>")
        code, payload = run(gate, root)
        assert code == 1 and any(item["code"] == "RAW_BUTTON" and item["path"].endswith("P007SchedulePage.vue")
                                  for item in payload["violations"]), payload

        # Duplicate and out-of-authority route bindings fail closed.
        fixture(root)
        write_router_and_bindings(root, duplicate_p007=True, extra_unbound=True)
        code, payload = run(gate, root)
        assert code == 1
        assert {"ROUTER_BINDING_DUPLICATE", "ROUTER_PHASE10_PATH_OUT_OF_BINDINGS"} <= codes(payload), payload

        # A nested slot/template must not truncate the remaining root template.
        fixture(root)
        page = root / "technical-platform/web/src/platform/pages/P006MeetingPage.vue"
        write(page, '<template><section><template v-if="ready"><span>safe</span></template><UnsafeLandmark/></section></template><script setup>import UnsafeLandmark from \'./UnsafeLandmark.vue\'</script>')
        write(page.parent / "UnsafeLandmark.vue", "<template><main>unexpected main</main></template>")
        code, payload = run(gate, root)
        assert code == 1 and {"NESTED_COMPONENT_MAIN", "ROUTE_MAIN_COUNT"} <= codes(payload), payload

        # Vue kebab-case and static dynamic-component bindings resolve to the imported child.
        fixture(root)
        write(page, '<template><section><unsafe-landmark/></section></template><script setup>import UnsafeLandmark from \'./UnsafeLandmark.vue\'</script>')
        write(page.parent / "UnsafeLandmark.vue", "<template><main>unexpected main</main></template>")
        code, payload = run(gate, root)
        assert code == 1 and "NESTED_COMPONENT_MAIN" in codes(payload), payload
        write(page, '<template><section><component :is="UnsafeLandmark"/></section></template><script setup>import UnsafeLandmark from \'./UnsafeLandmark.vue\'</script>')
        code, payload = run(gate, root)
        assert code == 1 and "NESTED_COMPONENT_MAIN" in codes(payload), payload
        write(page, '<template><section><component :is="runtimeChoice"/></section></template><script setup>const runtimeChoice=ref(null)</script>')
        code, payload = run(gate, root)
        assert code == 1 and "COMPONENT_GRAPH_DYNAMIC_IS_UNRESOLVED" in codes(payload), payload

        # Lowercase single-word custom components resolve through imports; Vue builtins remain allowed.
        fixture(root)
        write(page, '<template><section><unsafe/></section></template><script setup>import Unsafe from \'./Unsafe.vue\'</script>')
        write(page.parent / "Unsafe.vue", "<template><main>unexpected main</main></template>")
        code, payload = run(gate, root)
        assert code == 1 and "NESTED_COMPONENT_MAIN" in codes(payload), payload
        write(page, '<template><Transition><section>safe</section></Transition></template>')
        code, payload = run(gate, root)
        assert code == 0 and payload["status"] == "PASS", payload

        # Import-shaped comments/strings/template literals/regex are not SFC bindings.
        fixture(root)
        write(page, """<template><section><unsafe/></section></template><script setup>
// import Unsafe from './Safe.vue'
/* import Unsafe from './Safe.vue' */
const quoted="import Unsafe from './Safe.vue'"
const templated=`import Unsafe from './Safe.vue'`
const patterned=/import Unsafe from '.\\/Safe.vue'/
</script>""")
        write(page.parent / "Safe.vue", "<template><section>safe</section></template>")
        code, payload = run(gate, root)
        assert code == 1 and "COMPONENT_GRAPH_CUSTOM_BINDING_MISSING" in codes(payload), payload
        write(page, "<template><section><unsafe/></section></template><script setup>import Unsafe from './Safe.vue'</script>")
        code, payload = run(gate, root)
        assert code == 0 and payload["status"] == "PASS", payload
        # A normal script import is template-visible only through a statically
        # proven Options API registration. Aliases and local static spreads are
        # supported; dynamic registration is rejected.
        fixture(root)
        page = root / "technical-platform/web/src/platform/pages/P006MeetingPage.vue"
        write(page.parent / "Safe.vue", "<template><section>safe</section></template>")
        write(page, "<template><section><unsafe/></section></template><script>import Unsafe from './Safe.vue'; export default {}</script>")
        code, payload = run(gate, root)
        assert code == 1 and "COMPONENT_GRAPH_CUSTOM_BINDING_MISSING" in codes(payload), payload
        write(page, """<template><section><safe-alias/></section></template><script lang="ts">
import Unsafe from './Safe.vue'
const sharedComponents={SafeAlias:Unsafe}
export default {components:{...sharedComponents}}
</script>""")
        code, payload = run(gate, root)
        assert code == 0 and payload["status"] == "PASS", payload
        write(page, """<template><section><unsafe/></section></template><script>
import Unsafe from './Safe.vue'
export default {components:buildComponents(Unsafe)}
</script>""")
        code, payload = run(gate, root)
        assert code == 1 and "COMPONENT_GRAPH_OPTIONS_COMPONENTS_UNRESOLVED" in codes(payload), payload
        write(page, """<template><section><registered/></section></template><script>
import Safe from './Safe.vue'; import Unsafe from './Unsafe.vue'
const registry={Registered:Safe}
Object.assign(registry,{Registered:Unsafe})
export default {components:{...registry}}
</script>""")
        write(page.parent / "Unsafe.vue", "<template><main>unsafe</main></template>")
        code, payload = run(gate, root)
        assert code == 1 and "COMPONENT_GRAPH_OPTIONS_COMPONENTS_UNRESOLVED" in codes(payload), payload
        write(page, """<template><section><registered/></section></template><script>
import Safe from './Safe.vue'
const registry={Registered:Safe}
export default {components:{...registry}}
Object.assign(registry,{})
</script>""")
        code, payload = run(gate, root)
        assert code == 1 and "COMPONENT_GRAPH_OPTIONS_COMPONENTS_UNRESOLVED" in codes(payload), payload
        write(page, """<template><section><registered/></section></template><script>
import Safe from './Safe.vue'
const registry={Registered:Safe}
const alias=registry
export default {components:{...registry}}
</script>""")
        code, payload = run(gate, root)
        assert code == 1 and "COMPONENT_GRAPH_OPTIONS_COMPONENTS_UNRESOLVED" in codes(payload), payload
        fixture(root)
        page = root / "technical-platform/web/src/platform/pages/P006MeetingPage.vue"
        write(page.parent / "Safe.vue", "<template><section>safe</section></template>")
        write(page, "<template><section><unsafe/></section></template><script setup lang=\"coffee\">import Unsafe from './Safe.vue'</script>")
        code, payload = run(gate, root)
        assert code == 1 and "COMPONENT_GRAPH_SCRIPT_LANGUAGE_UNSUPPORTED" in codes(payload), payload
        write(page, "<template><section><unsafe/></section></template><script setup lang=coffee>import Unsafe from './Safe.vue'</script>")
        code, payload = run(gate, root)
        assert code == 1 and "COMPONENT_GRAPH_SCRIPT_LANGUAGE_UNSUPPORTED" in codes(payload), payload
        write(page, "<template><section><unsafe/></section></template><script setup lang=\"ts\">import Unsafe from './Safe.vue'</script>")
        code, payload = run(gate, root)
        assert code == 0 and payload["status"] == "PASS", payload
        fixture(root)
        page = root / "technical-platform/web/src/platform/pages/P006MeetingPage.vue"
        write(page.parent / "Safe.vue", "<template><section>safe</section></template>")
        write(page.parent / "Unsafe.vue", "<template><main>unsafe</main></template>")
        write(page, """<template><section><registered/></section></template><script>
import Safe from './Safe.vue'; import Unsafe from './Unsafe.vue'
export default defineComponent({components:{Registered:Safe}}) && defineComponent({components:{Registered:Unsafe}})
</script>""")
        code, payload = run(gate, root)
        assert code == 1 and "COMPONENT_GRAPH_OPTIONS_COMPONENTS_UNRESOLVED" in codes(payload), payload
        write(page, """<template><section><registered/></section></template><script>
import Safe from './Safe.vue'
export default defineComponent({components:{Registered:Safe}})
</script>""")
        code, payload = run(gate, root)
        assert code == 0 and payload["status"] == "PASS", payload
        fixture(root)
        write(page, "<template><section><unsafe/><script type=\"application/json\">import Unsafe from './Safe.vue'</script></section></template>")
        code, payload = run(gate, root)
        assert code == 1 and "COMPONENT_GRAPH_CUSTOM_BINDING_MISSING" in codes(payload), payload
        fixture(root)
        write(page, "<template><section>safe</section></template><script src=\"./external.ts\"></script>")
        code, payload = run(gate, root)
        assert code == 1 and "COMPONENT_GRAPH_EXTERNAL_SCRIPT_UNSUPPORTED" in codes(payload), payload
        fixture(root)
        write(page, "<template><section><unsafe/></section></template><script setup>import Unsafe from './Safe.vue'</script><script setup>const duplicate=true</script>")
        code, payload = run(gate, root)
        assert code == 1 and "COMPONENT_GRAPH_SFC_STRUCTURE_INVALID" in codes(payload), payload
        fixture(root)
        write(page, "<template><section>first</section></template><template><section>second</section></template>")
        code, payload = run(gate, root)
        assert code == 1 and "COMPONENT_GRAPH_SFC_STRUCTURE_INVALID" in codes(payload), payload

        # External SFC templates are never treated as an empty inline template.
        fixture(root)
        write(page, '<template src="./P006MeetingPage.html"></template>')
        write(page.parent / "P006MeetingPage.html", "<main>external main</main>")
        code, payload = run(gate, root)
        assert code == 1 and "COMPONENT_GRAPH_EXTERNAL_TEMPLATE_UNSUPPORTED" in codes(payload), payload

        # A non-literal route path is enumerated and fails closed when PHASE-10-relevant.
        fixture(root)
        router = root / "technical-platform/web/src/router/portal-router.ts"
        router_text = router.read_text(encoding="utf-8")
        router_text = router_text.replace("export const routes = [", "const hiddenPhase10Path = '/employee/hidden-p006'\nexport const routes = [")
        router_text = router_text.rsplit("\n]", 1)[0] + ",\n{ path: hiddenPhase10Path, component: P006MeetingPage, meta: { permission: 'p006.meeting.read' } }\n]\n"
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_PHASE10_PATH_NON_LITERAL" in codes(payload), payload

        # Quoted/computed keys and imported spread contributors cannot evade route enumeration.
        fixture(root)
        router_text = router.read_text(encoding="utf-8").rsplit("\n]", 1)[0]
        write(router, router_text + ",\n{ 'path': '/employee/quoted-p006', 'component': P006MeetingPage, meta: { permission: 'p006.meeting.read' } }\n]\n")
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_PHASE10_PATH_OUT_OF_BINDINGS" in codes(payload), payload

        # Local spread contributors require a statically provable literal/function graph.
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [", "const hiddenRoutes=buildRoutes('p006.meeting.read')\nexport const routes = [\n...hiddenRoutes,")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_CONTRIBUTOR_OPAQUE" in codes(payload), payload

        # Quoted and interpolation-free templates are literals; any real
        # interpolation remains executable and must fail through every nested
        # route-value grammar.
        base_route = "{ path: '/employee/p006', component: P006MeetingPage, meta: { permission: 'p006.read' } }"
        dynamic_routes = [
            "{ path: '/employee/p006', component: P006MeetingPage, meta: { permission: `p006.${permissionSuffix}` } }",
            "{ path: '/employee/p006', component: P006MeetingPage, meta: { permissionsAny: [`p006.${prefix}.${suffix ?? `${nested}`}`] } }",
            "{ path: '/employee/p006', component: P006MeetingPage, redirect: `/${target}`, meta: { permission: 'p006.read' } }",
            "{ path: '/employee/p006', component: P006MeetingPage, props: { label: `${runtimeLabel}` }, meta: { permission: 'p006.read' } }",
            "{ path: '/employee/p006', component: P006MeetingPage, children: [{ name: 'nested', meta: { permission: `p006.${permissionSuffix}` } }], meta: { permission: 'p006.read' } }",
        ]
        for dynamic_route in dynamic_routes:
            fixture(root)
            router_text = router.read_text(encoding="utf-8").replace(base_route, dynamic_route)
            write(router, router_text)
            code, payload = run(gate, root)
            assert code == 1 and "ROUTER_CONTRIBUTOR_OPAQUE" in codes(payload), payload
        for static_permission in ("'p006.read'", '"p006.read"', "`p006.read`", r"`p006.\${literal}`"):
            fixture(root)
            router_text = router.read_text(encoding="utf-8").replace(
                base_route, base_route.replace("'p006.read'", static_permission))
            write(router, router_text)
            code, payload = run(gate, root)
            assert code == 0 and payload["status"] == "PASS", payload

        # `portal` props shorthand is admitted only for a proven, read-only
        # route-factory parameter.  Name coincidence or any mutation/escape/
        # shadow/closure must not establish authority.
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [",
            "function staticPortalRoutes(portal: PortalDefinition){"
            "if(portal.code==='employee')return[{name:'portal-static',props:{portal}}];return[]}\n"
            "export const routes = [\n...staticPortalRoutes(employee),")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 0 and payload["status"] == "PASS", payload
        portal_violations = [
            "portal=tech;return[{name:'portal-static',props:{portal}}]",
            "portal.code='tech';return[{name:'portal-static',props:{portal}}]",
            "portal.normalize();return[{name:'portal-static',props:{portal}}]",
            "portal?.normalize();return[{name:'portal-static',props:{portal}}]",
            "portal['normalize']();return[{name:'portal-static',props:{portal}}]",
            "new portal.Builder();return[{name:'portal-static',props:{portal}}]",
            "portal.code.trim();return[{name:'portal-static',props:{portal}}]",
            "++portal.code;return[{name:'portal-static',props:{portal}}]",
            "portal.code++;return[{name:'portal-static',props:{portal}}]",
            "delete portal.code;return[{name:'portal-static',props:{portal}}]",
            "const alias=portal;return[{name:'portal-static',props:{portal}}]",
            "consume(portal);return[{name:'portal-static',props:{portal}}]",
            "consume({portal});return[{name:'portal-static',props:{portal}}]",
            "function capture(){return portal};return[{name:'portal-static',props:{portal}}]",
            "const portal=tech;return[{name:'portal-static',props:{portal}}]",
            "return portal",
        ]
        for body in portal_violations:
            fixture(root)
            router_text = router.read_text(encoding="utf-8").replace(
                "export const routes = [",
                f"function staticPortalRoutes(portal: PortalDefinition){{{body}}}\n"
                "export const routes = [\n...staticPortalRoutes(employee),")
            write(router, router_text)
            code, payload = run(gate, root)
            assert code == 1 and "ROUTER_CONTRIBUTOR_OPAQUE" in codes(payload), payload

        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [",
            "let runtimePermission='p006.meeting.read'\nexport const routes = [\n"
            "{path:'/employee/p006',component:P006MeetingPage,meta:{permission:runtimePermission}},")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_CONTRIBUTOR_OPAQUE" in codes(payload), payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [",
            "let runtimeTenant='runtime'\nexport const routes = [\n"
            "{path:'/employee/p006',component:P006MeetingPage,props:{tenantId:runtimeTenant},meta:{permission:'p006.meeting.read'}},")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_CONTRIBUTOR_OPAQUE" in codes(payload), payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [",
            "let runtimeRedirect='/employee/p006'\nexport const routes = [\n"
            "{path:'/employee/p006',component:P006MeetingPage,redirect:runtimeRedirect,meta:{permission:'p006.meeting.read'}},")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_CONTRIBUTOR_OPAQUE" in codes(payload), payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "{ path: '/employee/p006', component: P006MeetingPage, meta: { permission: 'p006.read' } }",
            "{ path: '/employee/p006', component: P006MeetingPage, redirect: { name: 'portal-home' }, meta: { permission: 'p006.read' } }")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 0 and payload["status"] == "PASS", payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [",
            "export const routes = [\n{path:'/employee/p006',component:P006MeetingPage,path:'/employee/runtime-hidden-p006',meta:{permission:'p006.meeting.read'}},")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_CONTRIBUTOR_OPAQUE" in codes(payload), payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [",
            "export const routes = [\n{['path']:'/employee/runtime-hidden-p006','path':'/employee/p006',component:P006MeetingPage,meta:{permission:'p006.meeting.read'}},")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_CONTRIBUTOR_OPAQUE" in codes(payload), payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [",
            "export const routes = [\n{path:'/employee/p006',component:P006MeetingPage,'component':P007SchedulePage,meta:{permission:'p006.meeting.read'}},")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_CONTRIBUTOR_OPAQUE" in codes(payload), payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [",
            "export const routes = [\n{path:'/employee/p006',component:P006MeetingPage,meta:{permission:buildPermission()}},")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_CONTRIBUTOR_OPAQUE" in codes(payload), payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [",
            "const routeKey='path'; const componentKey='component';\nexport const routes = [\n"
            "{[routeKey]:'/employee/direct-computed-p006',[componentKey]:P006MeetingPage,meta:{permission:'p006.meeting.read'}},")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_CONTRIBUTOR_OPAQUE" in codes(payload), payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [", "function hiddenRoutes(){return []}\nhiddenRoutes=buildRoutes\nexport const routes = [\n...hiddenRoutes(),")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_CONTRIBUTOR_OPAQUE" in codes(payload), payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [", "function hiddenRoutes(){const holder={'nested'(){return []}}}\nexport const routes = [\n...hiddenRoutes(),")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_CONTRIBUTOR_OPAQUE" in codes(payload), payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [", "const hiddenRoutes=[{}]\nmutate(...hiddenRoutes)\nexport const routes = [\n...hiddenRoutes,")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_CONTRIBUTOR_OPAQUE" in codes(payload), payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [", "const hiddenRoutes=[]\nObject.assign(hiddenRoutes,loadRoutes())\nexport const routes = [\n...hiddenRoutes,")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_CONTRIBUTOR_OPAQUE" in codes(payload), payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [", "const hiddenRoutes=[]\nconst alias=hiddenRoutes\nexport const routes = [\n...hiddenRoutes,")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_CONTRIBUTOR_OPAQUE" in codes(payload), payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [", "function hiddenRoutes(){function nested(){return []}}\nexport const routes = [\n...hiddenRoutes(),")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_CONTRIBUTOR_OPAQUE" in codes(payload), payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [", "const hiddenRoutes=[]\nexport const routes = [\n...hiddenRoutes,")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 0 and payload["status"] == "PASS", payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [", "function hiddenRoutes(){return []}\nexport const routes = [\n...hiddenRoutes(),")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 0 and payload["status"] == "PASS", payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [",
            "function baseRoutes(){return []}\nfunction hiddenRoutes(){return [...baseRoutes()]}\nexport const routes = [\n...hiddenRoutes(),")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 0 and payload["status"] == "PASS", payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [",
            "function hiddenRoutes(){return [...hiddenRoutes()]}\nexport const routes = [\n...hiddenRoutes(),")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_CONTRIBUTOR_CYCLE" in codes(payload), payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [",
            "function firstRoutes(){return [...secondRoutes()]}\nfunction secondRoutes(){return [...firstRoutes()]}\nexport const routes = [\n...firstRoutes(),")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_CONTRIBUTOR_CYCLE" in codes(payload), payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [", "let hiddenRoutes=[]\nexport const routes = [\n...hiddenRoutes,")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_CONTRIBUTOR_OPAQUE" in codes(payload), payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [", "const hiddenRoutes=[buildRoutes('p006.meeting.read')]\nexport const routes = [\n...hiddenRoutes,")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_CONTRIBUTOR_OPAQUE" in codes(payload), payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8")
        router_text = router_text.replace("export const routes = [", "const routeKey='/employee/computed-p006'\nexport const routes = [")
        router_text = router_text.rsplit("\n]", 1)[0] + ",\n{ [routeKey]: true, component: P006MeetingPage, meta: { permission: 'p006.meeting.read' } }\n]\n"
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_PHASE10_PATH_NON_LITERAL" in codes(payload), payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [",
            "const routeKey='path'; const componentKey='component';\n"
            "const hiddenRoutes=[{[routeKey]:'/employee/computed-p006',[componentKey]:P006MeetingPage,meta:{permission:'p006.meeting.read'}}]\n"
            "export const routes = [\n...hiddenRoutes,")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_CONTRIBUTOR_OPAQUE" in codes(payload), payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8").replace(
            "export const routes = [", "const hiddenRoutes=[{name:'static-only'}]\nexport const routes = [\n...hiddenRoutes,")
        write(router, router_text)
        code, payload = run(gate, root)
        assert code == 0 and payload["status"] == "PASS", payload
        fixture(root)
        router_text = router.read_text(encoding="utf-8")
        router_text = ("import { hiddenP006Routes } from './hidden-barrel'\n" +
                       router_text.replace("export const routes = [", "export const routes = [\n...hiddenP006Routes,"))
        write(router, router_text)
        write(router.parent / "hidden-barrel.ts", "export { hiddenP006Routes } from './hidden-routes'\n")
        write(router.parent / "hidden-routes.ts",
              "import P006MeetingPage from '../platform/pages/P006MeetingPage.vue'\n"
              "export const hiddenP006Routes=[{'path':'/employee/imported-p006','component':P006MeetingPage,meta:{permission:'p006.meeting.read'}}]\n")
        code, payload = run(gate, root)
        assert code == 1 and "ROUTER_PHASE10_PATH_OUT_OF_BINDINGS" in codes(payload), payload

        # Missing action in either independently parsed source makes completeness fail.
        fixture(root)
        service = root / "technical-platform/backend/modules/attendance/src/main/java/cn/shangjingu/platform/attendance/ShiftChangeService.java"
        service.write_text(service.read_text(encoding="utf-8").replace('"SUBMIT_DEMAND"', '"SERVICE_ONLY_PLACEHOLDER"'), encoding="utf-8")
        code, payload = run(gate, root)
        assert code == 1 and "ACTION_CONTRACT_MISMATCH" in codes(payload), payload

        # Commented fake ACTIONS cannot hide a mismatch in the unique real declaration.
        fixture(root)
        service = root / "technical-platform/backend/modules/attendance/src/main/java/cn/shangjingu/platform/attendance/ShiftChangeService.java"
        service_text = service.read_text(encoding="utf-8").replace('"SUBMIT_DEMAND"', '"ACTUAL_ONLY"')
        fake_actions = ",".join(f'"{item}"' for item in sorted(ACTIONS["P007"]))
        write(service, f'// ACTIONS=Map.of("S01",Set.of({fake_actions})); fake comment\n' + service_text)
        code, payload = run(gate, root)
        assert code == 1 and "ACTION_CONTRACT_MISMATCH" in codes(payload), payload
        write(service, service_text + '\nclass Duplicate { static final Object ACTIONS=Map.of("S01",Set.of("SUBMIT_DEMAND")); }\n')
        code, payload = run(gate, root)
        assert code == 1 and "ACTION_CONTRACT_MISMATCH" in codes(payload), payload

        # Only one outer class-level static-final ACTIONS field is authoritative.
        fixture(root)
        service = root / "technical-platform/backend/modules/attendance/src/main/java/cn/shangjingu/platform/attendance/ShiftChangeService.java"
        service_text = service.read_text(encoding="utf-8")
        write(service, service_text.replace("private static final", "@Deprecated private static final"))
        code, payload = run(gate, root)
        assert code == 0 and payload["status"] == "PASS", payload
        action_args = ",".join(f'"{item}"' for item in sorted(ACTIONS["P007"]))
        write(service, f'class ShiftChangeService {{ void probe() {{ var ACTIONS=Map.of("S01",Set.of({action_args})); }} }}')
        code, payload = run(gate, root)
        assert code == 1 and {"ACTION_CONTRACT_DEFINITION_MISSING", "ACTION_CONTRACT_NON_FIELD_ASSIGNMENT"} <= codes(payload), payload
        write(service, f'class ShiftChangeService {{ static class Helper {{ static final Object ACTIONS=Map.of("S01",Set.of({action_args})); }} }}')
        code, payload = run(gate, root)
        assert code == 1 and {"ACTION_CONTRACT_DEFINITION_MISSING", "ACTION_CONTRACT_NON_FIELD_ASSIGNMENT"} <= codes(payload), payload
        write(service, f'class ShiftChangeService {{}} class Helper {{ static final Object ACTIONS=Map.of("S01",Set.of({action_args})); }}')
        code, payload = run(gate, root)
        assert code == 1 and "ACTION_CONTRACT_DEFINITION_MISSING" in codes(payload), payload
        write(service, f'class Wrapper {{ static class ShiftChangeService {{ static final Object ACTIONS=Map.of("S01",Set.of({action_args})); }} }}')
        code, payload = run(gate, root)
        assert code == 1 and {"ACTION_CONTRACT_SERVICE_CLASS_MISSING", "ACTION_CONTRACT_DEFINITION_MISSING"} <= codes(payload), payload

        # Only explicit wf_transition INSERT columns/VALUES supply SQL action codes.
        fixture(root)
        sql = root / "technical-platform/database/flyway-overlays/oms/V116__phase10_p007_shift_change.sql"
        sql_text = sql.read_text(encoding="utf-8").replace("('S01','SUBMIT_DEMAND','END')", "('S01','SQL_ONLY_PLACEHOLDER','END')")
        write(sql, sql_text + "\nSELECT audit_event('S01','SUBMIT_DEMAND','END');\nSELECT $$('S01','SUBMIT_DEMAND','END')$$;\n")
        code, payload = run(gate, root)
        assert code == 1 and "ACTION_CONTRACT_MISMATCH" in codes(payload), payload

        # Layout root uses the same graph: conditional child main, missing child and async cycle.
        fixture(root)
        layout = root / "technical-platform/web/src/platform/AuthenticatedPortalLayout.vue"
        write(layout, "<template><ShellFrame/><ShellExtra v-if=\"ready\"/></template><script setup>import { ShellFrame } from './layout-barrel'; import ShellExtra from './ShellExtra.vue'</script>")
        write(layout.parent / "ShellExtra.vue", "<template><main>extra</main></template>")
        code, payload = run(gate, root)
        assert code == 1 and "SHELL_MAIN_COUNT" in codes(payload), payload
        write(layout, '<template><ShellFrame><template #header><span>safe</span></template><ShellExtra/></ShellFrame></template><script setup>import { ShellFrame } from \'./layout-barrel\'; import ShellExtra from \'./ShellExtra.vue\'</script>')
        code, payload = run(gate, root)
        assert code == 1 and "SHELL_MAIN_COUNT" in codes(payload), payload
        write(layout, "<template><ShellFrame/><MissingShell/></template><script setup>import { ShellFrame } from './layout-barrel'; import MissingShell from './MissingShell.vue'</script>")
        code, payload = run(gate, root)
        assert code == 1 and "COMPONENT_GRAPH_UNRESOLVED" in codes(payload), payload
        write(layout, "<template><ShellFrame/><CycleA/></template><script setup>import { ShellFrame } from './layout-barrel'; const CycleA=defineAsyncComponent(()=>import('./CycleA.vue'))</script>")
        write(layout.parent / "CycleA.vue", "<template><CycleB/></template><script setup>import CycleB from './CycleB.vue'</script>")
        write(layout.parent / "CycleB.vue", "<template><CycleA/></template><script setup>import CycleA from './CycleA.vue'</script>")
        code, payload = run(gate, root)
        assert code == 1 and "COMPONENT_GRAPH_CYCLE" in codes(payload), payload

        # Re-export cycle and repo escape cannot silently become opaque leaves.
        fixture(root)
        page = root / "technical-platform/web/src/platform/pages/P006MeetingPage.vue"
        write(page, "<template><AliasWidget/></template><script setup>import { Widget as AliasWidget } from './cycle-a'</script>")
        write(page.parent / "cycle-a.ts", "export { Widget } from './cycle-b'\n")
        write(page.parent / "cycle-b.ts", "export { Widget } from './cycle-a'\n")
        code, payload = run(gate, root)
        assert code == 1 and "COMPONENT_GRAPH_REEXPORT_CYCLE" in codes(payload), payload
        write(page, "<template><EscapeWidget/></template><script setup>import EscapeWidget from '../../../../../../outside.vue'</script>")
        code, payload = run(gate, root)
        assert code == 1 and "COMPONENT_GRAPH_PATH_ESCAPE" in codes(payload), payload

        # Exact public aliases must remain fail-closed when their authority is invalid.
        invalid_aliases: tuple[tuple[str, dict[str, list[str]]], ...] = (
            ("missing", {}),
            ("empty-target", {"@sgj/ui": [], "@sgj/platform-ui": ["src/platform/processes/shared/index.ts"]}),
            ("multi-target", {"@sgj/ui": ["src/design-system/index.ts", "src/design-system/other.ts"],
                              "@sgj/platform-ui": ["src/platform/processes/shared/index.ts"]}),
            ("repo-escape", {"@sgj/ui": ["../../outside.ts"],
                             "@sgj/platform-ui": ["src/platform/processes/shared/index.ts"]}),
            ("wildcard", {"@sgj/*": ["src/*"]}),
        )
        for name, paths in invalid_aliases:
            fixture(root)
            write_public_alias_graph(root, paths)
            code, payload = run(gate, root)
            assert code == 1 and payload["status"] == "FAIL", (name, payload)

        fixture(root)
        write_public_alias_graph(root)
        write(root / "technical-platform/web/src/design-system/index.ts",
              "export { default as OtherShell } from './layout/PortalShell.vue'\n")
        code, payload = run(gate, root)
        assert code == 1 and payload["status"] == "FAIL", ("missing-symbol", payload)

        fixture(root)
        write_public_alias_graph(root)
        write(root / "technical-platform/web/src/design-system/index.ts",
              "export { SgjPortalShell } from './cycle-a'\n")
        write(root / "technical-platform/web/src/design-system/cycle-a.ts",
              "export { SgjPortalShell } from './cycle-b'\n")
        write(root / "technical-platform/web/src/design-system/cycle-b.ts",
              "export { SgjPortalShell } from './cycle-a'\n")
        code, payload = run(gate, root)
        assert code == 1 and payload["status"] == "FAIL", ("alias-cycle", payload)

        fixture(root)
        write_public_alias_graph(root)
        write(root / "technical-platform/web/src/design-system/index.ts",
              "export { default as SgjPortalShell } from './layout/PortalShell.vue'\n"
              "export { default as SgjPortalShell } from './layout/OtherShell.vue'\n")
        write(root / "technical-platform/web/src/design-system/layout/OtherShell.vue",
              "<template><main><slot/></main></template>\n")
        code, payload = run(gate, root)
        assert code == 1 and payload["status"] == "FAIL", ("ambiguous-symbol", payload)

        # Valid exact aliases must resolve through named re-exports and the existing main graph.
        fixture(root)
        write_public_alias_graph(root)
        code, payload = run(gate, root)
        assert code == 0 and payload["status"] == "PASS", payload

        # Public components may use a statically bounded native tag without
        # adding another rendered <main>.  Runtime or ambiguous expressions
        # must remain fail-closed; do not treat arbitrary lowercase values as
        # native merely because Vue's <component> accepts them at runtime.
        public_feature = (root / "technical-platform/web/src/platform/processes/shared/monitoring/"
                          "Phase10PublicRouteFeature.vue")
        dynamic_negative_scripts: tuple[tuple[str, str, str], ...] = (
            ("unconstrained-string", "runtimeTag", "const runtimeTag: string = 'div'"),
            ("runtime-ref", "runtimeTag", "const runtimeTag = ref('div')"),
            ("union-custom", "as", "withDefaults(defineProps<{as?: 'div' | 'UnsafeWidget'}>(), {as:'div'})"),
            ("ternary-custom", "ordered ? 'ol' : 'UnsafeWidget'", "defineProps<{ordered?: boolean}>()"),
            ("computed", "computedTag", "const computedTag = computed(() => 'div')"),
            ("call", "chooseTag()", "const chooseTag = () => 'div'"),
            ("member", "tags.current", "const tags = {current:'div'}"),
            ("nested", "ready ? (ordered ? 'ol' : 'ul') : 'div'",
             "defineProps<{ready?: boolean; ordered?: boolean}>()"),
            ("duplicate-authority", "as",
             "withDefaults(defineProps<{as?: 'div' | 'section'}>(), {as:'div'}); "
             "withDefaults(defineProps<{as?: 'article'}>(), {as:'article'})"),
            ("assigned-prop", "as",
             "withDefaults(defineProps<{as?: 'div' | 'section'}>(), {as:'div'}); as = 'section'"),
            ("aliased-mutation", "as",
             "const props=withDefaults(defineProps<{as?: 'div' | 'section'}>(), {as:'div'}); "
             "const alias=props; alias.as='section'"),
            ("malformed-union", "as", "withDefaults(defineProps<{as?: 'div' |}>(), {as:'div'})"),
            ("malformed-default", "as",
             "withDefaults(defineProps<{as?: 'div' | 'section'}>(), {as:runtimeDefault})"),
            ("malformed-ternary", "ordered ? 'ol'", "defineProps<{ordered?: boolean}>()"),
        )
        for name, expression, script in dynamic_negative_scripts:
            fixture(root)
            write_public_alias_graph(root)
            write(public_feature,
                  f'<template><section><component :is="{expression}"/></section></template>'
                  f'<script setup lang="ts">{script}</script>')
            code, payload = run(gate, root)
            dynamic_codes = {item for item in codes(payload) if item.startswith("COMPONENT_GRAPH_DYNAMIC_IS_")}
            assert code == 1 and dynamic_codes, (name, payload)

        valid_dynamic_native: tuple[tuple[str, str, str], ...] = (
            ("literal-union-prop", "as",
             "withDefaults(defineProps<{as?: 'div' | 'section' | 'article'}>(), {as:'section'})"),
            ("boolean-native-ternary", "ordered ? 'ol' : 'ul'", "defineProps<{ordered?: boolean}>()"),
        )
        rejected_valid_native: list[tuple[str, list[str]]] = []
        for name, expression, script in valid_dynamic_native:
            fixture(root)
            write_public_alias_graph(root)
            write(public_feature.parent / "UnsafeLandmark.vue", "<template><main>nested main</main></template>")
            write(public_feature,
                  f'<template><section><component :is="{expression}"/><UnsafeLandmark/></section></template>'
                  f'<script setup lang="ts">import UnsafeLandmark from \'./UnsafeLandmark.vue\'; {script}</script>')
            code, payload = run(gate, root)
            dynamic_codes = sorted(item for item in codes(payload) if item.startswith("COMPONENT_GRAPH_DYNAMIC_IS_"))
            route_counts = [item for item in payload["violations"]
                            if item["code"] == "ROUTE_MAIN_COUNT" and item.get("actual") == 2]
            assert code == 1 and "NESTED_COMPONENT_MAIN" in codes(payload) and route_counts, (name, payload)
            if dynamic_codes:
                rejected_valid_native.append((name, dynamic_codes))
        assert not rejected_valid_native, rejected_valid_native

    # Current-repository discovery assertion prevents future decoy-page regressions.
    actual_root = Path(__file__).resolve().parents[2]
    code, payload = run(gate, actual_root)
    assert code == 0
    assert payload["status"] == "PASS"
    assert payload["violation_count"] == 0
    assert payload["violations"] == []
    actual_pages = set(payload["discovered_route_pages"])
    assert "technical-platform/web/src/platform/pages/P007SchedulePage.vue" in actual_pages, actual_pages
    assert "technical-platform/web/src/platform/pages/Phase10TechMonitorPage.vue" in actual_pages, actual_pages
    assert P007_REQUIRED <= set(payload["derived_action_codes"]), payload["derived_action_codes"]
    print("phase10 component source gate: PASS (router/contracts/named-barrel/layout graph positive and fail-closed fixtures)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
