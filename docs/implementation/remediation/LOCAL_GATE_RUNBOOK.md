# Local Gate Runbook

## Scope and authority

This control plane is the CXR-01 local orchestrator for commit-bound evidence. It never commits, pushes, deletes the working tree, or records an independent review result. A local `PASS` is only a construction result; the current known source-contract and UI/source findings are expected to keep Quick/Release at `FAIL` until later CXR tasks close them.

All commands run from `I:\PublicCompany_source_codex`. Generated evidence is written to:

```text
I:\PublicCompany_gate_evidence\<40-char-commit>\<unique-run-id>\
```

An existing run ID is never overwritten. Every attempt contains `commands/*.log`, reserved `surefire/`, `failsafe/`, `frontend/`, `ui-source/`, and `traces/` directories, plus `metadata.json`, `checksums.sha256`, and `VERDICT.md`. Release and Cleanup also retain `cleanup-report.json`.

## Commands

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/local/tests/gate-orchestrator-test.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/local/quick-gate.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/local/full-gate.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/local/release-gate.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/local/cleanup-gate.ps1
```

`release-gate.ps1` performs configured bootstrap, Quick, Full, Phase 10 live, Phase 11 live, and Cleanup in that order. Cleanup is invoked from `finally`, so a main-stage failure cannot suppress it. Test-only skip switches are fail-closed: using one creates a mandatory failure; it can never produce a successful Release verdict.

The bootstrap is mandatory and executes the taskbook commands without embedded credentials:

```powershell
.\mvnw.cmd -B -ntp dependency:go-offline
Set-Location technical-platform\web
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
```

A dependency/bootstrap failure is `ENVIRONMENT_BLOCKED`, not code `FAIL` and never `PASS`. Configuration step kinds are limited to `command` and `script`; missing or unknown mandatory definitions, or disabled mandatory steps, fail closed.

## Evidence and safety properties

- One exclusive file lock prevents concurrent local Gate instances.
- Each configured step has its own UTF-8 log with start time, end time, exit code, status, and classification.
- Authorization headers, bearer values, tokens, passwords, cookies, and secrets are redacted before logs are persisted.
- `checksums.sha256` covers every evidence file except itself and is self-verified; any later tamper fails verification.
- Cleanup reports configured ports, Testcontainers, Ryuk, and workspace launcher processes. Residual resources make Cleanup fail.
- Surefire/Failsafe XML and Playwright traces are copied into the reserved evidence directories when the underlying tools produce them.
- Live runners only invoke the existing Phase 10/11 Playwright configurations; they contain no workflow or business implementation.

## Current expected baseline

At `fef590876838d2c0222e2721c480d61929a385da`, Quick must not be reported as passing: Phase 10 sealed-regression mode is unsupported, the Phase 11 contract script is absent, UI all-scope has findings, and the Phase 10 source Gate has findings. These are code findings for subsequent ordered CXR tasks, not environment blocks. PHASE-12 remains `NOT_STARTED / BLOCKED`.
