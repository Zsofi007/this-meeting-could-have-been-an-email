import { useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/services/supabaseClient'
import { addReaction, fetchReactions, removeReaction, type DbReaction } from '@/services/reactionService'

export type ReactionSummary = { emoji: string; count: number; reactedByMe: boolean }

function summarize(reactions: DbReaction[], viewerUserId: string) {
  const byEmoji = new Map<string, { count: number; reactedByMe: boolean }>()
  for (const r of reactions) {
    const cur = byEmoji.get(r.emoji) ?? { count: 0, reactedByMe: false }
    byEmoji.set(r.emoji, {
      count: cur.count + 1,
      reactedByMe: cur.reactedByMe || r.user_id === viewerUserId,
    })
  }
  return Array.from(byEmoji.entries()).map(([emoji, v]) => ({ emoji, ...v }))
}

function sameRow(a: DbReaction, b: DbReaction) {
  return a.message_id === b.message_id && a.user_id === b.user_id && a.emoji === b.emoji
}

export function useReactions(options: { messageIds: string[]; viewerUserId: string }) {
  const [rows, setRows] = useState<DbReaction[]>([])
  const idsKey = useMemo(() => options.messageIds.join(','), [options.messageIds])
  const ids = useMemo(() => (idsKey ? idsKey.split(',') : []), [idsKey])
  const allowedMessageIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    allowedMessageIds.current = new Set(options.messageIds)
  }, [options.messageIds])

  useEffect(() => {
    let active = true
    fetchReactions(ids)
      .then((data) => {
        if (!active) return
        setRows(data)
      })
      .catch(() => {
        if (!active) return
        setRows([])
      })
    return () => {
      active = false
    }
  }, [ids])

  useEffect(() => {
    if (ids.length === 0) return
    let active = true
    let channel: RealtimeChannel | null = null

    // Do not use `message_id=in.(...)` in the filter: UUIDs contain hyphens and the
    // Realtime filter can parse them incorrectly. RLS still limits which rows you can
    // read; we only merge rows for messages in this room (allowedMessageIds).
    const onInsert = (p: { new: Record<string, unknown> }) => {
      if (!active) return
      const row = p.new as DbReaction
      if (!allowedMessageIds.current.has(row.message_id)) return
      setRows((prev) => {
        if (prev.some((r) => sameRow(r, row))) return prev
        return [...prev, row]
      })
    }

    const onDelete = (p: { old: Record<string, unknown> }) => {
      if (!active) return
      const old = p.old as Partial<DbReaction>
      if (old.message_id == null || old.user_id == null || old.emoji == null) return
      if (!allowedMessageIds.current.has(String(old.message_id))) return
      setRows((prev) =>
        prev.filter(
          (r) => !(r.message_id === old.message_id && r.user_id === old.user_id && r.emoji === old.emoji),
        ),
      )
    }

    channel = supabase
      .channel(`reactions:${idsKey}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reactions' },
        (payload) => onInsert({ new: payload.new as Record<string, unknown> }),
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'message_reactions' },
        (payload) => onDelete({ old: payload.old as Record<string, unknown> }),
      )
      .subscribe()

    return () => {
      active = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [ids.length, idsKey])

  const byMessageId = useMemo(() => {
    const map = new Map<string, ReactionSummary[]>()
    for (const id of ids) map.set(id, [])
    const grouped = new Map<string, DbReaction[]>()
    for (const r of rows) grouped.set(r.message_id, [...(grouped.get(r.message_id) ?? []), r])
    for (const [id, list] of grouped.entries()) map.set(id, summarize(list, options.viewerUserId))
    return map
  }, [ids, options.viewerUserId, rows])

  return {
    byMessageId,
    toggle: async (messageId: string, emoji: string, reactedByMe: boolean) => {
      const localRow: DbReaction = {
        message_id: messageId,
        user_id: options.viewerUserId,
        emoji,
        created_at: new Date().toISOString(),
      }

      if (reactedByMe) {
        setRows((prev) =>
          prev.filter(
            (r) =>
              !(
                r.message_id === messageId &&
                r.user_id === options.viewerUserId &&
                r.emoji === emoji
              ),
          ),
        )
        try {
          await removeReaction({ messageId, userId: options.viewerUserId, emoji })
        } catch {
          setRows((prev) => [...prev, localRow])
        }
        return
      }

      setRows((prev) => {
        const cleared = prev.filter(
          (r) => !(r.message_id === messageId && r.user_id === options.viewerUserId),
        )
        return [...cleared, localRow]
      })
      try {
        await addReaction({ messageId, userId: options.viewerUserId, emoji })
      } catch {
        setRows((prev) =>
          prev.filter(
            (r) =>
              !(
                r.message_id === messageId &&
                r.user_id === options.viewerUserId &&
                r.emoji === emoji
              ),
          ),
        )
      }
    },
  }
}
