#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
PHASE = ROOT / 'docs' / 'implementation' / 'phases' / 'PHASE-08'
SOURCE = PHASE / 'PAGE_IA_EXTRACT.json'
OUT_JSON = ROOT / 'technical-platform' / 'web' / 'src' / 'router' / 'generated' / 'portal-ia-navigation.json'
OUT_MD = PHASE / 'PAGE_IA_NAVIGATION.md'
PORTALS = ('employee', 'center', 'tech')


def text(value: object) -> str | None:
    return value if isinstance(value, str) and value.strip() else None


def string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return sorted({item for item in value if isinstance(item, str) and item})


def normalize(record: dict[str, Any]) -> dict[str, Any] | None:
    portal = text(record.get('portal_code'))
    level1 = text(record.get('level_1'))
    level2 = text(record.get('level_2'))
    level3 = text(record.get('level_3'))
    if portal not in PORTALS or level1 is None or level3 is not None:
        return None
    display = text(record.get('display_name')) or level2 or level1
    source_key = text(record.get('source_key'))
    if source_key is None:
        return None
    return {
        'portalCode': portal,
        'sourceKey': source_key,
        'sourceFile': text(record.get('source_file')),
        'sourceSheet': text(record.get('source_sheet')),
        'level1': level1,
        'level2': level2,
        'label': display,
        'routeName': text(record.get('route_name')),
        'routePath': text(record.get('route_path')),
        'permissionCodes': string_list(record.get('permission_codes') or record.get('permission_code')),
        'mobileAccess': text(record.get('mobile_access')) or 'no',
        'status': text(record.get('status')) or 'planned',
        'sensitiveLevel': text(record.get('sensitive_level')),
        'dataScope': text(record.get('data_scope')),
    }


def build_payload() -> dict[str, Any]:
    payload = json.loads(SOURCE.read_text(encoding='utf-8'))
    records = payload.get('route_source_records')
    if not isinstance(records, list):
        raise RuntimeError('PAGE_IA_EXTRACT route_source_records missing')
    normalized: dict[tuple[str, str], dict[str, Any]] = {}
    for raw in records:
        if not isinstance(raw, dict):
            continue
        item = normalize(raw)
        if item is None:
            continue
        key = (item['portalCode'], item['sourceKey'])
        previous = normalized.get(key)
        if previous is not None and previous != item:
            raise RuntimeError(f'conflicting normalized navigation record: {key}')
        normalized[key] = item
    entries = sorted(
        normalized.values(),
        key=lambda item: (
            item['portalCode'], item['level1'], item['level2'] or '', item['sourceKey'],
        ),
    )
    counts = {portal: sum(1 for item in entries if item['portalCode'] == portal) for portal in PORTALS}
    if any(count == 0 for count in counts.values()):
        raise RuntimeError(f'portal navigation source empty: {counts}')
    return {
        'version': 1,
        'source': 'PHASE-08/PAGE_IA_EXTRACT.json',
        'rules': {
            'businessRouteActivation': 'implemented-and-router-present-only',
            'permissionInference': 'forbidden',
            'multiPermissionBehavior': 'fail-closed-all-required',
            'fakeBadgeSearchMessage': 'forbidden',
        },
        'counts': counts,
        'entries': entries,
    }


def build_markdown(payload: dict[str, Any]) -> str:
    lines = [
        '# PHASE-08 PAGE IA NAVIGATION SOURCE', '',
        '> 由 PAGE_IA_EXTRACT.json 确定性派生，仅保留一级/二级 IA；不把 planned 业务页面自动升级成可点击 route。', '',
        '## Counts', '',
    ]
    for portal in PORTALS:
        lines.append(f"- {portal}: **{payload['counts'][portal]}** source records")
    lines += [
        '', '## Activation rules', '',
        '- business entry 必须 `status=implemented` 且 route_path 已存在于真实 Router；',
        '- permission code 只使用 canonical source；多个 permission 时 fail-closed，全部满足才可显示；',
        '- `mobile_access=no` 在移动端不显示；`limited` 保留限制标识，不扩大能力；',
        '- planned taxonomy 可以用于结构说明，但不能生成假业务页面、假 badge、假搜索、假消息。',
        '', 'Machine source: `technical-platform/web/src/router/generated/portal-ia-navigation.json`.',
    ]
    return '\n'.join(lines) + '\n'


def write_outputs() -> None:
    payload = build_payload()
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    OUT_MD.write_text(build_markdown(payload), encoding='utf-8')


def check_outputs() -> None:
    expected = build_payload()
    if not OUT_JSON.is_file() or not OUT_MD.is_file():
        raise RuntimeError('C4 navigation generated evidence missing')
    if json.loads(OUT_JSON.read_text(encoding='utf-8')) != expected:
        raise RuntimeError('portal-ia-navigation.json is stale')
    if OUT_MD.read_text(encoding='utf-8') != build_markdown(expected):
        raise RuntimeError('PAGE_IA_NAVIGATION.md is stale')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.check:
        check_outputs()
        print('PHASE-08 C4 navigation source is deterministic and current')
    else:
        write_outputs()
        print('PHASE-08 C4 navigation source generated')


if __name__ == '__main__':
    main()
