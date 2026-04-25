import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { useAuth } from '@/hooks/useAuth'
import { useMyProfile } from '@/hooks/useMyProfile'
import { useMessages } from '@/hooks/useMessages'
import { usePresence } from '@/hooks/usePresence'
import { useRoomMembers } from '@/hooks/useRoomMembers'
import { usePendingJoinRequests } from '@/hooks/usePendingJoinRequests'
import { useReactions } from '@/hooks/useReactions'
import { deleteMessage, editMessage, sendMessage } from '@/services/chatService'
import { decideJoinRequest } from '@/services/joinService'
import { leaveRoom, setRoomName } from '@/services/roomService'
import { getUsernameLabel } from '@/lib/getUsernameLabel'
import { MessageInput } from '@/features/chat/MessageInput'
import { MessageList } from '@/features/chat/MessageList'
import { PeoplePanel } from '@/features/chat/PeoplePanel'
import { RoomHeader } from '@/features/chat/RoomHeader'

export function ChatPage(props: {
  roomId: string
  roomName?: string
  onRoomNameUpdated?: (name: string) => void
}) {
  const { roomId, roomName, onRoomNameUpdated } = props
  const navigate = useNavigate()
  const { auth } = useAuth()
  const profile = useMyProfile()
  const [leaveError, setLeaveError] = useState<string | null>(null)

  const identity = useMemo(() => {
    if (auth.status !== 'signed_in') return null
    return { userId: auth.user.id, username: profile.username ?? getUsernameLabel(auth.user) }
  }, [auth, profile.username])

  const messages = useMessages({
    roomId,
    userId: identity?.userId ?? '',
    username: identity?.username ?? 'User',
  })

  const presence = usePresence({
    roomId,
    userId: identity?.userId ?? '',
    username: identity?.username ?? 'User',
  })

  const members = useRoomMembers(roomId)
  const [peopleOpen, setPeopleOpen] = useState(false)

  // Keep this running so we can badge the People button in realtime.
  const pending = usePendingJoinRequests(roomId, true)

  const onlineById = useMemo(() => new Map(presence.users.map((u) => [u.userId, u.username])), [presence.users])

  const peopleRows = useMemo(() => {
    // union(members, online)
    const rows: { userId: string; username: string; online: boolean }[] = []
    const seen = new Set<string>()

    for (const m of members.members) {
      const onlineName = onlineById.get(m.userId)
      rows.push({ userId: m.userId, username: onlineName ?? m.username, online: Boolean(onlineName) })
      seen.add(m.userId)
    }
    for (const u of presence.users) {
      if (seen.has(u.userId)) continue
      rows.push({ userId: u.userId, username: u.username, online: true })
      seen.add(u.userId)
    }

    rows.sort((a, b) => Number(b.online) - Number(a.online) || a.username.localeCompare(b.username))
    return rows
  }, [members.members, onlineById, presence.users])

  const messageIds = useMemo(() => {
    return messages.messages
      .flatMap((m) => (m.kind === 'db' ? [m.message.id] : []))
      .slice(-50)
  }, [messages.messages])

  const reactions = useReactions({ messageIds, viewerUserId: identity?.userId ?? '' })

  const onSaveRoomName = useCallback(
    async (name: string) => {
      await setRoomName(roomId, name)
      onRoomNameUpdated?.(name)
    },
    [roomId, onRoomNameUpdated],
  )

  const onLeaveRoom = useCallback(async () => {
    setLeaveError(null)
    let left = false
    try {
      if (identity) {
        await sendMessage({
          roomId,
          userId: identity.userId,
          username: identity.username,
          text: `${identity.username} left the room`,
          clientId: nanoid(12),
        })
      }
      await leaveRoom(roomId)
      left = true
    } catch (e) {
      setLeaveError(e instanceof Error ? e.message : 'Could not leave room')
    } finally {
      if (left) void navigate('/')
    }
  }, [identity, navigate, roomId])

  if (auth.status !== 'signed_in' || !identity) return null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden sm:gap-4">
      {leaveError ? (
        <div className="shrink-0 rounded-xl border border-rose-900/40 bg-rose-950/20 px-3 py-2 text-xs text-rose-200 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
          {leaveError}
        </div>
      ) : null}
      <RoomHeader
        roomId={roomId}
        roomName={roomName}
        realtimeLabel={messages.realtime === 'connected' ? 'Live' : 'Reconnecting…'}
        onlineCount={presence.users.length}
        pendingCount={pending.requests.length}
        peopleOpen={peopleOpen}
        onTogglePeople={() => setPeopleOpen((v) => !v)}
        onLeaveRoom={() => void onLeaveRoom()}
        onSaveRoomName={onSaveRoomName}
      />

      <PeoplePanel
        open={peopleOpen}
        onlineCount={presence.users.length}
        people={peopleRows}
        pending={pending.requests.map((r) => ({
          userId: r.user_id,
          username: r.requested_username ?? r.user_id,
        }))}
        onApprove={(userId) => {
          void decideJoinRequest(roomId, userId, 'approved')
        }}
        onReject={(userId) => {
          void decideJoinRequest(roomId, userId, 'rejected')
        }}
        error={members.error}
        onClose={() => setPeopleOpen(false)}
      />

      <MessageList
        items={messages.messages}
        viewerUserId={identity.userId}
        reactionsByMessageId={reactions.byMessageId}
        onToggleReaction={(messageId, emoji, reactedByMe) => reactions.toggle(messageId, emoji, reactedByMe)}
        onEditMessage={async (messageId, nextText) => {
          const updated = await editMessage({ id: messageId, text: nextText })
          messages.upsertDb(updated)
        }}
        onDeleteMessage={async (messageId) => {
          const updated = await deleteMessage({ id: messageId })
          messages.upsertDb(updated)
        }}
      />
      <div className="shrink-0">
        <MessageInput
          disabled={Boolean(messages.error)}
          coolingDown={messages.coolingDown}
          onSend={messages.send}
        />
      </div>
    </div>
  )
}

