import { NextResponse } from 'next/server'
import { getEntityRegulatoryContext } from '../../../lib/regulatoryContext'

export async function POST(req) {
  const apiKey = process.env.PCRAF_Key
  if (!apiKey) return NextResponse.json({ error: 'PCRAF_Key not set' }, { status: 500 })

  const body             = await req.json()
  const functionalType   = body.functionalType   || ''
  const sbrLayer         = body.sbrLayer         || ''
  const totalAssets      = body.totalAssets      || ''
  const entityName       = body.entityName       || ''
  const cbs              = body.cbs              || ''
  const cloud            = body.cloud            || ''
  const recentChanges    = body.recentChanges    || ''
  const knownWeaknesses  = body.knownWeaknesses  || ''
  const externalSignals  = body.externalSignals  || ''

  try {
    // Step 1: Get verified regulatory context from Supabase matrix
    const regCtx = await getEntityRegulatoryContext(functionalType, sbrLayer)

    // Step 2: Build prompt using verified matrix data as foundation
    const prompt = [
      'You are a Principal IT Audit Consultant under AI-PCRAF v3.0 for Indian BFSI.',
      'Your role is to EXPLAIN and ELABORATE the verified requirements below.',
      'Do NOT add requirements not in the list. Do NOT remove requirements that are in it.',
      '',
      regCtx.contextString,
      '',
      'ENTITY DETAILS:',
      'Name: ' + (entityName || 'Not specified'),
      'Functional type: ' + functionalType,
      'SBR layer: ' + sbrLayer,
      'Total assets: Rs ' + (totalAssets || 'Not specified') + ' Crore',
      'CBS: ' + (cbs || 'Not specified'),
      'Cloud: ' + (cloud || 'Not specified'),
      'Recent changes: ' + (recentChanges || 'None declared'),
      'Known weaknesses: ' + (knownWeaknesses || 'None declared'),
      'External signals: ' + (externalSignals || 'None declared'),
      '',
      'Generate the mandate profile JSON using ONLY the verified requirements above.',
      'Return ONLY a JSON object. No markdown. Start with { end with }',
      '',
      'Required fields:',
      'mandatory_it_mandates: array — one item per MANDATORY REQUIREMENT above, exactly as listed',
      'priority_domains: array — order the requirement categories by audit risk for this entity',
      'applicable_regulations: array — the APPLICABLE REGULATORY FRAMEWORKS listed above',
      'cii_presumption: boolean — true only if entity is SCB, NBFC-UL, NBFC-TL, NBFC-IFC, IDF-NBFC',
      'cii_reasoning: string — one sentence explanation',
      'pii_always_involved: boolean — true if entity handles customer PII by nature',
      'pii_reasoning: string — one sentence explanation',
      'audit_focus_areas: array — 5 specific areas derived from requirements and entity risk signals',
      'sbr_specific_obligations: array - obligations unique to ' + sbrLayer + ' not shared by all layers',
      'mandate_version: string — list the applicable framework ref codes',
      'blind_spots_active: array — BS-IDs applicable: BS-01 if DPDP rules pending, BS-04 if CII uncertain',
    ].join('\n')

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        max_tokens: 2000,
        messages: [
          { role: 'system', content: 'Return ONLY valid JSON. No markdown. No preamble. Start with { end with }. Use ONLY the verified requirements provided. Do not invent requirements.' },
          { role: 'user', content: prompt }
        ]
      })
    })

    const data = await r.json()
    if (!r.ok || data.error) {
      return NextResponse.json({ error: data.error?.message || 'Groq error' }, { status: r.status })
    }

    const raw   = data.choices?.[0]?.message?.content || '{}'
    const fb    = raw.indexOf('{')
    const lb    = raw.lastIndexOf('}')
    const clean = fb !== -1 && lb > fb ? raw.substring(fb, lb+1) : raw

    try {
      const profile = JSON.parse(clean)

      // Step 3: Override key fields with verified matrix facts — non-negotiable
      const govReqs   = regCtx.applicable.filter(function(r) { return r.category === 'Governance' })
      profile.ciso_required         = govReqs.some(function(r) { return r.code === 'GOV-003' })
      profile.it_committee_required = govReqs.some(function(r) { return r.code === 'GOV-001' })
      profile.soc_required          = regCtx.applicable.some(function(r) { return r.code === 'INF-001' })
      profile.governing_framework   = regCtx.applicableRefs.map(function(r) { return r.ref_code }).join(' + ')
      profile.verified_requirements = regCtx.applicable
      profile.not_applicable        = regCtx.notApplicable
      profile.sbr_verified_facts    = {
        source:               'Supabase regulatory_compliance_matrix',
        verified:             true,
        applicable_count:     regCtx.applicable.length,
        not_applicable_count: regCtx.notApplicable.length,
        ciso_required:        profile.ciso_required,
        it_committee_required:profile.it_committee_required,
        soc_required:         profile.soc_required,
      }

      return NextResponse.json({ profile, matrix: regCtx.applicable })
    } catch(e) {
      return NextResponse.json({ error: 'JSON parse error', raw })
    }

  } catch(e) {
    console.error('entity-mandate error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
