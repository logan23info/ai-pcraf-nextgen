import { NextResponse } from 'next/server'

export async function POST(req) {
  const apiKey = process.env.PCRAF_Key
  if (!apiKey) return NextResponse.json({ error: 'PCRAF_Key not set' }, { status: 500 })
  const body = await req.json()
  const { incident='', pii='unknown', cii='unknown', financial='yes', severity='Sev-1', entity={}, detectedAt='', incidentRef='' } = body
  if (!incident) return NextResponse.json({ error: 'incident required' }, { status: 400 })

  const prompt = `You are a Principal Cyber Risk & Compliance Consultant under AI-PCRAF v3.0.
Entity: ${entity.name||'Not specified'} (${entity.type||'Not specified'})
Incident: ${incident}
Severity: ${severity} | PII: ${pii} | CII: ${cii} | Financial: ${financial}
Detection: ${detectedAt} | Reference: ${incidentRef}

Return ONLY a raw JSON object with these fields:
incident_ref, report_generated_at, entity_name, entity_type, rbi_registration_no, cert_in_empanelled,
incident_type, incident_description, severity, attack_vector, detected_at, reported_at, sla_deadline,
systems_affected, pii_involved, pii_records_affected, cii_involved, financial_system_involved,
estimated_financial_impact, containment_status, containment_actions, root_cause_preliminary,
attack_indicators, evidence_artifacts, agencies_notified(array), rbi_daksh_sla, cert_in_sla,
nciipc_required, dpdp_board_required, escalation_path, nodal_officer_name, nodal_officer_contact,
bs02_declaration, bs01_declaration, bs04_declaration,
pre_submission_checklist(object with 8 boolean fields), source_truth_status, fabrication_flag

SLA rules: RBI DAKSH and CERT-In always 6 hours. NCIIPC Immediate if CII=yes. DPDP Immediate if PII=yes.
bs02_declaration must warn about DAKSH schema not being independently verified [BS-02].
Start with { end with }`

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},
      body: JSON.stringify({ model:'openai/gpt-oss-120b', max_tokens:1800,
        messages:[
          {role:'system',content:'Return ONLY valid JSON. No markdown. No preamble.'},
          {role:'user',content:prompt}
        ]})
    })
    const data = await r.json()
    if (!r.ok||data.error) return NextResponse.json({error:data.error?.message||'Groq error'},{status:r.status})
    const raw = data.choices?.[0]?.message?.content||''
    const fb = raw.indexOf('{'), lb = raw.lastIndexOf('}')
    const clean = fb!==-1&&lb>fb ? raw.substring(fb,lb+1) : raw
    try { return NextResponse.json({payload:JSON.parse(clean)}) }
    catch(e) { return NextResponse.json({raw,parse_error:e.message}) }
  } catch(e) { return NextResponse.json({error:e.message},{status:500}) }
}
