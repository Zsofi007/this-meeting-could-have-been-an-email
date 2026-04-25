import { useEffect, useState } from 'react'
import { fetchRecentMessages, type DbMessage } from '@/services/chatService'

export function useMessagesQuery(roomId: string) {
  const [messages, setMessages] = useState<DbMessage[] | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let active = true
    setMessages(null)
    setError(null)

    fetchRecentMessages(roomId)
      .then((data) => {
        if (!active) return
        setMessages(data)
      })
      .catch((e: unknown) => {
        if (!active) return
        setError(e instanceof Error ? e : new Error('Failed to load messages'))
      })

    return () => {
      active = false
    }
  }, [roomId])

  return { messages, error }
}

