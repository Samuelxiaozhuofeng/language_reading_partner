import { useCallback, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSessionUser } from '../lib/supabase/auth'
import { isSupabaseConfigured, supabase } from '../lib/supabase/client'

type SupabaseSessionOptions = {
  onAuthError: (message: string) => void
  onSignedIn: () => void
}

export function useSupabaseSession({ onAuthError, onSignedIn }: SupabaseSessionOptions) {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(isSupabaseConfigured)

  const applySession = useCallback((nextSession: Session | null) => {
    setUser(getSessionUser(nextSession))
  }, [])

  useEffect(() => {
    if (!supabase) {
      return
    }

    const client = supabase
    let isCancelled = false

    async function restoreSession() {
      const { data, error } = await client.auth.getSession()
      if (isCancelled) {
        return
      }

      if (error) {
        onAuthError(error.message)
      }

      applySession(data.session)
      setIsAuthLoading(false)
    }

    void restoreSession()

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession)
      if (nextSession?.user) {
        onAuthError('')
        onSignedIn()
      }
    })

    return () => {
      isCancelled = true
      data.subscription.unsubscribe()
    }
  }, [applySession, onAuthError, onSignedIn])

  return { applySession, isAuthLoading, user }
}
