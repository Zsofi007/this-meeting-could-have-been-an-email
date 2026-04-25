import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function EmojiPopover(props: {
  anchorRect: DOMRect
  onPick: (emoji: string) => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [props])

  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = 360
  const h = 420

  const preferredLeft = props.anchorRect.right - w
  const left = clamp(preferredLeft, 12, vw - w - 12)

  const belowTop = props.anchorRect.bottom + 10
  const aboveTop = props.anchorRect.top - h - 10
  const top = clamp(aboveTop >= 12 ? aboveTop : belowTop, 12, vh - h - 12)

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close emoji picker"
        className="fixed inset-0 z-40 cursor-default bg-transparent"
        onClick={props.onClose}
      />
      <div
        className="fixed z-50 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        style={{ left, top, width: w, height: h }}
      >
        <EmojiPicker
          theme={Theme.DARK}
          width="100%"
          height="100%"
          onEmojiClick={(e: EmojiClickData) => props.onPick(e.emoji)}
        />
      </div>
    </>,
    document.body,
  )
}

