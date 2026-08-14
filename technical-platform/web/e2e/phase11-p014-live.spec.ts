import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
const tenantCode = required('PHASE11_P014_TENANT'), managerLogin = required('PHASE11_P014_LOGIN'), password = required('PHASE11_P014_PASSWORD');
const affectedLogin = 'phase11.p014.affected', investigatorLogin = 'phase11.p014.investigator', reviewerLogin = 'phase11.p014.reviewer', deciderLogin = 'phase11.p014.decider', appealLogin = 'phase11.p014.appeal', techLogin = 'phase11.p014.tech', outsiderLogin = 'phase11.p014.out';
const api = 'http://127.0.0.1:18090', employeeBase = 'http://127.0.0.1:5340/employee.html', centerBase = 'http://127.0.0.1:5341/center.html', techBase = 'http://127.0.0.1:5342/admin.html', affectedId = '30000000-0000-0000-0000-000000003524';
interface Impact {
    id: string;
    impactType: string;
    authorityReference: string;
}
interface Discipline {
    id: string;
    businessNo: string;
    currentNodeCode: string;
    versionNo: number;
    reason: string | null;
    affectedEmployeeId: string | null;
    sourceFactKey: string | null;
    factSummary: string | null;
    events: unknown[];
    decisions: unknown[];
    impacts: Impact[];
    receipts: unknown[];
}
interface ScenarioContext {
    page: Page;
    request: APIRequestContext;
    manager: string;
    affected: string;
    investigator: string;
    reviewer: string;
    decider: string;
    appeal: string;
    tech: string;
    outsider: string;
}
function required(name: string) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`required E2E environment missing: ${name}`);
    }
    return value;
}
function headers(token: string) {
    return { Authorization: `Bearer ${token}` };
}
function evidence(note: string) {
    return { note, recordedAt: new Date().toISOString() };
}
async function apiLogin(request: APIRequestContext, name: string) {
    const response = await request.post(`${api}/api/v1/auth/login`, {
        data: { tenantCode, loginName: name, password },
    });
    expect(response.status()).toBe(200);
    return ((await response.json()) as { accessToken: string }).accessToken;
}
async function login(page: Page, base: string, name: string) {
    await page.goto(base);
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await page.goto(`${base}#/login`);
    await page.locator('input[name="tenantCode"]').fill(tenantCode);
    await page.locator('input[name="username"]').fill(name);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('form button[type="submit"]').click();
    await expect(page).not.toHaveURL(/#\/login/u);
}
async function getCase(request: APIRequestContext, token: string, id: string) {
    const response = await request.get(`${api}/api/v1/processes/P014/discipline-cases/${id}`, {
        headers: headers(token),
    });
    expect(response.status()).toBe(200);
    return (await response.json()) as Discipline;
}
async function act(request: APIRequestContext, token: string, id: string, code: string, version: number, data: Record<string, unknown> = {}) {
    const response = await request.post(`${api}/api/v1/processes/P014/discipline-cases/${id}/actions/${code}`, {
        headers: { ...headers(token), 'Idempotency-Key': `p014-${code}-${randomUUID()}` },
        data: { expectedVersion: version, decisionOutcome: null, authorityReference: null, decidedAt: null, impactType: null, instructionId: null, receiptType: null, externalReference: null, externalOccurredAt: null, appealRequested: null, resultSummary: 'browser verified', evidence: evidence(code), ...data },
    });
    return { status: response.status(), body: response.ok() ? ((await response.json()) as Discipline) : undefined };
}
async function move(request: APIRequestContext, token: string, id: string, code: string, version: number, data: Record<string, unknown> = {}) {
    const result = await act(request, token, id, code, version, data);
    expect(result.status).toBe(200);
    if (!result.body) {
        throw new Error(`${code} response body missing`);
    }
    return result.body;
}
async function createCase(context: ScenarioContext): Promise<string> {
    const { page } = context;
    await login(page, centerBase, managerLogin);
    await page.goto(`${centerBase}#/center/02/04/04`);
    const centerRouteHeading = page.getByRole('heading', { name: '案件责任评审', level: 1 });
    await expect(centerRouteHeading).toHaveCount(1);
    await expect(centerRouteHeading).toBeVisible();
    const centerBusinessHeading = page.getByRole('heading', { name: '纪律事实、职责分离与申诉闭环', level: 2 });
    await expect(centerBusinessHeading).toHaveCount(1);
    await expect(centerBusinessHeading).toBeVisible();
    await page.getByPlaceholder('纪律案件主题').fill('P014 浏览器真实纪律与申诉闭环');
    await page.getByPlaceholder('受影响员工 ID').fill(affectedId);
    await page.getByPlaceholder('唯一来源事实编号').fill('P014-BROWSER-FACT-001');
    await page.getByPlaceholder('业务对象编号').fill('CASE-P014-BROWSER-001');
    await page.getByPlaceholder('业务对象名称').fill('内部服务事件');
    await page.getByPlaceholder('可核验事实摘要').fill('来源材料仅作为调查线索并由人工独立核验');
    await page.getByPlaceholder('案件立项说明').fill('本平台不自动认定责任或执行处分');
    await page.getByPlaceholder('不可变来源证据').fill('浏览器来源证据包');
    await page.getByRole('button', { name: '创建纪律案件' }).click();
    const record = page.locator('article.record').filter({ hasText: 'P014 浏览器真实纪律与申诉闭环' });
    await expect(record).toContainText('S01');
    const id = await record.getAttribute('data-discipline-id');
    expect(id).toBeTruthy();
    if (!id) {
        throw new Error('discipline id missing');
    }
    return id;
}
async function verifyIsolation(context: ScenarioContext, id: string): Promise<void> {
    const { page, request, manager, tech, outsider } = context;
    await page.goto(`${centerBase}#/center/06/03/09`);
    await expect(page.locator(`article[data-discipline-id="${id}"]`)).toBeVisible();
    const duplicate = await request.post(`${api}/api/v1/processes/P014/discipline-cases`, { headers: { ...headers(manager), 'Idempotency-Key': `duplicate-${randomUUID()}` }, data: { businessDate: '2026-08-13', subject: 'P014 duplicate source case', reason: 'duplicate source must be rejected', affectedEmployeeId: affectedId, sourceFactKey: 'P014-BROWSER-FACT-001', businessObjectType: 'INTERNAL_CASE', businessObjectNo: 'CASE-P014-BROWSER-002', businessObjectName: 'Duplicate internal event', employeeEventType: 'DISCIPLINE_CLUE', factOccurredAt: new Date().toISOString(), factSummary: 'duplicate fact must not create another case', impactLevel: 'L2', evidence: evidence('duplicate') } });
    expect(duplicate.status()).toBe(409);
    expect(await (await request.get(`${api}/api/v1/processes/P014/discipline-cases`, { headers: headers(outsider) })).json()).toEqual([]);
    expect((await request.get(`${api}/api/v1/processes/P014/discipline-cases/${id}`, { headers: headers(outsider) })).status()).toBe(403);
    const masked = await getCase(request, tech, id);
    expect(masked.reason).toBeNull();
    expect(masked.affectedEmployeeId).toBeNull();
    expect(masked.sourceFactKey).toBeNull();
    expect(masked.factSummary).toBeNull();
    expect(masked.events).toEqual([]);
    expect(masked.decisions).toEqual([]);
    expect(masked.impacts).toEqual([]);
    expect(masked.receipts).toEqual([]);
}
async function investigateAndCollectStatement(context: ScenarioContext, id: string): Promise<void> {
    const { page, request, manager, affected, investigator } = context;
    let current = await getCase(request, manager, id);
    expect((await act(request, manager, id, 'REGISTER_CLUE', current.versionNo - 1)).status).toBe(409);
    current = await move(request, manager, id, 'REGISTER_CLUE', current.versionNo);
    current = await move(request, manager, id, 'RECORD_SAFEGUARD', current.versionNo);
    expect((await act(request, affected, id, 'COMPLETE_INVESTIGATION', current.versionNo)).status).toBe(403);
    await move(request, investigator, id, 'COMPLETE_INVESTIGATION', current.versionNo);
    await login(page, employeeBase, affectedLogin);
    await page.goto(`${employeeBase}#/employee/02/03/09`);
    const affectedRecord = page.locator(`article[data-discipline-id="${id}"]`);
    await expect(affectedRecord).toContainText('S04');
    await page.getByPlaceholder('节点不可变证据').fill('员工本人陈述申辩材料');
    await affectedRecord.getByRole('button', { name: '提交陈述申辩' }).click();
    await expect(affectedRecord).toContainText('S05');
}
async function decideAndDeliver(context: ScenarioContext, id: string): Promise<void> {
    const { page, request, affected, investigator, reviewer, decider } = context;
    let current = await getCase(request, reviewer, id);
    expect((await act(request, investigator, id, 'COMPLETE_RESPONSIBILITY_REVIEW', current.versionNo)).status).toBe(409);
    current = await move(request, reviewer, id, 'COMPLETE_RESPONSIBILITY_REVIEW', current.versionNo);
    expect((await act(request, affected, id, 'RECORD_DECISION', current.versionNo, { authorityReference: 'SELF-BLOCKED', decidedAt: new Date().toISOString() })).status).toBe(403);
    await move(request, decider, id, 'RECORD_DECISION', current.versionNo, { authorityReference: 'EXTERNAL-HR-AUTH-BROWSER-014', decidedAt: new Date().toISOString() });
    await login(page, employeeBase, affectedLogin);
    await page.goto(`${employeeBase}#/employee/02/03/09`);
    await page.getByPlaceholder('节点不可变证据').fill('员工已接收外部授权决定记录');
    await page.locator(`article[data-discipline-id="${id}"]`).getByRole('button', { name: '确认决定送达' }).click();
    await expect(page.locator(`article[data-discipline-id="${id}"]`)).toContainText('S08');
}
async function recordImpactAndAppeal(context: ScenarioContext, id: string): Promise<void> {
    const { page, request, manager, decider, appeal } = context;
    let current = await getCase(request, manager, id);
    current = await move(request, manager, id, 'RECORD_IMPACT', current.versionNo, { impactType: 'POINT_ADJUSTMENT', authorityReference: 'EXTERNAL-POINT-AUTH-BROWSER-014' });
    const instruction = current.impacts.find(value => value.impactType === 'POINT_ADJUSTMENT')?.id;
    expect(instruction).toBeTruthy();
    if (!instruction)
        throw new Error('impact instruction missing');
    expect((await act(request, manager, id, 'COMPLETE_IMPACTS', current.versionNo)).status).toBe(409);
    expect((await act(request, manager, id, 'RECORD_RECEIPT', current.versionNo, { instructionId: instruction, receiptType: 'HR_CASE_RECEIPT', externalReference: 'WRONG-RECEIPT', externalOccurredAt: new Date().toISOString() })).status).toBe(409);
    current = await move(request, manager, id, 'RECORD_RECEIPT', current.versionNo, { instructionId: instruction, receiptType: 'P015_POINT_LEDGER', externalReference: 'P015-LEDGER-BROWSER-014', externalOccurredAt: new Date().toISOString() });
    await move(request, manager, id, 'COMPLETE_IMPACTS', current.versionNo);
    await login(page, employeeBase, affectedLogin);
    await page.goto(`${employeeBase}#/employee/02/03/09`);
    await page.getByPlaceholder('节点不可变证据').fill('员工本人提交申诉选择');
    await page.locator(`article[data-discipline-id="${id}"]`).getByRole('button', { name: '提交申诉选择' }).click();
    await expect(page.locator(`article[data-discipline-id="${id}"]`)).toContainText('v12');
    current = await getCase(request, appeal, id);
    expect((await act(request, decider, id, 'REVIEW_APPEAL', current.versionNo, { decisionOutcome: 'UPHELD', authorityReference: 'SELF-REVIEW-BLOCKED', decidedAt: new Date().toISOString() })).status).toBe(409);
    current = await move(request, appeal, id, 'REVIEW_APPEAL', current.versionNo, { decisionOutcome: 'AMENDED', authorityReference: 'EXTERNAL-APPEAL-BROWSER-014', decidedAt: new Date().toISOString() });
    current = await move(request, manager, id, 'CLOSE_CORE', current.versionNo);
    current = await move(request, manager, id, 'VERIFY_REMEDIATION', current.versionNo, { authorityReference: 'REMEDIATION-VERIFY-BROWSER-014' });
    current = await move(request, manager, id, 'SUPPLEMENT_ARCHIVE', current.versionNo);
    expect(current.currentNodeCode).toBe('END');
    expect(current.decisions).toHaveLength(2);
    expect(current.impacts).toHaveLength(1);
    expect(current.receipts).toHaveLength(1);
}
async function verifyTechMasking(context: ScenarioContext, id: string): Promise<void> {
    const { page, request, tech } = context;
    await login(page, techBase, techLogin);
    await page.goto(`${techBase}#/tech/05/03/01`);
    const techRouteHeading = page.getByRole('heading', { name: 'P004/P005 工作流监控', level: 1 });
    await expect(techRouteHeading).toHaveCount(1);
    await expect(techRouteHeading).toBeVisible();
    const techBusinessHeading = page.getByRole('heading', { name: '纪律案件流程元数据监控', level: 2 });
    await expect(techBusinessHeading).toHaveCount(1);
    await expect(techBusinessHeading).toBeVisible();
    const techRecord = page.locator(`article[data-discipline-id="${id}"]`);
    await expect(techRecord).toContainText('END');
    await expect(techRecord).toContainText('当事人、事实、证据、决定、影响指令和执行回执已隐藏');
    await expect(techRecord.getByRole('button')).toHaveCount(0);
    await expect(techRecord).not.toContainText('P015-LEDGER-BROWSER-014');
    const masked = await getCase(request, tech, id);
    expect(masked.decisions).toEqual([]);
    expect(masked.impacts).toEqual([]);
    expect(masked.receipts).toEqual([]);
}
test('P014 real browser preserves human authority, separation, appeal and downstream receipts', async ({ page, request }) => {
    const manager = await apiLogin(request, managerLogin);
    const affected = await apiLogin(request, affectedLogin);
    const investigator = await apiLogin(request, investigatorLogin);
    const reviewer = await apiLogin(request, reviewerLogin);
    const decider = await apiLogin(request, deciderLogin);
    const appeal = await apiLogin(request, appealLogin);
    const tech = await apiLogin(request, techLogin);
    const outsider = await apiLogin(request, outsiderLogin);
    const context: ScenarioContext = { page, request, manager, affected, investigator, reviewer, decider, appeal, tech, outsider };
    const id = await createCase(context);
    await verifyIsolation(context, id);
    await investigateAndCollectStatement(context, id);
    await decideAndDeliver(context, id);
    await recordImpactAndAppeal(context, id);
    await verifyTechMasking(context, id);
});
