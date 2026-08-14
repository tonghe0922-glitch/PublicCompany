<script setup lang="ts">
import { SgjButton, SgjCard } from '@sgj/ui'
</script>

<template>
  <SgjCard as="section" variant="muted">
    <template #header><strong>排班需求创建</strong></template>
    <p data-owner-directory-blocked role="status">
      BLOCKED_BY_CONTRACT：缺少权威人员目录搜索、分页、data-scope 与在岗最小投影；不接受手填 UUID、静态选项或本地缓存真值。
    </p>
    <template #footer>
      <SgjButton data-create-blocked disabled>等待人员目录合同</SgjButton>
    </template>
  </SgjCard>
</template>
