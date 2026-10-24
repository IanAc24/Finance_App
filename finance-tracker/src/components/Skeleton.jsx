// A placeholder block for something that is loading: a soft pulse of opacity
// (the CSS stops it with reduced motion). Decorative: the screen that uses it
// says "loading" in words for screen readers.
//   width / height: any CSS size; round: a circle or pill instead of a block
export default function Skeleton({ width = '100%', height = 16, round = false, className = '' }) {
  const classes = ['skeleton', round && 'is-round', className].filter(Boolean).join(' ')
  return <span className={classes} style={{ width, height }} aria-hidden="true" />
}
