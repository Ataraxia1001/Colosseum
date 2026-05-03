import type { RefObject } from 'react'
import type {
  AssistantTurn,
  ChatTurn,
  Evaluation,
  Provider,
  ProviderColorMap,
  ProviderIconMap,
  Summary,
} from '../types/chat'
import './ChatArea.css'

const providers: Provider[] = ['openai', 'anthropic', 'google']
const expectedEvaluationCount = providers.length * 5

const isProvider = (value: string): value is Provider =>
  providers.includes(value as Provider)

const titleForProvider = (provider: Provider | string) => {
  if (provider === 'anthropic') return 'Claude'
  if (provider === 'google') return 'Gemini'
  return 'OpenAI'
}

const findByProvider = <T extends { provider: Provider }>(items: T[], provider: Provider) =>
  items.find((item) => item.provider === provider)

const getLastAssistantIndex = (history: ChatTurn[]) => {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].role === 'assistant') return index
  }
  return -1
}

const statusForPhase = (
  turn: AssistantTurn,
  provider: Provider,
  phase: 'initial' | 'critique',
  isActiveTurn: boolean,
  loading: boolean
) => {
  const hasItem =
    phase === 'initial'
      ? Boolean(findByProvider(turn.responses, provider))
      : Boolean(findByProvider(turn.critiques, provider))

  if (hasItem) return 'Done'
  if (isActiveTurn && loading) return 'Running'
  return 'Pending'
}

interface SectionHeaderProps {
  title: string
  providers: Provider[]
  phase: 'initial' | 'critique'
  turn: AssistantTurn
  isActiveTurn: boolean
  loading: boolean
}

function SectionHeader({
  title,
  providers: providerList,
  phase,
  turn,
  isActiveTurn,
  loading,
}: SectionHeaderProps) {
  return (
    <div className="section-header-row">
      <div className="section-title">{title}</div>
      <div className="status-badges-row">
        {providerList.map((provider) => {
          const status = statusForPhase(turn, provider, phase, isActiveTurn, loading)
          return (
            <span key={`${phase}-status-${provider}`} className={`status-badge ${status.toLowerCase()}`}>
              {titleForProvider(provider)}: {status}
            </span>
          )
        })}
      </div>
    </div>
  )
}

interface ProviderCardProps {
  provider: Provider
  item?: { content?: string; error?: string; model?: string }
  providerColors: ProviderColorMap
  providerIcons: ProviderIconMap
  modelName: string
}

function ProviderCard({ provider, item, providerColors, providerIcons, modelName }: ProviderCardProps) {
  return (
    <div className="response-card">
      <div className="response-header" style={{ borderColor: providerColors[provider] }}>
        <span className="provider-icon" style={{ color: providerColors[provider] }}>
          {providerIcons[provider]}
        </span>
        <div className="provider-info">
          <strong>{titleForProvider(provider)}</strong>
          <span className="model-name">{modelName}</span>
        </div>
      </div>
      <div className="response-body">
        {!item ? (
          <div className="typing-dots">
            <span />
            <span />
            <span />
          </div>
        ) : item.error ? (
          <p className="error-text">{item.error}</p>
        ) : (
          <pre>{item.content}</pre>
        )}
      </div>
    </div>
  )
}

interface TurnSectionProps {
  turn: AssistantTurn
  isActiveTurn: boolean
  loading: boolean
  providerColors: ProviderColorMap
  providerIcons: ProviderIconMap
}

function ResponsesSection({ turn, isActiveTurn, loading, providerColors, providerIcons }: TurnSectionProps) {
  return (
    <>
      <SectionHeader
        title="Responses"
        providers={providers}
        phase="initial"
        turn={turn}
        isActiveTurn={isActiveTurn}
        loading={loading}
      />
      <div className="responses-row">
        {providers.map((provider) => {
          const item = findByProvider(turn.responses, provider)
          return (
            <ProviderCard
              key={`response-${provider}`}
              provider={provider}
              item={item}
              providerColors={providerColors}
              providerIcons={providerIcons}
              modelName={item?.model || 'Waiting...'}
            />
          )
        })}
      </div>
    </>
  )
}

function CritiquesSection({ turn, isActiveTurn, loading, providerColors, providerIcons }: TurnSectionProps) {
  return (
    <>
      <SectionHeader
        title="Critiques"
        providers={providers}
        phase="critique"
        turn={turn}
        isActiveTurn={isActiveTurn}
        loading={loading}
      />
      <div className="responses-row">
        {providers.map((provider) => {
          const item = findByProvider(turn.critiques, provider)
          return (
            <ProviderCard
              key={`critique-${provider}`}
              provider={provider}
              item={item}
              providerColors={providerColors}
              providerIcons={providerIcons}
              modelName="Critique"
            />
          )
        })}
      </div>
    </>
  )
}

interface EvaluationsSectionProps {
  evaluations: Evaluation[]
  providerColors: ProviderColorMap
}

function EvaluationsSection({ evaluations, providerColors }: EvaluationsSectionProps) {
  return (
    <>
      <div className="section-title">Evaluations</div>
      <div className="eval-grid">
        {evaluations.map((evaluation, index) => {
          const providerColor = isProvider(evaluation.provider)
            ? providerColors[evaluation.provider]
            : 'var(--text-muted)'

          return (
            <div className="eval-card" key={`${evaluation.component}-${index}`}>
              <div className="eval-card-header">
                <span className="eval-provider" style={{ color: providerColor }}>
                  {evaluation.provider === 'pairwise'
                    ? `${(evaluation.contestants || []).map(titleForProvider).join(' vs ')}`
                    : titleForProvider(evaluation.provider)}
                </span>
                <span className="eval-component">{evaluation.component}</span>
              </div>
              {evaluation.error ? (
                <p className="error-text">{evaluation.error}</p>
              ) : evaluation.winner ? (
                <p className="eval-winner">
                  Winner: <strong>{titleForProvider(evaluation.winner)}</strong>
                </p>
              ) : (
                <div className="eval-scores">
                  {Object.entries(evaluation.scores || {}).map(([metric, score]) => (
                    <div className="eval-score-row" key={metric}>
                      <span className="eval-metric">{metric}</span>
                      <span className="eval-score-bar-wrap">
                        <span
                          className="eval-score-bar"
                          style={{ width: `${Math.min(score * 10, 100)}%` }}
                        />
                      </span>
                      <span className="eval-score-val">{score.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

interface SummarySectionProps {
  summary: Summary
}

function SummarySection({ summary }: SummarySectionProps) {
  return (
    <div className="summary-panel">
      <div className="summary-title">Summary</div>
      {summary.error ? <p className="error-text">{summary.error}</p> : <pre>{summary.summary}</pre>}
      <p className="summary-winner">
        {summary.is_tie ? 'Result: Tie' : `Winner: ${summary.winner ? titleForProvider(summary.winner) : 'N/A'}`}
      </p>
    </div>
  )
}

function AssistantTurnSections({
  turn,
  isActiveTurn,
  loading,
  providerColors,
  providerIcons,
}: TurnSectionProps) {
  const allResponsesReady = providers.every((provider) => Boolean(findByProvider(turn.responses, provider)))
  const allCritiquesReady = providers.every((provider) => Boolean(findByProvider(turn.critiques, provider)))
  const hasEvaluations = (turn.evaluations?.length || 0) > 0
  const evaluationsDone = (turn.evaluations?.length || 0) >= expectedEvaluationCount

  return (
    <div className="assistant-turn-sections">
      <ResponsesSection
        turn={turn}
        isActiveTurn={isActiveTurn}
        loading={loading}
        providerColors={providerColors}
        providerIcons={providerIcons}
      />

      {allResponsesReady && (
        <CritiquesSection
          turn={turn}
          isActiveTurn={isActiveTurn}
          loading={loading}
          providerColors={providerColors}
          providerIcons={providerIcons}
        />
      )}

      {allCritiquesReady && hasEvaluations && (
        <EvaluationsSection evaluations={turn.evaluations} providerColors={providerColors} />
      )}

      {allCritiquesReady && evaluationsDone && turn.summary && <SummarySection summary={turn.summary} />}
    </div>
  )
}

interface ChatAreaProps {
  history: ChatTurn[]
  loading: boolean
  error: string
  bottomRef: RefObject<HTMLDivElement>
  providerColors: ProviderColorMap
  providerIcons: ProviderIconMap
}

export default function ChatArea({
  history,
  loading,
  error,
  bottomRef,
  providerColors,
  providerIcons,
}: ChatAreaProps) {
  const lastAssistantIndex = getLastAssistantIndex(history)

  return (
    <div className="chat-area">
      {history.length === 0 && !loading && (
        <div className="empty-state">
          <div className="empty-icon">⚔</div>
          <h2>Colosseum</h2>
          <p>Send a message to compare OpenAI, Claude, and Gemini side by side.</p>
        </div>
      )}

      {history.map((turn, index) => (
        <div key={index} className={`turn ${turn.role}`}>
          {turn.role === 'user' ? (
            <div className="user-bubble">
              <span className="turn-avatar user-avatar">You</span>
              <div className="user-content">{turn.content}</div>
            </div>
          ) : (
            <AssistantTurnSections
              turn={turn}
              isActiveTurn={index === lastAssistantIndex}
              loading={loading}
              providerColors={providerColors}
              providerIcons={providerIcons}
            />
          )}
        </div>
      ))}

      {error && <div className="error-banner">{error}</div>}
      <div ref={bottomRef} />
    </div>
  )
}
