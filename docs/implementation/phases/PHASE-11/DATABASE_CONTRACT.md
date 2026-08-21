# PHASE-11 DATABASE / FLYWAY C0 CONTRACT

| Process | Canonical main table | Additive migration | Required invariant |
|---|---|---|---|
| P011 | `performance.performance_cycle` | V122 | 独立 `performance_score_entry(score_type, score_1000)` append-only；0–1000；来源唯一 |
| P012 | `hr.promotion_request` | V123 | 任职生效写入 `org.employee_position`；同请求只产生一个任职效果 |
| P013 | `reward.reward_case` | V124 | `source_fact_key` 与影响执行账本防重；奖金/积分/发展影响分别留痕 |
| P014 | `reward.discipline_case` | V125 | 来源事实防重；调查/决定/申诉角色回避；送达与申诉证据 |
| P015 | `reward.point_transaction` | V126 | 主流水禁止 UPDATE/DELETE；调整/冲销通过 `reversal_of_id` 新增记录 |
| P016 | `welfare.care_case` | V127 | 复用旧主表；资格、隐私授权、执行、员工确认和对账事实独立留痕 |

所有 supporting table 必须启用 RLS，tenant_id 参与唯一键；禁止创建 phase11/P011 等影子主表。迁移只向前，不回写旧迁移。
