#!/usr/bin/env python3
from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Any

import phase01_fix as previous
import phase01_parse as base

HOME_PAGE_NAMES = {Path(files[0]).name for files in base.PAGE_FILES.values()}
ORIGINAL_XLSX = base.xlsx


def _xlsx_with_explicit_home_header(path: Path):
    path = Path(path)
    if path.name not in HOME_PAGE_NAMES:
        return ORIGINAL_XLSX(path)

    workbook = base.load_workbook(path, read_only=True, data_only=False)
    metas = []
    records = []
    try:
        for sheet in workbook.worksheets:
            raw_rows = [tuple(row) for row in sheet.iter_rows(values_only=True)]
            header_row = None
            header_values = None
            for source_row, row in enumerate(raw_rows, 1):
                if any(base.key(value) == "一级首页板块" for value in row):
                    header_row = source_row
                    header_values = row
                    break
            if header_row is None or header_values is None:
                metas.append(
                    {
                        "sheet": sheet.title,
                        "headers": [],
                        "header_row": None,
                        "rows": 0,
                        "max_row": sheet.max_row,
                        "max_column": sheet.max_column,
                    }
                )
                continue

            headers = base.headers(header_values)
            count = 0
            for source_row, row in enumerate(raw_rows, 1):
                if source_row <= header_row or not any(base.text(value) for value in row):
                    continue
                row = list(row) + [None] * max(0, len(headers) - len(row))
                data = {headers[i]: base.redact(row[i]) for i in range(len(headers))}
                if not base.text(data.get("一级首页板块")):
                    continue
                records.append({"sheet": sheet.title, "row": source_row, "data": data})
                count += 1
            metas.append(
                {
                    "sheet": sheet.title,
                    "headers": headers,
                    "header_row": header_row,
                    "rows": count,
                    "max_row": sheet.max_row,
                    "max_column": sheet.max_column,
                }
            )
    finally:
        workbook.close()
    return metas, records


def _remove_index_failures(self: base.Pipeline) -> None:
    self.hard = [
        failure
        for failure in self.hard
        if failure not in {"index:S0", "index:S1_INDEX"}
    ]
    previous._remove_gaps(
        self,
        lambda gap: gap.get("category") == "PROCESS_INDEX"
        and gap.get("source") in {"S0", "S1_INDEX"},
    )


def _rebuild_index(records, source_file: Path, sheet_name: str, sequence: bool):
    rebuilt = []
    for row in records:
        if row["sheet"] != sheet_name:
            continue
        process_code = (
            previous._s0_sequence_code(row["data"])
            if sequence
            else base.rowcode(row["data"])
        )
        if process_code in base.EXPECTED:
            rebuilt.append(
                {
                    "process_code": process_code,
                    "source_file": source_file.as_posix(),
                    **row,
                }
            )
    return rebuilt


def _parse_indexes_and_processes(self: base.Pipeline) -> None:
    previous._parse_indexes_and_processes(self)
    _remove_index_failures(self)

    _, s0_records = base.xlsx(self.root / base.S0)
    _, s1_records = base.xlsx(self.root / base.S1)
    self.s0 = _rebuild_index(s0_records, base.S0, "业务流程总表", True)
    self.s1 = _rebuild_index(s1_records, base.S1, "01_三端流程索引", False)
    self.s0codes = Counter(item["process_code"] for item in self.s0)
    self.s1codes = Counter(item["process_code"] for item in self.s1)

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
    previous._parse_db(self)
    schema_info = self.db.get("schemas", {})
    database_column = base.hmap(
        schema_info.get("headers", []), base.DBALIASES["database"]
    )
    schema_column = base.hmap(
        schema_info.get("headers", []), base.DBALIASES["schema"]
    )
    physical_schemas = {
        (
            base.text(record["data"].get(database_column)),
            base.text(record["data"].get(schema_column)),
        )
        for record in schema_info.get("records", [])
        if database_column
        and schema_column
        and base.text(record["data"].get(database_column))
        and base.text(record["data"].get(schema_column))
    }
    if physical_schemas:
        self.schemacount = len(physical_schemas)
    previous._remove_gaps(
        self,
        lambda gap: gap.get("category") == "DB_COUNT"
        and str(gap.get("description", "")).startswith("schema:"),
    )


def _summary(self: base.Pipeline) -> dict[str, Any]:
    form_rows = len(self.sections["forms"])
    if form_rows != 2164:
        self.gap(
            "WARN",
            "FORM_COUNT",
            base.S1.as_posix(),
            f"declared forms=2164; extracted form rows={form_rows}",
            "保留资料口径差异；不把表单行数强行改写为声明值",
        )
    return previous._summary(self)


def apply_patch() -> None:
    previous.apply_patch()
    base.xlsx = _xlsx_with_explicit_home_header
    base.Pipeline.parse_indexes_and_processes = _parse_indexes_and_processes
    base.Pipeline.parse_db = _parse_db
    base.Pipeline.summary = _summary


def main() -> int:
    apply_patch()
    return base.main()


if __name__ == "__main__":
    raise SystemExit(main())
