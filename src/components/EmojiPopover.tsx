import { Suspense, lazy, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { EmojiClickData, Theme as EmojiTheme } from 'emoji-picker-react'

const EmojiPicker = lazy(() => import('emoji-picker-react'))

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function EmojiPopover(props: {
  anchorRect: DOMRect
  onPick: (emoji: string) => void
  onClose: () => void
}) {
  const { anchorRect, onPick, onClose } = props
  const [theme, setTheme] = useState<EmojiTheme | undefined>(undefined)

  useEffect(() => {
    let alive = true
    import('emoji-picker-react')
      .then((mod) => {
        if (alive) setTheme(mod.Theme.DARK as EmojiTheme)
      })
      .catch(() => {
        // If it fails, picker still renders with its default theme.
        if (alive) setTheme(undefined)
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = 360
  const h = 420

  const preferredLeft = anchorRect.right - w
  const left = clamp(preferredLeft, 12, vw - w - 12)

  const belowTop = anchorRect.bottom + 10
  const aboveTop = anchorRect.top - h - 10
  const top = clamp(aboveTop >= 12 ? aboveTop : belowTop, 12, vh - h - 12)

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close emoji picker"
        className="fixed inset-0 z-40 cursor-default bg-transparent"
        onClick={onClose}
      />
      <div
        className="fixed z-50 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        style={{ left, top, width: w, height: h }}
      >
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
              Loading…
            </div>
          }
        >
          <EmojiPicker
            theme={theme ?? undefined}
            width="100%"
            height="100%"
            onEmojiClick={(e: EmojiClickData) => onPick(e.emoji)}
          />
        </Suspense>
      </div>
    </>,
    document.body,
  )
}

