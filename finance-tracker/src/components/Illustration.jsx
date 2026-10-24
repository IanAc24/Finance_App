// Small original illustrations for empty states, welcome steps and toasts.
// Drawn for this project in the logo's style: flat shapes, rounded corners,
// round line caps. Colours come only from CSS classes (see "Ilustraciones" in
// index.css), so both themes work:
//   il-line  = outline in the muted colour     il-dot    = small filled dot
//   il-fill  = soft fill                       il-accent = outline in the accent
//   il-solid = filled with the accent
// Scenes use a 0 0 120 120 box; 'check' uses 0 0 24 24 (it is used small).

// A torn-edge receipt, shared by 'search' and 'bills'
const RECEIPT =
  'M34 16 H70 a6 6 0 0 1 6 6 V100 l-8 -6 l-8 6 l-8 -6 l-8 6 l-8 -6 l-8 6 V22 a6 6 0 0 1 6 -6 Z'

// Calendar page with its two rings, used by 'calendar' and 'payday'
function CalendarPage() {
  return (
    <>
      <rect className="il-line il-fill" x="22" y="28" width="76" height="76" rx="12" />
      <path className="il-line" d="M22 54 H98" />
      <path className="il-line" d="M42 20 V36 M78 20 V36" />
    </>
  )
}

const scenes = {
  wallet: (
    <>
      <circle className="il-accent" cx="78" cy="30" r="14" />
      <path className="il-accent" d="M72 36 L84 24 M77 24 H84 V31" />
      <rect className="il-line il-fill" x="20" y="40" width="80" height="58" rx="12" />
      <rect className="il-line" x="70" y="58" width="30" height="22" rx="8" />
      <circle className="il-solid" cx="84" cy="69" r="3.5" />
    </>
  ),
  calendar: (
    <>
      <CalendarPage />
      <circle className="il-dot" cx="40" cy="70" r="2.5" />
      <circle className="il-dot" cx="54" cy="70" r="2.5" />
      <circle className="il-dot" cx="68" cy="70" r="2.5" />
      <circle className="il-dot" cx="40" cy="86" r="2.5" />
      <circle className="il-dot" cx="54" cy="86" r="2.5" />
      <circle className="il-accent il-fill" cx="78" cy="84" r="12" />
      <path className="il-accent" d="M73 89 L83 79 M77 79 H83 V85" />
    </>
  ),
  search: (
    <>
      <path className="il-line" d={RECEIPT} />
      <path className="il-line" d="M42 36 H68 M42 50 H58 M42 64 H52" />
      <circle className="il-accent il-fill" cx="78" cy="68" r="20" />
      <path className="il-accent il-thick" d="M93 83 L106 96" />
    </>
  ),
  chart: (
    <>
      <path className="il-line" d="M14 108 H106" />
      <rect className="il-line il-fill" x="24" y="74" width="18" height="34" rx="9" />
      <rect className="il-line il-fill" x="51" y="58" width="18" height="50" rx="9" />
      <rect className="il-solid" x="78" y="44" width="18" height="64" rx="9" />
      <path className="il-accent il-dotted" d="M16 44 C42 44 62 34 100 18" />
    </>
  ),
  payday: (
    <>
      <CalendarPage />
      <circle className="il-dot" cx="40" cy="72" r="2.5" />
      <circle className="il-dot" cx="80" cy="72" r="2.5" />
      <circle className="il-dot" cx="40" cy="90" r="2.5" />
      <circle className="il-dot" cx="60" cy="90" r="2.5" />
      <circle className="il-solid" cx="60" cy="72" r="7" />
      <circle className="il-solid" cx="80" cy="90" r="7" />
    </>
  ),
  income: (
    <>
      <rect className="il-line il-fill" x="20" y="88" width="58" height="16" rx="8" />
      <rect className="il-line il-fill" x="32" y="70" width="58" height="16" rx="8" />
      <rect className="il-accent il-fill" x="20" y="52" width="58" height="16" rx="8" />
      <path className="il-accent il-thick" d="M82 50 L104 28" />
      <path className="il-accent il-thick" d="M92 28 H104 V40" />
    </>
  ),
  bills: (
    <>
      <path className="il-line il-fill" d={RECEIPT} />
      <path className="il-accent il-thick" d="M44 48 L54 58 L70 40" />
      <path className="il-line" d="M42 74 H68 M42 86 H58" />
    </>
  ),
  piggy: (
    <>
      <circle className="il-accent" cx="56" cy="22" r="12" />
      <path className="il-accent" d="M56 17 V27" />
      <rect className="il-line il-fill" x="36" y="88" width="12" height="16" rx="6" />
      <rect className="il-line il-fill" x="68" y="88" width="12" height="16" rx="6" />
      <ellipse className="il-line il-fill" cx="56" cy="72" rx="36" ry="26" />
      <rect className="il-line il-fill" x="88" y="62" width="16" height="16" rx="7" />
      <path className="il-line il-fill" d="M66 49 L72 36 L82 54" />
      <path className="il-line" d="M20 66 C10 66 10 54 18 52" />
      <path className="il-accent" d="M44 52 H62" />
    </>
  ),
  hello: (
    <>
      <rect className="il-line il-fill" x="24" y="72" width="20" height="30" rx="10" />
      <rect className="il-line il-fill" x="52" y="58" width="20" height="44" rx="10" />
      <rect className="il-solid" x="80" y="46" width="20" height="56" rx="10" />
      <circle className="il-accent" cx="88" cy="22" r="14" />
      <path className="il-accent" d="M82 28 L94 16 M87 16 H94 V23" />
      <path
        className="il-solid"
        d="M30 12 L33 21 L42 24 L33 27 L30 36 L27 27 L18 24 L27 21 Z"
      />
    </>
  ),
}

// name: one of the scenes above or 'check'; size: pixels (width and height)
export default function Illustration({ name, size = 112, className = '' }) {
  const isCheck = name === 'check'
  return (
    <svg
      className={className ? `illustration ${className}` : 'illustration'}
      viewBox={isCheck ? '0 0 24 24' : '0 0 120 120'}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      {isCheck ? (
        <>
          <circle className="il-accent il-fill il-check" cx="12" cy="12" r="10" />
          <path className="il-accent il-check" d="M7.5 12.5 L10.5 15.5 L16.5 9" />
        </>
      ) : (
        scenes[name]
      )}
    </svg>
  )
}
