// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DateTimeRangeField from './DateTimeRangeField.vue'

describe('DateTimeRangeField', () => {
  it('emits typed start/end values and validates ordering without timezone invention', async () => {
    const wrapper = mount(DateTimeRangeField, { props: { startValue: '2026-08-13T09:00', endValue: '2026-08-13T08:00', startLabel: '开始', endLabel: '结束' } })
    expect(wrapper.text()).toContain('结束时间不得早于开始时间')
    const inputs = wrapper.findAll('input')
    await inputs[0]?.setValue('2026-08-13T10:00')
    await inputs[1]?.setValue('2026-08-13T11:00')
    expect(wrapper.emitted('update:startValue')?.at(-1)).toEqual(['2026-08-13T10:00'])
    expect(wrapper.emitted('update:endValue')?.at(-1)).toEqual(['2026-08-13T11:00'])
  })
})
