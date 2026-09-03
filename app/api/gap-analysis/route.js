import { NextResponse } from 'next/server'

async function matchObligationToControls(obligation, aiControls, libraryControls, apiKey) {
  const prompt = `You are a regulatory gap analyst for Indian BFSI IT Audit under AI-PCRAF v3.0.

OBLIGATION:
Section: ${obligation.section_ref}
Text: ${obligation.obligation_text}
Domain: ${obligation.domain}

AI-PCRAF CONTROLS (${aiControls.length}):
${aiControls.slice(0,5).map(c => `- ${c.id}: ${c.codex_ref||''} | ${c.ctrl_type||''} | Evidence: ${c.evidence||'not specified'}`).join('\n')}

ORGANISATION LIBRARY CONTROLS (${libraryControls.length}):
${libraryControls.slice(0,5).map(c => `- ${c.control_statement?.substring(0,80)} | ${c.citation||''} | SLA: ${c.sla||'not specified'}`).join('\n')}

Analyse and return ONLY a JSON object:
{
  "status": "COVERED_V|COVERED_VT|WEAK|GAP",
  "delta_action": "NONE|IMPROVE|GENERATE",
  "matched_ai_control": "control ID or null",
  "matched_library_control": "row index or null",
  "improvement_note": "specific fix needed or null",
  "gap_reason": "why no control exists or null"
}

Rules:
- COVERED_V: obligation fully addressed, citation verifiable from source document
- COVERED_VT: obligation addressed but citation is training-based only
- WEAK: control exists but SLA wrong, evidence missing, or citation incomplete
- GAP: no control addresses this obligation
- IMPROVE: generate specific fix for WEAK controls
- GENERATE: create new CONTROL_OBJECT for GAP`

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},
    body: JSON.stringify({ model:'openai/gpt-oss-120b', max_tokens:600,
      messages:[{role:'system',content:'Return ONLY valid JSON. No markdown.'},{role:'user',content:prompt}] })
  })
  const data = await r.json()
  const raw  = data.choices?.[0]?.message?.content || '{}'
  const fb = raw.indexOf('{'), lb = raw.lastIndexOf('}')
  try { return JSON.parse(fb!==-1&&lb>fb ? raw.substring(fb,lb+1) : '{}') }
  catch { return { status:'GAP', delta_action:'GENERATE', improvement_note:'Parse error — manual review required' } }
}

export async function POST(req) {
  const apiKey = process.env.PCRAF_Key
  if (!apiKey) return NextResponse.json({ error: 'PCRAF_Key not set' }, { status: 500 })

  try {
    const { obligations, aiControls, libraryControls } = await req.json()

    if (!obligations?.length) return NextResponse.json({ error: 'No obligations provided' }, { status: 400 })

    // Process obligations in parallel batches of 5
    const results = []
    const batchSize = 5
    for (let i = 0; i < obligations.length; i += batchSize) {
      const batch = obligations.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(ob => matchObligationToControls(ob, aiControls||[], libraryControls||[], apiKey)
          .then(match => ({ obligation: ob, ...match }))
        )
      )
      results.push(...batchResults)
    }

    // Summary counts
    const summary = {
      total:        results.length,
      covered_v:    results.filter(r => r.status==='COVERED_V').length,
      covered_vt:   results.filter(r => r.status==='COVERED_VT').length,
      weak:         results.filter(r => r.status==='WEAK').length,
      gap:          results.filter(r => r.status==='GAP').length,
      coverage_pct: Math.round((results.filter(r => r.status==='COVERED_V'||r.status==='COVERED_VT').length / results.length) * 100)
    }

    return NextResponse.json({ results, summary })

  } catch(e) {
    console.error('gap-analysis error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
