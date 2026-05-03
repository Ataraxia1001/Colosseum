import type {
  CritiqueItem,
  Evaluation,
  Provider,
  ProviderRank,
  ResponseItem,
  Summary,
} from '../types/chat'

interface RequestChatParams {
  apiBase: string
  message: string
  providerRank: ProviderRank
}

interface StreamEvent {
  type: string
  responses: ResponseItem[]
  critiques: CritiqueItem[]
  evaluations: Evaluation[]
  summary: Summary | null
}

interface RequestChatStreamParams extends RequestChatParams {
  onEvent: (event: StreamEvent) => void
}

interface StreamPayload {
  type: string
  error?: string
  responses?: ResponseItem[]
  critiques?: CritiqueItem[]
  evaluations?: Evaluation[]
  summary?: Summary | null
}

interface ChatResponse {
  detail?: string
  responses?: ResponseItem[]
  critiques?: CritiqueItem[]
}

export async function requestChat({
  apiBase,
  message,
  providerRank,
}: RequestChatParams): Promise<Array<ResponseItem & { critique?: string }>> {
  const res = await fetch(`${apiBase}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })

  const data = (await res.json().catch(() => ({}))) as ChatResponse

  if (!res.ok) {
    throw new Error(data.detail || 'Request failed.')
  }

  const responses = data.responses || []
  const critiques = data.critiques || []

  const orderedResponses = [...responses].sort(
    (a, b) =>
      (providerRank[a.provider] ?? Number.MAX_SAFE_INTEGER) -
      (providerRank[b.provider] ?? Number.MAX_SAFE_INTEGER)
  )

  return orderedResponses.map((response) => {
    const critique = critiques.find((item) => item.provider === response.provider)
    return critique ? { ...response, critique: critique.content } : response
  })
}

function upsertByProvider<T extends { provider: Provider }>(list: T[], item: T): T[] {
  const index = list.findIndex((x) => x.provider === item.provider)
  if (index === -1) return [...list, item]

  const updated = [...list]
  updated[index] = item
  return updated
}

export async function requestChatStream({
  apiBase,
  message,
  providerRank,
  onEvent,
}: RequestChatStreamParams): Promise<void> {
  const res = await fetch(`${apiBase}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { detail?: string }
    throw new Error(data.detail || 'Stream request failed.')
  }

  if (!res.body) {
    throw new Error('Streaming is not supported in this browser.')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  let buffer = ''
  let done = false
  let responses: ResponseItem[] = []
  let critiques: CritiqueItem[] = []
  let evaluations: Evaluation[] = []

  while (!done) {
    const { value, done: streamDone } = await reader.read()
    done = streamDone
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })

    const events = buffer.split('\n\n')
    buffer = events.pop() || ''

    for (const rawEvent of events) {
      const dataLine = rawEvent
        .split('\n')
        .find((line) => line.startsWith('data: '))

      if (!dataLine) continue

      const payload = JSON.parse(dataLine.slice(6)) as StreamPayload

      if (payload.type === 'error') {
        throw new Error(payload.error || 'Streaming error.')
      }

      for (const item of payload.responses || []) {
        responses = upsertByProvider(responses, item)
      }
      for (const item of payload.critiques || []) {
        critiques = upsertByProvider(critiques, item)
      }
      for (const item of payload.evaluations || []) {
        evaluations = [...evaluations, item]
      }

      const orderedResponses = [...responses].sort(
        (a, b) =>
          (providerRank[a.provider] ?? Number.MAX_SAFE_INTEGER) -
          (providerRank[b.provider] ?? Number.MAX_SAFE_INTEGER)
      )
      const orderedCritiques = [...critiques].sort(
        (a, b) =>
          (providerRank[a.provider] ?? Number.MAX_SAFE_INTEGER) -
          (providerRank[b.provider] ?? Number.MAX_SAFE_INTEGER)
      )

      onEvent({
        type: payload.type,
        responses: orderedResponses,
        critiques: orderedCritiques,
        evaluations,
        summary: payload.summary || null,
      })
    }
  }
}
