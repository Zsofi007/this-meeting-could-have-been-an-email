import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createRoom, getRoom, type DbRoom } from '@/services/roomService'
import { supabase } from '@/services/supabaseClient'

type RoomPatch = Partial<DbRoom>

export function useRoom(options: { roomId: string; createdBy: string }) {
  const [room, setRoom] = useState<DbRoom | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setRoom(null)

    if (!options.roomId) {
      setError('Missing room id')
      setLoading(false)
      return () => {
        active = false
      }
    }

    getRoom(options.roomId)
      .then(async (r) => {
        if (!active) return
        if (r) {
          setRoom(r)
          setLoading(false)
          return
        }

        try {
          const created = await createRoom({
            id: options.roomId,
            name: 'Untitled room',
            createdBy: options.createdBy,
          })
          if (active) setRoom(created)
        } catch {
          if (active) setError('Room not found (and could not be created)')
        } finally {
          if (active) setLoading(false)
        }
      })
      .catch(() => {
        if (!active) return
        setError('Failed to load room')
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [options.createdBy, options.roomId])

  useEffect(() => {
    if (!options.roomId) return

    let channel: RealtimeChannel | null = null
    let active = true

    channel = supabase
      .channel(`room:${options.roomId}:room`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${options.roomId}`,
        },
        (payload) => {
          if (!active) return
          const next = payload.new as DbRoom
          setRoom((prev) => (prev ? { ...prev, ...next } : next))
        },
      )
      .subscribe()

    return () => {
      active = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [options.roomId])

  const patchRoom = useCallback((p: RoomPatch) => {
    setRoom((prev) => (prev ? { ...prev, ...p } : null))
  }, [])

  const inactiveDays = useMemo(() => {
    if (!room) return null
    const last = Date.parse(room.last_activity_at)
    if (Number.isNaN(last)) return null
    const days = (Date.now() - last) / (1000 * 60 * 60 * 24)
    return Math.max(0, Math.floor(days))
  }, [room])

  return { room, loading, error, inactiveDays, patchRoom }
}

