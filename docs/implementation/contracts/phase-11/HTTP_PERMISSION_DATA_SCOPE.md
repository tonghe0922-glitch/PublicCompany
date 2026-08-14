# PHASE-11 HTTP / PERMISSION / DATA SCOPE CONTRACT

| Process | API base | Employee | Center | Tech | Sensitive projection |
|---|---|---|---|---|---|
| P011 | `/api/v1/processes/P011/performance-cycles` | SELF：目标确认、自评、反馈、申诉 | CENTER：目标、评价、校准、影响 | `monitor` 元数据只读 | 分数来源、申诉证据按最小必要展示 |
| P012 | `/api/v1/processes/P012/promotions` | SELF：申请、材料、进度 | CENTER：资格、评审、任命、验证 | `monitor` 元数据只读 | 薪酬预算/等级 P3 默认遮蔽 |
| P013 | `/api/v1/processes/P011/rewards` | SELF：被奖励结果与回执 | CENTER：事实、审批、影响执行 | `monitor` 元数据只读 | 奖金/发展影响 P3 按权限 |
| P014 | `/api/v1/processes/P014/discipline-cases` | SELF_CASE：送达、申辩、申诉、整改 | CENTER_CASE：调查、决定、独立复核 | `monitor` 元数据只读 | 调查材料/责任影响 P3 按次授权 |
| P015 | `/api/v1/processes/P015/points` | SELF：余额、来源、流水、申诉 | CENTER：复核、调整、冲销、重算 | `monitor` 元数据只读 | 只展示授权流水字段 |
| P016 | `/api/v1/processes/P016/care-cases` | SELF：申请、授权、确认 | CENTER：资格、审批、执行、对账 | `monitor` 元数据只读 | 隐私材料/金额 P3 默认遮蔽 |

所有写 API 必须携带 `Idempotency-Key`；所有动作必须携带 `expectedVersion`。前端不得提交任意目标状态，只能提交冻结的 action code。服务端同时校验 action permission、data scope、字段投影和角色冲突。
