#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from typing import Any

import phase01_fix_v2 as previous
import phase01_parse as base

ORIGINAL_PARSE_PAGES = base.Pipeline.parse_pages
ROUTE_HEADERS = {"建议路由", "路由", "routepath", "route_path"}


def _route_value(data: dict[str, Any]) -> str:
    for header, value in data.items():
        if base.key(header) in {base.key(item) for item in ROUTE_HEADERS}:
            return base.text(value)
    return ""


def _parse_pages(self: base.Pipeline) -> None:
    ORIGINAL_PARSE_PAGES(self)
    row_lookup: dict[tuple[str, str, int], dict[str, Any]] = {}
    for _, files in base.PAGE_FILES.items():
        for relative in files:
            _, records = base.xlsx(self.root / relative)
            for record in records:
                row_lookup[(relative, record["sheet"], record["row"])] = record["data"]

    expected = 0
    sourced = 0
    for page in self.pages:
        source_data = row_lookup.get(
            (page["source_file"], page["source_sheet"], page["source_row"]), {}
        )
        route = _route_value(source_data)
        if route:
            expected += 1
            page["route_path"] = route
            sourced += 1
    self.page_route_expected = expected
    self.page_route_sourced = sourced


def _summary(self: base.Pipeline) -> dict[str, Any]:
    summary = previous._summary(self)
    summary["checks"]["page_source_routes"] = (
        getattr(self, "page_route_expected", 0)
        == getattr(self, "page_route_sourced", 0)
        and getattr(self, "page_route_sourced", 0) > 0
    )
    if not summary["checks"]["page_source_routes"]:
        self.hard.append("DoD:page_source_routes")
    summary["hard_failures"] = sorted(set(self.hard))
    summary["phase_gate"] = "PASS" if not summary["hard_failures"] else "FAIL"
    summary["pages"]["source_routes_expected"] = getattr(
        self, "page_route_expected", 0
    )
    summary["pages"]["source_routes_sourced"] = getattr(
        self, "page_route_sourced", 0
    )
    return summary


def apply_patch() -> None:
    previous.apply_patch()
    base.Pipeline.parse_pages = _parse_pages
    base.Pipeline.summary = _summary


def main() -> int:
    apply_patch()
    return base.main()


if __name__ == "__main__":
    raise SystemExit(main())
