import { useContext } from 'react'
import { ToastContext } from './ToastContext'

// { show({ message, action: { label, to, state } }), dismiss() }
export function useToast() {
  return useContext(ToastContext)
}
