import {
  P007_ACTIONS_BY_NODE,
  P007_PERMISSIONS,
  type P007ActionCandidate,
  type P007ActionCode,
  type P007NodeCode,
  type P007ScheduleRecord,
} from './contracts'

const labels: Readonly<Record<P007ActionCode, string>> = {
  SUBMIT_DEMAND: '提交需求', WITHDRAW: '撤回', MATCH_TEMPLATE: '匹配班次模板', RETURN: '退回',
  VALIDATE: '校验资格与连续工时', PUBLISH: '发布排班', CONFIRM: '员工确认', REQUEST_CHANGE: '申请换班/替班',
  NO_CHANGE: '无需变更', APPROVE: '批准变更', REJECT: '驳回变更', LINK: '确认联动回执', CLOSE_DAY: '完成日结',
}

function permissionFor(node: P007NodeCode): string {
  if (node === 'S05' || node === 'S06') return P007_PERMISSIONS.change
  if (node === 'S07') return P007_PERMISSIONS.review
  return P007_PERMISSIONS.manage
}

export function selectP007ActionCandidates(
  schedule: P007ScheduleRecord,
  can: (permission: string) => boolean,
): readonly P007ActionCandidate[] {
  const node = schedule.currentNodeCode
  if (node == null || node === 'END' || !can(permissionFor(node))) return []
  return P007_ACTIONS_BY_NODE[node].map(code => ({
    code,
    label: labels[code],
    authority: 'ux-candidate' as const,
    blocked: code === 'REQUEST_CHANGE',
    ...(code === 'REQUEST_CHANGE' ? { blockedCode: 'DIRECTORY_CONTRACT_REQUIRED' as const } : {}),
  }))
}
