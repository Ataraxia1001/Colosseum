export async function requestChat({ apiBase, message, providerRank }) {
  const res = await fetch(`${apiBase}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })

  const data = await res.json().catch(() => ({}))

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

  return orderedResponses.map((r) => {
    const critique = critiques.find((c) => c.provider === r.provider)
    return critique ? { ...r, critique: critique.content } : r
  })
}