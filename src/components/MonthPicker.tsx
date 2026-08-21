import { FC, KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '../styles/MonthPicker.css'

export interface MonthPickerProps {
  allMonths: string[]
  selectedMonth: string
  onMonthChange: (month: string) => void
}

const MONTH_PICKER_MONTHS = [
  { value: '01', shortLabel: 'Jan', longLabel: 'January' },
  { value: '02', shortLabel: 'Feb', longLabel: 'February' },
  { value: '03', shortLabel: 'Mar', longLabel: 'March' },
  { value: '04', shortLabel: 'Apr', longLabel: 'April' },
  { value: '05', shortLabel: 'May', longLabel: 'May' },
  { value: '06', shortLabel: 'Jun', longLabel: 'June' },
  { value: '07', shortLabel: 'Jul', longLabel: 'July' },
  { value: '08', shortLabel: 'Aug', longLabel: 'August' },
  { value: '09', shortLabel: 'Sep', longLabel: 'September' },
  { value: '10', shortLabel: 'Oct', longLabel: 'October' },
  { value: '11', shortLabel: 'Nov', longLabel: 'November' },
  { value: '12', shortLabel: 'Dec', longLabel: 'December' },
] as const

const formatMonthLabel = (month: string) => {
  const [year, monthValue] = month.split('-')
  const monthIndex = Number(monthValue) - 1

  if (!year || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex >= MONTH_PICKER_MONTHS.length) {
    return month
  }

  return `${MONTH_PICKER_MONTHS[monthIndex].longLabel} ${year}`
}

const getMonthYear = (month: string | undefined) => (month ? Number(month.slice(0, 4)) : undefined)

const buildMonthKey = (year: number, monthValue: string) => `${year}-${monthValue}`

const MonthPicker: FC<MonthPickerProps> = ({ allMonths, selectedMonth, onMonthChange }) => {
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false)
  const [isYearGridOpen, setIsYearGridOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(
    () => getMonthYear(selectedMonth || allMonths[0]) ?? new Date().getFullYear(),
  )
  const monthPickerRef = useRef<HTMLDivElement>(null)
  const monthTriggerRef = useRef<HTMLButtonElement>(null)
  const monthButtonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const yearGridRef = useRef<HTMLDivElement>(null)

  const selectedMonthIndex = allMonths.indexOf(selectedMonth)
  const selectedYear = getMonthYear(selectedMonth)
  const isMonthNavigationDisabled = allMonths.length === 0
  const isAtOldestMonth = selectedMonthIndex >= allMonths.length - 1
  const isAtNewestMonth = selectedMonthIndex <= 0
  const availableMonthSet = useMemo(() => new Set(allMonths), [allMonths])
  const availableYears = useMemo(
    () =>
      Array.from(new Set(allMonths.map(month => Number(month.slice(0, 4)))))
        .filter(year => !Number.isNaN(year))
        .sort((a, b) => a - b),
    [allMonths],
  )
  const displayedYear = availableYears.includes(pickerYear)
    ? pickerYear
    : (selectedYear ?? availableYears[0] ?? new Date().getFullYear())
  const displayedYearIndex = availableYears.indexOf(displayedYear)
  const isAtOldestYear = displayedYearIndex <= 0
  const isAtNewestYear = displayedYearIndex === -1 || displayedYearIndex >= availableYears.length - 1

  useEffect(() => {
    if (selectedYear !== undefined) {
      setPickerYear(selectedYear)
      return
    }

    if (availableYears.length > 0) {
      setPickerYear(availableYears[0])
    }
  }, [availableYears, selectedYear])

  const closeMonthPicker = useCallback((focusTrigger = false) => {
    setIsMonthPickerOpen(false)
    setIsYearGridOpen(false)

    if (focusTrigger) {
      monthTriggerRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    if (!isMonthPickerOpen) return

    const handleDocumentPointerDown = (event: MouseEvent) => {
      const target = event.target as Node

      if (monthPickerRef.current?.contains(target) || monthTriggerRef.current?.contains(target)) {
        return
      }

      closeMonthPicker()
    }

    const handleDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMonthPicker(true)
      }
    }

    document.addEventListener('mousedown', handleDocumentPointerDown)
    document.addEventListener('keydown', handleDocumentKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleDocumentPointerDown)
      document.removeEventListener('keydown', handleDocumentKeyDown)
    }
  }, [closeMonthPicker, isMonthPickerOpen])

  useEffect(() => {
    if (!isMonthPickerOpen) return

    const selectedMonthGridIndex = MONTH_PICKER_MONTHS.findIndex(
      ({ value }) => buildMonthKey(displayedYear, value) === selectedMonth,
    )
    const firstEnabledMonthGridIndex = MONTH_PICKER_MONTHS.findIndex(({ value }) =>
      availableMonthSet.has(buildMonthKey(displayedYear, value)),
    )
    const targetIndex = selectedMonthGridIndex >= 0 ? selectedMonthGridIndex : firstEnabledMonthGridIndex

    if (targetIndex < 0) return

    const frameId = window.requestAnimationFrame(() => {
      monthButtonRefs.current[targetIndex]?.focus()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [availableMonthSet, displayedYear, isMonthPickerOpen, selectedMonth])

  const selectMonth = useCallback(
    (monthKey: string) => {
      if (!availableMonthSet.has(monthKey)) return

      onMonthChange(monthKey)
      closeMonthPicker()
    },
    [availableMonthSet, closeMonthPicker, onMonthChange],
  )

  const focusMonthButton = useCallback(
    (startIndex: number, delta: number) => {
      let nextIndex = startIndex + delta

      while (nextIndex >= 0 && nextIndex < MONTH_PICKER_MONTHS.length) {
        if (availableMonthSet.has(buildMonthKey(displayedYear, MONTH_PICKER_MONTHS[nextIndex].value))) {
          monthButtonRefs.current[nextIndex]?.focus()
          return
        }

        nextIndex += delta
      }
    },
    [availableMonthSet, displayedYear],
  )

  const focusEdgeMonthButton = useCallback(
    (direction: 'start' | 'end') => {
      const monthIndexes =
        direction === 'start'
          ? MONTH_PICKER_MONTHS.map((_, index) => index)
          : MONTH_PICKER_MONTHS.map((_, index) => index).reverse()

      const targetIndex = monthIndexes.find(index =>
        availableMonthSet.has(buildMonthKey(displayedYear, MONTH_PICKER_MONTHS[index].value)),
      )

      if (targetIndex !== undefined) {
        monthButtonRefs.current[targetIndex]?.focus()
      }
    },
    [availableMonthSet, displayedYear],
  )

  const handleMonthButtonKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, monthGridIndex: number) => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        focusMonthButton(monthGridIndex, 1)
        break
      case 'ArrowLeft':
        event.preventDefault()
        focusMonthButton(monthGridIndex, -1)
        break
      case 'ArrowDown':
        event.preventDefault()
        focusMonthButton(monthGridIndex, 4)
        break
      case 'ArrowUp':
        event.preventDefault()
        focusMonthButton(monthGridIndex, -4)
        break
      case 'Home':
        event.preventDefault()
        focusEdgeMonthButton('start')
        break
      case 'End':
        event.preventDefault()
        focusEdgeMonthButton('end')
        break
      case 'Escape':
        event.preventDefault()
        closeMonthPicker(true)
        break
      default:
        break
    }
  }

  return (
    <div className="details-month-control">
      <button
        className="details-month-chevron"
        type="button"
        aria-label="Previous month"
        disabled={isMonthNavigationDisabled || isAtOldestMonth || selectedMonthIndex < 0}
        onClick={() => {
          const nextMonth = allMonths[selectedMonthIndex + 1]

          if (nextMonth) {
            onMonthChange(nextMonth)
          }
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 2L4 7L9 12" />
        </svg>
      </button>
      <div className="details-month-picker-container">
        <button
          ref={monthTriggerRef}
          className="details-month-trigger"
          type="button"
          aria-label={selectedMonth ? `Choose month, currently ${formatMonthLabel(selectedMonth)}` : 'Choose month'}
          aria-expanded={isMonthPickerOpen}
          aria-haspopup="dialog"
          disabled={isMonthNavigationDisabled}
          onClick={() => setIsMonthPickerOpen(open => !open)}
        >
          {selectedMonth ? formatMonthLabel(selectedMonth) : 'No data'}
        </button>
        {isMonthPickerOpen ? (
          <div ref={monthPickerRef} className="details-month-picker" role="dialog" aria-label="Select month">
            <div className="details-month-picker-year">
              <button
                className="details-month-chevron"
                type="button"
                aria-label={`Show previous year${displayedYear ? `, ${displayedYear - 1}` : ''}`}
                disabled={isAtOldestYear}
                onClick={() => {
                  if (!isAtOldestYear) {
                    setPickerYear(availableYears[displayedYearIndex - 1])
                  }
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 2L4 7L9 12" />
                </svg>
              </button>
              <span aria-live="polite">
                <button
                  type="button"
                  className="details-month-picker-year-btn"
                  aria-label={`Select year, currently ${displayedYear}`}
                  onClick={() => {
                    setIsYearGridOpen(open => !open)
                    if (!isYearGridOpen) {
                      requestAnimationFrame(() => {
                        const selected = yearGridRef.current?.querySelector('[aria-pressed="true"]')
                        if (selected) (selected as HTMLElement).scrollIntoView({ block: 'center' })
                      })
                    }
                  }}
                >
                  {displayedYear}
                </button>
              </span>
              <button
                className="details-month-chevron"
                type="button"
                aria-label={`Show next year${displayedYear ? `, ${displayedYear + 1}` : ''}`}
                disabled={isAtNewestYear}
                onClick={() => {
                  if (!isAtNewestYear) {
                    setPickerYear(availableYears[displayedYearIndex + 1])
                  }
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 2L10 7L5 12" />
                </svg>
              </button>
            </div>
            {isYearGridOpen ? (
              <div ref={yearGridRef} className="details-year-grid" role="grid" aria-label="Select year">
                {availableYears.map(year => (
                  <button
                    key={year}
                    type="button"
                    className={`details-year-grid-cell${year === displayedYear ? ' details-year-grid-cell--selected' : ''}`}
                    aria-pressed={year === displayedYear}
                    onClick={() => {
                      setPickerYear(year)
                      setIsYearGridOpen(false)
                    }}
                  >
                    {year}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="details-month-picker-grid" role="grid" aria-label={`Months for ${displayedYear}`}>
              {MONTH_PICKER_MONTHS.map(({ value, shortLabel, longLabel }, monthGridIndex) => {
                const monthKey = buildMonthKey(displayedYear, value)
                const isEnabled = availableMonthSet.has(monthKey)
                const isSelected = selectedMonth === monthKey

                return (
                  <button
                    key={monthKey}
                    ref={element => {
                      monthButtonRefs.current[monthGridIndex] = element
                    }}
                    type="button"
                    className={`details-month-picker-cell${isSelected ? ' details-month-picker-cell--selected' : ''}`}
                    aria-label={`${longLabel} ${displayedYear}`}
                    aria-pressed={isSelected}
                    disabled={!isEnabled}
                    onClick={() => selectMonth(monthKey)}
                    onKeyDown={event => handleMonthButtonKeyDown(event, monthGridIndex)}
                  >
                    {shortLabel}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
      <button
        className="details-month-chevron"
        type="button"
        aria-label="Next month"
        disabled={isMonthNavigationDisabled || isAtNewestMonth || selectedMonthIndex < 0}
        onClick={() => {
          const nextMonth = allMonths[selectedMonthIndex - 1]

          if (nextMonth) {
            onMonthChange(nextMonth)
          }
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 2L10 7L5 12" />
        </svg>
      </button>
    </div>
  )
}

export default MonthPicker
