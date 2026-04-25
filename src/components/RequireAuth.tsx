import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { auth } = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center bg-zinc-950 text-zinc-200">
        <div className="text-sm text-zinc-400">Checking session…</div>
      </div>
    )
  }

  if (auth.status === 'signed_out') {
    const from = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to="/" replace state={{ from }} />
  }

  return children
}

