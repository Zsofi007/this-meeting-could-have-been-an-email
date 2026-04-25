import { useEffect } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/services/supabaseClient'
import type { DbMessage } from '@/services/chatService'

export function useMessagesSubscription(options: {
  roomId: string
  onMessage: (m: DbMessage) => void
  onStatus?: (s: 'subscribed' | 'closed' | 'error') => void
}) {
  const { roomId, onMessage, onStatus } = options

  useEffect(() => {
    let channel: RealtimeChannel | null = null
    let active = true

    channel = supabase
      .channel(`room:${roomId}:messages`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (!active) return
          onMessage(payload.new as DbMessage)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (!active) return
          onMessage(payload.new as DbMessage)
        },
      )
      .subscribe((status) => {
        if (!active) return
        if (status === 'SUBSCRIBED') {
          onStatus?.('subscribed')
          return
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          onStatus?.('error')
        }
      })

    return () => {
      active = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [roomId, onMessage, onStatus])
}

