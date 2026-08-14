import { expect, type Page } from '@playwright/test'
import {
  centerBase,
  courseVersionId,
  employeeBase,
  employeeId,
  managerId,
} from './phase10-live-support'

export async function verifyEmployeeFormReset(page: Page): Promise<void> {
  await page.goto(`${employeeBase}#/employee/03/01/01`)
  await page.getByLabel('申请主题').fill('P008 UI reset verification')
  await page.getByLabel('开始时间').fill('2031-02-01T09:00')
  await page.getByLabel('结束时间').fill('2031-02-01T17:00')
  await page.getByLabel('工作代理人 UUID').fill(managerId)
  await page.getByLabel('请假原因').fill('P008 reset reason must not remain')
  await page.getByRole('button', { name: '提交请假申请' }).click()
  await expect(page.getByText('请假申请已提交并进入额度预占流程')).toBeVisible()
  await expect(page.getByLabel('申请主题')).toHaveValue('')
  await expect(page.getByLabel('请假原因')).toHaveValue('')
  await expect(page.getByLabel('工作代理人 UUID')).toHaveValue('')

  await page.goto(`${employeeBase}#/employee/03/01/06`)
  await page.getByLabel('任务主题').fill('P009 UI reset verification')
  await page.getByLabel('计划开始').fill('2031-04-01T10:00')
  await page.getByLabel('计划结束').fill('2031-04-01T12:00')
  await page.getByLabel('必要性说明').fill('P009 reset reason must not remain')
  await page.getByRole('button', { name: '提交加班申请' }).click()
  await expect(page.getByText('加班申请已提交并进入必要性校验')).toBeVisible()
  await expect(page.getByLabel('任务主题')).toHaveValue('')
  await expect(page.getByLabel('必要性说明')).toHaveValue('')
}

export async function verifyCenterFormReset(page: Page): Promise<void> {
  await page.goto(`${centerBase}#/center/06/03/07`)
  await page.getByLabel('学习任务').fill('P010 UI reset verification')
  await page.getByLabel('目标员工 UUID').fill(employeeId)
  await page.getByLabel('内容版本').fill('V2031.UI.RESET')
  await page.getByLabel('课程版本 ID').fill(courseVersionId)
  await page.getByLabel('课程负责团队').fill('PHASE-10 UI reset team')
  await page.getByLabel('期次/课程编号').fill('P010-UI-RESET')
  await page.getByLabel('指派原因').fill('P010 reset reason must not remain')
  await page.getByRole('button', { name: '创建学习任务' }).click()
  await expect(page.getByText('学习任务已创建，等待课程版本发布')).toBeVisible()
  await expect(page.getByLabel('学习任务')).toHaveValue('')
  await expect(page.getByLabel('目标员工 UUID')).toHaveValue('')
  await expect(page.getByLabel('内容版本')).toHaveValue('')
  await expect(page.getByLabel('指派原因')).toHaveValue('')
}
