import { computed, onMounted, ref } from 'vue'

import { usePortalSessionStore } from '../../../session'

export interface P016MonitorProjection {
  businessNo: string
  currentNodeCode: string
  status: string
}

const MONITOR_PATH = '/api/v1/processes/P016/care-cases/monitor-projections'

function projection(value: unknown): P016MonitorProjection {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('P016_MONITOR_ITEM_INVALID')
  const item = value as Record<string, unknown>
  const keys = Object.keys(item).sort()
  if (keys.join(',') !== 'businessNo,currentNodeCode,status') throw new Error('P016_MONITOR_FIELDS_INVALID')
  for (const key of keys) {
    if (typeof item[key] !== 'string' || !item[key].trim()) throw new Error(`P016_MONITOR_${key}_INVALID`)
  }
  return { businessNo: item.businessNo as string, currentNodeCode: item.currentNodeCode as string, status: item.status as string }
}

export function useP016CareMonitor() {
  const session = usePortalSessionStore()
  const records = ref<P016MonitorProjection[]>([])
  const loading = ref(false)
  const failed = ref(false)
  const canMonitor = computed(() => session.can('p016.welfare.monitor'))

  async function load(): Promise<void> {
    if (!canMonitor.value || loading.value) return
    loading.value = true
    failed.value = false
    try {
      const response = await session.request<unknown>(MONITOR_PATH)
      if (!Array.isArray(response)) throw new Error('P016_MONITOR_ARRAY_INVALID')
      records.value = response.map(projection)
    } catch {
      records.value = []
      failed.value = true
    } finally {
      loading.value = false
    }
  }

  onMounted(() => { if (canMonitor.value) void load() })
  return { records, loading, failed, canMonitor, load }
}
