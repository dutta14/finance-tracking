import { FC, useState } from 'react'
import { FinancialPlan } from '../../types'
import PlanDetailedCard from '../../components/PlanDetailedCard'
import PlanDiveDeep from './components/PlanDiveDeep'
import './components/PlanDiveDeep.css'
import '../../styles/PlanSoloPage.css'

interface PlanSoloPageProps {
  plan: FinancialPlan
  plans: FinancialPlan[]
  onBack: () => void
  onNavigate: (planId: number) => void
}

const PlanSoloPage: FC<PlanSoloPageProps> = ({ plan, plans, onBack, onNavigate }) => {
  const [diveDeepOpen, setDiveDeepOpen] = useState(false)

  const currentIndex = plans.findIndex(p => p.id === plan.id)
  const total = plans.length
  const prevPlan = currentIndex > 0 ? plans[currentIndex - 1] : null
  const nextPlan = currentIndex < total - 1 ? plans[currentIndex + 1] : null

  return (
    <section className="plan-solo">
      <div className="plan-solo-nav">
        <button className="plan-solo-back" onClick={onBack}>
          ← All Plans
        </button>
        {total > 1 && (
          <div className="plan-solo-stepper">
            <button
              className="plan-solo-step-btn"
              onClick={() => prevPlan && onNavigate(prevPlan.id)}
              disabled={!prevPlan}
              aria-label="Previous plan"
            >
              ‹
            </button>
            <span className="plan-solo-step-label">{currentIndex + 1} of {total}</span>
            <button
              className="plan-solo-step-btn"
              onClick={() => nextPlan && onNavigate(nextPlan.id)}
              disabled={!nextPlan}
              aria-label="Next plan"
            >
              ›
            </button>
          </div>
        )}
      </div>
      <div className="plan-solo-header">
        <h1>{plan.planName}</h1>
      </div>
      <div className="plan-solo-content">
        <PlanDetailedCard plan={plan} showActions={false} />
        <button
          className={`btn-dive-deep${diveDeepOpen ? ' active' : ''}`}
          onClick={() => setDiveDeepOpen(v => !v)}
        >
          {diveDeepOpen ? 'Close Deep Analysis ↑' : 'Dive Deep ↓'}
        </button>
        {diveDeepOpen && <PlanDiveDeep plan={plan} />}
      </div>
    </section>
  )
}

export default PlanSoloPage
