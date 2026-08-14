<script setup lang="ts">
import { SgjButton, SgjCard } from '@sgj/ui'
import type { ActionStateMap, AllowedAction } from './action-contracts'
import type { AsyncState } from '../async/async-state'
import type { UiError } from '../errors/ui-error'

withDefaults(defineProps<{ actions: readonly AllowedAction[]; actionStates?: ActionStateMap }>(), {
  actionStates: () => ({}),
})
const emit = defineEmits<{
  action: [code: string]
  permissionDenied: [code: string, error: UiError]
  conflictRefresh: [code: string, error: UiError]
  retry: [code: string, error: UiError]
}>()

function isBlocked(state?: AsyncState<unknown>): boolean {
  return state?.phase === 'loading' || state?.phase === 'error'
}

function recoveryKind(state?: AsyncState<unknown>): 'permission' | 'conflict' | 'retry' | undefined {
  if (state?.phase !== 'error' || !state.error) return undefined
  if (state.error.status === 403 && state.error.kind === 'forbidden') return 'permission'
  if (state.error.status === 409 && state.error.kind === 'conflict') return 'conflict'
  return 'retry'
}

function recoveryLabel(state?: AsyncState<unknown>): string {
  const kind = recoveryKind(state)
  if (kind === 'permission') return '查看拒绝原因'
  if (kind === 'conflict') return '刷新最新状态'
  return '重试'
}

function recover(code: string, state?: AsyncState<unknown>): void {
  if (state?.phase !== 'error' || !state.error) return
  const kind = recoveryKind(state)
  if (kind === 'permission') emit('permissionDenied', code, state.error)
  else if (kind === 'conflict') emit('conflictRefresh', code, state.error)
  else emit('retry', code, state.error)
}
</script>

<template>
  <SgjCard variant="muted" as="section" aria-label="可执行操作">
    <template #header><strong>可执行操作</strong></template>
    <p v-if="actions.length === 0">当前没有可执行操作，最终结果以服务端裁决为准。</p>
    <div v-else class="sgj-action-row">
      <div v-for="item in actions" :key="item.code" class="sgj-action-item">
        <SgjButton
          :data-action-code="item.code"
          :variant="item.tone"
          :loading="actionStates[item.code]?.phase === 'loading'"
          :disabled="isBlocked(actionStates[item.code])"
          @click="emit('action', item.code)"
        >
          {{ item.label }}
        </SgjButton>
        <div v-if="actionStates[item.code]?.phase === 'error'" role="alert" :data-action-error="item.code">
          <p>{{ actionStates[item.code]?.error?.userMessage ?? '操作失败，请由调用方处理。' }}</p>
          <SgjButton
            :data-recovery-code="item.code"
            variant="secondary"
            @click="recover(item.code, actionStates[item.code])"
          >
            {{ recoveryLabel(actionStates[item.code]) }}
          </SgjButton>
        </div>
      </div>
    </div>
  </SgjCard>
</template>
