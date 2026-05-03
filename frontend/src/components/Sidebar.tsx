import React from 'react'
import { SiClaude, SiGooglegemini, SiOpenai } from 'react-icons/si'
import type { Provider, ProviderColorMap } from '../types/chat'
import './Sidebar.css'

const PROVIDER_ICONS: Record<Provider, React.ReactNode> = {
  openai: <SiOpenai />,
  anthropic: <SiClaude />,
  google: <SiGooglegemini />,
}

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: 'OpenAI',
  anthropic: 'Claude',
  google: 'Gemini',
}

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
            <span className="model-dot" style={{ color: providerColors[provider] }}>
              {PROVIDER_ICONS[provider]}
            </span>
            {PROVIDER_LABELS[provider]}
          </div>
        ))}
      </div>
    </aside>
  )
}
