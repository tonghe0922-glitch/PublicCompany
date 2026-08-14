<script setup lang="ts" generic="T">
import { SgjEmpty, SgjError, SgjLoading, SgjPartialFailure } from '@sgj/ui'
import type { AsyncState } from './async-state'

defineProps<{ state: AsyncState<T> }>()
</script>

<template>
  <div class="sgj-async-state" :data-state="state.phase" :aria-busy="state.phase === 'loading' || undefined">
    <slot v-if="state.phase === 'idle'" name="idle" />
    <slot v-else-if="state.phase === 'loading'" name="loading">
      <SgjLoading title="正在加载" description="请稍候，当前资源正在更新。" />
    </slot>
    <slot v-else-if="state.phase === 'empty'" name="empty">
      <SgjEmpty title="暂无数据" description="当前查询没有可展示的业务记录。" />
    </slot>
    <slot v-else-if="state.phase === 'partial'" name="partial" :state="state">
      <SgjPartialFailure title="部分资源暂不可用" :description="`缺失资源：${state.missingResources?.join('、') || '未提供'}`" />
    </slot>
    <slot v-else-if="state.phase === 'error'" name="error" :error="state.error">
      <SgjError :title="state.error?.title" :description="state.error?.userMessage" :error-code="state.error?.code" :trace-id="state.error?.requestId" />
    </slot>
    <slot v-else-if="state.phase === 'cancelled'" name="cancelled">
      <p>请求已取消。</p>
    </slot>
    <slot v-else :data="state.data" />
  </div>
</template>
