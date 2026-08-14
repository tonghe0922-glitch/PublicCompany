import {
  P008_ACTIONS_BY_NODE,
  P008_PERMISSIONS,
  type P008ActionCandidate,
  type P008ActionCode,
  type P008LeaveRecord,
  type P008NodeCode,
} from './contracts'

const labels: Readonly<Record<P008ActionCode, string>> = {
  SUBMIT: '提交请假', WITHDRAW: '撤回申请', RESERVE: '预占额度', RETURN: '返回或销假',
  CONFIRM_HANDOVER: '确认交接', APPROVE: '批准请假', REJECT: '驳回请假', DEDUCT: '转为扣减',
  RELEASE: '释放额度', MARK_ATTENDANCE: '标记排班考勤', START_LEAVE: '记录开始休假',
  EARLY_RETURN: '提前返岗', CHANGE: '变更请假', ADJUST: '调整差额账本', CLOSE_DAY: '考勤日结归档',
}

function permissionFor(node: P008NodeCode): string {
  if (node === 'S01' || node === 'S03' || node === 'S08') return P008_PERMISSIONS.submit
  if (node === 'S04') return P008_PERMISSIONS.review
  return P008_PERMISSIONS.manage
}

export function selectP008ActionCandidates(
  leave: P008LeaveRecord,
  can: (permission: string) => boolean,
): readonly P008ActionCandidate[] {
  const node = leave.currentNodeCode
  if (node == null || node === 'END' || !can(permissionFor(node))) return []
  return P008_ACTIONS_BY_NODE[node].map(code => ({ code, label: labels[code], authority: 'ux-candidate' as const }))
}
