import { describe, expect, it } from 'vitest'
import portalShellSource from './PortalShell.vue?raw'
import forbiddenSource from '../../platform/pages/ForbiddenPage.vue?raw'
import p001Source from '../../platform/pages/P001IdentityPage.vue?raw'
import p002Source from '../../platform/pages/P002PermissionRequestPage.vue?raw'
import p003Source from '../../platform/pages/P003ProfileChangePage.vue?raw'
import p004Source from '../../platform/pages/P004GenericRequestPage.vue?raw'
import p005Source from '../../platform/pages/P005NoticePage.vue?raw'
import p006Source from '../../platform/pages/P006MeetingPage.vue?raw'
import p007Source from '../../platform/pages/P007SchedulePage.vue?raw'
import p008Source from '../../platform/pages/P008LeavePage.vue?raw'
import p009Source from '../../platform/pages/P009OvertimePage.vue?raw'
import p010Source from '../../platform/pages/P010LearningPage.vue?raw'
import centerInboxSource from '../../platform/pages/Phase09CenterInboxPage.vue?raw'
import techMonitorSource from '../../platform/pages/Phase10TechMonitorPage.vue?raw'
import attendanceMonitorSource from '../../platform/pages/Phase10AttendanceMonitorPage.vue?raw'

const authenticatedPageSources = [
  forbiddenSource,
  p001Source,
  p002Source,
  p003Source,
  p004Source,
  p005Source,
  p006Source,
  p007Source,
  p008Source,
  p009Source,
  p010Source,
  centerInboxSource,
  techMonitorSource,
  attendanceMonitorSource,
]

describe('authenticated portal landmark ownership', () => {
  it('keeps the only main and primary heading in PortalShell', () => {
    expect(portalShellSource.match(/<main\b/g)).toHaveLength(1)
    expect(portalShellSource.match(/<h1\b/g)).toHaveLength(1)
  })

  it.each(authenticatedPageSources)('does not create a nested main or duplicate h1', (source) => {
    expect(source).not.toMatch(/<main\b/)
    expect(source).not.toMatch(/<h1\b/)
  })

  it('does not mount another portal shell inside the authenticated forbidden route', () => {
    expect(forbiddenSource).not.toMatch(/SgjPortalShell/)
  })
})
