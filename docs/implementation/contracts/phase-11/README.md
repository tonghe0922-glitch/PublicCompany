# PHASE-11 ENGINEERING CONTRACT ROOT

> Status: `C0_NOT_FROZEN`  
> Scope: P011–P016 绩效成长福利  
> Branch: `agent/phase-11-performance-growth-welfare`

本目录用于保存逐流程 C0 审核后显式冻结的工程合同。当前 Knowledge Base 没有业务 HTTP path 记录，因此不得从流程名、表名、Sheet 文本或历史 PHASE-05 API 自动推导最终标识。

在 P011 C0 通过前，以下文件/内容均不得宣称 FROZEN：

- HTTP method/path/request/response/error contract；
- permission code、data scope、字段投影和 Step-Up 条件；
- workflow version、node、action、form/schema；
- page source_key、route、portal、purpose；
- database additive overlay、RLS、constraint、index；
- domain event、outbox、notification、audit；
- E2E identity、negative cases、idempotency/concurrency assertions。

C0 决策必须写入 `C0_DECISION_LOG.md`。任何来源冲突只能采用“接受某个权威坐标 / 由更高权威来源替代 / 正式登记来源修订”三种方式处理，禁止静默改写。
