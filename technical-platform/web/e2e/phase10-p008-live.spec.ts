import { randomUUID } from 'node:crypto'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const tenantCode=required('PHASE10_P008_TENANT'),managerLogin=required('PHASE10_P008_LOGIN'),password=required('PHASE10_P008_PASSWORD')
const employeeLogin='phase10.p008.employee',reviewerLogin='phase10.p008.reviewer',techLogin='phase10.p008.tech',outLogin='phase10.p008.out'
const api='http://127.0.0.1:18088',employeeBase='http://127.0.0.1:5316/employee.html',centerBase='http://127.0.0.1:5317/center.html',techBase='http://127.0.0.1:5318/admin.html'
interface Leave{id:string;businessNo:string;subject:string;currentNodeCode:string;status:string;versionNo:number;reason:string|null;quotaAccountId:string|null;handoverAgentId:string|null;actualEndAt:string|null;actualAttendanceSummary:string|null}
interface QuotaEntry{entryType:string;availableAfter:number;reservedAfter:number;consumedAfter:number;quotaAccountId:string|null}
function required(name:string){const value=process.env[name];if(!value)throw new Error(`required E2E environment missing: ${name}`);return value}
function headers(token:string){return{Authorization:`Bearer ${token}`}}
async function apiLogin(request:APIRequestContext,loginName:string){const response=await request.post(`${api}/api/v1/auth/login`,{data:{tenantCode,loginName,password}});expect(response.status()).toBe(200);return((await response.json())as{accessToken:string}).accessToken}
async function login(page:Page,base:string,loginName:string){await page.goto(base);await page.evaluate(()=>sessionStorage.clear());await page.reload();await page.goto(`${base}#/login`);await page.locator('input[name="tenantCode"]').fill(tenantCode);await page.locator('input[name="username"]').fill(loginName);await page.locator('input[name="password"]').fill(password);await page.locator('form button[type="submit"]').click();await expect(page).not.toHaveURL(/#\/login/u)}
async function listLeaves(request:APIRequestContext,token:string){const response=await request.get(`${api}/api/v1/processes/P008/leaves`,{headers:headers(token)});expect(response.status()).toBe(200);return await response.json()as Leave[]}
async function getLeave(request:APIRequestContext,token:string,id:string){const response=await request.get(`${api}/api/v1/processes/P008/leaves/${id}`,{headers:headers(token)});expect(response.status()).toBe(200);return await response.json()as Leave}
async function act(request:APIRequestContext,token:string,id:string,code:string,version:number,body:Record<string,unknown>={}){const response=await request.post(`${api}/api/v1/processes/P008/leaves/${id}/actions/${code}`,{headers:{...headers(token),'Idempotency-Key':`p008-${code.toLowerCase()}-${randomUUID()}`},data:{expectedVersion:version,reason:null,resultSummary:null,actualAttendanceSummary:null,actualEndAt:null,handoverItems:[],evidence:null,...body}});return{status:response.status(),body:response.ok()?await response.json()as Leave:undefined}}
async function expectRecord(page:Page,id:string,businessNo:string,node:string){const selector=page.locator(`[data-select-record="${id}"]`);if(await selector.count())await selector.click();await expect(page.getByText(businessNo,{exact:true}).first()).toBeVisible();await expect(page.getByText(node,{exact:true}).first()).toBeVisible()}
function local(offsetHours:number){return new Date(Date.now()+offsetHours*3_600_000).toISOString().slice(0,16)}
function evidence(note:string){return{note,recordedAt:new Date().toISOString()}}

test('P008 real leave, quota and attendance lifecycle spans employee, center, reviewer and tech portals',async({page,request})=>{
  const employee=await apiLogin(request,employeeLogin),manager=await apiLogin(request,managerLogin),tech=await apiLogin(request,techLogin),out=await apiLogin(request,outLogin)
  const subject='P008 浏览器真实请假额度与考勤闭环',start=local(72),end=local(80),earlyEnd=local(78)

  await login(page,employeeBase,employeeLogin)
  await page.goto(`${employeeBase}#/employee/03/01/01`)
  await expect(page.getByRole('heading',{name:'请假申请',level:1})).toBeVisible()
  await expect(page.getByRole('heading',{name:'请假与假期管理',level:2})).toBeVisible()
  await expect(page.locator('[data-handover-directory-blocked]')).toContainText('BLOCKED_BY_CONTRACT')
  await expect(page.locator('[name="handoverAgentId"], [data-handover-option]')).toHaveCount(0)
  await page.locator('[data-field="business-date"] input').fill(new Date().toISOString().slice(0,10))
  await page.locator('[data-field="subject"] input').fill(subject)
  await page.locator('[data-field="attendance-type"] input').fill('年假')
  await page.locator('[data-field="quota-account"] input').fill('ANNUAL')
  await page.locator('[data-field="start-at"] input').fill(start)
  await page.locator('[data-field="end-at"] input').fill(end)
  await page.locator('[data-field="reason"] textarea').fill('用于验证真实请假额度守恒独立审批销假变更与考勤归档闭环')
  const createRequestPromise=page.waitForRequest(request=>request.method()==='POST'&&new URL(request.url()).pathname==='/api/v1/processes/P008/leaves')
  await page.locator('[data-submit-create]').click()
  const createRequest=await createRequestPromise
  expect(createRequest.headers()['idempotency-key']).toMatch(/^p008-create-/u)
  expect((createRequest.postDataJSON()as{handoverAgentId:unknown}).handoverAgentId).toBeNull()
  await expect.poll(async()=>(await listLeaves(request,employee)).find(leave=>leave.subject===subject)?.id).toBeTruthy()
  const created=(await listLeaves(request,employee)).find(leave=>leave.subject===subject)
  expect(created).toBeTruthy();if(!created)throw new Error('P008 created leave missing from authoritative list')
  const {id,businessNo}=created
  expect(created.handoverAgentId).toBeNull()
  await expectRecord(page,id,businessNo,'S01')
  expect(await listLeaves(request,out)).toEqual([])
  expect((await request.get(`${api}/api/v1/processes/P008/leaves/${id}`,{headers:headers(out)})).status()).toBe(403)
  const masked=await getLeave(request,tech,id);expect(masked.reason).toBeNull();expect(masked.quotaAccountId).toBeNull()

  const submitRequestPromise=page.waitForRequest(request=>request.method()==='POST'&&new URL(request.url()).pathname.endsWith(`/leaves/${id}/actions/SUBMIT`))
  await page.locator('[data-action-code="SUBMIT"]').click()
  const submitRequest=await submitRequestPromise
  expect(submitRequest.headers()['idempotency-key']).toMatch(/^p008-submit-/u)
  expect((submitRequest.postDataJSON()as{expectedVersion:number}).expectedVersion).toBe(created.versionNo)
  await expectRecord(page,id,businessNo,'S02')
  let current=await getLeave(request,manager,id)
  expect((await act(request,manager,id,'RESERVE',current.versionNo-1,{reason:'陈旧版本必须被拒绝'})).status).toBe(409)
  let moved=await act(request,manager,id,'RESERVE',current.versionNo,{reason:'外部授予额度充足，完成预占'});expect(moved.status).toBe(200)

  await page.locator('[data-refresh-facts]').click();await expectRecord(page,id,businessNo,'S03')
  await page.getByLabel('交接事项（每行一项）').fill('当日值班工作交由同事\n紧急事项已同步直属主管')
  await page.locator('[data-action-code="CONFIRM_HANDOVER"]').click();await expectRecord(page,id,businessNo,'S04')
  current=await getLeave(request,employee,id)
  expect((await act(request,employee,id,'APPROVE',current.versionNo,{reason:'本人不得审批本人请假'})).status).toBe(403)

  await login(page,centerBase,reviewerLogin)
  await page.goto(`${centerBase}#/center/04/04/03`)
  await expect(page.getByRole('heading',{name:'假期预占账本',level:1})).toBeVisible()
  await expect(page.getByRole('heading',{name:'请假与假期管理',level:2})).toBeVisible()
  await expectRecord(page,id,businessNo,'S04')
  await page.getByLabel('处理、退回或驳回原因').fill('独立审批人复核请假时间、额度和交接安排通过')
  await page.locator('[data-action-code="APPROVE"]').click();await expectRecord(page,id,businessNo,'S05')

  current=await getLeave(request,manager,id)
  for(const [code,body] of [
    ['DEDUCT',{reason:'批准后预占转为实际扣减'}],
    ['MARK_ATTENDANCE',{evidence:evidence('排班与考勤请假标记已同步')}],
    ['START_LEAVE',{evidence:evidence('员工实际开始休假记录')}],
  ] as const){moved=await act(request,manager,id,code,current.versionNo,body);expect(moved.status).toBe(200);current=moved.body!}
  expect(current.currentNodeCode).toBe('S08')

  await login(page,employeeBase,employeeLogin)
  await page.goto(`${employeeBase}#/employee/03/01/02`)
  await expectRecord(page,id,businessNo,'S08')
  await page.getByLabel('处理、退回或驳回原因').fill('员工提前两小时返岗并提交实际结束记录')
  await page.getByLabel('实际结束时间').fill(earlyEnd)
  await page.getByLabel('不可变证据摘要').fill('员工本人确认提前返岗时间及工作恢复状态')
  await page.locator('[data-action-code="EARLY_RETURN"]').click();await expectRecord(page,id,businessNo,'S09')

  current=await getLeave(request,manager,id)
  moved=await act(request,manager,id,'ADJUST',current.versionNo,{reason:'按实际六小时休假调整两小时差额'});expect(moved.status).toBe(200);current=moved.body!
  moved=await act(request,manager,id,'CLOSE_DAY',current.versionNo,{actualAttendanceSummary:'实际休假六小时，提前返岗两小时，日结核对一致',evidence:evidence('考勤日结归档回执')});expect(moved.status).toBe(200);expect(moved.body?.currentNodeCode).toBe('END')
  const ledgerResponse=await request.get(`${api}/api/v1/processes/P008/quota-ledger`,{headers:headers(employee)});expect(ledgerResponse.status()).toBe(200);const ledger=await ledgerResponse.json()as QuotaEntry[];expect(ledger).toHaveLength(4);expect(ledger.at(-1)).toMatchObject({entryType:'ADJUST',availableAfter:10,reservedAfter:0,consumedAfter:6})

  await login(page,techBase,techLogin)
  await page.goto(`${techBase}#/tech/07/11/01`)
  await expect(page.getByRole('heading',{name:'运行概览',level:1})).toBeVisible()
  await expect(page.getByRole('heading',{name:'P008 请假流程监控',level:2})).toBeVisible()
  await expectRecord(page,id,businessNo,'END')
  await expect(page.locator('[data-action-code]')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('用于验证真实请假')
  await expect(page.locator('body')).not.toContainText('ANNUAL')
  const techLedger=page.getByRole('table',{name:'P008 假期额度账本'});await expect(techLedger).toContainText('ADJUST')
})
