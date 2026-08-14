// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ConfirmDialog from './ConfirmDialog.vue'
import HighRiskConfirmDialog from './HighRiskConfirmDialog.vue'
import ProcessActionPanel from './ProcessActionPanel.vue'

describe('shared action experiences', () => {
  it('protects confirm from duplicate clicks with caller-owned loading', async () => {
    const wrapper = mount(ConfirmDialog, { props: { open: true, actionName: '提交审批', subject: '会议 M-1', consequence: '提交后进入审批', loading: true } })
    expect(wrapper.text()).toContain('会议 M-1')
    expect(wrapper.get('[data-action="confirm"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-action="cancel"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('consumes only an authoritative step-up result and emits reason/reference', async () => {
    const wrapper = mount(HighRiskConfirmDialog, { props: { open: true, actionName: '作废记录', subject: '记录 R-1', consequence: '不可恢复', reason: '', stepUpSatisfied: false } })
    expect(wrapper.find('input[type="password"]').exists()).toBe(false)
    expect(wrapper.get('[data-action="confirm"]').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ reason: '重复数据', stepUpSatisfied: true, stepUpReference: 'step-up-ref' })
    await wrapper.get('[data-action="confirm"]').trigger('click')
    expect(wrapper.emitted('confirm')?.[0]).toEqual([{ reason: '重复数据', stepUpReference: 'step-up-ref' }])
  })

  it('renders caller actions with independent states and no process branching', async () => {
    const wrapper = mount(ProcessActionPanel, { props: {
      actions: [{ code: 'approve', label: '批准', tone: 'primary', permission: 'p.test.approve' }, { code: 'reject', label: '拒绝', tone: 'danger', permission: 'p.test.reject' }],
      actionStates: { approve: { phase: 'loading', requestId: 'action-1' }, reject: { phase: 'idle' } },
    } })
    expect(wrapper.get('[data-action-code="approve"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-action-code="reject"]').trigger('click')
    expect(wrapper.emitted('action')?.[0]).toEqual(['reject'])
  })

  it('fails closed and emits mutually exclusive caller-handled recovery intents for 403, 409 and other errors', async () => {
    const wrapper = mount(ProcessActionPanel, { props: {
      actions: [
        { code: 'forbidden', label: '无权操作', tone: 'primary', permission: 'p.test.forbidden' },
        { code: 'conflict', label: '冲突操作', tone: 'secondary', permission: 'p.test.conflict' },
        { code: 'timeout', label: '超时操作', tone: 'danger', permission: 'p.test.timeout' },
      ],
      actionStates: {
        forbidden: { phase: 'error', error: { kind: 'forbidden', status: 403, title: '无权限', userMessage: '服务端拒绝', nextAction: 'request-access' } },
        conflict: { phase: 'error', error: { kind: 'conflict', status: 409, title: '版本冲突', userMessage: '请刷新', nextAction: 'refresh' } },
        timeout: { phase: 'error', error: { kind: 'timeout', title: '请求超时', userMessage: '请重试', nextAction: 'retry' } },
      },
    } })

    for (const code of ['forbidden', 'conflict', 'timeout']) {
      const button = wrapper.get(`[data-action-code="${code}"]`)
      expect(button.attributes('disabled')).toBeDefined()
      await button.trigger('click')
    }
    expect(wrapper.emitted('action')).toBeUndefined()

    await wrapper.get('[data-recovery-code="forbidden"]').trigger('click')
    expect(wrapper.emitted('permissionDenied')?.[0]?.[0]).toBe('forbidden')
    expect(wrapper.emitted('conflictRefresh')).toBeUndefined()
    expect(wrapper.emitted('retry')).toBeUndefined()

    await wrapper.get('[data-recovery-code="conflict"]').trigger('click')
    expect(wrapper.emitted('conflictRefresh')?.[0]?.[0]).toBe('conflict')
    expect(wrapper.emitted('permissionDenied')).toHaveLength(1)
    expect(wrapper.emitted('retry')).toBeUndefined()

    await wrapper.get('[data-recovery-code="timeout"]').trigger('click')
    expect(wrapper.emitted('retry')?.[0]?.[0]).toBe('timeout')
    expect(wrapper.emitted('permissionDenied')).toHaveLength(1)
    expect(wrapper.emitted('conflictRefresh')).toHaveLength(1)
  })

  it('treats contradictory status and kind as an opaque retry instead of guessing authority', async () => {
    const wrapper = mount(ProcessActionPanel, { props: {
      actions: [{ code: 'opaque', label: '矛盾错误', tone: 'primary', permission: 'p.test.opaque' }],
      actionStates: { opaque: { phase: 'error', error: { kind: 'forbidden', status: 409, title: '矛盾错误', userMessage: '需由调用方重新获取', nextAction: 'retry' } } },
    } })
    await wrapper.get('[data-action-code="opaque"]').trigger('click')
    expect(wrapper.emitted('action')).toBeUndefined()
    await wrapper.get('[data-recovery-code="opaque"]').trigger('click')
    expect(wrapper.emitted('permissionDenied')).toBeUndefined()
    expect(wrapper.emitted('conflictRefresh')).toBeUndefined()
    expect(wrapper.emitted('retry')?.[0]?.[0]).toBe('opaque')
  })
})
