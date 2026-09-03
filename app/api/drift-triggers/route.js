import { NextResponse } from 'next/server'

export async function POST(req) {
  const apiKey = process.env.PCRAF_Key
  if (!apiKey) return NextResponse.json({ error: 'PCRAF_Key not set' }, { status: 500 })

  const { recentChanges, knownWeaknesses, externalSignals, entityType, sbrLayer } = await req.json()

  const combined = [
    recentChanges    ? 'RECENT CHANGES: ' + recentChanges       : '',
    knownWeaknesses  ? 'KNOWN WEAKNESSES: ' + knownWeaknesses   : '',
    externalSignals  ? 'EXTERNAL SIGNALS: ' + externalSignals   : '',
  ].filter(Boolean).join('
')

  if (!combined.trim()) return NextResponse.json({ triggers: [] })

  const prompt = 'You are an IT Audit risk analyst under AI-PCRAF v3.0 for Indian BFSI.' +
    ' Entity type: ' + entityType + '. SBR layer: ' + sbrLayer + '.

' +
    'Convert these auditor observations into structured drift triggers.
' +
    'Return ONLY a JSON array. No markdown. Start with [ end with ]

' +
    'Observations:
' + combined + '

' +
    'Each trigger must have:
' +
    '{"trigger_ref":"DT-01","description":"precise trigger statement","domain":"CBS|IAM|CLD|API|AI|INC|TPR|DLP|AUD",' +
    '"severity":"Critical|High|Medium|Low","layer_impact":["1","2","3","4"],' +
    '"implications":"what this means for the audit — specific control areas at risk",' +
    '"cascade_status":"ACTIVE"}

' +
    'Rules:
' +
    '- Each distinct risk observation becomes one trigger
' +
    '- Assign the most relevant single domain per trigger
' +
    '- Layer impact: 1=Entity profiling, 2=Controls, 3=Testing, 4=Incident response
' +
    '- Severity: Critical if RBI inspection/regulatory penalty risk, High if significant control gap, Medium/Low otherwise
' +
    '- Maximum 10 triggers — merge minor related observations'

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b', max_tokens: 1500,
        messages: [
          { role: 'system', content: 'Return ONLY valid JSON arrays. No markdown.' },
          { role: 'user', content: prompt }
        ]
      })
    })
    const data = await r.json()
    const raw = data.choices?.[0]?.message?.content || '[]'
    const fb = raw.indexOf('['), lb = raw.lastIndexOf(']')
    const clean = fb !== -1 && lb > fb ? raw.substring(fb, lb+1) : '[]'
    try {
      const triggers = JSON.parse(clean)
      return NextResponse.json({ triggers })
    } catch(e) { return NextResponse.json({ error: 'Parse error', raw }) }
  } catch(e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
