from __future__ import annotations

import csv
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path

ROOT = Path.cwd()
WEB = ROOT / 'technical-platform/web'
if not (WEB / 'package.json').exists():
    raise SystemExit(f'not repository root: {ROOT}')

changed: list[str] = []
deleted: list[str] = []
renamed: list[tuple[str, str]] = []
warnings: list[str] = []

EXCLUDED_PREFIXES = (
    'Knowledge Base/',
    'technical-platform/api/',
    'technical-platform/database/',
    'technical-platform/db/',
    'technical-platform/worker/',
    'technical-platform/integrations/',
    'database/',
)
TEXT_SUFFIXES = {
    '.md', '.txt', '.csv', '.json', '.jsonl', '.yaml', '.yml', '.toml', '.ini',
    '.properties', '.xml', '.html', '.htm', '.ts', '.tsx', '.vue', '.js', '.mjs',
    '.cjs', '.py', '.sh', '.ps1', '.bat', '.env', '.example', '.sql',
}
TEXT_NAMES = {'Dockerfile', 'Makefile', '.env.example', '.editorconfig'}


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def excluded(path: Path) -> bool:
    value = rel(path)
    return any(value.startswith(prefix) for prefix in EXCLUDED_PREFIXES)


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    old = path.read_text(encoding='utf-8', errors='replace') if path.exists() else None
    if old != text:
        path.write_text(text, encoding='utf-8', newline='\n')
        changed.append(rel(path))


def delete(path: Path) -> None:
    if path.is_file() or path.is_symlink():
        path.unlink()
        deleted.append(rel(path))
    elif path.is_dir():
        shutil.rmtree(path)
        deleted.append(rel(path) + '/')


def replace_file(path: Path, pairs: list[tuple[str, str]], regex_pairs: list[tuple[str, str]] | None = None) -> None:
    if not path.exists() or not path.is_file():
        return
    try:
        text = path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        return
    old = text
    for before, after in pairs:
        text = text.replace(before, after)
    for before, after in regex_pairs or []:
        text = re.sub(before, after, text, flags=re.M)
    if text != old:
        write(path, text)


# -----------------------------------------------------------------------------
# A. Exactly two runtime entries and two build products
# -----------------------------------------------------------------------------
pkg_path = WEB / 'package.json'
pkg = json.loads(pkg_path.read_text(encoding='utf-8'))
scripts = dict(pkg.get('scripts', {}))
for key in ('dev:employee', 'dev:center', 'build:employee', 'build:center'):
    scripts.pop(key, None)
scripts['dev:work'] = 'vite --mode work'
scripts['dev:admin'] = scripts.get('dev:admin', 'vite --mode admin')
scripts['build:work'] = 'vite build --mode work'
scripts['build:admin'] = scripts.get('build:admin', 'vite build --mode admin')
scripts['build'] = 'pnpm run build:work && pnpm run build:admin'
scripts['quality:dual-portal'] = 'python ../../scripts/implementation/dual_portal_guard.py'
pkg['scripts'] = scripts
write(pkg_path, json.dumps(pkg, ensure_ascii=False, indent=2) + '\n')

work_main = WEB / 'src/portals/work/main.ts'
if not work_main.exists():
    source = None
    for candidate in (WEB / 'src/portals/employee/main.ts', WEB / 'src/portals/center/main.ts'):
        if candidate.exists():
            source = candidate.read_text(encoding='utf-8')
            break
    if source is None:
        source = (
            "import { createPortalApp } from '../../platform/create-portal-app'\n"
            "import { PORTALS } from '../../platform/portal-config'\n\n"
            "createPortalApp(PORTALS.work)\n"
        )
    source = source.replace('PORTALS.employee', 'PORTALS.work').replace('PORTALS.center', 'PORTALS.work')
    write(work_main, source)
for path in (WEB / 'src/portals/employee', WEB / 'src/portals/center'):
    delete(path)

work_html = WEB / 'work.html'
if not work_html.exists():
    source = None
    for candidate in (WEB / 'employee.html', WEB / 'center.html', WEB / 'admin.html', WEB / 'index.html'):
        if candidate.exists():
            source = candidate.read_text(encoding='utf-8')
            break
    if source is None:
        source = (
            '<!doctype html>\n<html lang="zh-CN"><head><meta charset="UTF-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1.0">'
            '<title>上金谷管理平台 · 工作端</title></head><body><div id="app"></div>'
            '<script type="module" src="/src/portals/work/main.ts"></script></body></html>\n'
        )
    source = re.sub(r'/src/portals/(employee|center|admin)/main\.ts', '/src/portals/work/main.ts', source)
    source = source.replace('员工端', '工作端').replace('中心管理端', '工作端').replace('中心端', '工作端')
    write(work_html, source)
for path in (WEB / 'employee.html', WEB / 'center.html'):
    delete(path)

# -----------------------------------------------------------------------------
# B. Runtime model: work + tech; legacy codes remain business-view labels only
# -----------------------------------------------------------------------------
portal_config = WEB / 'src/platform/portal-config.ts'
portal_text = portal_config.read_text(encoding='utf-8')
if 'work:' not in portal_text or "RuntimePortalCode = 'employee'" in portal_text:
    write(
        portal_config,
        """export type BusinessViewCode = 'employee' | 'center' | 'tech'
export type PortalCode = BusinessViewCode
export type RuntimePortalCode = 'work' | 'admin'
export type RuntimePortalKey = 'work' | 'tech'

export const BUSINESS_VIEW_RUNTIME_ALIASES = {
  employee: 'work',
  center: 'work',
  tech: 'admin',
} as const satisfies Readonly<Record<BusinessViewCode, RuntimePortalCode>>

export const PORTAL_RUNTIME_ALIASES = BUSINESS_VIEW_RUNTIME_ALIASES

export interface PortalDefinition {
  code: BusinessViewCode
  runtimeKey: RuntimePortalKey
  runtimeCode: RuntimePortalCode
  businessViewCodes: readonly BusinessViewCode[]
  title: string
  description: string
  homeTitle: string
  homeFocus: readonly string[]
}

export const PORTALS: Readonly<Record<RuntimePortalKey, PortalDefinition>> = {
  work: {
    code: 'employee',
    runtimeKey: 'work',
    runtimeCode: 'work',
    businessViewCodes: ['employee', 'center'],
    title: '工作端',
    description: '员工自助与中心管理在同一工作端按当前身份、组织、岗位、权限和数据范围动态呈现。',
    homeTitle: '工作端入口',
    homeFocus: [
      '本人发起、执行、确认、查询以及中心受理、审核、分派、复核和验收统一在工作端完成。',
      '身份切换后重新获取会话权限并重算导航、路由与数据范围。',
      '未接通真实服务或读模型的入口明确显示正在开发中，不伪造业务数据。',
    ],
  },
  tech: {
    code: 'tech',
    runtimeKey: 'tech',
    runtimeCode: 'admin',
    businessViewCodes: ['tech'],
    title: '技术端',
    description: '技术配置、运行监控、重试、补偿和审计入口，不代表业务超级管理员。',
    homeTitle: '技术运行入口',
    homeFocus: [
      '服务健康、Worker、外部集成与故障处置按真实技术权限开放。',
      '配置、发布、重试、补偿与审计只暴露明确授权的技术动作。',
      '技术端不替代业务审批，也不直接伪造业务完成状态。',
    ],
  },
}
""",
    )
else:
    replace_file(
        portal_config,
        [
            ("export type RuntimePortalCode = 'employee' | 'center' | 'admin'", "export type RuntimePortalCode = 'work' | 'admin'"),
            ("employee: 'employee'", "employee: 'work'"),
            ("center: 'center'", "center: 'work'"),
        ],
    )

for path in WEB.glob('src/portals/*/main.ts'):
    if path.parent.name == 'admin':
        replace_file(path, [('PORTALS.admin', 'PORTALS.tech')])

router = WEB / 'src/router/portal-router.ts'
replace_file(
    router,
    [(".filter((spec) => spec.portal === portal.code)", ".filter((spec) => portal.businessViewCodes.includes(spec.portal))")],
    [(r"\.filter\(\(spec\) => spec\.portal === portal\.code\)", ".filter((spec) => portal.businessViewCodes.includes(spec.portal))")],
)

projection = WEB / 'src/router/navigation-projection.ts'
projection_text = projection.read_text(encoding='utf-8')
if 'portalCodes?: readonly PortalCode[]' not in projection_text:
    projection_text = projection_text.replace(
        'portalCode: PortalCode\n  permissions:',
        'portalCode: PortalCode\n  portalCodes?: readonly PortalCode[]\n  permissions:',
    )
if 'function portalSatisfied' not in projection_text:
    projection_text = projection_text.replace(
        'function permissionsSatisfied',
        "function portalSatisfied(entry: NavigationSourceEntry, options: NavigationProjectionOptions): boolean {\n"
        "  const codes = options.portalCodes?.length ? options.portalCodes : [options.portalCode]\n"
        "  return codes.includes(entry.portalCode as PortalCode)\n"
        "}\n\nfunction permissionsSatisfied",
    )
projection_text = projection_text.replace('entry.portalCode === options.portalCode', 'portalSatisfied(entry, options)')
write(projection, projection_text)

navigation = WEB / 'src/router/PortalNavigation.vue'
nav_text = navigation.read_text(encoding='utf-8')
if 'portalCodes?: readonly PortalCode[]' not in nav_text:
    nav_text = nav_text.replace(
        'portalCode: PortalCode\n  mobile?: boolean',
        'portalCode: PortalCode\n  portalCodes?: readonly PortalCode[]\n  mobile?: boolean',
    )
nav_text = nav_text.replace(
    'portalCode: props.portalCode,',
    'portalCode: props.portalCode,\n  portalCodes: props.portalCodes,',
)
write(navigation, nav_text)

layout = WEB / 'src/platform/AuthenticatedPortalLayout.vue'
layout_text = layout.read_text(encoding='utf-8')
layout_text = layout_text.replace(
    'portalCode: props.portal.code,',
    'portalCode: props.portal.code,\n  portalCodes: props.portal.businessViewCodes,',
)
layout_text = layout_text.replace(
    ':portal-code="props.portal.code"',
    ':portal-code="props.portal.code"\n        :portal-codes="props.portal.businessViewCodes"',
)
if 'function currentRouteAuthorized' not in layout_text and 'async function switchIdentity' in layout_text:
    helper = """
function currentRouteAuthorized(): boolean {
  const required = typeof route.meta.permission === 'string' ? route.meta.permission : undefined
  if (required && !session.can(required)) return false
  const any = Array.isArray(route.meta.permissionsAny)
    ? route.meta.permissionsAny.filter((value): value is string => typeof value === 'string')
    : []
  return !any.length || any.some((permission) => session.can(permission))
}
"""
    layout_text = layout_text.replace('\nasync function switchIdentity', helper + '\nasync function switchIdentity')
    layout_text = re.sub(
        r"\n\s*const permission = typeof route\.meta\.permission[^\n]*\n\s*if \(permission && !session\.can\(permission\)\) await router\.replace\(\{ name: 'forbidden' \}\)",
        "\n    if (!currentRouteAuthorized()) await router.replace('/')",
        layout_text,
    )
write(layout, layout_text)

shell = WEB / 'src/shared/layout/rebuild/UnifiedPortalShell.vue'
shell_text = shell.read_text(encoding='utf-8')
shell_text = re.sub(
    r"const portalTag = computed\(\(\) => \(\{[\s\S]*?\}\)\[props\.portal\.code\] \?\? '平台端'\)",
    "const portalTag = computed(() => props.portal.runtimeCode === 'admin' ? '技术端' : '工作端')",
    shell_text,
    count=1,
)
write(shell, shell_text)

for config in (WEB / 'vite.config.ts', WEB / 'vite.config.mts', WEB / 'vite.config.js'):
    replace_file(
        config,
        [
            ("['employee', 'center', 'admin']", "['work', 'admin']"),
            ('["employee", "center", "admin"]', '["work", "admin"]'),
            ("mode === 'employee' || mode === 'center'", "mode === 'work'"),
            ("mode === 'employee'", "mode === 'work'"),
            ("mode === 'center'", "mode === 'work'"),
            ('employee.html', 'work.html'),
            ('center.html', 'work.html'),
            ('dist/employee', 'dist/work'),
            ('dist/center', 'dist/work'),
            ("'employee' | 'center' | 'admin'", "'work' | 'admin'"),
        ],
    )

for path in WEB.rglob('*'):
    if path.is_file() and path.suffix in {'.ts', '.tsx', '.vue', '.js', '.mjs', '.cjs'}:
        replace_file(path, [('PORTALS.employee', 'PORTALS.work'), ('PORTALS.center', 'PORTALS.work')])

# -----------------------------------------------------------------------------
# C. Engineering wording and trace documents use the dual-runtime vocabulary
# -----------------------------------------------------------------------------
LONG_REPLACEMENTS = [
    ('员工端、中心管理端和技术后台端', '工作端和技术端'),
    ('员工端、中心管理端、技术后台端', '工作端、技术端'),
    ('员工端、中心端和技术端', '工作端和技术端'),
    ('员工端、中心端、技术端', '工作端、技术端'),
    ('员工端 / 中心端 / 技术端', '工作端 / 技术端'),
    ('员工端/中心端/技术端', '工作端/技术端'),
    ('员工端、中心管理端', '工作端'),
    ('employee / center / tech', 'work / tech'),
    ('employee/center/tech', 'work/tech'),
    ('employee, center, tech', 'work, tech'),
    ('employee-web, center-web, tech-web', 'work-web, tech-web'),
    ('employee-web / center-web / tech-web', 'work-web / tech-web'),
    ('employee-web', 'work-web'),
    ('center-web', 'work-web'),
    ('three-portal', 'dual-portal'),
    ('three portal', 'dual portal'),
    ('Three-portal', 'Dual-portal'),
    ('Three portal', 'Dual portal'),
    ('三端统一', '双端统一'),
    ('三端共用', '双端共用'),
    ('三端共享', '双端共享'),
    ('三端架构', '双端架构'),
    ('三端页面', '双端页面'),
    ('三端入口', '双端入口'),
    ('三端应用', '双端应用'),
    ('三端导航', '双端导航'),
    ('三端联动', '双端联动'),
    ('三端流程', '双端流程'),
    ('三端字段', '双端字段'),
    ('三端权限', '双端权限'),
    ('三端', '双端'),
]
VIEW_REPLACEMENTS = [
    ('中心管理端', '工作端中心管理视图'),
    ('中心端', '工作端中心管理视图'),
    ('员工端', '工作端员工视图'),
    ('技术后台端', '技术端'),
]

for path in ROOT.rglob('*'):
    if not path.is_file() or excluded(path) or '.git/' in rel(path):
        continue
    if path.suffix.lower() not in TEXT_SUFFIXES and path.name not in TEXT_NAMES:
        continue
    try:
        text = path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        continue
    old = text
    for before, after in LONG_REPLACEMENTS:
        text = text.replace(before, after)
    if path.suffix.lower() in {'.md', '.txt', '.csv', '.yaml', '.yml', '.toml', '.ini', '.properties', '.html', '.htm'}:
        for before, after in VIEW_REPLACEMENTS:
            text = text.replace(before, after)
    text = text.replace('pnpm run build:work && pnpm run build:work &&', 'pnpm run build:work &&')
    text = text.replace('pnpm run build:work && pnpm run build:work', 'pnpm run build:work')
    text = text.replace('work-web, work-web', 'work-web').replace('work-web / work-web', 'work-web')
    if text != old:
        write(path, text)

for path in sorted(ROOT.rglob('*'), key=lambda value: len(value.parts), reverse=True):
    if excluded(path) or '三端' not in path.name:
        continue
    target = path.with_name(path.name.replace('三端', '双端'))
    if target.exists():
        warnings.append(f'rename collision: {rel(path)} -> {rel(target)}')
        continue
    before = rel(path)
    path.rename(target)
    renamed.append((before, rel(target)))

# Version and metadata normalization in the two canonical specifications.
replace_file(
    ROOT / 'AGENT.md',
    [
        ('version: V1.2', 'version: V1.3'),
        ('portal_runtime_aliases: employee=employee; center=center; tech=admin', 'runtime_portals: work, tech'),
        ('scope: employee-web, center-web, tech-web', 'scope: work-web, tech-web'),
    ],
)
replace_file(
    ROOT / 'DESIGN.md',
    [
        ('version: V3.0', 'version: V3.1'),
        ('runtime_portals: employee / center / admin', 'runtime_portals: work / admin'),
        ('canonical_portals: employee / center / tech', 'business_view_codes: employee / center / tech'),
        ('员工端、中心管理端和技术后台端', '工作端和技术端'),
    ],
)

write(
    ROOT / 'README.md',
    """# 上金谷景区一体化运营管理平台

> Canonical repository: `tonghe0922-glitch/PublicCompany`
> Runtime architecture: `work / tech`
> Frontend stack: Vue 3.5 + TypeScript 5.9 + Vite + Pinia + Vue Router
> Backend stack: Java 21 + Spring Boot 3.5 + Spring MVC + Spring JDBC
> Database: PostgreSQL 16 + Flyway

## 双端运行架构

平台只保留两个可部署、可登录、可构建的运行入口：

1. **工作端 `work`**：承载员工自助与中心管理。登录后依据当前身份、组织、岗位、权限和数据范围动态呈现员工视图或中心管理视图；身份切换不会进入另一套前端。
2. **技术端 `tech`**：承载配置、监控、重试、补偿与审计，不自动获得业务审批权或敏感业务数据读取权。

`employee / center / tech` 仅作为历史业务视图代码、页面追溯标签和既有路由分类继续存在，不代表三个运行入口。既有 `/employee/**`、`/center/**`、`/tech/**` 业务路由为了兼容和审计追溯保持稳定。

## 前端运行

```bash
cd technical-platform/web
pnpm install
pnpm run dev:work   # 工作端，默认 5173
pnpm run dev:admin  # 技术端，默认 5175
```

生产构建：

```bash
pnpm run build
```

构建产物只允许：

```text
dist/work
dist/admin
```

## 权威资料

1. `AGENT.md`：全仓库工程执行约束；
2. `DESIGN.md`：双端视觉、交互、响应式与 Vue 实现基线；
3. `docs/adr/ADR-005-dual-portal.md`：双端运行架构决策；
4. `Knowledge Base/`：业务流程、字段、权限和数据库事实源，其中业务视图代码不等同于运行入口。

## 安全边界

- 前端菜单隐藏不等于权限控制；服务端 IAM、数据范围、字段权限和审计仍是最终边界。
- 工作端身份切换后必须重新获取会话并重新投影导航与路由。
- 技术端不是业务超级管理员，不得替代审批、付款、处分或薪资处理。
- 未开发页面统一显示“正在开发中”，不得伪造 API、数据库数据或业务完成状态。
""",
)

write(
    ROOT / 'docs/adr/ADR-005-dual-portal.md',
    """# ADR-005：工作端与技术端双端运行架构

- 状态：已接受
- 日期：2026-08-19

## 决策

平台运行时仅保留 `work` 和 `tech` 两个入口。`work` 合并员工自助和中心管理能力，并依据会话中的身份、组织、岗位、权限与数据范围动态投影；`tech` 独立承载技术配置、监控、重试、补偿和审计。

## 兼容边界

`employee / center / tech` 保留为业务视图和追溯代码，既有业务路由不迁移；它们不得再被用作独立构建模式、登录入口、部署单元或运行端口。后端领域逻辑、数据库结构和 Knowledge Base 事实源不因本 ADR 改写。

## 验收

- 仅存在 `work.html` 与 `admin.html`；
- 仅存在 `dev:work`、`dev:admin`、`build:work`、`build:admin`；
- 工作端路由同时注册员工视图和中心管理视图；
- 身份切换后重新投影权限并在失权时退出当前页面；
- 工程说明不再提出三个运行入口；
- 自动守卫阻止旧构建入口和旧运行口径回归。
""",
)

# Trace exports: portal_code remains a business-view label; runtime_portal is derived.
for path in ROOT.rglob('*.csv'):
    if excluded(path):
        continue
    try:
        rows = list(csv.reader(path.open('r', encoding='utf-8-sig', newline='')))
    except (UnicodeDecodeError, OSError, csv.Error):
        continue
    if not rows or 'portal_code' not in rows[0] or 'runtime_portal' in rows[0]:
        continue
    index = rows[0].index('portal_code')
    rows[0].insert(index + 1, 'runtime_portal')
    for row in rows[1:]:
        value = row[index].strip() if len(row) > index else ''
        runtime = 'work' if value in {'employee', 'center'} else ('tech' if value == 'tech' else '')
        while len(row) < index + 1:
            row.append('')
        row.insert(index + 1, runtime)
    stream = StringIO()
    csv.writer(stream, lineterminator='\n').writerows(rows)
    write(path, stream.getvalue())

# -----------------------------------------------------------------------------
# D. Ratchet guard and audit evidence
# -----------------------------------------------------------------------------
write(
    ROOT / 'scripts/implementation/dual_portal_guard.py',
    """from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / 'technical-platform/web'
errors = []
for path in (WEB/'employee.html', WEB/'center.html', WEB/'src/portals/employee', WEB/'src/portals/center'):
    if path.exists():
        errors.append(f'legacy runtime entry exists: {path.relative_to(ROOT)}')
pkg = json.loads((WEB/'package.json').read_text(encoding='utf-8'))
scripts = pkg.get('scripts', {})
for name in ('dev:employee', 'dev:center', 'build:employee', 'build:center'):
    if name in scripts:
        errors.append(f'legacy runtime command exists: {name}')
for name in ('dev:work', 'dev:admin', 'build:work', 'build:admin'):
    if name not in scripts:
        errors.append(f'missing dual-runtime command: {name}')
if scripts.get('build') != 'pnpm run build:work && pnpm run build:admin':
    errors.append('build must produce work and admin only')
scan_roots = (ROOT/'AGENT.md', ROOT/'DESIGN.md', ROOT/'README.md', ROOT/'docs', WEB/'src', WEB/'package.json')
for base in scan_roots:
    paths = [base] if base.is_file() else list(base.rglob('*')) if base.exists() else []
    for path in paths:
        if not path.is_file() or path.suffix.lower() not in {'.md','.txt','.csv','.json','.yaml','.yml','.ts','.vue','.js','.html'}:
            continue
        try:
            text = path.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            continue
        if '三端' in text:
            errors.append(f'legacy wording 三端: {path.relative_to(ROOT)}')
        for token in ('dev:employee','dev:center','build:employee','build:center'):
            if token in text:
                errors.append(f'legacy runtime command {token}: {path.relative_to(ROOT)}')
if errors:
    print('DUAL_PORTAL_GUARD_FAIL')
    print('\n'.join(sorted(set(errors))))
    sys.exit(1)
print('DUAL_PORTAL_GUARD_PASS')
""",
)

# Remove temporary snapshot helpers if the merge ref ever included them.
for name in ('temp-repository-snapshot.yml', 'temporary-repository-snapshot.yml', 'dual-portal-refactor.yml'):
    delete(ROOT / '.github/workflows' / name)

immutable_changes: list[str] = []
status = subprocess.run(['git', 'status', '--porcelain'], cwd=ROOT, text=True, capture_output=True, check=True).stdout
for line in status.splitlines():
    path = line[3:].split(' -> ')[-1]
    if any(path.startswith(prefix) for prefix in EXCLUDED_PREFIXES):
        immutable_changes.append(path)

residual: list[dict[str, object]] = []
for path in ROOT.rglob('*'):
    if not path.is_file() or excluded(path):
        continue
    if path.suffix.lower() not in TEXT_SUFFIXES and path.name not in TEXT_NAMES:
        continue
    try:
        text = path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        continue
    hits = [
        token for token in (
            '三端', 'dev:employee', 'dev:center', 'build:employee', 'build:center',
            'employee.html', 'center.html', 'dist/employee', 'dist/center',
        ) if token in text
    ]
    if hits:
        residual.append({'path': rel(path), 'tokens': hits})

report = {
    'generated_at': datetime.now(timezone.utc).isoformat(),
    'changed_count': len(set(changed)),
    'deleted_count': len(set(deleted)),
    'renamed_count': len(renamed),
    'changed': sorted(set(changed)),
    'deleted': sorted(set(deleted)),
    'renamed': renamed,
    'immutable_changes': sorted(set(immutable_changes)),
    'residual': residual,
    'warnings': warnings,
    'core': {
        'work_html': work_html.exists(),
        'admin_html': (WEB / 'admin.html').exists(),
        'employee_html': (WEB / 'employee.html').exists(),
        'center_html': (WEB / 'center.html').exists(),
        'work_main': work_main.exists(),
        'employee_portal_dir': (WEB / 'src/portals/employee').exists(),
        'center_portal_dir': (WEB / 'src/portals/center').exists(),
    },
}
write(ROOT / 'docs/implementation/DUAL_PORTAL_REFACTOR_REPORT.json', json.dumps(report, ensure_ascii=False, indent=2) + '\n')

if immutable_changes:
    raise SystemExit('immutable Knowledge Base/backend/database files changed: ' + ', '.join(immutable_changes[:20]))
if residual:
    raise SystemExit('legacy runtime wording remains; inspect DUAL_PORTAL_REFACTOR_REPORT.json')
print(json.dumps({'changed': report['changed_count'], 'deleted': report['deleted_count'], 'renamed': report['renamed_count']}, ensure_ascii=False))
