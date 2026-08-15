<script setup lang="ts">
import { computed } from 'vue'
import type { SessionView } from '../contracts'
import { SgjButton, SgjSelect, SgjStatusChip } from '@sgj/ui'
import type { PortalDefinition } from './portal-config'

const props = withDefaults(defineProps<{
  portal: PortalDefinition
  session: SessionView
  switching?: boolean
}>(), {
  switching: false,
})

const emit = defineEmits<{
  switchIdentity: [identityId: string]
  logout: []
}>()

const options = computed(() => props.session.availableIdentities.map((identity) => ({
  value: identity.identityId,
  label: identity.identityName,
})))
const currentIdentity = computed(() => props.session.availableIdentities
  .find((identity) => identity.identityId === props.session.identityId))
const canSwitch = computed(() => props.session.permissions.includes('platform.session.switch'))

function switchIdentity(identityId: string): void {
  if (identityId && identityId !== props.session.identityId) emit('switchIdentity', identityId)
}
</script>

<template>
  <div class="portal-session-header">
    <div class="portal-session-header__context">
      <SgjStatusChip tone="info">{{ portal.title }}</SgjStatusChip>
      <strong>{{ currentIdentity?.identityName ?? '当前身份' }}</strong>
    </div>
    <SgjSelect
      v-if="canSwitch && options.length > 1"
      class="portal-session-header__identity"
      label="当前身份"
      :model-value="session.identityId"
      :options="options"
      :disabled="switching"
      @update:model-value="switchIdentity"
    />
    <SgjButton variant="ghost" :disabled="switching" @click="emit('logout')">退出登录</SgjButton>
  </div>
</template>

<style scoped>
.portal-session-header { display: flex; min-width: 0; align-items: center; justify-content: flex-end; gap: var(--sgj-space-3); }
.portal-session-header__context { min-width: 0; display: flex; align-items: center; gap: var(--sgj-space-2); }
.portal-session-header__context strong { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.portal-session-header__identity { width: min(260px, 32vw); }
@media (max-width: 760px) {
  .portal-session-header__context strong { display: none; }
  .portal-session-header__identity { width: min(190px, 44vw); }
}
</style>
