# P10-COMP-00 UI Gate Revalidation

Status: `RESUBMIT-14_READY / INDEPENDENT_REVIEW_PENDING`. This is not a PASS or PHASE-10 closure claim. `P10-COMP-01` remains locked pending independent PASS.

## 1. Root and historical facts

- Sole root: `I:\PublicCompany_source_codex`; local `.git` is absent.
- Package `LOCAL/00` and `LOCAL/01` failed to parse under installed Windows PowerShell and returned exit 1 before task edits. They are not called PASS. The original pre-task state is unavailable and is not reconstructed.
- Project-side PowerShell 5.1 equivalents remain fail-closed for required authorities, tools, source hashes, metadata and Git absence.
- Round8 baseline/scoped/frontend evidence independently passed, but RESUBMIT-8 failed because four cardinality/reference-owner variants bypassed the source Gate. Prior evidence is retained as history and is not reused as round9 acceptance.

## 2. Allowed hand-written scope

- `scripts/implementation/phase10_component_source_gate.py`
- `scripts/implementation/phase10_component_source_gate_test.py`
- `scripts/implementation/phase10_component_local_tools_test.py`
- `scripts/local/phase10-component-preflight.ps1`
- `scripts/local/phase10-component-baseline.ps1`
- this report
- generated `docs/implementation/phases/PHASE-10/evidence/P10-COMP-00/**`

Reviewer-owned `P10-COMP-00_GATE.md`, reviewer fixture/live evidence, all PHASE-11/P016 files and all web source files are not modified.

## 3. Nested-aware SFC and component graph

The Gate locates the top-level SFC template while skipping top-level script/style contents, then balances nested template tags. A named-slot or conditional inner `</template>` therefore cannot truncate later components or `<main>` landmarks.

Used component discovery supports PascalCase, Vue kebab-case (including acronym boundaries), lowercase single-word custom tags, static `<component is>`, statically resolvable `<component :is>`, default/named/local-alias imports, relative and `@/`/`~/` paths, async import, multi-level barrel/re-export and conditional use. An SFC top-level block scanner requires exactly one root template, at most one normal script and one script-setup, and skips complete style/custom blocks. Script-setup imports are template-visible; normal-script imports are visible only through a uniquely parsed Options API `components` object. Static shorthand, aliases and local static-object spreads are supported, while computed/dynamic registrations fail closed. Script languages are limited to parsed JS/TS forms; unknown preprocessors, JSX/TSX and malformed/unquoted `lang` values report `COMPONENT_GRAPH_SCRIPT_LANGUAGE_UNSUPPORTED`. Duplicate/conflicting/external/malformed blocks fail closed; template-descendant scripts and import-shaped comments/strings/regex cannot contribute.

The same graph starts from the actual router layout root and every router-discovered PHASE-10 page. Imported child main counts contribute to Shell and final route counts.

## 4. Router enumeration

The Gate masks JavaScript comments and values while preserving supported route keys, balances objects, and recursively traverses local/imported spread contributors. Every exported or local route array is checked with a strict object-property grammar: literal/static keys and proven identifier spreads are supported; computed keys, dynamic spreads/calls, getters, methods and opaque initializers fail closed. For a const route array, every later identifier reference must be a direct spread whose enclosing delimiter is the target route array; call/constructor/object/unrelated spreads, aliasing, mutation and escape are rejected. For a function contributor, every later reference must be that exact route-array invocation; reassignment/alias/property/index/argument use is rejected. Nested function/class/arrow/method scopes cannot contribute returns, every owner return must be a static route array, and the local contributor dependency graph rejects direct and mutual recursion while accepting proven DAGs.

JavaScript string masking now distinguishes single/double-quoted literals, interpolation-free templates, escaped interpolation text and executable template interpolation. Only real unescaped `${...}` (including nested or multiple expressions) leaves a non-static marker, so the shared recursive route-value grammar rejects it in meta, permissions arrays, props, redirects and children instead of treating it as a blank literal. Props shorthand is no longer accepted by the identifier name `portal`: it is admitted only inside a statically analyzed route-factory whose actual parameter is `portal`. The function body proof permits read-only `portal.code` guards and `{ portal }` data shorthand, while rejecting rebinding, property writes, delete/update, aliasing, return/throw/yield escape, unknown calls, closure capture and shadowing.

Default, lazy/dynamic imports and legitimate multi-route reuse remain supported. The current-repository assertion must discover P007Schedule, Phase09TechWorkflowMonitor and the other five actual page targets.

## 5. Comment/string-aware action authority

There is no hand-written Gate action list. V115-V119 transitions are extracted only from explicit-column `INSERT INTO workflow.wf_transition (...) VALUES (...)` statements; action/from/to values are read by their declared column positions. Comments, unrelated SQL calls/statements and non-DO dollar-quoted literals do not contribute actions. The five domain `ACTIONS` maps are extracted with a Java lexer that requires the filename-matching service class to be unique at compilation-unit brace depth zero, then accepts only its own class-level `static final ACTIONS` field.

Each expected service class must exist exactly once and contain exactly one qualifying field. Method locals, assignments, nested helpers and sibling top-level classes cannot satisfy the authority. SQL must contain exactly one structurally valid transition INSERT, and SQL/Java sets must be nonempty and exactly equal. The P007 completeness assertion includes `CONFIRM`, `LINK`, `MATCH_TEMPLATE`, `NO_CHANGE`, `REQUEST_CHANGE` and `SUBMIT_DEMAND`.

## 6. Executable round9 pre-freeze fixtures

Before round9 coordination:

- project source self-test exit 0;
- the independent round4 through round8 reviewer scripts each exit 0 with `fail_open_count=0`;
- project local-tools self-test exit 0;
- read-only current diagnostic found 7 pages / 46 derived actions and no router/action/component parser findings.

The formal self-test now also covers duplicate script-setup/root template cardinality, function reassignment, quoted nested-method return substitution and route-element spread into an unknown call, with corresponding legal normal+setup and static route contributor positives. It retains every earlier fixture and current-repository assertion.

The first round9-pre wrapper attempt returned exit 1 because output redirection opened log files before the evidence directory existed. Neither project tool started and no manifest was generated; `wrapper-attempt1-failure.json` records that fact. After creating the declared evidence directory, the unchanged project preflight/baseline ran and exited `0 / 0`:

- workspace-source `DA0E779B78FB47E9E2F85B13201A156B9F6B3E46FB237F089B8D9F12BF92B67A` / `1,454` files;
- task-source `634C5822F38D0E507A8B9504351190A07F3076E9E90481203D2ED03D5F222B82` / five files;
- evidence-metadata `CEB53B257D79BDA1F540BC29E3C2CF2BC9FA357AC78355FE2EE138B45F962970` / this report.

The pre workspace snapshot includes the seven P016 checkpoint documents declared by CORE. They are not UI task-source; no failed wrapper attempt is described as a Gate PASS.

The subsequent round9 final was deliberately aborted before submission. A read-only classification exposed a false positive against an existing P001 static route-object spread; the required positive-regression fix changed task source after round9-pre. Therefore every round9 pre/task/post ID is invalid for acceptance and will not be reused. After the fix, source self-test and reviewer round4-through-round8 suites returned 0 and current source returned to 357 findings. Round9b will establish a new coordinated pre.

Fresh coordinated round9b-pre project preflight/baseline exited `0 / 0`:

- workspace-source `A96A9F0E18B95C0EB54851A6FC098F554E218DB10E41A51D898A791E22B92DA6` / `1,454` files;
- task-source `804A01441E534B9BF88C011BB7EB514A6D3ABB908FBD4669B7A9EC3645C2E93E` / five files;
- evidence-metadata `CAC3F1D0286B300AE79B6BD5C85B905BD1BE871D9A8F867CDE679FB46F317954` / this report.

These fresh IDs, not the invalidated round9 IDs, are the only candidate pre IDs for acceptance.

Independent RESUBMIT-9B review nevertheless returned FAIL: an unregistered normal-script import, unsupported `lang="coffee"`, dynamic route-object keys and a recursive local contributor each returned `0 / PASS / 0`. Round9b remains truthful historical evidence but is not reused for RESUBMIT-10 acceptance. RESUBMIT-10 implements the four rules above. Its self-test adds all four negatives plus registered normal-script alias/static-spread, supported TS, literal-object and acyclic-contributor positives. Temporary source self-test and reviewer round4-through-round9b scripts now return exit 0 with zero fail-open probes; current diagnostics remain exit 1 / 357 findings / 7 pages / 46 actions. A new coordinated pre/final chain is still required.

Coordinated round10-pre project preflight/baseline then exited `0 / 0` after CORE Batch-1 naturally completed and all batch containers were absent:

- workspace-source `CA0EACDE650258F21988ADF497CFB96BC0C1ACEBDC4D8ABEAB9835DA6AD0DDF0` / `1,454` files;
- task-source `F0CC8F152222164687B4D1FCEB248B25BB74DA26A74AAC9826030442638035F9` / five files;
- evidence-metadata `8C5E1FF19A7DBFE849787007283E4BCE97ED0401E3EB01FACD88009F2313B5BB` / this report.

CORE had zero hand-written source/docs changes. Its six PHASE-11 full-gate logs and Maven target/Surefire/Failsafe outputs were excluded generated evidence and did not enter either source ID. This round10 pre, not any round9/round9b ID, is the candidate comparison baseline.

## 7. Last formal matrix and RESUBMIT-10 temporary regression

| Command | Exit | Result |
|---|---:|---|
| source self-test | 0 | round4-round8 plus additional variants PASS |
| reviewer round4 through round8 | 0 / 0 / 0 / 0 / 0 | all old probes fail closed; reviewer-owned files remained read-only |
| local-tools self-test | 0 | authority/tool/baseline fixtures PASS |
| current source Gate | 1 | FAIL / 357 across 7 routed pages and 46 derived actions; dependency debt remains visible |
| package UI self/current | 0 / 1 | self-test PASS; current FAIL / 88 errors, not hidden |
| `pnpm lint` / `typecheck` | 0 / 0 | PASS |
| `pnpm test` | 0 | PASS: 26 files / 109 tests |
| `pnpm build` | 0 | PASS: employee / center / admin; approximately 2.057 MB warning retained |
| round9-pre wrapper / project tools | 1 then 0 / 0 | wrapper did not start tools; recovered run produced exact IDs above |
| round9 final | aborted | task source changed after pre to fix a real positive regression; no submission made |
| round9b-pre preflight/baseline | 0 / 0 | fresh exact IDs recorded above; old IDs not reused |
| round9b-post preflight/baseline | 0 / 0 | fresh workspace/task IDs stable; scoped diff contains metadata only |
| RESUBMIT-9B independent review | FAIL | four new executable fail-open probes; P10-COMP-01 stayed locked |
| RESUBMIT-10 source self-test | 0 | new negatives/legal positives plus every existing fixture PASS |
| reviewer round4 through round9b temporary rerun | 0 each | every published probe has `fail_open_count=0`; reviewer files remained read-only |
| RESUBMIT-10 current source diagnostic | 1 | FAIL / 357 / 7 routed pages / 46 actions; debt remains visible |
| package UI self/current | 0 / 1 | self-test PASS; current FAIL / 88 errors across four scanned files, not hidden |
| `pnpm lint` / `pnpm typecheck` | 0 / 0 | PASS |
| `pnpm test` | 0 | PASS: 26 files / 109 tests |
| `pnpm build` | 0 | employee / center / admin PASS; 2,057.01 kB warning retained |
| round10-post preflight/baseline | 0 / 0 | workspace/task exactly stable; metadata-only scoped change |

## 8. UI plan, evidence and dependency

- UI plan: not applicable because no page is changed.
- Components, registry, public indexes, API, route source, mocks and exceptions: no change.
- Round9 evidence is retained only as aborted history. Round9b evidence is retained as the independently failed submission. RESUBMIT-10 formal evidence is `round10-pre`, `round10-validation`, `round10-post`.
- Round10-post workspace-source `CA0EACDE650258F21988ADF497CFB96BC0C1ACEBDC4D8ABEAB9835DA6AD0DDF0` / `1,454`, exactly equal to round10-pre.
- Round10-post task-source `F0CC8F152222164687B4D1FCEB248B25BB74DA26A74AAC9826030442638035F9` / five files, exactly equal to round10-pre.
- Final report evidence-metadata will be stored in the regenerated post manifest to avoid report self-reference, with exact path/SHA-256/bytes.
- Scoped diff: task-source zero, unrelated zero, concurrent CORE zero, report metadata one. Final dist, validation evidence and prior generated outputs remain excluded.
- Current page/UI debt and the approximately 2.046 MB build warning remain observations, not PASS claims.
- P10-COMP-01 remains locked.

## Fixed 12-item report

### RESUBMIT-11 delta

Independent RESUBMIT-10 review returned FAIL despite its internally consistent evidence chain. Four new probes showed that a local Options registry could be mutated before export, duplicate `path` and `component` keys could use a runtime-last value, and an executable route property call could pass. Round10 IDs are historical only and will not be reused.

RESUBMIT-11 proves a local registry has exactly one post-initializer reference: its exact `components` spread. Aliasing, pre/post-export mutation, calls, arguments and escapes fail closed. Route objects require unique normalized path/component keys across bare/quoted/computed-literal spellings, a closed top-level property allowlist, static value shapes, and no nested calls/functions/new/delete/dynamic spreads. Official fixtures cover mutation before/after export, alias escape, duplicate key forms/orders and nested dynamic meta, while immutable registry, unique keys and the current router remain positive.

Temporary regression before coordinated pre: source self-test exit 0; reviewer round4 through round10 scripts each exit 0 with `fail_open_count=0`; current source remains exit 1 / 357 findings / 7 routed pages / 46 actions. Fresh `round11-pre`, `round11-validation` and `round11-post` are required; P10-COMP-01 remains locked.

Coordinated round11-pre project preflight/baseline exited `0 / 0`: workspace-source `FEAACA28511A53BF04B2A207DDC72ABD2989BBBE2C9E721ADE7E6758CB8EDF80` / 1,454; task-source `F26A4AD202D91B9B39C856C3C0A772ACE1081A959CAFC84BC6635D506408DFFE` / five; evidence-metadata `C29AEDE730679B600525D6FAD93D30EE441B88A6270F350CA1D7C01AAF35391F` / one. CORE had zero hand-written changes; its eight full-gate logs and refreshed web dist were excluded generated and did not enter either source ID. Final validation/post requires a separate freeze.

Under the separate final freeze, the formal matrix returned: source self 0; reviewer round4 through round10 all 0/fail-open 0; local-tools 0; current source 1/357/7/46; package UI self/current 0/1 with 88 errors; lint/typecheck/test/build 0/0/0/0; 26 files/109 tests; employee/center/admin builds passed with the approximately 2,057.02 kB warning retained. Post preflight/baseline/scoped and final hashes are generated after this report text is frozen.

### RESUBMIT-12 delta

Independent RESUBMIT-11 review returned FAIL: an Options export replacement tail and mutable nested meta, props and redirect values each passed. Its IDs remain historical and are not reused. RESUBMIT-12 requires the parsed object or exact `defineComponent(object)` to be the complete export expression, rejecting logical/comma/conditional/member/call/chain tails and unknown wrappers. A shared recursive static-expression proof now validates meta, props, children route arrays and redirect objects: only literals, static nested objects/arrays, the explicit `portal` props shorthand and recursively proven route objects are accepted. Mutable identifiers, member/call/update/assignment/conditional/function/spread/accessor and unknown meta/redirect keys fail closed.

Official fixtures add the four reviewer-equivalent negatives and exact defineComponent/static nested/valid redirect/current children positives. Temporary regression: source self 0; reviewer round4 through round11 all 0/fail-open 0; current source remains 1/357/7/46. Fresh round12 pre/final evidence is pending and P10-COMP-01 remains locked.

Coordinated round12-pre project preflight/baseline exited `0 / 0`: workspace `DC71A21EB6FCF550180BEFE0842669F2E7974A3BA24285F47152D47F7AE43068` / 1,454; task `D201241DD27FB19275E450485C6B9DC273E02EE2184AEF7DC99A3D26FCA9210D` / five; metadata `FB48B6E46BE8F07EED9D955BD33EAA081970C3BB0CAE984EB86EE0672DCD724E` / one. CORE hand-written changes were zero; P011-P013 browser logs/runtime/reports/test-results/API target were excluded generated. Final validation/post requires a separate freeze.

The frozen formal matrix returned: source self 0; reviewer round4 through round11 all 0/fail-open 0; local 0; current source 1/357/7/46; package UI self/current 0/1 with 88 errors; lint/typecheck/test/build 0/0/0/0; 26/109 and three builds pass with the existing ~2.057 MB warning retained. CORE had zero hand-written changes; its P014 Browser 1/1 logs/runtime/reports were excluded generated. Fresh post/scoped and hashes follow this frozen report text.

### RESUBMIT-13 delta

Independent RESUBMIT-12 review returned FAIL: interpolated permission/permissionsAny/redirect templates and a reassigned top-level variable named `portal` were all erased or name-whitelisted into a false static result. Round12 IDs remain historical and are not reused. RESUBMIT-13 gives templates a nested-aware lexical span and preserves a same-width non-static marker for every unescaped interpolation; single/double quotes, interpolation-free templates and escaped `\${...}` text remain literals. The marker is consumed by the same recursive meta/props/redirect/children proof.

The `portal` name exception is removed. Only an actual route-factory parameter that passes a body-wide immutability/use audit may supply props shorthand. Official negative fixtures now cover reassignment, property write, delete, alias, direct and object call escape, closure capture, shadowing and return escape; positives cover the current portal factory, single/double quotes, interpolation-free backticks and escaped interpolation text. Temporary source self-test is exit 0 and current diagnostic remains the truthful exit 1 / 357 findings / 7 routed pages / 46 actions. Fresh round13 pre/final evidence is required; `P10-COMP-01` stays locked.

Coordinated round13-pre project preflight/baseline exited `0 / 0`: workspace-source `00C65151BD80025B2634746FC36F0F370307FC53B3489ADE63A1761FD565F684` / 1,455; task-source `94E6014B8937D6E9CA1983212B30A35DE3FEC05E2074CF6A568F68257E46D5B3` / five; evidence-metadata `0C66ADEB6D67D0F8C37B60B2DD196B1B5573D1F21B798ED8BEE1CA761562F658` / one. The twelve CORE-authored PHASE-11/MASTER final-gate documents are part of the pre workspace snapshot and not UI task source. The six P015/P016 Browser logs plus target/reports/test-results remain excluded generated.

Under the separate final freeze, CORE's only post-pre hand-written change is the `PHASE-11 formal independent review submitted` checkbox in `docs/implementation/phases/PHASE-11/START_CHECKLIST.md`; it is classified `concurrent_core`. The first validation wrapper attempt stopped after source self-test 0 because an embedded Python `run_name` quote was lost at the PowerShell/native boundary; the reviewer Gate did not execute and the empty log/result is not reused. The corrected complete matrix returned: source self 0; reviewer round4 through round12 all 0/fail-open 0 using read-only live-output protection; local-tools 0; current source 1/FAIL/357/7/46; package UI self/current 0/1 with 88 errors; lint/typecheck/test/build 0/0/0/0; 26 files/109 tests and employee/center/admin builds passed with the existing approximately 2.057 MB warning retained. Post preflight/baseline/scoped and hashes are generated after this report text is frozen.

The initial post preflight/baseline exited `0 / 0`: workspace-source `A136FB4685EA1EFCB66DAD73126A992CAB4F8B84D19699E629167E3F7221561C` / 1,455; task-source remained exactly `94E6014B8937D6E9CA1983212B30A35DE3FEC05E2074CF6A568F68257E46D5B3` / five. Scoped diff is task zero, unrelated zero, concurrent CORE one (`PHASE-11/START_CHECKLIST.md`), report metadata one, and evidence tree excluded. The post baseline is refreshed once after this final report statement; its manifest is authoritative for the final report SHA/bytes and metadata ID without creating a self-reference.

### RESUBMIT-14 delta

Independent RESUBMIT-13 review returned FAIL while confirming the dynamic-template fix: `portal.normalize()`, `++portal.code` and `new portal.Builder()` still passed because any dotted member was classified as a read. Round13 IDs remain historical and are not reused. RESUBMIT-14 restricts the only supported dotted reference to a non-executable, non-mutating `portal.code` read. Other members, method/optional/computed calls, constructors, call chains, prefix/postfix updates and assignment targets fail closed before the parameter can authorize props shorthand.

Official fixtures now include the three reviewer-equivalent failures plus optional/computed calls, a `portal.code` call chain and postfix update, while retaining the actual `portal.code` route guard and all prior positives. Temporary source self-test and the reviewer r13 script both exit 0 with `fail_open_count=0`; current source remains the truthful exit 1 / 357 findings / 7 routed pages / 46 actions. Fresh round14 pre/final evidence is required; `P10-COMP-01` remains locked.

Coordinated round14-pre project preflight/baseline exited `0 / 0`: workspace-source `0857EC9B0458ED148F4119484362B6D9A760B5A5512B959F5C63393796A51109` / 1,455; task-source `D38E6A5AE6D86E4B0580991630C5EB6BE3A4721B6B3C95F5B80FBAD9228F00F0` / five; evidence-metadata `272CE4576CC26B9AC775718E4CA07D2074EF0F27ABA620F18DFEC9C72F66F7E3` / one. The preceding independent PHASE-11 DB/Worker run produced only backend target/Surefire/Failsafe generated output and therefore did not enter the source IDs.

Under the separate final freeze, the formal matrix returned: source self 0; reviewer round4 through round13 all 0/fail-open 0 with reviewer live files protected read-only; local-tools 0; current source 1/FAIL/357/7/46; package UI self/current 0/1 with 88 errors; lint/typecheck/test/build 0/0/0/0; 26 files/109 tests and employee/center/admin builds passed with the existing approximately 2.057 MB warning retained. CORE had no post-pre changes; the independent PHASE-11 API run refreshed only excluded backend target/Surefire generated output. Post preflight/baseline/scoped and hashes are generated after this report text is frozen.

The initial post preflight/baseline exited `0 / 0`: workspace-source remained exactly `0857EC9B0458ED148F4119484362B6D9A760B5A5512B959F5C63393796A51109` / 1,455 and task-source remained exactly `D38E6A5AE6D86E4B0580991630C5EB6BE3A4721B6B3C95F5B80FBAD9228F00F0` / five. Scoped diff is task zero, unrelated zero, concurrent CORE zero and report metadata one. The final post baseline is refreshed once after this final report statement; its manifest owns the final report SHA/bytes and metadata ID without self-reference.

Independent RESUBMIT-14 confirmed the Source Gate and nine additional portal variants, but returned a P1 documentation-only FAIL because fixed report item 12 still named the historical round13 post IDs. That one line is corrected above without changing Gate/test/local/web source. The first authorized doc-only compare then truthfully found an undeclared reviewer-owned `P10-COMP-00_GATE.md` update as unrelated; its tools exited `0 / 0`, but its `32409E...` / unrelated-one result is retained only under `round14a-post` and is not submitted as a clean post or misclassified as CORE.

After the reviewer acknowledged that freeze-boundary omission, fresh round14b-pre project preflight/baseline exited `0 / 0`: workspace-source `32409EB1EF9B03C2388250FFD21F39351F442224199F7005631F576C8A32E5B3` / 1,455; task-source `D38E6A5AE6D86E4B0580991630C5EB6BE3A4721B6B3C95F5B80FBAD9228F00F0` / five; evidence-metadata `B7E2A251D90BC3B2D57665F00409049B298F85DE99022AFFC9FA796CC14D179B` / one. This pre naturally includes the reviewer Gate's formal ROUND14 FAIL version and the corrected report item. Only this report metadata changes after fresh pre; the expected fresh post scope is task/unrelated/CORE/metadata `0/0/0/1`.

The first fresh round14b post exited `0 / 0`, retained workspace/task exactly, produced evidence-metadata `35945CDD2D4FA497951E9A413364B34856EA2327716C1A56E70BA9B6BF2B161C` / one, and scoped `0/0/0/1`. The focused review found that item 12 still named the initial ROUND14 workspace rather than this fresh authority. Item 12 now names fresh workspace/task/scoped; the refreshed final post manifest remains authoritative for its new metadata ID.

1. Root: section 1.
2. Pre-baseline: section 6 records why round9 is invalidated and gives fresh round9b IDs. Original state remains unavailable and is not fabricated.
3. Summary: nested-aware SFC, strict recursive route contributors, scoped action authority and recursive component/Layout Gates.
4. Files: section 2.
5. UI plan: N/A; no page change.
6. Reuse/new/registry: no change.
7. Design decisions: sections 3-5.
8. Gates/tests: the RESUBMIT-13 delta records the complete frozen matrix and real exits/counts, including expected current-debt nonzero results.
9. Evidence: section 8.
10. Blockers: dependency-ordered current page/UI debt.
11. Next task: locked pending independent PASS.
12. Post-baseline: workspace `32409EB1EF9B03C2388250FFD21F39351F442224199F7005631F576C8A32E5B3`; task `D38E6A5AE6D86E4B0580991630C5EB6BE3A4721B6B3C95F5B80FBAD9228F00F0`; scoped task/unrelated/core/metadata is `0/0/0/1`; final report metadata is manifest-owned and refreshed after this final report update.
