#!/usr/bin/env python3
"""Positive/negative fixtures for the project-side preflight and baseline tools."""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
from pathlib import Path

REQUIRED_FILES = (
    "AGENT.md", "DESIGN.md", "technical-platform/web/package.json",
    "docs/implementation/phases/PHASE-07/SOURCE_CONTRACT.md",
    "docs/implementation/phases/PHASE-07/ADR_DESIGN_SYSTEM_BOUNDARY.md",
    "docs/implementation/phases/PHASE-10/SOURCE_CONTRACT.md",
    "docs/implementation/phases/PHASE-10/START_CHECKLIST.md",
    "docs/implementation/phases/PHASE-10/PHASE_GATE.md",
)

def write(path: Path, content: str = "fixture\n") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")

def powershell() -> str:
    return str(Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32/WindowsPowerShell/v1.0/powershell.exe")

def run(script: Path, root: Path, evidence: Path, *extra: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run([powershell(), "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script),
                           "-RepositoryRoot", str(root), "-EvidenceDirectory", str(evidence), *extra],
                          text=True, encoding="utf-8", errors="replace", capture_output=True, check=False, env=env)

def main() -> int:
    scripts = Path(__file__).resolve().parents[1] / "local"
    preflight = scripts / "phase10-component-preflight.ps1"
    baseline = scripts / "phase10-component-baseline.ps1"
    with tempfile.TemporaryDirectory(prefix="phase10-component-tools-") as temp:
        root = Path(temp) / "repo"
        for relative in REQUIRED_FILES:
            write(root / relative)
        for task_source in (
            "scripts/implementation/phase10_component_source_gate.py",
            "scripts/implementation/phase10_component_source_gate_test.py",
            "scripts/implementation/phase10_component_local_tools_test.py",
            "scripts/local/phase10-component-preflight.ps1",
            "scripts/local/phase10-component-baseline.ps1",
        ):
            write(root / task_source, "before\n")
        write(root / "technical-platform/database/flyway-overlays/oms/V124__core.sql", "before\n")
        write(root / "docs/implementation/phases/PHASE-10/P10-COMP-00_UI_GATE_REVALIDATION.md", "report before\n")
        write(root / ".gitignore", "dotfile\n")
        write(root / "gitignore", "plain\n")
        write(root / ".env", "SECRET=one\n")
        write(root / ".env.example", "SECRET=example\n")
        for generated in ("reports/out.html", "test-results/.last-run.json", "playwright-report/index.html", "coverage/coverage.json"):
            write(root / generated, "generated\n")
        evidence = root / "docs/implementation/phases/PHASE-10/evidence/P10-COMP-00"

        positive = run(preflight, root, evidence / "preflight-positive")
        assert positive.returncode == 0, positive.stdout + positive.stderr
        assert json.loads((evidence / "preflight-positive/preflight.json").read_text(encoding="utf-8-sig"))["status"] == "PASS"

        for index, relative in enumerate(REQUIRED_FILES):
            missing = root / relative
            original = missing.read_text(encoding="utf-8")
            missing.unlink()
            negative_evidence = evidence / f"preflight-missing-{index}"
            negative = run(preflight, root, negative_evidence)
            assert negative.returncode != 0, f"{relative}: {negative.stdout}"
            findings = json.loads((negative_evidence / "preflight.json").read_text(encoding="utf-8-sig"))["findings"]
            assert any(item["code"] == "REQUIRED_FILE_MISSING" and item["path"] == relative for item in findings), findings
            write(missing, original)

        missing_tools_env = os.environ.copy(); missing_tools_env["PATH"] = ""
        tool_negative = run(preflight, root, evidence / "preflight-tools", env=missing_tools_env)
        assert tool_negative.returncode != 0, tool_negative.stdout
        tool_codes = {item["code"] for item in json.loads((evidence / "preflight-tools/preflight.json").read_text(encoding="utf-8-sig"))["findings"]}
        assert "TOOL_MISSING" in tool_codes, tool_codes

        failing_tools = Path(temp) / "failing-tools"
        failing_tools.mkdir()
        for tool in ("python", "node", "pnpm"):
            write(failing_tools / f"{tool}.cmd", "@exit /b 7\n")
        failing_env = os.environ.copy(); failing_env["PATH"] = str(failing_tools)
        probe_negative = run(preflight, root, evidence / "preflight-probe-failed", env=failing_env)
        assert probe_negative.returncode != 0, probe_negative.stdout
        probe_codes = {item["code"] for item in json.loads((evidence / "preflight-probe-failed/preflight.json").read_text(encoding="utf-8-sig"))["findings"]}
        assert "TOOL_PROBE_FAILED" in probe_codes, probe_codes

        before = run(baseline, root, evidence / "baseline-before")
        assert before.returncode == 0, before.stdout + before.stderr
        before_manifest = evidence / "baseline-before/baseline-manifest.json"
        write(root / "scripts/implementation/phase10_component_source_gate.py", "after\n")
        write(root / "technical-platform/database/flyway-overlays/oms/V124__core.sql", "after\n")
        write(root / "docs/implementation/phases/PHASE-10/P10-COMP-00_UI_GATE_REVALIDATION.md", "report after\n")
        write(evidence / "generated-should-be-excluded.log")
        after = run(baseline, root, evidence / "baseline-after", "-CompareManifest", str(before_manifest),
                    "-ConcurrentCorePaths", "technical-platform/database/flyway-overlays/oms/V124__core.sql")
        assert after.returncode == 0, after.stdout + after.stderr
        payload = json.loads((evidence / "baseline-after/baseline-manifest.json").read_text(encoding="utf-8-sig"))
        workspace_paths = [item["path"] for item in payload["files"]["workspace_source"]]
        assert len(workspace_paths) == len({item.casefold() for item in workspace_paths}), workspace_paths
        assert ".gitignore" in workspace_paths and "gitignore" in workspace_paths, workspace_paths
        assert not any(item.startswith("docs/implementation/phases/PHASE-10/evidence/P10-COMP-00/") for item in workspace_paths)
        excluded = {".env", ".env.example", "reports/out.html", "test-results/.last-run.json", "playwright-report/index.html", "coverage/coverage.json"}
        assert excluded.isdisjoint(workspace_paths), workspace_paths
        assert payload["task_source_file_count"] == 5
        metadata = payload["files"]["evidence_metadata"]
        assert len(metadata) == 1 and metadata[0]["path"] == "docs/implementation/phases/PHASE-10/P10-COMP-00_UI_GATE_REVALIDATION.md", metadata
        report = root / metadata[0]["path"]
        import hashlib
        assert metadata[0]["sha256"] == hashlib.sha256(report.read_bytes()).hexdigest().upper()
        assert metadata[0]["bytes"] == report.stat().st_size
        diff = json.loads((evidence / "baseline-after/scoped-diff.json").read_text(encoding="utf-8-sig"))
        assert [item["path"] for item in diff["task_changes"]] == ["scripts/implementation/phase10_component_source_gate.py"], diff
        assert [item["path"] for item in diff["concurrent_core"]] == ["technical-platform/database/flyway-overlays/oms/V124__core.sql"], diff
        assert diff["concurrent_core"][0]["classification"] == "concurrent_core", diff
        assert diff["concurrent_core"][0]["change"] == "modified", diff
        assert diff["unrelated_workspace_changes"] == [], diff
        assert [item["path"] for item in diff["evidence_metadata_changes"]] == ["docs/implementation/phases/PHASE-10/P10-COMP-00_UI_GATE_REVALIDATION.md"], diff
        assert diff["evidence_tree_changes_included"] is False
    print("phase10 local preflight/baseline: PASS (authority/tools, exact dotfiles, secrets/generated exclusions, metadata and scoped diff fixtures)")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
