import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LogIn, UserPlus } from 'lucide-react'
import { FcGoogle } from 'react-icons/fc'
import { useAuth } from '@/hooks/useAuth'

type Mode = 'sign_in' | 'sign_up'

function normalizeError(e: unknown) {
  if (e instanceof Error) return e.message
  return 'Something went wrong'
}

export function EmailAuthCard() {
  const { signInWithPassword, signUpWithPassword, signInWithGoogle, auth } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const oauthRedirectTo = useMemo(() => {
    const from = (location.state as { from?: string } | null)?.from
    if (from && typeof from === 'string' && from.startsWith('/')) return `${window.location.origin}${from}`
    return `${window.location.origin}${window.location.pathname}${window.location.search}`
  }, [location.state])

  const disabled = pending || auth.status === 'loading'
  const cta = useMemo(() => (mode === 'sign_in' ? 'Sign in' : 'Create account'), [mode])

  const onSubmit = async () => {
    setError(null)
    setPending(true)
    try {
      if (mode === 'sign_in') await signInWithPassword({ email, password })
      else await signUpWithPassword({ email, password })
    } catch (e: unknown) {
      setError(normalizeError(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-100">Sign in</div>
          <div className="mt-1 text-sm text-zinc-400">Google or email/password.</div>
        </div>
        <div className="flex rounded-full border border-zinc-800 bg-zinc-950/40 p-1 text-xs">
          <button
            className={`rounded-full px-3 py-1 ${mode === 'sign_in' ? 'bg-zinc-50 text-zinc-950' : 'text-zinc-300'}`}
            type="button"
            onClick={() => setMode('sign_in')}
            disabled={disabled}
          >
            Sign in
          </button>
          <button
            className={`rounded-full px-3 py-1 ${mode === 'sign_up' ? 'bg-zinc-50 text-zinc-950' : 'text-zinc-300'}`}
            type="button"
            onClick={() => setMode('sign_up')}
            disabled={disabled}
          >
            Register
          </button>
        </div>
      </div>

      <button
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:opacity-60"
        type="button"
        onClick={() => void signInWithGoogle({ redirectTo: oauthRedirectTo })}
        disabled={disabled}
      >
        <FcGoogle className="h-4 w-4" aria-hidden />
        Continue with Google
      </button>

      <div className="my-4 flex items-center gap-3 text-xs text-zinc-500">
        <div className="h-px flex-1 bg-zinc-800" />
        <span>or</span>
        <div className="h-px flex-1 bg-zinc-800" />
      </div>

      <div className="space-y-3">
        <label className="block">
          <div className="mb-1 text-xs font-medium text-zinc-300">Email</div>
          <input
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 outline-none ring-1 ring-transparent placeholder:text-zinc-600 focus:ring-zinc-700"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@domain.com"
            autoComplete="email"
            inputMode="email"
            disabled={disabled}
          />
        </label>
        <label className="block">
          <div className="mb-1 text-xs font-medium text-zinc-300">Password</div>
          <input
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 outline-none ring-1 ring-transparent placeholder:text-zinc-600 focus:ring-zinc-700"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === 'sign_in' ? 'current-password' : 'new-password'}
            type="password"
            disabled={disabled}
          />
        </label>
      </div>

      {error ? <div className="mt-3 text-sm text-rose-300">{error}</div> : null}

      <button
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-700 hover:bg-zinc-950/70 disabled:opacity-60"
        type="button"
        onClick={() => void onSubmit()}
        disabled={disabled || email.trim().length === 0 || password.length < 8}
      >
        {mode === 'sign_in' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        {pending ? 'Working…' : cta}
      </button>

      <div className="mt-3 text-xs text-zinc-500">
        Password must be at least <span className="text-zinc-300">8 characters</span>.
      </div>
    </div>
  )
}

