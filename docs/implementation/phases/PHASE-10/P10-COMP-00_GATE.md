# P10-COMP-00 Independent UI Gate

Status: `PASS`

Review round: `RESUBMIT-14B FOCUSED DOC FIX`

Reviewed at: `2026-08-13` (Asia/Shanghai)

Scope: only `I:\PublicCompany_source_codex`. `.git` is absent and no remote operation was performed.

## Verdict

P10-COMP-00 passes. The project-side source Gate, fail-closed local preflight/baseline tools, deterministic task/source/metadata chain, scope classification and positive/negative fixtures are independently reproducible. RESUBMIT-14 closes the last portal parameter fail-open defects; the focused 14B correction removes the final conflicting baseline summary.

This PASS unlocks only YAML-dependent task `P10-COMP-01`. It does not claim that the current PHASE-10 page/UI debt is resolved and does not close the full UI remediation program or PHASE-10 overall gate.

## Independent evidence

- Frozen task-source hashes:
  - `phase10_component_source_gate.py`: `AD87B19752DC5250E2ABDF03785744C008B189B0C4EFDC3273A0A2B98C7A783A` / 82,252 bytes;
  - `phase10_component_source_gate_test.py`: `387AF3BEE3F69BAC9D17534CE75C7629A5537F8BC57D68651BA3CDB8D1EE5122` / 44,158;
  - `phase10_component_local_tools_test.py`: `A77F094782430E4A6F1A79756746AD1FB6E050D58DF836F21C04ADA084032792` / 8,121;
  - preflight: `6E2CB035F99C454C519E8BCB0C349021108D6D811448C078FF3AEEF352502ADE` / 3,300;
  - baseline: `D02D430FD694A5D13CC1B5995DF91B036DBF28470C106361484BCF6E073B712F` / 8,017.
- Source self-test: exit `0`.
- Local-tools self-test: exit `0`.
- Package UI self-test: exit `0`.
- Reviewer RESUBMIT-13 portal probes: exit `0`, fail-open `0/4`.
- Reviewer RESUBMIT-14 additional portal probes: exit `0`, fail-open `0/9`; eight escape/mutation/call variants fail closed and the legal read-only dot-code guard passes.
- Current debt remains visible: source Gate `1 / FAIL / 357 / 7 routed pages / 46 actions`; package UI Gate `1 / FAIL / 88`.
- Submitted frontend regression evidence remains `lint/typecheck/test/build = 0/0/0/0`, `26 files / 109 tests`, all three portal builds pass with the retained approximately 2.057 MB chunk warning. No web/task-source file changed during the focused correction.

## Final deterministic chain

- Fresh pre:
  - workspace `32409EB1EF9B03C2388250FFD21F39351F442224199F7005631F576C8A32E5B3` / 1,455;
  - task `D38E6A5AE6D86E4B0580991630C5EB6BE3A4721B6B3C95F5B80FBAD9228F00F0` / 5;
  - metadata `B7E2A251D90BC3B2D57665F00409049B298F85DE99022AFFC9FA796CC14D179B` / 1.
- Final post:
  - workspace and task exactly unchanged;
  - metadata `6BC2D5166983FA3E8EDE90CBCD3E80F79EF76B2712BCC2A4B1F65735CC83EC7C` / 1;
  - scoped task/unrelated/concurrent-core/metadata `0/0/0/1`;
  - evidence tree excluded.
- Final report: `230F56C20E9B9D8B5F05653770EC587C748F27EE2D6E1545989EDD8C67C66188` / 26,470 bytes, exactly matching the final manifest.
- Report item 12 now names the same fresh post workspace/task/scoped values. The earlier 14A unrelated-reviewer anomaly is retained as non-authoritative history and is not misclassified.

## Reproduction

```powershell
python scripts/implementation/phase10_component_source_gate_test.py
python scripts/implementation/phase10_component_local_tools_test.py
python docs/implementation/phases/PHASE-10/evidence/P10-COMP-00/reviewer-resubmit13-variants.py
python docs/implementation/phases/PHASE-10/evidence/P10-COMP-00/reviewer-resubmit14-variants.py
```

Focused evidence:

- `docs/implementation/phases/PHASE-10/evidence/P10-COMP-00/round14b-pre/`
- `docs/implementation/phases/PHASE-10/evidence/P10-COMP-00/round14b-post/`
- `docs/implementation/phases/PHASE-10/evidence/P10-COMP-00/reviewer-resubmit14-live/`
- `docs/implementation/phases/PHASE-10/evidence/P10-COMP-00/reviewer-resubmit14-baseline/`

## Next task boundary

`P10-COMP-01` may begin subject to its YAML `allowed_paths`, `forbidden` rules and a new ownership/baseline claim. No later UI task is unlocked by this verdict.
