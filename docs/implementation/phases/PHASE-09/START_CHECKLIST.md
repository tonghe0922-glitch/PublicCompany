# PHASE-09 START CHECKLIST

> Purpose: 正式收到“开始 PHASE-09”施工指令时使用。
> Current state: `PREPARATION_READY / NOT_STARTED`。

## A. GitHub / phase boundary

- [ ] fetch 最新 `ChatGPT_Version_V0.07`，确认没有新远端提交遗漏；
- [ ] `PHASE-08 = COMPLETE / FORMAL_GATE_PASS`；
- [ ] `PHASE-09 = NOT_STARTED`；
- [ ] `PHASE-10 = NOT_STARTED`；
- [ ] PR 保持 Draft / main 未 merge；
- [ ] 重读最新 `AGENT.md / DESIGN.md / Construction Master Schedule`。

## B. Revalidate machine sources

运行：

```bash
python scripts/implementation/phase09_preparation_extract.py --check
python scripts/implementation/phase09_page_trace.py --check
```

必须仍满足：

```text
P001-P005 = 5/5
XLSX = 15/15
Sheets = 90
parse failures = 0
PHASE-01 page total = 7126
```

如源文件变化，先刷新 snapshot，不允许继续用旧矩阵。

## C. C0 Contract Freeze — 在写业务代码前必须完成

### C0-1 页面绑定

- [ ] 解决当前 P001–P005 page catalog `process_codes` exact binding = 0；
- [ ] 仅使用流程 XLSX `05_三端联动` + 页面 IA `source_file/sheet/row/key` 建立 trace；
- [ ] 禁止中文标题模糊匹配；
- [ ] 冻结 Employee / Center / Tech page 与 route；
- [ ] 尚未实现页面保持 planned，不得先标 IMPLEMENTED。

### C0-2 API 合同

- [ ] 解决 PHASE-01 business API-like records = 0；
- [ ] 实际读取 15 XLSX `04_规则与接口`；
- [ ] 对照现有 Controller/OpenAPI/ADR；
- [ ] 冻结 request/response/error/idempotency/version contract；
- [ ] 禁止按流程名猜 REST 路径。

### C0-3 Permission / Scope / Sensitive

- [ ] 冻结每个页面/动作 permission；
- [ ] 冻结 data_scope；
- [ ] 冻结 sensitive_level 和字段级脱敏；
- [ ] L3/L4 明文/高风险写动作绑定真实 Step-Up；
- [ ] employee/center/tech 权限差异必须来自源，不通过隐藏按钮替代后端授权。

### C0-4 State / Approval / Side Effects

- [ ] 逐流程读取 `03_状态与审批`；
- [ ] 冻结 legal transitions / approver / self-approval conflict；
- [ ] 逐节点读取 `05_三端联动`；
- [ ] 冻结 Audit / Outbox / Worker / Notification / Integration side effects；
- [ ] 明确 timeout/retry/DLQ/compensation 适用节点。

### C0-5 P001 MFA

- [ ] 对照现有 Auth/Login/Session 与 P001 S01–S08；
- [ ] 明确 MFA 类型、触发条件、挑战/验证、失效、重试、Step-Up边界；
- [ ] 不把现有 password login 直接宣布为 P001 完成。

## D. Promote preparation docs

C0 通过后：

- [ ] `SOURCE_CONTRACT_DRAFT.md` → 正式 `SOURCE_CONTRACT.md`；
- [ ] `IMPACT_MATRIX_DRAFT.md` → 正式 `IMPACT_MATRIX.md`；
- [ ] `GAP_MATRIX_DRAFT.md` → 正式 `GAP_MATRIX.md`；
- [ ] 把 UNKNOWN/BLOCKED 替换为有证据的正式决议或明确阻断；
- [ ] 更新主 API/Permission/Page/Traceability 台账，但不得提前标 IMPLEMENTED。

## E. Official start

只有 A–D 完成后：

- [ ] `MASTER_PROGRESS.md` 将 PHASE-09 改为 `IN_PROGRESS`；
- [ ] README 改为正式施工状态；
- [ ] 建立 PHASE-09 construction workflow/source contract gate；
- [ ] 开始第一个小闭环。

## F. Small-loop order

建议按：

```text
P001
→ P002
→ P003
→ P004
→ P005
```

每个流程必须独立完成：

```text
三端页面/动作
→ API
→ 服务端权限/ABAC/RLS
→ Application
→ Domain
→ Repository/PostgreSQL
→ Workflow/状态历史
→ Audit
→ Outbox
→ Worker/Integration（若适用）
→ Notification（若适用）
→ 三端回显
→ Unit + PostgreSQL Integration + Permission Negative + Idempotency + Concurrency + E2E
→ checkpoint commit + push
```

## G. Stage closeout

5 流程全部真实闭环后才允许：

- [ ] 全量正常/负向/重复并发/异常补偿测试；
- [ ] 更新所有 MASTER 台账；
- [ ] 生成 PHASE_REPORT / TEST_EVIDENCE；
- [ ] 最终 commit/push + remote SHA verify；
- [ ] 状态仅到 `READY_FOR_GATE`；
- [ ] 停止，不进入 PHASE-10。
