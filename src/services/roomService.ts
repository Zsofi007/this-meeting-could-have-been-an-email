import { supabase } from '@/services/supabaseClient'

export type DbRoom = {
  id: string
  name: string
  created_by: string
  created_at: string
  last_activity_at: string
  is_archived: boolean
}

/** Dashboard row: rooms you created or have messaged in, with latest room message. */
export type DashboardRoom = {
  roomId: string
  name: string
  lastActivityAt: string
  isArchived: boolean
  lastMessageText: string | null
  lastMessageAt: string | null
  lastMessageUsername: string | null
}

type RpcMyRoomRow = {
  room_id: string
  name: string
  last_activity_at: string
  is_archived: boolean
  last_message_text: string | null
  last_message_at: string | null
  last_message_username: string | null
}

function mapRpcRow(row: RpcMyRoomRow): DashboardRoom {
  return {
    roomId: row.room_id,
    name: row.name,
    lastActivityAt: row.last_activity_at,
    isArchived: row.is_archived,
    lastMessageText: row.last_message_text,
    lastMessageAt: row.last_message_at,
    lastMessageUsername: row.last_message_username,
  }
}

export async function getRoom(roomId: string) {
  // `.single()` throws 406 when 0 rows match; for join-by-URL we want to treat that as "missing".
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as DbRoom | null
}

export async function createRoom(input: { id: string; name: string; createdBy: string }) {
  const { data, error } = await supabase
    .from('rooms')
    .insert({ id: input.id, name: input.name, created_by: input.createdBy })
    .select('*')
    .single()

  if (error) throw error
  return data as DbRoom
}

async function fetchMyRoomsWithPreviewFallback(userId: string): Promise<DashboardRoom[]> {
  const { data: memberRows, error: eMembers } = await supabase
    .from('room_members')
    .select('room_id')
    .eq('user_id', userId)
  if (eMembers) throw eMembers
  const memberIds = (memberRows ?? []).map((r) => r.room_id as string)

  const { data: dismissedRows, error: eDismiss } = await supabase
    .from('user_room_dismissals')
    .select('room_id')
    .eq('user_id', userId)
  if (eDismiss) throw eDismiss
  const dismissed = new Set((dismissedRows ?? []).map((d) => d.room_id as string))

  const ids = [...new Set(memberIds)].filter((id) => !dismissed.has(id))
  if (ids.length === 0) return []

  const { data: rooms, error: e3 } = await supabase.from('rooms').select('*').in('id', ids)
  if (e3) throw e3
  if (!rooms?.length) return []

  const withPreview: DashboardRoom[] = await Promise.all(
    (rooms as DbRoom[]).map(async (r) => {
      const { data: last, error: e4 } = await supabase
        .from('messages')
        .select('text, created_at, username')
        .eq('room_id', r.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (e4) throw e4
      return {
        roomId: r.id,
        name: r.name,
        lastActivityAt: r.last_activity_at,
        isArchived: r.is_archived,
        lastMessageText: last?.text ?? null,
        lastMessageAt: last?.created_at ?? null,
        lastMessageUsername: last?.username ?? null,
      }
    })
  )

  withPreview.sort((a, b) => {
    const aKey = a.lastMessageAt
      ? Date.parse(a.lastMessageAt)
      : a.lastActivityAt
        ? Date.parse(a.lastActivityAt)
        : 0
    const bKey = b.lastMessageAt
      ? Date.parse(b.lastMessageAt)
      : b.lastActivityAt
        ? Date.parse(b.lastActivityAt)
        : 0
    return bKey - aKey
  })

  return withPreview
}

/**
 * Uses RPC `get_my_rooms_with_preview` when available; otherwise a client-side fallback
 * (extra queries per room, fine for small lists / local dev before migration).
 */
export async function fetchMyRoomsWithPreview(): Promise<DashboardRoom[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase.rpc('get_my_rooms_with_preview')
  if (!error && data != null) {
    return (data as RpcMyRoomRow[]).map(mapRpcRow)
  }

  return fetchMyRoomsWithPreviewFallback(user.id)
}

/** Rename room (creator or anyone who has posted in the room). Requires `set_room_name` RPC in DB. */
export async function setRoomName(roomId: string, name: string) {
  const { error } = await supabase.rpc('set_room_name', { p_room_id: roomId, p_name: name })
  if (error) throw error
}

/** Mark this room as left for the current user (hidden from dashboard until they post again). */
export async function dismissRoomForUser(roomId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const { error } = await supabase.from('user_room_dismissals').upsert(
    { user_id: user.id, room_id: roomId, dismissed_at: new Date().toISOString() },
    { onConflict: 'user_id,room_id' },
  )
  if (error) throw error
}

/** Leave room: removes membership so re-join needs approval. */
export async function leaveRoom(roomId: string) {
  const { error } = await supabase.rpc('leave_room', { p_room_id: roomId })
  if (error) throw error
}

/** Remove dashboard dismissal so the room can appear in "My rooms" again after a new message. */
export async function clearRoomDismissal(roomId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase.from('user_room_dismissals').delete().eq('user_id', user.id).eq('room_id', roomId)
  if (error) throw error
}

