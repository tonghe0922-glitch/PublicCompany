# PHASE-02–29 PROCESS WORKLIST

> 本清单以仓库根目录 `Construction Master Schedule.csv` 为唯一阶段基准；P001–P126 的流程名称沿用既有 catalog，不重新定义业务规则。若本文件与总施工计划存在冲突，以 `Construction Master Schedule.csv` 为准。

## 对齐规则

- PHASE-02–08 为工程基础与共享内核阶段，不分配 P 编号业务流程。
- P001–P126 从 PHASE-09 开始，严格按总施工计划规定的阶段范围归属。
- 每个阶段都必须满足总施工计划中的核心门槛与 GitHub 阶段门禁后，方可进入下一阶段。

## PHASE-02｜仓库工程骨架、构建系统与开发环境

- **范围**：工程骨架
- **核心门槛**：前后端/Worker可编译
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录
- **流程分配**：无。该阶段为基础工程/共享能力建设阶段。

## PHASE-03｜数据库三库、Schema、Flyway 与基础角色

- **范围**：数据库基线
- **核心门槛**：空库Flyway成功/RLS
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录
- **流程分配**：无。该阶段为基础工程/共享能力建设阶段。

## PHASE-04｜Core IAM、组织、员工、任职、会话与权限内核

- **范围**：IAM/ORG
- **核心门槛**：RBAC+ABAC+RLS可测
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录
- **流程分配**：无。该阶段为基础工程/共享能力建设阶段。

## PHASE-05｜统一流程引擎、表单版本、任务、SLA 与编排内核

- **范围**：Workflow
- **核心门槛**：状态机/版本/SLA可测
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录
- **流程分配**：无。该阶段为基础工程/共享能力建设阶段。

## PHASE-06｜文档、附件、通知、审计、Integration、Outbox/Inbox 内核

- **范围**：Document/Outbox/Worker
- **核心门槛**：Outbox/Inbox/DLQ/文件证据
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录
- **流程分配**：无。该阶段为基础工程/共享能力建设阶段。

## PHASE-07｜前端 Design System 与共享组件库

- **范围**：Design System
- **核心门槛**：设计系统组件测试
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录
- **流程分配**：无。该阶段为基础工程/共享能力建设阶段。

## PHASE-08｜三端 Portal Shell、Router、导航、Session 与 API Client

- **范围**：三端壳
- **核心门槛**：三端可build/login壳
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录
- **流程分配**：无。该阶段为基础工程/共享能力建设阶段。

## PHASE-09｜P001–P005 公共能力 A

- **范围**：P001–P005
- **核心门槛**：5流程三端闭环
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录

| Process | Name |
| --- | --- |
| P001 | 统一登录与多岗位身份切换 |
| P002 | 权限申请、复核与回收 |
| P003 | 个人资料变更 |
| P004 | 通用申请与审批 |
| P005 | 制度、通知与执行回执 |

## PHASE-10｜P006–P010 公共能力 B

- **范围**：P006–P010
- **核心门槛**：5流程三端闭环
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录

| Process | Name |
| --- | --- |
| P006 | 会议与行动项 |
| P007 | 排班与班次调整 |
| P008 | 请假与考勤 |
| P009 | 加班与调休 |
| P010 | 员工学习、考试与资格 |

## PHASE-11｜P011–P016 绩效成长福利

- **范围**：P011–P016
- **核心门槛**：6流程三端闭环
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录

| Process | Name |
| --- | --- |
| P011 | 绩效管理 |
| P012 | 晋升与任职发展 |
| P013 | 奖励 |
| P014 | 纪律、责任与申诉 |
| P015 | 成长积分与荣誉积分 |
| P016 | 员工福利与关怀 |

## PHASE-12｜P017–P020 签署、导入导出、数据质量

- **范围**：P017–P020
- **核心门槛**：4高风险公共流程
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录

| Process | Name |
| --- | --- |
| P017 | 电子签署 |
| P018 | 数据导入 |
| P019 | 敏感导出与文件下载 |
| P020 | 数据质量与修复 |

## PHASE-13｜P021–P023 总裁办经营治理

- **范围**：P021–P023
- **核心门槛**：3经营流程
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录

| Process | Name |
| --- | --- |
| P021 | 经营会议闭环 |
| P022 | 总裁指令闭环 |
| P023 | 重大事项升级 |

## PHASE-14｜P024–P027 财务核心

- **范围**：P024–P027
- **核心门槛**：4财务流程幂等可靠
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录

| Process | Name |
| --- | --- |
| P024 | 预算闭环 |
| P025 | 报销闭环 |
| P026 | 借款核销 |
| P027 | 跨系统对账 |

## PHASE-15｜P028–P030 人员生命周期

- **范围**：P028–P030
- **核心门槛**：人员生命周期
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录

| Process | Name |
| --- | --- |
| P028 | 录用入职闭环 |
| P029 | 调岗闭环 |
| P030 | 离职闭环 |

## PHASE-16｜P031–P033 档案

- **范围**：P031–P033
- **核心门槛**：档案敏感闭环
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录

| Process | Name |
| --- | --- |
| P031 | 归档接收 |
| P032 | 借阅归还 |
| P033 | 销毁鉴定 |

## PHASE-17｜P034–P039 采购与票务

- **范围**：P034–P039
- **核心门槛**：采购/票务幂等
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录

| Process | Name |
| --- | --- |
| P034 | 标准采购 |
| P035 | 紧急采购 |
| P036 | 退换货 |
| P037 | 售检票闭环 |
| P038 | 退款改签 |
| P039 | 离线检票 |

## PHASE-18｜P040–P045 市场与教育

- **范围**：P040–P045
- **核心门槛**：市场教育
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录

| Process | Name |
| --- | --- |
| P040 | 商机推进 |
| P041 | 市场活动 |
| P042 | 渠道准入 |
| P043 | 课程产品上线 |
| P044 | 研学团队交付 |
| P045 | 讲师排课 |

## PHASE-19｜P046–P049 行政办公室

- **范围**：P046–P049
- **核心门槛**：行政
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录

| Process | Name |
| --- | --- |
| P046 | 通知执行 |
| P047 | 正式公文 |
| P048 | 会议行动 |
| P049 | 大型活动 |

## PHASE-20｜P050–P053 资产仓储

- **范围**：P050–P053
- **核心门槛**：资产流水
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录

| Process | Name |
| --- | --- |
| P050 | 入库 |
| P051 | 领借调还 |
| P052 | 盘点 |
| P053 | 报废处置 |

## PHASE-21｜P054–P061 后勤餐饮

- **范围**：P054–P061
- **核心门槛**：后勤餐饮
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录

| Process | Name |
| --- | --- |
| P054 | 派车 |
| P055 | 车辆事故 |
| P056 | 宿舍入住退宿 |
| P057 | 报修 |
| P058 | 团餐交付 |
| P059 | 食材验收 |
| P060 | 食品安全事件 |
| P061 | 餐卡结算 |

## PHASE-22｜P062–P071 物业中心

- **范围**：P062–P071
- **核心门槛**：物业整改
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录

| Process | Name |
| --- | --- |
| P062 | 日常巡逻 |
| P063 | 客流预警 |
| P064 | 安全事件 |
| P065 | 活动安保 |
| P066 | 日常清洁 |
| P067 | 污染应急 |
| P068 | 活动保障 |
| P069 | 商户准入 |
| P070 | 日常巡检 |
| P071 | 退场 |

## PHASE-23｜P072–P078 演艺表演与服化道

- **范围**：P072–P078
- **核心门槛**：演艺场次
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录

| Process | Name |
| --- | --- |
| P072 | 节目上线 |
| P073 | 场次执行 |
| P074 | 临时缺员 |
| P075 | 停演 |
| P076 | 场次准备 |
| P077 | 损坏报损 |
| P078 | 盘点 |

## PHASE-24｜P079–P084 无人机与演艺技术

- **范围**：P079–P084
- **核心门槛**：技术建议≠业务决定
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录

| Process | Name |
| --- | --- |
| P079 | 飞行任务 |
| P080 | 任务取消 |
| P081 | 飞行事故 |
| P082 | 场次技术保障 |
| P083 | 设备故障 |
| P084 | 停演技术建议 |

## PHASE-25｜P085–P094 网络、IT、研发、发布

- **范围**：P085–P094
- **核心门槛**：IT发布恢复
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录

| Process | Name |
| --- | --- |
| P085 | 网络故障 |
| P086 | 网络变更 |
| P087 | 活动保障 |
| P088 | IT服务请求 |
| P089 | 生产发布 |
| P090 | 账号执行 |
| P091 | 恢复演练 |
| P092 | 需求开发 |
| P093 | 缺陷修复 |
| P094 | 版本发布 |

## PHASE-26｜P095–P100 企划内容

- **范围**：P095–P100
- **核心门槛**：内容版本
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录

| Process | Name |
| --- | --- |
| P095 | 宣传物料制作 |
| P096 | 拍摄任务 |
| P097 | 返工变更 |
| P098 | 策划项目 |
| P099 | 方案变更 |
| P100 | 活动策划移交 |

## PHASE-27｜P101–P111 新媒体与品牌

- **范围**：P101–P111
- **核心门槛**：OTA/品牌外部可靠性
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录

| Process | Name |
| --- | --- |
| P101 | 产品上架 |
| P102 | OTA订单 |
| P103 | 退款 |
| P104 | 评价客诉 |
| P105 | 短视频发布 |
| P106 | 直播执行 |
| P107 | 投放 |
| P108 | 舆情 |
| P109 | 品牌授权 |
| P110 | 物料审核 |
| P111 | 侵权处理 |

## PHASE-28｜P112–P119 运营中心

- **范围**：P112–P119
- **核心门槛**：运营销售
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录

| Process | Name |
| --- | --- |
| P112 | 标准接待 |
| P113 | 临时变更 |
| P114 | 导游执行 |
| P115 | 接待客诉 |
| P116 | 线索转商机 |
| P117 | 销售成交 |
| P118 | 二次销售 |
| P119 | 客户移交 |

## PHASE-29｜P120–P126 跨中心黄金路径

- **范围**：P120–P126
- **核心门槛**：黄金路径不复制子单
- **GitHub 阶段门禁**：commit + push agent/full-build；远端SHA验证；PR/CI状态记录

| Process | Name |
| --- | --- |
| P120 | 全员生命周期闭环 |
| P121 | 市场获客到交付回款闭环 |
| P122 | 接待资源闭环 |
| P123 | 演艺场次闭环 |
| P124 | 采购资产财务闭环 |
| P125 | 内容生产发布闭环 |
| P126 | 事件与整改闭环 |
