import { FC, useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { createPortal } from 'react-dom'
import { buildIndex, search, findMatchRange, getCategoryLabel } from '../search/searchIndex'
import type { SearchItem, SearchCategory } from '../search/searchIndex'
import { useFocusTrap } from '../hooks/useFocusTrap'
import '../styles/SearchModal.css'

export interface SearchModalProps {
  open: boolean
  onClose: () => void
  onNavigate: (path: string) => void
  onAction: (actionId: string) => void
}

const SearchModal: FC<SearchModalProps> = ({ open, onClose, onNavigate, onAction }) => {
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [expandedGroups, setExpandedGroups] = useState<Set<SearchCategory>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, open)

  // Build index on each open
  const index = useMemo(() => (open ? buildIndex() : []), [open])

  // Compute groups — run full search once, then truncate non-expanded groups
  const groups = useMemo(() => {
    const full = search(index, query, Infinity)
    return full.map(g => expandedGroups.has(g.category)
      ? g
      : { ...g, items: g.items.slice(0, 5) }
    )
  }, [index, query, expandedGroups])

  // Flat list of visible items for keyboard navigation
  const flatItems = useMemo(() => groups.flatMap(g => g.items), [groups])

  // Pre-compute item id → flat index
  const itemIdxMap = useMemo(() => {
    const map = new Map<string, number>()
    flatItems.forEach((item, i) => map.set(item.id, i))
    return map
  }, [flatItems])

  // Reset on open/close and query change
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      setExpandedGroups(new Set())
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  // Scroll active item into view
  useEffect(() => {
    const el = resultsRef.current?.querySelector('.search-result--active')
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  const handleSelect = useCallback((item: SearchItem) => {
    onClose()
    if (item.actionId) {
      onAction(item.actionId)
    } else if (item.route) {
      onNavigate(item.route)
    }
  }, [onClose, onAction, onNavigate])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, flatItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = flatItems[activeIdx]
      if (item) handleSelect(item)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [flatItems, activeIdx, handleSelect, onClose])

  const handleShowAll = useCallback((category: SearchCategory) => {
    setExpandedGroups(s => new Set(s).add(category))
    setActiveIdx(0)
  }, [])

  if (!open) return null

  const activeItem = flatItems[activeIdx]

  return createPortal(
    <div className="search-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={modalRef} className="search-modal" role="dialog" aria-label="Search" aria-modal="true" onKeyDown={handleKeyDown}>
        {/* Input row */}
        <div className="search-modal-input-row">
          <svg className="search-modal-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            className="search-modal-input"
            placeholder="Search pages, goals, accounts…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={flatItems.length > 0}
            aria-controls="search-results-list"
            aria-activedescendant={activeItem ? `search-item-${activeItem.id}` : undefined}
          />
          <kbd className="search-modal-kbd">esc</kbd>
        </div>

        {/* Results */}
        <div className="search-modal-results" ref={resultsRef} id="search-results-list" role="listbox" aria-label="Search results">
          {groups.length === 0 && query.trim() ? (
            <div className="search-no-results">
              <span className="search-no-results-icon">🔍</span>
              <span className="search-no-results-title">No results for &ldquo;{query}&rdquo;</span>
              <span className="search-no-results-hint">Try a different keyword or check spelling</span>
            </div>
          ) : groups.length === 0 ? (
            <div className="search-empty">
              <span className="search-empty-icon">⌘</span>
              <span className="search-empty-title">Quick actions</span>
              <span className="search-empty-hint">Start typing, or choose a command</span>
            </div>
          ) : (
            groups.map(group => (
              <div className="search-group" key={group.category}>
                <div className="search-group-header">
                  <span className="search-group-label">{group.label}</span>
                </div>
                {group.items.map(item => (
                  <ResultRow
                    key={item.id}
                    item={item}
                    query={query}
                    active={(itemIdxMap.get(item.id) ?? -1) === activeIdx}
                    onSelect={handleSelect}
                    onHover={() => setActiveIdx(itemIdxMap.get(item.id) ?? 0)}
                  />
                ))}
                {group.total > group.items.length && (
                  <button className="search-group-show-all" onClick={() => handleShowAll(group.category)}>
                    Show all {group.total} results →
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="search-modal-footer">
          <span className="search-modal-footer-hint">
            <kbd className="search-modal-kbd">↑↓</kbd> navigate
          </span>
          <span className="search-modal-footer-hint">
            <kbd className="search-modal-kbd">↵</kbd> open
          </span>
          <span className="search-modal-footer-hint">
            <kbd className="search-modal-kbd">esc</kbd> close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ─── SVG Icon Map ─── */

const ICON_PATHS: Record<string, string> = {
  home: 'M3 12l9-8 9 8M5 11v8a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-8',
  target: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z',
  chart: 'M3 20h18M7 16V10M12 16V4M17 16V8',
  dollar: 'M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  scale: 'M12 3v18M3 7l4 9h10l4-9M7 16h10',
  clipboard: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5h6M9 12h6M9 16h3',
  wrench: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
  folder: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
  moon: 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09c-.658.003-1.25.396-1.51 1z',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  plus: 'M12 5v14M5 12h14',
  play: 'M5 3l14 9-14 9V3z',
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  calculator: 'M4 4a2 2 0 012-2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zM8 10h0M12 10h0M16 10h0M8 14h0M12 14h0M16 14h0M8 18h0M12 18h4M8 6h8',
  trending: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  file: 'M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7zM13 2v7h7',
  cloud: 'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z',
  palette: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2zM6.5 12a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM9.5 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM14.5 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM17.5 12a1.5 1.5 0 110-3 1.5 1.5 0 010 3z',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  flask: 'M9 3h6M10 3v6.5L4 20h16l-6-10.5V3',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
  bank: 'M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3',
  tag: 'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h0',
  'file-text': 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  'pie-chart': 'M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z',
}

const SearchIcon: FC<{ name: string }> = ({ name }) => {
  const d = ICON_PATHS[name]
  if (!d) return null
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

/* ─── Result Row ─── */

interface ResultRowProps {
  item: SearchItem
  query: string
  active: boolean
  onSelect: (item: SearchItem) => void
  onHover: () => void
}

const ResultRow: FC<ResultRowProps> = memo(({ item, query, active, onSelect, onHover }) => {
  const range = findMatchRange(item.label, query)

  return (
    <button
      id={`search-item-${item.id}`}
      className={`search-result${active ? ' search-result--active' : ''}`}
      onClick={() => onSelect(item)}
      onMouseEnter={onHover}
      role="option"
      aria-selected={active}
    >
      <span className="search-result-icon"><SearchIcon name={item.icon} /></span>
      <div className="search-result-text">
        <span className="search-result-label">
          {range ? (
            <>
              {item.label.slice(0, range[0])}
              <mark className="search-result-match">{item.label.slice(range[0], range[1])}</mark>
              {item.label.slice(range[1])}
            </>
          ) : item.label}
        </span>
        <span className="search-result-hint">{item.hint}</span>
      </div>
      <span className="search-result-badge">{getCategoryLabel(item.category)}</span>
    </button>
  )
})

export default SearchModal
