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

const TOOLS: ToolDef[] = [
  {
    id: 'fi-calculator',
    title: 'FI Calculator',
    description: 'Check if you\'re ready to FI. Estimate your required savings based on expenses, growth, inflation, and current holdings.',
    icon: <span className="tools-icon">🏖️</span>,
    pane: <FICalculator />,
  },
  {
    id: 'savings-growth',
    title: 'Savings/Growth Tracker',
    description: 'Track how much of your net worth growth came from savings vs. capital gains each year.',
    icon: <span className="tools-icon">📊</span>,
    pane: <SavingsGrowthTracker />,
  },
  {
    id: 'tool-3',
    title: 'Tool 3',
    description: 'Coming soon.',
    icon: <span className="tools-icon">🧮</span>,
    pane: <p className="tools-pane-placeholder">Coming soon.</p>,
  },
  {
    id: 'tool-4',
    title: 'Tool 4',
    description: 'Coming soon.',
    icon: <span className="tools-icon">⚙️</span>,
    pane: <p className="tools-pane-placeholder">Coming soon.</p>,
  },
]

const Tools: FC = () => {
  const [openTool, setOpenTool] = useState<string | null>(null)
  const tools = TOOLS

  const activeTool = tools.find(t => t.id === openTool)

  return (
    <div className={`tools-page${openTool ? ' tools-page--pane-open' : ''}`}>
      {/* Main grid area */}
      <div className="tools-main">
        <h1 className="tools-heading">Tools</h1>
        <div className="tools-grid">
          {tools.map(tool => (
            <div key={tool.id} className={`tools-card${openTool === tool.id ? ' tools-card--active' : ''}`}>
              <div className="tools-card-header">
                {tool.icon}
                <h2 className="tools-card-title">{tool.title}</h2>
              </div>
              <p className="tools-card-desc">{tool.description}</p>
              {tool.summary && <div className="tools-card-summary">{tool.summary}</div>}
              <div className="tools-card-footer">
                <button
                  className="tools-open-btn"
                  onClick={() => setOpenTool(openTool === tool.id ? null : tool.id)}
                >
                  {openTool === tool.id ? 'Close' : `Open ${tool.title}`}
                </button>
              </div>
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
