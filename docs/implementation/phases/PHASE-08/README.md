# PHASE-08｜三端 Portal Runtime

> 当前状态：`COMPLETE / FORMAL_GATE_PASS / INDEPENDENT_RECHECK`
> 上一阶段：`PHASE-07 = COMPLETE / FORMAL_GATE_PASS`
> 下一阶段：`PHASE-09 = NOT_STARTED`
> Formal Gate accepted implementation candidate：`48c3b822ed23f20565e331f3590a5209574f865e`

PHASE-08 已完成三端 Portal Shell、Router、IA 导航、Session、统一 API Client、身份切换、登录壳、移动 BottomNav/更多以及全量质量/真实后端联合验证。

## Formal Gate 历史

```text
Initial candidate = 16171f3294aa03306618bc8e1207feb0683e482e
Initial Formal Gate = FAIL
Failure report commit = 9ac0573c532f8602677eb2422273e855b0b20e6c
Failures = GATE-F08-001 / GATE-F08-002 / GATE-F08-003
Gate fix code checkpoint = 8574ec9ac6f01bd51feddce34e22dc7831571301
Gate fix closeout candidate = 48c3b822ed23f20565e331f3590a5209574f865e
Independent recheck workflow = 31290849170 / attempt 2 / PASS
Formal Gate recheck = PASS
```

首次 Gate FAIL 没有被删除：它证明正式首页曾错误展示 PHASE-05/P016–P020 静态工程/状态证据，且阶段文档状态不一致。修复后，三端首页已分别体现员工/中心/技术职责，正式运行壳不再把前端静态工程常量当作业务运行事实；source contract 与真实后端 E2E 已加入长期负向回归。

## 当前权威文件

1. `SOURCE_CONTRACT.md`：PHASE-08 施工/回归合同；
2. `PAGE_IA_EXTRACT.json/.md`：六份页面 IA XLSX 实际解析证据；
3. `ADR_001_SESSION_IDENTITY_CONTRACT.md`：身份候选读取合同；
4. `ADR_002_BROWSER_TOKEN_PERSISTENCE.md`：浏览器 credential 持久化合同；
5. `ADR_003_API_ORIGIN_PROXY.md`：API 同源与 Vite proxy 合同；
6. `ADR_004_ROUTE_CATALOG_STRATEGY.md`：路由/导航来源治理；
7. `IMPACT_MATRIX.md`：影响矩阵；
8. `GAP_MATRIX.md`：最终缺口/安全省略；
9. `PHASE_REPORT.md`：阶段完整报告；
10. `TEST_EVIDENCE.md`：测试和真实联合链证据；
11. `PHASE_GATE.md`：正式独立验收结论。

## 完成事实

- 六份 IA XLSX：6/6 实际解析，0 failure，交叉核验 PHASE-01 7,126 页面记录；
- 三端：canonical `employee / center / tech`，runtime/build `employee / center / admin`，`tech → admin`，无第四门户；
- 统一 API Client：Bearer、Problem、timeout、cancel、401 recovery、403 fail-closed、Idempotency-Key、安全 retry、stale response fence；
- Portal Session：login / restore / refresh rotation / single-flight / logout / identity switch / server permissions；
- Router：login / protected / forbidden / not-found / intended route / cancellation / error boundary；
- 导航：只有 `implemented + real route + permission + mobile_access` 才激活；planned 页面不制造假入口；
- 三端 protected home：职责不同且不展示 PHASE-05/P-code/DB/API/fixed status 工程证据；
- todo/search/messages 无批准真实 API，继续安全省略；
- PostgreSQL16 + Redis7.4 IAM、真实 Browser→Spring→DB/Redis→Audit 闭环已验证；
- PHASE-09 仍 `NOT_STARTED`，本次 Gate PASS 不自动开始下一阶段。
