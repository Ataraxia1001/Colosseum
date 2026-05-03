import type { Provider, ProviderColorMap } from '../types/chat'
import './Sidebar.css'

interface SidebarProps {
  providerColors: ProviderColorMap
  onNewChat: () => void
}

export default function Sidebar({ providerColors, onNewChat }: SidebarProps) {
  const providers: Provider[] = ['openai', 'anthropic', 'google']

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
        {providers.map((provider) => (
          <div key={provider} className="model-pill">
            <span className="model-dot" style={{ background: providerColors[provider] }} />
            {provider.charAt(0).toUpperCase() + provider.slice(1)}
          </div>
        ))}
      </div>
    </aside>
  )
}
