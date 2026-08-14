import {
  P009_ACTIONS_BY_NODE,
  P009_PERMISSIONS,
  type P009ActionCandidate,
  type P009ActionCode,
  type P009NodeCode,
  type P009OvertimeRecord,
} from './contracts'

const labels: Readonly<Record<P009ActionCode, string>> = {
  SUBMIT: '提交加班', WITHDRAW: '撤回申请', VALIDATE: '校验必要性', RETURN: '退回申请',
  APPROVE: '批准加班', REJECT: '驳回加班', RECORD_FACT: '记录实际劳动事实',
  ACCEPT_RESULT: '验收成果', REWORK: '退回返工', HR_CONFIRM: '人事确认方案', HR_RETURN: '人事退回',
  CONFIRM_SCHEME: '确认补偿方案', RECORD_RECEIPT: '登记外部回执', ARCHIVE: '归档关闭',
}

function permissionFor(node: P009NodeCode): string {
  if (node === 'S01' || node === 'S07') return P009_PERMISSIONS.submit
  if (node === 'S03' || node === 'S05') return P009_PERMISSIONS.review
  if (node === 'S06' || node === 'S08') return P009_PERMISSIONS.hr
  return P009_PERMISSIONS.manage
}

export function selectP009ActionCandidates(
  overtime: P009OvertimeRecord,
  can: (permission: string) => boolean,
): readonly P009ActionCandidate[] {
  const node = overtime.currentNodeCode
  if (node == null || node === 'END' || !can(permissionFor(node))) return []
  return P009_ACTIONS_BY_NODE[node].map(code => ({ code, label: labels[code], authority: 'ux-candidate' as const }))
}
