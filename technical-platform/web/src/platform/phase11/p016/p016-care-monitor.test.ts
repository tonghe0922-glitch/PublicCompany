import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const featurePath = new URL('./P016CareMonitorFeature.vue', import.meta.url)
const composablePath = new URL('./use-p016-care-monitor.ts', import.meta.url)

describe('P016 technical metadata monitor contract', () => {
  it('owns a dedicated feature and composable instead of reusing the full care feature', () => {
    expect(existsSync(featurePath), 'P016CareMonitorFeature.vue must exist').toBe(true)
    expect(existsSync(composablePath), 'use-p016-care-monitor.ts must exist').toBe(true)
  })

  it('requests the dedicated projection and types exactly businessNo/currentNodeCode/status', () => {
    expect(existsSync(composablePath), 'use-p016-care-monitor.ts must exist').toBe(true)
    if (!existsSync(composablePath)) return
    const source = readFileSync(composablePath, 'utf8')
    const projection = source.match(/interface\s+P016MonitorProjection\s*\{(?<body>[\s\S]*?)\}/u)?.groups?.body ?? ''
    const fields = [...projection.matchAll(/(?:readonly\s+)?([A-Za-z][A-Za-z0-9]*)\s*:/gu)]
      .map(match => match[1])
      .sort()

    expect(source).toContain('/api/v1/processes/P016/care-cases/monitor-projections')
    expect(fields).toEqual(['businessNo', 'currentNodeCode', 'status'])
    expect(source).not.toContain('CareCase')
    expect(source).not.toContain('JSON.stringify')
  })

  it('renders only the three metadata fields and exposes no business mutation control', () => {
    expect(existsSync(featurePath), 'P016CareMonitorFeature.vue must exist').toBe(true)
    if (!existsSync(featurePath)) return
    const source = readFileSync(featurePath, 'utf8')

    expect(source).toContain('data-testid="p016-monitor-section"')
    for (const field of ['businessNo', 'currentNodeCode', 'status']) expect(source).toContain(field)
    expect(source).not.toMatch(/P016CareSupportFeature|useP016CareSupport|data-action|createCase|perform\s*\(/u)
    expect(source).not.toMatch(/affectedEmployee|amount|invoice|evidence|sourceFact|subject/iu)
    expect(source).not.toMatch(/SgjInput|SgjSelect|SgjTextarea/u)
  })
})
