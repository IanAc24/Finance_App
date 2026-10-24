import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { useSettings } from '../../context/useSettings'
import { requestReset, validateReset } from '../../lib/authForm'
import AuthLayout from './AuthLayout'
import { EmailField, FormMessage } from './AuthFields'
import { useAuthForm } from './useAuthForm'

// Firebase emails a link to its own page for the new password. The answer
// is the same whether the email has an account or not.
export default function ResetPasswordScreen() {
  const { t } = useSettings()
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const form = useAuthForm(validateReset)

  const send = () => requestReset(resetPassword, email)

  return (
    <AuthLayout title={t('authResetTitle')}>
      <p className="sub">{t('authResetHint')}</p>
      <form className="auth-form" noValidate onSubmit={form.handleSubmit({ email }, send)}>
        <EmailField
          id="reset-email"
          value={email}
          onChange={setEmail}
          error={form.errors.email}
          inputRef={form.field('email')}
        />
        <FormMessage error={form.formError} notice={form.notice} messageRef={form.messageRef} />
        <button type="submit" className="btn" disabled={form.busy}>
          {form.busy ? t('authResetSending') : t('authResetSend')}
        </button>
      </form>
      <p className="auth-links">
        <Link className="text-link" to="/login">
          {t('authBackToSignIn')}
        </Link>
      </p>
    </AuthLayout>
  )
}
