import type { ApiRequestOptions } from '../../api'

export interface ProcessRequester {
  request<TResponse, TBody = unknown>(
    path: string,
    options?: ApiRequestOptions<TBody>,
  ): Promise<TResponse>
}

export interface ProcessActionBody {
  expectedVersion: number
  [key: string]: unknown
}

export interface ProcessRequestContext {
  signal: AbortSignal
}

export function idempotencyKey(scope: string): string {
  return `${scope}-${globalThis.crypto.randomUUID()}`
}

export function listProcessRecords<T>(
  requester: ProcessRequester,
  path: string,
  context?: ProcessRequestContext,
): Promise<T[]> {
  return context
    ? requester.request<T[]>(path, { signal: context.signal })
    : requester.request<T[]>(path)
}

export function createProcessRecord<TResponse, TBody>(
  requester: ProcessRequester,
  path: string,
  scope: string,
  body: TBody,
  context?: ProcessRequestContext,
): Promise<TResponse> {
  return requester.request<TResponse, TBody>(path, {
    method: 'POST',
    idempotencyKey: idempotencyKey(scope),
    body,
    ...(context ? { signal: context.signal } : {}),
  })
}

export function executeProcessAction<TResponse, TBody extends ProcessActionBody>(
  requester: ProcessRequester,
  collectionPath: string,
  recordId: string,
  actionCode: string,
  scope: string,
  body: TBody,
  context?: ProcessRequestContext,
): Promise<TResponse> {
  return requester.request<TResponse, TBody>(
    `${collectionPath}/${recordId}/actions/${actionCode}`,
    {
      method: 'POST',
      idempotencyKey: idempotencyKey(scope),
      body,
      ...(context ? { signal: context.signal } : {}),
    },
  )
}
