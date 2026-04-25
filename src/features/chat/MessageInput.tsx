import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SendHorizonal } from 'lucide-react'

export function MessageInput(props: {
  disabled: boolean
  coolingDown: boolean
  onSend: (text: string) => Promise<void> | void
  onTyping?: () => void
}) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const trimmed = useMemo(() => value.trim(), [value])
  const canSend = !props.disabled && trimmed.length > 0

  const sendNow = useCallback(() => {
    if (!canSend) return
    const text = trimmed
    setValue('')
    props.onSend(text)
  }, [canSend, props, trimmed])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0px'

    const styles = window.getComputedStyle(el)
    const lineHeight = Number.parseFloat(styles.lineHeight || '0') || 20
    const paddingTop = Number.parseFloat(styles.paddingTop || '0') || 0
    const paddingBottom = Number.parseFloat(styles.paddingBottom || '0') || 0
    const maxHeight = lineHeight * 4 + paddingTop + paddingBottom

    const next = Math.min(el.scrollHeight, maxHeight)
    el.style.height = `${next}px`
  }, [value])

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-2 sm:rounded-2xl sm:p-3">
      <div className="flex items-end gap-2 sm:gap-3">
        <textarea
          ref={textareaRef}
          className="min-h-10 w-full resize-none rounded-lg bg-zinc-950/40 px-2.5 py-2 text-sm leading-relaxed text-zinc-100 outline-none ring-1 ring-transparent placeholder:text-zinc-500 focus:ring-zinc-700 sm:min-h-[44px] sm:rounded-xl sm:px-3 sm:pt-2.5 sm:pb-2.5"
          placeholder="Message…"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            props.onTyping?.()
          }}
          disabled={props.disabled}
          style={{ maxHeight: '7.5rem', overflowY: 'auto' }}
          rows={1}
        />
        <button
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-zinc-50 px-3 text-xs font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 sm:h-11 sm:gap-2 sm:rounded-xl sm:px-4 sm:text-sm"
          type="button"
          onClick={sendNow}
          disabled={!canSend || props.coolingDown}
        >
          <SendHorizonal className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden min-[360px]:inline sm:inline">Send</span>
        </button>
      </div>
      {props.coolingDown ? (
        <div className="mt-1.5 text-[0.65rem] text-zinc-500 sm:mt-2 sm:text-xs">Cooling down…</div>
      ) : null}
    </div>
  )
}

