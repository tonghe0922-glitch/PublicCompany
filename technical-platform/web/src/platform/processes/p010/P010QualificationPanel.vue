<script setup lang="ts">
import { SgjCard, SgjMaskedValue } from '@sgj/ui'
import type { P010LearningRecord } from './contracts'

defineProps<{ learning: P010LearningRecord }>()
</script>

<template>
  <SgjCard as="section" variant="muted">
    <template #header><strong>学习与资格安全投影</strong></template>
    <dl>
      <div><dt>课程版本</dt><dd>{{ learning.courseVersionId }}</dd></div>
      <div><dt>内容版本</dt><dd>{{ learning.contentVersion }}</dd></div>
      <div><dt>课程团队</dt><dd>{{ learning.courseTeamName }}</dd></div>
      <div><dt>周期/课程编号</dt><dd>{{ learning.periodOrCourseNo }}</dd></div>
      <div><dt>学习进度</dt><dd>{{ learning.completionRate }}%</dd></div>
      <div><dt>考试成绩</dt><dd><SgjMaskedValue :value="learning.score1000 == null ? '' : String(learning.score1000)" masked-label="考试成绩已脱敏" /></dd></div>
      <div><dt>实操结果</dt><dd><SgjMaskedValue :value="learning.practicalResult ?? ''" masked-label="实操结果已脱敏" /></dd></div>
      <div><dt>资格生效日</dt><dd><SgjMaskedValue :value="learning.qualificationEffectiveDate ?? ''" masked-label="资格日期已脱敏" /></dd></div>
      <div><dt>资格到期日</dt><dd><SgjMaskedValue :value="learning.qualificationExpireDate ?? ''" masked-label="资格日期已脱敏" /></dd></div>
    </dl>
    <p data-sensitive-contract-blocked role="status">
      BLOCKED_BY_CONTRACT：缺少权威会话级 step-up 与逐次揭示合同；考试、实操、资格日期和事件证据只显示默认脱敏投影。
    </p>
  </SgjCard>
</template>

<style scoped>dl{display:grid;gap:var(--sgj-space-3)}dl div{display:grid;grid-template-columns:minmax(8rem,auto) 1fr;gap:var(--sgj-space-3)}dt{font-weight:600}</style>
