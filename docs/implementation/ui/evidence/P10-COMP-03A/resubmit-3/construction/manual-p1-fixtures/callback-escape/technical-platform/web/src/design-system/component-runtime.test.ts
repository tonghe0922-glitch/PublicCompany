import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from './components/Button.vue'
import FieldFrame from './components/FieldFrame.vue'
import FormPageTemplate from './templates/FormPageTemplate.vue'
it('mounts each governed implementation',()=>{expect(mount(Button).exists()).toBe(true);expect(mount(FieldFrame).exists()).toBe(true);expect(mount(FormPageTemplate).exists()).toBe(true)})
