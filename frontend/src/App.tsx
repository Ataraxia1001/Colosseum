import { useEffect, useRef, useState } from 'react'
import { SiClaude, SiGooglegemini, SiOpenai } from 'react-icons/si'
import ChatArea from './components/ChatArea'
import InputBar from './components/InputBar'
import Sidebar from './components/Sidebar'
import { requestChatStream } from './services/chatService'
import type {
  AssistantTurn,
  ChatTurn,
  Provider,
  ProviderColorMap,
  ProviderIconMap,
  ProviderRank,
} from './types/chat'
import './App.css'

const API_BASE = __API_BASE__

const PROVIDER_ICONS: ProviderIconMap = {
  openai: <SiOpenai />,
  anthropic: <SiClaude />,
  google: <SiGooglegemini />,
}

const PROVIDER_COLORS: ProviderColorMap = {
  openai: '#10a37f',
  anthropic: '#d4a574',
  google: '#4285f4',
}

const PROVIDER_ORDER: Provider[] = ['openai', 'anthropic', 'google']
const PROVIDER_RANK: ProviderRank = Object.fromEntries(
  PROVIDER_ORDER.map((provider, index) => [provider, index])
) as ProviderRank

const findLastAssistantTurn = (turns: ChatTurn[]): AssistantTurn | null => {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    if (turns[index].role === 'assistant') return turns[index] as AssistantTurn
  }
  return null
}

export default function App() {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<ChatTurn[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const previousHistoryLengthRef = useRef(0)
  const previousResponsesCompleteRef = useRef(false)
  const previousCritiquesCompleteRef = useRef(false)

  useEffect(() => {
    const latestAssistant = findLastAssistantTurn(history)
    const responsesComplete = Boolean(latestAssistant && latestAssistant.responses.length === PROVIDER_ORDER.length)
    const critiquesComplete = Boolean(latestAssistant && latestAssistant.critiques.length === PROVIDER_ORDER.length)
    const startedNewTurn = history.length > previousHistoryLengthRef.current

    if (
      startedNewTurn ||
      (!previousResponsesCompleteRef.current && responsesComplete) ||
      (!previousCritiquesCompleteRef.current && critiquesComplete)
    ) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    previousHistoryLengthRef.current = history.length
    previousResponsesCompleteRef.current = responsesComplete
    previousCritiquesCompleteRef.current = critiquesComplete
  }, [history])

  const handleSubmit = async () => {
    const message = input.trim()
    if (!message || loading) return

    setLoading(true)
    setError('')
    setInput('')

    const assistantTurn: AssistantTurn = {
      role: 'assistant',
      responses: [],
      critiques: [],
      evaluations: [],
      summary: null,
    }

    setHistory((prev) => [...prev, { role: 'user', content: message }, assistantTurn])

    try {
      await requestChatStream({
        apiBase: API_BASE,
        message,
        providerRank: PROVIDER_RANK,
        onEvent: ({ responses, critiques, evaluations, summary }) => {
          setHistory((prev) => {
            const next = [...prev]
            const assistantIndex = next.length - 1

            if (assistantIndex >= 0 && next[assistantIndex].role === 'assistant') {
              const previousAssistant = next[assistantIndex] as AssistantTurn
              next[assistantIndex] = {
                ...previousAssistant,
                responses,
                critiques,
                evaluations,
                summary: summary ?? previousAssistant.summary,
              }
            }

            return next
          })
        },
      })
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Something went wrong.')
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

        <InputBar input={input} setInput={setInput} onSubmit={handleSubmit} loading={loading} />
      </main>
    </div>
  )
}
