<script setup lang="ts">
import { ref } from 'vue'
import {
  SgjButton, SgjCard, SgjStatusChip, SgjInput, SgjTextarea, SgjSelect, SgjDateTime,
  SgjCheckbox, SgjRadioGroup, SgjSwitch, SgjUpload, SgjCascader, SgjPersonPicker,
  SgjOrganizationPicker, SgjDialog, SgjDrawer, SgjToast, SgjToastRegion, SgjTable,
  SgjList, SgjEmpty, SgjLoading, SgjError, SgjPartialFailure, SgjNoPermission,
  SgjConflict, SgjMaskedValue, SgjStepUpReveal, SgjAvatar, SgjPersonRow, SgjRecordCard,
  SgjKpiCard, SgjPortalShell, SgjListPageTemplate, SgjDetailPageTemplate,
  SgjFormPageTemplate, SgjApprovalPageTemplate, SgjTimelinePageTemplate, SgjDashboardPageTemplate,
} from '@sgj/ui'
import type {
  ButtonVariant, ButtonSize, CardVariant, StatusTone, KpiTone, DrawerSide,
  AvatarSize, SelectOption, CascaderOption, ToastItem,
} from '@sgj/ui'

// ---- 交互状态 ----
const dialogOpen = ref(false)
const drawerOpen = ref(false)
const drawerSide = ref<DrawerSide>('right')
const city = ref('')
const gender = ref('')
const checked = ref(false)
const switchOn = ref(true)
const cascaderVal = ref<string[]>([])
const person = ref('')
const org = ref('')
const maskedRevealed = ref(false)
const stepRevealed = ref(false)
const toastItems = ref<ToastItem[]>([
  { id: 't1', tone: 'success', title: '保存成功', message: '考勤记录已更新' },
  { id: 't2', tone: 'warning', title: '待处理', message: '还有 3 条审批待你处理' },
])

function pushToast() {
  toastItems.value = [
    ...toastItems.value,
    { id: `t${Date.now()}`, tone: 'info', title: '已触发提示', message: '这是一条演示 Toast' },
  ]
}

// ---- 示例数据 ----
const cityOptions: SelectOption[] = [
  { value: 'bj', label: '北京' },
  { value: 'sh', label: '上海' },
  { value: 'gz', label: '广州' },
  { value: 'sz', label: '深圳', disabled: true },
]
const genderOptions: SelectOption[] = [
  { value: 'm', label: '男' },
  { value: 'f', label: '女' },
]
const cascadeOptions: CascaderOption[] = [
  { value: 'north', label: '华北', children: [{ value: 'bj', label: '北京' }, { value: 'tj', label: '天津' }] },
  { value: 'east', label: '华东', children: [{ value: 'sh', label: '上海' }, { value: 'hz', label: '杭州' }] },
]
const personOptions: SelectOption[] = [
  { value: 'p1', label: '张三（演艺中心）' },
  { value: 'p2', label: '李四（财人中心）' },
]
const orgOptions: SelectOption[] = [
  { value: 'o1', label: '总裁办' },
  { value: 'o2', label: '财人中心' },
]

const buttonVariants: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger']
const buttonSizes: ButtonSize[] = ['sm', 'md', 'lg']
const statusTones: StatusTone[] = ['neutral', 'info', 'success', 'warning', 'danger']
const kpiTones: KpiTone[] = ['neutral', 'danger']
const avatarSizes: AvatarSize[] = ['sm', 'md', 'lg']
const cardVariants: CardVariant[] = ['default', 'muted', 'spotlight']

const tableRows = [
  { name: '张三', dept: '演艺中心', status: '在职' },
  { name: '李四', dept: '财人中心', status: '试用' },
  { name: '王五', dept: '市场中心', status: '请假' },
]
</script>

<template>
  <div class="sc-root">
    <!-- 浮动 Toast 区 -->
    <SgjToastRegion :items="toastItems" @dismiss="(id) => (toastItems = toastItems.filter((t) => t.id !== id))" />

    <header class="sc-hero">
      <p class="eyebrow">Design System · L0 / L1 / L4</p>
      <h1>景运一体化运营平台 · UI 组件总览</h1>
      <p class="lead">本页集中展示仓库内已完成的 42 个公开组件（基础层 + 页面模板层）。无任何后端依赖，纯静态演示。</p>
      <nav class="sc-nav">
        <a href="#actions">动作</a>
        <a href="#inputs">表单输入</a>
        <a href="#data">数据展示</a>
        <a href="#feedback">反馈与状态</a>
        <a href="#security">敏感与安全</a>
        <a href="#overlays">浮层</a>
        <a href="#layout">布局与模板</a>
      </nav>
    </header>

    <!-- 动作类 -->
    <section id="actions" class="sc-section">
      <h2 class="sc-h2">动作类 · SgjButton</h2>
      <SgjCard>
        <div class="sc-grid">
          <div v-for="v in buttonVariants" :key="v" class="sc-cell">
            <div class="sc-label">variant = {{ v }}</div>
            <div class="sc-row">
              <SgjButton v-for="s in buttonSizes" :key="s" :variant="v" :size="s">{{ s }}</SgjButton>
            </div>
          </div>
          <div class="sc-cell">
            <div class="sc-label">禁用 / 加载</div>
            <div class="sc-row">
              <SgjButton disabled>禁用</SgjButton>
              <SgjButton :loading="true">加载中</SgjButton>
              <SgjButton block>块级按钮</SgjButton>
            </div>
          </div>
        </div>
      </SgjCard>
    </section>

    <!-- 表单输入 -->
    <section id="inputs" class="sc-section">
      <h2 class="sc-h2">表单输入类</h2>
      <div class="sc-2col">
        <SgjCard>
          <div class="sc-stack">
            <SgjInput label="姓名" placeholder="请输入姓名" />
            <SgjInput label="邮箱" type="email" placeholder="name@corp.com" error="邮箱格式不正确" />
            <SgjTextarea label="备注" placeholder="请输入备注信息" :rows="3" />
            <SgjDateTime label="开始日期" mode="date" />
            <SgjDateTime label="会议时间" mode="datetime" />
          </div>
        </SgjCard>
        <SgjCard>
          <div class="sc-stack">
            <SgjSelect label="城市" :options="cityOptions" v-model="city" />
            <SgjRadioGroup label="性别" :options="genderOptions" v-model="gender" />
            <SgjCheckbox label="我已阅读并同意相关条款" v-model="checked" />
            <SgjSwitch label="接收消息推送" v-model="switchOn" />
            <SgjCascader label="所属地区" :options="cascadeOptions" v-model="cascaderVal" />
            <SgjPersonPicker label="选择人员" :options="personOptions" v-model="person" />
            <SgjOrganizationPicker label="选择组织" :options="orgOptions" v-model="org" />
            <SgjUpload label="附件上传" accept=".pdf,.png" />
          </div>
        </SgjCard>
      </div>
    </section>

    <!-- 数据展示 -->
    <section id="data" class="sc-section">
      <h2 class="sc-h2">数据展示类</h2>
      <div class="sc-2col">
        <div class="sc-stack">
          <SgjCard>
            <div class="sc-label">SgjAvatar 尺寸</div>
            <div class="sc-row">
              <SgjAvatar v-for="s in avatarSizes" :key="s" name="张三" :size="s" />
            </div>
          </SgjCard>
          <SgjCard>
            <div class="sc-label">SgjStatusChip 语气</div>
            <div class="sc-row">
              <SgjStatusChip v-for="t in statusTones" :key="t" :tone="t">{{ t }}</SgjStatusChip>
            </div>
          </SgjCard>
          <SgjCard v-for="t in kpiTones" :key="t">
            <SgjKpiCard label="本月出勤率" :value="98.6" unit="%" definition="按排班应出勤天数计算" :tone="t" />
          </SgjCard>
          <SgjCard>
            <SgjPersonRow name="李四" subtitle="财务专员" meta="财人中心 · 工号 10231" />
          </SgjCard>
          <SgjRecordCard title="加班申请 #A2031" subtitle="2026-08-12 提交">
            <template #status><SgjStatusChip tone="warning">待审批</SgjStatusChip></template>
            申请人：王五 · 时长：3 小时 · 事由：活动保障
            <template #actions><SgjButton size="sm">查看</SgjButton></template>
          </SgjRecordCard>
        </div>
        <div class="sc-stack">
          <SgjCard>
            <div class="sc-label">SgjTable</div>
            <SgjTable caption="员工列表" :column-count="3">
              <template #head>
                <tr><th>姓名</th><th>部门</th><th>状态</th></tr>
              </template>
              <template #body>
                <tr v-for="r in tableRows" :key="r.name">
                  <td>{{ r.name }}</td><td>{{ r.dept }}</td><td>{{ r.status }}</td>
                </tr>
              </template>
            </SgjTable>
          </SgjCard>
          <SgjCard>
            <div class="sc-label">SgjList（分隔）</div>
            <SgjList divided aria-label="通知列表">
              <li class="sc-li">系统将于今晚 22:00 维护</li>
              <li class="sc-li">你有 2 条考勤异常待确认</li>
              <li class="sc-li">绩效面谈安排已发布</li>
            </SgjList>
          </SgjCard>
          <SgjCard>
            <div class="sc-label">SgjCard 变体</div>
            <div class="sc-stack">
              <SgjCard v-for="c in cardVariants" :key="c" :variant="c">
                <strong>variant = {{ c }}</strong>
                <p>这是一段示例内容，用于展示卡片容器的视觉效果。</p>
              </SgjCard>
            </div>
          </SgjCard>
        </div>
      </div>
    </section>

    <!-- 反馈与状态 -->
    <section id="feedback" class="sc-section">
      <h2 class="sc-h2">反馈与状态类</h2>
      <div class="sc-2col">
        <div class="sc-stack">
          <SgjCard><div class="sc-label">SgjToast（内联）</div><SgjToast tone="success" title="操作成功" message="数据已保存" /></SgjCard>
          <SgjCard>
            <div class="sc-label">SgjToastRegion（右下角浮动，见页面角落）</div>
            <SgjButton size="sm" @click="pushToast">再发一条 Toast</SgjButton>
          </SgjCard>
          <SgjCard><div class="sc-label">SgjLoading</div><SgjLoading /></SgjCard>
          <SgjCard><div class="sc-label">SgjEmpty</div><SgjEmpty title="暂无记录" description="当前筛选条件下没有数据" /></SgjCard>
        </div>
        <div class="sc-stack">
          <SgjCard><SgjError error-code="ERR-4001" trace-id="tr-9f2a" /></SgjCard>
          <SgjCard><SgjPartialFailure /></SgjCard>
          <SgjCard><SgjNoPermission /></SgjCard>
          <SgjCard><SgjConflict /></SgjCard>
        </div>
      </div>
    </section>

    <!-- 敏感与安全 -->
    <section id="security" class="sc-section">
      <h2 class="sc-h2">敏感信息安全类</h2>
      <div class="sc-2col">
        <SgjCard>
          <div class="sc-label">SgjMaskedValue（薪资/成绩明文需 Step-Up）</div>
          <div class="sc-row">
            <span>月薪：</span>
            <SgjMaskedValue value="¥ 28,500" :revealed="maskedRevealed" />
            <SgjButton size="sm" @click="maskedRevealed = !maskedRevealed">{{ maskedRevealed ? '隐藏' : '查看' }}</SgjButton>
          </div>
        </SgjCard>
        <SgjCard>
          <div class="sc-label">SgjStepUpReveal（字段级二次验证）</div>
          <SgjStepUpReveal :revealed="stepRevealed" @request-reveal="stepRevealed = true" @conceal="stepRevealed = false">
            <template #revealed><strong>身份证 110***********1234</strong></template>
          </SgjStepUpReveal>
        </SgjCard>
      </div>
    </section>

    <!-- 浮层 -->
    <section id="overlays" class="sc-section">
      <h2 class="sc-h2">浮层类（点击打开）</h2>
      <SgjCard>
        <div class="sc-row">
          <SgjButton @click="dialogOpen = true">打开 Dialog</SgjButton>
          <SgjButton @click="drawerOpen = true; drawerSide = 'right'">右侧 Drawer</SgjButton>
          <SgjButton @click="drawerOpen = true; drawerSide = 'left'">左侧 Drawer</SgjButton>
          <SgjButton @click="drawerOpen = true; drawerSide = 'bottom'">底部 Drawer</SgjButton>
        </div>
      </SgjCard>
      <SgjDialog :open="dialogOpen" title="确认提交" description="提交后将进入审批流程" @close="dialogOpen = false">
        <p>请确认信息无误。提交后可在「我的申请」中追踪进度。</p>
        <template #footer>
          <SgjButton variant="ghost" size="sm" @click="dialogOpen = false">取消</SgjButton>
          <SgjButton size="sm" @click="dialogOpen = false">确认提交</SgjButton>
        </template>
      </SgjDialog>
      <SgjDrawer :open="drawerOpen" :title="`抽屉示例（${drawerSide}）`" :side="drawerSide" @close="drawerOpen = false">
        <p>抽屉用于承载辅助编辑或详情查看，支持左侧 / 右侧 / 底部三种方向。</p>
        <SgjInput label="备注" placeholder="抽屉内的表单字段" />
      </SgjDrawer>
    </section>

    <!-- 布局与页面模板 -->
    <section id="layout" class="sc-section">
      <h2 class="sc-h2">布局与页面模板类（L4）</h2>

      <div class="sc-label">SgjPortalShell（端口骨架）</div>
      <div class="sc-shell-box">
        <SgjPortalShell portal-label="员工端" page-title="工作台">
          <template #header><SgjStatusChip tone="success">在线</SgjStatusChip></template>
          <template #sidebar>
            <SgjList aria-label="导航">
              <li class="sc-li">首页</li><li class="sc-li">我的申请</li><li class="sc-li">考勤</li>
            </SgjList>
          </template>
          <SgjCard>主内容区：组合 L1 / L3 组件的地方。</SgjCard>
        </SgjPortalShell>
      </div>

      <div class="sc-2col sc-mt">
        <SgjListPageTemplate title="列表页模板" description="用于表格/列表型页面">
          <template #actions><SgjButton size="sm">新建</SgjButton></template>
          <SgjCard>页面主体内容（表格、卡片列表等）。</SgjCard>
        </SgjListPageTemplate>
        <SgjDetailPageTemplate title="详情页模板" description="用于记录详情">
          <SgjRecordCard title="申请详情" subtitle="加班 #A2031">
            <p>这里放置详情字段与操作。</p>
          </SgjRecordCard>
        </SgjDetailPageTemplate>
      </div>
      <div class="sc-2col sc-mt">
        <SgjFormPageTemplate title="表单页模板" description="用于新建/编辑表单">
          <SgjInput label="标题" placeholder="请输入标题" />
          <SgjTextarea label="说明" :rows="3" />
        </SgjFormPageTemplate>
        <SgjApprovalPageTemplate title="审批页模板" description="用于审批决策">
          <template #actions><SgjButton size="sm" variant="danger">驳回</SgjButton><SgjButton size="sm">通过</SgjButton></template>
          <SgjCard>审批对象摘要与决策区。</SgjCard>
        </SgjApprovalPageTemplate>
      </div>
      <div class="sc-2col sc-mt">
        <SgjTimelinePageTemplate title="时间线模板" description="用于流程/事件时间线">
          <SgjList aria-label="时间线">
            <li class="sc-li">08-10 提交申请</li><li class="sc-li">08-11 主管审批</li><li class="sc-li">08-12 归档</li>
          </SgjList>
        </SgjTimelinePageTemplate>
        <SgjDashboardPageTemplate title="仪表盘模板" description="用于数据看板">
          <template #kpis>
            <SgjKpiCard label="今日访问" :value="1240" unit="人" definition="实时统计" />
            <SgjKpiCard label="异常" :value="3" unit="项" definition="需处理" tone="danger" />
          </template>
          <SgjCard>看板主图表区。</SgjCard>
        </SgjDashboardPageTemplate>
      </div>
    </section>

    <footer class="sc-foot">
      <p>共渲染 42 个已注册公开组件（不含 L2 平台复合层 / L3 领域层，二者在仓库中尚未实现）。</p>
    </footer>
  </div>
</template>

<style scoped>
.sc-root { max-width: 1180px; margin: 0 auto; padding: 28px 22px 80px; }
.sc-hero { margin-bottom: 28px; }
.sc-nav { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
.sc-nav a { font-size: 13px; color: var(--sgj-brand-700); text-decoration: none; padding: 4px 10px; border: 1px solid var(--sgj-border); border-radius: 999px; background: var(--sgj-surface); }
.sc-nav a:hover { background: var(--sgj-brand-50); }
.sc-section { margin-bottom: 38px; }
.sc-h2 { font-size: 20px; margin: 0 0 14px; padding-bottom: 8px; border-bottom: 2px solid var(--sgj-border); }
.sc-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.sc-stack { display: grid; gap: 16px; align-content: start; }
.sc-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
.sc-cell { display: grid; gap: 8px; }
.sc-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.sc-label { font-size: 13px; font-weight: 700; color: var(--sgj-text-tertiary); margin-bottom: 6px; }
.sc-li { padding: 8px 4px; }
.sc-mt { margin-top: 18px; }
.sc-shell-box { border: 1px solid var(--sgj-border); border-radius: var(--sgj-radius-lg); overflow: hidden; }
.sc-foot { margin-top: 40px; padding-top: 18px; border-top: 1px solid var(--sgj-border); color: var(--sgj-text-tertiary); font-size: 13px; }
@media (max-width: 820px) { .sc-2col { grid-template-columns: 1fr; } }
</style>
