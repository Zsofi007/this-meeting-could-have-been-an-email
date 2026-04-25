import { useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/services/supabaseClient'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; user: User; session: Session }

export function useAuth(): {
  auth: AuthState
  signInWithGoogle: (options?: { redirectTo?: string }) => Promise<void>
  signInWithPassword: (input: { email: string; password: string }) => Promise<void>
  signUpWithPassword: (input: { email: string; password: string }) => Promise<void>
  signOut: () => Promise<void>
} {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return
      if (error) throw error
      setSession(data.session ?? null)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  const auth = useMemo<AuthState>(() => {
    if (loading) return { status: 'loading' }
    if (!session?.user) return { status: 'signed_out' }
    return { status: 'signed_in', user: session.user, session }
  }, [loading, session])

  return {
    auth,
    signInWithGoogle: async (options) => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: options?.redirectTo ?? window.location.href },
      })
      if (error) throw error
    },
    signInWithPassword: async (input) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      })
      if (error) throw error
    },
    signUpWithPassword: async (input) => {
      const { error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
      })
      if (error) throw error
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
  }
}

