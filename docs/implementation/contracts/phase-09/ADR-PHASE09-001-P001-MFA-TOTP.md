# ADR-PHASE09-001｜P001 MFA 实现选择

## Status
ACCEPTED FOR PHASE-09 C0

## Context
P001 的权威 XLSX 明确包含“身份认证/MFA”节点和“统一身份与MFA”接口能力；当前 `LoginService` 只有密码认证，`iam.user_account.mfa_level` 已存在，IAM Step-Up 也已有 `MfaCapabilityProvider` 抽象，但生产默认 provider 为 fail-closed，且仓库没有登录期 MFA enrollment/secret store。

## Decision

PHASE-09 采用 **TOTP (RFC 6238 compatible, SHA-1/30s/6 digits)** 作为当前内建 MFA 方法，保留 `MfaCapabilityProvider` 作为高风险 Step-Up 的抽象边界，不把 TOTP 写死为平台未来唯一 MFA。

技术持久化新增 `iam.mfa_totp_enrollment`：
- tenant_id + user_id 唯一；
- secret 仅以 AES-GCM 密文保存；
- encryption key 只来自运行环境，不进入 Git/DB 明文；
- pending enrollment 在确认首个有效 TOTP 后才启用并把 `user_account.mfa_level` 提升；
- disable 需要已登录主体、SELF 数据范围与 recent Step-Up/reauth；
- audit 只记录动作和主体，不记录 secret/TOTP code。

登录：
- `mfa_level = 0`：保持当前密码认证兼容；
- `mfa_level > 0`：必须额外提交有效 `mfaCode`，缺失/错误统一按认证失败处理，避免泄露账户 MFA 状态；
- TOTP 校验允许当前时间片 ±1 window，成功 code 不进入日志；
- identity/session 仍由现有 IAM/Redis SessionService 签发，不创建第二套会话。

## Why TOTP
- 不依赖未批准的短信/邮件第三方供应商；
- 可在 PostgreSQL/Redis/Testcontainers + Playwright 环境真实闭环测试；
- 方法属于安全工程实现选择，不改变业务审批人、权限范围或状态语义；
- 后续可新增 WebAuthn/provider adapter，而不改变 P001 的 MFA 业务节点。

## Security requirements
- encryption key missing/invalid => MFA enrollment/decryption fail closed;
- secret never returned after enrollment setup response；setup response only once and only to authenticated self;
- no localStorage credential/secret;
- rate-limit/brute-force protection must reuse/extend IAM login protection before final Gate;
- database RLS/tenant boundary remains final data boundary.

## Migration / rollback
- additive Flyway overlay only; no destructive modification to approved source tables;
- rollback application code first, leave technical table inert; destructive drop is not automatic rollback.
