import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/services/supabaseClient'

export function createRoomPresenceChannel(roomId: string, key: string): RealtimeChannel {
  return supabase.channel(`room:${roomId}:presence`, {
    config: { presence: { key } },
  })
}

