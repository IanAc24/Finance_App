import { Link } from 'react-router-dom'
import { useSettings } from '../context/useSettings'
import Illustration from './Illustration'

// A welcoming empty state: a small illustration, a reassuring line and one clear
// action. Without `text` it is the first-use message (title, text and the
// button to add the first movement). With `text` it is just that line, with a
// `title` if one is given. `actions` false leaves the buttons out; `children`
// are buttons of the caller's own, in their place. `card`
// draws it as a card (for a place inside a screen); otherwise it is centred
// on the page. `illustration` is a name from Illustration's set.
export default function EmptyState({
  actions = true,
  text,
  title,
  illustration = 'wallet',
  card = false,
  children,
}) {
  const { t } = useSettings()
  const heading = title ?? (text === undefined ? t('emptyTitle') : undefined)

  return (
    <section className={card ? 'welcome is-card card' : 'welcome'}>
      <Illustration name={illustration} size={112} className="welcome-art" />
      {heading && <h2 className="welcome-title">{heading}</h2>}
      <p className="welcome-text">{text ?? t('emptyText')}</p>
      {!actions && children && <div className="welcome-actions">{children}</div>}
      {actions && (
        <div className="welcome-actions">
          <Link className="btn" to="/add?type=expense">
            {t('addFirst')}
          </Link>
          <Link className="btn secondary" to="/add?type=income">
            {t('addIncome')}
          </Link>
        </div>
      )}
    </section>
  )
}
