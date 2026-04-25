import { clsx } from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import type { ReactionSummary } from '@/hooks/useReactions'

export function ReactionBar(props: {
  reactions: ReactionSummary[]
  onToggle: (emoji: string, reactedByMe: boolean) => void
}) {
  const reduceMotion = useReducedMotion()

  if (props.reactions.length === 0) return null

  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 sm:mt-1">
      {props.reactions.map((r) => (
        <motion.button
          key={r.emoji}
          layout
          type="button"
          className={clsx(
            'inline-flex origin-center items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs will-change-transform',
            r.reactedByMe
              ? 'border-zinc-700 bg-zinc-200/90 text-zinc-950'
              : 'border-zinc-800 bg-zinc-950/20 text-zinc-200',
          )}
          initial={reduceMotion ? { scale: 1, opacity: 1, y: 0 } : { scale: 0.45, opacity: 0.25, y: 4 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 520, damping: 19, mass: 0.45 }
          }
          whileHover={reduceMotion ? undefined : { scale: 1.04 }}
          whileTap={reduceMotion ? undefined : { scale: 0.92 }}
          onClick={() => props.onToggle(r.emoji, r.reactedByMe)}
        >
          <span aria-hidden="true" className="inline-block text-lg leading-none sm:text-xl">
            {r.emoji}
          </span>
          <span className="translate-y-px text-[0.7rem] font-medium tabular-nums sm:text-xs">{r.count}</span>
        </motion.button>
      ))}
    </div>
  )
}

