<script setup lang="ts">
import { computed,onMounted,ref } from 'vue'
import { usePortalSessionStore } from '../../session'
import type { PortalDefinition } from '../portal-config'

type Process='P008'|'P009'|'P010'
type Mode='employee'|'center'
interface RecordView{id:string;businessNo:string;currentNodeCode:string|null;status:string;versionNo:number;subject?:string|null;ownerEmployeeId?:string|null;attendanceType?:string|null;startAt?:string|null;endAt?:string|null;durationHours?:number|null;quotaAccountId?:string|null;quotaAmount?:number|null;decision?:string|null;actualDurationHours?:number|null;supervisorDecision?:string|null;compensationPlan?:string|null;completionRate?:number|null;score1000?:number|null;practicalResult?:string|null;courseVersionId?:string|null;contentVersion?:string|null;periodOrCourseNo?:string|null;qualificationEffectiveDate?:string|null;qualificationExpireDate?:string|null;permissionLinkedAt?:string|null}
interface Aggregate{record:RecordView;evidence?:unknown[]}
interface ActionBody{expectedVersion:number;reason?:string|null;actualAt?:string;adjustmentAmount?:number;actualStartAt?:string;actualEndAt?:string;attendanceSummary?:string;resultSummary?:string;compensationPlan?:string;wageAmount?:number;quotaAccountId?:string;timeOffHours?:number;payrollReference?:string;note?:string;effectiveDate?:string;expireDate?:string}

const props=defineProps<{portal:PortalDefinition;process:Process;mode:Mode}>()
const session=usePortalSessionStore()
const rows=ref<Aggregate[]>([]),ledger=ref<unknown[]>([]),busy=ref(false),feedback=ref('')
const subject=ref(''),reason=ref(''),attendanceType=ref(''),startAt=ref(''),endAt=ref('')
const quotaAccount=ref(''),quotaAmount=ref(''),handover=ref(''),knownImpact=ref(''),emergency=ref(false)
const actualStart=ref(''),actualEnd=ref(''),actualSummary=ref(''),resultSummary=ref(''),adjustment=ref('')
const compPlan=ref('WAGE'),wage=ref('0'),timeOff=ref(''),payrollRef=ref('')
const progress=ref('100'),score=ref(''),practical=ref('通过'),effectiveDate=ref(''),expireDate=ref('')
const targetEmployee=ref(''),contentVersion=ref(''),courseTeam=ref(''),courseVersion=ref('')
const learnerProfile=ref(''),periodNo=ref(''),riskLevel=ref('NORMAL'),plannedStart=ref(''),plannedFinish=ref('')
const center=computed(()=>props.mode==='center'),orgId=computed(()=>session.session?.orgId??'')

function idem(scope:string){return`${props.process}-${scope}-${globalThis.crypto.randomUUID()}`}
function iso(value:string){const date=new Date(value);if(Number.isNaN(date.getTime()))throw new Error('日期时间无效');return date.toISOString()}
async function run(task:()=>Promise<void>){busy.value=true;feedback.value='';try{await task()}catch(error){feedback.value=error instanceof Error?error.message:'操作失败'}finally{busy.value=false}}
function base(){if(props.process==='P008')return'/api/v1/processes/P008/leaves';if(props.process==='P009')return'/api/v1/processes/P009/overtime-requests';return'/api/v1/processes/P010/assignments'}
async function load(){rows.value=await session.request<Aggregate[]>(base());if(props.process==='P008')ledger.value=await session.request<unknown[]>('/api/v1/processes/P008/quota-ledger')}

async function createP008(){
  await session.request(base(),{method:'POST',idempotencyKey:idem('create'),body:{subject:subject.value.trim(),reason:reason.value.trim()||null,ownerCenterId:orgId.value,attendanceType:attendanceType.value.trim(),quotaAccountId:quotaAccount.value.trim(),quotaAmount:Number(quotaAmount.value),startAt:iso(startAt.value),endAt:iso(endAt.value),handoverAgentId:handover.value.trim()||null,knownImpact:knownImpact.value.trim()||null}})
}
async function createP009(){
  await session.request(base(),{method:'POST',idempotencyKey:idem('create'),body:{subject:subject.value.trim(),reason:reason.value.trim()||null,ownerCenterId:orgId.value,attendanceType:attendanceType.value.trim(),startAt:iso(startAt.value),endAt:iso(endAt.value),emergencyFact:emergency.value}})
}
async function createP010(){
  const required=[subject.value,targetEmployee.value,contentVersion.value,courseTeam.value,courseVersion.value,periodNo.value]
  if(required.some(value=>!value.trim()))throw new Error('请完整填写学习任务、目标员工和课程版本信息')
  await session.request(base(),{method:'POST',idempotencyKey:idem('create'),body:{subject:subject.value.trim(),reason:reason.value.trim()||null,ownerCenterId:orgId.value,ownerEmployeeId:targetEmployee.value.trim(),contentVersion:contentVersion.value.trim(),courseTeamName:courseTeam.value.trim(),courseVersionId:courseVersion.value.trim(),learnerProfile:learnerProfile.value.trim()||null,periodOrCourseNo:periodNo.value.trim(),riskLevel:riskLevel.value,plannedStartAt:plannedStart.value?iso(plannedStart.value):null,plannedFinishAt:plannedFinish.value?iso(plannedFinish.value):null}})
}
function create(){return run(async()=>{
  if(!orgId.value)throw new Error('缺少中心身份')
  if(props.process==='P008')await createP008()
  else if(props.process==='P009')await createP009()
  else await createP010()
  feedback.value=props.process==='P010'?'学习任务已创建，等待发布课程版本':'已提交并进入服务端状态机'
  await load()
})}

function commonBody(aggregate:Aggregate):ActionBody{return{expectedVersion:aggregate.record.versionNo,reason:reason.value.trim()||null}}
function bodyForP008(aggregate:Aggregate){const body=commonBody(aggregate);if(actualStart.value)body.actualAt=iso(actualStart.value);if(adjustment.value)body.adjustmentAmount=Number(adjustment.value);return body}
function bodyForP009(aggregate:Aggregate){const body=commonBody(aggregate);if(actualStart.value)body.actualStartAt=iso(actualStart.value);if(actualEnd.value)body.actualEndAt=iso(actualEnd.value);body.attendanceSummary=actualSummary.value.trim()||undefined;body.resultSummary=resultSummary.value.trim()||undefined;body.compensationPlan=compPlan.value;body.wageAmount=Number(wage.value||0);body.quotaAccountId=quotaAccount.value.trim()||undefined;body.timeOffHours=timeOff.value?Number(timeOff.value):undefined;body.payrollReference=payrollRef.value.trim()||undefined;return body}
function bodyForP010(aggregate:Aggregate):ActionBody{return{expectedVersion:aggregate.record.versionNo,note:reason.value.trim()||undefined,effectiveDate:effectiveDate.value||undefined,expireDate:expireDate.value||undefined}}
function bodyFor(aggregate:Aggregate){if(props.process==='P008')return bodyForP008(aggregate);if(props.process==='P009')return bodyForP009(aggregate);return bodyForP010(aggregate)}
function act(aggregate:Aggregate,action:string){return run(async()=>{await session.request(`${base()}/${aggregate.record.id}/actions/${action}`,{method:'POST',idempotencyKey:idem(action.toLowerCase()),body:bodyFor(aggregate)});feedback.value=`${aggregate.record.businessNo} 已执行 ${action}`;await load()})}
function p010Employee(aggregate:Aggregate,kind:'progress'|'exam'|'practical'){return run(async()=>{let body:object;if(kind==='progress')body={completionRate:Number(progress.value),note:reason.value.trim()||null};else if(kind==='exam')body={score1000:Number(score.value),note:reason.value.trim()||null};else body={result:practical.value,note:reason.value.trim()||null};await session.request(`${base()}/${aggregate.record.id}/${kind==='progress'?'learning-progress':kind}`,{method:'POST',idempotencyKey:idem(kind),body});await load()})}

type Action={code:string;label:string}
const actions=computed<Record<string,Action[]>>(()=>{
  if(props.process==='P008')return{S02:[{code:'RESERVE_QUOTA',label:'预占额度'}],S03:[{code:'CONFIRM_HANDOVER',label:'确认交接'}],S04:[{code:'APPROVE_LEAVE',label:'批准'},{code:'REJECT_LEAVE',label:'驳回'}],S05:[{code:'COMMIT_QUOTA',label:'转扣减'},{code:'RELEASE_QUOTA',label:'释放预占'}],S06:[{code:'MARK_ATTENDANCE',label:'标记考勤'}],S07:[{code:'START_LEAVE',label:'确认实际休假'}],S08:[{code:'RETURN_TO_WORK',label:'销假/返岗'},{code:'CHANGE_LEAVE',label:'变更返岗'}],S09:[{code:'ADJUST_QUOTA',label:'差额调整'}],S10:[{code:'CLOSE_DAY',label:'日结归档'}]}
  if(props.process==='P009')return{S02:[{code:'VALIDATE_NECESSITY',label:'必要性校验'}],S03:[{code:'APPROVE_OVERTIME',label:'批准加班'},{code:'REJECT_OVERTIME',label:'驳回'}],S04:[{code:'RECORD_ACTUAL_FACT',label:'登记实际劳动'}],S05:[{code:'ACCEPT_RESULT',label:'成果验收'}],S06:[{code:'HR_REVIEW',label:'人事复核'}],S07:[{code:'SET_COMPENSATION_PLAN',label:'确定工资/调休方案'}],S08:[{code:'ACK_PAYROLL_RECEIPT',label:'确认薪酬回执'}],S09:[{code:'ARCHIVE',label:'归档'}]}
  return{S01:[{code:'PUBLISH_CONTENT',label:'发布课程/制度版本'}],S02:[{code:'ASSIGN_BY_RISK',label:'按岗位风险指派'}],S06:[{code:'CERTIFY',label:'专业认证通过'},{code:'RETURN_FOR_TRAINING',label:'退回补训'}],S07:[{code:'ACTIVATE_QUALIFICATION',label:'资格生效'}],S08:[{code:'LINK_PERMISSIONS',label:'服务端联动岗位权限'}],S09:[{code:'COMPLETE_RETRAINING_CHECK',label:'完成复训/复证检查'}],S10:[{code:'ARCHIVE',label:'归档'}]}
})
onMounted(()=>void run(load))
</script>

<template>
  <main class="phase09-page" :data-testid="`${process.toLowerCase()}-page`">
    <header>
      <p class="phase09-kicker">PHASE-10 · {{process}}</p>
      <h1>{{process==='P008'?'请假与考勤':process==='P009'?'加班与调休':'员工学习、考试与资格'}}</h1>
      <p>页面仅提交业务动作；状态、权限、额度、成绩与资格事实均由服务端/PostgreSQL 决定。</p>
    </header>

    <section v-if="!center&&process!=='P010'" class="phase09-card">
      <h2>发起申请</h2>
      <div class="phase09-grid">
        <label>主题<input v-model="subject"></label><label>类型<input v-model="attendanceType"></label>
        <label>开始<input v-model="startAt" type="datetime-local"></label><label>结束<input v-model="endAt" type="datetime-local"></label>
        <template v-if="process==='P008'"><label>额度账户<input v-model="quotaAccount"></label><label>额度数量<input v-model="quotaAmount" type="number" step="0.01"></label><label>交接代理人<input v-model="handover"></label><label>已知影响<input v-model="knownImpact"></label></template>
        <label v-if="process==='P009'"><input v-model="emergency" type="checkbox"> 紧急事实登记</label>
      </div>
      <label>原因<textarea v-model="reason"></textarea></label><button :disabled="busy" @click="create">提交</button>
    </section>

    <section v-if="center&&process==='P010'" class="phase09-card" data-testid="p010-create-form">
      <h2>创建学习、考试与资格任务</h2>
      <div class="phase09-grid">
        <label>任务主题<input v-model="subject"></label><label>目标员工 ID<input v-model="targetEmployee"></label>
        <label>内容版本<input v-model="contentVersion"></label><label>课程团队<input v-model="courseTeam"></label>
        <label>课程版本 ID<input v-model="courseVersion"></label><label>周期/课程编号<input v-model="periodNo"></label>
        <label>适用对象<input v-model="learnerProfile"></label><label>风险等级<select v-model="riskLevel"><option>LOW</option><option>NORMAL</option><option>HIGH</option><option>CRITICAL</option></select></label>
        <label>计划开始<input v-model="plannedStart" type="datetime-local"></label><label>计划完成<input v-model="plannedFinish" type="datetime-local"></label>
      </div>
      <label>创建原因<textarea v-model="reason"></textarea></label><button :disabled="busy" @click="create">创建任务</button>
    </section>

    <section class="phase09-card">
      <label>处理/证据说明<input v-model="reason"></label>
      <div v-if="process==='P008'" class="phase09-grid"><label>实际时点<input v-model="actualStart" type="datetime-local"></label><label>差额调整<input v-model="adjustment" type="number" step="0.01"></label></div>
      <div v-if="process==='P009'" class="phase09-grid"><label>实际开始<input v-model="actualStart" type="datetime-local"></label><label>实际结束<input v-model="actualEnd" type="datetime-local"></label><label>考勤事实<input v-model="actualSummary"></label><label>成果验收<input v-model="resultSummary"></label><label>补偿方案<select v-model="compPlan"><option>WAGE</option><option>TIME_OFF</option><option>MIXED</option></select></label><label>工资金额<input v-model="wage" type="number"></label><label>调休账户<input v-model="quotaAccount"></label><label>调休小时<input v-model="timeOff" type="number"></label><label>薪酬回执号<input v-model="payrollRef"></label></div>
      <div v-if="process==='P010'" class="phase09-grid"><label>学习进度 0-100<input v-model="progress" type="number" min="0" max="100"></label><label>考试分 0-1000<input v-model="score" type="number" min="0" max="1000"></label><label>实操结果<select v-model="practical"><option>通过</option><option>补训</option><option>不通过</option><option>不适用</option></select></label><label>资格生效日<input v-model="effectiveDate" type="date"></label><label>资格到期日<input v-model="expireDate" type="date"></label></div>
    </section>

    <p v-if="feedback" class="phase09-feedback">{{feedback}}</p>
    <article v-for="aggregate in rows" :key="aggregate.record.id" class="phase09-card">
      <h2>{{aggregate.record.businessNo}} · {{aggregate.record.subject||'业务事实'}}</h2>
      <p>{{aggregate.record.currentNodeCode}} / {{aggregate.record.status}} · version {{aggregate.record.versionNo}}</p>
      <p v-if="aggregate.record.startAt">{{aggregate.record.startAt}} → {{aggregate.record.endAt}} · {{aggregate.record.durationHours}}h</p>
      <p v-if="process==='P010'">课程 {{aggregate.record.courseVersionId}} · 进度 {{aggregate.record.completionRate??'-'}} · 分数 {{aggregate.record.score1000??'-'}} · 实操 {{aggregate.record.practicalResult??'-'}}</p>
      <template v-if="process==='P010'&&!center"><button v-if="aggregate.record.currentNodeCode==='S03'" :disabled="busy" @click="p010Employee(aggregate,'progress')">提交学习进度</button><button v-if="aggregate.record.currentNodeCode==='S04'" :disabled="busy" @click="p010Employee(aggregate,'exam')">提交考试结果</button><button v-if="aggregate.record.currentNodeCode==='S05'" :disabled="busy" @click="p010Employee(aggregate,'practical')">提交实操结果</button></template>
      <template v-if="center||(process!=='P010'&&['S03','S04','S07','S08'].includes(aggregate.record.currentNodeCode||''))"><button v-for="action in actions[aggregate.record.currentNodeCode||'']||[]" :key="action.code" :disabled="busy" @click="act(aggregate,action.code)">{{action.label}}</button></template>
    </article>
    <section v-if="process==='P008'" class="phase09-card"><h2>额度流水（只增不改）</h2><pre>{{JSON.stringify(ledger,null,2)}}</pre></section>
  </main>
</template>
