<script setup lang="ts">
import { SgjCard, SgjMaskedValue } from '@sgj/ui'
import type { P009OvertimeRecord } from './contracts'

defineProps<{ overtime: P009OvertimeRecord }>()
</script>

<template>
  <SgjCard as="section" variant="muted">
    <template #header><strong>补偿与回执安全投影</strong></template>
    <dl>
      <div><dt>补偿方案</dt><dd>{{ overtime.schemeType ?? '—' }}</dd></div>
      <div><dt>实际金额</dt><dd><SgjMaskedValue :value="overtime.actualAmount == null ? '' : String(overtime.actualAmount)" masked-label="敏感金额已脱敏" /></dd></div>
      <div><dt>外部回执</dt><dd><SgjMaskedValue :value="overtime.receiptReference ?? ''" masked-label="敏感回执已脱敏" /></dd></div>
    </dl>
    <p data-sensitive-contract-blocked role="status">BLOCKED_BY_CONTRACT：缺少权威会话级敏感事实揭示与 step-up 结果合同；本组件仅显示默认脱敏投影。</p>
  </SgjCard>
</template>

<style scoped>dl{display:grid;gap:var(--sgj-space-3)}dl div{display:grid;grid-template-columns:minmax(7rem,auto) 1fr;gap:var(--sgj-space-3)}dt{font-weight:600}</style>
