#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / 'technical-platform' / 'web'
SRC = WEB / 'src'


def require_file(relative: str) -> str:
    path = SRC / relative
    if not path.is_file():
        raise SystemExit(f'missing PHASE-08 file: {relative}')
    return path.read_text(encoding='utf-8')


def require_repo_file(relative: str) -> str:
    path = ROOT / relative
    if not path.is_file():
        raise SystemExit(f'missing PHASE-08 repo file: {relative}')
    return path.read_text(encoding='utf-8')


def require_fragments(relative: str, fragments: tuple[str, ...]) -> None:
    text = require_file(relative)
    for fragment in fragments:
        if fragment not in text:
            raise SystemExit(f'missing {fragment!r} in {relative}')


def require_repo_fragments(relative: str, fragments: tuple[str, ...]) -> None:
    text = require_repo_file(relative)
    for fragment in fragments:
        if fragment not in text:
            raise SystemExit(f'missing {fragment!r} in {relative}')


def verify_phase_boundary(stage: str) -> None:
    progress = require_repo_file('docs/implementation/MASTER_PROGRESS.md')
    if '| PHASE-08 | COMPLETE |' not in progress:
        raise SystemExit('PHASE-08 must remain COMPLETE during later-phase regression')
    if not any(marker in progress for marker in (
        '| PHASE-09 | NOT_STARTED |', '| PHASE-09 | IN_PROGRESS |',
        '| PHASE-09 | READY_FOR_GATE |', '| PHASE-09 | COMPLETE |',
    )):
        raise SystemExit('PHASE-09 lifecycle state is invalid')
    if '| PHASE-10 | COMPLETE |' not in progress:
        raise SystemExit('PHASE-10 must remain COMPLETE during later-phase regression')
    if '| PHASE-07 | COMPLETE |' not in progress:
        raise SystemExit('PHASE-07 must remain COMPLETE')


def verify_c1() -> None:
    require_fragments('api/api-client.ts', (
        "path.startsWith('/api/')", 'Idempotency-Key', 'recoverSession', 'timeoutError', 'AbortController',
    ))
    require_fragments('contracts/iam.ts', ('interface SessionView', 'availableIdentities: AvailableIdentityView[]'))


def verify_c2() -> None:
    require_fragments('session/credential-vault.ts', ('sessionStorage', 'refreshExpiresAt', 'getRefreshCredential'))
    require_fragments('session/portal-session-runtime.ts', ('refreshPromise', 'recoverSession', 'switchIdentity', 'can(permission'))
    require_fragments('session/iam-validators.ts', ('parseSessionTokenResponse', 'parseSessionView', 'protocolError'))


def verify_c3() -> None:
    require_fragments('router/portal-router.ts', (
        'createPortalRouter', 'rotateNavigationAbortSignal', 'router.onError',
    ))
    require_fragments('router/core-routes.ts', (
        "path: '/login'", "name: 'portal-home'", "name: 'forbidden'", "name: 'not-found'",
    ))
    require_fragments('platform/create-portal-app.ts', ('usePortalSessionStore', 'createPortalRouter', 'PortalRuntimeRoot'))


def verify_c4() -> None:
    generated = SRC / 'router/generated/portal-ia-navigation.json'
    payload = json.loads(generated.read_text(encoding='utf-8'))
    counts = payload.get('counts')
    if not isinstance(counts, dict) or any(not isinstance(counts.get(portal), int) or counts[portal] <= 0 for portal in ('employee', 'center', 'tech')):
        raise SystemExit(f'invalid C4 navigation counts: {counts}')
    require_fragments('router/navigation-projection.ts', (
        "entry.status === 'implemented'", 'implementedRoutePaths.has', 'required.every', "entry.mobileAccess !== 'no'",
        'splitMobileNavigation',
    ))
    require_fragments('router/PortalNavigation.vue', (
        'RouterLink', 'aria-disabled', 'aria-current', 'splitMobileNavigation', 'overflowItems', '更多',
    ))


def verify_c5() -> None:
    require_fragments('platform/PortalSessionHeader.vue', (
        'availableIdentities', 'identityName', "permissions.includes('platform.session.switch')", '退出登录',
    ))
    require_fragments('platform/AuthenticatedPortalLayout.vue', (
        'PortalSessionHeader', '@switch-identity', '@logout', 'session.switchIdentity',
        'PortalNavigation', 'RouterView', ':page-title="pageTitle"',
        'const pageTitle = computed', 'route.meta.title', 'props.portal.homeTitle',
    ))
    require_fragments('router/core-routes.ts', ('AuthenticatedPortalLayout', 'children:',))
    require_fragments('platform/pages/LoginPage.vue', ('会话已过期', 'logout-unconfirmed', '本地会话已清除'))
    require_fragments('session/portal-session-runtime.ts', ('previousSession', "this.phase = previousSession ? 'authenticated' : 'error'"))


def verify_home_fact_source() -> None:
    require_fragments('platform/portal-config.ts', (
        'homeTitle', 'homeFocus', '员工工作入口', '中心管理工作入口', '技术运行工作入口',
    ))
    shell = require_file('platform/PlatformShell.vue')
    for forbidden in ('PHASE05_PROCESSES', 'PHASE-05', 'primaryTable', 'process.states', 'process.apiBase', '已关闭'):
        if forbidden in shell:
            raise SystemExit(f'protected PortalShell contains forbidden engineering/runtime evidence: {forbidden!r}')
    require_fragments('platform/PlatformShell.vue', (
        'data-home-role', '本端工作定位', '运行壳数据原则',
        '业务状态、待办、消息、搜索与 KPI 只有在存在真实服务端 read model 时才展示',
    ))
    require_fragments('platform/AuthenticatedPortalLayout.vue', (
        ':page-title="pageTitle"', 'const pageTitle = computed', 'route.meta.title', 'props.portal.homeTitle',
        'PortalSessionHeader', 'PortalNavigation',
    ))
    require_repo_fragments('technical-platform/web/e2e/phase08-live-session.spec.ts', (
        'expectNoEngineeringEvidence', '员工工作入口', '中心管理工作入口', '技术运行工作入口',
        "not.toContainText('PHASE-05')", 'welfare.care_case', '/api/v1/phase05/', "not.toContainText('已关闭')",
    ))


def verify_c6() -> None:
    for portal in ('employee', 'center', 'admin'):
        require_fragments(f'portals/{portal}/main.ts', ('createPortalApp',))
    if SRC.joinpath('portals/tech').exists():
        raise SystemExit('fourth tech runtime is forbidden')
    require_fragments('platform/pages/LoginPage.vue', ('租户编码', '登录账号', '密码', 'session.login'))
    require_repo_fragments('technical-platform/web/e2e/phase08-login-shell.spec.ts', (
        'employee', 'center', 'admin', 'sessionStorage', 'localStorage', 'no fourth tech runtime',
    ))
    verify_home_fact_source()


def verify_c7() -> None:
    require_repo_fragments(
        'technical-platform/backend/apps/api/src/test/java/cn/shangjingu/platform/api/Phase08BrowserBackendFixture.java',
        ('PostgreSQLContainer', 'redis:7.4-alpine', 'requiredEnv("PHASE08_E2E_PASSWORD")',
         '--server.port=18080', '--spring.datasource.url=', '--spring.data.redis.port=',
         '--sjg.audit.datasource.url=', 'TEST_ONLY', 'phase08-fixture-runtime.json'),
    )
    require_repo_fragments('technical-platform/web/playwright.phase08-live.config.ts', (
        'phase08-live-session.spec.ts', 'desktop-chromium', 'mobile-chromium', '5173', '5174', '5175',
    ))
    require_repo_fragments('technical-platform/web/e2e/phase08-live-session.spec.ts', (
        'real backend login refresh restore and logout', 'refresh rotation identity switch authorization',
        "status()).toBe(401)", "status()).toBe(403)", 'sessionStorage', 'localStorage',
    ))
    require_repo_fragments('.github/workflows/phase08-full-gate.yml', (
        'PHASE-08 Full Construction Gate', 'playwright.phase08-live.config.ts', 'Phase08BrowserBackendFixture',
        'audit.operation_log', 'audit.security_event', 'PHASE08_E2E_PASSWORD',
    ))
    require_repo_fragments('technical-platform/web/tsconfig.node.json', ('playwright*.config.ts',))
    require_repo_fragments('technical-platform/web/eslint.config.js', ('playwright*.config.ts',))


def verify_forbidden() -> None:
    forbidden = re.compile(r'localStorage|console\.|TODO|FIXME|@ts-ignore|@ts-nocheck')
    for directory in ('api', 'contracts', 'session', 'router'):
        for path in SRC.joinpath(directory).rglob('*'):
            if path.suffix not in {'.ts', '.vue'}:
                continue
            match = forbidden.search(path.read_text(encoding='utf-8'))
            if match:
                raise SystemExit(f'forbidden PHASE-08 pattern {match.group(0)!r}: {path.relative_to(ROOT)}')
    session_storage_uses = [
        path.name for path in SRC.joinpath('session').rglob('*.ts') if 'sessionStorage' in path.read_text(encoding='utf-8')
    ]
    if session_storage_uses != ['credential-vault.ts']:
        raise SystemExit(f'sessionStorage must be isolated to credential-vault.ts: {session_storage_uses}')
    if re.search(r'PHASE08_E2E_PASSWORD\s*=\s*["\'][^"\']+', require_repo_file('.github/workflows/phase08-full-gate.yml')):
        raise SystemExit('C7 workflow must generate the ephemeral password at runtime, not hardcode it')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--stage', choices=('c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'), default='c7')
    args = parser.parse_args()
    verify_phase_boundary(args.stage)
    verify_c1()
    if args.stage in {'c2', 'c3', 'c4', 'c5', 'c6', 'c7'}: verify_c2()
    if args.stage in {'c3', 'c4', 'c5', 'c6', 'c7'}: verify_c3()
    if args.stage in {'c4', 'c5', 'c6', 'c7'}: verify_c4()
    if args.stage in {'c5', 'c6', 'c7'}: verify_c5()
    if args.stage in {'c6', 'c7'}: verify_c6()
    if args.stage == 'c7': verify_c7()
    verify_forbidden()
    print(f'PHASE-08 portal runtime regression contract PASS ({args.stage})')


if __name__ == '__main__':
    main()
