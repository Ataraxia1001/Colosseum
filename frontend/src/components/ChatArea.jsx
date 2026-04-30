import './ChatArea.css'

export default function ChatArea({
  history,
  loading,
  error,
  bottomRef,
  providerColors,
  providerIcons,
}) {
  const providers = ['openai', 'anthropic', 'google']

  const titleForProvider = (provider) => {
    if (provider === 'anthropic') return 'Claude'
    if (provider === 'google') return 'Gemini'
    return 'OpenAI'
  }

  const findByProvider = (items, provider) =>
    (items || []).find((item) => item.provider === provider)

  const getLastAssistantIndex = () => {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (history[i].role === 'assistant') return i
    }
    return -1
  }

  const lastAssistantIndex = getLastAssistantIndex()

  const statusForPhase = (turn, provider, phase, isActiveTurn) => {
    const hasItem = phase === 'initial'
      ? !!findByProvider(turn.responses, provider)
      : !!findByProvider(turn.critiques, provider)

    if (hasItem) return 'Done'
    if (isActiveTurn && loading) return 'Running'
    return 'Pending'
  }

  return (
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
            <div className="assistant-turn-sections">
              <div className="section-header-row">
                <div className="section-title">Responses</div>
                <div className="status-badges-row">
                  {providers.map((provider) => {
                    const status = statusForPhase(turn, provider, 'initial', i === lastAssistantIndex)
                    return (
                      <span key={`initial-status-${provider}`} className={`status-badge ${status.toLowerCase()}`}>
                        {titleForProvider(provider)}: {status}
                      </span>
                    )
                  })}
                </div>
              </div>
              <div className="responses-row">
                {providers.map((provider) => {
                  const item = findByProvider(turn.responses, provider)
                  return (
                    <div className="response-card" key={`response-${provider}`}>
                      <div className="response-header" style={{ borderColor: providerColors[provider] }}>
                        <span className="provider-icon" style={{ color: providerColors[provider] }}>
                          {providerIcons[provider]}
                        </span>
                        <div className="provider-info">
                          <strong>{titleForProvider(provider)}</strong>
                          <span className="model-name">{item?.model || 'Waiting...'}</span>
                        </div>
                      </div>
                      <div className="response-body">
                        {!item ? (
                          <p className="pending-text">Waiting for initial response...</p>
                        ) : item.error ? (
                          <p className="error-text">{item.error}</p>
                        ) : (
                          <pre>{item.content}</pre>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="section-header-row">
                <div className="section-title">Critiques</div>
                <div className="status-badges-row">
                  {providers.map((provider) => {
                    const status = statusForPhase(turn, provider, 'critique', i === lastAssistantIndex)
                    return (
                      <span key={`critique-status-${provider}`} className={`status-badge ${status.toLowerCase()}`}>
                        {titleForProvider(provider)}: {status}
                      </span>
                    )
                  })}
                </div>
              </div>
              <div className="responses-row">
                {providers.map((provider) => {
                  const item = findByProvider(turn.critiques, provider)
                  return (
                    <div className="response-card" key={`critique-${provider}`}>
                      <div className="response-header" style={{ borderColor: providerColors[provider] }}>
                        <span className="provider-icon" style={{ color: providerColors[provider] }}>
                          {providerIcons[provider]}
                        </span>
                        <div className="provider-info">
                          <strong>{titleForProvider(provider)}</strong>
                          <span className="model-name">Critique</span>
                        </div>
                      </div>
                      <div className="response-body">
                        {!item ? (
                          <p className="pending-text">Waiting for critique...</p>
                        ) : item.error ? (
                          <p className="error-text">{item.error}</p>
                        ) : (
                          <pre>{item.content}</pre>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {(turn.evaluations?.length > 0) && (
                <>
                  <div className="section-title">Evaluations</div>
                  <div className="eval-grid">
                    {turn.evaluations.map((ev, idx) => (
                      <div className="eval-card" key={idx}>
                        <div className="eval-card-header">
                          <span className="eval-provider" style={{ color: providerColors[ev.provider] || 'var(--text-muted)' }}>
                            {ev.provider === 'pairwise'
                              ? `${(ev.contestants || []).map(titleForProvider).join(' vs ')}`
                              : titleForProvider(ev.provider)}
                          </span>
                          <span className="eval-component">{ev.component}</span>
                        </div>
                        {ev.error ? (
                          <p className="error-text">{ev.error}</p>
                        ) : ev.winner ? (
                          <p className="eval-winner">Winner: <strong>{titleForProvider(ev.winner)}</strong></p>
                        ) : (
                          <div className="eval-scores">
                            {Object.entries(ev.scores || {}).map(([metric, score]) => (
                              <div className="eval-score-row" key={metric}>
                                <span className="eval-metric">{metric}</span>
                                <span className="eval-score-bar-wrap">
                                  <span className="eval-score-bar" style={{ width: `${Math.min(score * 10, 100)}%` }} />
                                </span>
                                <span className="eval-score-val">{score.toFixed(1)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {turn.summary && (
                <div className="summary-panel">
                  <div className="summary-title">Summary</div>
                  {turn.summary.error ? (
                    <p className="error-text">{turn.summary.error}</p>
                  ) : (
                    <pre>{turn.summary.summary}</pre>
                  )}
                  <p className="summary-winner">
                    {turn.summary.is_tie ? 'Result: Tie' : `Winner: ${turn.summary.winner || 'N/A'}`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {loading && (
        <div className="turn assistant">
          <div className="responses-row">
            {['openai', 'anthropic', 'google'].map((p) => (
              <div className="response-card loading-card" key={p}>
                <div className="response-header" style={{ borderColor: providerColors[p] }}>
                  <span className="provider-icon" style={{ color: providerColors[p] }}>
                    {providerIcons[p]}
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
  )
}