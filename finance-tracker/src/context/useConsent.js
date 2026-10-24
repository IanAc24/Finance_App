import { useContext } from 'react'
import { ConsentContext } from './ConsentContext'

// { consent, accept(), withdraw() }: the acceptance of the legal texts
// saved on this device (consent is { version, acceptedAt } or null)
export function useConsent() {
  return useContext(ConsentContext)
}
