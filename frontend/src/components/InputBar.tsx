import { useRef } from 'react'
import type { Dispatch, KeyboardEvent, SetStateAction } from 'react'
import './InputBar.css'

interface InputBarProps {
  input: string
  setInput: Dispatch<SetStateAction<string>>
  onSubmit: () => void | Promise<void>
  loading: boolean
}

export default function InputBar({
  input,
  setInput,
  onSubmit,
  loading,
}: InputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void onSubmit()
    }
  }

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  return (
    <div className="input-bar">
      <div className="input-wrapper">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => {
            setInput(event.target.value)
            autoResize(event.target)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Send a message… (Enter to send, Shift+Enter for newline)"
          rows={1}
        />
        <button
          className="send-btn"
          onClick={() => {
            void onSubmit()
          }}
          disabled={loading || !input.trim()}
          title="Send"
          aria-label="Send"
        >
          <span className="send-btn-icon" aria-hidden="true">
            ⚔
          </span>
        </button>
      </div>
      <p className="input-hint">Responses from OpenAI · Anthropic · Google</p>
    </div>
  )
}
