import { useCallback, useEffect, useState } from 'react'
import { fetchMyRoomsWithPreview, type DashboardRoom } from '@/services/roomService'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/services/supabaseClient'

type State = { rooms: DashboardRoom[]; loading: boolean; error: string | null }

export function useMyRooms(enabled: boolean) {
  const [state, setState] = useState<State>({ rooms: [], loading: true, error: null })

  const refetch = useCallback(async () => {
    if (!enabled) {
      setState((s) => ({ ...s, rooms: [], loading: false, error: null }))
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const rooms = await fetchMyRoomsWithPreview()
      setState({ rooms, loading: false, error: null })
    } catch {
      setState((s) => ({ ...s, rooms: [], loading: false, error: 'Could not load your rooms' }))
    }
  }, [enabled])

  useEffect(() => {
    void refetch()
  }, [refetch])

  useEffect(() => {
    if (!enabled) return
    const onVis = () => {
      if (document.visibilityState === 'visible') void refetch()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [enabled, refetch])

  useEffect(() => {
    if (!enabled) return

    let channel: RealtimeChannel | null = null
    let active = true

    channel = supabase
      .channel('my-rooms:rooms')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms' },
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
  }, [enabled, refetch])

  return { ...state, refetch }
}
