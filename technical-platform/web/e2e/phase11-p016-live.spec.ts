import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
const tenantCode = required('PHASE11_P016_TENANT'), managerLogin = required('PHASE11_P016_LOGIN'), password = required('PHASE11_P016_PASSWORD');
const affectedLogin = 'p016.browser.affected', approverLogin = 'p016.browser.approver', executorLogin = 'p016.browser.executor', reconcilerLogin = 'p016.browser.reconciler', techLogin = 'p016.browser.tech', outsiderLogin = 'p016.browser.out';
const api = 'http://127.0.0.1:18090', employeeBase = 'http://127.0.0.1:5360/employee.html', centerBase = 'http://127.0.0.1:5361/center.html', techBase = 'http://127.0.0.1:5362/admin.html', affectedId = '30000000-0000-0000-0000-000000003726';
interface CareCase {
    id: string;
    businessNo: string;
    currentNodeCode: string;
    versionNo: number;
    subject: string;
    affectedEmployeeId: string | null;
    sourceFactKey: string | null;
    requestedAmount: number | null;
    events: unknown[];
    eligibility: {
        outcome: string;
    } | null;
    approval: {
        approvedAmount: number;
    } | null;
    execution: {
        executionKind: string;
        externalReference: string;
    } | null;
    confirmation: {
        outcome: string;
    } | null;
    reconciliation: {
        outcome: string;
    } | null;
}
interface ScenarioContext {
    page: Page;
    request: APIRequestContext;
    manager: string;
    approver: string;
    executor: string;
    reconciler: string;
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
async function getCare(request: APIRequestContext, token: string, id: string) {
    const response = await request.get(`${api}/api/v1/processes/P016/care-cases/${id}`, {
        headers: headers(token),
    });
    expect(response.status()).toBe(200);
    return (await response.json()) as CareCase;
}
function actionBody(version: number, data: Record<string, unknown> = {}) {
    return { expectedVersion: version, resultSummary: 'P016 browser verified', evidence: evidence(`immutable lifecycle v${version}`), ...data };
}
async function act(request: APIRequestContext, token: string, id: string, code: string, version: number, data: Record<string, unknown> = {}) {
    const response = await request.post(`${api}/api/v1/processes/P016/care-cases/${id}/actions/${code}`, {
        headers: { ...headers(token), 'Idempotency-Key': `p016-${code}-${randomUUID()}` },
        data: actionBody(version, data),
    });
    return { status: response.status(), body: response.ok() ? ((await response.json()) as CareCase) : undefined };
}
async function move(request: APIRequestContext, token: string, id: string, code: string, version: number, data: Record<string, unknown> = {}) {
    const result = await act(request, token, id, code, version, data);
    expect(result.status).toBe(200);
    if (!result.body) {
        throw new Error(`${code} response body missing`);
    }
    return result.body;
}
async function createCaseAndVerifyIsolation(context: ScenarioContext, source: string, subject: string): Promise<string> {
    const { page, request, manager, tech, outsider } = context;
    await login(page, centerBase, managerLogin);
    await page.goto(`${centerBase}#/center/06/03/09`);
    await expect(page.getByTestId('p016-page')).toBeVisible();
    const centerRouteHeading = page.getByRole('heading', { name: '奖励、纪律、员工关怀和数据质量', level: 1 });
    await expect(centerRouteHeading).toHaveCount(1);
    await expect(centerRouteHeading).toBeVisible();
    const centerBusinessHeading = page.getByRole('heading', { name: '员工关怀与福利支持', level: 2 });
    await expect(centerBusinessHeading).toHaveCount(1);
    await expect(centerBusinessHeading).toBeVisible();
    await page.getByPlaceholder('关怀事项主题').fill(subject);
    await page.getByPlaceholder('受影响员工 ID').fill(affectedId);
    await page.getByPlaceholder('唯一来源事实编号').fill(source);
    await page.getByLabel('申请金额').fill('1000');
    await page.getByPlaceholder('成本中心编号').fill('P016-COST');
    await page.getByPlaceholder('外部业务参考号').fill('P016-EXTERNAL-BUSINESS');
    await page.getByPlaceholder('可核验来源事实摘要').fill('真实员工关怀来源事实已核验并保留不可变证据');
    await page.getByPlaceholder('关怀申请说明').fill('困难关怀必须由独立角色完成资格审批执行与对账');
    await page.getByPlaceholder('不可变来源证据').fill('P016 浏览器来源证据包');
    await page.getByRole('button', { name: '创建关怀事项' }).click();
    const record = page.locator('article.record').filter({ hasText: subject });
    await expect(record).toContainText('S01');
    const id = await record.getAttribute('data-care-id');
    expect(id).toBeTruthy();
    if (!id) {
        throw new Error('care case id missing');
    }
    await page.goto(`${centerBase}#/center/08/08/05`);
    await expect(page.locator(`article[data-care-id="${id}"]`)).toBeVisible();
    const duplicate = await request.post(`${api}/api/v1/processes/P016/care-cases`, { headers: { ...headers(manager), 'Idempotency-Key': `duplicate-${randomUUID()}` }, data: createBody(source) });
    expect(duplicate.status()).toBe(409);
    expect(await (await request.get(`${api}/api/v1/processes/P016/care-cases`, { headers: headers(outsider) })).json()).toEqual([]);
    expect((await request.get(`${api}/api/v1/processes/P016/care-cases/${id}`, { headers: headers(outsider) })).status()).toBe(403);
    expect((await request.get(`${api}/api/v1/processes/P016/care-cases/not-a-uuid`, { headers: headers(manager) })).status()).toBe(400);
    const masked = await getCare(request, tech, id);
    expect(masked.affectedEmployeeId).toBeNull();
    expect(masked.sourceFactKey).toBeNull();
    expect(masked.requestedAmount).toBeNull();
    expect(masked.events).toEqual([]);
    return id;
}
async function approveAndExecute(context: ScenarioContext, id: string, executionRef: string): Promise<CareCase> {
    const { page, request, manager, approver, executor } = context;
    let current = await getCare(request, manager, id);
    expect((await act(request, manager, id, 'SUBMIT_APPLICATION', current.versionNo - 1)).status).toBe(409);
    current = await move(request, manager, id, 'SUBMIT_APPLICATION', current.versionNo);
    current = await move(request, manager, id, 'CONFIRM_ELIGIBILITY', current.versionNo, { authorityReference: 'ELIGIBILITY-AUTH-001', occurredAt: new Date().toISOString() });
    expect(current.eligibility?.outcome).toBe('ELIGIBLE');
    expect((await act(request, manager, id, 'AUTHORIZE_PRIVACY', current.versionNo, { consentScope: 'WELFARE_CASE', consentHash: 'a'.repeat(64), occurredAt: new Date().toISOString() })).status).toBe(409);
    await login(page, employeeBase, affectedLogin);
    await page.goto(`${employeeBase}#/employee/03/06/05`);
    const employeeRecord = page.locator(`article[data-care-id="${id}"]`);
    await expect(employeeRecord).toContainText('S03');
    await page.getByPlaceholder('隐私授权 SHA-256').fill('a'.repeat(64));
    await page.getByPlaceholder('节点不可变证据').fill('员工本人授权福利材料使用');
    await employeeRecord.getByRole('button', { name: '授权隐私材料' }).click();
    await expect(employeeRecord).toContainText('S04');
    current = await getCare(request, manager, id);
    expect((await act(request, manager, id, 'APPROVE_CARE', current.versionNo, { authorityReference: 'APPROVAL-BAD', approvedAmount: 800, occurredAt: new Date().toISOString() })).status).toBe(409);
    current = await move(request, approver, id, 'APPROVE_CARE', current.versionNo, { authorityReference: 'APPROVAL-AUTH-001', approvedAmount: 800, occurredAt: new Date().toISOString() });
    expect(current.approval?.approvedAmount).toBe(800);
    expect((await act(request, approver, id, 'RECORD_EXECUTION', current.versionNo, execution(`${executionRef}-BAD`))).status).toBe(409);
    current = await move(request, executor, id, 'RECORD_EXECUTION', current.versionNo, execution(executionRef));
    expect(current.execution?.executionKind).toBe('PAYMENT_RECEIPT');
    return current;
}
async function confirmReconcileAndVerify(context: ScenarioContext, id: string, executionRef: string, current: CareCase): Promise<void> {
    const { page, request, manager, executor, reconciler, tech } = context;
    expect((await act(request, manager, id, 'CONFIRM_RECEIPT', current.versionNo, { confirmationOutcome: 'CONFIRMED', occurredAt: new Date().toISOString() })).status).toBe(409);
    await page.goto(`${employeeBase}#/employee/03/06/01`);
    await page.getByRole('button', { name: '刷新' }).click();
    const employeeRecord = page.locator(`article[data-care-id="${id}"]`);
    await expect(employeeRecord).toContainText('S06');
    await page.getByPlaceholder('节点不可变证据').fill('员工本人确认外部关怀已收到');
    await employeeRecord.getByRole('button', { name: '确认收到关怀' }).click();
    await expect(employeeRecord).toContainText('S07');
    current = await getCare(request, reconciler, id);
    expect((await act(request, executor, id, 'RECONCILE', current.versionNo, { reconciliationOutcome: 'MATCHED', externalReference: executionRef, occurredAt: new Date().toISOString() })).status).toBe(409);
    current = await move(request, reconciler, id, 'RECONCILE', current.versionNo, { reconciliationOutcome: 'MATCHED', externalReference: executionRef, occurredAt: new Date().toISOString() });
    expect(current.reconciliation?.outcome).toBe('MATCHED');
    current = await move(request, manager, id, 'ARCHIVE', current.versionNo);
    expect(current.currentNodeCode).toBe('END');
    await login(page, techBase, techLogin);
    await page.goto(`${techBase}#/tech/05/03/01`);
    await expect(page.getByTestId('phase09-tech-workflow-monitor')).toBeVisible();
    await expect(page).toHaveURL(/#\/tech\/05\/03\/01$/u);
    const masked = await getCare(request, tech, id);
    expect(masked.subject).toBe('Restricted welfare case');
    expect(masked.events).toEqual([]);
    expect(masked.approval).toBeNull();
    expect(masked.execution).toBeNull();
}
test('P016 real browser separates human authority, external execution and technical masking', async ({ page, request }) => {
    const manager = await apiLogin(request, managerLogin);
    const approver = await apiLogin(request, approverLogin);
    const executor = await apiLogin(request, executorLogin);
    const reconciler = await apiLogin(request, reconcilerLogin);
    const tech = await apiLogin(request, techLogin);
    const outsider = await apiLogin(request, outsiderLogin);
    const context: ScenarioContext = { page, request, manager, approver, executor, reconciler, tech, outsider };
    const source = `P016-BROWSER-${randomUUID()}`;
    const subject = `P016 浏览器真实关怀闭环 ${source.slice(-8)}`;
    const executionRef = `EXT-${source.slice(-12)}`;
    const techCreate = await request.post(`${api}/api/v1/processes/P016/care-cases`, { headers: { ...headers(tech), 'Idempotency-Key': `tech-denied-${randomUUID()}` }, data: createBody(source) });
    expect(techCreate.status()).toBe(403);
    const id = await createCaseAndVerifyIsolation(context, source, subject);
    const current = await approveAndExecute(context, id, executionRef);
    await confirmReconcileAndVerify(context, id, executionRef, current);
});
function createBody(source: string) {
    return { businessDate: new Date().toISOString().slice(0, 10), subject: 'P016 duplicate or forbidden care', reason: 'Source-backed care requires independent human authority', affectedEmployeeId: affectedId, sourceFactKey: source, careType: 'HARDSHIP', benefitAmount: 1000, currency: 'CNY', costCenterId: 'P016-COST', externalBusinessRef: `P016-${randomUUID()}`, factOccurredAt: new Date().toISOString(), factSummary: 'Verified welfare event retained as immutable source evidence', evidence: evidence('source package') };
}
function execution(externalReference: string) {
    return { executionKind: 'PAYMENT_RECEIPT', externalReference, occurredAt: new Date().toISOString(), executedAmount: 800, currency: 'CNY', invoiceCode: 'INV-P016', invoiceNumber: externalReference, invoiceDate: new Date().toISOString().slice(0, 10), invoiceAmount: 800, invoiceImageSha256: 'b'.repeat(64) };
}
