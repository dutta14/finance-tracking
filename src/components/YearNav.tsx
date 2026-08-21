import { FC } from 'react'

interface YearNavProps {
  selectedYear: number
  onPrevYear: () => void
  onNextYear: () => void
  disablePrev?: boolean
  disableNext?: boolean
  size?: 'sm' | 'default'
}

const YearNav: FC<YearNavProps> = ({
  selectedYear,
  onPrevYear,
  onNextYear,
  disablePrev,
  disableNext,
  size = 'default',
}) => (
  <div className={`budget-year-nav${size === 'sm' ? ' budget-year-nav--sm' : ''}`}>
    <button className="budget-year-btn" onClick={onPrevYear} disabled={disablePrev} title="Previous year">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
    <span className="budget-year-label">{selectedYear}</span>
    <button className="budget-year-btn" onClick={onNextYear} disabled={disableNext} title="Next year">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  </div>
)

export default YearNav
