#!/usr/bin/env python3
"""Fail closed on the PHASE-10 maintainability regressions reviewed on 2026-08-14."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / "technical-platform" / "backend" / "modules" / "workflow"
API = ROOT / "technical-platform" / "backend" / "apps" / "api"

P010_WRITER = WORKFLOW / "src/main/java/cn/shangjingu/platform/workflow/P010LearningInsertWriter.java"
P007_WRITER = WORKFLOW / "src/main/java/cn/shangjingu/platform/workflow/P007ShiftChangeInsertWriter.java"
P007_GUARD = WORKFLOW / "src/main/java/cn/shangjingu/platform/workflow/GuardedShiftChangeRepository.java"
PHASE10_HANDLER = API / "src/main/java/cn/shangjingu/platform/api/phase10/Phase10ApiExceptionHandler.java"
FORMATTED_GUARDS = [
    P007_GUARD,
    WORKFLOW / "src/main/java/cn/shangjingu/platform/workflow/GuardedLeaveRepository.java",
    WORKFLOW / "src/main/java/cn/shangjingu/platform/workflow/GuardedOvertimeRepository.java",
]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def text_block(source: str, constant: str) -> str:
    match = re.search(
        rf"static final String {re.escape(constant)}\s*=\s*\"\"\"(.*?)\"\"\";",
        source,
        re.DOTALL,
    )
    require(match is not None, f"missing SQL constant {constant}")
    return match.group(1)


def verify_named_writes() -> None:
    p010 = P010_WRITER.read_text(encoding="utf-8")
    require("NamedParameterJdbcTemplate" in p010, "P010 insert writer must use named JDBC")
    require("MapSqlParameterSource" in p010, "P010 insert writer must bind an explicit parameter source")
    require("?" not in text_block(p010, "INSERT_SQL"), "P010 insert SQL regressed to positional binding")

    p007 = P007_WRITER.read_text(encoding="utf-8")
    require("NamedParameterJdbcTemplate" in p007, "P007 canonical insert must use named JDBC")
    require("MapSqlParameterSource" in p007, "P007 canonical insert must bind an explicit parameter source")
    require("?" not in text_block(p007, "INSERT_SQL"), "P007 insert SQL regressed to positional binding")

    guard = P007_GUARD.read_text(encoding="utf-8")
    require("P007ShiftChangeInsertWriter insertWriter" in guard, "P007 guard lost the named insert writer")
    require("insertWriter.insert(record, actor);" in guard, "P007 production write path bypasses the named writer")


def verify_guard_readability() -> None:
    violations: list[str] = []
    for path in FORMATTED_GUARDS:
        for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if len(line) > 120:
                violations.append(f"{path.relative_to(ROOT)}:{line_number}:{len(line)}")
    require(not violations, "Guarded repository readability regression:\n" + "\n".join(violations))


def verify_exception_contract() -> None:
    source = PHASE10_HANDLER.read_text(encoding="utf-8")
    for token in (
        "ProcessRejectedException.class",
        "OptimisticLockingFailureException.class",
        "IllegalArgumentException.class",
        "APPLICATION_PROBLEM_JSON",
        '"PROCESS_REJECTED"',
        '"STALE_VERSION"',
        '"NOT_FOUND"',
        '"INVALID_ARGUMENT"',
    ):
        require(token in source, f"PHASE-10 exception contract lost {token}")


def verify_spotless_gate() -> None:
    pom = (ROOT / "pom.xml").read_text(encoding="utf-8")
    require("spotless-maven-plugin" in pom, "Spotless plugin is not configured")
    require("<phase>validate</phase>" in pom, "Spotless check is not bound to Maven validate")
    require("<goal>check</goal>" in pom, "Spotless validate execution lost its check goal")


def verify() -> None:
    for path in [P010_WRITER, P007_WRITER, P007_GUARD, PHASE10_HANDLER, *FORMATTED_GUARDS]:
        require(path.is_file(), f"required remediation file missing: {path.relative_to(ROOT)}")
    verify_named_writes()
    verify_guard_readability()
    verify_exception_contract()
    verify_spotless_gate()


def main() -> None:
    verify()
    print("PHASE-10 remediation contract is named, readable, standardized and CI-enforced")


if __name__ == "__main__":
    main()
