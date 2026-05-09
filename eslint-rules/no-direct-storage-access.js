/**
 * ESLint rule: no-direct-storage-access
 *
 * Prevents direct localStorage access for sensitive keys.
 * All sensitive key access must go through appStorage.
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
]

const EXEMPT_FILES = [
  'src/utils/appStorage.ts',
  'src/utils/encryptedStorage.ts',
  'src/utils/storage.ts',
  'src/utils/migratePlaintext.ts',
  'src/contexts/EncryptionContext.tsx',
  'src/pages/settings/demoMode.ts',
]

const STORAGE_METHODS = ['getItem', 'setItem', 'removeItem']

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow direct localStorage access for sensitive keys (use appStorage instead)',
    },
    messages: {
      directAccess:
        'Direct localStorage.{{method}}("{{key}}") for sensitive key "{{key}}" is not allowed. Use appStorage instead.',
      dynamicAccess:
        'localStorage.{{method}}() with a dynamic key may access sensitive data. Use appStorage for sensitive keys.',
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
