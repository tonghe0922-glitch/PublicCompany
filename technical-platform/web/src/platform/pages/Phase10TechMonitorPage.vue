<script setup lang="ts">
import { onMounted,ref } from 'vue'
import { usePortalSessionStore } from '../../session'
import type { PortalDefinition } from '../portal-config'
type Process='P008'|'P009'|'P010'
const props=defineProps<{portal:PortalDefinition;processes:Process[]}>(),session=usePortalSessionStore(),rows=ref<Record<string,unknown[]>>({}),busy=ref(false),feedback=ref('')
function endpoint(p:Process){return p==='P008'?'/api/v1/processes/P008/leaves':p==='P009'?'/api/v1/processes/P009/overtime-requests':'/api/v1/processes/P010/assignments'}
async function load(){busy.value=true;feedback.value='';try{const next:Record<string,unknown[]>={};for(const p of props.processes)next[p]=await session.request<unknown[]>(endpoint(p));rows.value=next}catch(e){feedback.value=e instanceof Error?e.message:'监控数据加载失败'}finally{busy.value=false}}
onMounted(()=>void load())
</script>
<template><main class="phase09-page" data-testid="phase10-tech-monitor"><header><p class="phase09-kicker">PHASE-10 · TECH</p><h1>公共能力运行监控</h1><p>技术端仅查看服务端 metadata、工作流状态和集成运行事实；不提供请假审批、加班审批或 P010 专业认证能力。</p></header><p v-if="feedback" class="phase09-feedback">{{feedback}}</p><section v-for="process in processes" :key="process" class="phase09-card"><h2>{{process}} 运行投影</h2><pre>{{JSON.stringify(rows[process]??[],null,2)}}</pre></section><button :disabled="busy" @click="load">刷新监控</button></main></template>
