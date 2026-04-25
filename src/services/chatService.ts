import { supabase } from '@/services/supabaseClient'

export type DbMessage = {
  id: string
  room_id: string
  user_id: string
  username: string
  text: string
  client_id: string | null
  created_at: string
  updated_at: string | null
  deleted_at: string | null
}

export async function fetchRecentMessages(roomId: string, limit = 50) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as DbMessage[]
}

export async function sendMessage(input: {
  roomId: string
  userId: string
  text: string
  username: string
  clientId: string
}) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      room_id: input.roomId,
      text: input.text,
      username: input.username,
      user_id: input.userId,
      client_id: input.clientId,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as DbMessage
}

export async function editMessage(input: { id: string; text: string }) {
  const { data, error } = await supabase
    .from('messages')
    .update({ text: input.text, updated_at: new Date().toISOString() })
    .eq('id', input.id)
    .select('*')
    .single()

  if (error) throw error
  return data as DbMessage
}

export async function deleteMessage(input: { id: string }) {
  const { data, error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', input.id)
    .select('*')
    .single()

  if (error) throw error
  return data as DbMessage
}

