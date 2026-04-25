import { useEffect, useState } from 'react'
import { createRoomPresenceChannel } from '@/services/presenceService'
import { supabase } from '@/services/supabaseClient'

type PresenceUser = {
  userId: string
  username: string
}

function normalizePresence(state: Record<string, unknown>) {
  const byUser = new Map<string, PresenceUser>()
  for (const [userId, raw] of Object.entries(state)) {
    const list = Array.isArray(raw) ? raw : []
    if (list.length === 0) continue

    let username = 'User'
    for (const entry of list) {
      const obj = entry as Record<string, unknown>
      if (typeof obj.username === 'string') username = obj.username
    }

    byUser.set(userId, { userId, username })
  }
  return Array.from(byUser.values())
}

export function usePresence(options: { roomId: string; userId: string; username: string }) {
  const [users, setUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    const ch = createRoomPresenceChannel(options.roomId, options.userId)

    const sync = () => {
      const state = ch.presenceState()
      setUsers(normalizePresence(state as Record<string, unknown>))
    }

    // IMPORTANT: register presence callbacks BEFORE subscribe()
    ch.on('presence', { event: 'sync' }, sync)
    ch.on('presence', { event: 'join' }, sync)
    ch.on('presence', { event: 'leave' }, sync)

    ch.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return
      await ch.track({ userId: options.userId, username: options.username })
      sync()
    })

    return () => {
      ch.untrack()
      supabase.removeChannel(ch)
      setUsers([])
    }
  }, [options.roomId, options.userId, options.username])

  return { users }
}

