<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { usePortalSessionStore } from '../../session'
import type { PortalDefinition } from '../portal-config'

type Mode = 'employee' | 'center'
interface MeetingItem { id:string; meetingId:string; fieldCode:string; itemSeq:number; itemName:string|null; itemValueText:string|null; relatedObjectId:string|null; actionOwnerEmployeeId:string|null; actionDueAt:string|null; actionStatus:string|null; executionEvidence:string|null; completedAt:string|null; acceptedAt:string|null; acceptedBy:string|null; reworkCount:number; escalatedAt:string|null; versionNo:number }
interface Meeting { id:string; tenantId:string; businessNo:string; workflowInstanceId:string|null; workflowInstanceNo:string|null; currentNodeCode:string|null; status:string; versionNo:number; officialSubject:string|null; officialType:string|null; officialContent:string|null; attendanceType:string|null; employeeEventType:string|null; issuerHostId:string|null; visibilityLevel:string|null; venueChannel:string|null; ownerCenterId:string|null; ownerEmployeeId:string|null; businessDate:string|null; startAt:string|null; publishedAt:string|null; minutesText:string|null; minutesConfirmedAt:string|null; archivedAt:string|null; actualEndAt:string|null; updatedAt:string|null }
interface MeetingAggregate { meeting:Meeting; items:MeetingItem[] }
interface ActionItemDraft { title:string; ownerEmployeeId:string; dueAt:string }
const props=defineProps<{portal:PortalDefinition;mode:Mode}>()
const session=usePortalSessionStore()
const views=ref<MeetingAggregate[]>([]), busy=ref(false), feedback=ref('')
const subject=ref(''), content=ref(''), venue=ref(''), startAt=ref(''), visibility=ref('内部'), attendanceType=ref('现场'), participants=ref(''), agenda=ref('')
const minutes=ref(''), actionTitle=ref(''), actionOwner=ref(''), actionDueAt=ref(''), actionEvidence=ref(''), reason=ref('')
const isCenter=computed(()=>props.mode==='center')
const canCreate=computed(()=>session.can('p006.meeting.create')), canManage=computed(()=>session.can('p006.meeting.manage'))
const canAccept=computed(()=>session.can('p006.meeting.accept')), canAction=computed(()=>session.can('p006.meeting.action'))
const canRead=computed(()=>session.can('p006.meeting.read')||canManage.value)
const orgId=computed(()=>session.session?.orgId??'')
const employeeId=computed(()=>session.session?.employeeId??'')
function items(v:MeetingAggregate,kind:string){return v.items.filter(x=>x.fieldCode===kind)}
function agendaItems(v:MeetingAggregate){return items(v,'AGENDA')}
function actionItems(v:MeetingAggregate){return items(v,'ACTION_ITEM')}
function ownActionItems(v:MeetingAggregate){return actionItems(v).filter(x=>x.actionOwnerEmployeeId===employeeId.value)}
function ownParticipant(v:MeetingAggregate){return items(v,'PARTICIPANT').find(x=>x.relatedObjectId===employeeId.value)??null}
function idem(p:string){return `${p}-${globalThis.crypto.randomUUID()}`}
function iso(v:string){if(!v.trim())return null;const d=new Date(v);if(Number.isNaN(d.getTime()))throw new Error('日期时间格式无效');return d.toISOString()}
function ids(v:string){return [...new Set(v.split(/[\s,，;；]+/).map(x=>x.trim()).filter(Boolean))]}
async function run(fn:()=>Promise<void>){busy.value=true;feedback.value='';try{await fn()}catch(e){feedback.value=e instanceof Error?e.message:'操作失败'}finally{busy.value=false}}
async function load(){if(!canRead.value&&!canAction.value&&!canAccept.value){views.value=[];return}views.value=await session.request<MeetingAggregate[]>('/api/v1/processes/P006/meetings')}
function createMeeting(){return run(async()=>{if(!canCreate.value)throw new Error('没有会议创建权限');if(!orgId.value)throw new Error('当前会话缺少中心');const starts=iso(startAt.value);if(!starts)throw new Error('会议时间必填');const body={officialSubject:subject.value.trim(),officialType:'会议',officialContent:content.value.trim(),attendanceType:attendanceType.value,visibilityLevel:visibility.value,venueChannel:venue.value.trim()||null,ownerCenterId:orgId.value,businessDate:new Date().toISOString().slice(0,10),startAt:starts,participantEmployeeIds:ids(participants.value),agendaItems:agenda.value.split('\n').map(x=>x.trim()).filter(Boolean)};const result=await session.request<MeetingAggregate,typeof body>('/api/v1/processes/P006/meetings',{method:'POST',idempotencyKey:idem('p006-create'),body});feedback.value=`已创建 ${result.meeting.businessNo}，进入材料完整性检查`;subject.value='';content.value='';await load()})}
function manage(v:MeetingAggregate,actionCode:string){return run(async()=>{const actionDrafts:ActionItemDraft[]|null=actionCode==='GENERATE_ACTION_ITEMS'?[{title:actionTitle.value.trim(),ownerEmployeeId:actionOwner.value.trim(),dueAt:iso(actionDueAt.value)!}]:null;const body={expectedVersion:v.meeting.versionNo,minutesText:actionCode==='CONFIRM_MINUTES'?minutes.value.trim():null,actionItems:actionDrafts,actionEvidence:null,actionItemIds:null,reason:reason.value.trim()||null};await session.request(`/api/v1/processes/P006/meetings/${v.meeting.id}/actions/${actionCode}`,{method:'POST',idempotencyKey:idem(`p006-${actionCode.toLowerCase()}`),body});feedback.value=`${v.meeting.businessNo} 已执行 ${actionCode}`;await load()})}
function attendance(v:MeetingAggregate,action:string){return run(async()=>{const body={expectedVersion:v.meeting.versionNo,minutesText:null,actionItems:null,actionEvidence:null,actionItemIds:null,reason:null};await session.request(`/api/v1/processes/P006/meetings/${v.meeting.id}/actions/${action}`,{method:'POST',idempotencyKey:idem(`p006-${action.toLowerCase()}`),body});await load()})}
function evidence(v:MeetingAggregate,item:MeetingItem){return run(async()=>{if(!actionEvidence.value.trim())throw new Error('执行证据不能为空');const body={expectedVersion:v.meeting.versionNo,minutesText:null,actionItems:null,actionEvidence:{[item.id]:actionEvidence.value.trim()},actionItemIds:null,reason:null};await session.request(`/api/v1/processes/P006/meetings/${v.meeting.id}/actions/SUBMIT_ACTION_EVIDENCE`,{method:'POST',idempotencyKey:idem('p006-evidence'),body});actionEvidence.value='';await load()})}
function rework(v:MeetingAggregate,item:MeetingItem){return run(async()=>{const body={expectedVersion:v.meeting.versionNo,minutesText:null,actionItems:null,actionEvidence:null,actionItemIds:[item.id],reason:reason.value.trim()||'返工'};await session.request(`/api/v1/processes/P006/meetings/${v.meeting.id}/actions/RETURN_ACTIONS`,{method:'POST',idempotencyKey:idem('p006-rework'),body});await load()})}
const centerActions:Record<string,{code:string;label:string}[]>={S02:[{code:'CONFIRM_MATERIALS',label:'确认材料完整'}],S03:[{code:'PUBLISH_MEETING',label:'发布会议'}],S05:[{code:'COMPLETE_MEETING',label:'结束会议'}],S06:[{code:'CONFIRM_MINUTES',label:'确认纪要'}],S07:[{code:'GENERATE_ACTION_ITEMS',label:'生成行动项'}],S09:[{code:'ACCEPT_ACTIONS',label:'验收全部行动项'}],S10:[{code:'RESOLVE_OVERDUE',label:'确认逾期升级事实'}],S11:[{code:'ARCHIVE',label:'归档复盘并关闭'}]}
function canCenterAction(code:string){return code==='ACCEPT_ACTIONS'?canAccept.value:canManage.value}
function stamp(v:string|null){return v?new Date(v).toLocaleString():'-'}
onMounted(()=>void run(load))
</script>
<template>
<main class="phase09-page" data-testid="p006-page">
<header><p class="phase09-kicker">PHASE-10 · P006</p><h1>{{ isCenter?'会议与行动项管理':'我的会议与行动项' }}</h1><p>状态、会议纪要、行动项、验收与返工均来自服务端 canonical meeting / meeting_item。</p></header>
<section v-if="isCenter" class="phase09-card"><h2>创建会议议题</h2><div class="phase09-grid"><label>主题<input v-model="subject"></label><label>召开时间<input v-model="startAt" type="datetime-local"></label><label>地点/渠道<input v-model="venue"></label><label>参会员工 UUID（逗号分隔）<input v-model="participants"></label><label>出席类型<input v-model="attendanceType"></label><label>可见范围<select v-model="visibility"><option>内部</option><option>公开</option><option>秘密</option><option>机密</option></select></label></div><label>议题正文<textarea v-model="content" rows="3"></textarea></label><label>议题清单（每行一项）<textarea v-model="agenda" rows="3"></textarea></label><button :disabled="busy||!canCreate" @click="createMeeting">创建会议</button></section>
<p v-if="feedback" class="phase09-feedback">{{ feedback }}</p>
<section v-for="v in views" :key="v.meeting.id" class="phase09-card" :data-meeting-id="v.meeting.id"><h2>{{ v.meeting.businessNo }} · {{ v.meeting.officialSubject||'会议运行元数据' }}</h2><p>节点 {{ v.meeting.currentNodeCode }} / {{ v.meeting.status }} · version {{ v.meeting.versionNo }} · {{ stamp(v.meeting.startAt) }}</p><p v-if="v.meeting.officialContent">{{ v.meeting.officialContent }}</p>
<div v-if="agendaItems(v).length"><strong>议题</strong><ul><li v-for="x in agendaItems(v)" :key="x.id">{{ x.itemName }}</li></ul></div>
<div v-if="!isCenter&&v.meeting.currentNodeCode==='S04'&&canAction&&ownParticipant(v)?.actionStatus==='PENDING'"><button :disabled="busy" @click="attendance(v,'ATTEND')">签到</button><button :disabled="busy" @click="attendance(v,'LEAVE')">请假</button></div>
<div v-if="isCenter&&v.meeting.currentNodeCode==='S06'"><label>会议纪要<textarea v-model="minutes" rows="4"></textarea></label></div>
<div v-if="isCenter&&v.meeting.currentNodeCode==='S07'" class="phase09-grid"><label>行动项<input v-model="actionTitle"></label><label>责任人 UUID<input v-model="actionOwner"></label><label>计划完成时间<input v-model="actionDueAt" type="datetime-local"></label></div>
<div v-if="actionItems(v).length"><strong>行动项</strong><article v-for="x in actionItems(v)" :key="x.id" class="phase09-subcard"><p>{{ x.itemName }} · {{ x.actionStatus }} · 截止 {{ stamp(x.actionDueAt) }} · 返工 {{ x.reworkCount }} 次</p><p v-if="x.executionEvidence">证据：{{ x.executionEvidence }}</p><template v-if="!isCenter&&v.meeting.currentNodeCode==='S08'&&canAction&&ownActionItems(v).some(i=>i.id===x.id)"><input v-model="actionEvidence" placeholder="执行证据/结果摘要"><button :disabled="busy" @click="evidence(v,x)">提交执行证据</button></template><button v-if="isCenter&&v.meeting.currentNodeCode==='S09'&&canAccept&&x.actionStatus==='EXECUTED'" :disabled="busy" @click="rework(v,x)">退回返工</button></article></div>
<div v-if="isCenter"><label>处理说明<input v-model="reason"></label><button v-for="a in centerActions[v.meeting.currentNodeCode||'']||[]" :key="a.code" :disabled="busy||!canCenterAction(a.code)" @click="manage(v,a.code)">{{ a.label }}</button><button type="button" :disabled="busy" @click="load">刷新</button></div>
<button v-else type="button" :disabled="busy" @click="load">刷新</button>
</section></main>
</template>
