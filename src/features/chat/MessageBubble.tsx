import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { Copy, Pencil, SmilePlus, Trash2 } from 'lucide-react'
import { EmojiPopover } from '@/components/EmojiPopover'

const LP_MS = 480
const MOVE_PX = 12

export function MessageBubble(props: {
  mine: boolean
  text: string
  deleted: boolean
  canReact: boolean
  canEdit: boolean
  onPickEmoji: (emoji: string) => void
  onEdit?: (nextText: string) => void
  onDelete?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(props.text)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isNarrow, setIsNarrow] = useState(
    () => (typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false),
  )
  const reactionButtonRef = useRef<HTMLButtonElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressOrigin = useRef<{ x: number; y: number } | null>(null)

  const canCopy = !props.deleted && !editing
  const showActionStrip = (props.canReact || props.canEdit || canCopy) && !editing

  useEffect(() => {
    if (editing) setMobileActionsOpen(false)
  }, [editing])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => {
      setIsNarrow(mq.matches)
      if (mq.matches === false) setMobileActionsOpen(false)
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!mobileActionsOpen) return
    const onDoc = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMobileActionsOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileActionsOpen(false)
    }
    document.addEventListener('pointerdown', onDoc, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [mobileActionsOpen])

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    longPressOrigin.current = null
  }

  const onBubblePointerDown = (e: React.PointerEvent) => {
    if (editing) return
    if (e.pointerType !== 'touch' || !isNarrow) return
    if (!(canCopy || props.canReact || props.canEdit)) return
    clearLongPress()
    longPressOrigin.current = { x: e.clientX, y: e.clientY }
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null
      longPressOrigin.current = null
      setMobileActionsOpen(true)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(12)
    }, LP_MS)
  }

  const onBubblePointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || !longPressOrigin.current) return
    const o = longPressOrigin.current
    if (Math.abs(e.clientX - o.x) > MOVE_PX || Math.abs(e.clientY - o.y) > MOVE_PX) clearLongPress()
  }

  const copyMessage = () => {
    if (!canCopy) return
    void navigator.clipboard.writeText(props.text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const body = props.deleted ? 'Message deleted' : props.text

  return (
    <div className="group flex flex-col gap-1" ref={rootRef}>
      <div
        className={clsx(
          'min-w-0 touch-manipulation break-words rounded-2xl border px-4 py-3 text-sm leading-relaxed [overflow-wrap:anywhere]',
          isNarrow && !editing && 'max-md:select-none',
          props.deleted && 'opacity-70',
          props.mine ? 'border-zinc-800 bg-zinc-50 text-zinc-950' : 'border-zinc-800 bg-zinc-900/60 text-zinc-50',
        )}
        onPointerDown={!editing ? onBubblePointerDown : undefined}
        onPointerUp={!editing ? () => clearLongPress() : undefined}
        onPointerCancel={!editing ? () => clearLongPress() : undefined}
        onPointerMove={!editing ? onBubblePointerMove : undefined}
      >
        {editing ? (
          <div className="space-y-2">
            <textarea
              className="w-full resize-none rounded-xl bg-white/70 px-3 py-2 text-sm text-zinc-950 outline-none ring-1 ring-zinc-300 focus:ring-zinc-500"
              value={draft}
              onChange={(ev) => setDraft(ev.target.value)}
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <button
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-zinc-900"
                type="button"
                onClick={() => {
                  setDraft(props.text)
                  setEditing(false)
                }}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-zinc-950 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                type="button"
                onClick={() => {
                  props.onEdit?.(draft.trim())
                  setEditing(false)
                }}
                disabled={draft.trim().length === 0}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <span className="block min-w-0 whitespace-pre-wrap max-md:select-none">{body}</span>
        )}
      </div>

      {showActionStrip ? (
        <div
          className={clsx(
            'flex flex-wrap items-center gap-1.5 pl-0.5 transition-all duration-200',
            props.mine ? 'justify-end' : 'justify-start',
            isNarrow &&
              (mobileActionsOpen
                ? 'max-h-40 py-0.5 opacity-100'
                : 'max-h-0 overflow-hidden py-0 opacity-0 pointer-events-none'),
            !isNarrow &&
              'max-h-0 overflow-hidden py-0 opacity-0 pointer-events-none md:group-hover:max-h-40 md:group-hover:py-0.5 md:group-hover:opacity-100 md:group-hover:pointer-events-auto',
          )}
        >
          {props.canReact ? (
            <button
              className="inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 text-xs text-zinc-200 hover:bg-zinc-900 sm:min-w-0"
              type="button"
              ref={reactionButtonRef}
              onClick={() => {
                setMobileActionsOpen(false)
                const rect = reactionButtonRef.current?.getBoundingClientRect()
                if (!rect) return
                setAnchorRect(rect)
              }}
              aria-label="Add reaction"
            >
              <SmilePlus className="h-4 w-4 shrink-0" />
              <span className="hidden min-[400px]:inline sm:inline">React</span>
            </button>
          ) : null}
          {canCopy ? (
            <button
              className="inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 text-xs text-zinc-200 hover:bg-zinc-900"
              type="button"
              onClick={() => {
                setMobileActionsOpen(false)
                copyMessage()
              }}
              aria-label="Copy message"
            >
              <Copy className="h-3.5 w-3.5 shrink-0" />
              {copied ? <span className="text-emerald-300">Copied</span> : <span className="max-md:sr-only">Copy</span>}
            </button>
          ) : null}
          {props.canEdit ? (
            <button
              className="inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 text-xs text-zinc-200 hover:bg-zinc-900"
              type="button"
              onClick={() => {
                setMobileActionsOpen(false)
                setEditing(true)
              }}
              aria-label="Edit message"
            >
              <Pencil className="h-3.5 w-3.5 shrink-0" />
              <span className="max-md:sr-only">Edit</span>
            </button>
          ) : null}
          {props.canEdit ? (
            <button
              className="inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg border border-rose-900/40 bg-rose-950/30 px-2 text-xs text-rose-200 hover:bg-rose-950/50"
              type="button"
              onClick={() => {
                setMobileActionsOpen(false)
                props.onDelete?.()
              }}
              aria-label="Delete message"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              <span className="max-md:sr-only">Delete</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {anchorRect ? (
        <EmojiPopover
          anchorRect={anchorRect}
          onClose={() => setAnchorRect(null)}
          onPick={(emoji) => {
            setAnchorRect(null)
            setMobileActionsOpen(false)
            props.onPickEmoji(emoji)
          }}
        />
      ) : null}
    </div>
  )
}
