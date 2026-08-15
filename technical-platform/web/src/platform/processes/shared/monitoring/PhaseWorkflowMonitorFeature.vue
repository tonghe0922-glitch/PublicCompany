<script setup lang="ts">
import { computed, watch } from 'vue'
import { SgjDashboardPageTemplate } from '@sgj/ui'

import type { MonitorProjectionResource } from '../../../../contracts'
import { usePortalSessionStore } from '../../../../session'
import P011PerformanceFeature from '../../../phase11/p011/P011PerformanceFeature.vue'
import P012PromotionFeature from '../../../phase11/p012/P012PromotionFeature.vue'
import P013RewardFeature from '../../../phase11/p013/P013RewardFeature.vue'
import P014DisciplineFeature from '../../../phase11/p014/P014DisciplineFeature.vue'
import P016CareMonitorFeature from '../../../phase11/p016/P016CareMonitorFeature.vue'
import type { PortalDefinition } from '../../../portal-config'
import { useP006Meeting } from '../../p006'
import { useP007Schedule } from '../../p007'
import { useP010Learning } from '../../p010'
import MonitorPanel from './MonitorPanel.vue'
import ProcessMetadataMonitorFeature from './ProcessMetadataMonitorFeature.vue'

const props = defineProps<{ portal: PortalDefinition; monitor: MonitorProjectionResource }>()
const session = usePortalSessionStore()
const state = computed(() => props.monitor.state.value)
const canP004Monitor = computed(() => session.can('p004.request.read'))
const canP005Monitor = computed(() => session.can('p005.notice.monitor'))
const canBaseMonitor = computed(() => canP004Monitor.value || canP005Monitor.value)
const showP006 = computed(() => session.can('p006.meeting.monitor'))
const showP007 = computed(() => session.can('p007.schedule.monitor'))
const showP010 = computed(() => session.can('p010.learning.monitor'))
const showP011 = computed(() => session.can('p011.performance.monitor'))
const showP012 = computed(() => session.can('p012.promotion.monitor'))
const showP013 = computed(() => session.can('p013.reward.monitor'))
const showP014 = computed(() => session.can('p014.discipline.monitor'))
const showP016 = computed(() => session.can('p016.welfare.monitor'))
const p006 = useP006Meeting({ mode: 'tech' })
const p007 = useP007Schedule({ mode: 'tech' })
const p010 = useP010Learning({ mode: 'tech' })
const p006Records = computed(() => (p006.records.state.value.data ?? [])
  .map(({ businessNo, currentNodeCode, status }) => ({ businessNo, currentNodeCode, status })))
const p007Records = computed(() => (p007.records.state.value.data ?? [])
  .map(({ businessNo, currentNodeCode, status }) => ({ businessNo, currentNodeCode, status })))
const p010Records = computed(() => (p010.records.state.value.data ?? [])
  .map(({ businessNo, currentNodeCode, status }) => ({ businessNo, currentNodeCode, status })))

watch([canP004Monitor, canP005Monitor], ([p004Allowed, p005Allowed]) => {
  if (p004Allowed || p005Allowed) void props.monitor.refresh()
}, { immediate: true })

</script>

<template>
  <section data-testid="phase09-tech-workflow-monitor" :data-state="state.phase">
    <SgjDashboardPageTemplate
      title="P004-P016 工作流监控"
      description="技术端仅装载获权流程的只读元数据投影；P015 保留独立规则监控路由。"
    >
      <MonitorPanel v-if="canBaseMonitor" data-monitor-refresh :resource="monitor" />
      <ProcessMetadataMonitorFeature
        v-if="showP006"
        process-code="P006"
        :records="p006Records"
        :phase="p006.records.state.value.phase"
        :load="p006.refresh"
      />
      <ProcessMetadataMonitorFeature
        v-if="showP007"
        process-code="P007"
        :records="p007Records"
        :phase="p007.records.state.value.phase"
        :load="p007.refresh"
      />
      <ProcessMetadataMonitorFeature
        v-if="showP010"
        process-code="P010"
        :records="p010Records"
        :phase="p010.records.state.value.phase"
        :load="p010.refresh"
      />
      <P011PerformanceFeature v-if="showP011" :portal="portal" mode="tech" />
      <P012PromotionFeature v-if="showP012" :portal="portal" mode="tech" />
      <P013RewardFeature v-if="showP013" :portal="portal" mode="tech" />
      <P014DisciplineFeature v-if="showP014" :portal="portal" mode="tech" />
      <P016CareMonitorFeature v-if="showP016" />
    </SgjDashboardPageTemplate>
  </section>
</template>
