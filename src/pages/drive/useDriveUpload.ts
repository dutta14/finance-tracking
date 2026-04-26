import { useState, useCallback, useRef } from 'react'
import { useBudget } from '../budget/hooks/useBudget'
import { monthKeyFromFilename } from '../budget/hooks/useCSVUpload'

interface CsvPreview {
  monthKey: string
  csv: string
}

export function useDriveUpload(refreshTree: () => void) {
  const { uploadCSV } = useBudget()
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null)
  const [bulkQueue, setBulkQueue] = useState<CsvPreview[]>([])
  const [pendingNewCats, setPendingNewCats] = useState<string[]>([])
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 5000)
  }, [])

  const dismissToast = useCallback(() => setToastMsg(null), [])

  const processFiles = useCallback(
    async (files: File[]) => {
      const pending: CsvPreview[] = []
      const skipped: string[] = []

      for (const file of files) {
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
        showToast(`Skipped ${skipped.length} file(s): couldn't determine month from filename`)
      }

      if (pending.length > 0) {
        setCsvPreview(pending[0])
        setBulkQueue(pending.slice(1))
      }
    },
    [showToast],
  )

  const handlePreviewConfirm = useCallback(
    (filteredCsv: string) => {
      if (!csvPreview) return
      const result = uploadCSV(csvPreview.monthKey, filteredCsv)
      const newCats = [...pendingNewCats, ...(result.newCategories || [])]

      if (!result.ok) {
        showToast(`Upload failed: ${result.error}`)
      } else if (bulkQueue.length === 0) {
        const uniqueNew = [...new Set(newCats)]
        if (uniqueNew.length > 0) {
          showToast(`Uploaded! New categories: ${uniqueNew.join(', ')}`)
        } else {
          showToast('Uploaded successfully')
        }
        setPendingNewCats([])
      } else {
        setPendingNewCats(newCats)
      }

      if (bulkQueue.length > 0) {
        setCsvPreview(bulkQueue[0])
        setBulkQueue(bulkQueue.slice(1))
      } else {
        setCsvPreview(null)
        refreshTree()
      }
    },
    [csvPreview, bulkQueue, pendingNewCats, uploadCSV, showToast, refreshTree],
  )

  const handlePreviewCancel = useCallback(() => {
    if (bulkQueue.length > 0) {
      setCsvPreview(bulkQueue[0])
      setBulkQueue(bulkQueue.slice(1))
    } else {
      setCsvPreview(null)
      if (pendingNewCats.length > 0) {
        const uniqueNew = [...new Set(pendingNewCats)]
        showToast(`New categories: ${uniqueNew.join(', ')}`)
        setPendingNewCats([])
      }
      refreshTree()
    }
  }, [bulkQueue, pendingNewCats, showToast, refreshTree])

  /* ── drag & drop ───────────────────────────────────────────── */
  const [dragOver, setDragOver] = useState(false)
  const dragCounter = useRef(0)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setDragOver(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      dragCounter.current = 0
      const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'))
      if (files.length === 0) {
        showToast('No CSV files found. Drop .csv files to upload.')
        return
      }
      await processFiles(files)
    },
    [processFiles, showToast],
  )

  /* ── file input for click-to-browse ────────────────────────── */
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return
      await processFiles(Array.from(files))
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [processFiles],
  )

  const openFilePicker = useCallback(() => fileInputRef.current?.click(), [])

  return {
    csvPreview,
    toastMsg,
    dismissToast,
    dragOver,
    fileInputRef,
    processFiles,
    handlePreviewConfirm,
    handlePreviewCancel,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileInputChange,
    openFilePicker,
  }
}
