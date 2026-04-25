import { useCallback, useEffect, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getJoinStatus, type JoinStatus } from '@/services/joinService'
import { supabase } from '@/services/supabaseClient'

export function useRoomJoin(roomId: string, userId: string) {
  const [status, setStatus] = useState<JoinStatus>('none')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!roomId || !userId) return
    setLoading(true)
    setError(null)
    try {
      const next = await getJoinStatus(roomId, userId)
      setStatus(next)
    } catch {
      setError('Could not check join status')
    } finally {
      setLoading(false)
    }
  }, [roomId, userId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  useEffect(() => {
    if (!roomId || !userId) return

    let channel: RealtimeChannel | null = null
    let active = true

    // Realtime: update requester screen immediately on approval/rejection.
    channel = supabase
      .channel(`room:${roomId}:my-join:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_join_requests',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (!active) return
          const next = payload.new as { user_id?: string } | null
          if (next?.user_id !== userId) return
          void refetch()
        },
      )
      .subscribe()

    return () => {
      active = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [refetch, roomId, userId])

  return { status, loading, error, refetch }
}

