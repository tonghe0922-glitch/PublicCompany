// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PageTemplateFrame from './PageTemplateFrame.vue'
import ApprovalPageTemplate from './ApprovalPageTemplate.vue'
import DashboardPageTemplate from './DashboardPageTemplate.vue'
import DetailPageTemplate from './DetailPageTemplate.vue'
import FormPageTemplate from './FormPageTemplate.vue'
import ListPageTemplate from './ListPageTemplate.vue'
import TimelinePageTemplate from './TimelinePageTemplate.vue'

const wrappers = [
  ApprovalPageTemplate,
  DashboardPageTemplate,
  DetailPageTemplate,
  FormPageTemplate,
  ListPageTemplate,
  TimelinePageTemplate,
]

describe('PageTemplateFrame heading contract', () => {
  it('defaults to a secondary heading below the authenticated shell title', () => {
    const wrapper = mount(PageTemplateFrame, { props: { title: '页面内容' } })
    expect(wrapper.findAll('h1')).toHaveLength(0)
    expect(wrapper.get('h2').text()).toBe('页面内容')
  })

  it('supports a controlled primary heading outside an authenticated shell', () => {
    const wrapper = mount(PageTemplateFrame, { props: { title: '独立页面', headingLevel: 1 } })
    expect(wrapper.get('h1').text()).toBe('独立页面')
    expect(wrapper.findAll('h2')).toHaveLength(0)
  })

  it.each(wrappers)('passes the controlled heading level through wrapper %s', (component) => {
    const wrapper = mount(component, { props: { title: '受控标题', headingLevel: 3 } })
    expect(wrapper.get('h3').text()).toBe('受控标题')
    expect(wrapper.findAll('h1')).toHaveLength(0)
  })
})
