package cn.shangjingu.platform.workflow;

import cn.shangjingu.platform.core.process.ProcessRejectedException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Repository;

/** Production fail-closed adapter for P008 quota-ledger and temporal invariants. */
@Primary
@Repository
public class GuardedLeaveRepository implements LeaveService.Repository {
    private static final Set<String> LEDGER_TYPES=Set.of("RESERVE","DEDUCT","RELEASE","ADJUST");
    private final JdbcLeaveRepository delegate;
    public GuardedLeaveRepository(JdbcLeaveRepository delegate){this.delegate=delegate;}

    @Override public Optional<UUID> workflowVersion(UUID tenantId){return delegate.workflowVersion(tenantId);}
    @Override public Optional<LeaveService.FormRef> form(UUID tenantId){return delegate.form(tenantId);}
    @Override public List<UUID> permissionCandidates(UUID tenantId,String permission,UUID orgId){return delegate.permissionCandidates(tenantId,permission,orgId);}
    @Override public boolean hasTimeConflict(UUID tenantId,UUID employeeId,Instant start,Instant end){return delegate.hasTimeConflict(tenantId,employeeId,start,end);}
    @Override
    public void insert(LeaveService.LeaveRecord record, UUID actor) {
        delegate.insert(withCanonicalHandoverAgent(record), actor);
    }
    @Override public int bindAndMove(UUID tenantId,UUID id,int version,UUID workflowId,String status,UUID actor){return required(delegate.bindAndMove(tenantId,id,version,workflowId,status,actor),"workflow binding");}
    @Override public int moveStatus(UUID tenantId,UUID id,int version,String status,Instant closedAt,UUID actor){return required(delegate.moveStatus(tenantId,id,version,status,closedAt,actor),"workflow projection transition");}
    @Override public int markQuotaReserved(UUID tenantId,UUID id,UUID actor){return required(delegate.markQuotaReserved(tenantId,id,actor),"quota reservation fact");}
    @Override public int markHandover(UUID tenantId,UUID id,UUID actor){return required(delegate.markHandover(tenantId,id,actor),"handover confirmation fact");}
    @Override public int markDecision(UUID tenantId,UUID id,String decision,UUID actor){return required(delegate.markDecision(tenantId,id,decision,actor),"approval decision fact");}
    @Override public int markQuotaSettled(UUID tenantId,UUID id,UUID actor){return required(delegate.markQuotaSettled(tenantId,id,actor),"quota settlement fact");}
    @Override public int markAttendance(UUID tenantId,UUID id,UUID actor){return required(delegate.markAttendance(tenantId,id,actor),"attendance mark fact");}
    @Override public int markLeaveStarted(UUID tenantId,UURQY[œİ[XİX[]URQXİÜŠ^Ü™]\›ˆ™\]Z\™Y
[YØ]K›X\šÓX]™Tİ\Y
[˜[YYXİX[]XİÜŠK˜XİX[X]™Hİ\˜XİŠNßB‚ˆİ™\œšYBˆX›XÈ[X\šÔ™]\›™Y
URQ[˜[YURQY[œİ[XİX[]URQXİÜŠ^ÂˆX]™TÙ\šXÙK“X]™T™XÛÜ™™XÛÜ™Y[YØ]K™š[™
[˜[YY
K›Ü‘[ÙU›İÊ

KO›™]È›ØÙ\ÜÔ™Z™XİY^Ù\[ÛŠ”X]™H™\]Y\İ›İ›İ[™ŠJNÂˆYŠXİX[]O[[
]›İÈ™]È›ØÙ\ÜÔ™Z™XİY^Ù\[ÛŠ”™]\›ˆXİX[]\È™\]Z\™YŠNÂˆYŠ™XÛÜ™›X]™Tİ\Y]

OO[[
]›İÈ™]È›ØÙ\ÜÔ™Z™XİY^Ù\[ÛŠ”X]™H]\İİ\™Y›Ü™H™]\›‹]Ë]ÛÜšÈŠNÂˆYŠXİX[]š\Ğ™Y›Ü™J™XÛÜ™›X]™Tİ\Y]

JJ]›İÈ™]È›ØÙ\ÜÔ™Z™XİY^Ù\[ÛŠ”™]\›‹]Ë]ÛÜšÈØ[››İ™XÙYHXİX[X]™Hİ\ŠNÂˆ™]\›ˆ™\]Z\™Y
[YØ]K›X\šÔ™]\›™Y
[˜[YYXİX[]XİÜŠKœ™]\›‹]Ë]ÛÜšÈ˜XİŠNÂˆB‚ˆİ™\œšYHX›XÈ[X\šÔ][İPY\İY
URQ[˜[YURQYURQXİÜŠ^Ü™]\›ˆ™\]Z\™Y
[YØ]K›X\šÔ][İPY\İY
[˜[YYXİÜŠKœ][İHY\İY[˜XİŠNßBˆİ™\œšYHX›XÈ[X\šÑ^PÛÜÙY
URQ[˜[YURQYURQXİÜŠ^Ü™]\›ˆ™\]Z\™Y
[YØ]K›X\šÑ^PÛÜÙY
[˜[YYXİÜŠK™^KXÛÜÙH˜XİŠNßB‚ˆİ™\œšYBˆX›XÈ›ÚY\[™YÙ\ŠURQ[˜[YURQYİš[™È[U\KšYÑXÚ[X[[[İ[İš[™È›İKURQXİÜŠ^Âˆ˜[Y]SYÙ\Š[U\K[[İ[
NÂˆ[YØ]K˜\[™YÙ\Š[˜[YY[U\K[[İ[›İKXİÜŠNÂˆB‚ˆİ™\œšYHX›XÈÜ[Û˜[X]™TÙ\šXÙK“X]™T™XÛÜ™ˆš[™
URQ[˜[YURQY
^Ü™]\›ˆ[YØ]K™š[™
[˜[YY
NßBˆİ™\œšYHX›XÈ\İX]™TÙ\šXÙK“X]™T™XÛÜ™ˆ\İ
URQ[˜[Y
^Ü™]\›ˆ[YØ]K›\İ
[˜[Y
NßBˆİ™\œšYHX›XÈ\İX]™TÙ\šXÙK“YÙ\‘[OˆYÙ\ŠURQ[˜[Y
^Ü™]\›ˆ[YØ]K›YÙ\Š[˜[Y
NßB‚ˆİ]XÈİš[™ÈØ[›ÛšXØ[[™İ™\YÙ[Y
İš[™È˜[YJHÂˆYˆ
˜[YHOH[˜[YKš\Ğ›[šÊ
JH™]\›ˆ[Âˆİš[™Èš[[YYH˜[YKš[J
NÂˆHÂˆ™]\›ˆURQ™œ›ÛTİš[™Êš[[YY
KÔİš[™Ê
Kœ™\XÙJ‹H‹ˆŠNÂˆHØ]Ú
[YØ[\™İ[Y[^Ù\[ÛˆYÛ›Ü™Y
HÂˆYˆ
š[[YY›[™İ

HˆÌŠHÂˆ›İÈ™]È›ØÙ\ÜÔ™Z™XİY^Ù\[ÛŠˆ”[™İ™\ˆYÙ[™Y™\™[˜ÙH^ÙYYÈHØ[›ÛšXØ[˜\˜Ú\ŠÌŠHÛÛ˜XİŠNÂˆBˆ™]\›ˆš[[YYÂˆBˆB‚ˆš]˜]Hİ]XÈX]™TÙ\šXÙK“X]™T™XÛÜ™Ú]Ø[›ÛšXØ[[™İ™\YÙ[
ˆX]™TÙ\šXÙK“X]™T™XÛÜ™™XÛÜ™
HÂˆ™]\›ˆ™]ÈX]™TÙ\šXÙK“X]™T™XÛÜ™
ˆ™XÛÜ™šY

K™XÛÜ™[˜[Y

K™XÛÜ™˜\Ú[™\ÜÓ›Ê
Kˆ™XÛÜ™ÛÜšÙ›İÒ[œİ[˜ÙRY

K™XÛÜ™ÛÜšÙ›İÒ[œİ[˜ÙS›Ê
Kˆ™XÛÜ™˜İ\œ™[›ÙPÛÙJ
K™XÛÜ™œİ]\Ê
K™XÛÜ™™\œÚ[Û“›Ê
Kˆ™XÛÜ™œİXš™Xİ

K™XÛÜ™œ™X\ÛÛŠ
K™XÛÜ™›İÛ™\Ù[\’Y

Kˆ™XÛÜ™›İÛ™\‘[\ŞYYRY

K™XÛÜ™˜][™[˜ÙU\J
K™XÛÜ™œİ\]

Kˆ™XÛÜ™™[™]

K™XÛÜ™™\˜][Û’İ\œÊ
K™XÛÜ™œ][İPXØÛİ[Y

Kˆ™XÛÜ™œ][İP[[İ[

KØ[›ÛšXØ[[™İ™\YÙ[Y
™XÛÜ™š[™İ™\YÙ[Y

JKˆ™XÛÜ™šÛ›İÛ’[\Xİ

K™XÛÜ™œ][İT™\Ù\™Y]

Kˆ™XÛÜ™š[™İ™\ÛÛ™š\›YY]

K™XÛÜ™™XÚ\Ú[ÛŠ
K™XÛÜ™˜\›İ™Y]

Kˆ™XÛÜ™œ™Z™XİY]

K™XÛÜ™œ][İTÙ]Y]

Kˆ™XÛÜ™˜][™[˜ÙSX\šÙY]

K™XÛÜ™›X]™Tİ\Y]

Kˆ™XÛÜ™œ™]\›™Y]

K™XÛÜ™œ][İPY\İY]

K™XÛÜ™™^PÛÜÙY]

Kˆ™XÛÜ™˜ÛÜÙY]

K™XÛÜ™\]Y]

JNÂˆB‚ˆš]˜]Hİ]XÈ›ÚY˜[Y]SYÙ\Šİš[™È[U\KšYÑXÚ[X[[[İ[
^ÂˆYŠSQÑT—ÕTTË˜ÛÛZ[œÊ[U\JJ]›İÈ™]È›ØÙ\ÜÔ™Z™XİY^Ù\[ÛŠ”][İHYÙ\ˆ[H\H\È[˜[YŠNÂˆYŠ[[İ[O[[
]›İÈ™]È›ØÙ\ÜÔ™Z™XİY^Ù\[ÛŠ”][İHYÙ\ˆ[[İ[\È™\]Z\™YŠNÂˆYŠQ•TÕ‹™\]X[Ê[U\JJ^ÂˆYŠ[[İ[œÚYÛ[J
OOL
]›İÈ™]È›ØÙ\ÜÔ™Z™XİY^Ù\[ÛŠ”][İHY\İY[]\İ™H›Û‹^™\›ÈŠNÂˆY[ÙHYŠ[[İ[œÚYÛ[J
OL
^Âˆ›İÈ™]È›ØÙ\ÜÔ™Z™XİY^Ù\[ÛŠ”][İHYÙ\ˆ[[İ[]\İ™HÜÚ]]™HŠNÂˆBˆB‚ˆš]˜]Hİ]XÈ[™\]Z\™Y
[\]Yİš[™ÈÜ\˜][ÛŠ^ÂˆYŠ\]YOLJ]›İÈ™]È›ØÙ\ÜÔ™Z™XİY^Ù\[ÛŠ”ŠÛÜ\˜][ÛŠÈˆ˜Z[YÛÜÙYŠNÂˆ™]\›ˆ\]YÂˆBŸB