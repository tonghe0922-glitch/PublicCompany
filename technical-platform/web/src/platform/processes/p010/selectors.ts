import {
  P010_ACTIONS_BY_NODE,
  P010_PERMISSIONS,
  type P010ActionCandidate,
  type P010ActionCode,
  type P010LearningRecord,
  type P010NodeCode,
} from './contracts'

const labels: Readonly<Record<P010ActionCode, string>> = {
  PUBLISH: '发布版本', ASSIGN: '分配学习', COMPLETE_LEARNING: '完成学习', SUBMIT_EXAM: '提交考试',
  RECORD_PRACTICAL: '记录实操', CERTIFY: '专业认证', ACTIVATE: '激活资格',
  LINK_PERMISSION: '关联权限', SCHEDULE_RECERTIFICATION: '安排复训', ARCHIVE: '归档关闭',
}

function permissionFor(node: P010NodeCode): string {
  if (node === 'S03') return P010_PERMISSIONS.complete
  if (node === 'S04') return P010_PERMISSIONS.exam
  if (node === 'S05' || node === 'S06') return P010_PERMISSIONS.certify
  if (node === 'S08') return P010_PERMISSIONS.link
  return P010_PERMISSIONS.manage
}

export function selectP010ActionCandidates(
  learning: P010LearningRecord,
  can: (permission: string) => boolean,
): readonly P010ActionCandidate[] {
  const node = learning.currentNodeCode
  if (node == null || node === 'END' || !can(permissionFor(node))) return []
  return P010_ACTIONS_BY_NODE[node].map(code => ({ code, label: labels[code], authority: 'ux-candidate' as const }))
}
