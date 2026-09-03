import { NextResponse } from 'next/server'

export async function POST(req) {
  const apiKey = process.env.PCRAF_Key
  if (!apiKey) return NextResponse.json({ error: 'PCRAF_Key not set' }, { status: 500 })
  const { prompt, maxTokens } = await req.json()
  if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 })
  const resolvedTokens = Math.max(maxTokens || 2500, 2500)
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        max_tokens: resolvedTokens,
        messages: [
          { role: 'system', content: 'You are a Principal Cyber Risk and Compliance Consultant under AI-PCRAF v3.0 for Indian BFSI IT Audit. Produce precise audit-ready outputs anchored to RBI IT Gov MD 2023, CERT-In Directions April 2022, DPDP Act 2023, NCIIPC, ReBIT, IFTAS. Tag every regulatory citation [VT]. Never fabricate citations. Incident reporting SLA is always 6 hours. Never cite GDPR, SOC 2, ISO 27001, or NIST as primary driver.' },
          { role: 'user', content: prompt }
        ]
      })
    })
    const data = await r.json()
    if (!r.ok || data.error) return NextResponse.json({ error: data.error?.message || JSON.stringify(data) }, { status: r.status })
    return NextResponse.json({ content: data.choices?.[0]?.message?.content || '' })
  } catch(e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
