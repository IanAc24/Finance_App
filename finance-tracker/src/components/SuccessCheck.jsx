// The confirmation mark: a check that draws itself inside a circle (300ms).
// Use it only AFTER a write was confirmed (the toast does it for kind
// "success"). The animation runs when the element appears, so give it a new
// key per event. Decorative; the message next to it says what happened.
export default function SuccessCheck({ size = 20, className = '' }) {
  return (
    <svg
      className={className ? `success-check ${className}` : 'success-check'}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <circle className="success-check-ring" cx="12" cy="12" r="10" pathLength="1" />
      <path className="success-check-tick" d="M7.5 12.5 L10.5 15.5 L16.5 9" pathLength="1" />
    </svg>
  )
}
