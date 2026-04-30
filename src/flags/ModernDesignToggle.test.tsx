import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

const mockUseFlag = vi.fn()
vi.mock('./useFlag', () => ({ useFlag: (...args: unknown[]) => mockUseFlag(...args) }))

import { ModernDesignToggle } from './ModernDesignToggle'

beforeEach(() => {
  vi.clearAllMocks()
  document.body.classList.remove('modern-design')
})

describe('ModernDesignToggle', () => {
  it('does not add modern-design class when flag is disabled', () => {
    mockUseFlag.mockReturnValue(false)
    render(<ModernDesignToggle />)

    expect(document.body.classList.contains('modern-design')).toBe(false)
  })

  it('adds modern-design class when flag is enabled', () => {
    mockUseFlag.mockReturnValue(true)
    render(<ModernDesignToggle />)

    expect(document.body.classList.contains('modern-design')).toBe(true)
  })

  it('removes modern-design class on unmount', () => {
    mockUseFlag.mockReturnValue(true)
    const { unmount } = render(<ModernDesignToggle />)

    expect(document.body.classList.contains('modern-design')).toBe(true)

    unmount()

    expect(document.body.classList.contains('modern-design')).toBe(false)
  })

  it('removes modern-design class when flag changes from true to false', () => {
    mockUseFlag.mockReturnValue(true)
    const { rerender } = render(<ModernDesignToggle />)

    expect(document.body.classList.contains('modern-design')).toBe(true)

    mockUseFlag.mockReturnValue(false)
    rerender(<ModernDesignToggle />)

    expect(document.body.classList.contains('modern-design')).toBe(false)
  })
})
