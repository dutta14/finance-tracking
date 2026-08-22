import { FC, ReactNode, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

export interface GuideSectionLink {
  id: string
  title: string
  keywords?: string[]
  level?: 2 | 3
}

interface GuideTOCProps {
  items: GuideSectionLink[]
  query: string
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const matchesItem = (item: GuideSectionLink, query: string): boolean => {
  if (!query) return true
  const haystack = [item.title, ...(item.keywords ?? [])].join(' ').toLowerCase()
  return haystack.includes(query.toLowerCase())
}

const highlightText = (text: string, query: string): ReactNode => {
  if (!query) return text
  const safeQuery = escapeRegExp(query)
  if (!safeQuery) return text
  const pattern = new RegExp(`(${safeQuery})`, 'ig')
  const parts = text.split(pattern)

  return parts.map((part, index) => {
    const isMatch = part.toLowerCase() === query.toLowerCase()
    return isMatch ? <mark key={`${part}-${index}`}>{part}</mark> : <span key={`${part}-${index}`}>{part}</span>
  })
}

const GuideTOC: FC<GuideTOCProps> = ({ items, query }) => {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '')
  const filteredItems = useMemo(() => items.filter(item => matchesItem(item, query.trim())), [items, query])

  useEffect(() => {
    const updateActiveId = () => {
      const sections = items
        .map(item => {
          const element = document.getElementById(item.id)
          if (!element) return null
          const rect = element.getBoundingClientRect()
          return { id: item.id, top: rect.top, bottom: rect.bottom }
        })
        .filter((section): section is { id: string; top: number; bottom: number } => section !== null)

      if (sections.length === 0) return
      const visible = sections.filter(section => section.top <= window.innerHeight * 0.35 && section.bottom >= 120)
      if (visible.length > 0) {
        visible.sort((a, b) => Math.abs(a.top - 120) - Math.abs(b.top - 120))
        setActiveId(visible[0].id)
        return
      }

      if (window.scrollY < 40) {
        setActiveId(items[0]?.id ?? '')
      }
    }

    updateActiveId()

    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(updateActiveId, {
      rootMargin: '-20% 0px -55% 0px',
      threshold: [0, 0.25, 0.5, 0.75, 1],
    })

    items.forEach(item => {
      const element = document.getElementById(item.id)
      if (element) observer.observe(element)
    })

    window.addEventListener('scroll', updateActiveId, { passive: true })
    window.addEventListener('resize', updateActiveId)

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', updateActiveId)
      window.removeEventListener('resize', updateActiveId)
    }
  }, [items])

  const renderList = () => {
    if (filteredItems.length === 0) {
      return <p className="guide-toc-empty">No matching sections.</p>
    }

    return (
      <ol className="guide-toc-list">
        {filteredItems.map(item => {
          const isActive = item.id === activeId
          return (
            <li key={item.id} className={`guide-toc-item guide-toc-item--level-${item.level ?? 2}`}>
              <Link
                className={`guide-toc-link${isActive ? ' is-active' : ''}`}
                to={{ pathname: '/guide', hash: `#${item.id}` }}
                aria-current={isActive ? 'location' : undefined}
              >
                {highlightText(item.title, query.trim())}
              </Link>
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <aside className="guide-toc-shell">
      <details className="guide-toc-mobile">
        <summary className="guide-toc-summary">On this page</summary>
        <nav className="guide-toc" aria-label="On this page">
          {renderList()}
        </nav>
      </details>
      <nav className="guide-toc guide-toc-desktop" aria-label="On this page">
        <h2 className="guide-toc-title">On this page</h2>
        {renderList()}
      </nav>
    </aside>
  )
}

export default GuideTOC
