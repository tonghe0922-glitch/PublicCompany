#!/usr/bin/env python3
from pathlib import Path

path = Path("technical-platform/web/src/router/portal-route-specs.ts")
text = path.read_text(encoding="utf-8")

import_marker = "import P011TechPage from '../platform/pages/phase11/P011TechPage.vue'\n"
imports = (
    import_marker
    + "import P012CenterPage from '../platform/pages/phase11/P012CenterPage.vue'\n"
    + "import P012EmployeePage from '../platform/pages/phase11/P012EmployeePage.vue'\n"
    + "import P012TechPage from '../platform/pages/phase11/P012TechPage.vue'\n"
)
if "import P012CenterPage" not in text:
    if import_marker not in text:
        raise SystemExit("P011 import marker missing")
    text = text.replace(import_marker, imports, 1)

array_marker = "\nconst PHASE10_TECH_ROUTE_SPECS: readonly PortalRouteSpec[] = ["
p012_array = """

const P012_ROUTE_SPECS: readonly PortalRouteSpec[] = [
  {
    portal: 'employee', path: '/employee/03/03/05', name: 'p012-promotion-self',
    component: P012EmployeePage,
    permissionsAny: ['p012.promotion.create', 'p012.promotion.read'],
  },
  {
    portal: 'center', path: '/center/10/06/01', name: 'p012-promotion-management',
    component: P012CenterPage,
    permissionsAny: [
      'p012.promotion.create', 'p012.promotion.review',
      'p012.promotion.appoint', 'p012.promotion.activate',
    ],
  },
  {
    portal: 'tech', path: '/tech/01/11/07', name: 'p012-promotion-monitor',
    component: P012TechPage, permission: 'p012.promotion.monitor',
  },
]
"""
if "const P012_ROUTE_SPECS" not in text:
    if array_marker not in text:
        raise SystemExit("route array marker missing")
    text = text.replace(array_marker, p012_array + array_marker, 1)

export_marker = "  ...P011_ROUTE_SPECS,\n]"
if "  ...P012_ROUTE_SPECS," not in text:
    if export_marker not in text:
        raise SystemExit("export marker missing")
    text = text.replace(
        export_marker,
        "  ...P011_ROUTE_SPECS,\n  ...P012_ROUTE_SPECS,\n]",
        1,
    )

path.write_text(text, encoding="utf-8")
