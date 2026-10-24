import { useLayoutEffect, useRef } from 'react'
import { DURATION, EASE_OUT, usePrefersReducedMotion } from '../lib/motion'

// A list item that animates when useListTransitions marks it:
//   state 'enter'  fades in and rises 8px (CSS, 200ms)
//   state 'edit'   a soft tint that fades out over 600ms (CSS)
//   state 'leave'  fades, then collapses its height (Web Animations, 280ms), so
//                  the rows below close the gap without a jump. It is a ghost
//                  of the deleted row: not clickable, hidden from screen readers
//   state null     nothing (also on first render and on reload)
// With reduced motion movement is removed: enter and leave are short fades.
export default function TransitionRow({ state = null, className = '', children, ...rest }) {
  const node = useRef(null)
  const reduced = usePrefersReducedMotion()

  useLayoutEffect(() => {
    const element = node.current
    if (state !== 'leave' || !element || typeof element.animate !== 'function') return undefined
    const height = element.offsetHeight
    const animation = reduced
      ? element.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: DURATION.fast,
          easing: EASE_OUT,
          fill: 'forwards',
        })
      : element.animate(
          [
            { opacity: 1, height: `${height}px` },
            { opacity: 0, height: `${height}px`, offset: 0.5 },
            { opacity: 0, height: '0px' },
          ],
          { duration: DURATION.slow, easing: EASE_OUT, fill: 'forwards' },
        )
    return () => animation.cancel()
  }, [state, reduced])

  const classes = ['trow', state && `is-${state}`, className].filter(Boolean).join(' ')
  return (
    <li
      ref={node}
      className={classes}
      aria-hidden={state === 'leave' ? true : undefined}
      inert={state === 'leave'}
      {...rest}
    >
      {children}
    </li>
  )
}
