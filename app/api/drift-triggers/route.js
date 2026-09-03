import { NextResponse } from 'next/server'

export async function POST(req) {
  const apiKey = process.env.PCRAF_Key
  if (!apiKey) return NextResponse.json({ error: 'PCRAF_Key not set' }, { status: 500 })

  const body = await req.json()
  const recentChanges   = body.recentChanges   || ''
  const knownWeaknesses = body.knownWeaknesses || ''
  const externalSignals = body.externalSignals || ''
  const entityType      = body.entityType      || ''
  const sbrLayer        = body.sbrLayer        || ''

  const parts = []
  if (recentChanges)   parts.push('RECENT CHANGES: ' + recentChanges)
  if (knownWeaknesses) parts.push('KNOWN WEAKNESSES: ' + knownWeaknesses)
  if (externalSignals) parts.push('EXTERNAL SIGNALS: ' + externalSignals)

  if (!parts.length) return NextResponse.json({ triggers: [] })

  const combined = parts.join('\n')

  const prompt = [
    'You are an IT Audit risk analyst under AI-PCRAF v3.0 for Indian BFSI.',
    'Entity type: ' + entityType + '. SBR layer: ' + sbrLayer + '.',
    '',
    'Convert these auditor observations into structured drift triggers.',
    'Return ONLY a JSON array. No markdown. Start with [ end with ]',
    '',
    'Observations:',
    combined,
    '',
    'Each trigger must have exactly these fields:',
    'trigger_ref: DT-01, DT-02 etc.',
    'description: precise trigger statement',
    'domain: one of CBS|IAM|CLD|API|AI|INC|TPR|DLP|AUD',
    'severity: one of Critical|High|Medium|Low',
    'layer_impact: array of scaffold layer numbers affected e.g. ["1","2","4"]',
    'implications: what this means for the audit and which control areas are at risk',
    'cascade_status: ACTIVE',
    '',
    'Rules:',
    '- Each distinct risk observation becomes one trigger',
    '- Assign the most relevant single domain per trigger',
    '- Layer 1=Entity profiling, 2=Controls, 3=Testing, 4=Incident response',
    '- Severity Critical if RBI inspection or regulatory penalty risk',
    '- Maximum 10 triggers — merge minor related observations',
  ].join('\n')

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        max_tokens: 1500,
        messages: [
          { role: 'system', content: 'Return ONLY valid JSON arrays. No markdown. No preamble.' },
          { role: 'user',   content: prompt }
        ]
      })
    })
    const data = await r.json()
    const raw = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '[]'
    const fb = raw.indexOf('[')
    const lb = raw.lastIndexOf(']')
    const clean = fb !== -1 && lb > fb ? raw.substring(fb, lb + 1) : '[]'
    try {
      return NextResponse.json({ triggers: JSON.parse(clean) })
    } catch(e) {
      return NextResponse.json({ error: 'Parse error', raw: raw })
    }
  } catch(e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
