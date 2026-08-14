import { existsSync, readFileSync } from 'node:fs'
import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'

interface ProcessFiles {
  code: string
  page: URL
  feature: URL
  composable: URL
}

interface E2eFile {
  code: string
  spec: URL
}

interface CallableMetric {
  effectiveLines: number
  name: string
}

interface E2eMetrics {
  callables: CallableMetric[]
  denseSourceLines: number[]
  forbiddenCalls: string[]
  maximumCallableLines: number
  topLevelCallables: number
}

const processes: ProcessFiles[] = [
  files('P011', 'P011PerformancePage.vue', 'p011/P011PerformanceFeature.vue', 'p011/use-p011-performance.ts'),
  files('P012', 'P012PromotionPage.vue', 'p012/P012PromotionFeature.vue', 'p012/use-p012-promotion.ts'),
  files('P013', 'P013RewardPage.vue', 'p013/P013RewardFeature.vue', 'p013/use-p013-reward.ts'),
  files('P014', 'P014DisciplinePage.vue', 'p014/P014DisciplineFeature.vue', 'p014/use-p014-discipline.ts'),
  files('P015', 'P015PointLedgerPage.vue', 'p015/P015PointLedgerFeature.vue', 'p015/use-p015-point-ledger.ts'),
  files('P016', 'P016CareSupportPage.vue', 'p016/P016CareSupportFeature.vue', 'p016/use-p016-care-support.ts'),
]

const e2eProcesses: E2eFile[] = [
  e2e('P012', 'phase11-p012-live.spec.ts'),
  e2e('P013', 'phase11-p013-live.spec.ts'),
  e2e('P014', 'phase11-p014-live.spec.ts'),
  e2e('P015', 'phase11-p015-live.spec.ts'),
  e2e('P016', 'phase11-p016-live.spec.ts'),
]

const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })

function files(code: string, page: string, feature: string, composable: string): ProcessFiles {
  return {
    code,
    page: new URL(`../pages/${page}`, import.meta.url),
    feature: new URL(`./${feature}`, import.meta.url),
    composable: new URL(`./${composable}`, import.meta.url),
  }
}

function e2e(code: string, spec: string): E2eFile {
  return { code, spec: new URL(`../../../e2e/${spec}`, import.meta.url) }
}

function source(url: URL): string {
  return readFileSync(url, 'utf8')
}

function lineCount(value: string): number {
  return value.trimEnd().split(/\r?\n/u).length
}

function blockLineCount(value: string, open: RegExp, close: RegExp): number {
  const lines = value.trimEnd().split(/\r?\n/u)
  const start = lines.findIndex(line => open.test(line))
  const end = lines.findIndex((line, index) => index >= start && close.test(line))
  return start < 0 || end < start ? 0 : end - start + 1
}

function vueMetrics(value: string) {
  const total = lineCount(value)
  const script = blockLineCount(value, /^<script\b/u, /^<\/script>/u)
  const template = blockLineCount(value, /^<template>/u, /^<\/template>/u)
  const style = blockLineCount(value, /^<style\b/u, /^<\/style>/u)
  return { total, script, template, effective: total - style }
}

function topLevelCallables(value: string): string[] {
  const declarations = [...value.matchAll(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gmu)]
    .map(match => match[1]!)
  const expressions = [...value.matchAll(/^(?:export\s+)?const\s+(\w+)\s*=\s*(?:(?:async\s+)?(?:\([^)]*\)|[\w$]+)\s*=>|(?:async\s+)?function\b)/gmu)]
    .map(match => match[1]!)
  return [...declarations, ...expressions]
}

function delimitedBlockLength(
  lines: string[],
  start: number,
  opening: RegExp,
  closing: RegExp,
): number {
  let depth = 0
  let opened = false
  for (let end = start; end < lines.length; end += 1) {
    const line = lines[end] ?? ''
    depth += (line.match(opening) ?? []).length
    if (depth > 0) opened = true
    depth -= (line.match(closing) ?? []).length
    if (opened && depth === 0) return end - start + 1
  }
  return 0
}

function maximumBlockLines(
  value: string,
  startsBlock: (line: string) => boolean,
  opening: RegExp,
  closing: RegExp,
): number {
  const lines = value.split(/\r?\n/u)
  return lines.reduce((maximum, line, start) => startsBlock(line)
    ? Math.max(maximum, delimitedBlockLength(lines, start, opening, closing))
    : maximum, 0)
}

function maximumFunctionLines(value: string): number {
  const callable = /^(?:(?:export\s+)?(?:async\s+)?function\s+\w+\s*\(|(?:export\s+)?const\s+\w+\s*=\s*(?:(?:async\s+)?(?:\([^)]*\)|[\w$]+)\s*=>|(?:async\s+)?function\b))/u
  return maximumBlockLines(value, line => callable.test(line), /[{]/gu, /[}]/gu)
}

function maximumComputedLines(value: string): number {
  return maximumBlockLines(value, line => /\bcomputed\s*\(/u.test(line), /[(]/gu, /[)]/gu)
}

function isCallable(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return ts.isFunctionDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node)
}

function callableName(node: ts.FunctionLikeDeclaration, file: ts.SourceFile): string {
  if ('name' in node && node.name) return node.name.getText(file)
  if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) return node.parent.name.text
  const position = file.getLineAndCharacterOfPosition(node.getStart(file))
  return `anonymous@${position.line + 1}:${position.character + 1}`
}

function effectivePrintedLines(node: ts.Node, file: ts.SourceFile): number {
  return printer.printNode(ts.EmitHint.Unspecified, node, file)
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(line => line !== '' && !/^[{}];?$/u.test(line))
    .length
}

function topLevelCallableCount(file: ts.SourceFile): number {
  return file.statements.reduce((count, statement) => {
    if (ts.isFunctionDeclaration(statement)) return count + 1
    if (ts.isVariableStatement(statement)) {
      return count + statement.declarationList.declarations
        .filter(declaration => declaration.initializer && isCallable(declaration.initializer)).length
    }
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) return count
    return count + statement.expression.arguments.filter(isCallable).length
  }, 0)
}

function collectCallables(file: ts.SourceFile): CallableMetric[] {
  const callables: CallableMetric[] = []
  function visit(node: ts.Node): void {
    if (isCallable(node)) {
      callables.push({
        effectiveLines: effectivePrintedLines(node, file),
        name: callableName(node, file),
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return callables
}

function denseStatementLines(file: ts.SourceFile): number[] {
  const counts = new Map<number, number>()
  function visit(node: ts.Node): void {
    if (ts.isStatement(node) && !ts.isBlock(node)) {
      const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
      counts.set(line, (counts.get(line) ?? 0) + 1)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([line]) => line)
}

function expressionPath(expression: ts.Expression): string {
  if (ts.isIdentifier(expression)) return expression.text
  if (ts.isPropertyAccessExpression(expression)) {
    return `${expressionPath(expression.expression)}.${expression.name.text}`
  }
  return ''
}

function retryInfoBindings(file: ts.SourceFile): Set<string> {
  const bindings = new Set<string>()
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && /^test(?:\.|$)/u.test(expressionPath(node.expression))) {
      node.arguments.forEach(argument => {
        if (!isCallable(argument)) return
        argument.parameters.slice(1).forEach(parameter => {
          if (ts.isIdentifier(parameter.name)) bindings.add(parameter.name.text)
        })
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return bindings
}

function propertyName(property: ts.ObjectLiteralElementLike): string {
  if (!('name' in property) || !property.name) return ''
  if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) return property.name.text
  return ''
}

function configuresRetries(call: ts.CallExpression): boolean {
  if (expressionPath(call.expression) !== 'test.describe.configure') return false
  return call.arguments.some(argument => ts.isObjectLiteralExpression(argument)
    && argument.properties.some(property => propertyName(property) === 'retries'))
}

function retryProperty(node: ts.Node, bindings: Set<string>): string {
  if (!ts.isPropertyAccessExpression(node) || node.name.text !== 'retry') return ''
  if (!ts.isIdentifier(node.expression) || !bindings.has(node.expression.text)) return ''
  return `${node.expression.text}.retry`
}

function forbiddenCalls(file: ts.SourceFile): string[] {
  const calls: string[] = []
  const bindings = retryInfoBindings(file)
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const path = expressionPath(node.expression)
      if (/\.(?:skip|only|fixme|waitForTimeout|retry)$/u.test(path) || path === 'retry') calls.push(path)
      if (configuresRetries(node)) calls.push('test.describe.configure.retries')
    }
    const property = retryProperty(node, bindings)
    if (property !== '') calls.push(property)
    ts.forEachChild(node, visit)
  }
  visit(file)
  return calls
}

function syntheticSource(value: string): ts.SourceFile {
  return ts.createSourceFile('synthetic-e2e.spec.ts', value, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
}

function e2eMetrics(item: E2eFile): E2eMetrics {
  const value = source(item.spec)
  const file = ts.createSourceFile(item.spec.pathname, value, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const callables = collectCallables(file)
  return {
    callables,
    denseSourceLines: denseStatementLines(file),
    forbiddenCalls: forbiddenCalls(file),
    maximumCallableLines: Math.max(0, ...callables.map(callable => callable.effectiveLines)),
    topLevelCallables: topLevelCallableCount(file),
  }
}

describe('PHASE-11 page, feature and composable complexity boundaries', () => {
  it.each(processes)('$code uses a thin route page and process-local feature/composable', item => {
    expect(existsSync(item.feature), `${item.code} feature is required`).toBe(true)
    expect(existsSync(item.composable), `${item.code} composable is required`).toBe(true)

    const page = source(item.page)
    const pageMetrics = vueMetrics(page)
    expect(pageMetrics.effective, `${item.code} page effective lines`).toBeLessThanOrEqual(300)
    expect(pageMetrics.script, `${item.code} page script lines`).toBeLessThanOrEqual(180)
    expect(pageMetrics.template, `${item.code} page template lines`).toBeLessThanOrEqual(180)

    if (!existsSync(item.feature) || !existsSync(item.composable)) return
    const feature = source(item.feature)
    const featureMetrics = vueMetrics(feature)
    expect(featureMetrics.total, `${item.code} feature total lines`).toBeLessThanOrEqual(400)
    expect(featureMetrics.script, `${item.code} feature script lines`).toBeLessThanOrEqual(200)
    expect(featureMetrics.template, `${item.code} feature template lines`).toBeLessThanOrEqual(200)
    expect(feature).toContain("from '@sgj/ui'")
    expect(feature).not.toMatch(/design-system\/components|\.\.\/\.\.\/design-system/u)
    expect(feature).not.toMatch(/<(?:input|select|textarea|button)\b/iu)
    expect(topLevelCallables(feature).length, `${item.code} feature top-level callables`).toBeLessThanOrEqual(15)
    expect(maximumFunctionLines(feature), `${item.code} feature longest function`).toBeLessThanOrEqual(40)
    expect(maximumComputedLines(feature), `${item.code} feature longest computed`).toBeLessThanOrEqual(25)

    const composable = source(item.composable)
    expect(lineCount(composable), `${item.code} composable total lines`).toBeLessThanOrEqual(400)
    expect(topLevelCallables(composable).length, `${item.code} composable top-level callables`).toBeLessThanOrEqual(15)
    expect(maximumFunctionLines(composable), `${item.code} longest function`).toBeLessThanOrEqual(40)
    expect(maximumComputedLines(composable), `${item.code} longest computed`).toBeLessThanOrEqual(25)
    expect(composable.split(/\r?\n/u).filter(line => /function\s+\w+/u.test(line) && (line.match(/;/gu)?.length ?? 0) >= 2)).toEqual([])
  })
})

describe('PHASE-11 live E2E semantic complexity boundaries', () => {
  it('detects Playwright skip and retry controls without flagging a compliant test', () => {
    const forbiddenFixtures = [
      "test.skip('case', async () => {})",
      "test.only('case', async () => {})",
      "test.fixme('case', async () => {})",
      "test('case', async ({ page }) => { await page.waitForTimeout(1) })",
      'test.describe.configure({ retries: 2 })',
      "test('case', async ({ page }, testInfo) => { if (testInfo.retry > 0) await page.reload() })",
      "test('case', async () => { retry() })",
    ]
    forbiddenFixtures.forEach(fixture => {
      expect(forbiddenCalls(syntheticSource(fixture)), fixture).not.toEqual([])
    })
    const compliant = "test('case', async ({ page }) => { await page.goto('/ok'); expect(1).toBe(1) })"
    expect(forbiddenCalls(syntheticSource(compliant))).toEqual([])
  })

  it.each(e2eProcesses)('$code has reviewable callable and statement boundaries', item => {
    const metrics = e2eMetrics(item)
    const violations = [
      ...(metrics.maximumCallableLines > 40 ? ['CALLABLE_OVER_40'] : []),
      ...(metrics.topLevelCallables > 15 ? ['TOP_LEVEL_CALLABLES_OVER_15'] : []),
      ...(metrics.denseSourceLines.length > 0 ? ['DENSE_STATEMENT_LINES'] : []),
      ...(metrics.forbiddenCalls.length > 0 ? ['FORBIDDEN_PLAYWRIGHT_CONTROL'] : []),
    ]
    expect(violations, JSON.stringify(metrics, null, 2)).toEqual([])
  })
})
