import { FC } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Account, BalanceEntry } from '../../pages/data/types'
import type { FinancialGoal } from '../../types'
import '../../styles/SetupProgress.css'

interface Step {
  id: string
  title: string
  desc: string
  cta: string
  route: string
  isComplete: boolean
}

interface SetupProgressProps {
  accounts: Account[]
  balances: BalanceEntry[]
  goals: FinancialGoal[]
  hasBudgetData: boolean
  onDismiss: () => void
}

export function isOnboardingComplete(
  accounts: Account[],
  balances: BalanceEntry[],
  goals: FinancialGoal[],
  hasBudgetData: boolean,
): boolean {
  return accounts.length > 0 && balances.length > 0 && goals.length > 0 && hasBudgetData
}

export function isOnboardingDismissed(): boolean {
  return localStorage.getItem('onboarding-dismissed') === '1'
}

const SetupProgress: FC<SetupProgressProps> = ({ accounts, balances, goals, hasBudgetData, onDismiss }) => {
  const navigate = useNavigate()

  const steps: Step[] = [
    {
      id: 'accounts',
      title: 'Add your accounts',
      desc: 'List your bank, brokerage, and retirement accounts.',
      cta: 'Add accounts',
      route: '/net-worth',
      isComplete: accounts.length > 0,
    },
    {
      id: 'balances',
      title: 'Record your first balance',
      desc: 'Enter this month\u2019s balances for each account.',
      cta: 'Enter balances',
      route: '/net-worth',
      isComplete: balances.length > 0,
    },
    {
      id: 'goal',
      title: 'Set a financial goal',
      desc: 'Define your FI target or a general wealth goal.',
      cta: 'Create a goal',
      route: '/goal',
      isComplete: goals.length > 0,
    },
    {
      id: 'budget',
      title: 'Import your first budget',
      desc: 'Upload a bank CSV to start tracking spending.',
      cta: 'Upload CSV',
      route: '/budget',
      isComplete: hasBudgetData,
    },
  ]

  const completedCount = steps.filter(s => s.isComplete).length
  const totalSteps = steps.length

  if (completedCount === totalSteps) return null

  let firstIncompleteFound = false

  return (
    <section className="setup-progress" aria-labelledby="setup-heading">
      <div className="setup-progress-header">
        <h2 id="setup-heading" className="setup-progress-title">Get started with your finances</h2>
        <span className="setup-progress-count">{completedCount} of {totalSteps} complete</span>
        <button className="setup-progress-dismiss" onClick={onDismiss} aria-label="Dismiss setup guide">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="M6 6 18 18" />
          </svg>
        </button>
      </div>
      <div className="setup-progress-bar" role="progressbar" aria-valuenow={completedCount} aria-valuemin={0} aria-valuemax={totalSteps} aria-label="Setup progress">
        <div className="setup-progress-fill" style={{ width: `${(completedCount / totalSteps) * 100}%` }} />
      </div>
      <div className="setup-steps">
        {steps.map((step, i) => {
          const done = step.isComplete
          const isCurrent = !done && !firstIncompleteFound
          if (isCurrent) firstIncompleteFound = true
          const displayNumber = i + 1

          if (done) {
            return (
              <div key={step.id} className="setup-step setup-step--done" aria-label={`${step.title} — complete`}>
                <svg className="setup-step-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <div className="setup-step-text">
                  <h3 className="setup-step-title">{step.title}</h3>
                  <p className="setup-step-desc">{step.desc}</p>
                </div>
              </div>
            )
          }

          if (isCurrent) {
            return (
              <button key={step.id} className="setup-step setup-step--current" onClick={() => navigate(step.route)}>
                <span className="setup-step-badge">{displayNumber}</span>
                <div className="setup-step-text">
                  <h3 className="setup-step-title">{step.title}</h3>
                  <p className="setup-step-desc">{step.desc}</p>
                </div>
                <span className="setup-step-cta">{step.cta} →</span>
              </button>
            )
          }

          return (
            <div key={step.id} className="setup-step setup-step--upcoming">
              <span className="setup-step-badge">{displayNumber}</span>
              <div className="setup-step-text">
                <h3 className="setup-step-title">{step.title}</h3>
                <p className="setup-step-desc">{step.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default SetupProgress
