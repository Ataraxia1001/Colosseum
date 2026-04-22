export default function ChatArea({
  history,
  loading,
  error,
  bottomRef,
  providerColors,
  providerIcons,
}) {
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
            <div className="responses-row">
              {turn.responses.map((item) => (
                <div className="response-card" key={item.provider}>
                  <div className="response-header" style={{ borderColor: providerColors[item.provider] }}>
                    <span className="provider-icon" style={{ color: providerColors[item.provider] }}>
                      {providerIcons[item.provider]}
                    </span>
                    <div className="provider-info">
                      <strong>{item.provider.charAt(0).toUpperCase() + item.provider.slice(1)}</strong>
                      <span className="model-name">{item.model}</span>
                    </div>
                  </div>
                  <div className="response-body">
                    {item.error ? <p className="error-text">{item.error}</p> : <pre>{item.content}</pre>}
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