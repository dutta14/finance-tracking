import { FC, useEffect, useMemo, useRef, useState } from 'react'

interface GuideSearchProps {
  matchCount: number
  totalCount: number
  onQueryChange: (value: string) => void
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  return !!target.closest('input, textarea, select, [contenteditable="true"]')
}

const GuideSearch: FC<GuideSearchProps> = ({ matchCount, totalCount, onQueryChange }) => {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onQueryChange(value.trim())
    }, 150)

    return () => window.clearTimeout(timeoutId)
  }, [value, onQueryChange])

  useEffect(() => {
    const focusSearch = () => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()

      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault()
        focusSearch()
        return
      }

      if (
        key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault()
        focusSearch()
        return
      }

      if (event.key === 'Escape' && document.activeElement === inputRef.current) {
        event.preventDefault()
        setValue('')
        onQueryChange('')
        inputRef.current?.blur()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onQueryChange])

  const statusMessage = useMemo(() => {
    if (!value.trim()) return `${totalCount} sections in the guide.`
    if (matchCount === 1) return `1 section matches “${value.trim()}”.`
    return `${matchCount} sections match “${value.trim()}”.`
  }, [matchCount, totalCount, value])

  return (
    <div className="guide-search">
      <label className="guide-search-label" htmlFor="guide-search-input">
        Search this guide
      </label>
      <input
        ref={inputRef}
        id="guide-search-input"
        className="guide-search-input"
        type="search"
        value={value}
        onChange={event => setValue(event.target.value)}
        placeholder="Search the guide… (⌘K)"
        aria-describedby="guide-search-status"
      />
      <p className="guide-search-hint">Use ⌘K, Ctrl+K, or / to jump here. Press Esc to clear.</p>
      <div id="guide-search-status" className="guide-search-status" aria-live="polite">
        {statusMessage}
      </div>
    </div>
  )
}

export default GuideSearch
