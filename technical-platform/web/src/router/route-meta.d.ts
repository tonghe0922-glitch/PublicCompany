import 'vue-router'
import type { PortalCode } from '../platform/portal-config'

export {}

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    permission?: string
    permissionsAny?: string[]
    title?: string
    processCode?: string
    sourceKey?: string
    portalCode?: PortalCode
    sensitiveLevel?: string | null
    dataScope?: string | null
  }
}
