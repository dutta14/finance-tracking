import { FC, useState, useRef, useCallback } from 'react'
import '../styles/TermAbbr.css'

const TERMS: Record<string, string> = {
  FI: 'Financial Independence — the portfolio size needed so investment returns cover your living expenses.',
  GW: 'Generational Wealth — assets earmarked for legacy goals like children\'s education or inheritance.',
}

interface TermAbbrProps {
  term: 'FI' | 'GW'
  className?: string
}

const TermAbbr: FC<TermAbbrProps> = ({ term, className }) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLElement>(null)

  const show = useCallback(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setPos({ top: rect.top - 8, left: rect.left + rect.width / 2 })
  }, [])

  const hide = useCallback(() => setPos(null), [])

  return (
    <abbr
      ref={ref}
      className={`term-abbr${className ? ` ${className}` : ''}`}
      tabIndex={0}
      aria-label={term === 'FI' ? 'Financial Independence' : 'Generational Wealth'}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {term}
      {pos && (
        <span
          className="term-tooltip"
          role="tooltip"
          style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translate(-50%, -100%)' }}
        >
          {TERMS[term]}
        </span>
      )}
    </abbr>
  )
}

export default TermAbbr
