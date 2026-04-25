import { useEffect, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type PresenceUser = {
  userId: string
  username: string
}

function normalizePresence(state: Record<string, unknown>) {
  const out: PresenceUser[] = []
  for (const [key, raw] of Object.entries(state)) {
    const list = Array.isArray(raw) ? raw : []
    for (const entry of list) {
      const obj = entry as Record<string, unknown>
      const username = typeof obj.username === 'string' ? obj.username : 'User'
      out.push({ userId: key, username })
    }
  }
  return out
}

export function useRoomPresence(channel: RealtimeChannel | null) {
  const [users, setUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!channel) return

    const sync = () => {
      const state = channel.presenceState()
      setUsers(normalizePresence(state as Record<string, unknown>))
    }

    channel.on('presence', { event: 'sync' }, sync)
    channel.on('presence', { event: 'join' }, sync)
    channel.on('presence', { event: 'leave' }, sync)

    sync()
    return () => {
      channel.untrack()
    }
  }, [channel])

  return { users }
}

