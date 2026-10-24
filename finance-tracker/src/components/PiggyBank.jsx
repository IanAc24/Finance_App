import { useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { useSettings } from '../context/useSettings'
import { EASE_OUT, usePrefersReducedMotion } from '../lib/motion'
import { currencies } from '../lib/money'

// The piggy bank of the Savings screen: an original drawing in the family of
// the logo and the illustrations (rounded shapes, 3px strokes in the muted
// colour, soft fill, accent for the level and the coin slot).
//
//   <PiggyBank ref={piggy} fill={0.4} currency="CRC" empty={false} />
//   await piggy.current.playDeposit()   a coin drops into the slot (500ms),
//                                       then the piggy squashes (300ms);
//                                       resolves when the coin is in
//   piggy.current.playWithdraw()        a coin leaves the slot (350ms)
//   piggy.current.playCelebrate()       a hop and a burst of small coins (800ms)
//
// Rules: only transform and opacity move. Each play* starts from an EVENT (a
// saved move), never from a render, and runs once. With reduced motion the
// play* calls do nothing and resolve at once: the caller just updates the
// numbers. The level (`fill`, 0..1) rises with a CSS transition (600ms).
//
// The drawing's box is 240x200: the top 30 are headroom for the coin and the
// dashed hint; the slot is at SLOT (also in the CSS as a percentage).
const BOX = { width: 240, height: 200 }
const SLOT = { x: 100, y: 62 }

const COIN_MS = 500
const OUT_MS = 350
const BURST_MS = 800
const SQUASH_MS = 300
const HOP_MS = 400
const PARTICLES = 10

// A transform that centres the coin on the slot and then moves it by x / y
// (percent of its own size), so the path scales with the piggy
const at = (x, y, rotate = 0, scaleX = 1, scaleY = scaleX) =>
  `translate(-50%, -50%) translate(${x}%, ${y}%) rotate(${rotate}deg) scale(${scaleX}, ${scaleY})`

// A coin drops from above-left, over a small arc, into the slot
const DEPOSIT_COIN = [
  { transform: at(-150, -200, -40, 0.9), opacity: 0, offset: 0, easing: 'ease-out' },
  { transform: at(-105, -262, 10), opacity: 1, offset: 0.2, easing: 'ease-in-out' },
  { transform: at(-35, -235, 120), opacity: 1, offset: 0.55, easing: 'ease-in' },
  { transform: at(0, -80, 200), opacity: 1, offset: 0.85, easing: 'ease-in' },
  { transform: at(0, 12, 220, 0.9, 0.25), opacity: 0, offset: 1 },
]

// A coin comes out of the slot and slides away, fading. No bounce.
const WITHDRAW_COIN = [
  { transform: at(0, 0, 0, 0.6), opacity: 0, offset: 0, easing: 'ease-out' },
  { transform: at(0, -115, -15), opacity: 1, offset: 0.4, easing: 'ease-out' },
  { transform: at(135, -45, 50), opacity: 0, offset: 1 },
]

const SQUASH = [
  { transform: 'scale(1, 1)' },
  { transform: 'scale(1.02, 0.96)', offset: 0.3 },
  { transform: 'scale(0.99, 1.03)', offset: 0.65 },
  { transform: 'scale(1, 1)' },
]

const HOP = [
  { transform: 'translateY(0)', easing: 'ease-out' },
  { transform: 'translateY(-8px)', offset: 0.45, easing: 'ease-in' },
  { transform: 'translateY(0)' },
]

// Ten small shapes fly out from the belly in a ring (coins and sparkles,
// alternating); the angle and distance are fixed so every burst looks alike
function particleKeyframes(index, width) {
  const angle = ((index * 360) / PARTICLES + (index % 2 ? 14 : -10)) * (Math.PI / 180)
  const distance = width * (index % 3 === 0 ? 0.62 : index % 3 === 1 ? 0.5 : 0.42)
  const x = Math.cos(angle) * distance
  const y = Math.sin(angle) * distance
  return [
    { transform: 'translate(-50%, -50%) translate(0px, 0px) scale(0.4)', opacity: 0, offset: 0 },
    { transform: `translate(-50%, -50%) translate(${x * 0.45}px, ${y * 0.45}px) scale(1)`, opacity: 1, offset: 0.25 },
    { transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(0.8)`, opacity: 0, offset: 1 },
  ]
}

// Runs a list of animations and calls done() once ALL have finished (or were
// cancelled). Returns a function that cancels them.
function runAll(animations, done) {
  let left = animations.length
  const finish = () => {
    left -= 1
    if (left === 0) done()
  }
  animations.forEach((animation) => {
    animation.addEventListener('finish', finish, { once: true })
    animation.addEventListener('cancel', finish, { once: true })
  })
  return () => animations.forEach((animation) => animation.cancel())
}

export default function PiggyBank({ ref, fill = 0, currency = 'CRC', empty = false, label }) {
  const { t } = useSettings()
  const reduced = usePrefersReducedMotion()
  const clipId = useId()

  const bodyRef = useRef(null)
  const coinRef = useRef(null)
  const burstRef = useRef(null)
  const reducedRef = useRef(reduced)
  const sequence = useRef(0)
  // what is running now: the coin / burst job and the animations to cancel
  const coinJob = useRef(null)
  const burstJob = useRef(null)
  const bodyAnimation = useRef(null)

  const [coin, setCoin] = useState(null) // { key, kind: 'in' | 'out' }
  const [burst, setBurst] = useState(null) // { key }

  useEffect(() => {
    reducedRef.current = reduced
  }, [reduced])

  // the play* calls below are stable: they only read refs and set state
  useImperativeHandle(ref, () => {
    const canAnimate = () => !reducedRef.current && typeof bodyRef.current?.animate === 'function'

    const playBody = (keyframes, duration) => {
      bodyAnimation.current?.cancel()
      bodyAnimation.current = bodyRef.current.animate(keyframes, { duration, easing: EASE_OUT })
    }

    return {
      playDeposit({ squash = true } = {}) {
        if (!canAnimate()) return Promise.resolve()
        return new Promise((resolve) => {
          coinJob.current?.resolve()
          coinJob.current = { kind: 'in', squash, resolve, started: false }
          setCoin({ key: ++sequence.current, kind: 'in' })
        }).then(() => {
          if (squash && bodyRef.current) playBody(SQUASH, SQUASH_MS)
        })
      },
      playWithdraw() {
        if (!canAnimate()) return Promise.resolve()
        return new Promise((resolve) => {
          coinJob.current?.resolve()
          coinJob.current = { kind: 'out', resolve, started: false }
          setCoin({ key: ++sequence.current, kind: 'out' })
        })
      },
      playCelebrate() {
        if (!canAnimate()) return Promise.resolve()
        playBody(HOP, HOP_MS)
        return new Promise((resolve) => {
          burstJob.current?.resolve()
          burstJob.current = { resolve, started: false }
          setBurst({ key: ++sequence.current })
        })
      },
    }
  }, [])

  // Start the coin when it appears. `started` keeps React's double run in
  // development from starting it twice; the cleanup of the whole component
  // (below) is what cancels it.
  useLayoutEffect(() => {
    const job = coinJob.current
    const element = coinRef.current
    if (!coin || !job || job.started || !element) return
    job.started = true
    const animation = element.animate(job.kind === 'in' ? DEPOSIT_COIN : WITHDRAW_COIN, {
      duration: job.kind === 'in' ? COIN_MS : OUT_MS,
      fill: 'forwards',
    })
    job.animation = animation
    runAll([animation], () => {
      setCoin(null)
      job.resolve()
    })
  }, [coin])

  useLayoutEffect(() => {
    const job = burstJob.current
    const element = burstRef.current
    if (!burst || !job || job.started || !element) return
    job.started = true
    const width = element.offsetWidth
    const dots = [...element.querySelectorAll('.burst-dot')]
    const animations = dots.map((dot, index) =>
      dot.animate(particleKeyframes(index, width), {
        duration: BURST_MS,
        delay: (index % 3) * 30,
        easing: EASE_OUT,
        fill: 'forwards',
      }),
    )
    job.animations = animations
    runAll(animations, () => {
      setBurst(null)
      job.resolve()
    })
  }, [burst])

  // leaving the screen mid-animation: stop everything and free the callers
  useEffect(
    () => () => {
      bodyAnimation.current?.cancel()
      coinJob.current?.animation?.cancel()
      burstJob.current?.animations?.forEach((animation) => animation.cancel())
      coinJob.current?.resolve()
      burstJob.current?.resolve()
    },
    [],
  )

  const symbol = currencies.find((c) => c.code === currency)?.symbol ?? '₡'
  const level = Math.min(1, Math.max(0, fill))

  return (
    <div className="piggy" data-empty={empty ? 'true' : 'false'}>
      <div className="piggy-body" ref={bodyRef}>
        <svg
          className="piggy-art"
          viewBox={`0 0 ${BOX.width} ${BOX.height}`}
          role="img"
          aria-label={label ?? t('piggyAria')}
          focusable="false"
        >
          <defs>
            <clipPath id={clipId}>
              <ellipse cx="116" cy="120" rx="78.5" ry="56.5" />
            </clipPath>
          </defs>

          <ellipse className="pig-shadow" cx="116" cy="193" rx="80" ry="5.5" />

          {/* legs and tail behind the body */}
          <rect className="pig-line pig-soft" x="66" y="156" width="24" height="32" rx="12" />
          <rect className="pig-line pig-soft" x="142" y="156" width="24" height="32" rx="12" />
          <path className="pig-line" d="M38 114 C22 114 17 91 31 89 C41 88 43 98 35 99" />

          {/* the body: soft fill, the level of savings inside, then the outline */}
          <ellipse className="pig-soft" cx="116" cy="120" rx="80" ry="58" />
          <g clipPath={`url(#${clipId})`}>
            <rect
              className="piggy-level"
              x="30"
              y="60"
              width="172"
              height="122"
              style={{ '--fill': level }}
            />
          </g>
          <ellipse className="pig-line" cx="116" cy="120" rx="80" ry="58" />

          {/* snout, ear, eye */}
          <rect className="pig-line pig-soft" x="186" y="102" width="32" height="30" rx="13" />
          <circle className="pig-dot" cx="210" cy="110" r="2.6" />
          <circle className="pig-dot" cx="210" cy="124" r="2.6" />
          <path className="pig-line pig-soft" d="M136 76 L150 47 L177 82" />
          <circle className="pig-eye" cx="166" cy="104" r="4.4" />

          {/* the coin slot, on the back */}
          <rect className="pig-slot" x="79" y="57.5" width="42" height="10" rx="5" />

          {/* an empty piggy: a dashed ghost coin that invites the first one */}
          <g className="pig-hint" aria-hidden="true">
            <circle cx={SLOT.x} cy="24" r="13" />
            <path d="M94 43 L100 49 L106 43" />
          </g>
        </svg>

        {burst && (
          <span className="piggy-burst" ref={burstRef} aria-hidden="true">
            {Array.from({ length: PARTICLES }, (_, index) => (
              <span
                key={index}
                className={index % 2 ? 'burst-dot is-spark' : 'burst-dot is-coin'}
              >
                {index % 2 ? (
                  <svg viewBox="0 0 24 24" width="100%" height="100%" focusable="false">
                    <path d="M12 1 L14.6 9.4 L23 12 L14.6 14.6 L12 23 L9.4 14.6 L1 12 L9.4 9.4 Z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="100%" height="100%" focusable="false">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                )}
              </span>
            ))}
          </span>
        )}

        {coin && (
          <span className="coin" ref={coinRef} data-kind={coin.kind} aria-hidden="true">
            <svg viewBox="0 0 40 40" width="100%" height="100%" focusable="false">
              <circle className="coin-face" cx="20" cy="20" r="18" />
              <circle className="coin-rim" cx="20" cy="20" r="12.5" />
              <text className="coin-symbol" x="20" y="25.6" textAnchor="middle">
                {symbol}
              </text>
            </svg>
          </span>
        )}
      </div>
    </div>
  )
}
