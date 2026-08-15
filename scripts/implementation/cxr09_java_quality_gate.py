from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Any


PRIORITY_MODULES = {"attendance", "learning", "performance", "reward", "welfare"}
REQUIRED_COVERAGE_CLASSES = {
    "cn/shangjingu/platform/performance/PerformanceCycleService",
    "cn/shangjingu/platform/attendance/LeaveService",
    "cn/shangjingu/platform/attendance/OvertimeService",
    "cn/shangjingu/platform/attendance/ShiftChangeService",
    "cn/shangjingu/platform/learning/LearningAssignmentService",
    "cn/shangjingu/platform/hr/promotion/PromotionRequestService",
    "cn/shangjingu/platform/reward/RewardCaseService",
    "cn/shangjingu/platform/reward/DisciplineCaseService",
    "cn/shangjingu/platform/reward/PointLedgerService",
    "cn/shangjingu/platform/welfare/P016CareService",
    "cn/shangjingu/platform/iam/authorization/AuthorizationService",
    "cn/shangjingu/platform/core/process/SequentialStateMachine",
    "cn/shangjingu/platform/core/process/IdempotencyRegistry",
    "cn/shangjingu/platform/workflow/WorkflowCandidateResolver",
}
CRITICAL_COVERAGE_CLASSES = {
    "cn/shangjingu/platform/iam/authorization/AuthorizationService",
    "cn/shangjingu/platform/core/process/SequentialStateMachine",
    "cn/shangjingu/platform/core/process/IdempotencyRegistry",
    "cn/shangjingu/platform/workflow/WorkflowCandidateResolver",
    "cn/shangjingu/platform/reward/PointLedgerService",
}
SOURCE_SUFFIXES = {".java"}
GENERATED_PARTS = {"target", ".runlogs", "generated", "generated-sources", "generated-test-sources"}


@dataclass
class LexState:
    block_comment: bool = False
    text_block: bool = False


@dataclass
class HeaderState:
    depth: int = 0


def finding(code: str, path: Path | str, line: int, metric: str) -> dict[str, Any]:
    return {"code": code, "path": Path(path).as_posix(), "line": line, "metric": metric}


def is_priority_java(repo_root: Path, path: Path) -> bool:
    try:
        relative = path.resolve().relative_to(repo_root.resolve()).as_posix()
    except ValueError:
        return False
    parts = set(Path(relative).parts)
    if parts & GENERATED_PARTS:
        return False
    module_match = re.search(r"technical-platform/backend/modules/([^/]+)/", relative)
    if module_match and module_match.group(1) in PRIORITY_MODULES:
        return True
    if re.search(r"technical-platform/backend/apps/api/src/(?:main|test)/java/.*/(?:phase10|phase11)/", relative):
        return True
    if re.search(r"technical-platform/backend/apps/api/src/test/java/.*/Phase(?:10|11)[^/]*\.java$", relative):
        return True
    if re.search(r"technical-platform/backend/modules/database-baseline/src/test/java/.*/Phase(?:10|11)[^/]*\.java$", relative):
        return True
    return bool(re.search(r"technical-platform/backend/apps/worker/src/main/java/.*/Phase(?:10|11)[^/]*\.java$", relative))


def priority_java_files(repo_root: Path) -> list[Path]:
    backend = repo_root / "technical-platform" / "backend"
    if not backend.is_dir():
        return []
    return sorted(path for path in backend.rglob("*.java") if is_priority_java(repo_root, path))


def visible_java_code(line: str, state: LexState) -> str:
    visible: list[str] = []
    cursor = 0
    while cursor < len(line):
        if state.text_block:
            end = line.find('"""', cursor)
            if end < 0:
                return "".join(visible)
            state.text_block = False
            cursor = end + 3
            continue
        if state.block_comment:
            end = line.find("*/", cursor)
            if end < 0:
                return "".join(visible)
            state.block_comment = False
            cursor = end + 2
            continue
        if line.startswith("//", cursor):
            break
        if line.startswith("/*", cursor):
            state.block_comment = True
            cursor += 2
            continue
        if line.startswith('"""', cursor):
            state.text_block = True
            cursor += 3
            continue
        if line[cursor] in {'"', "'"}:
            quote = line[cursor]
            cursor += 1
            while cursor < len(line):
                if line[cursor] == "\\":
                    cursor += 2
                    continue
                if line[cursor] == quote:
                    cursor += 1
                    break
                cursor += 1
            continue
        visible.append(line[cursor])
        cursor += 1
    return "".join(visible)


def statement_counts(lines: list[str]) -> list[int]:
    lex_state = LexState()
    header_state = HeaderState()
    counts: list[int] = []
    for line in lines:
        code = visible_java_code(line, lex_state)
        count = 0
        cursor = 0
        while cursor < len(code):
            if header_state.depth:
                if code[cursor] == "(":
                    header_state.depth += 1
                elif code[cursor] == ")":
                    header_state.depth -= 1
                cursor += 1
                continue
            header = re.match(r"(?:for|try)\s*\(", code[cursor:])
            if header and (cursor == 0 or not (code[cursor - 1].isalnum() or code[cursor - 1] in "_$")):
                header_state.depth = 1
                cursor += header.end()
                continue
            if code[cursor] == ";":
                count += 1
            cursor += 1
        counts.append(count)
    return counts


def scan_java(repo_root: Path) -> tuple[list[Path], list[dict[str, Any]]]:
    files = priority_java_files(repo_root)
    findings: list[dict[str, Any]] = []
    for path in files:
        relative = path.relative_to(repo_root)
        lines = path.read_text(encoding="utf-8").splitlines()
        lex_state = LexState()
        for line_number, line in enumerate(lines, start=1):
            visible = visible_java_code(line, lex_state)
            if len(line) > 400 and visible.strip():
                findings.append(finding("JAVA_LINE_OVER_400", relative, line_number, f"length={len(line)}"))
        for line_number, count in enumerate(statement_counts(lines), start=1):
            if count > 1:
                findings.append(finding("JAVA_DENSE_STATEMENT", relative, line_number, f"statements={count}"))
    return files, findings


def counter_values(element: ET.Element, counter_type: str) -> tuple[int, int]:
    counter = next((item for item in element.findall("counter") if item.get("type") == counter_type), None)
    if counter is None:
        raise ValueError(f"MISSING_COUNTER:{counter_type}")
    missed = int(counter.get("missed", "0"))
    covered = int(counter.get("covered", "0"))
    if missed + covered == 0:
        raise ValueError(f"ZERO_DENOMINATOR:{counter_type}")
    return missed, covered


def coverage_findings(report_path: Path) -> list[dict[str, Any]]:
    if not report_path.is_file():
        return [finding("MISSING_REPORT", report_path, 0, "required=true")]
    try:
        root = ET.parse(report_path).getroot()
    except (ET.ParseError, OSError, ValueError) as error:
        return [finding("INVALID_REPORT", report_path, 0, type(error).__name__)]
    classes = {item.get("name", ""): item for item in root.findall(".//class")}
    findings: list[dict[str, Any]] = []
    for class_name in sorted(REQUIRED_COVERAGE_CLASSES):
        element = classes.get(class_name)
        if element is None:
            findings.append(finding("MISSING_CLASS", report_path, 0, class_name))
            continue
        try:
            missed, covered = counter_values(element, "LINE")
            ratio = covered / (missed + covered)
            if ratio < 0.80:
                findings.append(finding("CLASS_LINE_BELOW_80", report_path, 0, f"{class_name}:{ratio:.6f}"))
        except ValueError as error:
            findings.append(finding(str(error).split(":", 1)[0], report_path, 0, f"{class_name}:{error}"))
    critical_missed = 0
    critical_covered = 0
    for class_name in sorted(CRITICAL_COVERAGE_CLASSES):
        element = classes.get(class_name)
        if element is None:
            continue
        try:
            missed, covered = counter_values(element, "BRANCH")
            critical_missed += missed
            critical_covered += covered
            ratio = covered / (missed + covered)
            if ratio < 0.90:
                findings.append(finding("CRITICAL_BRANCH_BELOW_90", report_path, 0, f"{class_name}:{ratio:.6f}"))
        except ValueError as error:
            findings.append(finding(str(error).split(":", 1)[0], report_path, 0, f"{class_name}:{error}"))
    try:
        missed, covered = counter_values(root, "LINE")
        ratio = covered / (missed + covered)
        if ratio < 0.80:
            findings.append(finding("AGGREGATE_LINE_BELOW_80", report_path, 0, f"ratio={ratio:.6f}"))
    except ValueError as error:
        findings.append(finding(str(error).split(":", 1)[0], report_path, 0, f"aggregate:{error}"))
    critical_total = critical_missed + critical_covered
    if critical_total == 0:
        findings.append(finding("ZERO_DENOMINATOR", report_path, 0, "critical-aggregate-branch"))
    elif critical_covered / critical_total < 0.90:
        findings.append(
            finding(
                "CRITICAL_AGGREGATE_BRANCH_BELOW_90",
                report_path,
                0,
                f"ratio={critical_covered / critical_total:.6f}",
            )
        )
    return findings


def synthetic_report(
    class_counters: dict[str, dict[str, tuple[int, int]]],
    aggregate_line: tuple[int, int],
) -> str:
    classes = "".join(
        '<class name="{}">{}</class>'.format(
            class_name,
            "".join(
                f'<counter type="{kind}" missed="{values[0]}" covered="{values[1]}"/>'
                for kind, values in counters.items()
            ),
        )
        for class_name, counters in class_counters.items()
    )
    return (
        '<report name="synthetic"><package name="priority">'
        f"{classes}</package>"
        f'<counter type="LINE" missed="{aggregate_line[0]}" covered="{aggregate_line[1]}"/>'
        "</report>"
    )


def write_report(path: Path, xml_text: str) -> None:
    path.write_text(xml_text, encoding="utf-8")


def compliant_counters() -> dict[str, dict[str, tuple[int, int]]]:
    return {
        class_name: {"LINE": (20, 80), **({"BRANCH": (10, 90)} if class_name in CRITICAL_COVERAGE_CLASSES else {})}
        for class_name in REQUIRED_COVERAGE_CLASSES
    }


def run_self_test() -> dict[str, Any]:
    cases: list[dict[str, Any]] = []

    def record(name: str, passed: bool) -> None:
        cases.append({"name": name, "passed": passed})

    with tempfile.TemporaryDirectory(prefix="cxr09-quality-self-") as directory:
        root = Path(directory)
        source = root / "technical-platform/backend/modules/performance/src/main/java/example/Sample.java"
        source.parent.mkdir(parents=True)
        source.write_text("class Sample {\n" + "x" * 401 + "\n}\n", encoding="utf-8")
        _, scan = scan_java(root)
        record("long-code-line-rejected", any(item["code"] == "JAVA_LINE_OVER_400" for item in scan))
        source.write_text("class Sample { void run() { first(); second(); } }\n", encoding="utf-8")
        _, scan = scan_java(root)
        record("dense-statement-rejected", any(item["code"] == "JAVA_DENSE_STATEMENT" for item in scan))

        missing = root / "missing.xml"
        record("missing-report-rejected", any(item["code"] == "MISSING_REPORT" for item in coverage_findings(missing)))

        report = root / "coverage.xml"
        counters = compliant_counters()
        counters[next(iter(CRITICAL_COVERAGE_CLASSES))]["BRANCH"] = (0, 0)
        write_report(report, synthetic_report(counters, (20, 80)))
        record("zero-denominator-rejected", any(item["code"] == "ZERO_DENOMINATOR" for item in coverage_findings(report)))

        counters = compliant_counters()
        ordinary = next(iter(REQUIRED_COVERAGE_CLASSES - CRITICAL_COVERAGE_CLASSES))
        counters[ordinary]["LINE"] = (2001, 7999)
        write_report(report, synthetic_report(counters, (20, 80)))
        record("line-79.99-rejected", any(item["code"] == "CLASS_LINE_BELOW_80" for item in coverage_findings(report)))

        counters[ordinary]["LINE"] = (20, 80)
        write_report(report, synthetic_report(counters, (20, 80)))
        record("line-80-accepted", not coverage_findings(report))

        critical = next(iter(CRITICAL_COVERAGE_CLASSES))
        counters[critical]["BRANCH"] = (1001, 8999)
        write_report(report, synthetic_report(counters, (20, 80)))
        record("critical-branch-89.99-rejected", any(item["code"] == "CRITICAL_BRANCH_BELOW_90" for item in coverage_findings(report)))

        counters[critical]["BRANCH"] = (10, 90)
        write_report(report, synthetic_report(counters, (20, 80)))
        record("critical-branch-90-accepted", not coverage_findings(report))

        counters = compliant_counters()
        counters.pop(next(iter(REQUIRED_COVERAGE_CLASSES)))
        write_report(report, synthetic_report(counters, (20, 80)))
        record("missing-class-rejected", any(item["code"] == "MISSING_CLASS" for item in coverage_findings(report)))

        counters = compliant_counters()
        counters[critical].pop("BRANCH")
        write_report(report, synthetic_report(counters, (20, 80)))
        record("missing-counter-rejected", any(item["code"] == "MISSING_COUNTER" for item in coverage_findings(report)))

        counters = compliant_counters()
        write_report(report, synthetic_report(counters, (20, 80)))
        source.write_text("class Sample {\n  void run() {\n    first();\n  }\n}\n", encoding="utf-8")
        _, scan = scan_java(root)
        record("compliant-repository-accepted", not scan and not coverage_findings(report))

    passed = all(item["passed"] for item in cases)
    return {"status": "PASS" if passed else "FAIL", "caseCount": len(cases), "cases": cases}


def run_check(repo_root: Path, scope: str, report_path: Path) -> dict[str, Any]:
    if scope != "priority":
        findings = [finding("SCOPE_ARGUMENT_INVALID", repo_root, 0, f"scope={scope}")]
        return {"status": "FAIL", "scope": scope, "scannedFiles": 0, "findings": findings}
    files, findings = scan_java(repo_root)
    findings.extend(coverage_findings(report_path))
    findings.sort(key=lambda item: (item["code"], item["path"], item["line"], item["metric"]))
    return {
        "status": "PASS" if not findings else "FAIL",
        "scope": scope,
        "scannedFiles": len(files),
        "requiredCoverageClasses": sorted(REQUIRED_COVERAGE_CLASSES),
        "criticalCoverageClasses": sorted(CRITICAL_COVERAGE_CLASSES),
        "lineThreshold": 0.80,
        "criticalBranchThreshold": 0.90,
        "findingCount": len(findings),
        "findings": findings,
    }


def emit(payload: dict[str, Any], report: Path | None) -> None:
    rendered = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True)
    if report is not None:
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CXR-09 Java quality and coverage ratchet")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--repo-root", type=Path)
    parser.add_argument("--scope", default="priority")
    parser.add_argument("--jacoco-report", type=Path)
    parser.add_argument("--report", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.self_test:
        payload = run_self_test()
        emit(payload, args.report)
        return 0 if payload["status"] == "PASS" else 1
    if args.repo_root is None or args.jacoco_report is None:
        payload = {
            "status": "FAIL",
            "scope": args.scope,
            "scannedFiles": 0,
            "findings": [finding("SCOPE_ARGUMENT_INVALID", Path.cwd(), 0, "repo-root and jacoco-report are required")],
        }
        emit(payload, args.report)
        return 2
    repo_root = args.repo_root.resolve()
    if not repo_root.is_dir():
        payload = {
            "status": "FAIL",
            "scope": args.scope,
            "scannedFiles": 0,
            "findings": [finding("SCOPE_ARGUMENT_INVALID", repo_root, 0, "repo-root is not a directory")],
        }
        emit(payload, args.report)
        return 2
    payload = run_check(repo_root, args.scope, args.jacoco_report.resolve())
    emit(payload, args.report)
    return 0 if payload["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
