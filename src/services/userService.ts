import { supabase } from '@/services/supabaseClient'

export function normalizeUsername(input: string) {
  const trimmed = input.trim()
  // Keep it simple + safe for UI. You can loosen this later.
  if (trimmed.length < 2) return { ok: false as const, error: 'Username must be at least 2 characters' }
  if (trimmed.length > 32) return { ok: false as const, error: 'Username must be 32 characters or less' }
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return { ok: false as const, error: 'Use only letters, numbers, ".", "_" or "-"' }
  }
  return { ok: true as const, value: trimmed }
}

export async function getMyUsername(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase.from('user_profiles').select('username').eq('user_id', user.id).maybeSingle()
  if (error) return null
  const username = (data as { username?: string } | null)?.username
  return typeof username === 'string' && username.trim().length > 0 ? username : null
}

export async function setUsername(username: string) {
  const n = normalizeUsername(username)
  if (!n.ok) throw new Error(n.error)

  // Store in app table (canonical) so we can copy cross-device in SQL.
  const { error: rpcError } = await supabase.rpc('set_my_username', { p_username: n.value })
  if (rpcError) throw rpcError

  // Best-effort: also mirror in auth metadata (useful for quick display if profiles query fails).
  const { data, error } = await supabase.auth.updateUser({
    data: { username: n.value },
  })
  if (error) throw error
  return data.user
}

