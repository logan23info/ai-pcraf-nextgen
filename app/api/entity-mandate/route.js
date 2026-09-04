import { NextResponse } from 'next/server'

// VERIFIED regulatory facts per RBI ITGRCA MD 2023 + SBR MD Oct 2023
// Source: RBI Master Directions — do NOT override with AI inference
// BL = Base Layer (2017 IT Framework only — ITGRCA 2023 NOT applicable)
// ML/UL/TL = ITGRCA 2023 applies (effective April 1 2024)
// CIC = exempt from ITGRCA 2023 — SBR MD only
// SCB = RBI CB Cyber Directions 2026 (effective July 31 2026)

const SBR_FACTS = {
  // [governing_framework, ciso_required, it_committee, soc, is_audit, bcp, cii_presumptive]
  'BL':  ['2017 IT Framework Section B', false, false, false, true,  true,  false],
  'ML':  ['ITGRCA MD 2023',             true,  true,  true,  true,  true,  false],
  'UL':  ['ITGRCA MD 2023',             true,  true,  true,  true,  true,  true],
  'TL':  ['ITGRCA MD 2023',             true,  true,  true,  true,  true,  true],
  'SCB': ['CB Cyber Directions 2026',   true,  true,  true,  true,  true,  true],
  'SFB': ['ITGRCA MD 2023',             true,  true,  true,  true,  true,  true],
  'RRB': ['2017 IT Framework',          false, false, false, true,  true,  false],
  'FB':  ['CB Cyber Directions 2026',   true,  true,  true,  true,  true,  true],
}

const FUNCTIONAL_TYPES = {
  'NBFC-ICC':   { nof:'10 Crore',  cii:false, pii:false, priority:['CBS','IAM','DLP','AUD','TPR'] },
  'NBFC-MFI':   { nof:'10 Crore',  cii:false, pii:true,  priority:['CBS','API','DLP','IAM','AUD'] },
  'NBFC-HFC':   { nof:'20 Crore',  cii:false, pii:true,  priority:['CBS','DLP','TPR','IAM','AUD'] },
  'NBFC-Factor':{ nof:'10 Crore',  cii:false, pii:false, priority:['API','CBS','AUD','TPR','IAM'] },
  'NBFC-AA':    { nof:'2 Crore',   cii:false, pii:true,  priority:['API','IAM','DLP','AUD','CLD'] },
  'NBFC-P2P':   { nof:'2 Crore',   cii:false, pii:true,  priority:['API','IAM','DLP','AUD','CBS'] },
  'NBFC-CIC':   { nof:'100 Crore', cii:false, pii:false, priority:['AUD','IAM','TPR','CBS','CLD'],
                  note:'Exempt from ITGRCA 2023 - SBR MD Oct 2023 only' },
  'NBFC-IFC':   { nof:'300 Crore', cii:true,  pii:false, priority:['CBS','TPR','CLD','AUD','IAM'] },
  'IDF-NBFC':   { nof:'300 Crore', cii:true,  pii:false, priority:['CBS','AUD','TPR','CLD','IAM'] },
  'NBFC-MGC':   { nof:'100 Crore', cii:false, pii:false, priority:['CBS','AUD','TPR','IAM','DLP'] },
  'NOFHC':      { nof:'N/A',       cii:false, pii:false, priority:['AUD','IAM','CLD','TPR','CBS'] },
  'NBFC-SPD':   { nof:'150 Crore', cii:true,  pii:false, priority:['CBS','IAM','AUD','CLD','INC'] },
  'SCB':        { nof:'N/A',       cii:true,  pii:true,  priority:['CBS','IAM','INC','DLP','AUD'] },
  'SFB':        { nof:'N/A',       cii:true,  pii:true,  priority:['CBS','IAM','API','DLP','AUD'] },
  'RRB':        { nof:'N/A',       cii:false, pii:true,  priority:['CBS','IAM','AUD','DLP','TPR'] },
  'FB':         { nof:'N/A',       cii:true,  pii:true,  priority:['CBS','IAM','CLD','AUD','INC'] },
}

// Derive SBR key from sbrLayer string
function getSBRKey(sbrLayer, functionalType) {
  if (functionalType === 'SCB' || functionalType === 'FB') return 'SCB'
  if (functionalType === 'SFB') return 'SFB'
  if (functionalType === 'RRB') return 'RRB'
  if (sbrLayer && sbrLayer.includes('Upper')) return 'UL'
  if (sbrLayer && sbrLayer.includes('Top'))   return 'TL'
  if (sbrLayer && sbrLayer.includes('Middle')) return 'ML'
  return 'BL'
}

function buildPrompt(functionalType, sbrLayer, totalAssets, entityName, cbs, cloud,
                     recentChanges, knownWeaknesses, externalSignals, td, sbrFacts) {
  const framework    = sbrFacts ? sbrFacts[0] : 'Unknown framework'
  const cisoReq      = sbrFacts ? sbrFacts[1] : false
  const itcReq       = sbrFacts ? sbrFacts[2] : false
  const socReq       = sbrFacts ? sbrFacts[3] : false
  const isAuditReq   = sbrFacts ? sbrFacts[4] : true
  const bcpReq       = sbrFacts ? sbrFacts[5] : true
  const ciiPresumed  = sbrFacts ? sbrFacts[6] : false
  return [
    'You are a Principal Cyber Risk Compliance Consultant under AI-PCRAF v3.0 for Indian BFSI IT Audit.',
    'Regulatory scope: RBI IT Gov MD 2023, CERT-In Directions April 2022, DPDP Act 2023, NCIIPC, ReBIT, IFTAS.',
    'Tag every regulatory citation [VT]. Incident reporting SLA is always 6 hours. Never cite GDPR, SOC 2, ISO 27001.',
    '',
    'ENTITY',
    'REGULATORY FRAMEWORK (verified September 2026):',
    'SCB/Commercial Banks: RBI Cybersecurity Directions 2026 (Jul 31 2026, effective immediately) - supersedes 2016 framework',
    'NBFC-ML/UL/TL: ITGRCA Master Direction (Nov 2023, effective Apr 2024) - still current',
    'NBFC-BL: 2017 IT Framework Section B - NOT the 2023 MD',
    'NBFC-CIC: Exempt from IT Gov MD - SBR MD Oct 2023 only',
    'All entities: CERT-In Directions April 2022 (6-hour SLA) - still current',
    '',
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
    'Generate the regulatory mandate profile. Return ONLY a raw JSON object. No markdown. Start with { end with }',
    '',
    'Required JSON fields:',
    'mandatory_it_mandates: array of specific mandates that apply for this entity type',
    'priority_domains: ordered array of control domains most to least critical',
    'applicable_regulations: array of regulation names with section refs and [VT] tags',
    'cii_presumption: ' + td.cii,
    'cii_reasoning: why CII applies or does not for this entity type',
    'pii_always_involved: ' + td.pii,
    'pii_reasoning: why PII is or is not always involved',
    'cbs_required: true',
    'HARDCODED REGULATORY FACTS (verified - do not override):',
    'Governing framework: ' + framework,
    'CISO mandatory: ' + cisoReq + ' (verified per RBI SBR layer)',
    'IT Strategy + Steering Committee mandatory: ' + itcReq + ' (verified per RBI SBR layer)',
    'SOC mandatory: ' + socReq + ' (verified per RBI SBR layer)',
    'IS Audit mandatory: ' + isAuditReq,
    'BCP/DR mandatory: ' + bcpReq,
    'CII presumptive: ' + ciiPresumed,
    '',
    'CRITICAL: You MUST use these hardcoded facts in your output.',
    'Do NOT add CISO or IT Committee requirements for Base Layer NBFCs.',
    'Do NOT cite ITGRCA 2023 for Base Layer NBFCs.',
    'Do NOT cite 2017 IT Framework for Middle/Upper Layer NBFCs.',
    '',
    'soc_required: ' + socReq,
    'ciso_required: ' + cisoReq,
    'it_committee_required: ' + itcReq,
    'nof_threshold: ' + td.nof,
    'key_circulars: array of specific RBI circulars applicable to this entity type',
    'audit_focus_areas: minimum 5 specific audit focus areas derived from entity type and risk signals',
    'sbr_specific_obligations: obligations specific to ' + sbrLayer + ' not generic to all entities',
    'mandate_version: RBI IT Gov MD 2023 + CERT-In Dir April 2022',
    'blind_spots_active: array of BS-IDs applicable to this entity',
  ].join('\n')
}

export async function POST(req) {
  const apiKey = process.env.PCRAF_Key
  if (!apiKey) return NextResponse.json({ error: 'PCRAF_Key not set' }, { status: 500 })

  const body = await req.json()
  const functionalType  = body.functionalType  || ''
  const sbrLayer        = body.sbrLayer        || ''
  const totalAssets     = body.totalAssets     || ''
  const entityName      = body.entityName      || ''
  const cbs             = body.cbs             || ''
  const cloud           = body.cloud           || ''
  const recentChanges   = body.recentChanges   || ''
  const knownWeaknesses = body.knownWeaknesses || ''
  const externalSignals = body.externalSignals || ''

  const td         = FUNCTIONAL_TYPES[functionalType] || FUNCTIONAL_TYPES['NBFC-ICC']
  const sbrKey     = getSBRKey(sbrLayer, functionalType)
  const sbrFacts   = SBR_FACTS[sbrKey] || SBR_FACTS['BL']
  // Extract verified facts in POST scope so override works
  const framework  = sbrFacts[0]
  const cisoReq    = sbrFacts[1]
  const itcReq     = sbrFacts[2]
  const socReq     = sbrFacts[3]
  const isAuditReq = sbrFacts[4]
  const bcpReq     = sbrFacts[5]
  const ciiPresumed = sbrFacts[6]
  const prompt     = buildPrompt(functionalType, sbrLayer, totalAssets, entityName,
    cbs, cloud, recentChanges, knownWeaknesses, externalSignals, td, sbrFacts)

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        max_tokens: 2000,
        messages: [
          { role: 'system', content: 'Return ONLY valid JSON. No markdown. No preamble. Start with { end with }' },
          { role: 'user',   content: prompt }
        ]
      })
    })
    const data = await r.json()
    if (!r.ok || data.error) {
      return NextResponse.json({ error: data.error && data.error.message ? data.error.message : 'Groq error' }, { status: r.status })
    }
    const raw = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '{}'
    const fb = raw.indexOf('{')
    const lb = raw.lastIndexOf('}')
    const clean = fb !== -1 && lb > fb ? raw.substring(fb, lb + 1) : raw
    try {
      const profile = JSON.parse(clean)
      // Hard override — AI output for these fields is NEVER trusted
      profile.ciso_required         = cisoReq
      profile.it_committee_required = itcReq
      profile.soc_required          = socReq
      profile.cii_presumption       = ciiPresumed || (td.cii || false)
      profile.pii_always_involved   = td.pii || false
      profile.governing_framework   = framework
      profile.nof_threshold         = td.nof || 'Not specified'

      // Clean mandatory_it_mandates — remove items that don't apply to this layer
      if (Array.isArray(profile.mandatory_it_mandates)) {
        profile.mandatory_it_mandates = profile.mandatory_it_mandates.filter(function(m) {
          const ml = m.toLowerCase()
          if (!cisoReq && (ml.includes('ciso') || ml.includes('chief information security'))) return false
          if (!itcReq  && (ml.includes('it strategy committee') || ml.includes('it steering committee'))) return false
          if (!socReq  && ml.includes('security operations centre')) return false
          return true
        })
        // Add what IS required if missing
        if (!cisoReq) profile.mandatory_it_mandates.push('IS function head designation — 2017 IT Framework Section B (not CISO appointment)')
        if (!socReq)  profile.mandatory_it_mandates.push('Basic security monitoring — 2017 IT Framework (SOC not mandatory for BL)')
      }
      profile.sbr_verified_facts    = {
        framework, ciso_required: cisoReq, it_committee_required: itcReq,
        soc_required: socReq, is_audit_required: isAuditReq,
        bcp_required: bcpReq, cii_presumptive: ciiPresumed,
        source: 'RBI ITGRCA MD 2023 + SBR MD Oct 2023 + CB Cyber Directions 2026',
        verified: true
      }
      return NextResponse.json({ profile })
    } catch(e) {
      return NextResponse.json({ error: 'Parse error', raw: raw })
    }
  } catch(e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
