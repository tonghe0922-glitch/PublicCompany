# MASTER_GAPS

> Master gap register. 本文件只记录已被当前阶段证据确认的缺口/关闭状态；不得把未来业务阶段的未施工内容误判为 PHASE-08 缺陷。

## PHASE-08 Formal Gate closeout

| Gap | Status | Evidence / decision |
|---|---|---|
| Unified typed API client | EXISTING | C1 PASS；bearer/problem/timeout/abort/401 recovery/403/no unsafe replay/idempotency/stale-response fence |
| Shared portal session runtime | EXISTING | login/restore/refresh rotation/single-flight/logout/switch/runtime validation PASS |
| Router / guard / intended route / 403 / 404 / error boundary | EXISTING | C3 + recheck PASS |
| IA-derived navigation projection | EXISTING | employee 885 / center 1417 / tech 1510 source records；planned entries not auto-activated |
| Current identity / switch / logout Header UX | EXISTING | server SessionView；switch requires server permission |
| Three real portal login shells | EXISTING | employee/center/admin build；no fourth tech runtime |
| MobileBottomNav / More | EXISTING | only already-admitted active routes can overflow into More |
| Protected-home three-portal responsibilities | EXISTING | employee/center/tech use distinct source-aligned work-entry titles/roles |
| Protected-home static engineering/runtime evidence | CLOSED | initial Formal Gate blocker GATE-F08-001 fixed; PlatformShell no longer consumes PHASE05_PROCESSES or fixed P-code/DB/API/closed-state evidence |
| Protected-home regression coverage | EXISTING | source negative gate + real-backend Playwright absence assertions |
| Phase README/report/evidence consistency | CLOSED | GATE-F08-002/003 fixed; documents now record initial FAIL, repair, independent recheck and PASS |
| Static quality / unit / build / browser smoke | EXISTING | independent recheck `31290849170` attempt 2; 14 Vitest files / 67 tests; 16 static Playwright |
| Real PostgreSQL16 + Redis7.4 IAM regression | EXISTING | independent recheck PASS |
| Browser → Vite proxy → Spring Boot → PostgreSQL/Redis | EXISTING | independent recheck live job PASS |
| Refresh rotation / old-token rejection / switch authorization / logout | EXISTING | live E2E PASS; unauthorized switch HTTP 403 |
| Audit persistence / authorization denial / credential redaction | EXISTING | actions 22; switch 1; denied 1; credential_hits 0 |
| Real todo API | BLOCKED | no approved API contract; PHASE-08 intentionally renders no fake todo/badge |
| Real search API | BLOCKED | no approved API contract; PHASE-08 intentionally renders no fake search result |
| Real messages/notification center API | BLOCKED | no approved API contract; PHASE-08 intentionally renders no fake message count |
| P001–P126 business page/process implementation | EXISTING | deliberately unchanged by PHASE-08; business implementation begins at PHASE-09 onward |
| PHASE-09 P001–P005 | EXISTING | `NOT_STARTED`; current Gate does not auto-start next phase |

## PHASE-08 owning-scope conclusion

```text
MISSING = 0
CONFLICT = 0
PARTIAL = 0 in PHASE-08-owned DoD
Initial Formal Gate failures = 3 / CLOSED / INDEPENDENTLY_VERIFIED
External BLOCKED = todo/search/messages (no approved real APIs)
Independent recheck = PASS
PHASE-08 = COMPLETE / FORMAL_GATE_PASS
PHASE-09 = NOT_STARTED
```

The three external BLOCKED items remain safe omissions, not fake implementations. They must stay non-functional until an approved later contract exists.
