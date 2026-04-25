import { useCallback, useMemo, useState } from 'react'
import type { DbMessage } from '@/services/chatService'

export type MessageStatus = 'sending' | 'failed' | 'sent'

export type UiMessage = {
  kind: 'ui'
  clientId: string
  roomId: string
  userId: string
  username: string
  text: string
  createdAt: string
  status: MessageStatus
} | {
  kind: 'db'
  message: DbMessage
}

function dbKey(m: DbMessage) {
  return `db:${m.id}`
}

function uiKey(clientId: string) {
  return `ui:${clientId}`
}

export function useOptimisticMessages() {
  const [optimistic, setOptimistic] = useState<Map<string, UiMessage>>(() => new Map())

  const addOptimistic = useCallback((m: Extract<UiMessage, { kind: 'ui' }>) => {
    setOptimistic((prev) => new Map(prev).set(uiKey(m.clientId), m))
  }, [])

  const markFailed = useCallback((clientId: string) => {
    setOptimistic((prev) => {
      const next = new Map(prev)
      const key = uiKey(clientId)
      const current = next.get(key)
      if (current?.kind === 'ui') next.set(key, { ...current, status: 'failed' })
      return next
    })
  }, [])

  const markSent = useCallback((clientId: string) => {
    setOptimistic((prev) => {
      const next = new Map(prev)
      const key = uiKey(clientId)
      const current = next.get(key)
      if (current?.kind === 'ui') next.set(key, { ...current, status: 'sent' })
      return next
    })
  }, [])

  const reconcileWithDb = useCallback((m: DbMessage) => {
    setOptimistic((prev) => {
      const next = new Map(prev)
      if (m.client_id) next.delete(uiKey(m.client_id))
      next.set(dbKey(m), { kind: 'db', message: m })
      return next
    })
  }, [])

  const replaceAllDb = useCallback((messages: DbMessage[]) => {
    setOptimistic((prev) => {
      const next = new Map(prev)
      for (const m of messages) next.set(dbKey(m), { kind: 'db', message: m })
      return next
    })
  }, [])

  const items = useMemo(() => Array.from(optimistic.values()), [optimistic])

  return { items, addOptimistic, markFailed, markSent, reconcileWithDb, replaceAllDb }
}

