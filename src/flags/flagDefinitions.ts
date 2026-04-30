import { defineFlag } from './flagSystem'

export const FLAGS = {
  MODERN_DESIGN: defineFlag('modern-design', {
    type: 'boolean',
    default: false,
    description: 'Enables the modernized CSS design system',
    temporary: true,
  }),
} as const
