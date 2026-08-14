export interface AsyncRequestContext {
  signal: AbortSignal
  requestId: string
}

export interface AsyncActionContext<TInput> extends AsyncRequestContext {
  input: TInput
  idempotencyKey: string
}

export interface AsyncActionExecution {
  /** Business idempotency truth is caller-owned. The hook only forwards it. */
  idempotencyKey: string
}
