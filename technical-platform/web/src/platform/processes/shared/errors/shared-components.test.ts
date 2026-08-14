// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ApiErrorNotice from './ApiErrorNotice.vue'
import FormErrorSummary from './FormErrorSummary.vue'
import VersionConflictPanel from './VersionConflictPanel.vue'
import { mapApiError } from './map-api-error'

describe('shared stable errors', () => {
  it.each([
    [403, '当前身份无权完成此操作'],
    [404, '请求的业务记录不存在或不可见'],
    [408, '请求超时，请确认网络后重试'],
  ])('maps status %s without exposing server detail', (status, message) => {
    const error = mapApiError({ status, requestId: 'req-safe', detail: 'SQL stack password=secret' })
    expect(error.userMessage).toBe(message)
    const wrapper = mount(ApiErrorNotice, { props: { error } })
    expect(wrapper.text()).toContain(message)
    expect(wrapper.text()).toContain('req-safe')
    expect(wrapper.text()).not.toContain('SQL stack')
  })

  it('renders the stable ApiErrorNotice projection in an executable test path', () => {
    const wrapper = mount(ApiErrorNotice, { props: { error: mapApiError({ status: 403, requestId: 'req-direct' }) } })
    expect(wrapper.text()).toContain('当前身份无权完成此操作')
    expect(wrapper.text()).toContain('req-direct')
  })

  it('keeps a 409 conflict actionable instead of collapsing it into a toast', async () => {
    const wrapper = mount(VersionConflictPanel, { props: { expectedVersion: 4, currentVersion: 6, requestId: 'req-conflict' } })
    expect(wrapper.text()).toContain('4')
    expect(wrapper.text()).toContain('6')
    await wrapper.get('[data-action="reload"]').trigger('click')
    expect(wrapper.emitted('reload')).toHaveLength(1)
  })

  it('emits a field target from a stable form summary', async () => {
    const wrapper = mount(FormErrorSummary, { props: { errors: [{ field: 'title', label: '标题', message: '不能为空', controlId: 'meeting-title' }] } })
    await wrapper.get('[data-field="title"]').trigger('click')
    expect(wrapper.emitted('focusField')?.[0]).toEqual([{ field: 'title', controlId: 'meeting-title' }])
  })
})
