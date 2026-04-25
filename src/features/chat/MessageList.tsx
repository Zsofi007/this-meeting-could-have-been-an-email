import { useCallback, useLayoutEffect, useEffect, useMemo, useRef, useState } from 'react'
import type { UiMessage } from '@/hooks/useOptimisticMessages'
import type { ReactionSummary } from '@/hooks/useReactions'
import { MessageItem } from '@/features/chat/MessageItem'

function getUserId(item: UiMessage) {
  return item.kind === 'db' ? item.message.user_id : item.userId
}

function getCreatedAt(item: UiMessage) {
  return item.kind === 'db' ? item.message.created_at : item.createdAt
}

export function MessageList(props: {
  items: UiMessage[]
  viewerUserId: string
  reactionsByMessageId: Map<string, ReactionSummary[]>
  onToggleReaction: (messageId: string, emoji: string, reactedByMe: boolean) => void
  onEditMessage: (messageId: string, nextText: string) => void
  onDeleteMessage: (messageId: string) => void
}) {
  const { items, viewerUserId } = props
  const scrollRootRef = useRef<HTMLDivElement | null>(null)
  const listInnerRef = useRef<HTMLDivElement | null>(null)
  const lastAt = items.at(-1) ? getCreatedAt(items.at(-1)!) : null
  const lastSenderId = items.at(-1) ? getUserId(items.at(-1)!) : null

  const didInitialScrollRef = useRef(false)
  const isNearBottomRef = useRef(true)
  const prevLastAtRef = useRef<string | null>(null)
  const prevCountRef = useRef(0)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)

  const rows = useMemo(() => {
    return items.map((item, idx) => {
      const prev = items[idx - 1]
      const showMeta = !prev || getUserId(prev) !== getUserId(item)
      const isMine = getUserId(item) === viewerUserId
      return { key: `${idx}:${getCreatedAt(item)}`, item, isMine, showMeta }
    })
  }, [items, viewerUserId])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const root = scrollRootRef.current
    if (!root) return
    const max = root.scrollHeight - root.clientHeight
    root.scrollTo({ top: max > 0 ? max : root.scrollHeight, left: 0, behavior })
  }, [])

  const updateNearBottom = useCallback(() => {
    const root = scrollRootRef.current
    if (!root) return
    const distanceFromBottom = root.scrollHeight - (root.scrollTop + root.clientHeight)
    // "Near bottom" controls auto-follow behavior.
    const nearBottomPx = 80
    const nearBottom = distanceFromBottom <= nearBottomPx
    isNearBottomRef.current = nearBottom

    // The jump button should only appear once the user is meaningfully away from the bottom.
    // Roughly: they've scrolled up at least 3/4 of a viewport.
    const showAfterPx = root.clientHeight * 0.75
    setShowJumpToLatest(distanceFromBottom > showAfterPx)
  }, [])

  useEffect(() => {
    const root = scrollRootRef.current
    if (!root) return
    updateNearBottom()
    root.addEventListener('scroll', updateNearBottom, { passive: true })
    return () => root.removeEventListener('scroll', updateNearBottom)
  }, [updateNearBottom])

  useLayoutEffect(() => {
    const nextCount = items.length
    const prevCount = prevCountRef.current
    const prevLastAt = prevLastAtRef.current
    const appended = nextCount > prevCount && prevCount > 0
    const isMine = lastSenderId != null && lastSenderId === viewerUserId

    // Only auto-scroll:
    // - on first room open (initial load), or
    // - when the user sent a new message, or
    // - when they're already near the bottom (i.e. "following along")
    const shouldScroll =
      !didInitialScrollRef.current ||
      (appended && isMine) ||
      (appended && isNearBottomRef.current) ||
      // also handle the first non-empty render after loading
      (prevLastAt == null && lastAt != null)

    if (!shouldScroll) {
      prevCountRef.current = nextCount
      prevLastAtRef.current = lastAt
      return
    }

    scrollToBottom('auto')
    const id = requestAnimationFrame(() => requestAnimationFrame(() => scrollToBottom('auto')))
    didInitialScrollRef.current = true
    prevCountRef.current = nextCount
    prevLastAtRef.current = lastAt
    return () => cancelAnimationFrame(id)
  }, [items.length, lastAt, lastSenderId, scrollToBottom, viewerUserId])

  useEffect(() => {
    const inner = listInnerRef.current
    if (!inner || rows.length === 0) return
    const ro = new ResizeObserver(() => {
      if (isNearBottomRef.current) scrollToBottom('auto')
    })
    ro.observe(inner)
    return () => ro.disconnect()
  }, [rows.length, scrollToBottom])

  return (
    <div
      ref={scrollRootRef}
      className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-0.5 py-1 sm:px-1 sm:py-2"
    >
      {rows.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/20 p-6 text-sm text-zinc-400 sm:p-8">
          No messages yet. Say something first.
        </div>
      ) : (
        <div ref={listInnerRef} className="space-y-3 sm:space-y-4">
          {rows.map((r) => {
            const messageId = r.item.kind === 'db' ? r.item.message.id : null
            const reactions = messageId ? props.reactionsByMessageId.get(messageId) ?? [] : []
            return (
              <MessageItem
                key={r.key}
                item={r.item}
                isMine={r.isMine}
                showMeta={r.showMeta}
                reactions={reactions}
                onToggleReaction={(emoji, reactedByMe) => {
                  if (!messageId) return
                  props.onToggleReaction(messageId, emoji, reactedByMe)
                }}
                onEdit={
                  messageId && r.isMine ? (nextText) => props.onEditMessage(messageId, nextText) : undefined
                }
                onDelete={messageId && r.isMine ? () => props.onDeleteMessage(messageId) : undefined}
              />
            )
          })}
          <div className="h-0 w-full shrink-0" aria-hidden />
        </div>
      )}

      {rows.length > 0 && showJumpToLatest ? (
        <div className="pointer-events-none sticky bottom-2 z-10 flex justify-center px-2">
          <button
            type="button"
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-zinc-700/80 bg-zinc-950/80 px-3 py-2 text-xs font-medium text-zinc-100 shadow-sm shadow-black/30 backdrop-blur transition hover:border-zinc-500 hover:bg-zinc-900/80"
            onClick={() => {
              scrollToBottom('smooth')
              setShowJumpToLatest(false)
            }}
          >
            Scroll to latest
          </button>
        </div>
      ) : null}
    </div>
  )
}
