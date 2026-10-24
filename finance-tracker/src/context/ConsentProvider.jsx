import { useMemo, useState } from 'react'
import { ConsentContext } from './ConsentContext'
import { readConsent, withdrawConsent, writeConsent } from '../lib/legal'

// Keeps the acceptance of the legal texts in memory and on the device, so the
// shell can ask for it and Settings can show it and withdraw it.
export default function ConsentProvider({ children }) {
  const [consent, setConsent] = useState(readConsent)

  const value = useMemo(
    () => ({
      consent,
      accept: () => setConsent(writeConsent(new Date())),
      withdraw: () => {
        withdrawConsent()
        setConsent(null)
      },
    }),
    [consent],
  )

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
}
