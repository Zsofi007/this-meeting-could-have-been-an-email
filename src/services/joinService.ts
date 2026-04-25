import { supabase } from '@/services/supabaseClient'

export type JoinStatus = 'member' | 'pending' | 'rejected' | 'none'

export type JoinRequestRow = {
  room_id: string
  user_id: string
  requested_username: string | null
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
}

export async function getJoinStatus(roomId: string, userId: string): Promise<JoinStatus> {
  const { data: member, error: e1 } = await supabase
    .from('room_members')
    .select('room_id')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle()
  if (e1) throw e1
  if (member) return 'member'

  const { data: req, error: e2 } = await supabase
    .from('room_join_requests')
    .select('status')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle()
  if (e2) throw e2
  if (req?.status === 'pending') return 'pending'
  if (req?.status === 'approved') return 'member'
  if (req?.status === 'rejected') return 'rejected'
  return 'none'
}

export async function requestJoinRoom(roomId: string, username: string) {
  const { error } = await supabase.rpc('request_join_room', { p_room_id: roomId, p_username: username })
  if (error) throw error
}

export async function decideJoinRequest(roomId: string, userId: string, decision: 'approved' | 'rejected') {
  const { error } = await supabase.rpc('decide_room_join_request', {
    p_room_id: roomId,
    p_user_id: userId,
    p_decision: decision,
  })
  if (error) throw error
}

export async function fetchPendingJoinRequests(roomId: string): Promise<JoinRequestRow[]> {
  const { data, error } = await supabase
    .from('room_join_requests')
    .select('room_id,user_id,requested_username,status,requested_at')
    .eq('room_id', roomId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as JoinRequestRow[]
}

