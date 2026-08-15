import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const composables = [
  'p011/use-p011-performance.ts',
  'p012/use-p012-promotion.ts',
  'p013/use-p013-reward.ts',
  'p014/use-p014-discipline.ts',
  'p015/use-p015-point-ledger.ts',
  'p016/use-p016-care-support.ts',
] as const

interface ActionAuthorityAudit {
  hasServerProjection: boolean
  violations: string[]
}

function functionName(node: ts.SignatureDeclaration): string | undefined {
  if ('name' in node && node.name && ts.isIdentifier(node.name)) return node.name.text
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    const parent = node.parent
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text
  }
  return undefined
}

function inspectActionMap(node: ts.Node, violations: Set<string>): void {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'ACTIONS') {
    violations.add('NODE_ACTION_MAP')
  }
}

function inspectDecisionProperty(node: ts.Node, insideActionFunction: boolean, violations: Set<string>): void {
  if (!insideActionFunction || !ts.isPropertyAccessExpression(node)) return
  if (node.name.text === 'currentNodeCode') violations.add('CURRENT_NODE_DECISION')
  if (node.name.text === 'employeeId') violations.add('SELF_DECISION')
  if (node.name.text === 'mode') violations.add('PORTAL_MODE_DECISION')
  if (node.name.text === 'can' && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'session') {
    violations.add('CLIENT_PERMISSION_DECISION')
  }
}

function inspectActionLookup(node: ts.Node, violations: Set<string>): void {
  if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression)
      && node.expression.text === 'ACTIONS') {
    violations.add('NODE_ACTION_LOOKUP')
  }
}

function auditActionAuthority(source: string): ActionAuthorityAudit {
  const file = ts.createSourceFile('candidate.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const violations = new Set<string>()
  let hasServerProjection = false

  const visit = (node: ts.Node, actionFunction = false): void => {
    const insideActionFunction = actionFunction
      || (ts.isFunctionLike(node) && functionName(node)?.toLowerCase().includes('availableactions') === true)
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'availableActions') {
      hasServerProjection = true
    }
    inspectActionMap(node, violations)
    inspectDecisionProperty(node, insideActionFunction, violations)
    inspectActionLookup(node, violations)
    ts.forEachChild(node, child => visit(child, insideActionFunction))
  }
  visit(file)
  return { hasServerProjection, violations: [...violations].sort() }
}

describe('PHASE-11 server-owned available action contract', () => {
  it('distinguishes code presentation from client-owned action authority', () => {
    const allowed = auditActionAuthority(`
      const ACTION_PRESENTATION = { SET_TARGET: { label: '设置目标' } }
      function availableActions(item: { availableActions: Array<{ code: string }> }) {
        return item.availableActions.map(action => ACTION_PRESENTATION[action.code])
      }
    `)
    const forbidden = auditActionAuthority(`
      const ACTIONS = { S01: [{ code: 'SET_TARGET' }] }
      function availableActions(context: any, item: any) {
        return ACTIONS[item.currentNodeCode].filter(action => context.session.can(action.permission))
      }
    `)

    expect(allowed).toEqual({ hasServerProjection: true, violations: [] })
    expect(forbidden.hasServerProjection).toBe(false)
    expect(forbidden.violations).toEqual([
      'CLIENT_PERMISSION_DECISION', 'CURRENT_NODE_DECISION', 'NODE_ACTION_LOOKUP', 'NODE_ACTION_MAP',
    ])
  })

  it.each(composables)('%s consumes server codes without deciding the action set', relativePath => {
    const source = readFileSync(resolve(process.cwd(), 'src/platform/phase11', relativePath), 'utf8')
    const result = auditActionAuthority(source)

    expect(result.hasServerProjection).toBe(true)
    expect(result.violations).toEqual([])
  })
})
