#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
KB = ROOT / "Knowledge Base/03 数据库需求规则"
DDL_ROOT = KB / "03_SQL_DDL"
TABLE_CATALOG = KB / "02_数据字典/03_全量表清单.csv"
INDEX_CATALOG = KB / "02_数据字典/06_索引设计.csv"
REPORT_MD = ROOT / "docs/implementation/phases/PHASE-03/DATABASE_BASELINE_REPORT.md"
REPORT_JSON = ROOT / "docs/implementation/evidence/PHASE-03_STATIC_BASELINE.json"

DB_DIRS = {
    "sjg_oms": DDL_ROOT / "01_sjg_oms",
    "sjg_audit": DDL_ROOT / "02_sjg_audit",
    "sjg_dw": DDL_ROOT / "03_sjg_dw",
}

CREATE_TABLE = re.compile(
    r"(?im)^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?P<schema>[A-Za-z_][A-Za-z0-9_]*)\.)?(?P<table>[A-Za-z_][A-Za-z0-9_]*)"
)
CREATE_SCHEMA = re.compile(
    r"(?im)^\s*CREATE\s+SCHEMA\s+(?:IF\s+NOT\s+EXISTS\s+)?(?P<schema>[A-Za-z_][A-Za-z0-9_]*)"
)
CREATE_INDEX = re.compile(
    r"(?im)^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(?P<name>[A-Za-z_][A-Za-z0-9_]*)\s+ON\s+(?:(?P<schema>[A-Za-z_][A-Za-z0-9_]*)\.)?(?P<table>[A-Za-z_][A-Za-z0-9_]*)"
)
SEARCH_PATH = re.compile(r"(?im)^\s*SET\s+search_path\s+TO\s+(?P<schema>[A-Za-z_][A-Za-z0-9_]*)")


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def sql_files(directory: Path) -> list[Path]:
    return sorted(directory.glob("*.sql"), key=lambda p: (int(p.name.split("_", 1)[0]), p.name))


def qualified(schema: str, table: str) -> str:
    return f"{schema}.{table}"


def ddl_objects() -> tuple[set[str], set[str], set[str]]:
    tables: set[str] = set()
    schemas: set[str] = set()
    indexes: set[str] = set()
    for database, directory in DB_DIRS.items():
        for path in sql_files(directory):
            text = path.read_text(encoding="utf-8-sig")
            search = SEARCH_PATH.search(text)
            default_schema = search.group("schema") if search else "public"
            for match in CREATE_SCHEMA.finditer(text):
                schemas.add(f"{database}|{match.group('schema')}")
            for match in CREATE_TABLE.finditer(text):
                schema = match.group("schema") or default_schema
                tables.add(f"{database}|{schema}|{match.group('table')}")
            for match in CREATE_INDEX.finditer(text):
                schema = match.group("schema") or default_schema
                indexes.add(f"{qualified(schema, match.group('table'))}|{match.group('name')}")
    return tables, schemas, indexes


def catalog_tables() -> set[str]:
    rows = read_csv(TABLE_CATALOG)
    required = {"数据库", "Schema", "表名"}
    if not rows or not required.issubset(rows[0]):
        raise RuntimeError(f"unexpected table catalog headers: {list(rows[0]) if rows else []}")
    return {f"{row['数据库'].strip()}|{row['Schema'].strip()}|{row['表名'].strip()}" for row in rows}


def catalog_indexes() -> set[str]:
    rows = read_csv(INDEX_CATALOG)
    required = {"table", "name"}
    if not rows or not required.issubset(rows[0]):
        raise RuntimeError(f"unexpected index catalog headers: {list(rows[0]) if rows else []}")
    return {f"{row['table'].strip()}|{row['name'].strip()}" for row in rows}


def serialize_key(key: str) -> str:
    return key.replace("|", ".", 2) if key.count("|") == 2 else key.replace("|", " :: ")


def build_payload() -> dict[str, object]:
    catalog_table_set = catalog_tables()
    catalog_index_set = catalog_indexes()
    ddl_table_set, ddl_schema_set, ddl_index_set = ddl_objects()

    table_catalog_only = sorted(catalog_table_set - ddl_table_set)
    table_ddl_only = sorted(ddl_table_set - catalog_table_set)
    index_catalog_only = sorted(catalog_index_set - ddl_index_set)
    index_ddl_only = sorted(ddl_index_set - catalog_index_set)

    payload: dict[str, object] = {
        "phase": "PHASE-03",
        "sources": {
            "table_catalog": TABLE_CATALOG.relative_to(ROOT).as_posix(),
            "index_catalog": INDEX_CATALOG.relative_to(ROOT).as_posix(),
            "ddl_root": DDL_ROOT.relative_to(ROOT).as_posix(),
        },
        "counts": {
            "core_databases": len(DB_DIRS),
            "ddl_physical_schemas": len(ddl_schema_set),
            "table_catalog_unique": len(catalog_table_set),
            "ddl_create_table_unique": len(ddl_table_set),
            "index_catalog_unique": len(catalog_index_set),
            "ddl_create_index_unique": len(ddl_index_set),
        },
        "table_diff": {
            "catalog_only_count": len(table_catalog_only),
            "ddl_only_count": len(table_ddl_only),
            "catalog_only": table_catalog_only,
            "ddl_only": table_ddl_only,
        },
        "index_diff": {
            "catalog_only_count": len(index_catalog_only),
            "ddl_only_count": len(index_ddl_only),
            "catalog_only": index_catalog_only,
            "ddl_only": index_ddl_only,
        },
        "interpretation": {
            "table_difference_policy": "report source/catalog mismatch; do not mutate approved DDL in PHASE-03 merely to force count equality",
            "index_difference_policy": "report source/catalog mismatch; do not invent or delete indexes without a later approved database decision",
            "schema_gate": "current approved DDL must declare 46 physical database+schema pairs",
        },
    }
    return payload


def markdown_list(values: list[str]) -> str:
    if not values:
        return "- `NONE`"
    return "\n".join(f"- `{serialize_key(value)}`" for value in values)


def build_markdown(payload: dict[str, object]) -> str:
    counts = payload["counts"]
    table_diff = payload["table_diff"]
    index_diff = payload["index_diff"]
    assert isinstance(counts, dict) and isinstance(table_diff, dict) and isinstance(index_diff, dict)
    return f"""# PHASE-03 DATABASE BASELINE REPORT

> Deterministic source comparison. This report compares the current Knowledge Base data dictionary with the current approved DDL package; it does not silently reconcile differences.

## 1. Baseline counts

| Metric | Current actual |
|---|---:|
| Core databases | {counts['core_databases']} |
| Physical database+Schema pairs declared by approved DDL | {counts['ddl_physical_schemas']} |
| Unique table catalog entries | {counts['table_catalog_unique']} |
| Unique approved DDL `CREATE TABLE` entries | {counts['ddl_create_table_unique']} |
| Unique index catalog entries | {counts['index_catalog_unique']} |
| Unique approved DDL `CREATE [UNIQUE] INDEX` entries | {counts['ddl_create_index_unique']} |

## 2. Table catalog vs approved DDL

- Catalog-only: **{table_diff['catalog_only_count']}**
- DDL-only: **{table_diff['ddl_only_count']}**

### Catalog-only tables

{markdown_list(table_diff['catalog_only'])}

### DDL-only tables

{markdown_list(table_diff['ddl_only'])}

## 3. Index catalog vs approved DDL

- Catalog-only: **{index_diff['catalog_only_count']}**
- DDL-only: **{index_diff['ddl_only_count']}**

### Catalog-only indexes (`schema.table :: index`)

{markdown_list(index_diff['catalog_only'])}

### DDL-only indexes (`schema.table :: index`)

{markdown_list(index_diff['ddl_only'])}

## 4. PHASE-03 interpretation

- This phase installs the **approved DDL** through Flyway and proves the installed database matches those approved `CREATE TABLE` statements.
- Existing table/index catalog differences are preserved as source conflicts. PHASE-03 does not fabricate missing requirements or rewrite the approved DDL solely to make historic counts equal.
- The 46 physical Schema gate is counted as **database + Schema**, because the same Schema name may exist in more than one database.
- A later approved database/requirements decision must resolve any catalog-only or DDL-only objects if they are not intentional.

## 5. Machine-readable evidence

`docs/implementation/evidence/PHASE-03_STATIC_BASELINE.json`
"""


def write_outputs(md: Path, js: Path) -> None:
    payload = build_payload()
    if payload["counts"]["core_databases"] != 3:
        raise RuntimeError(f"expected 3 core databases: {payload['counts']}")
    if payload["counts"]["ddl_physical_schemas"] != 46:
        raise RuntimeError(f"expected 46 physical schemas: {payload['counts']}")
    md.parent.mkdir(parents=True, exist_ok=True)
    js.parent.mkdir(parents=True, exist_ok=True)
    md.write_text(build_markdown(payload).rstrip() + "\n", encoding="utf-8", newline="\n")
    js.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    if not args.check:
        write_outputs(REPORT_MD, REPORT_JSON)
        print("PHASE-03 static database baseline report generated")
        return

    if not REPORT_MD.exists() or not REPORT_JSON.exists():
        raise RuntimeError("committed PHASE-03 static baseline report is missing")
    with tempfile.TemporaryDirectory(prefix="phase03-db-report-") as temp:
        expected_md = Path(temp) / "report.md"
        expected_json = Path(temp) / "report.json"
        write_outputs(expected_md, expected_json)
        if expected_md.read_bytes() != REPORT_MD.read_bytes():
            raise RuntimeError("DATABASE_BASELINE_REPORT.md is stale")
        if expected_json.read_bytes() != REPORT_JSON.read_bytes():
            raise RuntimeError("PHASE-03_STATIC_BASELINE.json is stale")
    print("PHASE-03 static database baseline report is deterministic and current")


if __name__ == "__main__":
    main()
