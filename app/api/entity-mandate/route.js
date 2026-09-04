import { NextResponse } from 'next/server'
import { getEntityRegulatoryContext } from '../../../lib/regulatoryContext'

export async function POST(req) {
  const apiKey = process.env.PCRAF_Key
  if (!apiKey) return NextResponse.json({ error: 'PCRAF_Key not set' }, { status: 500 })

  const body            = await req.json()
  const functionalType  = body.functionalType  || ''
  const sbrLayer        = body.sbrLayer        || ''
  const totalAssets     = body.totalAssets     || ''
  const entityName      = body.entityName      || ''
  const cbs             = body.cbs             || ''
  const cloud           = body.cloud           || ''
  const recentChanges   = body.recentChanges   || ''
  const knownWeaknesses = body.knownWeaknesses || ''
  const externalSignals = body.externalSignals || ''

  try {
    // STEP 1: Build verified section directly from matrix - no AI involved
    const regCtx = await getEntityRegulatoryContext(functionalType, sbrLayer)

    const verifiedProfile = {
      functional_type:      functionalType,
      sbr_layer:            sbrLayer,
      governing_framework:  regCtx.applicableRefs.map(function(r) { return r.ref_code }).join(' + '),
      applicable_refs:      regCtx.applicableRefs,
      mandatory_requirements: regCtx.applicable,
      not_applicable:       regCtx.notApplicable,
      // Derive binary flags directly from matrix - no AI
      ciso_required:        regCtx.applicable.some(function(r) { return r.code === 'GOV-003' }),
      it_committee_required:regCtx.applicable.some(function(r) { return r.code === 'GOV-001' }),
      soc_required:         regCtx.applicable.some(function(r) { return r.code === 'INF-001' }),
      cro_required:         regCtx.applicable.some(function(r) { return r.code === 'GOV-004' }),
      is_audit_required:    regCtx.applicable.some(function(r) { return r.code === 'RSK-004' }),
      bcp_required:         regCtx.applicable.some(function(r) { return r.code === 'INF-004' }),
      va_required:          regCtx.applicable.some(function(r) { return r.code === 'RSK-002' }),
      pt_required:          regCtx.applicable.some(function(r) { return r.code === 'RSK-003' }),
      data_localisation:    regCtx.applicable.some(function(r) { return r.code === 'DAT-001' }),
      source:               'regulatory_compliance_matrix',
      verified:             true,
    }

    // STEP 2: AI generates narrative context only - not decisions
    const matrixSummary = regCtx.applicable.map(function(r) {
      return r.code + ': ' + r.name + ' (' + r.value + ')'
    }).join(', ')

    const prompt = [
      'You are an IT Audit consultant for Indian BFSI under AI-PCRAF v3.0.',
      'The following requirements have been VERIFIED from the RBI regulatory matrix for this entity.',
      'Your task is ONLY to generate audit context - not to add or remove any requirements.',
      '',
      'ENTITY: ' + entityName + ' | Type: ' + functionalType + ' | SBR: ' + sbrLayer,
      'Assets: Rs ' + (totalAssets || '?') + ' Crore | CBS: ' + (cbs || '?') + ' | Cloud: ' + cloud,
      'Recent changes: ' + (recentChanges || 'None'),
      'Known weaknesses: ' + (knownWeaknesses || 'None'),
      'External signals: ' + (externalSignals || 'None'),
      '',
      'VERIFIED APPLICABLE REQUIREMENTS (' + regCtx.applicable.length + '): ' + matrixSummary,
      '',
      'Generate ONLY the following JSON fields - do not add or change any requirements:',
      '{',
      '  "audit_focus_areas": ["5 specific audit focus areas for THIS entity based on its risk signals and verified requirements"],',
      '  "cii_presumption": boolean based on entity type - true only for SCB/NBFC-UL/NBFC-TL/NBFC-IFC/IDF-NBFC/NBFC-SPD,',
      '  "cii_reasoning": "one sentence why CII applies or not for this specific entity type",',
      '  "pii_always_involved": boolean - true if entity handles customer PII by nature of business,',
      '  "pii_reasoning": "one sentence explanation",',
      '  "sbr_specific_obligations": ["obligations unique to ' + sbrLayer + ' not shared by all layers - max 5"],',
      '  "drift_risk_summary": "one paragraph on how the declared risk signals amplify audit risk for this entity"',
      '}',
    ].join('\n')

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        max_tokens: 1000,
        messages: [
          { role: 'system', content: 'Return ONLY valid JSON. No markdown. No preamble. Start with { end with }' },
          { role: 'user', content: prompt }
        ]
      })
    })

    const data = await r.json()
    const raw  = data.choices?.[0]?.message?.content || '{}'
    const fb   = raw.indexOf('{')
    const lb   = raw.lastIndexOf('}')
    let aiContext = {}
    try {
      aiContext = JSON.parse(fb !== -1 && lb > fb ? raw.substring(fb, lb+1) : '{}')
    } catch(e) {
      aiContext = { audit_focus_areas: [], cii_presumption: false, pii_always_involved: false }
    }

    // STEP 3: Merge - verified facts + AI narrative
    const profile = Object.assign({}, verifiedProfile, {
      audit_focus_areas:      aiContext.audit_focus_areas      || [],
      cii_presumption:        aiContext.cii_presumption        || false,
      cii_reasoning:          aiContext.cii_reasoning          || '',
      pii_always_involved:    aiContext.pii_always_involved    || false,
      pii_reasoning:          aiContext.pii_reasoning          || '',
      sbr_specific_obligations: aiContext.sbr_specific_obligations || [],
      drift_risk_summary:     aiContext.drift_risk_summary     || '',
    })

    return NextResponse.json({ profile, matrix: regCtx.applicable })

  } catch(e) {
    console.error('entity-mandate error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
