package cn.shangjingu.platform.api.security;

import cn.shangjingu.platform.iam.session.SessionService;
import cn.shangjingu.platform.iam.session.SessionTokens;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController @RequestMapping("/api/v1/auth")
public final class AuthController {
    private final LoginService loginService; private final SessionService sessions; private final JdbcSecurityAuditService audit;
    public AuthController(LoginService loginService,SessionService sessions,JdbcSecurityAuditService audit){this.loginService=loginService;this.sessions=sessions;this.audit=audit;}
    @PostMapping("/login") public SessionTokenResponse login(@RequestBody LoginRequest r){return SessionTokenResponse.from(loginService.login(r.tenantCode(),r.loginName(),r.password(),r.identityId(),r.mfaCode()));}
    @PostMapping("/refresh") public SessionTokenResponse refresh(@RequestBody RefreshRequest r){SessionTokens s=sessions.refresh(r.refreshToken());try{audit.recordOperation(s.context(),"SESSION_REFRESH","SESSION",null);return SessionTokenResponse.from(s);}catch(RuntimeException ex){try{sessions.logout(s.accessToken());}catch(RuntimeException ignored){}throw ex;}}
    @PostMapping("/logout") public ResponseEntity<Void> logout(@AuthenticationPrincipal SessionPrincipal p){audit.recordOperation(p.context(),"SESSION_LOGOUT","SESSION",null);sessions.logout(p.accessToken());return ResponseEntity.noContent().build();}
    public record LoginRequest(String tenantCode,String loginName,String password,UUID identityId,String mfaCode){} public record RefreshRequest(String refreshToken){}
}
