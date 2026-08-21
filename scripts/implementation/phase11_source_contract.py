#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "docs" / "implementation" / "phases" / "PHASE-11"
OUT_JSON = OUT_DIR / "P011_P016_SOURCE_SNAPSHOT.json"
PORTALS = ("employee", "center", "tech")
TARGET_CODES = ("P011", "P012", "P013", "P014", "P015", "P016")

CONTRACT_JSON = OUT_DIR / "P011_P016_SOURCE_CONTRACT.json"
CONTRACT_MD = OUT_DIR / "P011_P016_SOURCE_CONTRACT.md"


def load_snapshot() -> dict[str, Any]:
    if not OUT_JSON.is_file():
        raise RuntimeError("run phase11_preparation_extract.py before source-contract generation")
    payload = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    if payload.get("process_codes") != list(TARGET_CODES):
        raise RuntimeError("PHASE-11 source snapshot scope mismatch")
    return payload


def sheet(portal: dict[str, Any], name: str) -> dict[str, Any]:
    for item in portal["sheets"]:
        if item["sheet"] == name:
            return item
    raise RuntimeError(f"missing source sheet: {name}")


def data_rows(sheet_record: dict[str, Any], header_first_value: str) -> list[list[str]]:
    rows = [item["values"] for item in sheet_record["rows"]]
    header_index = next(
        (index for index, values in enumerate(rows) if values and values[0] == header_first_value),
        None,
    )
    if header_index is None:
        raise RuntimeError(
            f"{sheet_record['sheet']}: header {header_first_value!r} not found"
        )
    return rows[header_index + 1 :]


def parse_forms(portal: dict[str, Any]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for values in data_rows(sheet(portal, "01_表单清单"), "序号"):
        if len(values) < 10 or not values[1]:
            continue
        result.append({
            "form_code": values[1],
            "form_name": values[2],
            "portal": values[3],
            "node": values[4],
            "purpose": values[5],
            "primary_roles": values[6],
            "trigger": values[7],
            "completion": values[8],
            "exception_path": values[9],
            "field_count": int(values[10]) if len(values) > 10 and values[10].isdigit() else None,
        })
    return result


def parse_states(portal: dict[str, Any]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for values in data_rows(sheet(portal, "03_状态与审批"), "序号"):
        if len(values) < 12 or not values[1]:
            continue
        result.append({
            "state_code": values[1],
            "state_name": values[2],
            "entry_condition": values[3],
            "portal_duty": values[4],
            "allowed_actions_text": values[5],
            "next_state": values[6],
            "suggested_sla": values[7],
            "timeout_strategy": values[8],
            "return_reopen_rule": values[9],
            "notification_targets": values[10],
            "audit_points": values[11],
        })
    return result


def parse_rules_and_interfaces(
        portal: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    rows = [item["values"] for item in sheet(portal, "04_规则与接口")["rows"]]
    rule_header = next(
        index for index, values in enumerate(rows)
        if values and values[:3] == ["序号", "规则编码", "规则名称"]
    )
    interface_header = next(
        index for index, values in enumerate(rows)
        if values and values[:3] == ["序号", "接口编码", "关联系统"]
    )
    rules: list[dict[str, Any]] = []
    for values in rows[rule_header + 1 : interface_header - 1]:
        if len(values) < 8 or not values[1]:
            continue
        rules.append({
            "rule_code": values[1],
            "rule_name": values[2],
            "rule_text": values[3],
            "rejection": values[4],
            "trigger": values[5],
            "applicable_portal": values[6],
            "audit_record": values[7],
        })
    interfaces: list[dict[str, Any]] = []
    for values in rows[interface_header + 1 :]:
        if len(values) < 10 or not values[1]:
            continue
        interfaces.append({
            "interface_code": values[1],
            "related_system": values[2],
            "purpose": values[3],
            "interaction_mode": values[4],
            "key_data": values[5],
            "idempotency_key_suggestion": values[6],
            "retry_strategy": values[7],
            "degradation_compensation": values[8],
            "interface_audit": values[9],
        })
    return rules, interfaces


def parse_linkage(portal: dict[str, Any]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for values in data_rows(sheet(portal, "05_三端联动"), "节点序号"):
        if len(values) < 12 or not values[1]:
            continue
        result.append({
            "state_code": values[1],
            "business_node": values[2],
            "employee_duty": values[3],
            "employee_form_view": values[4],
            "center_duty": values[5],
            "center_form_view": values[6],
            "tech_duty": values[7],
            "tech_capability": values[8],
            "data_object": values[9],
            "domain_event": values[10],
            "node_output": values[11],
        })
    return result


def field_summary(portal: dict[str, Any]) -> dict[str, Any]:
    rows = data_rows(sheet(portal, "02_字段字典"), "序号")
    groups: Counter[str] = Counter()
    sensitivity: Counter[str] = Counter()
    entities: Counter[str] = Counter()
    field_count = 0
    for values in rows:
        if len(values) < 7 or not values[1]:
            continue
        field_count += 1
        if len(values) > 4 and values[4]:
            groups[values[4]] += 1
        if len(values) > 18 and values[18]:
            sensitivity[values[18]] += 1
        if len(values) > 22 and values[22]:
            entities[values[22]] += 1
    return {
        "field_count": field_count,
        "field_groups": dict(sorted(groups.items())),
        "sensitivity_counts": dict(sorted(sensitivity.items())),
        "declared_data_entities": sorted(entities),
    }


def normalized_rules(records: list[dict[str, Any]]) -> list[tuple[Any, ...]]:
    return [
        (
            item["rule_code"],
            item["rule_name"],
            item["rule_text"],
            item["rejection"],
            item["trigger"],
            item["audit_record"],
        )
        for item in records
    ]


def build_payload() -> dict[str, Any]:
    snapshot = load_snapshot()
    processes: dict[str, Any] = {}
    for process in snapshot["processes"]:
        code = process["process_code"]
        portals = process["portals"]
        forms = {portal: parse_forms(portals[portal]) for portal in PORTALS}
        portal_states = {portal: parse_states(portals[portal]) for portal in PORTALS}
        portal_rules: dict[str, list[dict[str, Any]]] = {}
        portal_interfaces: dict[str, list[dict[str, Any]]] = {}
        for portal in PORTALS:
            portal_rules[portal], portal_interfaces[portal] = (
                parse_rules_and_interfaces(portals[portal])
            )

        state_signatures = {
            portal: [
                (
                    item["state_code"],
                    item["state_name"],
                    item["entry_condition"],
                    item["allowed_actions_text"],
                    item["next_state"],
                    item["suggested_sla"],
                    item["timeout_strategy"],
                    item["return_reopen_rule"],
                    item["notification_targets"],
                    item["audit_points"],
                )
                for item in portal_states[portal]
            ]
            for portal in PORTALS
        }
        if len({json.dumps(value, ensure_ascii=False) for value in state_signatures.values()}) != 1:
            raise RuntimeError(f"{code}: state contract differs across portals")
        if len({
            json.dumps(normalized_rules(portal_rules[portal]), ensure_ascii=False)
            for portal in PORTALS
        }) != 1:
            raise RuntimeError(f"{code}: rule contract differs across portals")
        if len({
            json.dumps(portal_interfaces[portal], ensure_ascii=False)
            for portal in PORTALS
        }) != 1:
            raise RuntimeError(f"{code}: interface contract differs across portals")
        linkage = {portal: parse_linkage(portals[portal]) for portal in PORTALS}
        linkage_variances: list[dict[str, Any]] = []
        reference_linkage = linkage["employee"]
        for portal in ("center", "tech"):
            if linkage[portal] != reference_linkage:
                max_length = max(len(reference_linkage), len(linkage[portal]))
                for index in range(max_length):
                    expected = reference_linkage[index] if index < len(reference_linkage) else None
                    actual = linkage[portal][index] if index < len(linkage[portal]) else None
                    if expected != actual:
                        linkage_variances.append({
                            "portal": portal,
                            "row_index_1_based": index + 1,
                            "employee_workbook_record": expected,
                            "portal_workbook_record": actual,
                        })

        states: list[dict[str, Any]] = []
        for index, common in enumerate(portal_states["employee"]):
            states.append({
                **{key: value for key, value in common.items() if key != "portal_duty"},
                "portal_duties": {
                    portal: portal_states[portal][index]["portal_duty"]
                    for portal in PORTALS
                },
            })

        rules = [
            {
                **{key: value for key, value in item.items() if key != "applicable_portal"},
                "applicable_portals": {
                    portal: portal_rules[portal][index]["applicable_portal"]
                    for portal in PORTALS
                },
            }
            for index, item in enumerate(portal_rules["employee"])
        ]
        extra_rules = [
            {"rule_code": item["rule_code"], "rule_name": item["rule_name"], "rule_text": item["rule_text"]}
            for item in rules
            if item["rule_code"] not in {f"R{number:02d}" for number in range(1, 11)}
        ]
        clarification_items = [
            {
                "type": "SOURCE_TEXT_REVIEW_REQUIRED",
                "detail": (
                    "R11+ text is preserved exactly from the authoritative workbook. "
                    "C0 must explicitly accept, supersede from another authoritative source, "
                    "or record a source correction; silent normalization is forbidden."
                ),
                "records": extra_rules,
            }
        ] if extra_rules else [
            {
                "type": "DOMAIN_RULE_COVERAGE_REVIEW_REQUIRED",
                "detail": (
                    "The rule sheet contains only shared R01-R10 controls. "
                    "C0 must verify whether process-specific rules are fully expressed in "
                    "states/fields or require an additional authoritative source."
                ),
                "records": [],
            }
        ]
        if linkage_variances:
            clarification_items.append({
                "type": "THREE_PORTAL_LINKAGE_VARIANCE",
                "detail": (
                    "The three authoritative portal workbooks do not contain identical "
                    "linkage rows. C0 must select the authoritative source coordinate for "
                    "each variance; no portal is silently treated as correct."
                ),
                "records": linkage_variances,
            })

        processes[code] = {
            "canonical_name": process["canonical_name"],
            "database_mappings": process.get("database_mappings", []),
            "source_files": {
                portal: portals[portal]["source_file"] for portal in PORTALS
            },
            "source_sha256": {
                portal: portals[portal]["sha256"] for portal in PORTALS
            },
            "forms": forms,
            "field_summaries": {
                portal: field_summary(portals[portal]) for portal in PORTALS
            },
            "states": states,
            "rules": rules,
            "interfaces": portal_interfaces["employee"],
            "three_portal_linkage_by_source_portal": linkage,
            "linkage_variances": linkage_variances,
            "clarification_items": clarification_items,
        }

    return {
        "phase": "PHASE-11",
        "state": "PREPARATION_SOURCE_CONTRACT_NOT_C0_FROZEN",
        "scope": "P011-P016 绩效成长福利",
        "source_snapshot": str(OUT_JSON.relative_to(OUT_DIR.parents[3])),
        "source_snapshot_sha256": hashlib.sha256(OUT_JSON.read_bytes()).hexdigest(),
        "process_codes": list(TARGET_CODES),
        "processes": processes,
        "rules": {
            "http_paths_frozen": False,
            "permission_codes_frozen": False,
            "page_bindings_frozen": False,
            "workflow_versions_frozen": False,
            "source_text_silently_corrected": False,
            "tech_business_super_admin": False,
            "p017_plus_in_scope": False,
        },
    }


def escape(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def build_markdown(payload: dict[str, Any]) -> str:
    lines = [
        "# PHASE-11 P011–P016 SOURCE CONTRACT（PREPARATION）",
        "",
        "> 本合同由 18 份权威 XLSX 实际解析结果生成；当前状态是准备合同，不是 C0 最终冻结，也不代表业务已实现。",
        "> 不在本文件中推断 HTTP 路径、权限编码、页面路由、审批人、公式、金额或数据范围。",
        "",
        "## Scope summary",
        "",
        "| Process | State sequence | Employee forms | Center forms | Tech forms | DB mapping |",
        "|---|---|---:|---:|---:|---|",
    ]
    for code in TARGET_CODES:
        process = payload["processes"][code]
        sequence = " → ".join(state["state_name"] for state in process["states"])
        mapping = ", ".join(
            f"{item.get('schema')}.{str(item.get('table', '')).split('.')[-1]}"
            for item in process["database_mappings"]
        )
        forms = process["forms"]
        lines.append(
            f"| {code} {escape(process['canonical_name'])} | {escape(sequence)} | "
            f"{len(forms['employee'])} | {len(forms['center'])} | {len(forms['tech'])} | "
            f"`{escape(mapping)}` |"
        )

    lines.extend(["", "## Process details", ""])
    for code in TARGET_CODES:
        process = payload["processes"][code]
        lines.extend([
            f"### {code}｜{process['canonical_name']}",
            "",
            "**State sequence**",
            "",
            "`" + " → ".join(
                f"{item['state_code']} {item['state_name']}" for item in process["states"]
            ) + "`",
            "",
            "**Forms by portal**",
            "",
            "| Portal | Form code | Form name | Node | Purpose |",
            "|---|---|---|---|---|",
        ])
        for portal in PORTALS:
            for form in process["forms"][portal]:
                lines.append(
                    f"| {portal} | `{escape(form['form_code'])}` | "
                    f"{escape(form['form_name'])} | {escape(form['node'])} | "
                    f"{escape(form['purpose'])} |"
                )
        lines.extend(["", "**Interfaces declared by source**", ""])
        lines.append(
            ", ".join(
                f"`{item['interface_code']} {escape(item['related_system'])}`"
                for item in process["interfaces"]
            )
        )
        lines.extend(["", "**Source clarification before C0**", ""])
        for item in process["clarification_items"]:
            lines.append(f"- `{item['type']}`：{item['detail']}")
            for record in item["records"]:
                if item["type"] == "SOURCE_TEXT_REVIEW_REQUIRED":
                    lines.append(
                        f"  - `{record['rule_code']}` {escape(record['rule_name'])}："
                        f"{escape(record['rule_text'])}"
                    )
                elif item["type"] == "THREE_PORTAL_LINKAGE_VARIANCE":
                    actual = record.get("portal_workbook_record") or {}
                    expected = record.get("employee_workbook_record") or {}
                    state_code = actual.get("state_code") or expected.get("state_code") or "missing"
                    lines.append(
                        f"  - `{record['portal']}/{state_code}`：employee-source linkage "
                        "and portal-source linkage differ"
                    )
        lines.append("")

    lines.extend([
        "## Shared preparation constraints",
        "",
        "- 三端共享同一业务事实；端口只改变职责、动作和投影。",
        "- 技术端只承担配置、监控、审计、接口和数据修复保障；不得自动拥有业务决定权。",
        "- 状态、规则、接口和表单文字保持来源原文；发现疑似跨域内容只登记澄清，不静默改写。",
        "- HTTP、permission、route、workflow version 需在 P011 C0 后逐项冻结。",
    ])
    return "\n".join(lines) + "\n"


def write_outputs() -> None:
    payload = build_payload()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    CONTRACT_JSON.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    CONTRACT_MD.write_text(build_markdown(payload), encoding="utf-8")


def check_outputs() -> None:
    expected = build_payload()
    if not CONTRACT_JSON.is_file() or not CONTRACT_MD.is_file():
        raise RuntimeError("PHASE-11 source contract outputs are missing")
    if json.loads(CONTRACT_JSON.read_text(encoding="utf-8")) != expected:
        raise RuntimeError("P011_P016_SOURCE_CONTRACT.json is stale")
    if CONTRACT_MD.read_text(encoding="utf-8") != build_markdown(expected):
        raise RuntimeError("P011_P016_SOURCE_CONTRACT.md is stale")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check_outputs()
        print("PHASE-11 source contract is deterministic and current")
    else:
        write_outputs()
        print("PHASE-11 source contract generated from 18 parsed XLSX workbooks")


if __name__ == "__main__":
    main()
