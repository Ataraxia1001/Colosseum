import './ChatArea.css'

const providers = ['openai', 'anthropic', 'google']
const expectedEvaluationCount = providers.length * 5

const titleForProvider = (provider) => {
  if (provider === 'anthropic') return 'Claude'
  if (provider === 'google') return 'Gemini'
  return 'OpenAI'
}

const findByProvider = (items, provider) =>
  (items || []).find((item) => item.provider === provider)

const getLastAssistantIndex = (history) => {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].role === 'assistant') return i
  }
  return -1
}

const statusForPhase = (turn, provider, phase, isActiveTurn, loading) => {
  const hasItem = phase === 'initial'
    ? !!findByProvider(turn.responses, provider)
    : !!findByProvider(turn.critiques, provider)

  if (hasItem) return 'Done'
  if (isActiveTurn && loading) return 'Running'
  return 'Pending'
}

function SectionHeader({ title, providers: providerList, phase, turn, isActiveTurn, loading }) {
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

function ProviderCard({ provider, item, providerColors, providerIcons, modelName }) {
  return (
    <div className="response-card" key={`${modelName.toLowerCase()}-${provider}`}>
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
          <div className="typing-dots"><span /><span /><span /></div>
        ) : item.error ? (
          <p className="error-text">{item.error}</p>
        ) : (
          <pre>{item.content}</pre>
        )}
      </div>
    </div>
  )
}

function ResponsesSection({ turn, isActiveTurn, loading, providerColors, providerIcons }) {
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

function CritiquesSection({ turn, isActiveTurn, loading, providerColors, providerIcons }) {
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

function EvaluationsSection({ evaluations, providerColors }) {
  return (
    <>
      <div className="section-title">Evaluations</div>
      <div className="eval-grid">
        {evaluations.map((ev, idx) => (
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
  )
}

function SummarySection({ summary }) {
  return (
    <div className="summary-panel">
      <div className="summary-title">Summary</div>
      {summary.error ? (
        <p className="error-text">{summary.error}</p>
      ) : (
        <pre>{summary.summary}</pre>
      )}
      <p className="summary-winner">
        {summary.is_tie ? 'Result: Tie' : `Winner: ${summary.winner || 'N/A'}`}
      </p>
    </div>
  )
}

function AssistantTurnSections({ turn, isActiveTurn, loading, providerColors, providerIcons }) {
  const allResponsesReady = providers.every((provider) => !!findByProvider(turn.responses, provider))
  const allCritiquesReady = providers.every((provider) => !!findByProvider(turn.critiques, provider))
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
        <EvaluationsSection
          evaluations={turn.evaluations}
          providerColors={providerColors}
        />
      )}

      {allCritiquesReady && evaluationsDone && turn.summary && (
        <SummarySection summary={turn.summary} />
      )}
    </div>
  )
}

// function LoadingTurn({ providerColors, providerIcons }) {
//   return (
//     <div className="turn assistant">
//       <div className="responses-row">
//         {['openai', 'anthropic', 'google'].map((p) => (
//           <div className="response-card loading-card" key={p}>
//             <div className="response-header" style={{ borderColor: providerColors[p] }}>
//               <span className="provider-icon" style={{ color: providerColors[p] }}>
//                 {providerIcons[p]}
//               </span>
//               <div className="provider-info">
//                 <strong>{p.charAt(0).toUpperCase() + p.slice(1)}</strong>
//               </div>
//             </div>
//             <div className="response-body">
//               <div className="typing-dots"><span /><span /><span /></div>
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   )
// }

export default function ChatArea({
  history,
  loading,
  error,
  bottomRef,
  providerColors,
  providerIcons,
}) {
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

      {history.map((turn, i) => (
        <div key={i} className={`turn ${turn.role}`}>
          {turn.role === 'user' ? (
            <div className="user-bubble">
              <span className="turn-avatar user-avatar">You</span>
              <div className="user-content">{turn.content}</div>
            </div>
          ) : (
            <AssistantTurnSections
              turn={turn}
              isActiveTurn={i === lastAssistantIndex}
              loading={loading}
              providerColors={providerColors}
              providerIcons={providerIcons}
            />
          )}
        </div>
      ))}

      {/* {loading && (
        <LoadingTurn providerColors={providerColors} providerIcons={providerIcons} />
      )} */}

      {error && <div className="error-banner">{error}</div>}
      <div ref={bottomRef} />
    </div>
  )
}