# P10-COMP-02 修复 Shell、路由标题与页面 Landmark

1. 根目录

   `I:\PublicCompany_source_codex`。Git 元数据不存在，全部变更以确定性 SHA-256 manifest 追踪；未执行远端 Git 操作。

2. 修改前基线 ID

   - package `LOCAL/00_检查本地项目.ps1`: exit 1，PowerShell 5.1 中文编码损坏导致源码解析失败。
   - package `LOCAL/01_生成本地基线.ps1`: exit 1，同类字符串终止/编码解析失败，未产生可用基线。
   - project preflight: exit 0。
   - workspace source: `1A74EC9C380056C5F85051294F51FE0CE7DE0772D0BD51E13B104F502E55DDB5` / 1465 files。
   - task source: `2DC695697362A1B5F417485A056451AF5190783EDBB4FB17F74C35AD90CD63E0` / 42 planned paths（25 existing，17 missing）。
   - evidence metadata: `4F53CDA18C2BAA0C0354BB5F9A3ECBE5ED12AB4D8E11BA873C2F11161202B945` / 0。

3. 修改摘要

   路由标题从 `navigation-source` 的 portal/path/name 权威记录投影到 `RouteMeta`；`AuthenticatedPortalLayout` 使用 route title，不再把 portal home title 应用于所有子路由。`PortalShell` 继续拥有唯一 `main` 与路由 `h1`；P001–P010、共享监控与 Forbidden 的页面根改为普通 section，业务模板默认标题降为 `h2`。`PageTemplateFrame` 及六个公开模板支持受控 `headingLevel`。独立首轮审查发现 null-name fallback 在同路径存在不同显式 routeName 时会错误放行；RESUBMIT-1 已改为 exact named 唯一、任意显式名称阻断 null fallback、零显式名称且唯一 null 才接受。未改 API、状态机、权限、数据范围、路由 path/component/props 或 admin=tech 运行别名。

4. 文件清单

   - Router/layout: `route-meta.d.ts`、`portal-router.ts`、新增 `route-semantics.test.ts`、`AuthenticatedPortalLayout.vue`；`portal-router.test.ts` 计划内核验但未修改。
   - Templates/tests: `PageTemplateFrame.vue`、Approval/Dashboard/Detail/Form/List/Timeline 六模板、增加 `PageTemplateFrame.test.ts` 与 `PortalShell.landmark.test.ts`；`PortalShell.vue` 未修改。
   - Pages: P001–P010、Phase09CenterInbox、Phase09TechWorkflowMonitor、Phase10AttendanceMonitor、Forbidden 共 14 个 `.vue`。
   - Plans: 上述 14 页各自新增同目录 `<PageName>.ui-plan.json`。
   - Evidence: `technical-platform/web/src/router/evidence/P10-COMP-02/**`。

5. ui-plan

   14/14 独立计划通过 package schema 必填字段与 registry component ID 校验。每份均包含 route/portal/process、字段/状态/动作映射、PC/移动投影、复用决定、缺口分类、测试与安全边界。P006/P007 组件化债务明确留给 P10-COMP-04，P008–P010 拆分债务留给 P10-COMP-05，技术监控重建留给 P10-COMP-06；本任务未提前施工。

6. 复用、新增与注册表变化

   复用现有 `ui.layout.portal-shell`、页面模板和反馈组件。新增公共组件 0，registry 变化 0，public index 变化 0，原生元素例外 0。新增内容只有测试、页面计划与证据。

7. 设计决定

   - 运行时 title/sourceKey/sensitiveLevel 只来自 `PORTAL_IA_NAVIGATION`：同 portal/path 的 exact routeName 必须唯一；exact 未命中且路径存在任意显式 routeName 时稳定报 `ROUTE_SOURCE_MISSING`，只在显式名称数量为零且 `routeName:null` 唯一时 fallback；duplicate exact/null 均报 `ROUTE_SOURCE_AMBIGUOUS`。
   - P008 center `/center/04/04/01` 精确采用 source key `2-2中心全层级页面.xlsx:完整页面树:R253:6634facff70c`；不复制自由标题字符串。
   - Shell 标题是唯一 primary heading；模板默认 `headingLevel=2`，仅显式独立场景可受控选择 1/2/3。
   - 既有嵌套页面均不再拥有 `main`/`h1`，最终 DOM landmark 由 Shell 唯一拥有；未抽取新公共组件，也未改业务行为。

8. Gate 与测试结果

   - ui-plan: exit 0，14 plans，registry IDs 58，errors 0；首次 PowerShell wrapper 因 `$name:` 变量边界解析失败 exit 1、验证主体未启动，修正后真实结果为 0。
   - official route/template/landmark + reviewer fixture: exit 0，5 files / 56 tests；覆盖 null+different-name、duplicate-null、duplicate-exact、missing 四负例与 P008 单一 null 正例。修前官方新增矩阵为 18 tests / 1 fail，准确复现错误放行。
   - project source self-test: exit 0；current source: exit 1 / 340 findings / 7 routed pages / 46 actions，遗留债务真实保留；`portal-router.ts` findings 0。
   - package UI self-test: exit 0；current UI: exit 1 / 88 errors / 0 warnings，P10-COMP-03A/P006–P010 遗留债务真实保留。
   - lint/typecheck/full unit/Knip: 0/0/0/0；full unit 34 files / 193 tests。
   - build 首个包装器因把既有 Vite chunk warning stderr 升级为 `NativeCommandError`，在 employee 成功后 exit 1，未计 PASS；修正包装后 employee/center/admin 完整 build exit 0，约 2.080 MB warning 保留。
   - CORE 共享回归：P012 fresh Chromium 1/1 PASS（14.4s/19.5s），PG `b3e0…e331`、Redis `62cd…abd1` ABSENT；P013 1/1 PASS（14.1s/19.0s），PG `fe88…45aa`、Redis `2797…c750` ABSENT；均 Ryuk/process 0。P012 首轮 h1 定位失败链仍保留，不改写为初次通过。
   - RESUBMIT-1 fresh representative P016 Browser：前两次分别因未 test-compile、exec 未包含 test classpath 而在容器前 exit 1；19-module test-compile 0 后，real Spring/PG16.14/Redis7.4 READY，Chromium 1/1 PASS（13.4s/18.3s）。受控 Ctrl+C 后 PG `4a6ee979f0f944ece1a88ac4693e097a9d5767bff12712e7b98e63c790794298`、Redis `5ecf5f249f0ff57304e1e7dec8f1b131338376d0ea48d39ef764230f0bce78dc` ABSENT，Ryuk 0、workspace gate processes 0；首次 cleanup 检查自匹配当前 PowerShell 而 exit 1，排除当前 PID 后真实复核 exit 0。

9. 证据目录

   `technical-platform/web/src/router/evidence/P10-COMP-02/`。`validation/failure-chain.md` 保留初次施工失败链；`resubmit-1/` 保存独立 FAIL 后的 fresh pre、四负例、完整矩阵、Browser 启动/清理失败链、post/scoped 与 hashes。Reviewer-owned `reviewer-independent.test.ts` 保持只读。

10. 阻塞项

   本任务候选无实现阻塞。全仓 source/UI Gate 当前仍因后续 P10-COMP-03A 与 P006–P010 组件化债务为 FAIL；这些未被误报为已解决。P012 首轮共享技术路由 h1 失败已由 CORE 在其 E2E 所有权内以显式权威标题修正并 fresh PASS；历史失败证据未覆盖。

11. 下一任务是否解锁

   `P10-COMP-03+` 保持锁定。只有独立审查员对 P10-COMP-02 明确 PASS 后，才允许按 YAML 解锁 P10-COMP-03A；本报告不自行宣布 PASS。

12. 修改后基线 ID

   - RESUBMIT-1 fresh pre project preflight/baseline: exit 0/0。
   - workspace source: `147FBA56E8E3340015D29E9E1C535BD76D4D2D10E8059510294D75411EDA454F` / 1483 files。
   - task source: `5C269235A9864E63F4BB6699C418E701670D7D01B61C93BD748CFCF9FF9246F9` / 42 files。
   - fresh pre 已包含本轮两项 UI source 修复、reviewer Gate 与 CORE P012/P014 E2E 权威标题定位；final 窗口 source 不再变化。
   - 预期 post scoped diff: UI task 0 / unrelated 0 / concurrent CORE 0 / evidence metadata 1；以 `resubmit-1/final-post/` 实际 manifest 为准。
   - evidence metadata ID 与报告 SHA/bytes 以二次刷新后的 final manifest 和 `submitted-sha256.json` 为准。
