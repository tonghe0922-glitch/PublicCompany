# P10-COMP-03A Independent Gate

- Review date: 2026-08-13
- Repository: `I:\PublicCompany_source_codex`
- Verdict: **FAIL**
- Next task: **LOCKED** (`P10-COMP-03B` and later UI tasks may not start)

## Accepted submission facts

- Dependency `P10-COMP-02` is independently PASS and the 23 submitted paths are within the YAML allowlist.
- The submitted canonical files, aliases, empty exception ledger, five P006–P010 plans, registry snapshot, report and failure history are present.
- Submitted hashes report 23 files with mismatch 0. The post classification records UI 21 / concurrent CORE 1 / unrelated 0 / metadata 1; the one CORE file is `technical-platform/web/e2e/phase11-p015-live.spec.ts`.
- The submitted positive matrix and current-debt results are internally consistent: current debt remains visible instead of being converted into exceptions.
- These facts do not cure the fail-open behavior below. The task acceptance requires a Gate that rejects future invalid changes, not merely a current snapshot that happens to be well formed.

## Hard-gate findings

### P0-1 — Registry/public-boundary validation can be bypassed

Affected implementation:

- `scripts/implementation/ui_component_access_gate.py:203-215` compares the registry only with `src/design-system/**/*.vue`; it does not compare the registry with `src/platform/processes/shared/**/*.vue`.
- `scripts/implementation/ui_component_access_gate.py:222-250` does not validate the registry `status`, `layer`, `public`, `public_import`, `export_name`, or `required_tests` contract as a closed schema.

Independent results:

1. Adding `technical-platform/web/src/platform/processes/shared/NewComposite.vue` without a registry entry or public export returns `PASS` with zero findings.
2. Changing an existing registry entry to an invented status, marking it non-public, clearing its export/test fields, while its source and barrel export remain present, also returns `PASS` with zero findings.

This violates the acceptance requirements that the two public exits are authoritative and that a new public component missing registration/export/tests is rejected. Every actual component in both governed roots must be classified by an allowed status/layer and its registry/public-index/test relationship must be closed and unambiguous.

### P0-2 — Page-plan schema and plan instances are not fail-closed

Affected implementation:

- `scripts/implementation/ui_component_access_gate.py:268` unions `source_facts` and `responsive_projection` into the schema's required set before checking it. Removing both fields from the canonical schema therefore passes.
- `scripts/implementation/ui_component_access_gate.py:296-328` checks only selected top-level fields and does not validate plan instances against the canonical JSON schema.

Independent results:

1. Removing `source_facts` and `responsive_projection` from `PAGE_COMPONENT_USAGE_PLAN.schema.json.required` returns `PASS` with zero findings.
2. Replacing `field_component_map`, `state_component_map`, and `action_component_map` with string/null/object values, and making `process_codes`, `gaps`, and `decision` invalid types, returns `PASS` with zero findings.

This contradicts “页面使用计划可被机器校验”. The Gate must validate the canonical schema itself and validate every plan against that schema, including nested item shapes, enum/status values, arrays, and unknown/unsupported fields as required by the canonical contract.

### P0-3 — Native-control and deep-import checks have executable bypasses

Affected implementation:

- `scripts/implementation/ui_component_access_gate.py:367-385` uses literal regular expressions only.

Independent results:

1. A business SFC rendering `<component :is="tag">` with `tag = 'button'` returns `PASS` with zero findings.
2. A business SFC using `const source = '../../design-system/components/Button.vue'; import(source)` returns `PASS` with zero findings.

The current scanner therefore does not enforce the canonical zero-native-control and unique-public-import boundaries for statically resolvable indirection. Unsupported dynamic component/import expressions must fail closed with stable finding codes; statically resolvable forms must be resolved and checked.

## Independent reproduction

Reviewer fixture:

`docs/implementation/phases/PHASE-10/P10-COMP-03A_REVIEW_FIXTURES.py`

Command:

```powershell
Set-Location -LiteralPath 'I:\PublicCompany_source_codex'
python docs/implementation/phases/PHASE-10/P10-COMP-03A_REVIEW_FIXTURES.py
```

Actual result: exit 1, `probe_count=6`, `fail_open_count=6`; every probe reports Gate `PASS`, `error_count=0`, and no finding codes.

Expected result: reviewer fixture exit 0 with `fail_open_count=0`; each mutation must produce a stable, specific error finding while the clean fixture remains PASS.

## Required remediation and focused re-review

1. Cover both governed component roots (`src/design-system` and `src/platform/processes/shared`) and validate registry entries against a closed set of statuses/layers/field combinations. Detect source/export classification mismatches by implementation path, not only by a nullable declared export name.
2. Correct the schema-required check and perform real JSON-schema-equivalent validation for all five page plans, including nested maps and item types.
3. Replace the source regex-only decision with a parser/tokenizer or an explicitly fail-closed static grammar for dynamic components/imports. Add official equivalents of all six reviewer probes plus clean positives.
4. Preserve current 190/340/79 debt and the empty exceptions ledger; do not silence the new findings with exceptions or scope reduction.
5. On resubmission, use a fresh coordinated pre baseline because this reviewer gate and fixture are new reviewer-owned hand-written files. Provide exact post/scoped/hash and classify any CORE changes separately.
6. Focused rerun scope: project Gate compile/self/current, official and reviewer fixtures, registry/source/export/test coverage, five-plan schema validation, alias targeted tests, lint/typecheck/full unit/build/Knip, and a fresh representative Browser with exact cleanup. Existing failure-chain evidence must remain intact.

No business page, API, workflow, permission, or data-scope defect is asserted in this review. The Gate itself is fail-open on mandatory acceptance categories, so the overall task is **FAIL**.

## RESUBMIT-1 focused review — FAIL

- Review date: 2026-08-13
- Submission baseline: fresh pre-2 `1EE760B478C9432364B692ADE32C61C841B769F9CE048CD73C7B94C22279D35D` / task `A3E20B12B46FB350534C2D563709C5E7B92203ECF80577D53A98291909E09DBB`
- Comparable post: workspace `C1EDDA4378BC96A1AD5877646A8B19918F0340CAD580E72CBE25CCD4176E4787` / task `D92E47BC07DC2C8C1A4FE839E31082F289BCBA27A489C0BF76BF8D95CBCE2909`
- Verdict: **FAIL**; `P10-COMP-03B` and later tasks remain locked.

### Accepted remediation and evidence

- The original six reviewer probes now return exit 0 with `fail_open_count=0`.
- The schema `required` list now includes `source_facts` and `responsive_projection`; the five current plans have zero submitted structural findings.
- The submitted post manifest, metadata and 23 file hashes match the frozen disk. The raw pre-2 and comparable post contain the same source path/hash/byte set after the documented report/`exists`/ordering projection.
- Submitted static results, 36 files / 198 unit tests, three builds, Knip and the fresh P016 Chromium/cleanup evidence are internally consistent. They do not cure the new fail-open cases below.

### P0-1 — Fake export and fake test text satisfy the public-component closure

`parse_barrel()` scans unmasked text with a regular expression, and access-test coverage is a quoted-name search over the whole file. `required_tests` accepts any existing path without proving it is a test.

Independent mutations that all return Gate `PASS`, zero findings:

1. Replace the real public barrel exports with the same `export ... from ...` text inside line comments.
2. Put the same fake exports inside ordinary string literals.
3. Replace the alias test with a comment containing only `'SgjButton'` and `'SgjFormPageTemplate'`.
4. Point `required_tests` at `Button.vue` itself instead of a test file.

This violates the acceptance rule that a public component missing a real export or test must be rejected. Comments, strings and production source files are not executable exports/tests.

### P0-2 — Object-form dynamic component binding bypasses native-control enforcement

The scanner handles `:is`/`v-bind:is` but not Vue's object-form binding. A page containing:

```vue
<script setup lang="ts">const tag = 'button'</script>
<template><component v-bind="{ is: tag }" /></template>
```

returns Gate `PASS`, zero findings. This is a statically resolvable native interactive control and must produce `DYNAMIC_NATIVE_COMPONENT` (or another stable fail-closed code). Unsupported object binding must fail closed.

### P0-3 — The canonical schema can be silently weakened

The validator applies the current schema to plans but validates only the schema id, top-level object shape and the presence of required field names. It does not protect mandatory nested/type/enum constraints.

Both mutations return Gate `PASS`, zero findings:

1. Remove the `page_type` enum entirely.
2. Replace `$defs.componentMap` with only `{ "type": "object" }`, removing `component_id` and its nested field contract.

This contradicts the RESUBMIT-1 claim of strict canonical schema validation, including enum and nested-map shapes. A weakened authority cannot be allowed to validate its own weakening.

### Independent reproduction

Reviewer fixture:

`docs/implementation/phases/PHASE-10/P10-COMP-03A_REVIEW_FIXTURES_RESUBMIT1.py`

Actual result: exit 1, clean fixture `PASS`, seven probes, `fail_open_count=7`; every mutation returns `PASS`, zero findings.

### Required remediation

1. Tokenize/mask TypeScript before parsing barrels and tests; require real export declarations. Require `required_tests` paths to be test files and prove executable test coverage without accepting comments/strings.
2. Parse all supported Vue dynamic-component binding forms, including object `v-bind`; reject unsupported dynamic binding grammar with a stable fail-closed finding.
3. Validate the canonical schema against a fixed meta-contract for its required enum/type/nested definitions (or pin a canonical schema digest/version with an independently reviewed upgrade path) before using it to validate plans.
4. Add official equivalents of the seven new probes plus clean positives. Preserve the original six probes, current debt counts and all failure history.
5. Because reviewer-owned files and the Gate will change, coordinate another fresh pre/post chain. Do not reuse fresh pre-2.

Expensive frontend and Browser reruns were not repeated by the reviewer after these mandatory Gate fail-open findings. The submitted green frontend/Browser evidence remains recorded but cannot make a mandatory source Gate PASS.
