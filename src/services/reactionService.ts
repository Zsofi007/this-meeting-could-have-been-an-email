import { supabase } from '@/services/supabaseClient'

export type DbReaction = {
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

export async function fetchReactions(messageIds: string[]) {
  if (messageIds.length === 0) return [] as DbReaction[]
  const { data, error } = await supabase
    .from('message_reactions')
    .select('*')
    .in('message_id', messageIds)

  if (error) throw error
  return (data ?? []) as DbReaction[]
}

export async function addReaction(input: { messageId: string; userId: string; emoji: string }) {
  // Enforce: one reaction per user per message (client-side).
  // If you want this guaranteed at the DB level, make (message_id, user_id) unique.
  const { error: clearError } = await supabase
    .from('message_reactions')
    .delete()
    .eq('message_id', input.messageId)
    .eq('user_id', input.userId)
  if (clearError) throw clearError

  const { error } = await supabase.from('message_reactions').insert({
    message_id: input.messageId,
    user_id: input.userId,
    emoji: input.emoji,
  })
  if (error) throw error
}

export async function removeReaction(input: { messageId: string; userId: string; emoji: string }) {
  const { error } = await supabase
    .from('message_reactions')
    .delete()
    .eq('message_id', input.messageId)
    .eq('user_id', input.userId)
    .eq('emoji', input.emoji)

  if (error) throw error
}

