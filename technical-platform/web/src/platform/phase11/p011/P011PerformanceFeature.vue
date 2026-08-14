<script setup lang="ts">
import {
  SgjButton, SgjCard, SgjCheckbox, SgjConflict, SgjDateTime, SgjEmpty,
  SgjError, SgjInput, SgjListPageTemplate, SgjLoading, SgjNoPermission,
  SgjRecordCard, SgjSelect, SgjStatusChip, SgjTextarea,
} from '@sgj/ui'
import { isPending } from '../process-state'
import { useP011Performance } from './use-p011-performance'
import type { P011Props } from './use-p011-performance'

const props = defineProps<P011Props>()
const {
  session, records, businessDate, subject, reason, ownerEmployeeId, contentVersion,
  periodOrCourseNo, score1000, appealRaised, executionType, externalReference,
  resultSummary, evidenceNote, isCenter, isTech, canRead, listState, createState,
  executionOptions, load, create, perform, actions, actionState, actionPending,
} = useP011Performance(props)
</script>

<template>
  <SgjListPageTemplate
    data-testid="p011-page"
    :title="isTech ? '绩效流程元数据监控' : isCenter ? '绩效评价、校准与执行' : '我的绩效周期'"
    :description="isTech ? '技术端仅显示流程元数据，不能评价或校准。' : '评价、计算、校准和执行分别保存为不可变事实。'"
  >
    <template #actions>
      <SgjButton variant="secondary" :disabled="!canRead" :loading="isPending(listState)" @click="load">刷新</SgjButton>
    </template>
    <SgjNoPermission v-if="!canRead" />
    <template v-else>
      <SgjCard v-if="isCenter">
        <template #header><h2>建立绩效目标</h2></template>
        <div class="phase11-form-grid">
          <SgjInput v-model="subject" label="绩效周期主题" placeholder="绩效周期主题" required />
          <SgjInput v-model="ownerEmployeeId" label="员工 ID" placeholder="员工 ID" required />
          <SgjDateTime v-model="businessDate" label="业务日期" required />
          <SgjInput v-model="contentVersion" label="内容版本" placeholder="内容版本" required />
          <SgjInput v-model="periodOrCourseNo" label="周期编号" placeholder="周期编号" required />
          <SgjTextarea v-model="reason" label="原因" placeholder="原因" />
          <SgjTextarea v-model="evidenceNote" label="不可变证据" placeholder="不可变证据" required />
        </div>
        <template #footer>
          <SgjButton :disabled="!session.can('p011.performance.manage')" :loading="isPending(createState)" @click="create">创建周期</SgjButton>
        </template>
      </SgjCard>
      <SgjCard v-if="!isTech">
        <template #header><h2>节点输入</h2></template>
        <div class="phase11-form-grid">
          <SgjInput v-model="score1000" label="千分制分数" placeholder="千分制分数" type="number" min="0" max="1000" />
          <SgjCheckbox v-model="appealRaised" label="提出申诉" />
          <SgjSelect v-model="executionType" label="执行类型" :options="executionOptions" />
          <SgjInput v-model="externalReference" label="外部执行引用" placeholder="外部执行引用" />
          <SgjInput v-model="resultSummary" label="结果摘要" placeholder="结果摘要" />
          <SgjTextarea v-model="evidenceNote" label="节点证据" placeholder="节点证据" />
        </div>
      </SgjCard>
      <SgjLoading v-if="isPending(listState) && records.length === 0" />
      <SgjNoPermission v-else-if="listState.failure === 'no-permission'" :description="listState.message" />
      <SgjError
        v-else-if="listState.failure === 'error'"
        title="绩效记录加载失败"
        :description="listState.message"
        :error-code="listState.errorCode"
        :trace-id="listState.traceId"
      >
        <template #actions><SgjButton @click="load">重试</SgjButton></template>
      </SgjError>
      <SgjConflict v-else-if="listState.failure === 'conflict'" :description="listState.message">
        <template #actions><SgjButton @click="load">刷新最新事实</SgjButton></template>
      </SgjConflict>
      <SgjEmpty v-else-if="records.length === 0" title="暂无绩效周期" />
      <div v-else class="phase11-records">
        <SgjRecordCard
          v-for="item in records"
          :key="item.id"
          class="record"
          :title="`${item.businessNo} · ${item.subject}`"
          :subtitle="`${item.currentNodeCode ?? 'END'} · v${item.versionNo}`"
          :data-cycle-id="item.id"
        >
          <template #status><SgjStatusChip>{{ item.status }}</SgjStatusChip></template>
          <template v-if="!isTech">
            <p>最终投影：{{ item.score1000 ?? '未形成' }}；申诉：{{ item.appealStatus ?? '未确认' }}</p>
            <ul>
              <li v-for="fact in item.scores" :key="fact.id">{{ fact.scoreType }}：{{ fact.score1000 }}</li>
            </ul>
            <template v-for="candidate in actions(item)" :key="candidate.code">
              <SgjConflict
                v-if="actionState(item, candidate).failure === 'conflict'"
                :description="actionState(item, candidate).message"
              />
              <SgjError
                v-else-if="['error', 'no-permission'].includes(actionState(item, candidate).failure)"
                :title="`${candidate.label}失败`"
                :description="actionState(item, candidate).message"
                :error-code="actionState(item, candidate).errorCode"
                :trace-id="actionState(item, candidate).traceId"
              />
            </template>
          </template>
          <p v-else>员工、分数、申诉、证据和执行结果均已屏蔽。</p>
          <template #actions>
            <SgjButton
              v-for="candidate in actions(item)"
              :key="candidate.code"
              :data-action="candidate.code"
              :loading="actionPending(item, candidate)"
              @click="perform(item, candidate)"
            >{{ candidate.label }}</SgjButton>
          </template>
        </SgjRecordCard>
      </div>
      <SgjError
        v-if="['error', 'no-permission'].includes(createState.failure)"
        title="创建绩效周期失败"
        :description="createState.message"
        :error-code="createState.errorCode"
        :trace-id="createState.traceId"
      />
      <SgjConflict v-if="createState.failure === 'conflict'" :description="createState.message" />
    </template>
  </SgjListPageTemplate>
</template>

<style scoped>
.phase11-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: var(--sgj-space-4); }
.phase11-records { display: grid; gap: var(--sgj-space-4); }
</style>
