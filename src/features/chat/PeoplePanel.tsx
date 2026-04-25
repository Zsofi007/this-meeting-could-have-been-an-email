export type PeopleRow = { userId: string; username: string; online: boolean }

export function PeoplePanel(props: {
  open: boolean
  onlineCount: number
  people: PeopleRow[]
  pending?: { userId: string; username: string }[]
  onApprove?: (userId: string) => void
  onReject?: (userId: string) => void
  error: string | null
  onClose: () => void
}) {
  if (!props.open) return null

  return (
    <div
      id="room-people-panel"
      className="shrink-0 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3 sm:rounded-2xl sm:p-4"
      role="region"
      aria-label="Room people"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">People</div>
          <div className="mt-0.5 text-sm text-zinc-300">
            {props.onlineCount} online · {Math.max(props.people.length - props.onlineCount, 0)} offline
          </div>
        </div>
        <button
          type="button"
          className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-600 hover:bg-zinc-900/60"
          onClick={props.onClose}
        >
          Close
        </button>
      </div>

      {props.error ? <div className="mt-2 text-xs text-rose-300">{props.error}</div> : null}

      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2" role="list">
        {props.people.map((p) => (
          <li key={p.userId} className="flex items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-950/30 px-2.5 py-2">
            <span
              className={p.online ? 'h-2 w-2 rounded-full bg-emerald-400' : 'h-2 w-2 rounded-full bg-zinc-600'}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{p.username}</span>
            <span className={p.online ? 'text-xs text-emerald-300' : 'text-xs text-zinc-500'}>
              {p.online ? 'Online' : 'Offline'}
            </span>
          </li>
        ))}
      </ul>

      {props.pending && props.pending.length > 0 ? (
        <div className="mt-4 border-t border-zinc-800/70 pt-4">
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">Join requests</div>
          <ul className="mt-2 space-y-2" role="list">
            {props.pending.map((r) => (
              <li
                key={r.userId}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/60 bg-zinc-950/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-zinc-200">{r.username}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {props.onReject ? (
                    <button
                      type="button"
                      onClick={() => props.onReject?.(r.userId)}
                      className="rounded-lg border border-zinc-700 bg-zinc-950/40 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900/60"
                    >
                      Reject
                    </button>
                  ) : null}
                  {props.onApprove ? (
                    <button
                      type="button"
                      onClick={() => props.onApprove?.(r.userId)}
                      className="rounded-lg bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-white"
                    >
                      Approve
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

