# CONSTRUCTION_RULES

## 1. 规则地位

本文件是分阶段施工控制规则，不替代根 `AGENT.md`、根 `DESIGN.md` 或 Knowledge Base。发生冲突时按根 `AGENT.md` 的冲突优先级执行。

### 当前本地执行覆盖（2026-08-12）

最新用户指令将唯一施工与审查目录固定为 `I:\PublicCompany_source_codex`。该目录当前不存在 `.git`，因此本文件后续出现的旧仓库、分支、commit、push、PR 或远端 CI 要求只保留为历史背景，不能作为当前阶段验收事实，也不得为满足旧文字而 clone/pull/push。当前阶段以本地磁盘代码、Knowledge Base、可复现命令、`.runlogs` 与独立审查结论为准；阶段顺序、Definition of Done、安全和质量门禁仍然有效。

## 2. 历史固定施工协议（被当前本地执行覆盖）

- Historical repository：`louthison/NEWSTART`
- Historical default branch：`main`
- Historical construction branch：`agent/full-build`
- PHASE-00 至 PHASE-35 默认持续在同一施工分支推进。
- PHASE-35 全量验收通过前，不自动合并到 `main`。
- 禁止 force push、重写历史隐藏失败或覆盖无关变更。

## 3. 阶段闸门

每次只完成当前阶段。允许状态：

```text
NOT_STARTED
IN_PROGRESS
PASS
FAIL
BLOCKED
```

硬规则：

```text
CURRENT_PHASE != PASS
=> NEXT_PHASE MUST REMAIN NOT_STARTED
```

阶段 Definition of Done 任一必选项失败，则当前阶段必须为 `FAIL` 或 `BLOCKED`，不得写成 COMPLETE/PASS。

## 4. 每阶段开工前

必须重新读取 GitHub 当前施工分支中的：

```text
/AGENT.md
/DESIGN.md
/Knowledge Base/**
/docs/implementation/**
```

不得仅依赖聊天历史、模型记忆、旧摘要或本地旧副本。

开始业务开发前还必须定位：

- `process_code`；
- 三端职责；
- 页面来源；
- 状态/规则/接口；
- 权威 Schema/主表；
- 权限、敏感级别与数据范围；
- 正常、异常、补偿与归档关闭门槛。

## 5. 施工顺序

默认遵循：

```text
权威资料读取
→ 追溯与验收条件
→ 测试/验证基线
→ 领域与权限设计
→ 数据/迁移（如当前阶段允许）
→ 后端真实事务闭环
→ API 契约
→ 三端真实交互
→ Outbox/Worker/审计/补偿
→ 质量门禁
→ 台账与证据
→ checkpoint commit/push
```

不得大爆炸式一次生成 126 套 CRUD、几百个空页面或平行业务事实。

## 6. 禁止伪完成

禁止将以下内容声称为正式业务完成：

- 静态 Vue 页面；
- 假按钮、假成功；
- Mock API；
- 内存数据；
- localStorage 业务持久化；
- TODO/空实现；
- 没有真实事务、持久化、权限和测试证据的演示流程。

## 7. 业务与数据红线

- 三端共享同一业务事实、业务主键、流程实例和服务端状态；
- 不得“一端一套表”“一流程一表”“一表单一表”；
- 不得自行发明状态、审批人、金额、分值、权限范围、字段和数据库表；
- 技术后台不是业务超级管理员；
- 已签、已付、已核销、已出库、已结算、已归档事实不得覆盖历史；
- 金额、库存、积分、餐卡、票务、权限、签署、关键状态和审计使用不可变流水或版本链；
- 高风险动作必须落实服务端权限、Step-Up/MFA、职责分离、四眼复核或按规则授权。

## 8. GitHub 与提交

每个可独立验证的小闭环应形成 checkpoint。提交信息：

```text
phase-XX: <简短说明>
```

每次提交前必须：

- 核对差异范围；
- 只包含当前阶段文件；
- 检查空白/格式错误；
- 运行当前阶段可执行的验证；
- 检查无 secret、Token、密码、真实敏感数据。

正常 push 后必须验证远端分支 HEAD 与预期 commit SHA 一致。

## 9. 当前环境的 GitHub Connector 授权记录

PHASE-00 开始时当前执行环境没有可用的 `gh` CLI。用户于 2026-08-07 明确授权继续操作，因此本阶段及后续在该环境内允许使用已连接的 GitHub Connector 完成与 fetch/read/branch/commit/push/PR/CI 查询等价的远程操作。

该授权只豁免“必须使用 `gh` 命令本身”的工具形式，不豁免：

- 固定仓库和分支；
- 最新事实读取；
- 非 force push；
- commit/push/远端 SHA 验证；
- Draft PR；
- CI 检查；
- 阶段 DoD；
- 安全、审计、权限和业务红线。

## 10. PHASE-00 边界

PHASE-00 只建立施工控制面，不创建：

- 业务页面；
- 业务 API；
- Worker 业务任务；
- 应用数据库表或 Flyway 业务迁移；
- 126 个流程实现；
- 后续阶段业务代码。
