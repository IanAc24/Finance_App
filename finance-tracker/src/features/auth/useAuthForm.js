import { useEffect, useRef, useState } from 'react'
import { authErrorKey } from '../../lib/authErrors'
import { submitForm } from '../../lib/authForm'

// What the sign-in forms share: checking the fields, a lock so two quick
// taps send only once, the busy button, and the message from Firebase.
// `validate` returns { field: key }; `errorKey` turns a Firebase error into
// a translation key. The steps themselves are in submitForm (lib/authForm).
export function useAuthForm(validate, errorKey = authErrorKey) {
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const inputs = useRef({})
  const messageRef = useRef(null)

  // a message from Firebase gets the focus, so it is read out at once
  useEffect(() => {
    if (formError || notice) messageRef.current?.focus()
  }, [formError, notice])

  // ref for an input, so focus can go to the first field with an error
  const field = (name) => (node) => {
    inputs.current[name] = node
  }

  // `send` may return a key to show as a notice when it worked
  const handleSubmit = (values, send) => async (event) => {
    event.preventDefault()
    const result = await submitForm({
      lock,
      values,
      validate,
      send,
      errorKey,
      onStart: () => {
        setFormError(null)
        setNotice(null)
        setBusy(true)
      },
    })
    if (result.ignored) return
    setBusy(false)
    setErrors(result.errors)
    if (result.first) {
      setFormError(null)
      setNotice(null)
      inputs.current[result.first]?.focus()
      return
    }
    // only the code: the error can carry the email, which is never logged
    if (result.formError) console.warn('auth', result.code)
    setFormError(result.formError ?? null)
    setNotice(result.notice ?? null)
  }

  return { errors, formError, notice, busy, field, messageRef, handleSubmit }
}
