import { useCallback, useEffect, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/services/supabaseClient'
import { fetchPendingJoinRequests, type JoinRequestRow } from '@/services/joinService'

export function usePendingJoinRequests(roomId: string, enabled: boolean) {
  const [requests, setRequests] = useState<JoinRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      setRequests(await fetchPendingJoinRequests(roomId))
    } catch {
      setError('Could not load join requests')
    } finally {
      setLoading(false)
    }
  }, [enabled, roomId])

  useEffect(() => {
    if (!enabled) return
    void refetch()
  }, [enabled, refetch])

  useEffect(() => {
    if (!enabled) return
    let channel: RealtimeChannel | null = null
    let active = true

    channel = supabase
      .channel(`room:${roomId}:join-requests`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_join_requests', filter: `room_id=eq.${roomId}` },
        () => {
          if (!active) return
          void refetch()
        },
      )
      .subscribe()

    return () => {
      active = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [enabled, refetch, roomId])

  return { requests, loading, error, refetch }
}

