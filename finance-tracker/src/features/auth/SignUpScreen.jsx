import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { useSettings } from '../../context/useSettings'
import { validateSignUp } from '../../lib/authForm'
import AuthLayout from './AuthLayout'
import { EmailField, FormMessage, PasswordField } from './AuthFields'
import { useAuthForm } from './useAuthForm'

// Open to anyone without an account, unless VITE_ALLOW_SIGNUP is "0" (see
// App). Firebase signs
// the new account in right away, so PublicOnly then opens the app.
export default function SignUpScreen() {
  const { t } = useSettings()
  const { signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const form = useAuthForm(validateSignUp)

  return (
    <AuthLayout title={t('authSignUpTitle')}>
      <form
        className="auth-form"
        noValidate
        onSubmit={form.handleSubmit({ email, password, confirm }, () => signUp(email, password))}
      >
        <EmailField
          id="signup-email"
          value={email}
          onChange={setEmail}
          error={form.errors.email}
          inputRef={form.field('email')}
        />
        <PasswordField
          id="signup-password"
          label={t('authPassword')}
          autoComplete="new-password"
          hint={t('authPasswordHint')}
          value={password}
          onChange={setPassword}
          error={form.errors.password}
          inputRef={form.field('password')}
        />
        <PasswordField
          id="signup-confirm"
          label={t('authConfirmPassword')}
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          error={form.errors.confirm}
          inputRef={form.field('confirm')}
        />
        <FormMessage error={form.formError} notice={form.notice} messageRef={form.messageRef} />
        <button type="submit" className="btn" disabled={form.busy}>
          {form.busy ? t('authCreating') : t('authCreateAccount')}
        </button>
      </form>
      <p className="auth-links">
        <Link className="text-link" to="/login">
          {t('authHaveAccount')}
        </Link>
      </p>
    </AuthLayout>
  )
}
