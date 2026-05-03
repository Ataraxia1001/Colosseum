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

const phaseStatus = (
  isDone: boolean,
  isRunning: boolean
): 'Done' | 'Running' | 'Pending' => {
  if (isDone) return 'Done'
  if (isRunning) return 'Running'
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
        <span className="provider-icon" style={{ color: providerColors[provider], display: 'flex', alignItems: 'center' }}>
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
              modelName={item?.model || titleForProvider(provider)}
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
              modelName={item?.model || titleForProvider(provider)}
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
  status: 'Done' | 'Running' | 'Pending'
}

interface AggregatedEvalRow {
  provider: Provider
  component: string
  sampleCount: number
  metrics: Record<string, number>
}

const metricOrder = ['correctness', 'completeness', 'reasoning', 'clarity']
const componentOrder = ['response', 'critique']

function judgeLabelForPairwise(contestants: Provider[] | undefined): string {
  if (!contestants || contestants.length === 0) return 'Unknown'
  const judgeProvider = providers.find((provider) => !contestants.includes(provider))
  return judgeProvider ? titleForProvider(judgeProvider) : 'Unknown'
}

function pairwiseJudgeText(evaluation: Evaluation): string {
  const contestants = (evaluation.contestants || []) as Provider[]
  const judge = judgeLabelForPairwise(contestants)
  const winner = evaluation.winner ? titleForProvider(evaluation.winner) : null
  const loserProvider = evaluation.winner ? contestants.find((provider) => provider !== evaluation.winner) : undefined
  const loser = loserProvider ? titleForProvider(loserProvider) : null

  if (winner && loser) {
    return `${judge} judges: ${winner} > ${loser}`
  }

  if (contestants.length >= 2) {
    return `${judge} judges: ${titleForProvider(contestants[0])} vs ${titleForProvider(contestants[1])}`
  }

  return `${judge} judges: Pending result`
}

function aggregateEvaluations(evaluations: Evaluation[]): AggregatedEvalRow[] {
  const grouped = new Map<
    string,
    {
      provider: Provider
      component: string
      judges: Set<string>
      totals: Record<string, number>
      counts: Record<string, number>
    }
  >()

  for (const evaluation of evaluations) {
    if (!isProvider(evaluation.provider) || !evaluation.scores || Object.keys(evaluation.scores).length === 0) {
      continue
    }

    const key = `${evaluation.provider}:${evaluation.component}`
    if (!grouped.has(key)) {
      grouped.set(key, {
        provider: evaluation.provider,
        component: evaluation.component,
        judges: new Set<string>(),
        totals: {},
        counts: {},
      })
    }

    const entry = grouped.get(key)
    if (!entry) continue
    entry.judges.add(evaluation.judge_model || 'unknown-judge')

    for (const [metric, score] of Object.entries(evaluation.scores)) {
      entry.totals[metric] = (entry.totals[metric] || 0) + score
      entry.counts[metric] = (entry.counts[metric] || 0) + 1
    }
  }

  return Array.from(grouped.values())
    .map((entry) => {
      const metrics: Record<string, number> = {}
      for (const metric of Object.keys(entry.totals)) {
        const count = entry.counts[metric] || 1
        metrics[metric] = entry.totals[metric] / count
      }

      return {
        provider: entry.provider,
        component: entry.component,
        sampleCount: entry.judges.size,
        metrics,
      }
    })
    .sort((a, b) => {
      const providerDelta = providers.indexOf(a.provider) - providers.indexOf(b.provider)
      if (providerDelta !== 0) return providerDelta
      const componentDelta = componentOrder.indexOf(a.component) - componentOrder.indexOf(b.component)
      if (componentDelta !== 0) return componentDelta
      return a.component.localeCompare(b.component)
    })
}

function EvaluationsSection({ evaluations, providerColors, status }: EvaluationsSectionProps) {
  const aggregatedRows = aggregateEvaluations(evaluations)
  const pairwiseRows = evaluations.filter((evaluation) => evaluation.provider === 'pairwise')

  return (
    <>
      <div className="section-header-row">
        <div className="section-title">Evaluations</div>
        <div className="status-badges-row">
          <span className={`status-badge ${status.toLowerCase()}`}>
            System: {status}
          </span>
        </div>
      </div>
      {aggregatedRows.length > 0 && (
        <div className="eval-plot-panel">
          {aggregatedRows.map((row) => (
            <div className="eval-plot-row" key={`${row.provider}-${row.component}`}>
              <div className="eval-plot-row-head">
                <span className="eval-provider" style={{ color: providerColors[row.provider] }}>
                  {titleForProvider(row.provider)}
                </span>
                <span className="eval-component">{row.component}</span>
                <span className="eval-plot-row-meta">{row.sampleCount} judges</span>
              </div>
              <div className="eval-scores">
                {[...Object.keys(row.metrics)].sort((a, b) => {
                  const ai = metricOrder.indexOf(a)
                  const bi = metricOrder.indexOf(b)
                  if (ai === -1 && bi === -1) return a.localeCompare(b)
                  if (ai === -1) return 1
                  if (bi === -1) return -1
                  return ai - bi
                }).map((metric) => {
                  const score = row.metrics[metric]
                  return (
                    <div className="eval-score-row" key={`${row.provider}-${row.component}-${metric}`}>
                      <span className="eval-metric">{metric}</span>
                      <span className="eval-score-bar-wrap">
                        <span
                          className="eval-score-bar"
                          style={{ width: `${Math.min(score * 10, 100)}%` }}
                        />
                      </span>
                      <span className="eval-score-val">{score.toFixed(1)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {pairwiseRows.length > 0 && (
        <div className="pairwise-row">
          {pairwiseRows.map((evaluation, index) => (
            <div className="pairwise-pill" key={`pairwise-${index}`}>
              {pairwiseJudgeText(evaluation)}
            </div>
          ))}
        </div>
      )}

      {status === 'Done' && evaluations.length === 0 && <p className="phase-progress-text">No evaluation results.</p>}

      {status !== 'Done' && (
        <div className="typing-dots">
          <span />
          <span />
          <span />
        </div>
      )}
    </>
  )
}

interface SinglePhaseHeaderProps {
  title: string
  provider: string
  status: 'Done' | 'Running' | 'Pending'
}

function SinglePhaseHeader({ title, provider, status }: SinglePhaseHeaderProps) {
  return (
    <div className="section-header-row">
      <div className="section-title">{title}</div>
      <div className="status-badges-row">
        <span className={`status-badge ${status.toLowerCase()}`}>
          {provider}: {status}
        </span>
      </div>
    </div>
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

interface SummaryProgressProps {
  status: 'Done' | 'Running' | 'Pending'
}

function SummaryProgress({ status }: SummaryProgressProps) {
  return (
    <div className="summary-panel">
      <div className="summary-title">Summary</div>
      <div className="phase-progress-top">
        <p className="phase-progress-text">
          {status === 'Done'
            ? 'Summary is ready.'
            : status === 'Running'
              ? 'Summary is being generated. Please wait...'
              : 'Summary is waiting for evaluation to complete.'}
        </p>
        {(status === 'Running' || status === 'Pending') && (
          <div className="typing-dots">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
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
  const evaluationsDone = (turn.evaluations?.length || 0) >= expectedEvaluationCount
  const evaluationsRunning = isActiveTurn && loading && allCritiquesReady && !evaluationsDone
  const evaluationsStatus = phaseStatus(evaluationsDone, evaluationsRunning)

  const hasSummary = Boolean(turn.summary)
  const summaryRunning = isActiveTurn && loading && evaluationsDone && !hasSummary
  const summaryStatus = phaseStatus(hasSummary, summaryRunning)

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

      {allCritiquesReady && (
        <>
          <EvaluationsSection
            evaluations={turn.evaluations}
            providerColors={providerColors}
            status={evaluationsStatus}
          />
        </>
      )}

      {allCritiquesReady && evaluationsDone && (
        <>
          <SinglePhaseHeader title="Summary" provider="System" status={summaryStatus} />
          {turn.summary ? <SummarySection summary={turn.summary} /> : <SummaryProgress status={summaryStatus} />}
        </>
      )}
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
