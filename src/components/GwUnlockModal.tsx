import { FC } from 'react'
import '../styles/GwUnlockModal.css'

interface GwUnlockModalProps {
  onDismiss: () => void
}

const GwUnlockModal: FC<GwUnlockModalProps> = ({ onDismiss }) => {
  return (
    <div className="gw-unlock-overlay" role="dialog" aria-modal="true" aria-labelledby="gw-unlock-title">
      <div className="gw-unlock-modal">
        <div className="gw-unlock-icon" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Tree trunk */}
            <rect x="29" y="40" width="6" height="16" rx="2" fill="currentColor" opacity="0.7" />
            {/* Canopy layers */}
            <ellipse cx="32" cy="36" rx="18" ry="12" fill="currentColor" opacity="0.3" />
            <ellipse cx="32" cy="28" rx="14" ry="10" fill="currentColor" opacity="0.5" />
            <ellipse cx="32" cy="20" rx="10" ry="8" fill="currentColor" opacity="0.8" />
            {/* Roots */}
            <path d="M29 55 Q22 58 18 56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            <path d="M35 55 Q42 58 46 56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          </svg>
        </div>

        <h2 id="gw-unlock-title" className="gw-unlock-title">
          Your FI goal is set — now plant the seeds for generational wealth
        </h2>

        <p className="gw-unlock-body">
          Financial independence is the first milestone. <strong>Generational Wealth (GW)</strong> is
          what you build beyond it — a deliberate endowment for the people who come after you.
        </p>

        <ul className="gw-unlock-points">
          <li>
            <span className="gw-unlock-point-icon">◆</span>
            Define <strong>who</strong> receives it and <strong>when</strong> (by age)
          </li>
          <li>
            <span className="gw-unlock-point-icon">◆</span>
            Set a <strong>target amount</strong> in today's dollars
          </li>
          <li>
            <span className="gw-unlock-point-icon">◆</span>
            See exactly <strong>how much to set aside now</strong> at your chosen growth rate
          </li>
        </ul>

        <p className="gw-unlock-footer-note">
          Your GW goals are attached to each FI goal — you'll find them at the bottom of any goal's detail page.
        </p>

        <button className="gw-unlock-cta" onClick={onDismiss}>
          Start building generational wealth →
        </button>
      </div>
    </div>
  )
}

export default GwUnlockModal
