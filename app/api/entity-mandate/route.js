import { NextResponse } from 'next/server'

const FUNCTIONAL_TYPES = {
  'NBFC-ICC':   { nof:'10 Crore',  soc:true,  ciso:true,  itc:true,  cii:false, pii:false, priority:['CBS','IAM','DLP','AUD','TPR'] },
  'NBFC-MFI':   { nof:'10 Crore',  soc:true,  ciso:true,  itc:true,  cii:false, pii:true,  priority:['CBS','API','DLP','IAM','AUD'] },
  'NBFC-HFC':   { nof:'20 Crore',  soc:true,  ciso:true,  itc:true,  cii:false, pii:true,  priority:['CBS','DLP','TPR','IAM','AUD'] },
  'NBFC-Factor':{ nof:'10 Crore',  soc:false, ciso:true,  itc:true,  cii:false, pii:false, priority:['API','CBS','AUD','TPR','IAM'] },
  'NBFC-AA':    { nof:'2 Crore',   soc:true,  ciso:true,  itc:false, cii:false, pii:true,  priority:['API','IAM','DLP','AUD','CLD'] },
  'NBFC-P2P':   { nof:'2 Crore',   soc:true,  ciso:true,  itc:false, cii:false, pii:true,  priority:['API','IAM','DLP','AUD','CBS'] },
  'NBFC-CIC':   { nof:'100 Crore', soc:false, ciso:true,  itc:true,  cii:false, pii:false, priority:['AUD','IAM','TPR','CBS','CLD'] },
  'NBFC-IFC':   { nof:'300 Crore', soc:true,  ciso:true,  itc:true,  cii:true,  pii:false, priority:['CBS','TPR','CLD','AUD','IAM'] },
  'IDF-NBFC':   { nof:'300 Crore', soc:false, ciso:true,  itc:true,  cii:true,  pii:false, priority:['CBS','AUD','TPR','CLD','IAM'] },
  'NBFC-MGC':   { nof:'100 Crore', soc:false, ciso:true,  itc:true,  cii:false, pii:false, priority:['CBS','AUD','TPR','IAM','DLP'] },
  'NOFHC':      { nof:'N/A',       soc:false, ciso:false, itc:false, cii:false, pii:false, priority:['AUD','IAM','CLD','TPR','CBS'] },
  'NBFC-SPD':   { nof:'150 Crore', soc:true,  ciso:true,  itc:true,  cii:true,  pii:false, priority:['CBS','IAM','AUD','CLD','INC'] },
  'SCB':        { nof:'N/A',       soc:true,  ciso:true,  itc:true,  cii:true,  pii:true,  priority:['CBS','IAM','INC','DLP','AUD'] },
  'SFB':        { nof:'N/A',       soc:true,  ciso:true,  itc:true,  cii:true,  pii:true,  priority:['CBS','IAM','API','DLP','AUD'] },
  'RRB':        { nof:'N/A',       soc:false, ciso:true,  itc:true,  cii:false, pii:true,  priority:['CBS','IAM','AUD','DLP','TPR'] },
  'FB':         { nof:'N/A',       soc:true,  ciso:true,  itc:true,  cii:true,  pii:true,  priority:['CBS','IAM','CLD','AUD','INC'] },
}

function buildPrompt(functionalType, sbrLayer, totalAssets, entityName, cbs, cloud,
                     recentChanges, knownWeaknesses, externalSignals, td) {
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
    'IMPORTANT FRAMEWORK SELECTION:',
    'If functional_type is SCB: cite RBI Cybersecurity Directions 2026 (Jul 31 2026) as PRIMARY framework',
    'If functional_type is NBFC-ML/UL/TL: cite ITGRCA Master Direction Nov 2023 as PRIMARY framework',
    'If functional_type is NBFC-BL: cite 2017 IT Framework Section B as PRIMARY - DO NOT cite 2023 MD',
    'If functional_type is NBFC-CIC: cite SBR MD Oct 2023 only - exempt from IT Gov MD',
    '',
    'soc_required: ' + td.soc,
    'ciso_required: ' + td.ciso,
    'it_committee_required: ' + td.itc,
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

  const td = FUNCTIONAL_TYPES[functionalType] || FUNCTIONAL_TYPES['NBFC-ICC']
  const prompt = buildPrompt(functionalType, sbrLayer, totalAssets, entityName,
    cbs, cloud, recentChanges, knownWeaknesses, externalSignals, td)

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
      return NextResponse.json({ profile })
    } catch(e) {
      return NextResponse.json({ error: 'Parse error', raw: raw })
    }
  } catch(e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
