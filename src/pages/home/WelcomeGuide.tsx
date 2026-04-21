import { FC } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataIcon, GoalsIcon, AllocationIcon, BudgetIcon, ToolsIcon, DriveIcon } from './welcomeIcons'

interface Step {
  title: string
  desc: string
  route: string
  cta: string
  icon: FC
}

const steps: Step[] = [
  {
    title: 'Net Worth',
    desc: 'Add your accounts and record monthly balances. This is the foundation everything else builds on.',
    route: '/net-worth',
    cta: 'Add accounts',
    icon: DataIcon,
  },
  {
    title: 'Goals',
    desc: 'Set financial independence and general wealth targets with timelines. Track progress toward each.',
    route: '/goal',
    cta: 'Create a goal',
    icon: GoalsIcon,
  },
  {
    title: 'Allocation',
    desc: 'See how your assets are distributed across categories and compare against your ideal ratios.',
    route: '/net-worth/allocation',
    cta: 'View allocation',
    icon: AllocationIcon,
  },
  {
    title: 'Budget',
    desc: 'Import monthly bank CSVs, categorize spending, and track income vs. expenses over time.',
    route: '/budget',
    cta: 'Start budgeting',
    icon: BudgetIcon,
  },
  {
    title: 'Tools',
    desc: 'Run FI simulations, safe-growth calculators, and other planning utilities against your data.',
    route: '/tools',
    cta: 'Explore tools',
    icon: ToolsIcon,
  },
  {
    title: 'Drive',
    desc: 'A file manager for your uploaded CSVs. Drag-and-drop files and browse by year.',
    route: '/drive',
    cta: 'Open Drive',
    icon: DriveIcon,
  },
]

interface Props {
  greeting: string
}

const WelcomeGuide: FC<Props> = ({ greeting }) => {
  const navigate = useNavigate()

  return (
    <div className="home-page">
      <div className="welcome-hero">
        <h1 className="welcome-title">{greeting}</h1>
        <p className="welcome-subtitle">
          Welcome to your personal finance dashboard. Here's how to get started.
        </p>
      </div>

      <div className="welcome-start-hint">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12l7-7 7 7" />
        </svg>
        <span>Start here — add your accounts and first balance snapshot</span>
      </div>

      <ol className="welcome-steps">
        {steps.map((step) => {
          const Icon = step.icon
          return (
            <li key={step.title} className="welcome-step">
              <div className="welcome-step-icon"><Icon /></div>
              <div className="welcome-step-body">
                <h2 className="welcome-step-title">{step.title}</h2>
                <p className="welcome-step-desc">{step.desc}</p>
              </div>
              <button className="welcome-step-cta" onClick={() => navigate(step.route)}>{step.cta} →</button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default WelcomeGuide
