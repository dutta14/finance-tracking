// Helper function to parse date string "YYYY-MM-DD" safely
export const parseDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-')
  return new Date(Number(year), Number(month) - 1, Number(day))
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

// Helper function to format date as "Mmm YYYY"
export const formatMonthYear = (dateString: string): string => {
  const date = parseDate(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export const parseShortMonthYear = (monthYear: string): string | null => {
  const parts = monthYear.trim().split(/\s+/)
  if (parts.length !== 2) return null

  const monthIndex = SHORT_MONTHS.indexOf(parts[0] as (typeof SHORT_MONTHS)[number])
  const year = Number(parts[1])
  if (monthIndex < 0 || Number.isNaN(year)) return null

  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`
}

export const formatYearMonthLong = (yearMonth: string): string => {
  const [year, month] = yearMonth.split('-').map(Number)
  if (!year || !month || month < 1 || month > 12) return yearMonth
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export const formatTimeUntilYearMonth = (yearMonth: string, fromDate = new Date()): string => {
  const [year, month] = yearMonth.split('-').map(Number)
  if (!year || !month || month < 1 || month > 12) return ''

  const totalMonths = Math.max(0, (year - fromDate.getFullYear()) * 12 + (month - 1 - fromDate.getMonth()))
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12

  if (years > 0 && months > 0) return `${years} year${years > 1 ? 's' : ''} ${months} month${months > 1 ? 's' : ''}`
  if (years > 0) return `${years} year${years > 1 ? 's' : ''}`
  return `${months} month${months !== 1 ? 's' : ''}`
}

// Helper function to get months between two dates (matches Excel DATEDIF behavior)
export const getMonthsBetween = (startDate: Date, endDate: Date): number => {
  const yearsDiff = endDate.getFullYear() - startDate.getFullYear()
  const monthsDiff = endDate.getMonth() - startDate.getMonth()
  let totalMonths = yearsDiff * 12 + monthsDiff

  // DATEDIF counts complete months - if start day > end day, subtract 1
  if (startDate.getDate() > endDate.getDate()) {
    totalMonths--
  }

  return totalMonths
}
