#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / 'technical-platform' / 'web'
DS = WEB / 'src' / 'design-system'

REQUIRED_TOKENS = (
    '--sgj-brand-600', '--sgj-canvas', '--sgj-surface', '--sgj-text-primary',
    '--sgj-success', '--sgj-warning', '--sgj-danger', '--sgj-danger-hover',
    '--sgj-info', '--sgj-focus-ring', '--sgj-touch-min', '--sgj-overlay-backdrop',
    '--sgj-z-floating', '--sgj-sidebar-collapsed-width',
)

REQUIRED_COMPONENTS = (
    'components/Button.vue', 'components/Card.vue', 'components/StatusChip.vue',
    'components/Input.vue', 'components/Textarea.vue', 'components/Select.vue',
    'components/DateTime.vue', 'components/Checkbox.vue', 'components/RadioGroup.vue',
    'components/Switch.vue', 'components/Upload.vue', 'components/Cascader.vue',
    'components/PersonPicker.vue', 'components/OrganizationPicker.vue',
    'components/Dialog.vue', 'components/Drawer.vue', 'components/Toast.vue',
    'components/ToastRegion.vue', 'components/Table.vue', 'components/List.vue',
    'components/Empty.vue', 'components/Loading.vue', 'components/Error.vue',
    'components/PartialFailure.vue', 'components/NoPermission.vue', 'components/Conflict.vue',
    'components/MaskedValue.vue', 'components/StepUpReveal.vue', 'components/StatePanel.vue',
    'components/Avatar.vue', 'components/PersonRow.vue', 'components/RecordCard.vue',
    'components/KpiCard.vue', 'layout/PortalShell.vue',
)

REQUIRED_TEMPLATES = tuple(
    f'templates/{name}PageTemplate.vue'
    for name in ('List', 'Detail', 'Form', 'Approval', 'Timeline', 'Dashboard')
)

REQUIRED_RUNTIME_TESTS = (
    'runtimeTestHost.ts',
    'runtime-primitives.test.ts',
    'runtime-overlays-security.test.ts',
    'runtime-shell-templates.test.ts',
    'component-vtu.test.ts',
)

FORBIDDEN = re.compile(
    r'TODO|FIXME|@ts-ignore|@ts-nocheck|localStorage|sessionStorage|'
    r'\bfetch\s*\(|\baxios\b|/api/|\bP\d{3}\b'
)


def require_ds_file(relative: str) -> Path:
    path = DS / relative
    if not path.is_file():
        raise SystemExit(f'missing design-system file: {relative}')
    return path


def require_web_file(relative: str) -> Path:
    path = WEB / relative
    if not path.is_file():
        raise SystemExit(f'missing web quality file: {relative}')
    return path


def require_fragments(path: Path, fragments: tuple[str, ...]) -> None:
    text = path.read_text(encoding='utf-8')
    for fragment in fragments:
        if fragment not in text:
            raise SystemExit(f'missing contract fragment {fragment!r}: {path.relative_to(ROOT)}')


def verify_foundation() -> None:
    tokens = require_ds_file('tokens.css').read_text(encoding='utf-8')
    base = require_ds_file('base.css').read_text(encoding='utf-8')
    require_ds_file('types.ts')
    for token in REQUIRED_TOKENS:
        if token not in tokens:
            raise SystemExit(f'missing token: {token}')
    if 'prefers-reduced-motion: reduce' not in base:
        raise SystemExit('missing reduced-motion contract')
    if ':focus-visible' not in base:
        raise SystemExit('missing focus-visible contract')


def verify_runtime_test_contract() -> None:
    for relative in REQUIRED_RUNTIME_TESTS:
        require_ds_file(relative)
    require_fragments(require_ds_file('runtimeTestHost.ts'), ('createRenderer', 'mountRuntime', 'querySelectorAll', 'focus('))
    require_fragments(require_ds_file('runtime-primitives.test.ts'), ('mountRuntime', 'aria-invalid', 'onUpdate:modelValue', 'aria-live'))
    require_fragments(require_ds_file('runtime-overlays-security.test.ts'), ('runtimeKeyEvent', 'Tab', 'Escape', 'StepUpReveal', "not.toContain('12000')"))
    require_fragments(require_ds_file('runtime-shell-templates.test.ts'), ('PortalShell', 'globalAlert', 'toastRegion', 'assistant', 'DashboardPageTemplate'))
    require_fragments(
        require_ds_file('component-vtu.test.ts'),
        ("from '@vue/test-utils'", 'mount(Dialog', 'mount(Drawer', 'StepUpReveal', 'aria-describedby', 'DateTime', 'Cascader', 'RecordCard'),
    )


def verify_design_fidelity() -> None:
    require_fragments(require_ds_file('components/Error.vue'), ('errorCode', 'traceId', '错误编号', 'Trace ID'))
    require_fragments(require_ds_file('layout/PortalShell.vue'), ('globalAlert', 'toastRegion', 'assistant', 'sidebarCollapsed', 'sgj-skip-link', '<main'))
    require_fragments(require_ds_file('components.css'), ('sgj-button--danger:not(:disabled):hover', 'sgj-danger-hover', 'height: 100dvh'))
    require_fragments(require_ds_file('templates.css'), ('sgj-portal-shell__global-alert', 'sgj-portal-shell__toast-region', 'overflow: hidden', 'overflow: auto'))
    require_fragments(require_ds_file('extended.css'), ('sgj-kpi-card__value strong', 'sgj-avatar', 'sgj-person-row', 'sgj-sidebar-collapsed-width', 'sgj-cell--numeric'))
    styles = WEB.joinpath('src/styles.css').read_text(encoding='utf-8')
    for font in ('SF Pro Display', 'SF Pro Text', 'Noto Sans CJK SC'):
        if font not in styles:
            raise SystemExit(f'missing DESIGN font fallback: {font}')


def verify_quality_contract() -> None:
    for relative in ('eslint.config.js', '.jscpd.json', 'knip.json', 'playwright.config.ts', 'e2e/design-system-integration.spec.ts'):
        require_web_file(relative)
    package = require_web_file('package.json').read_text(encoding='utf-8')
    for fragment in ('@vue/test-utils', '@playwright/test', '"lint"', 'quality:duplicates', 'quality:deadcode', 'quality:artifacts', 'test:e2e'):
        if fragment not in package:
            raise SystemExit(f'missing package quality contract: {fragment}')
    require_fragments(ROOT / 'scripts/implementation/phase07_frontend_quality.py', ('find_cycles', 'verify_artifacts', 'sourceMappingURL'))
    require_fragments(WEB / 'src/platform/AuthenticatedPortalLayout.vue', (
        'SgjPortalShell', 'SgjStatusChip', 'PortalSessionHeader', 'PortalNavigation', 'RouterView',
    ))
    require_fragments(WEB / 'src/platform/PlatformShell.vue', ('data-portal-code',))


def verify_complete() -> None:
    for relative in (*REQUIRED_COMPONENTS, *REQUIRED_TEMPLATES, 'index.ts'):
        require_ds_file(relative)
    files = [path for path in DS.rglob('*') if path.suffix in {'.ts', '.vue', '.css'}]
    for path in files:
        text = path.read_text(encoding='utf-8')
        match = FORBIDDEN.search(text)
        if match:
            raise SystemExit(f'forbidden design-system pattern {match.group(0)!r}: {path.relative_to(ROOT)}')
        if path.suffix == '.vue' and len(text.splitlines()) > 360:
            raise SystemExit(f'Vue SFC exceeds 360 lines: {path.relative_to(ROOT)}')
    verify_design_fidelity()
    verify_runtime_test_contract()
    verify_quality_contract()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--stage', choices=('foundation', 'complete'), default='complete')
    args = parser.parse_args()
    verify_foundation()
    if args.stage == 'complete':
        verify_complete()
    print(f'PHASE-07 design-system contract PASS ({args.stage})')


if __name__ == '__main__':
    main()
