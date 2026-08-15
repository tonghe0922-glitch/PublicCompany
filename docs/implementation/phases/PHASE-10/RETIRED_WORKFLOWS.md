# Completed-phase workflow retirement record

PHASE-10 uses one current, fail-closed construction gate: `.github/workflows/phase10-full-gate.yml`.
The completed PHASE-03 through PHASE-09 workflow files were removed from the active workflow directory on 2026-08-12 because their push filters referenced branches that no longer exist, two gates still asserted the pre-migration repository, and two extraction jobs retained repository write permission after their one-time generation work had finished.

## Why removal is safer than changing the old branch names

Re-pointing old workflows to `main` or the PHASE-10 construction branch would silently reactivate historical assumptions, fixed base SHAs, and generation steps. In particular, the retired PHASE-08 extraction jobs and the repository migration rewrite could create commits. The files remain available in Git history, so the evidence is preserved without leaving dormant executable code in the active control plane.

## Regression ownership after retirement

The PHASE-10 full gate now owns completed-phase regression:

- source, page, repository-identity, phase-boundary, secret and placeholder checks;
- Java 21 unit tests, including executable P006-P010 service behavior;
- PHASE-04 API integration regression;
- PHASE-03, PHASE-05, PHASE-06, PHASE-09 and PHASE-10 PostgreSQL integration profiles;
- Vue/TypeScript type checking, lint, unit tests and all three portal builds;
- a final verdict job that fails unless every required job succeeds.

`scripts/implementation/phase10_workflow_hygiene.py` prevents a retired filename, removed branch, pre-migration repository identity, or one-shot migration workflow from reappearing unnoticed.

## Retired active workflow files

The retirement covers the historical PHASE-03 through PHASE-09 workflow set and `.github/workflows/repository-migration-rewrite.yml`. The exact list is maintained in `phase10_workflow_hygiene.py`; Git history is the canonical source for the former contents and run definitions.
