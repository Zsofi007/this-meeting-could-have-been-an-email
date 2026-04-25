import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Inbox, MessageCircle } from 'lucide-react'
import { formatRelativeTime } from '@/lib/formatRelativeTime'
import type { DashboardRoom } from '@/services/roomService'
import { clsx } from 'clsx'

function previewText(room: DashboardRoom) {
  if (room.lastMessageText == null) return 'No messages yet'
  const who = room.lastMessageUsername ? `${room.lastMessageUsername}: ` : ''
  return `${who}${room.lastMessageText}`
}

export function MyRoomsList(props: {
  rooms: DashboardRoom[]
  loading: boolean
  error: string | null
  emptyCta: ReactNode
}) {
  if (props.loading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading rooms">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-2xl border border-zinc-800/50 bg-zinc-900/40"
          />
        ))}
      </div>
    )
  }

  if (props.error) {
    return <div className="rounded-2xl border border-rose-900/40 bg-rose-950/20 p-4 text-sm text-rose-200">{props.error}</div>
  }

  if (props.rooms.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/20 p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/40">
          <Inbox className="h-6 w-6 text-zinc-500" aria-hidden />
        </div>
        <h3 className="font-display mt-4 text-lg text-zinc-200">No rooms yet</h3>
        <p className="mt-1 text-pretty text-sm text-zinc-500">
          Start a new room, share the link, and the conversation will show up here.
        </p>
        <div className="mt-6 flex justify-center">{props.emptyCta}</div>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2" role="list">
      {props.rooms.map((room) => {
        const t = room.lastMessageAt
          ? formatRelativeTime(room.lastMessageAt)
          : formatRelativeTime(room.lastActivityAt)
        return (
          <li key={room.roomId}>
            <Link
              to={`/room/${room.roomId}`}
              className={clsx(
                'app-card group flex items-stretch gap-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/30 transition-colors',
                'hover:border-zinc-600 hover:bg-zinc-900/50',
              )}
              style={{ maxWidth: '90vw' }}
            >
              <div className="w-1 shrink-0 bg-gradient-to-b from-zinc-500/80 to-zinc-700/40" aria-hidden />
              <div className="min-w-0 flex-1 px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-zinc-100">{room.name}</h3>
                      {room.isArchived ? (
                        <span className="shrink-0 rounded-md border border-zinc-700 px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-zinc-500">
                          Archived
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex items-center max-w-full gap-1.5 overflow-hidden text-sm text-zinc-500">
                      <MessageCircle className="h-3.5 w-3.5 shrink-0 text-zinc-600" aria-hidden />
                      <span className="min-w-0 truncate">{previewText(room)}</span>
                    </div>
                  </div>
                  {t ? <time className="shrink-0 text-xs text-zinc-500">{t}</time> : null}
                </div>
                <p className="mt-1 font-mono text-[0.65rem] text-zinc-600">{room.roomId}</p>
              </div>
              <div className="flex shrink-0 items-center pr-3">
                <ChevronRight
                  className="h-5 w-5 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-400"
                  aria-hidden
                />
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
