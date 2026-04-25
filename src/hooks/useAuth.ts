import { useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/services/supabaseClient'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; user: User; session: Session }

function isSupabaseAuthCallbackUrl() {
  // Implicit flow: access_token in hash; PKCE flow: code in search params.
  return (
    (typeof window !== 'undefined' && window.location.hash.includes('access_token=')) ||
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('code'))
  )
}

function stripAuthParamsFromUrl() {
  // Remove sensitive tokens/code from the URL after session is established.
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.hash = ''
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  window.history.replaceState({}, '', `${url.pathname}${url.search}`)
}

function getSafeRedirectTo() {
  // Never include hash in redirectTo; otherwise callback becomes "##access_token=..."
  const { origin, pathname, search } = window.location
  return `${origin}${pathname}${search}`
}

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
    const isCallback = isSupabaseAuthCallbackUrl()

    // If we're on the OAuth callback URL, keep the app in loading state briefly so
    // route guards don't redirect away before Supabase processes the tokens.
    let callbackTimeout: number | null = null
    if (isCallback) {
      callbackTimeout = window.setTimeout(() => {
        if (!alive) return
        setLoading(false)
      }, 2500)
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return
      if (error) {
        setSession(null)
        setLoading(false)
        return
      }
      setSession(data.session ?? null)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession && isCallback) stripAuthParamsFromUrl()
      setLoading(false)
    })

    return () => {
      alive = false
      if (callbackTimeout != null) window.clearTimeout(callbackTimeout)
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
        options: { redirectTo: options?.redirectTo ?? getSafeRedirectTo() },
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

