#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def stable_hash(value: object) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def patch_catalog(path: Path, collection_key: str) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    before = stable_hash(data[collection_key])
    data["database_foundation"] = {
        "reviewed_in_phase": "PHASE-03",
        "status": "READY_FOR_GATE",
        "business_implementation_changed": False,
        "business_items_marked_implemented_by_phase03": 0,
        "databases": ["sjg_oms", "sjg_audit", "sjg_dw"],
        "physical_schema_count": 46,
        "table_catalog_count": 265,
        "installed_approved_table_count": 265,
        "index_catalog_count": 1024,
        "approved_ddl_index_count": 1019,
        "catalog_sourced_index_overlay_count": 5,
        "migration_role": "sjg_migration",
        "runtime_roles": ["sjg_api_runtime", "sjg_worker_runtime"],
        "note": "PHASE-03 establishes Flyway/database/role infrastructure only; page/process business implementation states are unchanged.",
    }
    after = stable_hash(data[collection_key])
    if before != after:
        raise RuntimeError(f"{collection_key} business collection changed while adding PHASE-03 metadata")
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def append_section(path: Path, marker: str, section: str) -> None:
    text = path.read_text(encoding="utf-8")
    if marker in text:
        return
    path.write_text(text.rstrip() + "\n\n" + section.strip() + "\n", encoding="utf-8")


def patch_progress(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    replacements = [
        ("> Current construction phase: `PHASE-03 = IN_PROGRESS`", "> Current construction result: `PHASE-03 = PASS / READY_FOR_GATE`"),
        ("PHASE-03 已按用户 E 提示词正式开工，当前为 `IN_PROGRESS`；PHASE-04 仍为 `NOT_STARTED`。", "PHASE-03 已完成施工与阶段内验证，当前为 `PASS / READY_FOR_GATE`；PHASE-04 仍为 `NOT_STARTED`。"),
        ("| PHASE-03 | IN_PROGRESS | 数据库三库、Schema、Flyway 与基础角色正在施工 |", "| PHASE-03 | PASS | 数据库三库、Schema、Flyway 与基础角色完成施工；READY_FOR_GATE |"),
        ("PHASE-03 = IN_PROGRESS\nPHASE-04 = NOT_STARTED", "PHASE-03 = PASS / READY_FOR_GATE\nPHASE-04 = NOT_STARTED"),
        ("本次仅施工 PHASE-03。PHASE-03 完成施工并通过后续 Formal Phase Gate 前，禁止进入 PHASE-04。", "PHASE-03 已完成施工，但在后续 Formal Phase Gate 给出 PASS 前，禁止进入 PHASE-04。"),
        ("- Current state: `IN_PROGRESS`。", "- Current state: `PASS / READY_FOR_GATE`。"),
    ]
    for old, new in replacements:
        if old in text:
            text = text.replace(old, new)
        elif new not in text:
            raise RuntimeError(f"MASTER_PROGRESS expected text not found: {old}")
    path.write_text(text.rstrip() + "\n", encoding="utf-8")
    append_section(
        path,
        "## 10. PHASE-03 database foundation",
        """
## 10. PHASE-03 database foundation

- Scope: `PLATFORM/基础工程`；未实现 P001–P126 领域业务。
- Formal databases: `sjg_oms / sjg_audit / sjg_dw`；PostgreSQL 16。
- Physical Schema: 46；table catalog / installed approved tables: 265 / 265。
- Index baseline: approved DDL 1,019 + 5 catalog-sourced audit tenant index overlays = catalog 1,024。
- Flyway source migrations are deterministically generated from approved Knowledge Base DDL with source/generated SHA-256 provenance.
- Approved V95 psql tenant template is translated only through an explicit compatibility rule and deployment-required tenant placeholders; no production tenant identity is invented in Git.
- Database owner: `sjg_owner` (NOLOGIN); migration identity: `sjg_migration` (NOBYPASSRLS, non-superuser); API/Worker runtime identities are separate and do not execute Flyway.
- Tenant RLS is enforced for every installed base table containing `tenant_id` across all three databases.
- Audit writer is append/read only; UPDATE/DELETE/TRUNCATE negative tests pass.
- PHASE-03 database Testcontainers workflow and runtime identity workflow both passed on the validated implementation checkpoint.
- Business pages/processes marked IMPLEMENTED by PHASE-03: **0**。
- PHASE-04: `NOT_STARTED`；等待 PHASE-03 Formal Phase Gate。
""",
    )


def validate_complete_state() -> None:
    progress = (ROOT / "docs/implementation/MASTER_PROGRESS.md").read_text(encoding="utf-8")
    if "| PHASE-03 | COMPLETE |" not in progress:
        raise RuntimeError("PHASE-03 is not COMPLETE in MASTER_PROGRESS")
    if "| PHASE-04 | NOT_STARTED |" not in progress:
        raise RuntimeError("PHASE-04 must remain NOT_STARTED after the PHASE-03 Formal Gate")

    gate_path = ROOT / "docs/implementation/phases/PHASE-03/PHASE_GATE.md"
    if not gate_path.is_file():
        raise RuntimeError("PHASE-03 PHASE_GATE.md is missing after COMPLETE")
    gate = gate_path.read_text(encoding="utf-8")
    if "PHASE GATE: PASS" not in gate:
        raise RuntimeError("PHASE-03 PHASE_GATE.md must record PASS after COMPLETE")

    catalog_contracts = [
        (ROOT / "docs/implementation/MASTER_PAGE_CATALOG.json", "pages", 7126),
        (ROOT / "docs/implementation/MASTER_PROCESS_CATALOG.json", "processes", 126),
    ]
    for path, collection_key, expected_count in catalog_contracts:
        data = json.loads(path.read_text(encoding="utf-8"))
        collection = data.get(collection_key)
        if not isinstance(collection, list) or len(collection) != expected_count:
            raise RuntimeError(f"unexpected {collection_key} count in {path}: {len(collection) if isinstance(collection, list) else 'missing'}")
        foundation = data.get("database_foundation")
        if not isinstance(foundation, dict):
            raise RuntimeError(f"missing PHASE-03 database_foundation in {path}")
        if foundation.get("reviewed_in_phase") != "PHASE-03":
            raise RuntimeError(f"database foundation provenance drift in {path}")
        if foundation.get("status") not in {"READY_FOR_GATE", "PHASE_03_COMPLETE"}:
            raise RuntimeError(f"unexpected database foundation status in {path}: {foundation.get('status')}")
        if foundation.get("business_implementation_changed") is not False:
            raise RuntimeError(f"business implementation flag drift in {path}")
        if foundation.get("business_items_marked_implemented_by_phase03") != 0:
            raise RuntimeError(f"PHASE-03 business implementation count drift in {path}")
        if foundation.get("databases") != ["sjg_oms", "sjg_audit", "sjg_dw"]:
            raise RuntimeError(f"database foundation database list drift in {path}")
        expected_metrics = {
            "physical_schema_count": 46,
            "table_catalog_count": 265,
            "installed_approved_table_count": 265,
            "index_catalog_count": 1024,
            "approved_ddl_index_count": 1019,
            "catalog_sourced_index_overlay_count": 5,
        }
        for key, value in expected_metrics.items():
            if foundation.get(key) != value:
                raise RuntimeError(f"database foundation metric drift in {path}: {key}={foundation.get(key)} expected {value}")
        if foundation.get("migration_role") != "sjg_migration":
            raise RuntimeError(f"migration role drift in {path}")
        if foundation.get("runtime_roles") != ["sjg_api_runtime", "sjg_worker_runtime"]:
            raise RuntimeError(f"runtime role drift in {path}")

    required_sections = {
        "docs/implementation/MASTER_TRACEABILITY.md": "## PHASE-03 database implementation trace",
        "docs/implementation/MASTER_API_CATALOG.md": "## PHASE-03 API database runtime status",
        "docs/implementation/MASTER_PERMISSION_MATRIX.md": "## PHASE-03 database technical role matrix",
        "docs/implementation/MASTER_DATABASE_MAPPING.md": "## PHASE-03 formal Flyway and role baseline",
        "docs/implementation/MASTER_GAPS.md": "## PHASE-03 database foundation closure",
    }
    for relative, marker in required_sections.items():
        text = (ROOT / relative).read_text(encoding="utf-8")
        if marker not in text:
            raise RuntimeError(f"missing PHASE-03 ledger section in {relative}: {marker}")


def main() -> None:
    progress_path = ROOT / "docs/implementation/MASTER_PROGRESS.md"
    progress = progress_path.read_text(encoding="utf-8")

    # Once the Formal Phase Gate has promoted PHASE-03 to COMPLETE, this finalizer
    # becomes validation-only. It must never regress COMPLETE back to READY_FOR_GATE.
    if "| PHASE-03 | COMPLETE |" in progress:
        validate_complete_state()
        return

    patch_catalog(ROOT / "docs/implementation/MASTER_PAGE_CATALOG.json", "pages")
    patch_catalog(ROOT / "docs/implementation/MASTER_PROCESS_CATALOG.json", "processes")
    patch_progress(progress_path)

    append_section(
        ROOT / "docs/implementation/MASTER_TRACEABILITY.md",
        "## PHASE-03 database implementation trace",
        """
## PHASE-03 database implementation trace

- Business page/process trace collections remain unchanged: 7,126 page records / 126 processes.
- Approved KB DDL → deterministic Flyway migration → source/generated SHA-256 manifest → PostgreSQL 16 Testcontainers migration evidence is now traceable.
- Table baseline: catalog 265 = approved installed table objects 265.
- Index baseline: catalog 1,024 = approved DDL 1,019 + 5 catalog-sourced audit index overlays.
- Deployment tenant seed trace: approved V95 source → explicit psql compatibility rule → required `sjg_tenant_id/code/name` deployment facts → 126 workflow definition seed verification.
- Runtime identity trace: bootstrap admin → `sjg_migration` → `sjg_owner` DDL ownership; API and Worker use distinct NOBYPASSRLS runtime roles and cannot execute DDL.
""",
    )

    append_section(
        ROOT / "docs/implementation/MASTER_API_CATALOG.md",
        "## PHASE-03 API database runtime status",
        """
## PHASE-03 API database runtime status

- Business HTTP API records remain unchanged; PHASE-03 creates no P001–P126 REST endpoint.
- API application database identity is `sjg_api_runtime`; application-internal Flyway is disabled and Flyway dependencies are removed from the API app.
- Worker database identity is `sjg_worker_runtime`; application-internal Flyway is disabled and Flyway dependencies are removed from the Worker app.
- Database structure changes are executed only by the independent PHASE-03 migration runner using `sjg_migration`.
""",
    )

    append_section(
        ROOT / "docs/implementation/MASTER_PERMISSION_MATRIX.md",
        "## PHASE-03 database technical role matrix",
        """
## PHASE-03 database technical role matrix

| Role | LOGIN | Superuser/CreateDB/CreateRole/Replication/BYPASSRLS | Database purpose |
|---|---|---|---|
| `sjg_owner` | NO | all NO | owns formal databases/Schemas/tables; runtime cannot log in as owner |
| `sjg_migration` | YES | all NO | independent Flyway execution; controlled membership allows `SET ROLE sjg_owner` |
| `sjg_api_runtime` | YES | all NO | OMS API runtime; no Schema CREATE / DDL |
| `sjg_worker_runtime` | YES | all NO | OMS Worker runtime; no Schema CREATE / DDL |
| `sjg_audit_writer` | YES | all NO | audit INSERT/SELECT only; UPDATE/DELETE/TRUNCATE denied |
| `sjg_auditor` | YES | all NO | audit read-only |
| `sjg_dw_writer` | YES | all NO | analytics load/write role only |
| `sjg_dw_reader` | YES | all NO | analytics read-only |

- `sjg_app` is retained only as a NOLOGIN compatibility role because approved audit DDL references it; new runtime code must not use it.
- These are technical database roles, not business approval permissions and not a substitute for later RBAC/ABAC/field permission implementation.
""",
    )

    append_section(
        ROOT / "docs/implementation/MASTER_DATABASE_MAPPING.md",
        "## PHASE-03 formal Flyway and role baseline",
        """
## PHASE-03 formal Flyway and role baseline

- Formal databases: PostgreSQL 16 `sjg_oms / sjg_audit / sjg_dw`.
- Physical Schema count: **46**.
- Table catalog: **265**; current approved DDL unique CREATE TABLE: **265**; deterministic diff: catalog-only 0 / DDL-only 0.
- Index catalog: **1,024**; current approved DDL CREATE INDEX: **1,019**; the five catalog-only audit `tenant_id` indexes are implemented as a source-traceable Flyway overlay, yielding the formal 1,024-index baseline.
- Flyway generated source migrations live under `technical-platform/database/flyway/**`; technical overlays live under `technical-platform/database/flyway-overlays/**`; formal structural SQL elsewhere under `technical-platform` is rejected by CI.
- `manifest.json` records KB source path/source SHA-256/generated migration SHA-256 and the one explicit V95 psql compatibility transformation.
- Required tenant deployment facts: `sjg_tenant_id / sjg_tenant_code / sjg_tenant_name`; no production tenant default is stored in Git.
- Formal database owner: `sjg_owner`; formal migration role: `sjg_migration`; API/Worker runtime roles are separate and application Flyway is disabled.
- All base tables containing `tenant_id` are verified to have PostgreSQL RLS and at least one policy; runtime roles are NOBYPASSRLS.
- Audit runtime write contract is INSERT/SELECT only; UPDATE/DELETE/TRUNCATE are verified rejected.
""",
    )

    append_section(
        ROOT / "docs/implementation/MASTER_GAPS.md",
        "## PHASE-03 database foundation closure",
        """
## PHASE-03 database foundation closure

- PHASE-03 status: `PASS / READY_FOR_GATE`; Formal Phase Gate is still required before PHASE-04.
- Historical table-count conflict (`catalog 265` vs old mechanical DDL scan 266) has been re-counted deterministically against current sources: **catalog 265 / approved DDL unique tables 265 / diff 0**.
- Historical index-count conflict is now exact: **catalog 1,024 / approved DDL 1,019 / catalog-only 5 / DDL-only 0**. The five catalogued audit tenant indexes are implemented as a sourced overlay; the original approved DDL package remains unchanged and the provenance difference remains documented.
- Approved V95 psql syntax and tenant bootstrap precondition are closed by an explicit compatibility/deployment-placeholder layer; no production tenant facts are invented.
- Flyway empty install, validate, repeat migration, migration role, database owner, RLS coverage, audit immutability, API/Worker DDL-negative tests are automated.
- Existing non-PHASE-03 source gaps (for example form-count differences and missing Knowledge Base agent pointer directory) remain preserved for their owning phases.
""",
    )


if __name__ == "__main__":
    main()
