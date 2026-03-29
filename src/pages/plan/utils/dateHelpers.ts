// Helper function to parse date string "YYYY-MM-DD" safely
export const parseDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-')
  return new Date(Number(year), Number(month) - 1, Number(day))
}

// Helper function to format date as "Mmm YYYY"
export const formatMonthYear = (dateString: string): string => {
  const date = parseDate(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
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
