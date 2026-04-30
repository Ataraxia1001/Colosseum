import './Sidebar.css'

export default function Sidebar({ providerColors, onNewChat }) {
  const providers = ['openai', 'anthropic', 'google']

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-logo">
          <span className="logo-icon">⚔</span>
          <span className="logo-text">Colosseum</span>
        </div>
        <button className="new-chat-btn" onClick={onNewChat}>
          <span>+</span> New Chat
        </button>
      </div>

      <div className="sidebar-models">
        <p className="sidebar-label">Active Models</p>
        {providers.map((p) => (
          <div key={p} className="model-pill">
            <span className="model-dot" style={{ background: providerColors[p] }} />
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </div>
        ))}
      </div>
    </aside>
  )
}