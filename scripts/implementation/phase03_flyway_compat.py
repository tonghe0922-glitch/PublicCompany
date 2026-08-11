#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
import tempfile
from pathlib import Path

import phase03_prepare_flyway as base

OUTPUT_ROOT = base.OUTPUT_ROOT
PSQL_META = re.compile(r"(?m)^\s*\\[^\n]*$")
PSQL_VARIABLE = re.compile(r":'([A-Za-z_][A-Za-z0-9_]*)'")
TENANT_SET = re.compile(r"(?m)^\\set\s+tenant_id\s+'([0-9A-Fa-f-]{36})'\s*$")
SEED_SOURCE = "Knowledge Base/03 数据库需求规则/03_SQL_DDL/01_sjg_oms/95_seed_process_catalog.sql"
TENANT_PLACEHOLDER = "${sjg_tenant_id}"
OWNER_GUARD = """-- PHASE-03 database ownership guard.
-- A bootstrap superuser may normalize a newly created target database to sjg_owner.
-- Non-superuser migration execution requires the database to already be owned by sjg_owner.
DO $$
DECLARE
  v_owner text;
  v_is_superuser boolean := current_setting('is_superuser')::boolean;
BEGIN
  SELECT pg_get_userbyid(datdba) INTO v_owner
  FROM pg_database
  WHERE datname = current_database();

  IF v_owner IS DISTINCT FROM 'sjg_owner' THEN
    IF v_is_superuser THEN
      EXECUTE format('ALTER DATABASE %I OWNER TO sjg_owner', current_database());
    ELSE
      RAISE EXCEPTION 'database % must be owned by sjg_owner before sjg_migration executes; current owner=%',
        current_database(), v_owner;
    END IF;
  END IF;
END
$$;
"""


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def apply_migration_role_owner_switch(destination: Path) -> None:
    for folder in ("oms", "audit", "dw"):
        path = destination / folder / "V0_1__database_role_access.sql"
        text = path.read_text(encoding="utf-8")
        marker = "GRANT CONNECT, CREATE, TEMPORARY ON DATABASE"
        if marker not in text:
            raise RuntimeError(f"database prelude marker missing: {path}")
        if "SET ROLE sjg_owner;" not in text:
            text = text.replace(marker, "SET ROLE sjg_owner;\n" + marker, 1)
        revoke = "REVOKE CREATE ON SCHEMA public FROM PUBLIC;"
        if revoke not in text:
            raise RuntimeError(f"public schema revoke marker missing: {path}")
        if "RESET ROLE;" not in text:
            text = text.replace(revoke, revoke + "\nRESET ROLE;", 1)
        if "PHASE-03 database ownership guard" not in text:
            text = text.replace("SET ROLE sjg_owner;", OWNER_GUARD.rstrip() + "\n\nSET ROLE sjg_owner;", 1)
        base.write_text(path, text)


def apply_psql_compatibility(destination: Path) -> None:
    manifest_path = destination / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    transformations_applied = 0

    for database in manifest["databases"].values():
        for item in database["approved_source_migrations"]:
            migration_path = destination / item["migration"]
            text = migration_path.read_text(encoding="utf-8")
            source_path = item["source_path"]
            meta_lines = PSQL_META.findall(text)
            variables = sorted(set(PSQL_VARIABLE.findall(text)))

            if not meta_lines and not variables:
                continue

            if source_path != SEED_SOURCE:
                raise RuntimeError(
                    f"unsupported psql client syntax in approved source {source_path}: "
                    f"meta={meta_lines[:3]}, variables={variables}"
                )

            matches = TENANT_SET.findall(text)
            if len(matches) != 1:
                raise RuntimeError(
                    f"expected exactly one approved \\set tenant_id command in {source_path}; got {len(matches)}"
                )
            if variables != ["tenant_id"]:
                raise RuntimeError(
                    f"only approved tenant_id psql variable may be translated in {source_path}; got {variables}"
                )

            source_template_tenant_id = matches[0]
            text = TENANT_SET.sub(
                "-- Flyway compatibility: approved psql tenant_id template is supplied by deployment placeholder sjg_tenant_id.",
                text,
            )
            text = text.replace(":'tenant_id'", f"'{TENANT_PLACEHOLDER}'")

            remaining_meta = PSQL_META.findall(text)
            remaining_variables = sorted(set(PSQL_VARIABLE.findall(text)))
            if remaining_meta or remaining_variables:
                raise RuntimeError(
                    f"unresolved psql syntax after compatibility transform for {source_path}: "
                    f"meta={remaining_meta[:3]}, variables={remaining_variables}"
                )

            base.write_text(migration_path, text)
            item["generated_sha256"] = sha256_bytes(migration_path.read_bytes())
            item["transformations"] = [
                {
                    "type": "psql_set_variable_to_flyway_placeholder",
                    "variable": "tenant_id",
                    "flyway_placeholder": "sjg_tenant_id",
                    "source_template_tenant_id_sha256": sha256_bytes(source_template_tenant_id.encode("utf-8")),
                    "value_source": "deployment environment; approved source explicitly requires production tenant_id replacement",
                    "reason": "Flyway/JDBC does not execute psql client metacommands and tenant identity must not be invented in Git",
                }
            ]
            transformations_applied += 1

    if transformations_applied != 1:
        raise RuntimeError(
            f"expected exactly one approved psql compatibility transformation; got {transformations_applied}"
        )

    policy = manifest["compatibility_policy"] = {
        "allowed_transformations": ["psql_set_variable_to_flyway_placeholder:tenant_id@95_seed_process_catalog.sql"],
        "required_deployment_placeholders": ["sjg_tenant_id", "sjg_tenant_code", "sjg_tenant_name"],
        "migration_execution_role": "sjg_migration",
        "migration_owner_switch": "V0.1 and approved/overlay DDL execute through SET ROLE sjg_owner",
        "unsupported_psql_metacommands": "FAIL_GENERATION",
        "unresolved_psql_variables": "FAIL_GENERATION",
        "transformed_source_count": transformations_applied,
    }
    policy["database_owner"] = "sjg_owner"
    policy["database_owner_guard"] = {
        "already_owned_by_sjg_owner": "CONTINUE",
        "bootstrap_superuser_mismatch": "ALTER_DATABASE_OWNER_TO_sjg_owner",
        "non_superuser_mismatch": "FAIL_MIGRATION",
    }
    base.write_text(manifest_path, json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True))


def build_tree(destination: Path) -> None:
    base.build_tree(destination)
    apply_migration_role_owner_switch(destination)
    apply_psql_compatibility(destination)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="verify committed compatibility output is current")
    args = parser.parse_args()

    if args.check:
        if not OUTPUT_ROOT.exists():
            raise RuntimeError(f"missing generated Flyway directory: {OUTPUT_ROOT}")
        with tempfile.TemporaryDirectory(prefix="phase03-flyway-compat-") as temp:
            expected = Path(temp) / "flyway"
            build_tree(expected)
            base.assert_same_tree(expected, OUTPUT_ROOT)
        print("PHASE-03 Flyway compatibility tree is deterministic and current")
        return

    build_tree(OUTPUT_ROOT)
    print(f"Generated PHASE-03 Flyway compatibility baseline at {OUTPUT_ROOT}")


if __name__ == "__main__":
    main()
