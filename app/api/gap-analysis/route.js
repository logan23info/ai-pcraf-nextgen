import { NextResponse } from 'next/server'

export async function POST(req) {
  const apiKey = process.env.PCRAF_Key
  if (!apiKey) return NextResponse.json({ error: 'PCRAF_Key not set' }, { status: 500 })

  try {
    const { obligations, entityControls, mandateProfile, driftTriggers, matrixRequirements } = await req.json()
    if (!obligations?.length) return NextResponse.json({ error: 'No obligations provided' }, { status: 400 })

    const entityType  = mandateProfile?.functional_type || ''
    const sbrLayer    = mandateProfile?.sbr_layer || ''
    const activeDT    = (driftTriggers || []).filter(function(t) { return t.cascade_status === 'ACTIVE' })
      .map(function(t) { return t.trigger_ref + ' ' + t.domain + ' [' + t.severity + ']' }).join(', ')

    // Matrix requirements for this entity — verified facts
    const matrixText = (matrixRequirements || []).slice(0, 20).map(function(r) {
      return r.requirement_code + ': ' + r.requirement_name + ' - ' + (r.value || 'required') +
        ' | Evidence: ' + (r.evidence_required || 'not specified')
    }).join('\n')

    const controlsText = (entityControls || []).slice(0, 30).map(function(c, i) {
      return [
        'C' + (i+1) + ': ' + (c.control_statement || '').substring(0, 100),
        'Domain: ' + (c.domain || '?'),
        'SLA: ' + (c.sla || 'not stated'),
        'Evidence: ' + (c.evidence || 'not stated'),
      ].join(' | ')
    }).join('\n')

    // Process in batches of 5
    const results = []
    for (let i = 0; i < obligations.length; i += 5) {
      const batch = obligations.slice(i, i + 5)
      const batchResults = await Promise.all(batch.map(async function(ob) {
        const prompt = [
          'You are an IT Audit gap analyst for Indian BFSI under AI-PCRAF v3.0.',
          'Entity: ' + entityType + ' | SBR: ' + sbrLayer,
          'Active drift triggers: ' + (activeDT || 'none'),
          '',
          'REGULATORY OBLIGATION:',
          'Section: ' + (ob.section_ref || '?'),
          'Obligation: ' + ob.obligation_text,
          'Domain: ' + (ob.domain || '?'),
          'SLA required: ' + (ob.sla || 'not specified'),
          '',
          'RBI MATRIX REQUIREMENTS FOR ' + entityType + ' (' + (matrixRequirements||[]).length + ' verified):',
          matrixText || 'No matrix loaded',
          '',
          'ENTITY ACTUAL CONTROLS (' + (entityControls||[]).length + ' controls from uploaded library):',
          controlsText || 'No controls uploaded',
          '',
          'INSTRUCTIONS:',
          'Find the best matching entity control for this obligation.',
          'Assess adequacy against RBI requirements for ' + entityType + ' at ' + sbrLayer + '.',
          'Return ONLY a JSON object:',
          '{',
          '  "status": "COVERED_V|COVERED_VT|WEAK|GAP",',
          '  "matched_control": "C-number or null",',
          '  "delta_action": "NONE|IMPROVE|GENERATE",',
          '  "deficiency": "exact deficiency for WEAK — wrong SLA, missing evidence, incorrect frequency — or null",',
          '  "recommendation": "what control is needed for GAP — domain and key requirements — or null",',
          '  "audit_note": "one sentence for the auditor"',
          '}',
          '',
          'Rules:',
          'Cross-reference both the RBI obligation AND the matrix requirement for this entity type.',
          'COVERED_V: entity control fully addresses obligation, citation verifiable from uploaded document',
          'COVERED_VT: entity control addresses obligation, citation from training knowledge only',
          'WEAK: control exists but has specific deficiency — state exactly what is wrong',
          'GAP: no entity control addresses this obligation',
          'Never use assumed or AI-generated controls — only what is in the entity library above.',
        ].join('\n')

        try {
          const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
            body: JSON.stringify({
              model: 'openai/gpt-oss-120b', max_tokens: 400,
              messages: [
                { role: 'system', content: 'Return ONLY valid JSON. No markdown.' },
                { role: 'user', content: prompt }
              ]
            })
          })
          const data = await r.json()
          const raw = data.choices && data.choices[0] ? data.choices[0].message.content : '{}'
          const fb = raw.indexOf('{'), lb = raw.lastIndexOf('}')
          const match = JSON.parse(fb !== -1 && lb > fb ? raw.substring(fb, lb+1) : '{}')
          return { obligation: ob, ...match }
        } catch(e) {
          return { obligation: ob, status: 'GAP', delta_action: 'GENERATE',
            deficiency: null, recommendation: 'Parse error - manual review required' }
        }
      }))
      results.push(...batchResults)
    }

    const summary = {
      total:       results.length,
      covered_v:   results.filter(function(r){return r.status==='COVERED_V'}).length,
      covered_vt:  results.filter(function(r){return r.status==='COVERED_VT'}).length,
      weak:        results.filter(function(r){return r.status==='WEAK'}).length,
      gap:         results.filter(function(r){return r.status==='GAP'}).length,
      coverage_pct: 0
    }
    summary.coverage_pct = summary.total > 0
      ? Math.round(((summary.covered_v + summary.covered_vt) / summary.total) * 100) : 0

    return NextResponse.json({ results, summary })
  } catch(e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
