#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / 'technical-platform' / 'web'
SRC = WEB / 'src'
REPORT_DIR = WEB / 'reports'

IMPORT_RE = re.compile(r"(?:import|export)\s+(?:[^'\"]+?\s+from\s+)?['\"](\.[^'\"]+)['\"]")
SECRET_PATTERNS = {
    'github_token': re.compile(r'github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9_]+'),
    'openai_key': re.compile(r'\bsk-[A-Za-z0-9_-]{12,}\b'),
    'private_key': re.compile(r'BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY'),
    'database_url': re.compile(r'(?i)DATABASE_URL|SPRING_DATASOURCE_(?:URL|PASSWORD)'),
    'aws_secret': re.compile(r'(?i)AWS_SECRET_ACCESS_KEY'),
    'test_credential': re.compile(r'测试账号|测试验证码|默认密码|临时演示入口'),
}


def source_files() -> list[Path]:
    return sorted(path for path in SRC.rglob('*') if path.suffix in {'.ts', '.vue'})


def resolve_relative(source: Path, specifier: str) -> Path | None:
    base = (source.parent / specifier).resolve()
    candidates = [base, base.with_suffix('.ts'), base.with_suffix('.vue'), base / 'index.ts']
    for candidate in candidates:
        if candidate.is_file() and SRC.resolve() in candidate.parents:
            return candidate
    return None


def import_graph() -> dict[Path, set[Path]]:
    graph: dict[Path, set[Path]] = {}
    for path in source_files():
        text = path.read_text(encoding='utf-8')
        graph[path] = {
            resolved
            for specifier in IMPORT_RE.findall(text)
            if (resolved := resolve_relative(path, specifier)) is not None
        }
    return graph


def find_cycles(graph: dict[Path, set[Path]]) -> list[list[str]]:
    state: dict[Path, int] = {}
    stack: list[Path] = []
    cycles: list[list[str]] = []

    def visit(node: Path) -> None:
        state[node] = 1
        stack.append(node)
        for child in graph.get(node, set()):
            if state.get(child, 0) == 0:
                visit(child)
            elif state.get(child) == 1:
                start = stack.index(child)
                cycle = stack[start:] + [child]
                rendered = [str(item.relative_to(WEB)) for item in cycle]
                if rendered not in cycles:
                    cycles.append(rendered)
        stack.pop()
        state[node] = 2

    for node in graph:
        if state.get(node, 0) == 0:
            visit(node)
    return cycles


def verify_source() -> dict[str, object]:
    required = [
        WEB / 'eslint.config.js',
        WEB / '.jscpd.json',
        WEB / 'knip.json',
        WEB / 'playwright.config.ts',
        WEB / 'src/design-system/component-vtu.test.ts',
        WEB / 'e2e/design-system-integration.spec.ts',
    ]
    missing = [str(path.relative_to(ROOT)) for path in required if not path.is_file()]
    if missing:
        raise SystemExit('missing PHASE-07 quality files:\n' + '\n'.join(missing))
    cycles = find_cycles(import_graph())
    if cycles:
        raise SystemExit('frontend circular dependency detected:\n' + '\n'.join(' -> '.join(cycle) for cycle in cycles))
    return {'cycles': 0, 'source_files': len(source_files())}


def scan_artifact_file(path: Path) -> list[str]:
    if path.suffix == '.map':
        return [f'source map artifact: {path.relative_to(WEB)}']
    if path.suffix.lower() not in {'.html', '.js', '.css', '.json', '.txt', '.svg'}:
        return []
    text = path.read_text(encoding='utf-8', errors='ignore')
    findings: list[str] = []
    for name, pattern in SECRET_PATTERNS.items():
        if pattern.search(text):
            findings.append(f'{name}: {path.relative_to(WEB)}')
    if 'sourceMappingURL=' in text:
        findings.append(f'sourceMappingURL reference: {path.relative_to(WEB)}')
    return findings


def verify_artifacts() -> dict[str, object]:
    dist = WEB / 'dist'
    expected = {
        'employee': dist / 'employee' / 'employee.html',
        'center': dist / 'center' / 'center.html',
        'admin': dist / 'admin' / 'admin.html',
    }
    missing = [name for name, path in expected.items() if not path.is_file()]
    if missing:
        raise SystemExit(f'missing portal build artifacts: {missing}')
    files = [path for path in dist.rglob('*') if path.is_file()]
    findings = [finding for path in files for finding in scan_artifact_file(path)]
    if findings:
        raise SystemExit('unsafe build artifact content:\n' + '\n'.join(findings))
    return {'portal_artifacts': sorted(expected), 'artifact_files': len(files), 'unsafe_findings': 0}


def write_report(payload: dict[str, object]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = REPORT_DIR / 'phase07-quality.json'
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--stage', choices=('source', 'artifacts', 'complete'), default='complete')
    args = parser.parse_args()
    payload: dict[str, object] = {'stage': args.stage}
    if args.stage in {'source', 'complete'}:
        payload['source'] = verify_source()
    if args.stage in {'artifacts', 'complete'}:
        payload['artifacts'] = verify_artifacts()
    write_report(payload)
    print(f'PHASE-07 frontend quality PASS ({args.stage})')


if __name__ == '__main__':
    main()
