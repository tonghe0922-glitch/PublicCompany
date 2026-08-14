// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { AsyncState } from '@sgj/platform-ui'

import type { P010LearningRecord } from './contracts'
import type { PortalDefinition } from '../../portal-config'

const harness = vi.hoisted(() => ({ process: undefined as unknown as Record<string, unknown>, records: [] as P010LearningRecord[] }))

vi.mock('../../../session', () => ({
  usePortalSessionStore: () => ({ can: () => true, request: vi.fn().mockResolvedValue([]) }),
}))

vi.mock('./index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./index')>()
  const { ref } = await import('vue')
  const record: P010LearningRecord = {
    id: 'learning-1', tenantId: 'tenant-1', businessNo: 'P010-2026-0001', workflowInstanceId: 'workflow-1',
    workflowInstanceNo: 'WF-P010-1', currentNodeCode: 'S01', status: 'Version publication', versionNo: 1,
    businessDate: '2026-08-14', subject: '高风险作业资格课程', reason: '岗位风险矩阵要求资格持续有效',
    ownerCenterId: 'center-1', ownerEmployeeId: 'employee-1', courseVersionId: 'SAFETY-V1',
    contentVersion: '2026.08', courseTeamName: '安全作业学院', periodOrCourseNo: 'SAFE-001',
    learnerProfile: '高风险岗位作业人员', completionRate: 0, score1000: 886, practicalResult: 'PASS',
    qualificationEffectiveDate: '2026-08-15', qualificationExpireDate: '2027-08-14', events: [],
    updatedAt: '2026-08-14T03:00:00Z',
  }
  harness.records = [record, { ...record, id: 'learning-2', businessNo: 'P010-2026-0002', versionNo: 5, subject: '第二条学习任务' }]
  const recordsState = ref<AsyncState<readonly P010LearningRecord[]>>({ phase: 'success', data: harness.records, requestId: 'records-1' })
  const actionState = ref<AsyncState<P010LearningRecord>>({ phase: 'idle' })
  harness.process = {
    records: { state: recordsState }, action: { state: actionState },
    can: vi.fn(() => true), canRead: vi.fn(() => true),
    refresh: vi.fn(() => Promise.resolve(harness.records)), performAction: vi.fn(() => Promise.resolve(undefined)),
  }
  return { ...actual, useP010Learning: () => harness.process }
})

import pageSource from '../../pages/P010LearningPage.vue?raw'
import P010LearningPage from '../../pages/P010LearningPage.vue'

type ProcessHarness = {
  records: { state: { value: AsyncState<readonly P010LearningRecord[]> } }
  action: { state: { value: AsyncState<P010LearningRecord> } }
  refresh: Mock<() => Promise<readonly P010LearningRecord[]>>
  performAction: Mock<(id: string, code: string, command: unknown, key: string) => Promise<P010LearningRecord | undefined>>
}

function processHarness(): ProcessHarness { return harness.process as unknown as ProcessHarness }
const portal: PortalDefinition = { code: 'center', runtimeCode: 'center', title: '中心端', description: '', homeTitle: '', homeFocus: [] }

beforeEach(() => {
  if (harness.process == null) {
    const record: P010LearningRecord = {
      id: 'learning-1', tenantId: 'tenant-1', businessNo: 'P010-2026-0001', workflowInstanceId: 'workflow-1',
      workflowInstanceNo: 'WF-P010-1', currentNodeCode: 'S01', status: 'Version publication', versionNo: 1,
      businessDate: '2026-08-14', subject: '高风险作业资格课程', reason: '岗位风险矩阵要求资格持续有效',
      ownerCenterId: 'center-1', ownerEmployeeId: 'employee-1', courseVersionId: 'SAFETY-V1',
      contentVersion: '2026.08', courseTeamName: '安全作业学院', periodOrCourseNo: 'SAFE-001',
      learnerProfile: '高风险岗位作业人员', completionRate: 0, score1000: 886, practicalResult: 'PASS',
      qualificationEffectiveDate: '2026-08-15', qualificationExpireDate: '2027-08-14', events: [],
      updatedAt: '2026-08-14T03:00:00Z',
    }
    harness.records = [record, { ...record, id: 'learning-2', businessNo: 'P010-2026-0002', versionNo: 5, subject: '第二条学习任务' }]
    harness.process = {
      records: { state: ref<AsyncState<readonly P010LearningRecord[]>>({ phase: 'success', data: harness.records }) },
      action: { state: ref<AsyncState<P010LearningRecord>>({ phase: 'idle' }) },
      can: vi.fn(() => true), canRead: vi.fn(() => true),
      refresh: vi.fn(() => Promise.resolve(harness.records)), performAction: vi.fn(),
    }
  }
  const process = processHarness()
  process.records.state.value = { phase: 'success', data: harness.records, requestId: 'records-reset' }
  process.action.state.value = { phase: 'idle' }
  process.refresh.mockReset().mockResolvedValue(harness.records)
  process.performAction.mockReset().mockResolvedValue(undefined)
})

describe('P010 thin page contract', () => {
  it('assembles only the p010 public index and public UI packages', () => {
    expect(pageSource).toContain("from '../processes/p010'")
    expect(pageSource).not.toMatch(/from ['"][^'"]*processes\/p010\//)
    expect(pageSource).not.toContain('usePortalSessionStore')
    expect(pageSource).not.toContain('session.request')
    expect(pageSource).not.toContain('/api/')
    expect(pageSource).not.toContain('JSON.stringify')
    expect(pageSource).not.toMatch(/p010\.learning\.(read|complete|exam|manage|certify|link|monitor)/)
    expect(pageSource).not.toMatch(/<(button|input|select|textarea)\b/)
    expect(pageSource).not.toMatch(/createLearning|creation|ownerEmployeeId/)
  })

  it('loads server facts and exposes only the visible blocked create projection', () => {
    const process = processHarness()
    const wrapper = mount(P010LearningPage, { props: { portal, mode: 'center' } })
    expect(process.refresh).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-owner-directory-blocked]').text()).toContain('BLOCKED_BY_CONTRACT')
    expect(wrapper.find('[data-submit-create]').exists()).toBe(false)
    expect(harness.process).not.toHaveProperty('createLearning')
    expect(harness.process).not.toHaveProperty('creation')
  })

  it('passes the same authoritative server records to desktop/mobile selection', async () => {
    const wrapper = mount(P010LearningPage, { props: { portal, mode: 'center' } })
    expect(wrapper.text()).toContain('P010-2026-0001')
    await wrapper.get('[data-select-record="learning-2"]').trigger('click')
    expect(wrapper.text()).toContain('第二条学习任务')
  })

  it('suppresses duplicate actions and keeps one caller key for the in-flight lifecycle', async () => {
    const process = processHarness()
    let resolveAction!: () => void
    process.performAction.mockImplementationOnce(() => new Promise(resolve => { resolveAction = () => resolve(undefined) }))
    const wrapper = mount(P010LearningPage, { props: { portal, mode: 'center' } })
    await wrapper.get('[data-action-evidence] textarea').setValue('不可变证据摘要')
    const button = wrapper.get('[data-action-code="PUBLISH"]')
    await button.trigger('click')
    await button.trigger('click')
    expect(process.performAction).toHaveBeenCalledTimes(1)
    const key = process.performAction.mock.calls[0]?.[3]
    expect(key).toMatch(/^p010-publish-/)
    resolveAction()
  })

  it('retries an uncertain action with the same key and rotates after success', async () => {
    const process = processHarness()
    process.performAction.mockImplementationOnce(() => {
      process.action.state.value = {
        phase: 'error', requestId: 'timeout-1',
        error: { kind: 'timeout', status: 408, title: '超时', userMessage: '结果未知', nextAction: '重试' },
      }
      return Promise.resolve(undefined)
    }).mockImplementationOnce(() => {
      process.action.state.value = { phase: 'success', data: harness.records[0], requestId: 'success-1' }
      return Promise.resolve(harness.records[0])
    }).mockResolvedValueOnce(harness.records[0])
    const wrapper = mount(P010LearningPage, { props: { portal, mode: 'center' } })
    await wrapper.get('[data-action-evidence] textarea').setValue('不可变证据摘要')
    await wrapper.get('[data-action-code="PUBLISH"]').trigger('click')
    await nextTick()
    await wrapper.get('[data-action-error] button').trigger('click')
    const firstKey = process.performAction.mock.calls[0]?.[3]
    expect(process.performAction.mock.calls[1]?.[3]).toBe(firstKey)
    process.action.state.value = { phase: 'idle' }
    await nextTick()
    await wrapper.get('[data-action-code="PUBLISH"]').trigger('click')
    expect(process.performAction.mock.calls[2]?.[3]).not.toBe(firstKey)
  })

  it('refreshes a 409 without replaying and then uses latest version with a new key', async () => {
    const process = processHarness()
    const firstRecord = harness.records[0]
    if (!firstRecord) throw new Error('P010 page fixture requires the first server record')
    process.performAction.mockImplementationOnce(() => {
      process.action.state.value = {
        phase: 'error', requestId: 'conflict-1',
        error: { kind: 'conflict', status: 409, title: '冲突', userMessage: '刷新事实', nextAction: '刷新' },
      }
      return Promise.resolve(undefined)
    }).mockResolvedValueOnce(undefined)
    process.refresh.mockImplementation(() => {
      const latest = [{ ...firstRecord, versionNo: 8 }, ...harness.records.slice(1)]
      process.records.state.value = { phase: 'success', data: latest, requestId: 'records-latest' }
      return Promise.resolve(latest)
    })
    const wrapper = mount(P010LearningPage, { props: { portal, mode: 'center' } })
    await wrapper.get('[data-action-evidence] textarea').setValue('不可变证据摘要')
    await wrapper.get('[data-action-code="PUBLISH"]').trigger('click')
    const staleKey = process.performAction.mock.calls[0]?.[3]
    await wrapper.get('[data-refresh-facts]').trigger('click')
    expect(process.refresh).toHaveBeenCalled()
    expect(process.performAction).toHaveBeenCalledTimes(1)
    process.action.state.value = { phase: 'idle' }
    await nextTick()
    await wrapper.get('[data-action-code="PUBLISH"]').trigger('click')
    expect(process.performAction.mock.calls[1]?.[2]).toMatchObject({ expectedVersion: 8 })
    expect(process.performAction.mock.calls[1]?.[3]).not.toBe(staleKey)
  })

  it('keeps error and pending ownership on the originating record', async () => {
    const process = processHarness()
    process.performAction.mockImplementationOnce(() => {
      process.action.state.value = {
        phase: 'error', requestId: 'forbidden-1',
        error: { kind: 'forbidden', status: 403, title: '拒绝', userMessage: '后端拒绝', nextAction: '返回' },
      }
      return Promise.resolve(undefined)
    }).mockResolvedValueOnce(undefined)
    const wrapper = mount(P010LearningPage, { props: { portal, mode: 'center' } })
    await wrapper.get('[data-action-evidence] textarea').setValue('不可变证据摘要')
    await wrapper.get('[data-action-code="PUBLISH"]').trigger('click')
    expect(wrapper.find('[data-action-error]').exists()).toBe(true)
    await wrapper.get('[data-select-record="learning-2"]').trigger('click')
    expect(wrapper.find('[data-action-error]').exists()).toBe(false)
    await wrapper.get('[data-action-evidence] textarea').setValue('第二条不可变证据')
    expect(wrapper.get('[data-action-code="PUBLISH"]').attributes('disabled')).toBeUndefined()
  })

  it('projects no action candidates in tech mode while preserving server records', () => {
    const wrapper = mount(P010LearningPage, { props: { portal: { ...portal, code: 'tech' }, mode: 'tech' } })
    expect(wrapper.text()).toContain('P010-2026-0001')
    expect(wrapper.find('[data-action-code]').exists()).toBe(false)
    expect(wrapper.find('[data-submit-create]').exists()).toBe(false)
  })
})
