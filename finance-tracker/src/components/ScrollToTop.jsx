import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

// React Router keeps the window scroll between routes; this puts a new screen
// at the top. It reacts to the pathname only (not to search params) and skips
// the first render, so a reload keeps the browser's own scroll restoration.
export default function ScrollToTop() {
  const { pathname } = useLocation()
  const previous = useRef(pathname)

  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
