import { Link } from 'react-router-dom'
import { useSettings } from '../context/useSettings'
import { Icon } from './CategoryIcon'

// A welcoming empty state: a soft round icon, a reassuring line and one clear
// action. Without `text` it is the first-use message (title, text and the
// button to add the first movement). With `text` it is just that line, with a
// `title` if one is given. `actions` false leaves the buttons out; `children`
// are buttons of the caller's own, in their place. `card`
// draws it as a card (for a place inside a screen); otherwise it is centred
// on the page. `icon` is a name from CategoryIcon's set.
export default function EmptyState({
  actions = true,
  text,
  title,
  icon = 'wallet',
  card = false,
  children,
}) {
  const { t } = useSettings()
  const heading = title ?? (text === undefined ? t('emptyTitle') : undefined)

  return (
    <section className={card ? 'welcome is-card card' : 'welcome'}>
      <span className="welcome-icon" aria-hidden="true">
        <Icon name={icon} size={32} />
      </span>
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
