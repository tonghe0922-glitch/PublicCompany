
本仓库用于从零建设“景区一体化运营管理平台”。当前处于 **PHASE-00：项目宪法读取、空仓初始化与施工控制面**。

## 当前真实状态

- 尚未实现可运行的员工端、中心管理端或技术后台端。
- 尚未实现业务 API、Worker、Flyway 应用迁移或 Docker 运行环境。
- 当前只建立工程施工控制面、基线、台账、ADR 与安全 Git 配置。
- 禁止把本阶段文档、静态内容或 Knowledge Base 本身描述为“业务系统已完成”。

## 权威资料

发生冲突时按根 `AGENT.md` 定义的优先级处理。核心入口：

1. `AGENT.md`：全仓库最高工程执行约束；
2. `DESIGN.md`：三端视觉、交互、响应式与 Vue 实现基线；
3. `Knowledge Base/`：组织、页面、126 个流程、字段、状态、规则、接口与数据库事实源；
4. `docs/implementation/`：分阶段施工台账与证据。

## 固定施工分支

从 PHASE-00 到 PHASE-35 默认持续使用：

```text
agent/full-build
```

目标分支为 `main`。PHASE-35 全量验收之前，Draft PR 不自动合并。

## 分阶段施工

- 每次只执行当前 PHASE；
- 当前阶段 Definition of Done 未 PASS，不进入下一阶段；
- 优先完成真实可验证的小闭环；
- 不批量生成空 Vue 页面、假 API、Mock 持久化或 TODO 伪装进度；
- 每阶段更新 `docs/implementation/MASTER_PROGRESS.md` 和对应证据。

## 如何启动

**尚未实现。** PHASE-00 不建立应用运行时，因此当前没有可执行的前后端启动命令。

后续阶段只有在真实基础工程建立并验证后，才会在此补充安装、启动、停止、自检、备份和恢复命令。

## 当前导航

- `docs/implementation/KB_FILE_INDEX.md`：Knowledge Base 完整文件索引；
- `docs/implementation/ENGINEERING_BASELINE.md`：工程技术与质量基线；
- `docs/implementation/DESIGN_BASELINE.md`：三端设计基线；
- `docs/implementation/MASTER_PROGRESS.md`：PHASE-00 至 PHASE-35 总进度；
- `docs/implementation/CONSTRUCTION_RULES.md`：阶段施工硬规则；
- `docs/implementation/ADR/ADR-TEMPLATE.md`：架构决策模板。
