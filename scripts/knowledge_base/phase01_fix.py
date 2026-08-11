#!/usr/bin/env python3
from __future__ import annotations

import csv
import re
from collections import Counter
from pathlib import Path
from typing import Any

import phase01_parse as base

CORE_DATABASES = {"sjg_oms", "sjg_audit", "sjg_dw"}


def _first_nonempty_csv_header(path: Path):
    raw = path.read_bytes()
    decoded = None
    encoding = None
    for candidate in ("utf-8-sig", "utf-8", "gb18030"):
        try:
            decoded = raw.decode(candidate)
            encoding = candidate
            break
        except UnicodeDecodeError:
            continue
    if decoded is None:
        raise ValueError("unsupported encoding")
    try:
        dialect = csv.Sniffer().sniff(decoded[:65536], delimiters=",\t;")
    except csv.Error:
        dialect = csv.excel
    rows = list(csv.reader(decoded.splitlines(), dialect))
    first = next((i for i, row in enumerate(rows) if any(base.text(v) for v in row)), None)
    if first is None:
        return [], [], encoding
    headers = base.headers(rows[first])
    records = []
    for source_row, row in enumerate(rows[first + 1 :], first + 2):
        if not any(base.text(v) for v in row):
            continue
        row = list(row) + [""] * max(0, len(headers) - len(row))
        records.append(
            {
                "row": source_row,
                "data": {headers[i]: base.redact(row[i]) for i in range(len(headers))},
            }
        )
    return headers, records, encoding


def _s0_sequence_code(data: dict[str, Any]) -> str | None:
    for header, value in data.items():
        if base.key(header) not in {"序号", "流程序号"}:
            continue
        raw = base.text(value)
        match = re.fullmatch(r"(\d{1,3})(?:\.0+)?", raw)
        if not match:
            continue
        number = int(match.group(1))
        if 1 <= number <= 126:
            return f"P{number:03d}"
    return None


def _remove_gaps(pipeline: base.Pipeline, predicate) -> None:
    pipeline.gaps = [gap for gap in pipeline.gaps if not predicate(gap)]


def _renumber_gaps(pipeline: base.Pipeline) -> None:
    for index, gap in enumerate(pipeline.gaps, 1):
        gap["id"] = f"GAP-{index:04d}"


def _patch_aliases() -> None:
    for alias in ("一级首页板块", "首页板块"):
        if alias not in base.PALIASES["level_1"]:
            base.PALIASES["level_1"].insert(0, alias)
        if alias not in base.PALIASES["display"]:
            base.PALIASES["display"].insert(0, alias)


_original_parse_indexes = base.Pipeline.parse_indexes_and_processes
_original_parse_db = base.Pipeline.parse_db
_original_summary = base.Pipeline.summary


def _parse_indexes_and_processes(self: base.Pipeline) -> None:
    _original_parse_indexes(self)

    _, s0_records = base.xlsx(self.root / base.S0)
    rebuilt = []
    for row in s0_records:
        process_code = _s0_sequence_code(row["data"]) or base.rowcode(row["data"])
        if process_code in base.EXPECTED:
            rebuilt.append(
                {
                    "process_code": process_code,
                    "source_file": base.S0.as_posix(),
                    **row,
                }
            )
    self.s0 = rebuilt
    self.s0codes = Counter(item["process_code"] for item in self.s0)
    self.s1codes = Counter(item["process_code"] for item in self.s1)

    _remove_gaps(
        self,
        lambda gap: gap.get("category") == "PROCESS_INDEX"
        and gap.get("source") in {"S0", "S1_INDEX"},
    )

    for tag, counts in (("S0", self.s0codes), ("S1_INDEX", self.s1codes)):
        missing = sorted(base.EXPECTED - set(counts))
        duplicate = sorted(code for code, count in counts.items() if count > 1)
        extra = sorted(set(counts) - base.EXPECTED)
        if missing or duplicate or extra or len(counts) != 126:
            self.hard.append(f"index:{tag}")
            self.gap(
                "BLOCKER",
                "PROCESS_INDEX",
                tag,
                f"missing={missing}, duplicate={duplicate}, extra={extra}, unique={len(counts)}",
                "P001-P126 索引唯一性失败",
            )


def _parse_db(self: base.Pipeline) -> None:
    _original_parse_db(self)

    source_info = self.db.get("data_sources", {})
    database_column = (
        base.hmap(source_info.get("headers", []), base.DBALIASES["database"])
        if source_info
        else None
    )
    data_source_names = {
        base.text(record["data"].get(database_column))
        for record in source_info.get("records", [])
        if database_column and base.text(record["data"].get(database_column))
    }
    self.data_source_count = len(data_source_names)
    self.core_database_names = sorted(data_source_names & CORE_DATABASES)
    self.dbcount = len(self.core_database_names)

    _remove_gaps(
        self,
        lambda gap: gap.get("category") == "DB_COUNT"
        and str(gap.get("description", "")).startswith("database:"),
    )

    if set(self.core_database_names) != CORE_DATABASES:
        self.hard.append("core-database-count")
        self.gap(
            "BLOCKER",
            "DB_COUNT",
            base.DBFILES["data_sources"].as_posix(),
            f"core databases={self.core_database_names}; data_sources={sorted(data_source_names)}",
            "核心数据库必须能来源化核验为 sjg_oms/sjg_audit/sjg_dw",
        )

    missing_mapping = sorted(base.EXPECTED - set(self.pmap))
    if missing_mapping:
        self.hard.append("mapping-coverage")
        self.gap(
            "BLOCKER",
            "DB_MAPPING",
            base.DBFILES["mapping"].as_posix(),
            f"{len(missing_mapping)} processes without authoritative mapping: {missing_mapping}",
            "每个 process_code 必须有权威 Schema/主表定位",
        )


def _summary(self: base.Pipeline) -> dict[str, Any]:
    _renumber_gaps(self)
    summary = _original_summary(self)
    summary["checks"]["s0_P001_P126_unique"] = (
        len(self.s0codes) == 126
        and set(self.s0codes) == base.EXPECTED
        and all(count == 1 for count in self.s0codes.values())
    )
    summary["checks"]["s1_P001_P126_unique"] = (
        len(self.s1codes) == 126
        and set(self.s1codes) == base.EXPECTED
        and all(count == 1 for count in self.s1codes.values())
    )
    summary["checks"]["process_table_mapping_126"] = (
        len(base.EXPECTED & set(self.pmap)) == 126
    )
    summary["checks"]["core_databases_3"] = (
        set(getattr(self, "core_database_names", [])) == CORE_DATABASES
    )

    for check, passed in summary["checks"].items():
        if not passed:
            self.hard.append("DoD:" + check)

    summary["hard_failures"] = sorted(set(self.hard))
    summary["phase_gate"] = "PASS" if not summary["hard_failures"] else "FAIL"
    summary["database"]["count"] = self.dbcount
    summary["database"]["core_databases"] = getattr(self, "core_database_names", [])
    summary["database"]["data_sources_total"] = getattr(self, "data_source_count", 0)
    summary["process"]["s0_codes"] = len(self.s0codes)
    summary["process"]["s1_codes"] = len(self.s1codes)
    summary["gaps"] = {
        "count": len(self.gaps),
        "severity": dict(Counter(gap["severity"] for gap in self.gaps)),
        "category": dict(Counter(gap["category"] for gap in self.gaps)),
    }
    return summary


def apply_patch() -> None:
    _patch_aliases()
    base.csvread = _first_nonempty_csv_header
    base.Pipeline.parse_indexes_and_processes = _parse_indexes_and_processes
    base.Pipeline.parse_db = _parse_db
    base.Pipeline.summary = _summary


def main() -> int:
    apply_patch()
    return base.main()


if __name__ == "__main__":
    raise SystemExit(main())
