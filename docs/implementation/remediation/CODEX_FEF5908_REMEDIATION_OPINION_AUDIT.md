# FEF5908 复审意见合理性审查与整改方案

## 结论

整改任务书的核心结论合理，PHASE-12 必须保持阻塞。CXR-00 的本地重跑证明当前 commit 的阶段授权与可复验证据不一致；因此恢复为以下状态是必要且符合 `AGENT.md` 的：

```text
PHASE-10 = REGATE_REQUIRED
PHASE-11 = CONSTRUCTION_COMPLETE / REGATE_REQUIRED
PHASE-12 = NOT_STARTED / BLOCKED
```

本审查不把原有 P011–P016 结构改善推翻，也不把环境问题伪装成代码失败。

## 意见分类

### 已由 CXR-00 本地基线确认

- `phase10_contract.py --mode sealed-regression` 不支持任务书要求的模式，exit 2。
- `scripts/implementation/phase11_contract.py` 不存在；该必需合同检查无法执行。
- UI Gate self-test 通过 85 个正负 fixture，但全仓扫描为 `FAIL / 86`。
- `fef5908` 相对父 commit 的 72 文件 changed scope 为 `FAIL / 1`，finding 为 `IMPORT_GRAMMAR_UNSUPPORTED`。
- Phase10 component source Gate self-test 通过，但真实源码为 `FAIL / 14`：`PAGE_NESTING=9`、`BARE_PERMISSION=5`。
- 当前前端真实基线为 70 files / 636 tests，而旧文档同时存在其他数字，重新对账是合理要求。
- 三端主入口产物约 2.145 MB，Vite 给出大于 500 kB 警告；应建立不恶化棘轮并渐进拆包。
- `.git` 实际存在，旧文档“本地无 Git”不真实；状态纠正必要。

### 结论合理，但必须在后续 CXR 中以 tests-first 独立验证

- Phase10 自服务 workflow successor、ledger/chronology/conflict hardening：按 CXR-03/CXR-04 验证，禁止修改 V116/V117/V118 或已发布历史版本。
- P016 技术监控空壳与 P014/P016 共享页面反向依赖：按 CXR-05 先建立失败测试，再渐进重构。
- 服务端驱动 available actions、人工重试幂等键与 record-level lock：按 CXR-06/CXR-07 建立服务端、前端和并发回归测试。
- P001–P016 的 DB/API/Worker/Chromium 结论：只有 CXR-11 同一 commit 的完整本地证据可作为当前结论。

### 需要收窄为质量棘轮的意见

- Java 可读性、格式化、静态分析和覆盖率不得用一次性全仓格式化或大爆炸重写完成；按 CXR-09 模块化渐进整改，每步保持可编译可回退。
- 主入口 `<500 kB` 是渐进目标；CXR-10 当前硬门槛先固定 2.145 MB 不恶化，再通过 route dynamic import 分阶段下降，禁止仅提高 warning limit。
- 覆盖率目标适用于核心领域与关键规则分支，不得通过扩大 exclude 或降低断言达成。

### 不采纳的处理方式

- 不采纳删除/弱化测试、扩大 ignore、把 finding 改 warning、修改旧 Flyway/Published Workflow、reset/clean 工作树或直接授权 PHASE-12。
- 不采纳把旧 evidence 目录中发生同名覆盖的日志作为权威 CXR-00 证据；该 attempt 标记为 `EVIDENCE_INTEGRITY_LOSS`，权威证据已在唯一 recovery attempt 重跑。

## 指定整改方案与职责

| 顺序 | 施工任务 | 专业施工员职责 | 专业审查员门槛 |
|---|---|---|---|
| CXR-00 | 基线与阶段状态 | 只改允许文档，形成真实 exit/SHA/计数 | 核验证据完整性、工作树保护和状态一致性 |
| CXR-01 | 本地 Gate 控制面 | tests-first 建 Quick/Full/Release/Cleanup Gate | 验证 mandatory fail-closed、cleanup、锁和 SHA |
| CXR-02 | source contract | 跟踪真实机器合同并实现确定性检查 | fresh clone 重跑 Phase10/11 contract |
| CXR-03–04 | Phase10 workflow/DB | 仅新增 successor 迁移与真实 PG16 测试 | 核验旧版本不变、幂等、约束、RLS、并发 |
| CXR-05 | P016/shared supervision | 先失败测试，再建 feature/composite 边界 | 核验 P016 metadata、脱敏、权限和无 page nesting |
| CXR-06–07 | action/idempotency/lock | 服务端动作投影、逻辑命令键、记录级互斥 | 核验候选人、回避、unknown outcome 和副作用唯一性 |
| CXR-08 | UI/source Gate | 清零 changed/all/source findings | 独立运行 self/current/changed/all，finding 必须为 0 |
| CXR-09–10 | 质量与前端棘轮 | 模块化整改，不大爆炸 | 核验无门槛弱化、指标不恶化、构建可用 |
| CXR-11–12 | 全量回归与文档 | 同一 commit 全量证据、对账、候选报告 | clean clone Release Gate 后才可决定是否解锁 |

任务必须严格按 CXR-00 → CXR-12 顺序闭环。施工员只能提交 `REGATE_CANDIDATE`；审查员独立复验并将失败项退回施工员。任何一项未通过时均不得进入下一项，更不得进入 PHASE-12。
