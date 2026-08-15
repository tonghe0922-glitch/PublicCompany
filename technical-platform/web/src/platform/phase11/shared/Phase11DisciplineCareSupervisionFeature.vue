<script setup lang="ts">
import { computed } from 'vue'

import { usePortalSessionStore } from '../../../session'
import type { PortalDefinition } from '../../portal-config'
import { PermissionGate } from '../../processes/shared'
import P014DisciplineFeature from '../p014/P014DisciplineFeature.vue'
import P016CareSupportFeature from '../p016/P016CareSupportFeature.vue'

defineProps<{ portal: PortalDefinition }>()
const session = usePortalSessionStore()
const canP014 = computed(() => ['read', 'manage', 'investigate', 'decide', 'appeal']
  .some(code => session.can(`p014.discipline.${code}`)))
const canP016 = computed(() => ['read', 'manage', 'approve', 'execute', 'reconcile']
  .some(code => session.can(`p016.welfare.${code}`)))
</script>

<template>
  <main data-testid="phase11-discipline-care-supervision">
    <PermissionGate :allowed="canP014" mode="hide">
      <section data-testid="p014-supervision-section">
        <P014DisciplineFeature :portal="portal" mode="center" :heading-level="2" />
      </section>
    </PermissionGate>
    <PermissionGate :allowed="canP016" mode="hide">
      <section data-testid="p016-supervision-section">
        <P016CareSupportFeature :portal="portal" mode="center" :heading-level="2" />
      </section>
    </PermissionGate>
  </main>
</template>
