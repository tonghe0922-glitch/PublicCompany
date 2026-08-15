export interface ProcessCommandActor {
  tenantId: string
  userId: string
  identityId: string
}

export interface ProcessCommandSession {
  session?: ProcessCommandActor | null
}

export interface ProcessCommandDescriptor {
  stateKey: string
  recordLockKey: string
  operationKey: string
  actor: ProcessCommandActor
  payload: unknown
}

export type ProcessCommandOutcome = 'pending' | 'unknown' | 'confirmed' | 'rejected'

export interface ProcessCommandAttemptView {
  idempotencyKey: string
  outcome: ProcessCommandOutcome
  payloadHash: string
}

interface JournalEntry extends ProcessCommandAttemptView {
  actorKey: string
  recordLockKey: string
  operationKey: string
}

export interface ProcessCommandLease {
  entry: JournalEntry
  idempotencyKey: string
}

export type ProcessCommandStart =
  | { acquired: true; lease: ProcessCommandLease }
  | { acquired: false; attempt?: ProcessCommandAttemptView }

const attempts = new Map<string, JournalEntry>()
const recordLocks = new Map<string, JournalEntry>()
const reservationTails = new Map<string, Promise<void>>()
const reservationCounts = new Map<string, number>()

interface RecordReservation {
  wait?: Promise<void>
  release: () => void
}

function required(value: string, name: string): string {
  const normalized = value.trim()
  if (!normalized) throw new TypeError(`${name} must not be blank`)
  return normalized
}

function actorKey(actor: ProcessCommandActor): string {
  return JSON.stringify([
    required(actor.tenantId, 'tenantId'),
    required(actor.userId, 'userId'),
    required(actor.identityId, 'identityId'),
  ])
}

function canonicalObject(value: object, seen: Set<object>): string {
  if (seen.has(value)) throw new TypeError('Command payload must not contain cycles')
  const prototype: unknown = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) {
    throw new TypeError('Command payload must contain JSON-compatible values only')
  }
  seen.add(value)
  try {
    if (Array.isArray(value)) return `[${value.map(item => canonicalValue(item, seen)).join(',')}]`
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalValue(record[key], seen)}`).join(',')}}`
  } finally {
    seen.delete(value)
  }
}

function canonicalValue(value: unknown, seen: Set<object>): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (typeof value === 'object') return canonicalObject(value, seen)
  throw new TypeError('Command payload must contain JSON-compatible values only')
}

export async function canonicalPayloadHash(payload: unknown): Promise<string> {
  const canonical = canonicalValue(payload, new Set())
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonical),
  )
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export function processCommandActor(session: ProcessCommandSession): ProcessCommandActor {
  if (!session.session) throw new TypeError('Authenticated command actor is required')
  return {
    tenantId: session.session.tenantId,
    userId: session.session.userId,
    identityId: session.session.identityId,
  }
}

function attemptKey(actor: string, operationKey: string, payloadHash: string): string {
  return JSON.stringify([actor, required(operationKey, 'operationKey'), payloadHash])
}

function lockKey(actor: string, recordLockKey: string): string {
  return JSON.stringify([actor, required(recordLockKey, 'recordLockKey')])
}

function reserveRecord(key: string): RecordReservation {
  const wait = reservationTails.get(key)
  let finish!: () => void
  const tail = new Promise<void>(resolve => { finish = resolve })
  reservationTails.set(key, tail)
  reservationCounts.set(key, (reservationCounts.get(key) ?? 0) + 1)
  let released = false
  return {
    wait,
    release: () => {
      if (released) return
      released = true
      const remaining = (reservationCounts.get(key) ?? 1) - 1
      if (remaining === 0) reservationCounts.delete(key)
      else reservationCounts.set(key, remaining)
      if (remaining === 0 && reservationTails.get(key) === tail) reservationTails.delete(key)
      finish()
    },
  }
}

function view(entry: JournalEntry): ProcessCommandAttemptView {
  return {
    idempotencyKey: entry.idempotencyKey,
    outcome: entry.outcome,
    payloadHash: entry.payloadHash,
  }
}

export async function beginProcessCommand(command: ProcessCommandDescriptor): Promise<ProcessCommandStart> {
  const actor = actorKey(command.actor)
  const operation = required(command.operationKey, 'operationKey')
  const record = required(command.recordLockKey, 'recordLockKey')
  const recordKey = lockKey(actor, record)
  const reservation = reserveRecord(recordKey)
  if (reservation.wait) await reservation.wait
  try {
    const pending = recordLocks.get(recordKey)
    if (pending?.outcome === 'pending') return { acquired: false, attempt: view(pending) }
    const payloadHash = await canonicalPayloadHash(command.payload)
    const locked = recordLocks.get(recordKey)
    if (locked) {
      if (locked.operationKey !== operation || locked.payloadHash !== payloadHash || locked.outcome !== 'unknown') {
        return { acquired: false, attempt: view(locked) }
      }
      locked.outcome = 'pending'
      return { acquired: true, lease: { entry: locked, idempotencyKey: locked.idempotencyKey } }
    }
    const entry: JournalEntry = {
      actorKey: actor, recordLockKey: record, operationKey: operation, payloadHash,
      idempotencyKey: globalThis.crypto.randomUUID(), outcome: 'pending',
    }
    attempts.set(attemptKey(actor, operation, payloadHash), entry)
    recordLocks.set(recordKey, entry)
    return { acquired: true, lease: { entry, idempotencyKey: entry.idempotencyKey } }
  } finally {
    reservation.release()
  }
}

export function settleProcessCommand(
  lease: ProcessCommandLease,
  outcome: Exclude<ProcessCommandOutcome, 'pending'>,
): void {
  const { entry } = lease
  entry.outcome = outcome
  if (outcome === 'unknown') return
  attempts.delete(attemptKey(entry.actorKey, entry.operationKey, entry.payloadHash))
  const key = lockKey(entry.actorKey, entry.recordLockKey)
  if (recordLocks.get(key) === entry) recordLocks.delete(key)
}

export function processRecordPending(actor: ProcessCommandActor, recordLockKey: string): boolean {
  const key = lockKey(actorKey(actor), recordLockKey)
  return recordLocks.has(key) || (reservationCounts.get(key) ?? 0) > 0
}

export async function findProcessCommand(
  actor: ProcessCommandActor,
  operationKey: string,
  payload: unknown,
): Promise<ProcessCommandAttemptView | undefined> {
  const key = attemptKey(actorKey(actor), operationKey, await canonicalPayloadHash(payload))
  const entry = attempts.get(key)
  return entry ? view(entry) : undefined
}
