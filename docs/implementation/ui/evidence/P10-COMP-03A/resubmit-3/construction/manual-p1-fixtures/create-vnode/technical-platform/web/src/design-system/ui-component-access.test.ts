import { describe, expect, it } from 'vitest'
import * as Ui from '@sgj/ui'
const expectedUiExports=['SgjButton','SgjFormPageTemplate'] as const
describe('public aliases',()=>{it('exposes registered exports',()=>{expect(Object.keys(Ui).sort()).toEqual([...expectedUiExports].sort());for(const exportName of expectedUiExports) expect(Ui[exportName]).toBeDefined()})})
