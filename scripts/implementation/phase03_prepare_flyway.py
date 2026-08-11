#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = ROOT / "Knowledge Base/03 数据库需求规则/03_SQL_DDL"
OUTPUT_ROOT = ROOT / "technical-platform/database/flyway"

DB_SPECS = {
    "sjg_oms": {
        "source": SOURCE_ROOT / "01_sjg_oms",
        "target": "oms",
        "runtime_roles": ("sjg_api_runtime", "sjg_worker_runtime"),
    },
    "sjg_audit": {
        "source": SOURCE_ROOT / "02_sjg_audit",
        "target": "audit",
        "runtime_roles": ("sjg_audit_writer", "sjg_auditor"),
    },
    "sjg_dw": {
        "source": SOURCE_ROOT / "03_sjg_dw",
        "target": "dw",
        "runtime_roles": ("sjg_dw_writer", "sjg_dw_reader"),
    },
}

ROLE_CONTRACT = """-- PHASE-03 platform database role baseline.
-- Passwords/secrets are intentionally NOT stored in Git/Flyway.
-- Environment provisioning may set passwords on LOGIN roles after this migration.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sjg_owner') THEN
    CREATE ROLE sjg_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sjg_migration') THEN
    CREATE ROLE sjg_migration LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sjg_api_runtime') THEN
    CREATE ROLE sjg_api_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sjg_worker_runtime') THEN
    CREATE ROLE sjg_worker_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sjg_audit_writer') THEN
    CREATE ROLE sjg_audit_writer LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sjg_auditor') THEN
    CREATE ROLE sjg_auditor LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sjg_dw_writer') THEN
    CREATE ROLE sjg_dw_writer LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sjg_dw_reader') THEN
    CREATE ROLE sjg_dw_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  -- Compatibility role referenced by the approved audit DDL. New runtime code MUST NOT use it.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sjg_app') THEN
    CREATE ROLE sjg_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

ALTER ROLE sjg_owner NOSUPERUSER NOCREATEDB NOCREATEROLE NOLOGIN NOINHERIT NOREPLICATION NOBYPASSRLS;
ALTER ROLE sjg_migration NOSUPERUSER NOCREATEDB NOCREATEROLE LOGIN NOINHERIT NOREPLICATION NOBYPASSRLS;
ALTER ROLE sjg_api_runtime NOSUPERUSER NOCREATEDB NOCREATEROLE LOGIN NOINHERIT NOREPLICATION NOBYPASSRLS;
ALTER ROLE sjg_worker_runtime NOSUPERUSER NOCREATEDB NOCREATEROLE LOGIN NOINHERIT NOREPLICATION NOBYPASSRLS;
ALTER ROLE sjg_audit_writer NOSUPERUSER NOCREATEDB NOCREATEROLE LOGIN NOINHERIT NOREPLICATION NOBYPASSRLS;
ALTER ROLE sjg_auditor NOSUPERUSER NOCREATEDB NOCREATEROLE LOGIN NOINHERIT NOREPLICATION NOBYPASSRLS;
ALTER ROLE sjg_dw_writer NOSUPERUSER NOCREATEDB NOCREATEROLE LOGIN NOINHERIT NOREPLICATION NOBYPASSRLS;
ALTER ROLE sjg_dw_reader NOSUPERUSER NOCREATEDB NOCREATEROLE LOGIN NOINHERIT NOREPLICATION NOBYPASSRLS;

GRANT sjg_owner TO sjg_migration;
"""


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.rstrip() + "\n", encoding="utf-8", newline="\n")


def source_files(source_dir: Path) -> list[Path]:
    files = sorted(source_dir.glob("*.sql"), key=lambda p: int(p.name.split("_", 1)[0]))
    if not files:
        raise RuntimeError(f"no approved DDL found in {source_dir}")
    seen: set[int] = set()
    for path in files:
        match = re.match(r"^(\d+)_([A-Za-z0-9_]+)\.sql$", path.name)
        if not match:
            raise RuntimeError(f"unsupported approved DDL filename: {path.name}")
        version = int(match.group(1))
        if version in seen:
            raise RuntimeError(f"duplicate source version {version} in {source_dir}")
        seen.add(version)
    return files


def migration_name(source: Path) -> str:
    match = re.match(r"^(\d+)_([A-Za-z0-9_]+)\.sql$", source.name)
    if not match:
        raise RuntimeError(source.name)
    return f"V{int(match.group(1))}__{match.group(2)}.sql"


def database_prelude(database: str, runtime_roles: tuple[str, ...]) -> str:
    connect_roles = ", ".join(runtime_roles)
    grants = "\n".join(f"GRANT CONNECT ON DATABASE {database} TO {role};" for role in runtime_roles)
    return f"""-- Technical prelude generated by PHASE-03.
DO $$
BEGIN
  IF current_database() <> '{database}' THEN
    RAISE EXCEPTION 'PHASE-03 migration expected database {database}, got %', current_database();
  END IF;
END
$$;

GRANT CONNECT, CREATE, TEMPORARY ON DATABASE {database} TO sjg_owner;
GRANT CONNECT ON DATABASE {database} TO sjg_migration;
{grants}
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
-- Runtime principals ({connect_roles}) receive schema/table privileges only in the post-grant migration.
"""


def oms_runtime_grants() -> str:
    return """-- PHASE-03 least-privilege runtime grants for sjg_oms.
SET ROLE sjg_owner;
DO $$
DECLARE s record;
BEGIN
  FOR s IN
    SELECT nspname FROM pg_namespace
    WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'public')
      AND nspname NOT LIKE 'pg_toast%'
      AND nspname NOT LIKE 'pg_temp_%'
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO sjg_api_runtime, sjg_worker_runtime', s.nspname);
    EXECUTE format('REVOKE CREATE ON SCHEMA %I FROM sjg_api_runtime, sjg_worker_runtime', s.nspname);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO sjg_api_runtime, sjg_worker_runtime', s.nspname);
    EXECUTE format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA %I TO sjg_api_runtime, sjg_worker_runtime', s.nspname);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE sjg_owner IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sjg_api_runtime, sjg_worker_runtime', s.nspname);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE sjg_owner IN SCHEMA %I GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO sjg_api_runtime, sjg_worker_runtime', s.nspname);
  END LOOP;
END
$$;
RESET ROLE;
"""


def audit_runtime_grants() -> str:
    return """-- PHASE-03 immutable audit runtime contract.
SET ROLE sjg_owner;
GRANT USAGE ON SCHEMA audit TO sjg_audit_writer, sjg_auditor;
REVOKE CREATE ON SCHEMA audit FROM sjg_audit_writer, sjg_auditor;
REVOKE UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA audit FROM sjg_audit_writer, sjg_auditor, sjg_app;
GRANT INSERT, SELECT ON ALL TABLES IN SCHEMA audit TO sjg_audit_writer;
GRANT SELECT ON ALL TABLES IN SCHEMA audit TO sjg_auditor;
ALTER DEFAULT PRIVILEGES FOR ROLE sjg_owner IN SCHEMA audit GRANT INSERT, SELECT ON TABLES TO sjg_audit_writer;
ALTER DEFAULT PRIVILEGES FOR ROLE sjg_owner IN SCHEMA audit GRANT SELECT ON TABLES TO sjg_auditor;
RESET ROLE;
"""


def dw_runtime_grants() -> str:
    return """-- PHASE-03 analytics writer/reader contract. Business API roles receive no direct sjg_dw privileges.
SET ROLE sjg_owner;
GRANT USAGE ON SCHEMA analytics TO sjg_dw_writer, sjg_dw_reader;
REVOKE CREATE ON SCHEMA analytics FROM sjg_dw_writer, sjg_dw_reader;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA analytics TO sjg_dw_writer;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO sjg_dw_reader;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA analytics TO sjg_dw_writer;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA analytics TO sjg_dw_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE sjg_owner IN SCHEMA analytics GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sjg_dw_writer;
ALTER DEFAULT PRIVILEGES FOR ROLE sjg_owner IN SCHEMA analytics GRANT SELECT ON TABLES TO sjg_dw_reader;
RESET ROLE;
"""


def generated_source_migration(source: Path) -> tuple[str, dict[str, str]]:
    raw = source.read_bytes()
    source_sha = sha256_bytes(raw)
    body = raw.decode("utf-8-sig").replace("\r\n", "\n").replace("\r", "\n").rstrip()
    rel = source.relative_to(ROOT).as_posix()
    content = f"""-- GENERATED FROM APPROVED KNOWLEDGE BASE DDL. DO NOT EDIT THIS FILE DIRECTLY.
-- source_path: {rel}
-- source_sha256: {source_sha}
SET ROLE sjg_owner;
{body}
RESET ROLE;
"""
    return content, {"source_path": rel, "source_sha256": source_sha}


def build_tree(destination: Path) -> dict[str, object]:
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True)

    manifest: dict[str, object] = {
        "phase": "PHASE-03",
        "source_root": SOURCE_ROOT.relative_to(ROOT).as_posix(),
        "policy": "approved Knowledge Base DDL is copied deterministically; source bodies keep SQL semantics and execute as sjg_owner",
        "databases": {},
    }

    cluster = destination / "cluster"
    write_text(cluster / "V1__platform_roles.sql", ROLE_CONTRACT)

    post_grants = {
        "sjg_oms": oms_runtime_grants(),
        "sjg_audit": audit_runtime_grants(),
        "sjg_dw": dw_runtime_grants(),
    }

    for database, spec in DB_SPECS.items():
        target = destination / str(spec["target"])
        target.mkdir(parents=True, exist_ok=True)
        write_text(target / "V0_1__database_role_access.sql", database_prelude(database, tuple(spec["runtime_roles"])))
        entries: list[dict[str, str]] = []
        for source in source_files(Path(spec["source"])):
            generated, provenance = generated_source_migration(source)
            name = migration_name(source)
            write_text(target / name, generated)
            entries.append({
                "migration": f"{spec['target']}/{name}",
                **provenance,
                "generated_sha256": sha256_bytes((target / name).read_bytes()),
            })
        write_text(target / "V99__runtime_grants.sql", post_grants[database])
        manifest["databases"][database] = {
            "target": str(spec["target"]),
            "approved_source_migrations": entries,
            "source_count": len(entries),
            "runtime_roles": list(spec["runtime_roles"]),
        }

    readme = """# PHASE-03 Flyway Database Baseline

This directory is generated from `Knowledge Base/03 数据库需求规则/03_SQL_DDL` by
`scripts/implementation/phase03_prepare_flyway.py`.

- `cluster/`: PostgreSQL cluster role contract; no passwords are committed.
- `oms/`: `sjg_oms` approved DDL + technical role/grant wrappers.
- `audit/`: `sjg_audit` approved DDL + immutable audit grant wrapper.
- `dw/`: `sjg_dw` approved DDL + analytics writer/reader grant wrapper.
- `manifest.json`: source path/hash → generated migration hash provenance.

Never hand-edit generated source migrations. Change the approved Knowledge Base source only through an approved
requirements/database change, then regenerate. Technical wrappers belong to PHASE-03 and are covered by integration tests.
Runtime passwords/login secret provisioning is environment-specific and MUST stay outside Git.
"""
    write_text(destination / "README.md", readme)
    write_text(destination / "manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True))
    return manifest


def list_files(root: Path) -> list[Path]:
    return sorted(path.relative_to(root) for path in root.rglob("*") if path.is_file())


def assert_same_tree(expected: Path, actual: Path) -> None:
    expected_files = list_files(expected)
    actual_files = list_files(actual)
    if expected_files != actual_files:
        raise RuntimeError(f"generated Flyway file set differs: expected={expected_files}, actual={actual_files}")
    for relative in expected_files:
        left = (expected / relative).read_bytes()
        right = (actual / relative).read_bytes()
        if left != right:
            raise RuntimeError(f"generated Flyway file is stale: {relative}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="verify committed output is deterministic and current")
    args = parser.parse_args()

    if args.check:
        if not OUTPUT_ROOT.exists():
            raise RuntimeError(f"missing generated Flyway directory: {OUTPUT_ROOT}")
        with tempfile.TemporaryDirectory(prefix="phase03-flyway-") as temp:
            expected = Path(temp) / "flyway"
            build_tree(expected)
            assert_same_tree(expected, OUTPUT_ROOT)
        print("PHASE-03 Flyway generated tree is deterministic and current")
        return

    build_tree(OUTPUT_ROOT)
    print(f"Generated PHASE-03 Flyway baseline at {OUTPUT_ROOT}")


if __name__ == "__main__":
    main()
