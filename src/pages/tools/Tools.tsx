import { FC, useState, ReactNode } from 'react'
import FICalculator from './components/FICalculator'
import SavingsGrowthTracker from './components/SavingsGrowthTracker'
import '../../styles/Tools.css'

export interface ToolDef {
  id: string
  title: string
  description: string
  icon: ReactNode
  summary?: ReactNode
  pane: ReactNode
}

/* Theme-tinted SVG icons */
const IconFI = () => (
  <svg className="tools-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
  </svg>
)

const IconChart = () => (
  <svg className="tools-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
  </svg>
)

const TOOLS: ToolDef[] = [
  {
    id: 'fi-calculator',
    title: 'FI Calculator',
    description: 'Estimate your FI readiness based on expenses, growth, inflation & holdings.',
    icon: <span className="tools-icon"><IconFI /></span>,
    pane: <FICalculator />,
  },
  {
    id: 'savings-growth',
    title: 'Savings/Growth Tracker',
    description: 'Break down net worth growth into savings vs. capital gains each year.',
    icon: <span className="tools-icon"><IconChart /></span>,
    pane: <SavingsGrowthTracker />,
  },
]

type ViewMode = 'list' | 'grid'

const Tools: FC = () => {
  const [openTool, setOpenTool] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('list')
  const tools = TOOLS

  const activeTool = tools.find(t => t.id === openTool)

  return (
    <div className={`tools-page${openTool ? ' tools-page--pane-open' : ''}`}>
      {/* Main grid area */}
      <div className="tools-main">
        <div className="tools-top-row">
          <div>
            <h1 className="tools-heading">Tools</h1>
            <p className="tools-subtitle">Financial calculators and trackers</p>
          </div>
          <div className="tools-view-toggle">
            <button
              className={`tools-view-btn${view === 'list' ? ' tools-view-btn--active' : ''}`}
              onClick={() => setView('list')}
              aria-label="List view"
              title="List view"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M3 4h14v2H3V4zm0 5h14v2H3V9zm0 5h14v2H3v-2z" /></svg>
            </button>
            <button
              className={`tools-view-btn${view === 'grid' ? ' tools-view-btn--active' : ''}`}
              onClick={() => setView('grid')}
              aria-label="Grid view"
              title="Grid view"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zM3 11h6v6H3v-6zm8 0h6v6h-6v-6z" /></svg>
            </button>
          </div>
        </div>
        <div className={`tools-grid ${view === 'grid' ? 'tools-grid--grid' : 'tools-grid--list'}`}>
          {tools.map(tool => (
            <div
              key={tool.id}
              className={`tools-card${openTool === tool.id ? ' tools-card--active' : ''}${view === 'grid' ? ' tools-card--grid' : ''}`}
              onClick={() => setOpenTool(openTool === tool.id ? null : tool.id)}
            >
              {tool.icon}
              <div className="tools-card-body">
                <h2 className="tools-card-title">{tool.title}</h2>
                <p className="tools-card-desc">{tool.description}</p>
              </div>
              {view === 'list' && <span className="tools-card-arrow">›</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Side pane */}
      {activeTool && (
        <div className="tools-pane">
          <div className="tools-pane-header">
            <h2 className="tools-pane-title">{activeTool.title}</h2>
            <button className="tools-pane-close" onClick={() => setOpenTool(null)} aria-label="Close pane">✕</button>
          </div>
          <div className="tools-pane-body">
            {activeTool.pane}
          </div>
        </div>
      )}
    </div>
  )
}

export default Tools
