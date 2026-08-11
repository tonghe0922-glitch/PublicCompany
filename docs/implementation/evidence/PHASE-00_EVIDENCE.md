# PHASE-00 EVIDENCE

## 1. 执行上下文

- Date: 2026-08-07
- Repository: `louthison/NEWSTART`
- Base: `main`
- Construction branch: `agent/full-build`
- Scope: `PLATFORM/基础工程`
- Business implementation allowed: NO

## 2. GitHub 工具授权证据

PHASE-00 初次执行时环境无 `gh` CLI。用户随后明确回复“我允许你继续操作。继续完成”，授权在当前环境使用已连接 GitHub Connector 完成等价远程施工。

执行约束保持不变：固定仓库/分支、最新事实读取、非 force 更新、checkpoint、Draft PR、远端 SHA 验证、CI 状态真实性、安全与 DoD 均继续执行。

## 3. 分支基线

`agent/full-build` 从当时最新 `main` 创建。

基线 SHA：

```text
71654d5d7e271f32bce5e0c412e58b5e9aa6c1ce
```

基线 tree：

```text
3bbf33b868c0684dbb7d9a3af3f6a836b470e507
```

基线根目录实际为：

```text
AGENT.md
DESIGN.md
Knowledge Base/
README.md
```

未发现已有应用源码、`docs/implementation/`、`.github/workflows/` 或 PHASE-00 安全配置文件。

## 4. 规范读取证据

### AGENT.md

实际从 `agent/full-build` 分段读取直到文件末尾：

- V1.2；
- baseline 2026-08-07；
- canonical root `/AGENT.md`；
- portal `employee/center/tech`；
- 技术栈与质量门禁；
- 数据、权限、安全、API、事件、表单、流程、测试、部署、DoD、红线；
- 126 流程注册表；
- 最终一句话准则。

### DESIGN.md

实际从 `agent/full-build` 分段读取直到文件末尾：

- V2.0；
- baseline 2026-08-07；
- Vue 3.5 + TS 5.9 + Vite 8.2 + Pinia + Router；
- CSS Design Tokens；
- 三端布局/组件/响应式；
- Vue 实现映射；
- 安全、敏感数据、可访问性、性能、MUST/MUST NOT、验收与版本治理。

## 5. Knowledge Base 完整性证据

执行 GitHub recursive tree 读取施工分支完整文件树，响应：

```text
truncated=false
```

本阶段索引文件计数：

```text
00 企业架构及员工: 2
01 完整的页面架构: 9
02 业务流程 表单 字段: 384
03 数据库需求规则: 129
TOTAL: 524
```

其中：

```text
P001-P126 = 126
三端根 = 3
三端流程工作簿 = 126 × 3 = 378
```

`KB_FILE_INDEX.md` 使用 3 个精确端根 × 126 个精确叶文件的无损展开方式记录全部三端流程路径，并逐项列出其他非重复文件。

## 6. Checkpoint 证据

第一个可独立验证小闭环组合为单一 Git commit：

```text
commit: 9ca41004c35cd8241b44b8f8bdd5dbe18f60a1b3
message: phase-00: initialize construction control plane
```

该 commit 含 16 个变更文件，GitHub PR 统计为：

```text
changed_files: 16
additions: 1716
deletions: 1
```

删除量来自替换原来只有 `# NEWSTART` 且无最终换行的 README 单行，不删除 Knowledge Base、AGENT 或 DESIGN。

## 7. Diff/内容验证

已通过 GitHub Connector 拉取 Draft PR unified diff，并检查：

- 变更范围只包含根 Git 安全配置、README 和 `docs/implementation/**`；
- 未修改 `AGENT.md`；
- 未修改 `DESIGN.md`；
- 未修改任何 `Knowledge Base/**` 原始事实；
- 无 `.vue/.ts/.java` 业务实现；
- 无 SQL/Flyway 应用迁移；
- 无 Mock API；
- 无 localStorage 业务持久化；
- 无测试验证码、默认密码、Token、私钥或真实员工敏感信息；
- 新增文本按 `.editorconfig` 规则生成，远端 diff 未发现尾随空白；
- `.gitattributes` 明确文本换行和 XLSX/ZIP/图片/PDF 二进制属性；
- `.gitignore` 明确忽略 `.env`、密钥/证书、credentials、构建输出、日志和本地运行数据。

由于当前执行环境没有本地 git/gh 工作副本，本阶段的 `git diff --check` 使用 Connector 远端 unified diff + 原始 blob 内容执行等价空白检查；这是用户明确授权的工具替代，不是降低校验标准。

## 8. Draft PR 证据

已创建：

```text
PR: #2
Title: build: 上金谷平台从零建设
Base: main
Head: agent/full-build
State: open
Draft: true
```

PR 保持 Draft，PHASE-35 之前不自动 merge。

## 9. CI 证据

PHASE-00 开工时完整递归树没有 `.github/workflows/`，因此：

```text
GitHub Actions: NOT_AVAILABLE_YET
```

不虚构 CI PASS。

## 10. PHASE-00 DoD 证据矩阵

| DoD | 证据 | 结果 |
|---|---|---|
| KB 文件索引完整 | recursive tree `truncated=false` + `KB_FILE_INDEX.md` | PASS |
| AGENT 基线提取 | 全文读取 + `ENGINEERING_BASELINE.md` | PASS |
| DESIGN 基线提取 | 全文读取 + `DESIGN_BASELINE.md` | PASS |
| 台账目录建立 | `docs/implementation/**` | PASS |
| 36 阶段登记 | MASTER_PROGRESS | PASS |
| ADR 模板 | `ADR/ADR-TEMPLATE.md` | PASS |
| Git 安全基础 | `.editorconfig/.gitattributes/.gitignore` | PASS |
| README 真实状态 | 明确“尚未实现” | PASS |
| 不存在业务假实现 | PR diff | PASS |
| checkpoint commit | `9ca410...` | PASS |
| Draft PR | #2 | PASS |
| no force push | Connector `force=false` | PASS |
| secret 安全 | diff/文件范围检查 | PASS |
| CI 真实性 | 无 workflows，记录 NOT_AVAILABLE_YET | PASS |
| 阶段报告 | `phases/PHASE-00/PHASE_REPORT.md` | PASS |

## 11. 阶段完成提交与远端 SHA

包含 `MASTER_PROGRESS=PASS`、本证据和 `PHASE_REPORT.md` 的阶段完成 commit 在这些文件写入后生成。其 SHA 不能在自身内容中自引用；完成 commit 生成后，通过 GitHub 分支 HEAD 与 commit SHA 对比进行远端验证，并在交付对话和 PR head 中记录。
