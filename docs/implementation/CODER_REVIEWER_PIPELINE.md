# Coder + Reviewer 双角色施工管线（PHASE-10 UI 整改）

> 本文件是 `I:\PublicCompany_组件核对与AI整改方案` 在本项目落地的**运营手册**。
> 它不改变该规范包的任何约束，只是把「专业编程员 / 专业审核员」两个角色如何按规范包 + 项目 `AGENT.md` 协作，固化成可重复流程。

## 0. 最高约束（来自规范包 + AGENT.md，不可降级）

- 唯一施工对象：`I:\PublicCompany_source_codex`，禁止修改其他目录。
- 禁止 `gh` 与任何 `git remote/fetch/pull/push/clone/reset --hard`；本项目无 `.git`，用 SHA-256 文件哈希基线 + 修改文件清单追溯。
- 阶段边界：**只施工 PHASE-10（P006–P010）UI 整改，禁止施工 P011+**。
- 53 项合同阻塞能力（远程目录、服务端分页、文件上传、导出、水印、字段级 Step-Up、薪资/成绩明文等）**必须保持 BLOCKED，禁止 Mock/假实现**。
- 组件唯一出口：`@sgj/ui`（L1 设计系统）、`@sgj/platform-ui`（L2 平台复合）；页面禁止深层导入。
- 新建/修改页面前必须生成 `<PageName>.ui-plan.json`；未注册/未导出/无测试的公共组件不算完成。
- **代码存在 ≠ PHASE CLOSED**；只有完整本地 Gate 真实通过，才更新完成状态。

## 1. 三角色职责

| 角色 | 由谁担任 | 输入 | 输出 | 禁止 |
|---|---|---|---|---|
| 编排者 (Orchestrator) | 主智能体 | 阶段目标、规范包、冻结合同 | 任务拆解、DoD、门禁裁定、证据归档、封板 | 替 Coder 写实现细节 |
| 专业编程员 (Coder) | 主智能体直接施工 | 单任务 spec（06 清单某条）+ 规范包 + AGENT/DESIGN/KB/注册表 | 最小可回退实现 + 本地门禁绿 + 证据 | 自创状态/权限码；假按钮/假 API；深层导入；原生交互控件；跳过 `.ui-plan.json` |
| 专业审核员 (Reviewer) | 独立只读子智能体 | 同一套规范包 + AGENT/DESIGN + Coder 的 diff 与证据 | 独立审查结论（PASS / 打回 + 原因） | 只看 Coder 自述；必须重跑 Gate、做对抗式核查 |

Reviewer 的对抗式核查：重读 AGENT/DESIGN、规范包 08/10/12、注册表与 Gate 源码，重跑 UI 组件接入 Gate 与受影响的 typecheck/unit；核对「无新增债务、53 项仍 BLOCKED、不伪造例外、门禁非 fail-open」。

## 2. 单任务工作流（强制顺序）

```
① 生成/确认本地哈希基线（无 .git）
② 读取任务依赖、allowed_paths、forbidden、acceptance
③ 涉及页面 → 先生成/更新 .ui-plan.json（缺口分类 L1/L2/L3/BLOCKED）
④ 先写可失败的特征/回归测试
⑤ 最小可回退修改（现有组件能组合则禁止新增）
⑥ 新公共组件同步 注册表 + public index + 测试 + 使用计划
⑦ 运行：UI 接入 Gate / typecheck / lint / unit / 目标 e2e
⑧ 产出证据（见 §4）
⑨ 编排者派 Reviewer 独立复审 → PASS 才封板；FAIL 回退 Coder 修复
⑩ 更新 docs/implementation/phases/PHASE-10 与 MASTER_PROGRESS（仅 Gate 全绿后）
```

## 3. 任务清单与依赖（来自 06_AI任务清单.yaml）

P10-COMP-00（基线+Gate）→ 01（DS 契约修复）→ 02（Shell/路由）→ 03A（唯一接入/注册表/Gate）→ 03（L2 复合层）→ 04（P006/007）→ 05（P008/009/010 拆分）→ 06（技术监控投影）→ 07（路由/常量）→ 08（测试/Gate）→ 09（台账关闭）。

> 注：03A 的 registry + alias + UI Gate 在本项目已存在（此前 P10-COMP-03A 已施工）。本管线从 **P10-COMP-01** 起作为首个真实代码切片复核并继续推进；00/03A 仅做基线冻结与 Gate 复跑确认。

## 4. 证据模板（每切片封板前必填）

`I:\PublicCompany_source_codex_local_evidence\<Pxxx>_EVIDENCE.md`：

```
- 本地项目根目录
- 修改前基线 aggregate_sha256 / 修改后基线 aggregate_sha256
- 修改摘要与文件清单
- 页面组件使用计划路径与映射摘要（涉及页面时）
- 复用/新增组件、注册表、public index 变化
- 关键设计决定
- UI 接入 Gate / typecheck / lint / unit / build 真实退出码
- Reviewer 签字：独立 PASS / 打回原因
- 未决阻塞项（含 BLOCKED_BY_CONTRACT）
```

## 5. 门禁命令集（运行时：Node 22.22.2 托管版 + 其内 pnpm）

```
# 前置：把托管 node bin 加入 PATH（本会话）
$env:PATH = "C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2;" + $env:PATH

cd I:\PublicCompany_source_codex\technical-platform\web
pnpm install --frozen-lockfile      # 仅在 lock 变化时需要
pnpm typecheck
pnpm lint
pnpm test
pnpm quality:duplicates             # 若脚本存在
pnpm quality:deadcode               # 若脚本存在
pnpm build                          # employee/center/admin

cd I:\PublicCompany_source_codex
python scripts/implementation/ui_component_access_gate.py --repo-root I:\PublicCompany_source_codex --scope phase10
```

> 阶段全量 Gate（LOCAL/02 脚本）需要本地 PostgreSQL 16 + Redis 7.4；若环境缺失，结果只能标 `PARTIAL`，不得标 PASS。
