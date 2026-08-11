package cn.shangjingu.platform.iam.session;

import cn.shangjingu.platform.iam.application.IdentityDirectoryService;
import cn.shangjingu.platform.iam.domain.IdentityRecord;
import cn.shangjingu.platform.org.domain.AppointmentRecord;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

public final class SessionService {
    private static final int TOKEN_BYTES=32;
    private final IdentityDirectoryService identities; private final SessionStore store; private final SessionPolicy policy; private final Clock clock; private final SecureRandom random;
    public SessionService(IdentityDirectoryService identities,SessionStore store,SessionPolicy policy){this(identities,store,policy,Clock.systemUTC(),new SecureRandom());}
    SessionService(IdentityDirectoryService identities,SessionStore store,SessionPolicy policy,Clock clock,SecureRandom random){this.identities=Objects.requireNonNull(identities);this.store=Objects.requireNonNull(store);this.policy=Objects.requireNonNull(policy);this.clock=Objects.requireNonNull(clock);this.random=Objects.requireNonNull(random);}
    public SessionTokens issue(UUID tenantId,UUID userId,UUID identityId){return issueResolved(resolveIdentity(tenantId,userId,identityId,null));}
    public Optional<SessionContext> authenticateAccess(String token){if(token==null||token.isBlank())return Optional.empty();var found=store.findByAccessDigest(digest(token));if(found.isEmpty())return Optional.empty();var s=found.orElseThrow();if(!authoritativeContextStillActive(s.context())){store.revoke(s);return Optional.empty();}return Optional.of(s.context());}
    public SessionTokens refresh(String token){if(token==null||token.isBlank())throw new SessionRejectedException(SessionRejectedException.Reason.INVALID_REFRESH);String d=digest(token);var found=store.findByRefreshDigest(d);if(found.isEmpty()){if(store.wasRefreshUsed(d))throw new SessionRejectedException(SessionRejectedException.Reason.REFRESH_REPLAY);throw new SessionRejectedException(SessionRejectedException.Reason.INVALID_REFRESH);}var current=found.orElseThrow();ResolvedIdentity resolved;try{resolved=resolveIdentity(current.context().tenantId(),current.context().userId(),current.context().identityId(),current.context().appointmentId());}catch(SessionRejectedException ex){store.revoke(current);throw ex;}RawPair raw=rawPair();var replacement=stored(current.familyId(),resolved,raw.accessDigest(),raw.refreshDigest());var outcome=store.rotate(current,d,replacement,policy.accessTtl(),policy.refreshTtl());if(outcome==SessionStore.RotationOutcome.REPLAYED)throw new SessionRejectedException(SessionRejectedException.Reason.REFRESH_REPLAY);if(outcome!=SessionStore.RotationOutcome.ROTATED)throw new SessionRejectedException(SessionRejectedException.Reason.INVALID_REFRESH);return tokens(raw,replacement);}
    public SessionTokens switchIdentity(String accessToken,UUID targetIdentityId){var current=requireAccess(accessToken);var target=resolveIdentity(current.context().tenantId(),current.context().userId(),targetIdentityId,null);store.revoke(current);return issueResolved(target);}
    public boolean logout(String accessToken){if(accessToken==null||accessToken.isBlank())return false;var f=store.findByAccessDigest(digest(accessToken));if(f.isEmpty())return false;store.revoke(f.orElseThrow());return true;}
    public List<SessionSummary> listActive(UUID tenantId,UUID userId){return store.listByUser(tenantId,userId).stream().filter(s->authoritativeContextStillActive(s.context())).map(s->new SessionSummary(s.familyId(),s.context().identityId(),s.context().employeeId(),s.context().orgId(),s.context().positionId(),s.context().issuedAt(),s.accessExpiresAt(),s.refreshExpiresAt())).toList();}
    private SessionStore.StoredSession requireAccess(String token){if(token==null||token.isBlank())throw new SessionRejectedException(SessionRejectedException.Reason.INVALID_ACCESS);var s=store.findByAccessDigest(digest(token)).orElseThrow(()->new SessionRejectedException(SessionRejectedException.Reason.INVALID_ACCESS));if(!authoritativeContextStillActive(s.context())){store.revoke(s);throw new SessionRejectedException(SessionRejectedException.Reason.APPOINTMENT_INACTIVE);}return s;}
    private boolean authoritativeContextStillActive(SessionContext c){try{var r=resolveIdentity(c.tenantId(),c.userId(),c.identityId(),c.appointmentId());return r.identity().employeeId().equals(c.employeeId())&&r.identity().orgId().equals(c.orgId())&&r.identity().positionId().equals(c.positionId());}catch(SessionRejectedException ex){return false;}}
    private SessionTokens issueResolved(ResolvedIdentity r){RawPair raw=rawPair();var s=stored(UUID.randomUUID(),r,raw.accessDigest(),raw.refreshDigest());store.create(s,policy.accessTtl(),policy.refreshTtl());return tokens(raw,s);}
    private SessionStore.StoredSession stored(UUID id,ResolvedIdentity r,String a,String f){Instant now=clock.instant();var c=new SessionContext(r.identity().tenantId(),r.identity().userId(),r.identity().id(),r.identity().employeeId(),r.appointment().id(),r.identity().orgId(),r.identity().positionId(),now);return new SessionStore.StoredSession(id,c,a,f,now.plus(policy.accessTtl()),now.plus(policy.refreshTtl()));}
    private SessionTokens tokens(RawPair r,SessionStore.StoredSession s){return new SessionTokens(r.accessToken(),r.refreshToken(),s.accessExpiresAt(),s.refreshExpiresAt(),s.context());}
    private ResolvedIdentity resolveIdentity(UUID t,UUID u,UUID i,UUID required){IdentityRecord identity=identities.activeIdentity(t,u,i).orElseThrow(()->new SessionRejectedException(SessionRejectedException.Reason.IDENTITY_INACTIVE));AppointmentRecord appointment=required==null?identities.activeAppointment(t,u,i).orElseThrow(()->new SessionRejectedException(SessionRejectedException.Reason.APPOINTMENT_INACTIVE)):identities.activeAppointment(t,u,i,required).orElseThrow(()->new SessionRejectedException(SessionRejectedException.Reason.APPOINTMENT_INACTIVE));return new ResolvedIdentity(identity,appointment);}
    private RawPair rawPair(){String a=rawToken(),r=rawToken();return new RawPair(a,r,digest(a),digest(r));} private String rawToken(){byte[]b=new byte[TOKEN_BYTES];random.nextBytes(b);return Base64.getUrlEncoder().withoutPadding().encodeToString(b);} static String digest(String token){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException ex){throw new IllegalStateException(ex);}}
    public record SessionSummary(UUID familyId,UUID identityId,UUID employeeId,UUID orgId,UUID positionId,Instant issuedAt,Instant accessExpiresAt,Instant refreshExpiresAt){}
    private record RawPair(String accessToken,String refreshToken,String accessDigest,String refreshDigest){} private record ResolvedIdentity(IdentityRecord identity,AppointmentRecord appointment){}
}
