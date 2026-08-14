import { test } from '@playwright/test'
import { runCollaborationFlows } from './phase10-live-p006-p007'
import { runWorkforceFlows } from './phase10-live-p008-p010'
import {
  apiLogin,
  centerBase,
  centerRoutes,
  employeeBase,
  employeeLogin,
  employeeRoutes,
  loginPortal,
  managerLogin,
  outLogin,
  techBase,
  techLogin,
  techRoutes,
  verifyRoutes,
} from './phase10-live-support'
import { verifyTechProjection, verifyTechUi } from './phase10-live-verification'

test('P006-P010 real PostgreSQL workflows close with three-portal scope, idempotency and monitoring', async ({
  page,
  request,
}) => {
  const employeeToken = await apiLogin(request, employeeLogin)
  const managerToken = await apiLogin(request, managerLogin)
  const techToken = await apiLogin(request, techLogin)
  const outToken = await apiLogin(request, outLogin)

  await loginPortal(page, employeeBase, employeeLogin, '员工工作入口')
  await verifyRoutes(page, employeeBase, employeeRoutes)
  await loginPortal(page, centerBase, managerLogin, '中心管理工作入口')
  await verifyRoutes(page, centerBase, centerRoutes)
  await loginPortal(page, techBase, techLogin, '技术运行工作入口')
  await verifyRoutes(page, techBase, techRoutes)

  const { meeting, shift } = await runCollaborationFlows(
    request, employeeToken, managerToken, outToken,
  )
  const { leave, overtime, learning } = await runWorkforceFlows(
    request, employeeToken, managerToken, outToken,
  )
  await verifyTechProjection(request, techToken, meeting, leave, overtime, learning)
  await verifyTechUi(page, meeting, shift, leave, overtime, learning)
})
