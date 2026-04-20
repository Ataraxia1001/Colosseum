import { useState, useRef, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const PROVIDER_ICONS = {
  openai: '✦',
  anthropic: '◆',
  google: '●',
}

const PROVIDER_COLORS = {
  openai: '#10a37f',
  anthropic: '#d4a574',
  google: '#4285f4',
}

export default function App() {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, loading])

  const handleSubmit = async (e) => {
    e?.preventDefault()
    const msg = input.trim()
    if (!msg || loading) return

    setLoading(true)
    setError('')
    setInput('')
    setHistory(prev => [...prev, { role: 'user', content: msg }])

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Request failed.')
      }

      const data = await res.json()
      const responses = data.responses || []
      const critiques = data.critiques || []
      const responsesWithCritiques = responses.map(r => {
        const critique = critiques.find(c => c.provider === r.provider)
        return critique ? { ...r, critique: critique.content } : r
      })
      setHistory(prev => [...prev, { role: 'assistant', responses: responsesWithCritiques }])
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const autoResize = (e) => {
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-logo">
            <span className="logo-icon">⚔</span>
            <span className="logo-text">Colosseum</span>
          </div>
          <button className="new-chat-btn" onClick={() => { setHistory([]); setError('') }}>
            <span>+</span> New Chat
          </button>
        </div>
        <div className="sidebar-models">
          <p className="sidebar-label">Active Models</p>
          {['openai', 'anthropic', 'google'].map(p => (
            <div key={p} className="model-pill">
              <span className="model-dot" style={{ background: PROVIDER_COLORS[p] }} />
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <div className="chat-area">
          {history.length === 0 && !loading && (
            <div className="empty-state">
              <div className="empty-icon">⚔</div>
              <h2>Colosseum</h2>
              <p>Send a message to compare OpenAI, Claude, and Gemini side by side.</p>
            </div>
          )}

          {history.map((turn, i) => (
            <div key={i} className={`turn ${turn.role}`}>
              {turn.role === 'user' ? (
                <div className="user-bubble">
                  <span className="turn-avatar user-avatar">You</span>
                  <div className="user-content">{turn.content}</div>
                </div>
              ) : (
                <div className="responses-row">
                  {turn.responses.map(item => (
                    <div className="response-card" key={item.provider}>
                      <div className="response-header" style={{ borderColor: PROVIDER_COLORS[item.provider] }}>
                        <span className="provider-icon" style={{ color: PROVIDER_COLORS[item.provider] }}>
                          {PROVIDER_ICONS[item.provider]}
                        </span>
                        <div className="provider-info">
                          <strong>{item.provider.charAt(0).toUpperCase() + item.provider.slice(1)}</strong>
                          <span className="model-name">{item.model}</span>
                        </div>
                      </div>
                      <div className="response-body">
                        {item.error
                          ? <p className="error-text">{item.error}</p>
                          : <pre>{item.content}</pre>
                        }
                        {item.critique && (
                          <>
                            <hr style={{ margin: '12px 0', opacity: 0.4 }} />
                            <div className="critique-section">
                              <strong className="critique-label">Critique:</strong>
                              <pre>{item.critique}</pre>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="turn assistant">
              <div className="responses-row">
                {['openai', 'anthropic', 'google'].map(p => (
                  <div className="response-card loading-card" key={p}>
                    <div className="response-header" style={{ borderColor: PROVIDER_COLORS[p] }}>
                      <span className="provider-icon" style={{ color: PROVIDER_COLORS[p] }}>
                        {PROVIDER_ICONS[p]}
                      </span>
                      <div className="provider-info">
                        <strong>{p.charAt(0).toUpperCase() + p.slice(1)}</strong>
                      </div>
                    </div>
                    <div className="response-body">
                      <div className="typing-dots"><span /><span /><span /></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div className="error-banner">{error}</div>}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
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
              onClick={handleSubmit}
              disabled={loading || !input.trim()}
              title="Send"
            >
              Send
            </button>
          </div>
          <p className="input-hint">Responses from OpenAI · Anthropic · Google</p>
        </div>
      </main>
    </div>
  )
}
