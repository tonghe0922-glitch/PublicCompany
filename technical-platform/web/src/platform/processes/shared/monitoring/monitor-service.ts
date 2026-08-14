import type {
  MonitorProcessCode,
  MonitorProjection,
  MonitorRequestContext,
  MonitorService,
  MonitorTransport,
} from '../../../../contracts'
import { usePortalSessionStore } from '../../../../session'

const P004_PATH = '/api/v1/processes/P004/monitor-projections'
const P005_PATH = '/api/v1/processes/P005/monitor-projections'

function objectValue(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('MONITOR_PROJECTION_ITEM_INVALID')
  }
  return value as Record<string, unknown>
}

function fieldCode(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()
}

function textValue(source: Record<string, unknown>, key: string): string {
  const value = source[key]
  if (typeof value !== 'string' || !value.trim()) throw new Error(`MONITOR_PROJECTION_${fieldCode(key)}_INVALID`)
  return value
}

function integerValue(source: Record<string, unknown>, key: string): number {
  const value = source[key]
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`MONITOR_PROJECTION_${fieldCode(key)}_INVALID`)
  }
  return value
}

function mapProjection(value: unknown, processCode: MonitorProcessCode): MonitorProjection {
  const source = objectValue(value)
  if (textValue(source, 'processCode') !== processCode) throw new Error('MONITOR_PROJECTION_PROCESS_CODE_INVALID')
  const common = {
    recordId: textValue(source, 'recordId'),
    businessNo: textValue(source, 'businessNo'),
    processCode,
    currentNodeCode: textValue(source, 'currentNodeCode'),
    status: textValue(source, 'status'),
    versionNo: integerValue(source, 'versionNo'),
    updatedAt: textValue(source, 'updatedAt'),
  }
  if (processCode === 'P004') return common
  return { ...common, approvedCount: integerValue(source, 'approvedCount') }
}

function mapList(value: unknown, processCode: MonitorProcessCode): readonly MonitorProjection[] {
  if (!Array.isArray(value)) throw new Error('MONITOR_PROJECTION_ARRAY_INVALID')
  return value.map(item => mapProjection(item, processCode))
}

export function createMonitorService(transport: MonitorTransport): MonitorService {
  async function list(path: string, processCode: MonitorProcessCode, context: MonitorRequestContext) {
    const response = await transport.request<unknown>(path, { signal: context.signal })
    return mapList(response, processCode)
  }
  return {
    listP004: context => list(P004_PATH, 'P004', context),
    listP005: context => list(P005_PATH, 'P005', context),
  }
}

export function createMonitorPortalService(): MonitorService {
  const session = usePortalSessionStore()
  const service = createMonitorService(session)
  return {
    listP004: context => session.can('p004.request.read') ? service.listP004(context) : Promise.resolve([]),
    listP005: context => session.can('p005.notice.monitor') ? service.listP005(context) : Promise.resolve([]),
  }
}
