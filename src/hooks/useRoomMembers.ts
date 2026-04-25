import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/services/supabaseClient'

export type RoomMember = {
  userId: string
  username: string
  lastSeenAt: string | null
}

type DbRow = { user_id: string; username: string; created_at: string }

function mergeLatest(prev: RoomMember[], rows: DbRow[]) {
  const byId = new Map<string, RoomMember>()
  for (const m of prev) byId.set(m.userId, m)

  for (const r of rows) {
    const existing = byId.get(r.user_id)
    const next: RoomMember = {
      userId: r.user_id,
      username: r.username,
      lastSeenAt: r.created_at ?? null,
    }
    if (!existing) {
      byId.set(r.user_id, next)
      continue
    }
    const existingAt = existing.lastSeenAt ? Date.parse(existing.lastSeenAt) : 0
    const nextAt = next.lastSeenAt ? Date.parse(next.lastSeenAt) : 0
    if (nextAt >= existingAt) byId.set(r.user_id, next)
  }

  return Array.from(byId.values()).sort((a, b) => {
    const aAt = a.lastSeenAt ? Date.parse(a.lastSeenAt) : 0
    const bAt = b.lastSeenAt ? Date.parse(b.lastSeenAt) : 0
    return bAt - aAt
  })
}

export function useRoomMembers(roomId: string) {
  const [members, setMembers] = useState<RoomMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!roomId) return
    setLoading(true)
    setError(null)
    try {
      // Not perfect "distinct", but good enough: fetch recent messages and de-dupe by user.
      const { data, error: e } = await supabase
        .from('messages')
        .select('user_id,username,created_at')
        .eq('room_id', roomId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(500)
      if (e) throw e
      setMembers((prev) => mergeLatest(prev, (data ?? []) as DbRow[]))
    } catch {
      setError('Could not load room members')
    } finally {
      setLoading(false)
    }
  }, [roomId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  useEffect(() => {
    if (!roomId) return

    let channel: RealtimeChannel | null = null
    let active = true

    channel = supabase
      .channel(`room:${roomId}:members`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (!active) return
          const row = payload.new as DbRow
          if (!row?.user_id || !row?.username) return
          setMembers((prev) => mergeLatest(prev, [row]))
        },
      )
      .subscribe()

    return () => {
      active = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [roomId])

  const byId = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members])

  return { members, byId, loading, error, refetch }
}

