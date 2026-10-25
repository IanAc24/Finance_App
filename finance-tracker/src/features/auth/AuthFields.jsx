import { useState } from 'react'
import { useSettings } from '../../context/useSettings'

// The ids of the hint and the error, for aria-describedby
function describedBy(id, hint, error) {
  const ids = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean)
  return ids.length > 0 ? ids.join(' ') : undefined
}

function FieldNotes({ id, hint, error }) {
  const { t } = useSettings()
  return (
    <>
      {hint && (
        <p id={`${id}-hint`} className="field-note">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-note error">
          {t(error)}
        </p>
      )}
    </>
  )
}

export function EmailField({ id, value, onChange, error, inputRef }) {
  const { t } = useSettings()
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {t('authEmail')}
      </label>
      <input
        id={id}
        ref={inputRef}
        type="email"
        maxLength={254}
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, null, error)}
      />
      <FieldNotes id={id} error={error} />
    </div>
  )
}

// Password with a button to show or hide what was typed
export function PasswordField({ id, label, value, onChange, autoComplete, error, hint, inputRef }) {
  const { t } = useSettings()
  const [visible, setVisible] = useState(false)
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="password-row">
        <input
          id={id}
          ref={inputRef}
          type={visible ? 'text' : 'password'}
          maxLength={128}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
        />
        <button
          type="button"
          className="password-toggle"
          aria-controls={id}
          aria-pressed={visible}
          onClick={() => setVisible((shown) => !shown)}
        >
          {visible ? t('authHidePassword') : t('authShowPassword')}
        </button>
      </div>
      <FieldNotes id={id} hint={hint} error={error} />
    </div>
  )
}

// The answer from Firebase: an error, or a notice that it worked. It gets
// the focus (see useAuthForm) and is announced by screen readers.
export function FormMessage({ error, notice, messageRef }) {
  const { t } = useSettings()
  if (error) {
    return (
      <p ref={messageRef} tabIndex={-1} className="auth-message error" role="alert">
        {t(error)}
      </p>
    )
  }
  if (notice) {
    return (
      <p ref={messageRef} tabIndex={-1} className="auth-message" role="status">
        {t(notice)}
      </p>
    )
  }
  return null
}
