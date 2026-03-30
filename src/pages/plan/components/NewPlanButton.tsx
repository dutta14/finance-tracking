import { FC } from 'react'

interface NewPlanButtonProps {
  onClick: () => void
  style?: React.CSSProperties
}

const NewPlanButton: FC<NewPlanButtonProps> = ({ onClick, style }) => (
  <button
    className="btn-create btn-small"
    style={{ width: '100px', fontSize: '0.92rem', padding: '0.35rem 0', borderRadius: 4, fontWeight: 500, boxShadow: 'none', cursor: 'pointer', textAlign: 'center', ...style }}
    onClick={onClick}
  >
    + New Plan
  </button>
)

export default NewPlanButton
