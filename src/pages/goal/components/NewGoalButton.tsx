import { FC } from 'react'

interface NewGoalButtonProps {
  onClick: () => void
  style?: React.CSSProperties
}

const NewGoalButton: FC<NewGoalButtonProps> = ({ onClick, style }) => (
  <button
    className="btn-create btn-small"
    style={{ width: '100px', fontSize: '0.92rem', padding: '0.35rem 0', borderRadius: 4, fontWeight: 500, boxShadow: 'none', cursor: 'pointer', textAlign: 'center', ...style }}
    onClick={onClick}
  >
    + New Goal
  </button>
)

export default NewGoalButton
