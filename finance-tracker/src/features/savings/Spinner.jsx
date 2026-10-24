// A small ring that turns while something is being saved (the CSS holds it
// still with reduced motion; the text next to it says "Saving…")
export default function Spinner() {
  return <span className="sv-spinner" aria-hidden="true" />
}
