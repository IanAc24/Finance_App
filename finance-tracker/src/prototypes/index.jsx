import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import './prototypes.css'
import { copy } from './copy'
import DiarioHistory from './DiarioHistory'
import DiarioHome from './DiarioHome'
import ResumenHistory from './ResumenHistory'
import ResumenHome from './ResumenHome'
import { useVariant, variants } from './variants'

// True when the key press happens while typing somewhere
function isTyping(target) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  )
}

// The bar at the bottom: one button per direction (also ArrowLeft/ArrowRight)
// and a link to the other prototype page, which keeps the direction
function Switcher({ page }) {
  const [variant, setVariant] = useVariant()

  useEffect(() => {
    const onKey = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isTyping(event.target)) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const index = variants.findIndex((v) => v.id === variant)
      const step = event.key === 'ArrowRight' ? 1 : -1
      const next = variants[(index + step + variants.length) % variants.length]
      setVariant(next.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const other =
    page === 'home'
      ? { to: `/prototypes/history?v=${variant}`, label: copy.goHistory }
      : { to: `/prototypes/home?v=${variant}`, label: copy.goHome }

  return (
    <div className="proto-switcher" role="group" aria-label={copy.switcherLabel}>
      {variants.map((v) => (
        <button
          key={v.id}
          type="button"
          className={v.id === variant ? 'proto-switch is-on' : 'proto-switch'}
          aria-pressed={v.id === variant}
          onClick={() => setVariant(v.id)}
        >
          {v.name}
        </button>
      ))}
      <Link className="proto-switch-link" to={other.to}>
        {other.label}
      </Link>
    </div>
  )
}

function Frame({ page, children }) {
  return (
    <div className="proto">
      {children}
      <Switcher page={page} />
    </div>
  )
}

export function HomePage() {
  const [variant] = useVariant()
  return (
    <Frame page="home">{variant === 'diario' ? <DiarioHome /> : <ResumenHome />}</Frame>
  )
}

export function HistoryPage() {
  const [variant] = useVariant()
  return (
    <Frame page="history">
      {variant === 'diario' ? <DiarioHistory /> : <ResumenHistory />}
    </Frame>
  )
}
