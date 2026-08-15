# PHASE-11 exact-head gate trigger

本文件只用于确保 PHASE-11 P012–P016 Checkpoint 与 Full Construction Gate 在正式施工分支的当前精确提交上由普通 push 重新执行。

- 不修改业务规则；
- 不删除或跳过任何测试；
- 不放宽权限、幂等、并发、数据库、审计、Outbox 或 Live E2E 门禁；
- 不启动 PHASE-12；
- 只有最终精确 HEAD 所有 required jobs 全绿，PHASE-11 才允许报告 READY_FOR_GATE。
