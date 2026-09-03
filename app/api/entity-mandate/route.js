import { NextResponse } from 'next/server'

const FUNCTIONAL_TYPES = {
  'NBFC-ICC':  { nof:'10 Crore', soc:true,  ciso:true,  itc:true,  cii:false, pii:false, priority:['CBS','IAM','DLP','AUD','TPR'] },
  'NBFC-MFI':  { nof:'10 Crore', soc:true,  ciso:true,  itc:true,  cii:false, pii:true,  priority:['CBS','API','DLP','IAM','AUD'] },
  'NBFC-HFC':  { nof:'20 Crore', soc:true,  ciso:true,  itc:true,  cii:false, pii:true,  priority:['CBS','DLP','TPR','IAM','AUD'] },
  'NBFC-Factor':{ nof:'10 Crore',soc:false, ciso:true,  itc:true,  cii:false, pii:false, priority:['API','CBS','AUD','TPR','IAM'] },
  'NBFC-AA':   { nof:'2 Crore',  soc:true,  ciso:true,  itc:false, cii:false, pii:true,  priority:['API','IAM','DLP','AUD','CLD'] },
  'NBFC-P2P':  { nof:'2 Crore',  soc:true,  ciso:true,  itc:false, cii:false, pii:true,  priority:['API','IAM','DLP','AUD','CBS'] },
  'NBFC-CIC':  { nof:'100 Crore',soc:false, ciso:true,  itc:true,  cii:false, pii:false, priority:['AUD','IAM','TPR','CBS','CLD'] },
  'NBFC-IFC':  { nof:'300 Crore',soc:true,  ciso:true,  itc:true,  cii:true,  pii:false, priority:['CBS','TPR','CLD','AUD','IAM'] },
  'IDF-NBFC':  { nof:'300 Crore',soc:false, ciso:true,  itc:true,  cii:true,  pii:false, priority:['CBS','AUD','TPR','CLD','IAM'] },
  'NBFC-MGC':  { nof:'100 Crore',soc:false, ciso:true,  itc:true,  cii:false, pii:false, priority:['CBS','AUD','TPR','IAM','DLP'] },
  'NOFHC':     { nof:'N/A',      soc:false, ciso:false, itc:false, cii:false, pii:false, priority:['AUD','IAM','CLD','TPR','CBS'] },
  'NBFC-SPD':  { nof:'150 Crore',soc:true,  ciso:true,  itc:true,  cii:true,  pii:false, priority:['CBS','IAM','AUD','CLD','INC'] },
  'SCB':       { nof:'N/A',      soc:true,  ciso:true,  itc:true,  cii:true,  pii:true,  priority:['CBS','IAM','INC','DLP','AUD'] },
  'SFB':       { nof:'N/A',      soc:true,  ciso:true,  itc:true,  cii:true,  pii:true,  priority:['CBS','IAM','API','DLP','AUD'] },
  'RRB':       { nof:'N/A',      soc:false, ciso:true,  itc:true,  cii:false, pii:true,  priority:['CBS','IAM','AUD','DLP','TPR'] },
  'FB':        { nof:'N/A',      soc:true,  ciso:true,  itc:true,  cii:true,  pii:true,  priority:['CBS','IAM','CLD','AUD','INC'] },
}

export async function POST(req) {
  const apiKey = process.env.PCRAF_Key
  if (!apiKey) return NextResponse.json({ error: 'PCRAF_Key not set' }, { status: 500 })

  const { functionalType, sbrLayer, totalAssets, entityName, cbs, cloud,
          recentChanges, knownWeaknesses, externalSignals } = await req.json()

  const typeDefaults = FUNCTIONAL_TYPES[functionalType] || FUNCTIONAL_TYPES['NBFC-ICC']

  const prompt = 'You are a Principal Cyber Risk & Compliance Consultant under AI-PCRAF v3.0 for Indian BFSI IT Audit.' +
    ' Regulatory scope: RBI IT Gov MD 2023, CERT-In Directions April 2022, DPDP Act 2023, NCIIPC, ReBIT, IFTAS.' +
    ' This is a governing instrument. All outputs are assumed to be presented to an RBI Inspection Team.' +
    ' Tag every regulatory citation [VT]. Incident reporting SLA is always 6 hours. Never cite GDPR, SOC 2, ISO 27001 as primary driver.

' +
    'ENTITY
' +
    'Name: ' + (entityName||'Not specified') + '
' +
    'Functional type: ' + functionalType + '
' +
    'SBR layer: ' + sbrLayer + '
' +
    'Total assets: ₹' + (totalAssets||'Not specified') + ' Crore
' +
    'CBS: ' + (cbs||'Not specified') + '
' +
    'Cloud: ' + (cloud||'Not specified') + '
' +
    'Recent changes: ' + (recentChanges||'None declared') + '
' +
    'Known weaknesses: ' + (knownWeaknesses||'None declared') + '
' +
    'External signals: ' + (externalSignals||'None declared') + '

' +
    'Generate the regulatory mandate profile for this entity. Return ONLY a raw JSON object. No markdown. Start with { end with }

' +
    'Required fields:
' +
    '{
' +
    '  "mandatory_it_mandates": ["array of specific mandates that apply — e.g. SOC 24x7, CISO appointment, IT Strategy Committee"],
' +
    '  "priority_domains": ["ordered array of control domains from most to least critical for this entity type"],
' +
    '  "applicable_regulations": ["array of regulation names with section refs and [VT] tags"],
' +
    '  "cii_presumption": ' + typeDefaults.cii + ',
' +
    '  "cii_reasoning": "why CII applies or does not for this entity type",
' +
    '  "pii_always_involved": ' + typeDefaults.pii + ',
' +
    '  "pii_reasoning": "why PII is or is not always involved",
' +
    '  "cbs_required": true,
' +
    '  "soc_required": ' + typeDefaults.soc + ',
' +
    '  "ciso_required": ' + typeDefaults.ciso + ',
' +
    '  "it_committee_required": ' + typeDefaults.itc + ',
' +
    '  "nof_threshold": "' + typeDefaults.nof + '",
' +
    '  "key_circulars": ["specific RBI circulars applicable to this entity type with dates [VT]"],
' +
    '  "audit_focus_areas": ["minimum 5 specific audit focus areas derived from entity type and declared risk signals"],
' +
    '  "sbr_specific_obligations": ["obligations specific to ' + sbrLayer + ' — not generic to all entities"],
' +
    '  "mandate_version": "RBI IT Gov MD 2023 + CERT-In Dir April 2022",
' +
    '  "blind_spots_active": ["list BS-IDs applicable to this entity — e.g. BS-01 if DPDP applies"]
' +
    '}'

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b', max_tokens: 2000,
        messages: [
          { role: 'system', content: 'Return ONLY valid JSON. No markdown. No preamble. Start with { end with }' },
          { role: 'user', content: prompt }
        ]
      })
    })
    const data = await r.json()
    if (!r.ok || data.error) return NextResponse.json({ error: data.error?.message || 'Groq error' }, { status: r.status })
    const raw = data.choices?.[0]?.message?.content || '{}'
    const fb = raw.indexOf('{'), lb = raw.lastIndexOf('}')
    const clean = fb !== -1 && lb > fb ? raw.substring(fb, lb+1) : raw
    try {
      const profile = JSON.parse(clean)
      return NextResponse.json({ profile })
    } catch(e) { return NextResponse.json({ error: 'Parse error', raw }) }
  } catch(e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
