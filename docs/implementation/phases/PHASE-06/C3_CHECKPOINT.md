# PHASE-06 C3 CHECKPOINT — File / Attachment / MinIO / SAFE

> State: `COMPLETE`
> Phase: `PHASE-06 = IN_PROGRESS`
> Scope: `PLATFORM/基础工程`
> Completed checkpoint: `C3 = File/Attachment + MinIO + scan/SAFE + signed download`
> Next checkpoint: `C4 = Notification template/message/channel/delivery evidence`
> PHASE-07: `NOT_STARTED`

## 1. C3 完成内容

C3 只实现通用文件/附件与对象存储内核，没有实现任何 P021–P025 业务流程，也没有提前提交 C4 通知 runtime。

已完成：

- 复用批准的 `document.file_object / document.attachment_link`；
- V103 最小技术 overlay 补齐本阶段明确要求但 V16 DDL 缺失的 `sensitive_level`、`version_no`；
- `P1_INTERNAL` 仅映射批准 DDL 注释中的 `P1-内部`，没有自行发明业务敏感分级体系；
- 服务端 SHA-256、MIME、字节数、bucket/object key 证据；
- `FileObjectStorage` 抽象和真实 `MinioFileObjectStorage`；
- 扫描状态机 `PENDING -> SCANNING -> SAFE|INFECTED|FAILED`、`FAILED -> SCANNING`；
- 只有 `SAFE` 文件可以建立正式附件链接或生成下载地址；
- signed GET TTL 限定 1 秒–15 分钟；
- signed download 必须通过 `FileDownloadGuard`，C3 不把“已登录”冒充敏感下载授权；
- PostgreSQL RLS 下跨 tenant 文件不可见；
- 数据库事务回滚时注册对象清理，不伪称 PostgreSQL 与 MinIO 是 XA 事务。

## 2. 真实验证

精确候选：

```text
Commit: b2b96335908b582d513f800f31ef492d3c3f5f70
Workflow run: 31254859183
```

六项全部 PASS：

1. `PHASE-06 platform source scope and safety contract`；
2. `Completed Java regression`；
3. `PHASE-06 PostgreSQL Outbox Inbox File regression`；
4. `PHASE-06 MinIO Document storage regression`；
5. `PHASE-05 PostgreSQL canonical regression`；
6. `Completed Web typecheck test and build`。

其中 MinIO job 使用真实 MinIO Testcontainer，验证 put/stat/presigned HTTP GET/remove；PG16 job 验证 V103、SAFE gate、附件、RLS，并持续回归 C2 Outbox/Inbox。

## 3. 失败与 forward-fix 证据

历史失败不删除、不隐藏：

- `bc8079dc4481fdde600a613f24599e5225623448`：首次 C3 候选，MinIO SDK 公开 API 引用了 `okhttp3.HttpUrl`，document testCompile 缺失 JVM OkHttp 类；连带 Java/PG reactor 失败；
- `de8f7cdb779cae75ef667fea5759d0c7ff515e82`：显式引入普通 `okhttp` 坐标，但 Maven 缺版本；
- `fd9a2b90fd8b513f27e23a76148376608b3b6102`：固定版本后仍因 OkHttp 5 Kotlin Multiplatform 的普通 artifact 不提供 JVM 类而失败；
- `b2b96335908b582d513f800f31ef492d3c3f5f70`：改为 Maven JVM artifact `okhttp-jvm:5.1.0` 后六项全绿。

失败均通过 forward commit 修复，没有删除测试、放宽 SAFE/RLS 门禁或回退 V103。

## 4. 延后到 C7 的边界

C3 已建立强制 `FileDownloadGuard`，但具体 RBAC/data-scope/Step-Up/不可变下载审计接线按 checkpoint 设计属于 C7。当前状态是：**没有 guard 就无法生成 signed URL**，因此不是默认放行。

## 5. Verdict

```text
PHASE-06 = IN_PROGRESS
C1 = COMPLETE
C2 = COMPLETE
C3 = COMPLETE
C4 = AUTHORIZED
P021-P025 = OUT_OF_SCOPE_FOR_PHASE_06
PHASE-07 = NOT_STARTED
```

不得因 C3 完成而跳过 C4–C8。