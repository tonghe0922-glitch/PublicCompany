// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PermissionGate from './PermissionGate.vue'

describe('PermissionGate', () => {
  it('uses caller allowed projection for hide/disable/explain without session access', async () => {
    const hidden = mount(PermissionGate, { props: { allowed: false, mode: 'hide' }, slots: { default: '<span>敏感动作</span>' } })
    expect(hidden.text()).not.toContain('敏感动作')
    const explained = mount(PermissionGate, { props: { allowed: false, mode: 'explain', denialReason: '当前身份无此操作权限' }, slots: { default: '<span>敏感动作</span>' } })
    expect(explained.text()).toContain('当前身份无此操作权限')
    const disabled = mount(PermissionGate, { props: { allowed: false, mode: 'disable' }, slots: { default: '<button>服务端仍会拒绝</button>' } })
    expect(disabled.get('[data-permission-gate]').attributes('aria-disabled')).toBe('true')
    await disabled.get('[data-permission-gate]').trigger('click')
    expect(disabled.emitted('denied')).toHaveLength(1)
  })
})
