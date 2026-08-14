import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
const tenantCode = required('PHASE11_P012_TENANT'), managerLogin = required('PHASE11_P012_LOGIN'), password = required('PHASE11_P012_PASSWORD');
const ownerLogin = 'phase11.p012.owner', assessorLogin = 'phase11.p012.assessor', reviewerLogin = 'phase11.p012.reviewer', approverLogin = 'phase11.p012.approver', appointerLogin = 'phase11.p012.appointer', techLogin = 'phase11.p012.tech', outsiderLogin = 'phase11.p012.out';
const api = 'http://127.0.0.1:18090', employeeBase = 'http://127.0.0.1:5330/employee.html', centerBase = 'http://127.0.0.1:5331/center.html', techBase = 'http://127.0.0.1:5332/admin.html', ownerId = '30000000-0000-0000-0000-000000003422';
interface Promotion {
    id: string;
    businessNo: string;
    currentNodeCode: string;
    versionNo: number;
    reason: string | null;
    personName: string | null;
    personNo: string | null;
    score1000: number | null;
    events: unknown[];
    executions: Array<{
        executionType: string;
        externalReference: string;
    }>;
}
interface ScenarioContext {
    page: Page;
    request: APIRequestContext;
    manager: string;
    assessor: string;
    reviewer: string;
    approver: string;
    appointer: string;
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
async function getPromotion(request: APIRequestContext, token: string, id: string) {
    const response = await request.get(`${api}/api/v1/processes/P012/promotion-requests/${id}`, {
        headers: headers(token),
    });
    expect(response.status()).toBe(200);
    return (await response.json()) as Promotion;
}
async function act(request: APIRequestContext, token: string, id: string, code: string, version: number, data: Record<string, unknown> = {}) {
    const response = await request.post(`${api}/api/v1/processes/P012/promotion-requests/${id}/actions/${code}`, {
        headers: { ...headers(token), 'Idempotency-Key': `p012-${code}-${randomUUID()}` },
        data: { expectedVersion: version, score1000: null, eligibilityConfirmed: null, freezeClear: null, vacancyConfirmed: null, budgetVerificationReference: null, reviewPassed: null, approved: null, salaryConfirmationReference: null, externalReference: null, probationResult: null, actualEffectiveDate: null, resultSummary: 'browser verified', evidence: evidence(code), ...data },
    });
    return { status: response.status(), body: response.ok() ? ((await response.json()) as Promotion) : undefined };
}
async function move(request: APIRequestContext, token: string, id: string, code: string, version: number, data: Record<string, unknown> = {}) {
    const result = await act(request, token, id, code, version, data);
    expect(result.status).toBe(200);
    if (!result.body) {
        throw new Error(`${code} response body missing`);
    }
    return result.body;
}
async function createContext(page: Page, request: APIRequestContext): Promise<ScenarioContext> {
    const manager = await apiLogin(request, managerLogin);
    const assessor = await apiLogin(request, assessorLogin);
    const reviewer = await apiLogin(request, reviewerLogin);
    const approver = await apiLogin(request, approverLogin);
    const appointer = await apiLogin(request, appointerLogin);
    const tech = await apiLogin(request, techLogin);
    const outsider = await apiLogin(request, outsiderLogin);
    return { page, request, manager, assessor, reviewer, approver, appointer, tech, outsider };
}
async function createPromotion(context: ScenarioContext): Promise<string> {
    const { page } = context;
    await login(page, centerBase, managerLogin);
    await page.goto(`${centerBase}#/center/03/08/05`);
    const centerRouteHeading = page.getByRole('heading', { name: '晋升评审', level: 1 });
    await expect(centerRouteHeading).toHaveCount(1);
    await expect(centerRouteHeading).toBeVisible();
    const centerBusinessHeading = page.getByRole('heading', { name: '晋升申请、评审与任命', level: 2 });
    await expect(centerBusinessHeading).toHaveCount(1);
    await expect(centerBusinessHeading).toBeVisible();
    await page.getByPlaceholder('晋升主题').fill('P012 浏览器真实晋升任命闭环');
    await page.getByPlaceholder('员工 ID').fill(ownerId);
    await page.getByPlaceholder('编制编号').fill('HC-BROWSER-012');
    await page.getByPlaceholder('周期或批次编号').fill('PROMOTION-BROWSER-012');
    await page.getByPlaceholder('目标岗位编码').fill('P012_NEW');
    await page.getByLabel('计划生效日期').fill('2026-10-01');
    await page.getByPlaceholder('申请或提名原因').fill('已发布岗位空缺与发展计划');
    await page.getByPlaceholder('不可变来源证据').fill('组织提名来源包');
    await page.getByRole('button', { name: '创建晋升申请' }).click();
    const record = page.locator('article.record').filter({ hasText: 'P012 浏览器真实晋升任命闭环' });
    await expect(record).toContainText('S01');
    const id = await record.getAttribute('data-promotion-id');
    expect(id).toBeTruthy();
    if (!id)
        throw new Error('promotion id missing');
    return id;
}
async function verifyVisibility(context: ScenarioContext, id: string) {
    const { request, outsider, tech } = context;
    const outsiderList = await request.get(`${api}/api/v1/processes/P012/promotion-requests`, { headers: headers(outsider) });
    expect(await outsiderList.json()).toEqual([]);
    expect((await request.get(`${api}/api/v1/processes/P012/promotion-requests/${id}`, { headers: headers(outsider) })).status()).toBe(403);
    const masked = await getPromotion(request, tech, id);
    expect(masked.reason).toBeNull();
    expect(masked.personName).toBeNull();
    expect(masked.personNo).toBeNull();
    expect(masked.score1000).toBeNull();
    expect(masked.events).toEqual([]);
    expect(masked.executions).toEqual([]);
}
async function advancePromotion(context: ScenarioContext, id: string): Promise<Promotion> {
    const { request, manager, assessor, reviewer, approver, appointer } = context;
    let current = await getPromotion(request, manager, id);
    expect((await act(request, manager, id, 'SUBMIT', current.versionNo - 1)).status).toBe(409);
    current = await move(request, manager, id, 'SUBMIT', current.versionNo);
    expect((await act(request, manager, id, 'CHECK_ELIGIBILITY', current.versionNo, { eligibilityConfirmed: true, freezeClear: false })).status).toBe(409);
    current = await move(request, manager, id, 'CHECK_ELIGIBILITY', current.versionNo, { eligibilityConfirmed: true, freezeClear: true });
    expect((await act(request, assessor, id, 'RECORD_ASSESSMENT', current.versionNo, { score1000: 1001 })).status).toBe(409);
    current = await move(request, assessor, id, 'RECORD_ASSESSMENT', current.versionNo, { score1000: 918 });
    current = await move(request, manager, id, 'VERIFY_VACANCY_BUDGET', current.versionNo, { vacancyConfirmed: true, budgetVerificationReference: 'BUDGET-BROWSER-012' });
    expect((await act(request, assessor, id, 'COMPLETE_REVIEW', current.versionNo, { reviewPassed: true })).status).toBe(409);
    current = await move(request, reviewer, id, 'COMPLETE_REVIEW', current.versionNo, { reviewPassed: true });
    expect((await act(request, reviewer, id, 'APPROVE', current.versionNo, { approved: true })).status).toBe(403);
    current = await move(request, approver, id, 'APPROVE', current.versionNo, { approved: true });
    expect(current.executions).toEqual([]);
    current = await move(request, manager, id, 'COMPLETE_NOTICE', current.versionNo);
    expect((await act(request, appointer, id, 'RECORD_APPOINTMENT', current.versionNo, { actualEffectiveDate: '2026-10-01', externalReference: 'APPOINTMENT-BROWSER-012' })).status).toBe(409);
    current = await move(request, appointer, id, 'RECORD_APPOINTMENT', current.versionNo, { actualEffectiveDate: '2026-10-01', salaryConfirmationReference: 'SALARY-AUTH-BROWSER-012', externalReference: 'APPOINTMENT-BROWSER-012' });
    expect((await act(request, appointer, id, 'CONFIRM_APPOINTMENT', current.versionNo)).status).toBe(409);
    return current;
}
async function confirmAndFinish(context: ScenarioContext, id: string, current: Promotion): Promise<void> {
    const { page, request, reviewer, appointer } = context;
    await login(page, employeeBase, ownerLogin);
    await page.goto(`${employeeBase}#/employee/08/09/03`);
    const ownerRecord = page.locator(`article[data-promotion-id="${id}"]`);
    await expect(ownerRecord).toContainText('S08');
    await page.getByPlaceholder('节点不可变证据').fill('员工确认任命事实');
    await ownerRecord.getByRole('button', { name: '员工确认任命' }).click();
    await expect(ownerRecord).toContainText('S09');
    current = await getPromotion(request, reviewer, id);
    current = await move(request, reviewer, id, 'COMPLETE_PROBATION', current.versionNo, { probationResult: 'PASS' });
    current = await move(request, appointer, id, 'MAKE_EFFECTIVE', current.versionNo, { actualEffectiveDate: '2026-10-01', externalReference: 'EFFECTIVE-BROWSER-012' });
    expect(current.currentNodeCode).toBe('END');
    expect(current.executions.map((fact) => fact.executionType)).toEqual(['CONFIRMED', 'EFFECTIVE']);
}
async function verifyTechMasking(context: ScenarioContext, id: string): Promise<void> {
    const { page, request, tech } = context;
    await login(page, techBase, techLogin);
    await page.goto(`${techBase}#/tech/05/03/01`);
    const techRouteHeading = page.getByRole('heading', { name: 'P004/P005 工作流监控', level: 1 });
    await expect(techRouteHeading).toHaveCount(1);
    await expect(techRouteHeading).toBeVisible();
    const techBusinessHeading = page.getByRole('heading', { name: '晋升与任命流程元数据监控', level: 2 });
    await expect(techBusinessHeading).toHaveCount(1);
    await expect(techBusinessHeading).toBeVisible();
    const techRecord = page.locator(`article[data-promotion-id="${id}"]`);
    await expect(techRecord).toContainText('END');
    await expect(techRecord).toContainText('人员、分数、薪资引用、证据和任命执行已隐藏');
    await expect(techRecord.getByRole('button')).toHaveCount(0);
    await expect(techRecord).not.toContainText('918');
    await expect(techRecord).not.toContainText('SALARY-AUTH');
    const masked = await getPromotion(request, tech, id);
    expect(masked.executions).toEqual([]);
}
test('P012 real browser keeps approval separate and executes evidence-backed appointment lifecycle', async ({ page, request }) => {
    const context: ScenarioContext = await createContext(page, request);
    const id = await createPromotion(context);
    await verifyVisibility(context, id);
    const current = await advancePromotion(context, id);
    await confirmAndFinish(context, id, current);
    await verifyTechMasking(context, id);
});
