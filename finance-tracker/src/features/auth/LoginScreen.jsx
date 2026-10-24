import { useState } from 'react'
import { useAuth } from '../../context/useAuth'
import { useSettings } from '../../context/useSettings'
import { validateSignIn } from '../../lib/authForm'
import AuthLayout from './AuthLayout'
import { EmailField, FormMessage, PasswordField } from './AuthFields'
import { useAuthForm } from './useAuthForm'

// After signing in, PublicOnly (see AuthGate) takes the person to the page
// they asked for
export default function LoginScreen() {
  const { t } = useSettings()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const form = useAuthForm(validateSignIn)

  return (
    <AuthLayout title={t('authSignInTitle')}>
      <form
        className="auth-form"
        noValidate
        onSubmit={form.handleSubmit({ email, password }, () => signIn(email, password))}
      >
        <EmailField
          id="login-email"
          value={email}
          onChange={setEmail}
          error={form.errors.email}
          inputRef={form.field('email')}
        />
        <PasswordField
          id="login-password"
          label={t('authPassword')}
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={form.errors.password}
          inputRef={form.field('password')}
        />
        <FormMessage error={form.formError} notice={form.notice} messageRef={form.messageRef} />
        <button type="submit" className="btn" disabled={form.busy}>
          {form.busy ? t('authSigningIn') : t('authSignIn')}
        </button>
      </form>
    </AuthLayout>
  )
}
