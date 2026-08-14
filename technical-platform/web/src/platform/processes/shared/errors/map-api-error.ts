import type { UiError, UiErrorKind } from './ui-error'

interface ErrorProjection {
  status?: number
  code?: string
  requestId?: string
  fieldErrors?: readonly { field: string; message: string }[]
  expectedVersion?: number
  currentVersion?: number
}

const stable: Record<number, { kind: UiErrorKind; title: string; userMessage: string; nextAction: string }> = {
  401: { kind: 'unauthorized', title: '登录状态已失效', userMessage: '请重新登录后继续。', nextAction: '重新登录' },
  403: { kind: 'forbidden', title: '操作未获授权', userMessage: '当前身份无权完成此操作', nextAction: '返回或联系授权负责人' },
  404: { kind: 'not-found', title: '记录不可用', userMessage: '请求的业务记录不存在或不可见', nextAction: '刷新列表' },
  408: { kind: 'timeout', title: '请求超时', userMessage: '请求超时，请确认网络后重试', nextAction: '重试' },
  409: { kind: 'conflict', title: '数据版本冲突', userMessage: '记录已被更新，请比较最新版本后继续。', nextAction: '查看最新版本' },
  422: { kind: 'validation', title: '提交内容需修正', userMessage: '部分字段未通过校验，请检查后重试。', nextAction: '修正字段' },
  429: { kind: 'rate-limit', title: '操作过于频繁', userMessage: '请求过于频繁，请稍后重试。', nextAction: '稍后重试' },
}

export function mapApiError(cause: unknown): UiError {
  const value = typeof cause === 'object' && cause !== null ? cause as ErrorProjection : {}
  const status = typeof value.status === 'number' ? value.status : undefined
  const known = status == null ? undefined : stable[status]
  const fallback = status != null && status >= 500
    ? { kind: 'server' as const, title: '服务暂不可用', userMessage: '服务暂时无法完成请求，请稍后重试。', nextAction: '稍后重试' }
    : { kind: 'unknown' as const, title: '操作未完成', userMessage: '当前操作未完成，请重试或联系支持人员。', nextAction: '重试' }
  const presentation = known ?? fallback
  return {
    ...presentation,
    status,
    code: value.code,
    requestId: value.requestId,
    fieldErrors: value.fieldErrors,
    expectedVersion: value.expectedVersion,
    currentVersion: value.currentVersion,
  }
}
