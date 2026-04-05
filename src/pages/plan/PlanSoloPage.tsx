import { FC, useState } from 'react'
import { FinancialPlan } from '../../types'
import PlanDetailedCard from '../../components/PlanDetailedCard'
import PlanDiveDeep from './components/PlanDiveDeep'
import './components/PlanDiveDeep.css'
import '../../styles/PlanSoloPage.css'

interface PlanSoloPageProps {
  plan: FinancialPlan
  onBack: () => void
}

const PlanSoloPage: FC<PlanSoloPageProps> = ({ plan, onBack }) => {
  const [diveDeepOpen, setDiveDeepOpen] = useState(false)

  return (
    <section className="plan-solo">
      <div className="plan-solo-nav">
        <button className="plan-solo-back" onClick={onBack}>
          ← All Plans
        </button>
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
