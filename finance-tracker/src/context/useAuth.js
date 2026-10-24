import { useContext } from 'react'
import { AuthContext } from './AuthContext'

// { status: 'loading' | 'authenticated' | 'unauthenticated', user,
//   signIn, signUp, signOut, resetPassword }
export function useAuth() {
  return useContext(AuthContext)
}
