/**
 * ESLint rule: no-direct-storage-access
 *
 * User data lives in the user-selected data folder via FileStore, never in
 * localStorage. This rule catches the legacy keys creeping back in.
 */

const SENSITIVE_KEYS = [
  'user-profile',
  'data-accounts',
  'data-balances',
  'budget-store',
  'budget-summary',
  'budget-config',
  'tax-store',
  'tax-templates',
  'financialGoals',
  'gw-goals',
  'fi-simulations',
  'allocation-custom-ratios',
  'sgt-overrides',
  'paydown-loans',
]

const EXEMPT_FILES = ['src/utils/storage.ts']

const STORAGE_METHODS = ['getItem', 'setItem', 'removeItem']

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow storing user data in localStorage (use the FileStore instead)',
    },
    messages: {
      directAccess:
        'localStorage.{{method}}("{{key}}") stores user data in the browser. Write it through the FileStore instead.',
      dynamicAccess:
        'localStorage.{{method}}() with a dynamic key may store user data. Use the FileStore for user data.',
    },
    schema: [],
    hasSuggestions: false,
  },
  create(context) {
    const filename = context.filename || context.getFilename()

    // Check if this file is exempt
    const isExempt = EXEMPT_FILES.some(exempt => filename.includes(exempt)) || filename.includes('.test.')

    if (isExempt) return {}

    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== 'MemberExpression') return
        if (callee.property.type !== 'Identifier') return
        if (!STORAGE_METHODS.includes(callee.property.name)) return

        // Check if it's localStorage.method or window.localStorage.method
        let isLocalStorage = false
        if (callee.object.type === 'Identifier' && callee.object.name === 'localStorage') {
          isLocalStorage = true
        } else if (
          callee.object.type === 'MemberExpression' &&
          callee.object.object.type === 'Identifier' &&
          callee.object.object.name === 'window' &&
          callee.object.property.type === 'Identifier' &&
          callee.object.property.name === 'localStorage'
        ) {
          isLocalStorage = true
        }

        if (!isLocalStorage) return

        const method = callee.property.name
        const firstArg = node.arguments[0]

        if (firstArg && firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
          if (SENSITIVE_KEYS.includes(firstArg.value)) {
            context.report({
              node,
              messageId: 'directAccess',
              data: { method, key: firstArg.value },
            })
          }
        }
        // Dynamic keys are not flagged — static analysis can't determine the value
      },
    }
  },
}

export default rule
