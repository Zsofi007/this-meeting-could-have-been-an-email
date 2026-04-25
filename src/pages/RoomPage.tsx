import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useMyProfile } from '@/hooks/useMyProfile'
import { useRoom } from '@/hooks/useRoom'
import { useRoomJoin } from '@/hooks/useRoomJoin'
import { requestJoinRoom } from '@/services/joinService'
import { ChatPage } from '@/features/chat/ChatPage'
import { getUsernameLabel } from '@/lib/getUsernameLabel'

export function RoomPage() {
  const { roomId } = useParams()
  const { auth } = useAuth()
  const profile = useMyProfile()
  const createdBy = auth.status === 'signed_in' ? auth.user.id : ''
  const { room, loading, error, inactiveDays, patchRoom } = useRoom({ roomId: roomId ?? '', createdBy })
  const userId = auth.status === 'signed_in' ? auth.user.id : ''
  const join = useRoomJoin(roomId ?? '', userId)
  const requestUsername = auth.status === 'signed_in' ? (profile.username ?? getUsernameLabel(auth.user)) : ''
  const [requesting, setRequesting] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)

  const submitJoinRequest = async (roomId: string) => {
    setRequestError(null)
    setRequesting(true)
    try {
      await requestJoinRoom(roomId, requestUsername)
      await join.refetch()
    } catch (e: unknown) {
      setRequestError(e instanceof Error ? e.message : 'Could not request access')
    } finally {
      setRequesting(false)
    }
  }

  return (
    <main className="app-noise h-dvh min-h-0 overflow-hidden bg-zinc-950 text-zinc-50">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col px-3 py-3 sm:px-6 sm:py-6">
        <header className="shrink-0">
          <Link
            to="/"
            className="group inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-zinc-800/90 bg-zinc-900/40 py-1.5 pl-1.5 pr-3 text-xs font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900/70 sm:gap-2.5 sm:py-2 sm:pl-2.5 sm:pr-4 sm:text-sm"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-700/50 bg-zinc-950/50 transition group-hover:border-zinc-600 sm:h-8 sm:w-8">
              <ArrowLeft className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
            </span>
            <span className="truncate sm:max-w-none">Inbox</span>
          </Link>
        </header>

        <div className="min-h-0 flex-1 pt-3 sm:pt-6">
          <div className="app-card flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/45 sm:rounded-3xl">
            {loading ? (
              <div className="grid min-h-0 flex-1 place-items-center px-4 py-16 text-sm text-zinc-400 sm:px-5 sm:py-20">Loading room…</div>
            ) : error ? (
              <div className="grid min-h-0 flex-1 place-items-center px-4 py-16 text-sm text-rose-300 sm:px-5 sm:py-20">{error}</div>
            ) : room ? (
              <div className="flex h-full min-h-0 flex-col p-2.5 sm:p-5">
                {room.is_archived || (inactiveDays ?? 0) >= 30 ? (
                  <div className="mb-2 shrink-0 rounded-lg border border-amber-900/40 bg-amber-950/20 px-2.5 py-2 text-[0.65rem] text-amber-100/90 sm:mb-4 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-xs">
                    Inactive room — it may be hidden from lists. Sending a message restores activity.
                  </div>
                ) : null}
                {auth.status !== 'signed_in' ? (
                  <div className="grid min-h-0 flex-1 place-items-center px-4 py-16 text-sm text-zinc-400 sm:px-5 sm:py-20">
                    Sign in to request access.
                  </div>
                ) : join.loading ? (
                  <div className="grid min-h-0 flex-1 place-items-center px-4 py-16 text-sm text-zinc-400 sm:px-5 sm:py-20">
                    Checking access…
                  </div>
                ) : join.status === 'member' || (auth.status === 'signed_in' && room.created_by === auth.user.id) ? (
                  <ChatPage
                    key={room.id}
                    roomId={room.id}
                    roomName={room.name}
                    onRoomNameUpdated={(name) => patchRoom({ name })}
                  />
                ) : (
                  <div className="grid min-h-0 flex-1 place-items-center px-4 py-10 sm:px-5 sm:py-14">
                    <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6">
                      <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">Request to join</div>
                      <h2 className="font-display mt-2 text-balance text-xl font-semibold text-zinc-100 sm:text-2xl">
                        {room.name}
                      </h2>
                      <p className="mt-2 text-sm text-zinc-400">
                        This room requires approval from an existing member.
                      </p>

                      {join.status === 'pending' ? (
                        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/30 px-3 py-2.5 text-sm text-zinc-300">
                          Request sent. Waiting for approval…
                        </div>
                      ) : join.status === 'rejected' ? (
                        <div className="mt-4 space-y-3">
                          <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 px-3 py-2.5 text-sm text-rose-200">
                            Your request was rejected.
                          </div>
                          <button
                            type="button"
                            className="inline-flex w-full items-center justify-center rounded-xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white"
                            disabled={requesting}
                            onClick={() => {
                              void submitJoinRequest(room.id)
                            }}
                          >
                            {requesting ? 'Requesting…' : 'Request again'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white"
                          disabled={requesting}
                          onClick={() => {
                            void submitJoinRequest(room.id)
                          }}
                        >
                          {requesting ? 'Requesting…' : 'Request access'}
                        </button>
                      )}

                      {join.error || requestError ? (
                        <div className="mt-3 text-xs text-rose-300">{join.error ?? requestError}</div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  )
}
