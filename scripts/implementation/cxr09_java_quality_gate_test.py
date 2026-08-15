from __future__ import annotations

import json
import re
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "technical-platform" / "backend"
QUALITY_GATE = REPO_ROOT / "scripts" / "implementation" / "cxr09_java_quality_gate.py"
CHECKSTYLE_CONFIG = REPO_ROOT / "config" / "checkstyle" / "cxr09-checkstyle.xml"
QUALITY_CONTRACT = REPO_ROOT / "docs" / "implementation" / "remediation" / "CXR09_JAVA_QUALITY_CONTRACT.json"
COVERAGE_REPORT = (
    BACKEND_ROOT / "apps" / "api" / "target" / "site" / "jacoco-aggregate" / "jacoco.xml"
)
PRIORITY_MODULES = {"attendance", "learning", "performance", "reward", "welfare"}
EXPECTED_DOMAIN_CLASSES = {
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
}
EXPECTED_CRITICAL_CLASSES = {
    "cn/shangjingu/platform/iam/authorization/AuthorizationService",
    "cn/shangjingu/platform/core/process/SequentialStateMachine",
    "cn/shangjingu/platform/core/process/IdempotencyRegistry",
    "cn/shangjingu/platform/workflow/WorkflowCandidateResolver",
    "cn/shangjingu/platform/reward/PointLedgerService",
}
EXPECTED_REQUIRED_CLASSES = EXPECTED_DOMAIN_CLASSES | EXPECTED_CRITICAL_CLASSES


@dataclass
class LexState:
    block_comment: bool = False
    text_block: bool = False


@dataclass
class HeaderState:
    depth: int = 0


def is_priority_java(path: Path) -> bool:
    relative = path.relative_to(REPO_ROOT).as_posix()
    parts = set(Path(relative).parts)
    if parts & {"target", ".runlogs", "generated", "generated-sources", "generated-test-sources"}:
        return False
    module_match = re.search(r"backend/modules/([^/]+)/", relative)
    if module_match and module_match.group(1) in PRIORITY_MODULES:
        return True
    if re.search(r"backend/apps/api/src/(?:main|test)/java/.*/(?:phase10|phase11)/", relative):
        return True
    if re.search(r"backend/apps/api/src/test/java/.*/Phase(?:10|11)[^/]*\.java$", relative):
        return True
    if re.search(r"backend/modules/database-baseline/src/test/java/.*/Phase(?:10|11)[^/]*\.java$", relative):
        return True
    return bool(re.search(r"backend/apps/worker/src/main/java/.*/Phase(?:10|11)[^/]*\.java$", relative))


def priority_java_files() -> list[Path]:
    return sorted(path for path in BACKEND_ROOT.rglob("*.java") if is_priority_java(path))


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


def long_code_lines(path: Path) -> list[tuple[int, int]]:
    state = LexState()
    findings: list[tuple[int, int]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        visible = visible_java_code(line, state)
        if len(line) > 400 and visible.strip():
            findings.append((line_number, len(line)))
    return findings


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


def statement_count(line: str) -> int:
    return statement_counts([line])[0]


def dense_statement_lines(path: Path) -> list[tuple[int, int]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    return [
        (line_number, count)
        for line_number, count in enumerate(statement_counts(lines), start=1)
        if count > 1
    ]


def counter_ratio(xml_text: str, counter_type: str) -> float:
    root = ET.fromstring(xml_text)
    counter = next((item for item in root.findall("counter") if item.get("type") == counter_type), None)
    if counter is None:
        raise ValueError(f"MISSING_COUNTER:{counter_type}")
    missed = int(counter.get("missed", "0"))
    covered = int(counter.get("covered", "0"))
    denominator = missed + covered
    if denominator == 0:
        raise ValueError(f"ZERO_DENOMINATOR:{counter_type}")
    return covered / denominator


def synthetic_report(counter_type: str, missed: int, covered: int) -> str:
    return (
        '<report name="synthetic">'
        f'<counter type="{counter_type}" missed="{missed}" covered="{covered}"/>'
        "</report>"
    )


def counter_values(element: ET.Element, counter_type: str) -> tuple[int, int]:
    counter = next((item for item in element.findall("counter") if item.get("type") == counter_type), None)
    if counter is None:
        raise ValueError(f"MISSING_COUNTER:{counter_type}")
    missed = int(counter.get("missed", "0"))
    covered = int(counter.get("covered", "0"))
    if missed + covered == 0:
        raise ValueError(f"ZERO_DENOMINATOR:{counter_type}")
    return missed, covered


def coverage_contract_violations(
    xml_text: str,
    required_classes: set[str],
    critical_classes: set[str],
) -> list[str]:
    root = ET.fromstring(xml_text)
    classes = {item.get("name", ""): item for item in root.findall(".//class")}
    violations: list[str] = []
    for class_name in sorted(required_classes):
        element = classes.get(class_name)
        if element is None:
            violations.append(f"MISSING_CLASS:{class_name}")
            continue
        try:
            missed, covered = counter_values(element, "LINE")
            if covered / (missed + covered) < 0.80:
                violations.append(f"CLASS_LINE_BELOW_80:{class_name}")
        except ValueError as error:
            violations.append(f"{error}:{class_name}")
    critical_missed = 0
    critical_covered = 0
    for class_name in sorted(critical_classes):
        element = classes.get(class_name)
        if element is None:
            if f"MISSING_CLASS:{class_name}" not in violations:
                violations.append(f"MISSING_CLASS:{class_name}")
            continue
        try:
            missed, covered = counter_values(element, "BRANCH")
            critical_missed += missed
            critical_covered += covered
            if covered / (missed + covered) < 0.90:
                violations.append(f"CRITICAL_BRANCH_BELOW_90:{class_name}")
        except ValueError as error:
            violations.append(f"{error}:{class_name}")
    try:
        missed, covered = counter_values(root, "LINE")
        if covered / (missed + covered) < 0.80:
            violations.append("AGGREGATE_LINE_BELOW_80")
    except ValueError as error:
        violations.append(f"AGGREGATE_{error}")
    critical_total = critical_missed + critical_covered
    if critical_total == 0:
        violations.append("CRITICAL_AGGREGATE_ZERO_DENOMINATOR")
    elif critical_covered / critical_total < 0.90:
        violations.append("CRITICAL_AGGREGATE_BRANCH_BELOW_90")
    return violations


def synthetic_coverage_report(
    class_counters: dict[str, dict[str, tuple[int, int]]],
    aggregate_line: tuple[int, int],
) -> str:
    class_xml = "".join(
        '<class name="{}">{}</class>'.format(
            class_name,
            "".join(
                f'<counter type="{counter_type}" missed="{values[0]}" covered="{values[1]}"/>'
                for counter_type, values in counters.items()
            ),
        )
        for class_name, counters in class_counters.items()
    )
    return (
        '<report name="synthetic"><package name="priority">'
        f"{class_xml}</package>"
        f'<counter type="LINE" missed="{aggregate_line[0]}" covered="{aggregate_line[1]}"/>'
        "</report>"
    )


def pom_plugins(path: Path) -> dict[str, str | None]:
    root = ET.parse(path).getroot()
    namespace = {"m": "http://maven.apache.org/POM/4.0.0"}
    result: dict[str, str | None] = {}
    for plugin in root.findall(".//m:plugin", namespace):
        artifact = plugin.findtext("m:artifactId", namespaces=namespace)
        if artifact:
            result[artifact] = plugin.findtext("m:version", namespaces=namespace)
    return result


def plugin_arg_line(path: Path, artifact_id: str) -> str:
    root = ET.parse(path).getroot()
    namespace = {"m": "http://maven.apache.org/POM/4.0.0"}
    values: list[str] = []
    for plugin in root.findall(".//m:plugin", namespace):
        if plugin.findtext("m:artifactId", namespaces=namespace) != artifact_id:
            continue
        value = plugin.findtext("m:configuration/m:argLine", default="", namespaces=namespace)
        if value:
            values.append(value)
    return "\n".join(values)


class Cxr09JavaQualityGateTest(unittest.TestCase):
    def test_main_quality_gate_exists(self) -> None:
        self.assertTrue(QUALITY_GATE.is_file(), "QUALITY_MAIN_ABSENT")

    def test_priority_scope_has_no_long_code_lines(self) -> None:
        files = priority_java_files()
        findings = [(path, item) for path in files for item in long_code_lines(path)]
        finding_files = {path for path, _ in findings}
        production = sum("/src/test/" not in path.as_posix() for path, _ in findings)
        tests = len(findings) - production
        maximum = max((length for _, (_, length) in findings), default=0)
        message = (
            f"JAVA_LONG_LINE files={len(files)} lines={len(findings)} "
            f"findingFiles={len(finding_files)} production={production} tests={tests} max={maximum}"
        )
        self.assertEqual((96, 0, 0, 0, 0, 0), (len(files), len(findings), len(finding_files), production, tests, maximum), message)

    def test_priority_scope_has_one_statement_per_line(self) -> None:
        files = priority_java_files()
        findings = [(path, item) for path in files for item in dense_statement_lines(path)]
        finding_files = {path for path, _ in findings}
        production = sum("/src/test/" not in path.as_posix() for path, _ in findings)
        tests = len(findings) - production
        maximum = max((count for _, (_, count) in findings), default=0)
        message = (
            f"JAVA_DENSE_STATEMENT files={len(files)} lines={len(findings)} "
            f"findingFiles={len(finding_files)} production={production} tests={tests} maxStatements={maximum}"
        )
        self.assertEqual((96, 0, 0, 0, 0, 0), (len(files), len(findings), len(finding_files), production, tests, maximum), message)

    def test_quality_gate_cli_contract(self) -> None:
        self.assertTrue(QUALITY_GATE.is_file(), "QUALITY_MAIN_ABSENT_CLI_CONTRACT")
        self_test = subprocess.run(
            ["python", "-B", str(QUALITY_GATE), "--self-test"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
        )
        self.assertEqual(0, self_test.returncode, self_test.stderr or self_test.stdout)
        payload = json.loads(self_test.stdout)
        self.assertEqual("PASS", payload.get("status"))
        cases = {item.get("name"): item.get("passed") for item in payload.get("cases", [])}
        required_cases = {
            "long-code-line-rejected",
            "dense-statement-rejected",
            "missing-report-rejected",
            "zero-denominator-rejected",
            "line-79.99-rejected",
            "line-80-accepted",
            "critical-branch-89.99-rejected",
            "critical-branch-90-accepted",
            "missing-class-rejected",
            "missing-counter-rejected",
            "compliant-repository-accepted",
        }
        self.assertEqual(required_cases, required_cases & cases.keys())
        self.assertTrue(all(cases[name] for name in required_cases))
        with tempfile.TemporaryDirectory(prefix="cxr09-missing-report-") as directory:
            check = subprocess.run(
                [
                    "python",
                    "-B",
                    str(QUALITY_GATE),
                    "--repo-root",
                    str(REPO_ROOT),
                    "--scope",
                    "priority",
                    "--jacoco-report",
                    str(Path(directory) / "missing.xml"),
                ],
                cwd=REPO_ROOT,
                capture_output=True,
                text=True,
                encoding="utf-8",
                check=False,
            )
        self.assertNotEqual(0, check.returncode)
        check_payload = json.loads(check.stdout)
        self.assertEqual("FAIL", check_payload.get("status"))
        self.assertIn("MISSING_REPORT", {item.get("code") for item in check_payload.get("findings", [])})
        self.assertEqual(EXPECTED_REQUIRED_CLASSES, set(check_payload.get("requiredCoverageClasses", [])))
        self.assertEqual(EXPECTED_CRITICAL_CLASSES, set(check_payload.get("criticalCoverageClasses", [])))

    def test_checkstyle_and_machine_contract_match_authority(self) -> None:
        root = ET.parse(CHECKSTYLE_CONFIG).getroot()
        line_length = [item for item in root.findall("module") if item.get("name") == "LineLength"]
        self.assertEqual(1, len(line_length))
        properties = {item.get("name"): item.get("value") for item in line_length[0].findall("property")}
        self.assertEqual("400", properties.get("max"))
        tree_walker = next(item for item in root.findall("module") if item.get("name") == "TreeWalker")
        self.assertIn("OneStatementPerLine", {item.get("name") for item in tree_walker.findall("module")})
        self.assertFalse(any("Suppress" in (item.get("name") or "") for item in root.iter("module")))

        contract = json.loads(QUALITY_CONTRACT.read_text(encoding="utf-8"))
        coverage = contract["coverage"]
        self.assertEqual(EXPECTED_REQUIRED_CLASSES, set(coverage["requiredClasses"]))
        self.assertEqual(EXPECTED_CRITICAL_CLASSES, set(coverage["criticalClasses"]))
        self.assertEqual(14, coverage["denominators"]["requiredLineClassCount"])
        self.assertEqual(5, coverage["denominators"]["criticalBranchClassCount"])
        self.assertEqual(0.8, coverage["lineMinimum"])
        self.assertEqual(0.9, coverage["criticalBranchMinimum"])

    def test_maven_quality_toolchain_is_pinned_and_fail_closed(self) -> None:
        root_plugins = pom_plugins(REPO_ROOT / "pom.xml")
        required = {
            "spring-boot-maven-plugin",
            "spotless-maven-plugin",
            "maven-checkstyle-plugin",
            "spotbugs-maven-plugin",
            "jacoco-maven-plugin",
        }
        missing = sorted(required - root_plugins.keys())
        unversioned = sorted(artifact for artifact in required if artifact in root_plugins and not root_plugins[artifact])
        pom_text = "\n".join(
            path.read_text(encoding="utf-8")
            for path in (REPO_ROOT / "pom.xml", BACKEND_ROOT / "apps" / "api" / "pom.xml", BACKEND_ROOT / "apps" / "worker" / "pom.xml")
        )
        surefire_arg_line = plugin_arg_line(REPO_ROOT / "pom.xml", "maven-surefire-plugin")
        failsafe_arg_line = plugin_arg_line(REPO_ROOT / "pom.xml", "maven-failsafe-plugin")
        mockito_agent = re.compile(r"-javaagent:[^\s<]*mockito-core[^\s<]*\.jar")
        agent_missing = (
            not mockito_agent.search(surefire_arg_line)
            or not mockito_agent.search(failsafe_arg_line)
            or "@{argLine}" not in surefire_arg_line
            or "@{argLine}" not in failsafe_arg_line
        )
        warning_hidden = "EnableDynamicAgentLoading" in pom_text
        checkstyle_path = REPO_ROOT / "config" / "checkstyle" / "cxr09-checkstyle.xml"
        suppression_text = checkstyle_path.read_text(encoding="utf-8") if checkstyle_path.is_file() else ""
        broad_exclude = bool(
            re.search(
                r"(?:exclude|suppress)[^\r\n<]{0,240}(?:Phase(?:10|11)\*|phase(?:10|11)/\*|modules?/\*\*)",
                f"{pom_text}\n{suppression_text}",
                flags=re.IGNORECASE,
            )
        )
        self.assertEqual(
            ([], [], False, False, False),
            (missing, unversioned, agent_missing, warning_hidden, broad_exclude),
            f"TOOLCHAIN missing={missing} unversioned={unversioned} agentMissing={agent_missing} "
            f"warningHidden={warning_hidden} broadExclude={broad_exclude}",
        )

    def test_mockbean_deprecation_is_absent(self) -> None:
        matches: list[tuple[Path, int]] = []
        for path in BACKEND_ROOT.rglob("*.java"):
            count = path.read_text(encoding="utf-8").count("@MockBean")
            if count:
                matches.append((path, count))
        self.assertEqual(0, sum(count for _, count in matches), f"MOCKBEAN files={len(matches)} usages={sum(count for _, count in matches)}")

    def test_real_jacoco_report_exists(self) -> None:
        self.assertTrue(COVERAGE_REPORT.is_file(), f"MISSING_REPORT:{COVERAGE_REPORT}")

    def test_non_code_long_lines_are_not_findings(self) -> None:
        long_text = "x" * 450
        lines = [f"// {long_text}", f"/* {long_text} */", 'String value = """', long_text, '""";']
        state = LexState()
        findings: list[str] = []
        for line in lines:
            visible = visible_java_code(line, state)
            if len(line) > 400 and visible.strip():
                findings.append(line)
        self.assertEqual([], findings)

    def test_statement_lexer_ignores_for_header_and_literals(self) -> None:
        self.assertEqual(1, statement_count('for (int i = 0; i < 3; i++) { run("a;b"); }'))
        self.assertEqual(1, statement_count('try (Reader a = open(); Reader b = open()) { consume(); }'))
        self.assertEqual(
            [0, 0, 1, 0],
            statement_counts(["try (Reader a = open();", "Reader b = open()) {", "consume();", "}"]),
        )
        self.assertEqual(0, statement_count('// first(); second();'))

    def test_statement_lexer_rejects_dense_statements(self) -> None:
        self.assertGreater(statement_count("first(); second();"), 1)

    def test_line_threshold_boundary(self) -> None:
        self.assertLess(counter_ratio(synthetic_report("LINE", 2001, 7999), "LINE"), 0.80)
        self.assertGreaterEqual(counter_ratio(synthetic_report("LINE", 20, 80), "LINE"), 0.80)

    def test_branch_threshold_boundary(self) -> None:
        self.assertLess(counter_ratio(synthetic_report("BRANCH", 1001, 8999), "BRANCH"), 0.90)
        self.assertGreaterEqual(counter_ratio(synthetic_report("BRANCH", 10, 90), "BRANCH"), 0.90)

    def test_zero_denominator_fails_closed(self) -> None:
        with self.assertRaisesRegex(ValueError, "ZERO_DENOMINATOR:LINE"):
            counter_ratio(synthetic_report("LINE", 0, 0), "LINE")

    def test_class_and_aggregate_coverage_contract(self) -> None:
        required = EXPECTED_REQUIRED_CLASSES
        critical = EXPECTED_CRITICAL_CLASSES
        ordinary_name = "cn/shangjingu/platform/performance/PerformanceCycleService"
        critical_name = "cn/shangjingu/platform/iam/authorization/AuthorizationService"
        counters = {
            class_name: {
                "LINE": (20, 80),
                **({"BRANCH": (10, 90)} if class_name in critical else {}),
            }
            for class_name in sorted(required)
        }
        compliant = synthetic_coverage_report(
            counters,
            (20, 80),
        )
        self.assertEqual([], coverage_contract_violations(compliant, required, critical))
        ordinary_prefix = f'<class name="{ordinary_name}"><counter type="LINE" missed="20" covered="80"/>'
        class_line_low = compliant.replace(
            ordinary_prefix,
            f'<class name="{ordinary_name}"><counter type="LINE" missed="2001" covered="7999"/>',
        )
        self.assertIn(f"CLASS_LINE_BELOW_80:{ordinary_name}", coverage_contract_violations(class_line_low, required, critical))
        critical_fragment = (
            f'<class name="{critical_name}"><counter type="LINE" missed="20" covered="80"/>'
            '<counter type="BRANCH" missed="10" covered="90"/></class>'
        )
        branch_low = compliant.replace(
            critical_fragment,
            f'<class name="{critical_name}"><counter type="LINE" missed="20" covered="80"/>'
            '<counter type="BRANCH" missed="1001" covered="8999"/></class>',
        )
        branch_findings = coverage_contract_violations(branch_low, required, critical)
        self.assertIn(f"CRITICAL_BRANCH_BELOW_90:{critical_name}", branch_findings)
        self.assertIn("CRITICAL_AGGREGATE_BRANCH_BELOW_90", branch_findings)
        aggregate_low = compliant.rsplit('type="LINE" missed="20" covered="80"', 1)[0] + 'type="LINE" missed="2001" covered="7999"/></report>'
        self.assertIn("AGGREGATE_LINE_BELOW_80", coverage_contract_violations(aggregate_low, required, critical))
        self.assertIn("MISSING_CLASS:priority/Missing", coverage_contract_violations(compliant, required | {"priority/Missing"}, critical))
        missing_counter = compliant.replace(
            critical_fragment,
            f'<class name="{critical_name}"><counter type="LINE" missed="20" covered="80"/></class>',
        )
        self.assertIn(f"MISSING_COUNTER:BRANCH:{critical_name}", coverage_contract_violations(missing_counter, required, critical))
        zero_denominator = compliant.replace(
            critical_fragment,
            f'<class name="{critical_name}"><counter type="LINE" missed="20" covered="80"/>'
            '<counter type="BRANCH" missed="0" covered="0"/></class>',
        )
        self.assertIn(f"ZERO_DENOMINATOR:BRANCH:{critical_name}", coverage_contract_violations(zero_denominator, required, critical))

    def test_priority_scope_excludes_generated_sources(self) -> None:
        generated = BACKEND_ROOT / "apps" / "api" / "target" / "generated-sources" / "phase11" / "Generated.java"
        self.assertFalse(is_priority_java(generated))


if __name__ == "__main__":
    unittest.main(verbosity=2)
