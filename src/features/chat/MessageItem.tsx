import { clsx } from 'clsx'
import type { UiMessage } from '@/hooks/useOptimisticMessages'
import type { ReactionSummary } from '@/hooks/useReactions'
import { MessageBubble } from '@/features/chat/MessageBubble'
import { ReactionBar } from '@/features/chat/ReactionBar'

export function MessageItem(props: {
  item: UiMessage
  isMine: boolean
  showMeta: boolean
  reactions: ReactionSummary[]
  onToggleReaction: (emoji: string, reactedByMe: boolean) => void
  onEdit?: (nextText: string) => void
  onDelete?: () => void
}) {
  const { item, isMine, showMeta } = props
  const text = item.kind === 'db' ? item.message.text : item.text
  const canEdit = isMine && item.kind === 'db' && !item.message.deleted_at
  const canReact = item.kind === 'db' && !item.message.deleted_at
  const edited = item.kind === 'db' && Boolean(item.message.updated_at)
  const status = item.kind === 'ui' ? item.status : 'sent'
  const deleted = item.kind === 'db' && Boolean(item.message.deleted_at)

  return (
    <div className={clsx('flex gap-3', isMine ? 'justify-end' : 'justify-start')}>
      <div className={clsx('max-w-[80%] md:max-w-[70%]', isMine ? 'text-right' : 'text-left')}>
        {showMeta ? (
          <div className={clsx('mb-1 text-xs text-zinc-400', isMine && 'text-zinc-500')}>
            {item.kind === 'db' ? item.message.username : item.username}
          </div>
        ) : null}

        <MessageBubble
          mine={isMine}
          text={text}
          deleted={deleted}
          canReact={canReact}
          canEdit={canEdit}
          onPickEmoji={(emoji) => props.onToggleReaction(emoji, false)}
          onEdit={props.onEdit}
          onDelete={props.onDelete}
        />

        {item.kind === 'db' ? (
          <ReactionBar
            reactions={props.reactions}
            onToggle={(emoji, reactedByMe) => props.onToggleReaction(emoji, reactedByMe)}
          />
        ) : null}

        {item.kind === 'ui' && status !== 'sent' ? (
          <div className="mt-1 text-xs text-zinc-500">
            {status === 'sending' ? 'Sending…' : 'Failed to send'}
          </div>
        ) : null}

        {item.kind === 'db' && !deleted && edited ? (
          <div className={clsx('mt-1 text-xs text-zinc-500', isMine && 'text-zinc-600')}>Edited</div>
        ) : null}
      </div>
    </div>
  )
}

