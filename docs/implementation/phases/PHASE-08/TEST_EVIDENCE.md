# PHASE-08 TEST_EVIDENCE — FORMAL GATE PASS

> Phase: `PHASE-08`
> Repository: `tonghe0922-glitch/PublicCompany`
> Branch: `ChatGPT_Version_V0.07`
> Accepted implementation candidate: `48c3b822ed23f20565e331f3590a5209574f865e`
> Independent Formal Gate recheck: `31290849170 / run_attempt=2 = PASS`

## Gate history

```text
Initial candidate = 16171f3294aa03306618bc8e1207feb0683e482e
Initial Formal Gate = FAIL
Failures = GATE-F08-001 / GATE-F08-002 / GATE-F08-003
Gate fix code checkpoint = 8574ec9ac6f01bd51feddce34e22dc7831571301
Gate fix closeout / recheck candidate = 48c3b822ed23f20565e331f3590a5209574f865e
Formal Gate recheck = PASS
```

## Independent recheck jobs

| Job | Job ID | Result | Evidence |
|---|---:|---|---|
| source / scope / fact-source / fake-completion | 93188250798 | PASS | phase boundaries, XLSX/C0/C4 checks, source contract, protected-home negative gate, secret/PHASE09 leak scan |
| static / unit / build / browser | 93188251034 | PASS | typecheck, ESLint, 67 Vitest/VTU, jscpd, knip, three builds, artifact scan, Playwright |
| PostgreSQL16 + Redis7.4 IAM | 93188261679 | PASS | API unit contracts + real Testcontainers IAM integration |
| live Browser / Vite / Spring / PostgreSQL / Redis / Audit | 93188251216 | PASS | real session browser E2E + audit query + credential redaction |
| final C7 verdict | 93188269628 | PASS | all four hard jobs required success |

## Frontend static evidence

```text
vue-tsc / tsc = PASS
ESLint --max-warnings=0 = PASS
Vitest test files = 14 PASS
Vitest tests = 67 PASS
jscpd = PASS / duplicated lines 64 / 5864 = 1.09%
knip = PASS
employee build = PASS
center build = PASS
admin(tech alias) build = PASS
artifact secret/fake scan = PASS
Static Playwright = 16 PASS
```

Static artifact generated on exact candidate by recheck workflow.

## Protected-home Gate regression

Source gate now rejects any recurrence in formal `PlatformShell.vue` of:

```text
PHASE05_PROCESSES
PHASE-05
primaryTable
process.states
process.apiBase
已关闭
```

`portal-config.ts` must retain three distinct protected-home responsibilities:

```text
employee = 员工工作入口 / employee-self-service
center   = 中心管理工作入口 / center-management
tech     = 技术运行工作入口 / technical-operations
```

Real-backend Playwright verifies after login and after reload that the page does not contain:

```text
PHASE-05
P016 / P017 / P018 / P019 / P020
welfare.care_case
/api/v1/phase05/
已关闭
```

This closes the CI blind spot that caused the initial Formal Gate FAIL.

## Live browser integration evidence

```text
Projects: desktop-chromium + mobile-chromium
Live tests: 7 PASS / 1 SKIPPED
```

The skipped instance is the intentional mobile duplicate of the same deep credential rotation/switch scenario; employee/center/admin ordinary live paths run on desktop and mobile.

Verified:

- real login → portal-specific protected home: PASS;
- refresh token rotation after reload: PASS;
- old access token after refresh: HTTP 401 PASS;
- identity switch A → B: PASS;
- old access token after switch: HTTP 401 PASS;
- identity B without switch permission → switch attempt: HTTP 403 PASS;
- logout clears tab refresh credential: PASS;
- old switched credential after logout: HTTP 401 PASS;
- credential token keys in localStorage: none PASS.

## Database / audit evidence

Direct query against the live PostgreSQL audit Testcontainer after browser execution:

```text
audit actions = 22
SESSION_SWITCH = 1
AUTHORIZATION_DENIED = 1
credential_hits = 0
```

The recheck therefore validates security/business side effects rather than only HTTP status.

## Negative / fail-closed evidence

- non-`/api/` client path rejected;
- malformed success JSON becomes protocol error;
- 403 does not enter refresh recovery;
- unsafe write without Idempotency-Key is not replayed;
- corrupt/expired refresh credential fails closed;
- refresh is single-flight;
- planned navigation is non-clickable;
- missing permission hides active navigation;
- `mobile_access=no` hides mobile entry;
- identity switch control requires server permission;
- failed switch command preserves prior valid session;
- no fourth tech runtime artifact;
- source gate rejects P001–P005 implementation leak;
- protected home rejects PHASE-05 static engineering/runtime evidence;
- synthetic credential is not committed and not present in audit rows.

## NOT_RUN

| Verification | Status | Reason |
|---|---|---|
| Production/staging deployed E2E | NOT_RUN | PHASE-33 |
| Production real credentials / personal data | NOT_RUN | prohibited for synthetic CI |
| Load/performance/long-running stability | NOT_RUN | PHASE-34 |
| Backup/recovery exercise | NOT_RUN | PHASE-34 |
| 126-process full UAT | NOT_RUN | PHASE-35 |
| todo/search/messages real integration | NOT_RUN | no approved API contract; safe omission |

## Final test verdict

```text
Independent Formal Gate recheck = PASS
PHASE-08 = COMPLETE / FORMAL_GATE_PASS
PHASE-09 = NOT_STARTED
```
