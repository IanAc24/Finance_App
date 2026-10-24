import { Link } from 'react-router-dom'
import { Icon } from './CategoryIcon'

// The head of a screen opened from another one (Settings, History): the back
// arrow and the title on ONE row, with the title on the left like every other
// screen. The arrow has no visible word, so `backLabel` names where it goes.
export default function SubHeader({ to, backLabel, title }) {
  return (
    <div className="sub-head">
      <Link className="back-link is-icon" to={to} aria-label={backLabel}>
        <Icon name="chevronLeft" size={24} />
      </Link>
      <h1 className="screen-title">{title}</h1>
    </div>
  )
}
