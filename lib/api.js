// lib/api.js — Groq API call via /api/generate route
export async function callAPI(prompt, maxTokens = 2500) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, maxTokens })
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error || 'API error')
  return data.content || ''
}
