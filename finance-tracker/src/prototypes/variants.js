import { useSearchParams } from 'react-router-dom'

// The two directions; the first one is the default
export const variants = [
  { id: 'resumen', name: 'Resumen' },
  { id: 'diario', name: 'Diario' },
]

// The direction chosen in the URL (?v=resumen|diario); anything else is the first
export function useVariant() {
  const [params, setParams] = useSearchParams()
  const found = variants.find((v) => v.id === params.get('v'))
  const variant = (found ?? variants[0]).id
  const setVariant = (id) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('v', id)
        return next
      },
      { replace: true },
    )
  }
  return [variant, setVariant]
}
