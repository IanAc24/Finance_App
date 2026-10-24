import Header from '../../Header'

// Frame of the sign-in screens: the bar with the logo (no tabs: nothing
// else works yet) and one card with the title and the form
export default function AuthLayout({ title, children }) {
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="auth-main">
        <section className="card auth-card">
          <h2 className="auth-title">{title}</h2>
          {children}
        </section>
      </main>
    </>
  )
}
