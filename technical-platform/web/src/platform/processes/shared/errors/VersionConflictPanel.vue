<script setup lang="ts">
import { SgjButton, SgjConflict } from '@sgj/ui'

defineProps<{ expectedVersion: number; currentVersion: number; requestId?: string }>()
defineEmits<{ reload: []; retry: []; discard: [] }>()
</script>

<template>
  <SgjConflict title="数据版本冲突" description="记录已被其他操作更新，请先比较最新事实。">
    <template #actions>
      <p>提交版本 {{ expectedVersion }}，当前版本 {{ currentVersion }}。</p>
      <p v-if="requestId">请求编号：{{ requestId }}</p>
      <div class="sgj-action-row">
        <SgjButton data-action="reload" @click="$emit('reload')">加载最新版本</SgjButton>
        <SgjButton data-action="retry" variant="secondary" @click="$emit('retry')">保留输入并重试</SgjButton>
        <SgjButton data-action="discard" variant="danger" @click="$emit('discard')">放弃本次输入</SgjButton>
      </div>
    </template>
  </SgjConflict>
</template>
