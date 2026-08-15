/// <reference types="node" />
// @vitest-environment happy-dom
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import Drawer from '../../components/Drawer.vue'
import OrganizationPicker from '../../components/OrganizationPicker.vue'
import PersonPicker from '../../components/PersonPicker.vue'
import Select from '../../components/Select.vue'
import drawerSource from '../../components/Drawer.vue?raw'
import organizationSource from '../../components/OrganizationPicker.vue?raw'
import personSource from '../../components/PersonPicker.vue?raw'
import selectSource from '../../components/Select.vue?raw'
import portalSource from '../../../router/PortalNavigation.vue?raw'

const tokenSource = readFileSync('src/design-system/tokens.css', 'utf8')

describe('P10-COMP-01 independent reviewer probes', () => {
  it('emits one normalized string through update then change', async () => {
    const observed: Array<[string, unknown]> = []
    const wrapper = mount(Select, {
      props: {
        label: '类型',
        modelValue: '',
        options: [{ value: 'approved', label: '已批准' }],
        'onUpdate:modelValue': (value: unknown) => observed.push(['update', value]),
        onChange: (value: unknown) => observed.push(['change', value]),
      },
    })

    await wrapper.get('select').setValue('approved')

    expect(observed).toEqual([
      ['update', 'approved'],
      ['change', 'approved'],
    ])
    expect(observed.every(([, value]) => typeof value === 'string')).toBe(true)
    expect(wrapper.emitted('change')?.[0]?.[0]).not.toBeInstanceOf(Event)
  })

  it('passes picker values through without transformation', async () => {
    const person = mount(PersonPicker, {
      props: {
        label: '人员',
        modelValue: '',
        options: [{ value: 'person-001', label: '人员甲' }],
      },
    })
    const organization = mount(OrganizationPicker, {
      props: {
        label: '组织',
        modelValue: '',
        options: [{ value: 'org-001', label: '组织甲' }],
      },
    })

    await person.get('select').setValue('person-001')
    await organization.get('select').setValue('org-001')

    expect(person.emitted('update:modelValue')?.[0]).toEqual(['person-001'])
    expect(person.emitted('change')?.[0]).toEqual(['person-001'])
    expect(organization.emitted('update:modelValue')?.[0]).toEqual(['org-001'])
    expect(organization.emitted('change')?.[0]).toEqual(['org-001'])
  })

  it('blocks only backdrop close while preserving button, Escape and focus restore', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const wrapper = mount(Drawer, {
      attachTo: document.body,
      props: { open: false, title: '高风险操作', closeOnBackdrop: false },
      slots: { default: '<button id="reviewer-action">执行</button>' },
    })

    await wrapper.setProps({ open: true })
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(wrapper.get('.sgj-overlay__close').element)
    await wrapper.get('.sgj-overlay').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()
    await wrapper.get('.sgj-overlay__close').trigger('click')
    await wrapper.get('.sgj-drawer').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toHaveLength(2)
    await wrapper.setProps({ open: false })
    await nextTick()
    expect(document.activeElement).toBe(opener)
    wrapper.unmount()
    opener.remove()
  })

  it('defines every consumed token and keeps the shared layer free of business IO', () => {
    const defined = new Set([...tokenSource.matchAll(/(--sgj-[a-z0-9-]+)\s*:/g)].map((match) => match[1]))
    const sources = [selectSource, personSource, organizationSource, drawerSource, portalSource]
    const consumed = sources.flatMap((source) => [...source.matchAll(/var\((--sgj-[a-z0-9-]+)/g)].map((match) => match[1]))
    expect(consumed.filter((token) => !defined.has(token))).toEqual([])
    expect(portalSource).toContain('var(--sgj-shadow-overlay)')
    expect(portalSource).not.toContain('--sgj-shadow-lg')
    for (const source of [selectSource, personSource, organizationSource, drawerSource]) {
      expect(source).not.toMatch(/\/api\/|\bfetch\s*\(|session\.request|localStorage|P00[6-9]|P010/)
    }
  })
})
