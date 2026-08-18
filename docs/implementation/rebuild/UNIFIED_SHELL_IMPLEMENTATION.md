# Rebuild_website 统一页面外壳实施说明

## 1. 本次范围

本次只实施三端认证后的公共页面外壳，不改动 PostgreSQL、Flyway、Java 领域服务、工作流状态机、业务权限编码或既有业务数据。

实施内容：

- 将上传模拟站中的顶部品牌栏、全局搜索、左侧导航、面包屑、返回上一层、内容工作区和移动端底部导航转换为正式 Vue 组件；
- 员工端、中心管理端、技术后台端共用同一个外壳组件；
- 继续使用现有 Vue Router、Pinia 会话、服务端权限和来源化页面目录；
- 搜索只展示当前身份已经获得权限、已经注册真实路由且状态为 implemented 的页面；
- 原有业务页面通过 RouterView 原样承载，不使用静态页面冒充真实业务数据。

## 2. 关键文件

```text
technical-platform/web/src/shared/layout/rebuild/
├─ UnifiedPortalShell.vue
├─ UnifiedPortalShell.test.ts
├─ rebuild-shell.css
└─ types.ts
```

接入点：

```text
technical-platform/web/src/platform/AuthenticatedPortalLayout.vue
```

## 3. 权限与数据原则

导航入口仍由现有 `projectActiveNavigation` 计算，必须同时满足：

1. 属于当前 portal；
2. 页面状态为 `implemented`；
3. Vue Router 已注册真实路径；
4. 当前服务端 SessionView 已授予全部所需权限；
5. 当前设备允许访问。

页面外壳不保存业务数据，不计算业务状态，不放宽权限，也不生成虚假的待办数、消息数或 KPI。

## 4. 后续闭环开发方式

后续每完成一个业务闭环，按以下顺序落地：

```text
真实路由 → 页面组件 → API 契约 → 后端命令/查询 → 数据库存储
→ 权限与数据范围 → 通知/审计 → 单元测试 → Playwright 闭环测试
```

只有路由、权限、接口、数据库和验收测试都通过后，页面目录中的状态才允许变更为 `implemented`，并自动进入真实导航。
