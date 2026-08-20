#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / 'technical-platform' / 'web'
SRC = WEB / 'src'


def fail(message: str) -> None:
    raise SystemExit(f'DUAL_RUNTIME_GUARD_FAIL: {message}')


def require_file(path: Path) -> str:
    if not path.is_file():
        fail(f'missing required file {path.relative_to(ROOT)}')
    return path.read_text(encoding='utf-8')


def verify_entries() -> None:
    for name in ('work.html', 'admin.html'):
        if not WEB.joinpath(name).is_file():
            fail(f'missing runtime entry {name}')
    for name in ('employee.html', 'center.html'):
        if WEB.joinpath(name).exists():
            fail(f'retired runtime entry returned: {name}')
    for name in ('work', 'admin'):
        if not SRC.joinpath('portals', name, 'main.ts').is_file():
            fail(f'missing runtime bootstrap portals/{name}/main.ts')
    for name in ('employee', 'center'):
        if SRC.joinpath('portals', name).exists():
            fail(f'retired runtime bootstrap directory returned: portals/{name}')


def verify_portal_config() -> None:
    text = require_file(SRC / 'platform/portal-config.ts')
    required = [
        "export type RuntimePortalCode = 'work' | 'tech'",
        "employee: 'work'",
        "center: 'work'",
        "tech: 'tech'",
        'work: WORK',
        'tech: TECH',
    ]
    for item in required:
        if item not in text:
            fail(f'portal-config missing {item!r}')
    for forbidden in ('employee: WORK', 'center: WORK'):
        if forbidden in text:
            fail(f'portal-config exposes retired runtime alias {forbidden!r}')


def verify_package() -> None:
    payload = json.loads(require_file(WEB / 'package.json'))
    scripts = payload.get('scripts', {})
    required = ('dev:work', 'dev:admin', 'build:work', 'build:admin', 'build')
    retired = ('dev:employee', 'dev:center', 'build:employee', 'build:center')
    for key in required:
        if key not in scripts:
            fail(f'missing package script {key}')
    for key in retired:
        if key in scripts:
            fail(f'retired package script returned: {key}')


def verify_source() -> None:
    patterns = {
        r"portal\.code\s*===\s*['\"](?:employee|center)['\"]": 'runtime branch on retired portal code',
        r'PORTALS\.(?:employee|center)': 'retired PORTALS runtime alias',
    }
    for path in SRC.rglob('*'):
        if path.suffix not in {'.ts', '.vue'}:
            continue
        data = path.read_text(encoding='utf-8')
        for pattern, label in patterns.items():
            if re.search(pattern, data):
                fail(f'{label}: {path.relative_to(ROOT)}')


def verify_canonical_docs() -> None:
    paths = [
        ROOT / 'AGENT.md',
        ROOT / 'DESIGN.md',
        ROOT / 'README.md',
        ROOT / 'docs/implementation/ENGINEERING_BASELINE.md',
        ROOT / 'docs/implementation/DESIGN_BASELINE.md',
        ROOT / 'docs/implementation/MASTER_TRACEABILITY.md',
        ROOT / 'docs/implementation/RUNTIME_TERMINOLOGY.md',
    ]
    banned = (
        'src/portals/employee', 'src/portals/center',
        'employee.html', 'center.html',
        'build:employee', 'build:center', 'dev:employee', 'dev:center',
        'runtime_portals: employee',
        'employee / center / admin',
    )
    for path in paths:
        data = require_file(path)
        for fragment in banned:
            if fragment in data:
                fail(f'canonical document contains retired runtime statement {fragment!r}: {path.relative_to(ROOT)}')


def verify_shell_brand() -> None:
    shell = require_file(SRC / 'shared/layout/rebuild/UnifiedPortalShell.vue')
    for fragment in ('上金谷管理平台', '数字化现场调度协同系统', 'LOGO.svg', "work: '工作端'", "tech: '技术端'"):
        if fragment not in shell:
            fail(f'brand shell missing {fragment!r}')
    nav = require_file(SRC / 'router/PortalNavigation.vue')
    for fragment in ('runtimeCode: RuntimePortalCode', 'projectNavigationGroups', '开发中', '无权限'):
        if fragment not in nav:
            fail(f'navigation missing {fragment!r}')


def main() -> None:
    verify_entries()
    verify_portal_config()
    verify_package()
    verify_source()
    verify_canonical_docs()
    verify_shell_brand()
    print('DUAL_RUNTIME_GUARD_PASS')


if __name__ == '__main__':
    main()
