// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DataTable from './DataTable.vue'
import DescriptionList from './DescriptionList.vue'
import ProcessRecordMeta from './ProcessRecordMeta.vue'
import ProcessTimeline from './ProcessTimeline.vue'

describe('shared record projections', () => {
  it('projects stable record metadata without knowing a process', () => {
    const wrapper = mount(ProcessRecordMeta, { props: { record: { businessNo: 'B-1', statusLabel: '待审批', currentNodeLabel: '中心审批', versionNo: 3, updatedAt: '2026-08-13 10:00', freshnessLabel: '刚刚更新' } } })
    expect(wrapper.text()).toContain('B-1')
    expect(wrapper.text()).toContain('待审批')
    expect(wrapper.text()).toContain('版本 3')
  })

  it('emits only column-whitelisted server query intents and supports a mobile row projection', async () => {
    const wrapper = mount(DataTable, { props: {
      columns: [
        { key: 'name', label: '名称', sortable: true, filterable: true },
        { key: 'secret', label: '内部字段' },
      ],
      rows: [{ id: '1', name: '记录甲', secret: '内部值' }],
      rowKey: 'id',
      page: 1,
      state: { phase: 'success', data: [{ id: '1', name: '记录甲', secret: '内部值' }] },
    } })
    expect(wrapper.text()).toContain('记录甲')
    await wrapper.get('[data-page="next"]').trigger('click')
    expect(wrapper.emitted('pageChange')?.[0]).toEqual([2])
    await wrapper.get('[data-sort-key="name"]').trigger('click')
    expect(wrapper.emitted('sortChange')?.[0]).toEqual([{ key: 'name', direction: 'asc' }])
    await wrapper.get('[data-filter-key="name"] input').setValue('甲')
    expect(wrapper.emitted('filterChange')?.at(-1)).toEqual([{ key: 'name', value: '甲' }])
    expect(wrapper.find('[data-sort-key="secret"]').exists()).toBe(false)
    expect(wrapper.find('[data-filter-key="secret"]').exists()).toBe(false)
    expect(wrapper.find('[data-mobile-row="1"]').exists()).toBe(true)
  })

  it('uses success and partial state data as the only authoritative rows', async () => {
    const wrapper = mount(DataTable, { props: {
      columns: [{ key: 'name', label: '名称' }],
      rows: [{ id: 'legacy', name: '过期记录不得显示' }],
      rowKey: 'id',
      page: 1,
      state: { phase: 'success', data: [{ id: 'fresh', name: '权威最新记录' }] },
    } })
    expect(wrapper.text()).toContain('权威最新记录')
    expect(wrapper.text()).not.toContain('过期记录不得显示')
    expect(wrapper.html()).not.toContain('过期记录不得显示')
    expect(wrapper.find('tbody').text()).toContain('权威最新记录')
    expect(wrapper.get('[data-mobile-row="fresh"]').text()).toContain('权威最新记录')

    await wrapper.setProps({
      rows: [{ id: 'legacy-partial', name: '过期部分记录不得显示' }],
      state: { phase: 'partial', data: [{ id: 'partial', name: '权威部分记录' }], requestId: 'r-partial', missingResources: ['统计摘要'] },
    })
    expect(wrapper.text()).toContain('权威部分记录')
    expect(wrapper.html()).not.toContain('过期部分记录不得显示')
    expect(wrapper.get('[data-mobile-row="partial"]').text()).toContain('权威部分记录')

    await wrapper.setProps({
      rows: [{ id: 'legacy-empty', name: '空状态旧记录不得显示' }],
      state: { phase: 'empty', data: [], requestId: 'r-empty' },
    })
    expect(wrapper.text()).toContain('暂无数据')
    expect(wrapper.html()).not.toContain('空状态旧记录不得显示')
    expect(wrapper.find('tbody').exists()).toBe(false)
    expect(wrapper.find('[data-mobile-row="legacy-empty"]').exists()).toBe(false)
  })

  it('keeps an empty-result filter recoverable and emits only whitelisted changes', async () => {
    const wrapper = mount(DataTable, { props: {
      columns: [{ key: 'name', label: '名称', filterable: true }],
      rows: [],
      rowKey: 'id',
      page: 1,
      filters: { name: '无结果条件' },
      state: { phase: 'empty', data: [], requestId: 'r-filter-empty' },
    } })
    const filter = wrapper.get('[data-filter-key="name"] input')
    expect(filter.element.getAttribute('value')).toBe('无结果条件')
    await filter.setValue('')
    expect(wrapper.emitted('filterChange')?.at(-1)).toEqual([{ key: 'name', value: '' }])
  })

  it('rejects an unknown or non-filterable key through the callable handler path', () => {
    const wrapper = mount(DataTable, { props: {
      columns: [{ key: 'name', label: '名称', filterable: true }, { key: 'secret', label: '内部字段' }],
      rows: [],
      rowKey: 'id',
      page: 1,
      state: { phase: 'empty', data: [] },
    } })
    const component = wrapper.vm as unknown as { $: { setupState: { emitFilter(key: string, value: string): void } } }
    const setup = component.$.setupState
    setup.emitFilter('missing', 'x')
    setup.emitFilter('secret', 'x')
    expect(wrapper.emitted('filterChange')).toBeUndefined()
  })

  it('projects loading, empty, partial and error without inventing another state model', async () => {
    const props = { columns: [{ key: 'name', label: '名称' }], rows: [{ id: '1', name: '记录甲' }], rowKey: 'id', page: 1 }
    const wrapper = mount(DataTable, { props: { ...props, state: { phase: 'loading', requestId: 'r-1' } } })
    expect(wrapper.text()).toContain('正在加载数据')
    expect(wrapper.find('[data-mobile-row="1"]').exists()).toBe(false)

    await wrapper.setProps({ state: { phase: 'empty', requestId: 'r-2' } })
    expect(wrapper.text()).toContain('暂无数据')

    await wrapper.setProps({ state: { phase: 'partial', data: [{ id: '1', name: '记录甲' }], requestId: 'r-3', missingResources: ['统计摘要'] } })
    expect(wrapper.text()).toContain('部分数据暂不可用')
    expect(wrapper.text()).toContain('统计摘要')
    expect(wrapper.find('[data-mobile-row="1"]').exists()).toBe(true)

    await wrapper.setProps({ state: { phase: 'error', requestId: 'r-4', error: { kind: 'timeout', title: '请求超时', userMessage: '请稍后重试', nextAction: 'retry' } } })
    expect(wrapper.text()).toContain('请求超时')
    expect(wrapper.find('[data-mobile-row="1"]').exists()).toBe(false)
  })

  it('renders ordinary, masked and empty descriptions without leaking the masked source', () => {
    const secret = 'sensitive-person-13800138000'
    const descriptions = mount(DescriptionList, { props: { items: [
      { key: 'owner', label: '负责人', value: '张三' },
      { key: 'mobile', label: '手机号', value: secret, masked: true },
      { key: 'blank', label: '备注', value: '   ' },
      { key: 'empty', label: '补充', value: null },
    ] } })
    expect(descriptions.text()).toContain('张三')
    expect(descriptions.text()).toContain('已脱敏')
    expect(descriptions.text()).not.toContain(secret)
    expect(descriptions.html()).not.toContain(secret)
    for (const element of descriptions.findAll('*')) {
      expect(Object.values(element.attributes()).join(' ')).not.toContain(secret)
    }
    expect(descriptions.findAll('dd').filter(item => item.text() === '—')).toHaveLength(2)
    const timeline = mount(ProcessTimeline, { props: { events: [{ id: 'e2', occurredAt: '2026-08-13T11:00:00Z', title: '完成' }, { id: 'e1', occurredAt: '2026-08-13T10:00:00Z', title: '开始' }] } })
    expect(timeline.text().indexOf('开始')).toBeLessThan(timeline.text().indexOf('完成'))
  })
})
