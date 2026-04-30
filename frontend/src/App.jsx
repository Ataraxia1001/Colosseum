import { useState, useRef, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import InputBar from './components/InputBar'
import ChatArea from './components/ChatArea'
import { requestChat } from './services/chatService'

const API_BASE = __API_BASE__

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

const PROVIDER_ORDER = ['openai', 'anthropic', 'google']
const PROVIDER_RANK = Object.fromEntries(PROVIDER_ORDER.map((provider, index) => [provider, index]))



export default function App() {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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
    setHistory((prev) => [...prev, { role: 'user', content: msg }])

    try {
      const responsesWithCritiques = await requestChat({
        apiBase: API_BASE,
        message: msg,
        providerRank: PROVIDER_RANK,
      })

      setHistory((prev) => [
        ...prev,
        { role: 'assistant', responses: responsesWithCritiques },
      ])
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <Sidebar
        providerColors={PROVIDER_COLORS}
        onNewChat={() => {
          setHistory([])
          setError('')
        }}
      />

      <main className="main">
        <ChatArea
          history={history}
          loading={loading}
          error={error}
          bottomRef={bottomRef}
          providerColors={PROVIDER_COLORS}
          providerIcons={PROVIDER_ICONS}
        />

        <InputBar
          input={input}
          setInput={setInput}
          onSubmit={handleSubmit}
          loading={loading}
        />
      </main>
    </div>
  )
}
