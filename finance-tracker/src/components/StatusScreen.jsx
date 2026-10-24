import Header from '../Header'
import Logo from './Logo'

// A whole screen for loading, blocked and error: bar, logo, a line of text
// and an optional button. `busy` marks the text as a loading message. It looks
// like the welcoming empty states of the app: a soft card, one calm line and
// one button.
export default function StatusScreen({ text, actionLabel, onAction, busy = false }) {
  return (
    <>
      <Header />
      <main>
        <section className="card welcome is-card status-screen">
          <Logo className={busy ? 'empty-logo loading-logo' : 'empty-logo'} />
          <p className="welcome-text" role={busy ? 'status' : 'alert'}>
            {text}
          </p>
          {actionLabel && (
            <div className="welcome-actions">
              <button type="button" className="btn" onClick={onAction}>
                {actionLabel}
              </button>
            </div>
          )}
        </section>
      </main>
    </>
  )
}
