package cn.shangjingu.platform.iam.infrastructure;

import cn.shangjingu.platform.iam.domain.AuthorizationGrant;
import cn.shangjingu.platform.iam.domain.IdentityDirectoryPort;
import cn.shangjingu.platform.iam.domain.IdentityRecord;
import cn.shangjingu.platform.iam.domain.UserAccountRecord;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcIdentityDirectoryAdapter implements IdentityDirectoryPort {
    private final JdbcTemplate jdbc;

    public JdbcIdentityDirectoryAdapter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<UUID> findTenantIdByCode(String tenantCode) {
        return jdbc.query("select id from core.tenant where tenant_code=?", (rs, n) -> rs.getObject(1, UUID.class), tenantCode)
                .stream().findFirst();
    }

    @Override
    public Optional<UserAccountRecord> findAccount(UUID tenantId, String loginName) {
        return jdbc.query("""
                select id,tenant_id,login_name,password_hash,status,last_login_at,mfa_level
                from iam.user_account
                where tenant_id=? and login_name=? and not is_deleted
                """, (rs, n) -> account(rs), tenantId, loginName).stream().findFirst();
    }

    @Override
    public Optional<UserAccountRecord> findAccountById(UUID tenantId, UUID userId) {
        return jdbc.query("""
                select id,tenant_id,login_name,password_hash,status,last_login_at,mfa_level
                from iam.user_account
                where tenant_id=? and id=? and not is_deleted
                """, (rs, n) -> account(rs), tenantId, userId).stream().findFirst();
    }

    @Override
    public List<IdentityRecord> findActiveIdentities(UUID tenantId, UUID userId) {
        return jdbc.query("""
                select id,tenant_id,user_id,employee_id,identity_type,identity_name,org_id,position_id,
                       is_primary,effective_start_at,effective_end_at
                from iam.user_identity
                where tenant_id=? and user_id=? and not is_deleted
                  and effective_start_at <= now()
                  and (effective_end_at is null or effective_end_at > now())
                order by is_primary desc,effective_start_at,id
                """, (rs, n) -> identity(rs), tenantId, userId);
    }

    @Override
    public Optional<IdentityRecord> findActiveIdentity(UUID tenantId, UUID userId, UUID identityId) {
        return jdbc.query("""
                select id,tenant_id,user_id,employee_id,identity_type,identity_name,org_id,position_id,
                       is_primary,effective_start_at,effective_end_at
                from iam.user_identity
                where tenant_id=? and user_id=? and id=? and not is_deleted
                  and effective_start_at <= now()
                  and (effective_end_at is null or effective_end_at > now())
                """, (rs, n) -> identity(rs), tenantId, userId, identityId).stream().findFirst();
    }

    @Override
    public List<AuthorizationGrant> findAuthorizationGrants(UUID tenantId, UUID userId, UUID identityId) {
        return jdbc.query("""
                select permission_code,risk_level,data_scope_code,data_scope_rule_json,condition_json from (
                select p.permission_code,p.risk_level,r.data_scope_code,
                       ds.rule_expr::text as data_scope_rule_json,
                       rp.condition_expr::text as condition_json
                from iam.user_role ur
                join iam.role r on r.tenant_id=ur.tenant_id and r.id=ur.role_id
                  and not r.is_deleted and r.enabled
                join iam.role_permission rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id and not rp.is_deleted
                join iam.permission p on p.tenant_id=rp.tenant_id and p.id=rp.permission_id and not p.is_deleted
                left join iam.data_scope_rule ds on ds.tenant_id=r.tenant_id and ds.scope_code=r.data_scope_code
                  and not ds.is_deleted and ds.enabled
                where ur.tenant_id=? and ur.user_id=? and not ur.is_deleted
                  and (ur.identity_id is null or ur.identity_id=?)
                  and ur.effective_start_at <= now()
                  and (ur.effective_end_at is null or ur.effective_end_at > now())
                union all
                select p.permission_code,p.risk_level,g.data_scope_code,
                       ds.rule_expr::text as data_scope_rule_json,null::text as condition_json
                from learning.qualification_permission_grant g
                join iam.permission p on p.tenant_id=g.tenant_id and p.id=g.permission_id and not p.is_deleted
                left join iam.data_scope_rule ds on ds.tenant_id=g.tenant_id and ds.scope_code=g.data_scope_code
                  and not ds.is_deleted and ds.enabled
                where g.tenant_id=? and g.user_id=? and g.identity_id=? and g.execution_status='ACTIVE'
                  and g.effective_start_date<=current_date and g.effective_end_date>=current_date
                ) grants order by permission_code,data_scope_code
                """, (rs, n) -> new AuthorizationGrant(
                        rs.getString("permission_code"), rs.getString("risk_level"), rs.getString("data_scope_code"),
                        rs.getString("data_scope_rule_json"), rs.getString("condition_json")),
                tenantId, userId, identityId, tenantId, userId, identityId);
    }

    @Override
    public void updateLastLogin(UUID tenantId, UUID userId) {
        jdbc.update("update iam.user_account set last_login_at=now(),updated_at=now() where tenant_id=? and id=? and not is_deleted",
                tenantId, userId);
    }

    private static UserAccountRecord account(ResultSet rs) throws SQLException {
        return new UserAccountRecord(
                rs.getObject("id", UUID.class), rs.getObject("tenant_id", UUID.class), rs.getString("login_name"),
                rs.getString("password_hash"), rs.getString("status"), rs.getObject("last_login_at", java.time.OffsetDateTime.class),
                rs.getShort("mfa_level"));
    }

    private static IdentityRecord identity(ResultSet rs) throws SQLException {
        return new IdentityRecord(
                rs.getObject("id", UUID.class), rs.getObject("tenant_id", UUID.class), rs.getObject("user_id", UUID.class),
                rs.getObject("employee_id", UUID.class), rs.getString("identity_type"), rs.getString("identity_name"),
                rs.getObject("org_id", UUID.class), rs.getObject("position_id", UUID.class), rs.getBoolean("is_primary"),
                rs.getObject("effective_start_at", java.time.OffsetDateTime.class),
                rs.getObject("effective_end_at", java.time.OffsetDateTime.class));
    }
}
