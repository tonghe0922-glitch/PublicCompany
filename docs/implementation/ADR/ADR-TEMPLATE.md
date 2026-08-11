# ADR-TEMPLATE

---
adr_id: ADR-XXXX
title: <决策标题>
status: proposed
date: YYYY-MM-DD
phase: PHASE-XX
process_codes: []
owners: []
---

## 1. 背景

说明需要做出决策的客观问题、当前事实、业务/工程边界，以及对应权威资料。

## 2. 决策驱动因素

- 安全/合规；
- 业务闭环；
- 数据一致性；
- 可维护性；
- 可测试性；
- 性能/容量；
- 运维复杂度；
- 成本与可逆性。

## 3. 权威依据

```text
AGENT.md: <章节>
DESIGN.md: <章节>
Knowledge Base: <文件/sheet/row>
PRD/SRS/验收: <如有>
```

## 4. 候选方案

### 方案 A

描述、优点、缺点、风险、迁移/回退。

### 方案 B

描述、优点、缺点、风险、迁移/回退。

## 5. 决策

明确选择及其适用范围。低风险技术缺口可以采用工程默认；不得用 ADR 自行发明业务状态、审批人、金额、权限或法律规则。

## 6. 影响矩阵

| 维度 | 影响 |
|---|---|
| employee | |
| center | |
| tech | |
| API | |
| Domain | |
| Database | |
| Workflow | |
| Event/Outbox | |
| Permission/RLS | |
| Sensitive data | |
| Integration | |
| Tests | |
| Deployment | |
| Documentation | |

## 7. 安全与隐私

说明 RBAC、ABAC、RLS、字段权限、数据范围、Step-Up/MFA、职责分离、回避、审计和 P0–P3/DATA-L1–L4 的影响。

## 8. 迁移与回滚

说明 Expand/Migrate/Contract、兼容窗口、数据验证、回退或前滚策略。

## 9. 验证标准

列出可执行测试、性能、安全、迁移、恢复和验收证据。

## 10. 到期/复审

如为临时例外，必须写明责任人、到期日期、回收任务和恢复标准。
