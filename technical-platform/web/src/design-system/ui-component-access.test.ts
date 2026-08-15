import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import * as PlatformUi from '@sgj/platform-ui'
import * as Ui from '@sgj/ui'

const expectedUiExports = [
  'SgjApprovalPageTemplate',
  'SgjAvatar',
  'SgjButton',
  'SgjCard',
  'SgjCascader',
  'SgjCheckbox',
  'SgjConflict',
  'SgjDashboardPageTemplate',
  'SgjDateTime',
  'SgjDetailPageTemplate',
  'SgjDialog',
  'SgjDrawer',
  'SgjEmpty',
  'SgjError',
  'SgjFormPageTemplate',
  'SgjInput',
  'SgjKpiCard',
  'SgjList',
  'SgjListPageTemplate',
  'SgjLoading',
  'SgjMaskedValue',
  'SgjNoPermission',
  'SgjOrganizationPicker',
  'SgjPartialFailure',
  'SgjPersonPicker',
  'SgjPersonRow',
  'SgjPortalShell',
  'SgjRadioGroup',
  'SgjRecordCard',
  'SgjSelect',
  'SgjStatusChip',
  'SgjStepUpReveal',
  'SgjSwitch',
  'SgjTable',
  'SgjTextarea',
  'SgjTimelinePageTemplate',
  'SgjToast',
  'SgjToastRegion',
  'SgjUpload',
] as const

const expectedPlatformExports = [
  'ApiErrorNotice',
  'AsyncStateBoundary',
  'AttendanceWorkflowMonitorFeature',
  'ConfirmDialog',
  'DataTable',
  'DateTimeRangeField',
  'DescriptionList',
  'FormErrorSummary',
  'HighRiskConfirmDialog',
  'MonitorPanel',
  'PermissionGate',
  'PhaseWorkflowMonitorFeature',
  'ProcessActionPanel',
  'ProcessMetadataMonitorFeature',
  'ProcessRecordMeta',
  'ProcessTimeline',
  'VersionConflictPanel',
  'useAsyncAction',
  'useAsyncResource',
] as const
const blockedPlatformExports = [
  'DirectoryPersonPickerAdapter',
  'DirectoryOrganizationPickerAdapter',
  'ManagedUpload',
  'MonitorStatusTable',
  'createMonitorService',
  'useMonitorProjection',
] as const

interface RegistryEntry {
  id: string
  status: string
  public: boolean
  public_import: string | null
  implementation_path: string
  export_name: string | null
  required_tests: string[]
}

const registry = JSON.parse(readFileSync(
  new URL('../../../../docs/implementation/ui/UI_COMPONENT_REGISTRY.json', import.meta.url),
  'utf8',
)) as { components: RegistryEntry[] }

describe('public UI component aliases', () => {
  it('resolves the Design System only through @sgj/ui', () => {
    expect(Object.keys(Ui).sort()).toEqual([...expectedUiExports].sort())
    for (const exportName of expectedUiExports) expect(Ui[exportName]).toBeDefined()
  })

  it('resolves only ready platform composites and hooks through @sgj/platform-ui', () => {
    expect(Object.keys(PlatformUi).sort()).toEqual([...expectedPlatformExports].sort())
    for (const exportName of expectedPlatformExports) expect(PlatformUi[exportName]).toBeDefined()
    for (const exportName of blockedPlatformExports) expect(Object.hasOwn(PlatformUi, exportName)).toBe(false)
  })

  it('keeps the public monitor panel and internal table registry contracts closed', () => {
    const panel = registry.components.find(component => component.id === 'platform.monitor-panel')
    const table = registry.components.find(component => component.id === 'platform.monitor-status-table')
    expect(panel).toMatchObject({
      status: 'existing-stable',
      public: true,
      public_import: '@sgj/platform-ui',
      implementation_path: 'technical-platform/web/src/platform/processes/shared/monitoring/MonitorPanel.vue',
      export_name: 'MonitorPanel',
    })
    expect(panel?.required_tests).toContain(
      'technical-platform/web/src/platform/processes/shared/monitoring/monitor-components.test.ts',
    )
    expect(table).toMatchObject({
      status: 'internal',
      public: false,
      public_import: null,
      implementation_path: 'technical-platform/web/src/platform/processes/shared/monitoring/MonitorStatusTable.vue',
      export_name: null,
    })
    expect(table?.required_tests).toContain(
      'technical-platform/web/src/platform/processes/shared/monitoring/monitor-components.test.ts',
    )
  })

  it('keeps the public workflow monitor feature registry contracts closed', () => {
    const attendance = registry.components.find(component => component.id === 'platform.attendance-workflow-monitor-feature')
    const hub = registry.components.find(component => component.id === 'platform.phase-workflow-monitor-feature')
    const generic = registry.components.find(component => component.id === 'platform.process-metadata-monitor-feature')
    expect(attendance).toMatchObject({
      status: 'existing-stable', public: true, public_import: '@sgj/platform-ui',
      implementation_path: 'technical-platform/web/src/platform/processes/shared/monitoring/AttendanceWorkflowMonitorFeature.vue',
      export_name: 'AttendanceWorkflowMonitorFeature',
    })
    expect(attendance?.required_tests).toContain(
      'technical-platform/web/src/platform/processes/shared/monitoring/monitor-page.test.ts',
    )
    expect(hub).toMatchObject({
      status: 'existing-stable', public: true, public_import: '@sgj/platform-ui',
      implementation_path: 'technical-platform/web/src/platform/processes/shared/monitoring/PhaseWorkflowMonitorFeature.vue',
      export_name: 'PhaseWorkflowMonitorFeature',
    })
    expect(generic).toMatchObject({
      status: 'existing-stable', public: true, public_import: '@sgj/platform-ui',
      implementation_path: 'technical-platform/web/src/platform/processes/shared/monitoring/ProcessMetadataMonitorFeature.vue',
      export_name: 'ProcessMetadataMonitorFeature',
    })
    expect(PlatformUi.PhaseWorkflowMonitorFeature).toBeDefined()
    expect(PlatformUi.AttendanceWorkflowMonitorFeature).toBeDefined()
    expect(PlatformUi.ProcessMetadataMonitorFeature).toBeDefined()
  })
})
