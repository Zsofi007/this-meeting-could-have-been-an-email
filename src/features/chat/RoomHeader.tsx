import { useEffect, useMemo, useState } from 'react'
import { Check, DoorOpen, Link2, Pencil, Users } from 'lucide-react'

export function RoomHeader(props: {
  roomId: string
  roomName?: string
  realtimeLabel: string
  onlineCount: number
  pendingCount?: number
  peopleOpen: boolean
  onTogglePeople: () => void
  onLeaveRoom: () => void
  onSaveRoomName: (name: string) => Promise<void>
}) {
  const roomUrl = useMemo(() => `${window.location.origin}/room/${props.roomId}`, [props.roomId])

  const [titleEdit, setTitleEdit] = useState(false)
  const [titleDraft, setTitleDraft] = useState(props.roomName ?? 'Room')
  const [titleErr, setTitleErr] = useState<string | null>(null)
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    if (!titleEdit) setTitleDraft(props.roomName ?? 'Room')
  }, [props.roomName, titleEdit])

  const [copied, setCopied] = useState(false)
  const onCopyLink = async () => {
    await navigator.clipboard.writeText(roomUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const onSave = async () => {
    const n = titleDraft.trim()
    if (n.length === 0) {
      setTitleErr('Name cannot be empty')
      return
    }
    if (n === (props.roomName ?? '').trim()) {
      setTitleEdit(false)
      setTitleErr(null)
      return
    }
    setSavingName(true)
    setTitleErr(null)
    try {
      await props.onSaveRoomName(n)
      setTitleEdit(false)
    } catch {
      setTitleErr('Could not save. You can rename after you’ve posted in this room.')
    } finally {
      setSavingName(false)
    }
  }

  return (
    <div className="shrink-0 border-b border-zinc-800/70 pb-3 sm:pb-4">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          {titleEdit ? (
            <div className="space-y-2">
              <input
                className="font-display w-full rounded-xl border border-zinc-600 bg-zinc-950/80 px-3 py-2 text-left text-base font-semibold leading-tight tracking-tight text-zinc-100 placeholder:text-zinc-600 sm:text-2xl"
                value={titleDraft}
                onChange={(e) => {
                  setTitleDraft(e.target.value)
                  setTitleErr(null)
                }}
                maxLength={120}
                autoFocus
                disabled={savingName}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onSave}
                  disabled={savingName}
                  className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-white disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitleDraft(props.roomName ?? 'Room')
                    setTitleEdit(false)
                    setTitleErr(null)
                  }}
                  className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-300"
                >
                  Cancel
                </button>
              </div>
              {titleErr ? <p className="text-xs text-rose-300">{titleErr}</p> : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setTitleEdit(true)
                setTitleErr(null)
              }}
              className="group/title flex w-full min-w-0 items-start gap-1.5 rounded-lg text-left transition hover:text-zinc-200"
              aria-label="Edit room name"
            >
              <h1 className="font-display min-w-0 flex-1 text-balance text-xl font-semibold leading-tight tracking-tight text-zinc-100 sm:text-3xl">
                {props.roomName ?? 'Room'}
              </h1>
              <Pencil className="mt-1.5 h-3.5 w-3.5 shrink-0 text-zinc-500 sm:mt-2" aria-hidden />
            </button>
          )}
          <p className="mt-1 truncate font-mono text-[0.65rem] text-zinc-500 sm:mt-1.5 sm:text-xs" title={props.roomId}>
            {props.roomId}
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/50 px-2.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900/80 sm:h-10 sm:gap-2 sm:rounded-xl sm:px-3 sm:text-sm"
            type="button"
            onClick={props.onTogglePeople}
            aria-expanded={props.peopleOpen}
            aria-controls="room-people-panel"
            title="People in this room"
          >
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            <span className="hidden min-[400px]:inline">People</span>
            {props.pendingCount && props.pendingCount > 0 ? (
              <span
                className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500/90 px-1.5 text-[0.65rem] font-semibold leading-none text-white"
                aria-label={`${props.pendingCount} pending join requests`}
              >
                {props.pendingCount}
              </span>
            ) : null}
          </button>
          <button
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/50 px-2.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900/80 sm:h-10 sm:gap-2 sm:rounded-xl sm:px-3 sm:text-sm"
            type="button"
            onClick={() => void onCopyLink()}
            title="Copy room URL"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400 sm:h-4 sm:w-4" aria-hidden />
            ) : (
              <Link2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            )}
            <span className="hidden min-[400px]:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/50 px-2.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900/80 sm:h-10 sm:gap-2 sm:rounded-xl sm:px-3 sm:text-sm"
            type="button"
            onClick={() => props.onLeaveRoom()}
            title="Leave and remove this room from your inbox"
          >
            <DoorOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            <span className="hidden min-[400px]:inline sm:inline">Leave</span>
          </button>
        </div>
      </div>

      <div className="mt-2 text-[0.65rem] text-zinc-500 sm:mt-3 sm:text-xs">
        <span className="text-zinc-400">{props.realtimeLabel}</span>
        <span className="mx-1.5 text-zinc-700" aria-hidden>
          ·
        </span>
        <span>{props.onlineCount} online</span>
      </div>
    </div>
  )
}

