export type NavigationIconKey =
  | 'home' | 'contacts' | 'tasks' | 'approvals' | 'notices' | 'meetings'
  | 'learning' | 'shows' | 'expense' | 'services' | 'messages' | 'center' | 'authz'

export type CatalogMobileAccess = 'primary' | 'more'
export interface NavigationCatalogChild { readonly key: string; readonly label: string; readonly aliases?: readonly string[] }
export interface NavigationCatalogSection {
  readonly key: string; readonly label: string; readonly aliases?: readonly string[]; readonly iconKey: NavigationIconKey
  readonly children?: readonly NavigationCatalogChild[]; readonly mobileAccess: CatalogMobileAccess
  readonly centerScoped?: boolean; readonly portalCodes?: readonly ('work' | 'tech')[]
}

export const NAVIGATION_CATALOG: readonly NavigationCatalogSection[] = [
  { key:'home', label:'我的工作台', aliases:['首页','工作台','员工工作台','中心工作台','技术工作台'], iconKey:'home', mobileAccess:'primary' },
  { key:'contacts', label:'企业通讯录', aliases:['通讯录','组织通讯录','员工通讯录'], iconKey:'contacts', mobileAccess:'more' },
  { key:'tasks', label:'待办与任务', aliases:['待办','任务','任务中心'], iconKey:'tasks', mobileAccess:'primary', children:[
    {key:'tasks-overview',label:'总体概况',aliases:['任务概况','待办概况']},{key:'tasks-mine',label:'我的待办',aliases:['待办事项','我的任务','任务清单']},{key:'tasks-created',label:'我发起的',aliases:['我发起的任务','发起任务']},{key:'tasks-assign',label:'任务分配',aliases:['分派任务','任务派发','中心任务']}] },
  { key:'approvals', label:'审批与申请', aliases:['审批','申请','申请审批'], iconKey:'approvals', mobileAccess:'primary', children:[
    {key:'approvals-inbox',label:'待我审批',aliases:['审批待办','审批队列','中心受理']},{key:'approvals-created',label:'我发起的审批',aliases:['我的申请','申请记录','发起审批']},{key:'approvals-permissions',label:'审批权限',aliases:['审批授权','审批权限管理']}] },
  { key:'notices', label:'通知与制度', aliases:['通知','制度','公告','通知公告'], iconKey:'notices', mobileAccess:'more', children:[
    {key:'notices-list',label:'通知公告',aliases:['公告列表','通知列表','制度通知']},{key:'notices-sign',label:'待签制度',aliases:['待签署制度','制度签署']},{key:'notices-receipts',label:'我的回执',aliases:['通知回执','制度回执','签署回执']}] },
  { key:'meetings', label:'例会与会议', aliases:['会议','例会'], iconKey:'meetings', mobileAccess:'more', children:[
    {key:'meetings-overview',label:'例会概况',aliases:['会议概况','会议详情']},{key:'meetings-schedule',label:'例会排期',aliases:['会议排期','会议日程']},{key:'meetings-booking',label:'会议预约',aliases:['预约会议','会议室预约']},{key:'meetings-minutes',label:'会议纪要',aliases:['纪要','行动项']}] },
  { key:'learning', label:'学习与成长', aliases:['学习','培训','成长'], iconKey:'learning', mobileAccess:'more', children:[
    {key:'learning-training',label:'培训学习',aliases:['学习任务','培训任务','在线考试','实操任务']},{key:'learning-review',label:'双向评议',aliases:['评议','评价']},{key:'learning-qualifications',label:'学历与证书',aliases:['资格证书','资质证书','学历证书']},{key:'learning-points',label:'成长积分',aliases:['积分','成长积分台账']}] },
  { key:'shows', label:'演出节目', aliases:['演出','节目','节目排期'], iconKey:'shows', mobileAccess:'more', children:[{key:'shows-program',label:'节目单',aliases:['演出节目单','节目列表']},{key:'shows-mine',label:'我的场次',aliases:['我的演出','演出场次']}] },
  { key:'expense', label:'报销与经费', aliases:['报销','经费','费用'], iconKey:'expense', mobileAccess:'more', children:[{key:'expense-request',label:'报销申请',aliases:['费用申请','经费申请']},{key:'expense-status',label:'状态查询',aliases:['报销状态','申请进度']},{key:'expense-ledger',label:'经费台账',aliases:['费用台账','报销台账']}] },
  { key:'services', label:'个人综合服务', aliases:['个人服务','个人中心','员工服务'], iconKey:'services', mobileAccess:'more', children:[{key:'services-profile',label:'个人资料',aliases:['个人信息','档案信息','资料变更']},{key:'services-health',label:'健康档案',aliases:['健康信息']},{key:'services-benefits',label:'福利待遇',aliases:['员工福利','福利']},{key:'services-attendance',label:'考勤休假',aliases:['考勤','休假','请假','调休','加班']}] },
  { key:'messages', label:'站内通信', aliases:['消息','站内消息','内部通信'], iconKey:'messages', mobileAccess:'primary' },
  { key:'authz', label:'权限与模块配置', aliases:['权限配置','模块权限','授权配置'], iconKey:'authz', mobileAccess:'more', portalCodes:['tech'], children:[{key:'authz-modules',label:'模块目录',aliases:['模块管理','功能模块']},{key:'authz-preview',label:'配置预览',aliases:['权限预览','多角色模拟']}] },
  { key:'center', label:'中心事务', aliases:['中心工作','中心业务','部门事务'], iconKey:'center', mobileAccess:'more', centerScoped:true, children:[{key:'center-expense',label:'报销与采购',aliases:['采购','中心报销','采购管理']},{key:'center-attendance',label:'考勤状况',aliases:['考勤管理','人员考勤']},{key:'center-opinion',label:'舆情与商标',aliases:['舆情','商标','舆情监控']},{key:'center-activity',label:'活动筹备',aliases:['活动管理','活动策划','活动执行']},{key:'center-design',label:'设计与视频',aliases:['设计','视频','素材制作']},{key:'center-news',label:'新闻与发布',aliases:['新闻','发布','内容发布']},{key:'center-archive',label:'归档',aliases:['档案','资料归档']}] },
] as const
