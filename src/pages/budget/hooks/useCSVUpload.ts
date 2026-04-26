import { useState, useRef } from 'react'

/** Extract YYYY-MM month key from a filename. Supports "2025-05.csv" and "Our Finances - May 2025.csv" */
export const monthKeyFromFilename = (name: string): string | null => {
  const isoMatch = name.match(/(\d{4})-(\d{2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`

  const MONTHS: Record<string, string> = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
  }
  const namedMatch = name.match(/Our\s+Finances\s*-\s*(\w+)\s+(\d{4})/i)
  if (namedMatch) {
    const mon = MONTHS[namedMatch[1].slice(0, 3).toLowerCase()]
    if (mon) return `${namedMatch[2]}-${mon}`
  }
  return null
}

export function useCSVUpload(
  uploadCSV: (monthKey: string, csv: string) => { ok: boolean; error?: string; newCategories?: string[] },
) {
  const [csvPreview, setCsvPreview] = useState<{ monthKey: string; csv: string } | null>(null)
  const [bulkQueue, setBulkQueue] = useState<{ monthKey: string; csv: string }[]>([])
  const [pendingNewCats, setPendingNewCats] = useState<string[]>([])
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const quickUploadRef = useRef<HTMLInputElement>(null)
  const bulkUploadRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string, duration = 5000) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), duration)
  }

  const handleQuickUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const monthKey = monthKeyFromFilename(file.name)
    if (!monthKey) {
      showToast('Could not determine month from filename. Use format: yyyy-mm.csv or "Our Finances - MMM YYYY.csv"')
      if (quickUploadRef.current) quickUploadRef.current.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setCsvPreview({ monthKey, csv: text })
    }
    reader.readAsText(file)
    if (quickUploadRef.current) quickUploadRef.current.value = ''
  }

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const pending: { monthKey: string; csv: string }[] = []
    const skipped: string[] = []

    for (const file of Array.from(files)) {
      const monthKey = monthKeyFromFilename(file.name)
      if (!monthKey) {
        skipped.push(file.name)
        continue
      }
      const text = await new Promise<string>(resolve => {
        const reader = new FileReader()
        reader.onload = ev => resolve(ev.target?.result as string)
        reader.readAsText(file)
      })
      pending.push({ monthKey, csv: text })
    }

    if (skipped.length > 0) {
      showToast(`Skipped ${skipped.length} file(s): couldn't determine month`)
    }

    if (pending.length > 0) {
      setCsvPreview(pending[0])
      setBulkQueue(pending.slice(1))
    }
    if (bulkUploadRef.current) bulkUploadRef.current.value = ''
  }

  const handlePreviewConfirm = (filteredCsv: string) => {
    if (!csvPreview) return
    const result = uploadCSV(csvPreview.monthKey, filteredCsv)
    const newCats = [...pendingNewCats, ...(result.newCategories || [])]
    if (!result.ok) {
      showToast(`Upload failed: ${result.error}`)
    } else if (bulkQueue.length === 0) {
      const uniqueNew = [...new Set(newCats)]
      if (uniqueNew.length > 0) {
        showToast(`New categories added to "Others": ${uniqueNew.join(', ')}`, 8000)
      } else {
        showToast('Uploaded successfully', 3000)
      }
      setPendingNewCats([])
    }
    if (bulkQueue.length > 0) {
      setPendingNewCats(newCats)
      setCsvPreview(bulkQueue[0])
      setBulkQueue(bulkQueue.slice(1))
    } else {
      setCsvPreview(null)
    }
  }

  const handlePreviewCancel = () => {
    if (bulkQueue.length > 0) {
      setCsvPreview(bulkQueue[0])
      setBulkQueue(bulkQueue.slice(1))
    } else {
      setCsvPreview(null)
      setBulkQueue([])
      setPendingNewCats([])
    }
  }

  return {
    csvPreview,
    toastMsg,
    quickUploadRef,
    bulkUploadRef,
    handleQuickUpload,
    handleBulkUpload,
    handlePreviewConfirm,
    handlePreviewCancel,
  }
}
