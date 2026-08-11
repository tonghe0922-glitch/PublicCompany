#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PHASE = ROOT / "docs" / "implementation" / "phases" / "PHASE-08"
WEB = ROOT / "technical-platform" / "web"


def require_file(path: Path) -> str:
    if not path.is_file():
        raise SystemExit(f"missing required C0 file: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def require_fragments(path: Path, fragments: tuple[str, ...]) -> None:
    text = require_file(path)
    for fragment in fragments:
        if fragment not in text:
            raise SystemExit(f"missing C0 fragment {fragment!r}: {path.relative_to(ROOT)}")


def verify_ia() -> None:
    evidence = PHASE / "PAGE_IA_EXTRACT.json"
    require_file(evidence)
    payload = json.loads(evidence.read_text(encoding="utf-8"))
    if payload.get("source_count") != 6 or payload.get("parse_failures") != 0:
        raise SystemExit("six IA workbooks are not cleanly parsed")
    cross = payload.get("phase01_cross_check", {})
    if cross.get("matching_ia_page_records") != 7126:
        raise SystemExit("PHASE-01 page-record cross-check is not 7,126")
    if len(payload.get("workbooks", [])) != 6:
        raise SystemExit("IA workbook evidence does not contain six sources")


def verify_openapi() -> None:
    path = ROOT / "docs/implementation/contracts/phase-04/openapi.yaml"
    require_fragments(path, (
        "version: 0.2.0-phase08-consumer-contract",
        "LoginRequest:", "RefreshRequest:", "SessionTokenResponse:",
        "AvailableIdentityView:", "SessionView:", "SwitchRequest:",
        "StepUpRequest:", "StepUpResponse:", "ApiProblem:",
        "availableIdentities:", "application/problem+json",
    ))


def verify_backend_contract() -> None:
    controller = ROOT / "technical-platform/backend/apps/api/src/main/java/cn/shangjingu/platform/api/security/SessionController.java"
    require_fragments(controller, (
        "activeIdentities(principal.context().tenantId(), principal.context().userId())",
        "AvailableIdentityView", "availableIdentities", "identity.identityName()",
    ))
    test = ROOT / "technical-platform/backend/apps/api/src/test/java/cn/shangjingu/platform/api/security/SessionControllerContractTest.java"
    require_fragments(test, (
        "currentSessionReturnsServerAuthorizedIdentityCandidatesAndSortedPermissions",
        "IDENTITY_A, IDENTITY_B", "activeIdentities(TENANT, USER)",
    ))


def verify_adrs() -> None:
    for name in (
        "ADR_001_SESSION_IDENTITY_CONTRACT.md", "ADR_002_BROWSER_TOKEN_PERSISTENCE.md",
        "ADR_003_API_ORIGIN_PROXY.md", "ADR_004_ROUTE_CATALOG_STRATEGY.md",
    ):
        require_fragments(PHASE / name, ("Status: `ACCEPTED_FOR_PHASE_08_C0`",))
    require_fragments(PHASE / "SOURCE_CONTRACT.md", ("Contract state: `C0_FROZEN",))


def verify_frontend_boundary() -> None:
    require_fragments(WEB / "vite.config.ts", (
        "SJG_LOCAL_API_PROXY_TARGET", "'/api'", "http://127.0.0.1:8080", "portalServer(portal.port)",
    ))
    forbidden: list[str] = []
    for path in WEB.joinpath("src").rglob("*"):
        if path.suffix not in {".ts", ".vue"}:
            continue
        if "localStorage" in path.read_text(encoding="utf-8"):
            forbidden.append(path.relative_to(ROOT).as_posix())
    if forbidden:
        raise SystemExit("credential-unsafe localStorage use found: " + ", ".join(forbidden))
    if WEB.joinpath("src/portals/tech").exists():
        raise SystemExit("fourth tech runtime directory is forbidden; tech runtime alias remains admin")


def verify_phase_boundary() -> None:
    progress = require_file(ROOT / "docs/implementation/MASTER_PROGRESS.md")
    if "| PHASE-08 | COMPLETE |" not in progress:
        raise SystemExit("PHASE-08 must remain COMPLETE during later-phase regression")
    if not any(marker in progress for marker in (
        "| PHASE-09 | NOT_STARTED |", "| PHASE-09 | IN_PROGRESS |",
        "| PHASE-09 | READY_FOR_GATE |", "| PHASE-09 | COMPLETE |",
    )):
        raise SystemExit("PHASE-09 must be in a legal lifecycle state")
    if "| PHASE-10 | NOT_STARTED |" not in progress:
        raise SystemExit("PHASE-10 must remain NOT_STARTED while PHASE-09 is active")
    if "| PHASE-07 | COMPLETE |" not in progress:
        raise SystemExit("PHASE-07 must remain COMPLETE")


def main() -> None:
    verify_phase_boundary()
    verify_ia()
    verify_openapi()
    verify_backend_contract()
    verify_adrs()
    verify_frontend_boundary()
    print("PHASE-08 C0 source and contract regression PASS")


if __name__ == "__main__":
    main()
