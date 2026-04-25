import { useCallback, useEffect, useMemo, useState } from 'react'
import { nanoid } from 'nanoid'
import { useMessagesQuery } from '@/hooks/useMessagesQuery'
import { useMessagesSubscription } from '@/hooks/useMessagesSubscription'
import { useOptimisticMessages } from '@/hooks/useOptimisticMessages'
import { useRateLimiter } from '@/hooks/useRateLimiter'
import { sendMessage, type DbMessage } from '@/services/chatService'
import { clearRoomDismissal } from '@/services/roomService'

export function useMessages(options: { roomId: string; userId: string; username: string }) {
  const { messages: initial, error } = useMessagesQuery(options.roomId)
  const optimistic = useOptimisticMessages()
  const { reconcileWithDb, replaceAllDb } = optimistic
  const limiter = useRateLimiter({ cooldownMs: 1000 })
  const [realtime, setRealtime] = useState<'connecting' | 'connected' | 'closed'>('connecting')

  const onDbMessage = useCallback(
    (m: DbMessage) => reconcileWithDb(m),
    [reconcileWithDb],
  )

  const onStatus = useCallback((s: 'subscribed' | 'closed' | 'error') => {
    setRealtime((prev) => {
      const next = s === 'subscribed' ? 'connected' : 'closed'
      return prev === next ? prev : next
    })
  }, [])

  useMessagesSubscription({
    roomId: options.roomId,
    onMessage: onDbMessage,
    onStatus,
  })

  const merged = useMemo(() => {
    const items = [...optimistic.items]
    return items.sort((a, b) => {
      const aAt = a.kind === 'db' ? a.message.created_at : a.createdAt
      const bAt = b.kind === 'db' ? b.message.created_at : b.createdAt
      return aAt.localeCompare(bAt)
    })
  }, [optimistic.items])

  useEffect(() => {
    if (!initial) return
    if (initial.length > 0 && !initial.every((m) => m.room_id === options.roomId)) return
    replaceAllDb(initial)
  }, [initial, options.roomId, replaceAllDb])

  const onSend = useCallback(
    async (text: string) => {
      if (!limiter.canSend()) return
      const clientId = nanoid(12)
      const createdAt = new Date().toISOString()

      optimistic.addOptimistic({
        kind: 'ui',
        clientId,
        roomId: options.roomId,
        userId: options.userId,
        username: options.username,
        text,
        createdAt,
        status: 'sending',
      })

      limiter.markSent()

      try {
        const saved = await sendMessage({
          roomId: options.roomId,
          userId: options.userId,
          username: options.username,
          text,
          clientId,
        })
        optimistic.reconcileWithDb(saved)
        optimistic.markSent(clientId)
        void clearRoomDismissal(options.roomId).catch(() => undefined)
      } catch {
        optimistic.markFailed(clientId)
      }
    },
    [limiter, optimistic, options.roomId, options.userId, options.username],
  )

  return {
    error,
    realtime,
    messages: merged,
    coolingDown: limiter.coolingDown,
    send: onSend,
    upsertDb: reconcileWithDb,
  }
}

