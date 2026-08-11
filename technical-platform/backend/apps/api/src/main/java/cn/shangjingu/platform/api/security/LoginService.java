package cn.shangjingu.platform.api.security;

import cn.shangjingu.platform.iam.application.IdentityDirectoryService;
import cn.shangjingu.platform.iam.domain.IdentityRecord;
import cn.shangjingu.platform.iam.domain.UserAccountRecord;
import cn.shangjingu.platform.iam.mfa.TotpCredentialService;
import cn.shangjingu.platform.iam.session.SessionService;
import cn.shangjingu.platform.iam.session.SessionTokens;
import java.util.List;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public final class LoginService {
    private final IdentityDirectoryService identities; private final SessionService sessions; private final PasswordEncoder passwordEncoder; private final JdbcSecurityAuditService audit; private final TotpCredentialService totp;
    public LoginService(IdentityDirectoryService identities,SessionService sessions,PasswordEncoder passwordEncoder,JdbcSecurityAuditService audit,TotpCredentialService totp){this.identities=identities;this.sessions=sessions;this.passwordEncoder=passwordEncoder;this.audit=audit;this.totp=totp;}
    public SessionTokens login(String tenantCode,String loginName,String password,UUID requestedIdentityId,String mfaCode){if(tenantCode==null||tenantCode.isBlank()||loginName==null||loginName.isBlank()||password==null||password.isEmpty())throw new LoginRejectedException(LoginRejectedException.Reason.INVALID_CREDENTIALS);UUID tenantId=identities.resolveTenant(tenantCode.strip()).orElseThrow(()->new LoginRejectedException(LoginRejectedException.Reason.INVALID_CREDENTIALS));UserAccountRecord account=identities.findAccount(tenantId,loginName.strip()).orElse(null);if(account==null||!account.active()||!matches(password,account.passwordHash())){audit.recordSecurityEvent(tenantId,account==null?null:account.id(),null,"LOGIN_REJECTED","WARN","INVALID_CREDENTIALS");throw new LoginRejectedException(LoginRejectedException.Reason.INVALID_CREDENTIALS);}if(!totp.verifyLogin(tenantId,account.id(),account.mfaLevel(),mfaCode)){audit.recordSecurityEvent(tenantId,account.id(),null,"LOGIN_REJECTED","WARN","MFA_REQUIRED_OR_INVALID");throw new LoginRejectedException(LoginRejectedException.Reason.MFA_REQUIRED_OR_INVALID);}List<IdentityRecord> active=identities.activeIdentities(tenantId,account.id());IdentityRecord selected=requestedIdentityId==null?active.stream().findFirst().orElse(null):active.stream().filter(i->i.id().equals(requestedIdentityId)).findFirst().orElse(null);if(selected==null){audit.recordSecurityEvent(tenantId,account.id(),null,"LOGIN_REJECTED","WARN","NO_ACTIVE_IDENTITY");throw new LoginRejectedException(LoginRejectedException.Reason.NO_ACTIVE_IDENTITY);}SessionTokens issued=sessions.issue(tenantId,account.id(),selected.id());try{identities.markLogin(tenantId,account.id());audit.recordOperation(issued.context(),"LOGIN_SUCCESS","SESSION",null);return issued;}catch(RuntimeException ex){try{sessions.logout(issued.accessToken());}catch(RuntimeException ignored){}throw ex;}}
    public void requirePasswordReauthentication(UUID tenantId,UUID userId,String password){if(tenantId==null||userId==null||password==null||password.isEmpty()){if(tenantId!=null) audit.recordSecurityEvent(tenantId,userId,null,"P001_REAUTH_REJECTED","WARN","INVALID_CREDENTIALS");throw new LoginRejectedException(LoginRejectedException.Reason.INVALID_CREDENTIALS);}UserAccountRecord account=identities.findAccountById(tenantId,userId).orElse(null);if(account==null||!account.active()||!matches(password,account.passwordHash())){audit.recordSecurityEvent(tenantId,userId,null,"P001_REAUTH_REJECTED","WARN","INVALID_CREDENTIALS");throw new LoginRejectedException(LoginRejectedException.Reason.INVALID_CREDENTIALS);}}
    private boolean matches(String raw,String hash){if(hash==null||hash.isBlank())return false;try{return passwordEncoder.matches(raw,hash);}catch(IllegalArgumentException ex){return false;}}
}
