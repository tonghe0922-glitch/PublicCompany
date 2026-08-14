<script setup lang="ts">
import { SgjCard } from '@sgj/ui'
</script>

<template>
  <SgjCard as="section" variant="muted">
    <template #header><strong>学习任务创建</strong></template>
    <p data-owner-directory-blocked role="status">
      BLOCKED_BY_CONTRACT：创建必须选择在岗学员，但当前缺少按数据范围约束的权威人员目录搜索、分页与最小投影合同。
      本页面不提供员工 UUID 输入、静态候选、本地缓存真值或提交通道。
    </p>
  </SgjCard>
</template>
