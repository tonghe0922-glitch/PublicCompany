import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
const tenantCode = required('PHASE11_P013_TENANT'), managerLogin = required('PHASE11_P013_LOGIN'), password = required('PHASE11_P013_PASSWORD');
const ownerLogin = 'phase11.p013.owner', reviewerOneLogin = 'phase11.p013.reviewer1', reviewerTwoLogin = 'phase11.p013.reviewer2', approverLogin = 'phase11.p013.approver', executorLogin = 'phase11.p013.executor', techLogin = 'phase11.p013.tech', outsiderLogin = 'phase11.p013.out';
const api = 'http://127.0.0.1:18090', employeeBase = 'http://127.0.0.1:5330/employee.html', centerBase = 'http://127.0.0.1:5331/center.html', techBase = 'http://127.0.0.1:5332/admin.html', ownerId = '30000000-0000-0000-0000-000000003523';
interface Impact {
    id: string;
    impactType: string;
    requestedPoints: number | null;
    approvedAmount: number | null;
    authorityReference: string;
}
interface Reward {
    id: string;
    businessNo: string;
    currentNodeCode: string;
    versionNo: number;
    reason: string | null;
    factSummary: string | null;
    recommendedRewardLevel: string | null;
    approvedRewardLevel: string | null;
    benefitAmount: number | null;
    events: unknown[];
    impacts: Impact[];
    receipts: unknown[];
}
interface ScenarioContext {
    page: Page;
    request: APIRequestContext;
    manager: string;
    reviewerOne: string;
    reviewerTwo: string;
    approver: string;
    executor: string;
    tech: string;
    outsider: string;
}
interface ImpactInstructions {
    pointsInstruction: string;
    bonusInstruction: string;
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
async function getReward(request: APIRequestContext, token: string, id: string) {
    const response = await request.get(`${api}/api/v1/processes/P013/reward-cases/${id}`, {
        headers: headers(token),
    });
    expect(response.status()).toBe(200);
    return (await response.json()) as Reward;
}
async function act(request: APIRequestContext, token: string, id: string, code: string, version: number, data: Record<string, unknown> = {}) {
    const response = await request.post(`${api}/api/v1/processes/P013/reward-cases/${id}/actions/${code}`, {
        headers: { ...headers(token), 'Idempotency-Key': `p013-${code}-${randomUUID()}` },
        data: { expectedVersion: version, rewardLevel: null, impactType: null, requestedPoints: null, approvedAmount: null, authorityReference: null, instructionId: null, receiptType: null, externalReference: null, externalOccurredAt: null, resultSummary: 'browser verified', evidence: evidence(code), ...data },
    });
    return { status: response.status(), body: response.ok() ? ((await response.json()) as Reward) : undefined };
}
async function move(request: APIRequestContext, token: string, id: string, code: string, version: number, data: Record<string, unknown> = {}) {
    const result = await act(request, token, id, code, version, data);
    expect(result.status).toBe(200);
    if (!result.body) {
        throw new Error(`${code} response body missing`);
    }
    return result.body;
}
async function createReward(context: ScenarioContext): Promise<string> {
    const { page } = context;
    await login(page, centerBase, managerLogin);
    await page.goto(`${centerBase}#/center/10/10/03`);
    const centerRouteHeading = page.getByRole('heading', { name: '荣誉积分执行', level: 1 });
    await expect(centerRouteHeading).toHaveCount(1);
    await expect(centerRouteHeading).toBeVisible();
    const centerBusinessHeading = page.getByRole('heading', { name: '奖励事实、审批与执行回执', level: 2 });
    await expect(centerBusinessHeading).toHaveCount(1);
    await expect(centerBusinessHeading).toBeVisible();
    await page.getByPlaceholder('奖励案例主题').fill('P013 浏览器真实贡献奖励闭环');
    await page.getByPlaceholder('受影响员工 ID').fill(ownerId);
    await page.getByPlaceholder('唯一来源事实编号').fill('P013-BROWSER-FACT-001');
    await page.getByPlaceholder('可核验贡献事实摘要').fill('游客服务恢复贡献经两份来源记录核验');
    await page.getByPlaceholder('奖励案例说明').fill('基于事实发起，审批不等于积分或付款');
    await page.getByPlaceholder('不可变来源证据').fill('浏览器来源证据包');
    await page.getByRole('button', { name: '创建奖励案例' }).click();
    const record = page.locator('article.record').filter({ hasText: 'P013 浏览器真实贡献奖励闭环' });
    await expect(record).toContainText('S01');
    const id = await record.getAttribute('data-reward-id');
    expect(id).toBeTruthy();
    if (!id)
        throw new Error('reward id missing');
    return id;
}
async function verifyIsolation(context: ScenarioContext, id: string): Promise<void> {
    const { page, request, manager, tech, outsider } = context;
    await page.goto(`${centerBase}#/center/10/10/04`);
    await expect(page.locator(`article[data-reward-id="${id}"]`)).toBeVisible();
    const duplicate = await request.post(`${api}/api/v1/processes/P013/reward-cases`, { headers: { ...headers(manager), 'Idempotency-Key': `duplicate-${randomUUID()}` }, data: { businessDate: '2026-08-13', subject: 'P013 duplicate contribution reward', reason: 'duplicate must fail', ownerEmployeeId: ownerId, sourceFactKey: 'P013-BROWSER-FACT-001', employeeEventType: 'SERVICE_CONTRIBUTION', factOccurredAt: new Date().toISOString(), factSummary: 'duplicate fact', impactLevel: 'HIGH', evidence: evidence('duplicate') } });
    expect(duplicate.status()).toBe(409);
    const outsiderList = await request.get(`${api}/api/v1/processes/P013/reward-cases`, { headers: headers(outsider) });
    expect(await outsiderList.json()).toEqual([]);
    expect((await request.get(`${api}/api/v1/processes/P013/reward-cases/${id}`, { headers: headers(outsider) })).status()).toBe(403);
    const masked = await getReward(request, tech, id);
    expect(masked.reason).toBeNull();
    expect(masked.factSummary).toBeNull();
    expect(masked.recommendedRewardLevel).toBeNull();
    expect(masked.approvedRewardLevel).toBeNull();
    expect(masked.benefitAmount).toBeNull();
    expect(masked.events).toEqual([]);
    expect(masked.impacts).toEqual([]);
    expect(masked.receipts).toEqual([]);
}
async function approveReward(context: ScenarioContext, id: string): Promise<Reward> {
    const { request, manager, reviewerOne, reviewerTwo, approver } = context;
    let current = await getReward(request, manager, id);
    expect((await act(request, manager, id, 'RECORD_CONTRIBUTION', current.versionNo - 1)).status).toBe(409);
    current = await move(request, manager, id, 'RECORD_CONTRIBUTION', current.versionNo);
    current = await move(request, manager, id, 'VERIFY_EVIDENCE', current.versionNo);
    expect((await act(request, reviewerOne, id, 'RECOMMEND_LEVEL', current.versionNo, { rewardLevel: '' })).status).toBe(409);
    current = await move(request, reviewerOne, id, 'RECOMMEND_LEVEL', current.versionNo, { rewardLevel: 'GOLD' });
    expect((await act(request, reviewerOne, id, 'APPROVE', current.versionNo, { rewardLevel: 'GOLD' })).status).toBe(403);
    current = await move(request, approver, id, 'APPROVE', current.versionNo, { rewardLevel: 'GOLD' });
    expect((await act(request, approver, id, 'CHECK_DUPLICATE', current.versionNo)).status).toBe(403);
    current = await move(request, reviewerTwo, id, 'CHECK_DUPLICATE', current.versionNo);
    expect(current.impacts).toEqual([]);
    return current;
}
async function recordImpacts(context: ScenarioContext, id: string, current: Reward): Promise<ImpactInstructions> {
    const { request, executor } = context;
    current = await move(request, executor, id, 'RECORD_IMPACT', current.versionNo, { impactType: 'HONOR_POINTS', requestedPoints: 120, authorityReference: 'P015-RULE-BROWSER' });
    const pointsInstruction = current.impacts.find((impact) => impact.impactType === 'HONOR_POINTS')?.id;
    expect(pointsInstruction).toBeTruthy();
    current = await move(request, executor, id, 'RECORD_IMPACT', current.versionNo, { impactType: 'BONUS', approvedAmount: 880.5, authorityReference: 'FINANCE-AUTH-BROWSER' });
    const bonusInstruction = current.impacts.find((impact) => impact.impactType === 'BONUS')?.id;
    expect(bonusInstruction).toBeTruthy();
    if (!pointsInstruction || !bonusInstruction)
        throw new Error('impact instruction missing');
    await move(request, executor, id, 'COMPLETE_IMPACTS', current.versionNo);
    return { pointsInstruction, bonusInstruction };
}
async function completeReward(context: ScenarioContext, id: string, instructions: ImpactInstructions): Promise<void> {
    const { page, request, manager, executor } = context;
    const { pointsInstruction, bonusInstruction } = instructions;
    await login(page, employeeBase, ownerLogin);
    await page.goto(`${employeeBase}#/employee/08/10/05`);
    const ownerRecord = page.locator(`article[data-reward-id="${id}"]`);
    await expect(ownerRecord).toContainText('S07');
    await page.getByPlaceholder('节点不可变证据').fill('员工已阅读奖励事实与告知');
    await ownerRecord.getByRole('button', { name: '员工确认奖励告知' }).click();
    await expect(ownerRecord).toContainText('S08');
    let current = await getReward(request, executor, id);
    expect((await act(request, executor, id, 'COMPLETE_RECEIPTS', current.versionNo)).status).toBe(409);
    expect((await act(request, executor, id, 'RECORD_RECEIPT', current.versionNo, { instructionId: bonusInstruction, receiptType: 'P015_POINT_LEDGER', externalReference: 'WRONG-BROWSER', externalOccurredAt: new Date().toISOString() })).status).toBe(409);
    current = await move(request, executor, id, 'RECORD_RECEIPT', current.versionNo, { instructionId: pointsInstruction, receiptType: 'P015_POINT_LEDGER', externalReference: 'P015-LEDGER-BROWSER-013', externalOccurredAt: new Date().toISOString() });
    current = await move(request, executor, id, 'RECORD_RECEIPT', current.versionNo, { instructionId: bonusInstruction, receiptType: 'FINANCE_BONUS', externalReference: 'FINANCE-PAID-BROWSER-013', externalOccurredAt: new Date().toISOString() });
    current = await move(request, executor, id, 'COMPLETE_RECEIPTS', current.versionNo);
    current = await move(request, manager, id, 'ARCHIVE', current.versionNo);
    expect(current.currentNodeCode).toBe('END');
    expect(current.impacts).toHaveLength(2);
    expect(current.receipts).toHaveLength(2);
}
async function verifyTechMasking(context: ScenarioContext, id: string): Promise<void> {
    const { page, request, tech } = context;
    await login(page, techBase, techLogin);
    await page.goto(`${techBase}#/tech/06/06/01`);
    const techRouteHeading = page.getByRole('heading', { name: '配置列表', level: 1 });
    await expect(techRouteHeading).toHaveCount(1);
    await expect(techRouteHeading).toBeVisible();
    const techBusinessHeading = page.getByRole('heading', { name: '奖励流程元数据监控', level: 2 });
    await expect(techBusinessHeading).toHaveCount(1);
    await expect(techBusinessHeading).toBeVisible();
    const techRecord = page.locator(`article[data-reward-id="${id}"]`);
    await expect(techRecord).toContainText('END');
    await expect(techRecord).toContainText('贡献内容、奖励等级、金额、积分、证据、影响指令和执行回执已隐藏');
    await expect(techRecord.getByRole('button')).toHaveCount(0);
    await expect(techRecord).not.toContainText('880.5');
    await page.goto(`${techBase}#/tech/05/03/01`);
    await expect(page.locator(`article[data-reward-id="${id}"]`)).toContainText('END');
    const masked = await getReward(request, tech, id);
    expect(masked.impacts).toEqual([]);
    expect(masked.receipts).toEqual([]);
}
test('P013 real browser separates contribution approval instructions receipts and downstream systems', async ({ page, request }) => {
    const manager = await apiLogin(request, managerLogin);
    const reviewerOne = await apiLogin(request, reviewerOneLogin);
    const reviewerTwo = await apiLogin(request, reviewerTwoLogin);
    const approver = await apiLogin(request, approverLogin);
    const executor = await apiLogin(request, executorLogin);
    const tech = await apiLogin(request, techLogin);
    const outsider = await apiLogin(request, outsiderLogin);
    const context: ScenarioContext = { page, request, manager, reviewerOne, reviewerTwo, approver, executor, tech, outsider };
    const id = await createReward(context);
    await verifyIsolation(context, id);
    const current = await approveReward(context, id);
    const instructions = await recordImpacts(context, id, current);
    await completeReward(context, id, instructions);
    await verifyTechMasking(context, id);
});
