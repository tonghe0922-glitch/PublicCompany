import {
  P006_ACTIONS_BY_NODE,
  type P006ActionCandidate,
  type P006ActionCode,
  type P006MeetingRecord,
  type P006NodeCode,
} from './contracts'

const labels: Readonly<Record<P006ActionCode, string>> = {
  SUBMIT: '提交', WITHDRAW: '撤回', ACCEPT: '受理', RETURN: '退回', REJECT: '驳回', PUBLISH: '发布',
  RECORD_ATTENDANCE: '登记出席', CONVENE: '召开会议', CONFIRM_MINUTES: '确认纪要', GENERATE_ACTIONS: '生成行动项',
  SUBMIT_EXECUTION: '提交执行', ACCEPT_RESULT: '验收结果', REWORK: '返工', ACKNOWLEDGE_OVERDUE: '确认逾期', ARCHIVE: '归档',
}

function permissionFor(node: P006NodeCode, action: P006ActionCode): string {
  if (node === 'S01' && (action === 'SUBMIT' || action === 'WITHDRAW')) return 'p006.meeting.create'
  if (node === 'S09') return 'p006.meeting.accept'
  if (node === 'S04' || node === 'S08') return 'p006.meeting.action'
  return 'p006.meeting.manage'
}

export function selectP006ActionCandidates(
  meeting: P006MeetingRecord,
  can: (permission: string) => boolean,
): readonly P006ActionCandidate[] {
  const node = meeting.currentNodeCode
  if (node == null || node === 'END') return []
  return P006_ACTIONS_BY_NODE[node]
    .filter((action) => can(permissionFor(node, action)))
    .map((action) => ({
      code: action,
      label: labels[action],
      authority: 'ux-candidate' as const,
      blocked: action === 'GENERATE_ACTIONS',
      ...(action === 'GENERATE_ACTIONS' ? { blockedCode: 'DIRECTORY_CONTRACT_REQUIRED' as const } : {}),
    }))
}
