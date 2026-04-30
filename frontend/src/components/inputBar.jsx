import { useRef } from 'react'
import './InputBar.css'

export default function InputBar({ input, setInput, onSubmit, loading }) {
  const textareaRef = useRef(null)

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  const autoResize = (e) => {
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  return (
    <div className="input-bar">
      <div className="input-wrapper">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); autoResize(e) }}
          onKeyDown={handleKeyDown}
          placeholder="Send a message… (Enter to send, Shift+Enter for newline)"
          rows={1}
        />
        <button
          className="send-btn"
          onClick={onSubmit}
          disabled={loading || !input.trim()}
          title="Send"
          aria-label="Send"
        >
          <span className="send-btn-icon" aria-hidden="true">⚔</span>
        </button>
      </div>
      <p className="input-hint">Responses from OpenAI · Anthropic · Google</p>
    </div>
  )
}