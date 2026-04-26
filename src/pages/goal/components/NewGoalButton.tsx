import { FC } from 'react'

interface NewGoalButtonProps {
  onClick: () => void
  style?: React.CSSProperties
}

const NewGoalButton: FC<NewGoalButtonProps> = ({ onClick, style }) => (
  <button className="goal-action-btn" style={style} onClick={onClick}>
    + New Goal
  </button>
)

export default NewGoalButton
