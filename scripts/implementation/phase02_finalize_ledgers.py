#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def stable_hash(value: object) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def replace_required(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return text.replace(old, new)
    if new in text:
        return text
    raise RuntimeError(f"expected text not found for {label}: {old}")


def patch_catalog(path: Path, collection_key: str) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    before = stable_hash(data[collection_key])
    foundation = data.get("platform_foundation")
    if not isinstance(foundation, dict):
        raise RuntimeError(f"missing platform_foundation in {path}")
    foundation.update(
        {
            "reviewed_in_phase": "PHASE-02",
            "status": "PHASE_02_COMPLETE",
            "canonical_portals": ["employee", "center", "tech"],
            "runtime_portals": ["employee", "center", "admin"],
            "runtime_aliases": {"employee": "employee", "center": "center", "tech": "admin"},
            "business_implementation_changed": False,
            "business_items_marked_implemented_by_phase02": 0,
            "note": "PHASE-02 formal gate completed. Canonical tech uses approved admin runtime/build alias; business records remain governed by PHASE-01 source contracts.",
        }
    )
    after = stable_hash(data[collection_key])
    if before != after:
        raise RuntimeError(f"{collection_key} content changed while finalizing PHASE-02")
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def patch_progress(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    text = replace_required(
        text,
        "> Current construction result: `PHASE-02 = GATE_FIX_READY_FOR_RECHECK`",
        "> Current completed phase: `PHASE-02`",
        "progress headline",
    )
    text = replace_required(
        text,
        "PHASE-01 已完成正式独立 Phase Gate并保持 `COMPLETE`。PHASE-02 Formal Gate 曾为 `FAIL`；FAIL-01～FAIL-04 已完成定向修复与回归验证，当前为 `READY_FOR_RECHECK`。PHASE-03 仍保持 `NOT_STARTED`。",
        "PHASE-01 与 PHASE-02 均已完成正式独立 Phase Gate并保持 `COMPLETE`。PHASE-03 仍为 `NOT_STARTED`，仅在用户明确发出下一阶段施工指令后开始。",
        "progress gate paragraph",
    )
    text = replace_required(
        text,
        "| PHASE-02 | READY_FOR_RECHECK | Formal Gate FAIL 项已定向修复并通过修复回归，等待独立复验 |",
        "| PHASE-02 | COMPLETE | 仓库工程骨架、构建系统与开发环境；Formal Phase Gate PASS |",
        "progress phase row",
    )
    text = replace_required(
        text,
        "PHASE-01 = COMPLETE\nPHASE-02 = READY_FOR_RECHECK\nPHASE-03 = NOT_STARTED",
        "PHASE-01 = COMPLETE\nPHASE-02 = COMPLETE\nPHASE-03 = NOT_STARTED",
        "next phase control block",
    )
    text = replace_required(
        text,
        "PHASE-02 已完成 Gate Fix，但在新的 Formal Phase Gate 给出 PASS 前，禁止进入 PHASE-03。",
        "PHASE-02 Formal Phase Gate 已通过；可以在用户明确施工指令后进入 PHASE-03，但本次验收不自动开始下一阶段。",
        "next phase control prose",
    )
    text = replace_required(
        text,
        "- 当前仅为 `READY_FOR_RECHECK`；不得自行宣布 Formal Gate PASS。",
        "- Formal Phase Gate recheck: `PASS`；PHASE-02 已转为 `COMPLETE`。",
        "gate fix status bullet",
    )
    path.write_text(text.rstrip() + "\n", encoding="utf-8")


def patch_master_gaps(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    text = replace_required(
        text,
        "- Status: `PLATFORM_READY / GATE_FIX_READY_FOR_RECHECK`.",
        "- Status: `PLATFORM_READY / PHASE_GATE_COMPLETE`.",
        "master gaps status",
    )
    text = replace_required(
        text,
        "- Formal Gate FAIL-01～FAIL-04 已完成定向修复；状态为 `READY_FOR_RECHECK`，不是 Formal Gate PASS。",
        "- Formal Gate FAIL-01～FAIL-04 已完成定向修复，并经独立 Formal Phase Gate recheck 验证通过；PHASE-02 = `COMPLETE`。",
        "master gaps gate status",
    )
    text = replace_required(
        text,
        "- PHASE-02 最终状态仍等待独立 Phase Gate C 复验；PHASE-03 不得开始。",
        "- PHASE-02 Formal Phase Gate 已通过；PHASE-03 仍为 `NOT_STARTED`，等待用户明确施工指令。",
        "master gaps next phase",
    )
    path.write_text(text.rstrip() + "\n", encoding="utf-8")


def validate_complete_state() -> None:
    progress = (ROOT / "docs/implementation/MASTER_PROGRESS.md").read_text(encoding="utf-8")
    if "| PHASE-02 | COMPLETE |" not in progress:
        raise RuntimeError("PHASE-02 is not COMPLETE in MASTER_PROGRESS")
    if "| PHASE-03 |" not in progress:
        raise RuntimeError("MASTER_PROGRESS lost the PHASE-03 row")
    gate = (ROOT / "docs/implementation/phases/PHASE-02/PHASE_GATE.md").read_text(encoding="utf-8")
    if "PHASE GATE: PASS" not in gate:
        raise RuntimeError("PHASE_GATE.md must record PASS after formal recheck")
    for path, key, expected in [
        (ROOT / "docs/implementation/MASTER_PAGE_CATALOG.json", "pages", 7126),
        (ROOT / "docs/implementation/MASTER_PROCESS_CATALOG.json", "processes", 126),
    ]:
        data = json.loads(path.read_text(encoding="utf-8"))
        if len(data[key]) != expected:
            raise RuntimeError(f"unexpected {key} count: {len(data[key])}")
        foundation = data.get("platform_foundation", {})
        if foundation.get("status") != "PHASE_02_COMPLETE":
            raise RuntimeError(f"platform foundation not complete in {path}")
        if foundation.get("runtime_aliases", {}).get("tech") != "admin":
            raise RuntimeError(f"tech runtime alias drift in {path}")


def main() -> None:
    progress_path = ROOT / "docs/implementation/MASTER_PROGRESS.md"
    progress = progress_path.read_text(encoding="utf-8")

    if "| PHASE-02 | COMPLETE |" not in progress:
        patch_progress(progress_path)
        patch_master_gaps(ROOT / "docs/implementation/MASTER_GAPS.md")
        patch_catalog(ROOT / "docs/implementation/MASTER_PAGE_CATALOG.json", "pages")
        patch_catalog(ROOT / "docs/implementation/MASTER_PROCESS_CATALOG.json", "processes")

    # Once PHASE-02 is COMPLETE, later phases may legitimately advance. This validator
    # verifies PHASE-02 invariants without rewriting PHASE-03+ construction state.
    validate_complete_state()


if __name__ == "__main__":
    main()
