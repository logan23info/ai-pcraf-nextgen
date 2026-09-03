"use client"
import { useState, useEffect } from 'react'
import { callAPI } from '../lib/api'
import { formatAIOutput } from '../lib/formatter'
import { useEngagement } from '../lib/EngagementContext'
import { Card, SectionHeader, FormGrid, FormGroup, Input, Select, Textarea, BtnRow, Btn, Spinner, AIOutput, Table, Tag, TierBadge } from './ui'

const DOMAINS = [
  ['AD-01','AD-01 — IT Internal Audit & Attestation'],
  ['AD-02','AD-02 — ERP & Core Banking Security'],
  ['AD-03','AD-03 — Cloud & Infrastructure'],
  ['AD-04','AD-04 — Responsible AI Governance'],
  ['AD-05','AD-05 — Third-Party & API Risk'],
  ['AD-06','AD-06 — Incident Response & Reporting'],
  ['AD-07','AD-07 — Data Localisation & Privacy'],
]
const CTRL_DOMAINS = [
  ['CBS','CBS — Core Banking System'],['CLD','CLD — Cloud Infrastructure'],
  ['API','API — API & Integration'],['IAM','IAM — Identity & Access'],
  ['AI','AI — AI/ML Models'],['INC','INC — Incident Response'],
  ['TPR','TPR — Third-Party Risk'],['DLP','DLP — Data Loss Prevention'],
  ['AUD','AUD — Audit & Attestation'],
]

export default function ControlMatrix({ user, sb, controls, loadControls, currentEntityId, entityName, showToast }) {
  const { mandateProfile, driftTriggers, entity } = useEngagement()

  // Pre-fill tier from entity context
  const defaultTier = entity?.sbr_layer?.includes('Upper') ? 'NBFC-UL'
    : entity?.sbr_layer?.includes('Middle') ? 'NBFC-ML'
    : entity?.sbr_layer?.includes('Base') ? 'NBFC-BL'
    : entity?.functional_type || 'NBFC-ML'

  // Priority domains from mandate profile
  const priorityDomains = mandateProfile?.priority_domains || []
  const activeTriggers  = driftTriggers.filter(t => t.cascade_status === 'ACTIVE')

  const [domain, setDomain]         = useState('AD-01')
  const [ctrlDomain, setCtrlDomain] = useState('CBS')
  const [subsystem, setSubsystem]   = useState('')
  const [tier, setTier]             = useState(defaultTier)
  const [focus, setFocus]         = useState('')
  const [output, setOutput]       = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  useEffect(() => { loadControls() }, [])

  function domainSeq() {
    return controls.filter(c => c.ctrl_domain === ctrlDomain).length + 1
  }

  async function generate() {
    if (!focus) { showToast('Describe the control focus'); return }
    const seq = domainSeq()
    const controlId = 'CA-' + ctrlDomain + '-' + String(seq).padStart(2,'0')
    setLoading(true); setOutput(''); setError('')

    const entityCtx = (currentEntityId && entityName)
      ? `Entity: ${entityName}. Tier: ${tier}.`
      : `Tier: ${tier}.`

    const prompt = `You are a Principal Cyber Risk & Compliance Consultant under AI-PCRAF v3.0 for Indian BFSI IT Audit.
Regulatory scope: RBI IT Gov MD 2023, CERT-In Directions April 2022, DPDP Act 2023, NCIIPC, ReBIT, IFTAS.

CONTEXT
${entityCtx}
Control ID: ${controlId}
Assurance domain: ${domain}
Control domain: ${ctrlDomain}
Subsystem: ${subsystem||'derive from control focus'}
Entity tier: ${tier}
Control focus: ${focus}

INSTRUCTION
Return ONLY a raw JSON object. No markdown. No backticks. No explanation. Start with { end with }
Required string fields: control_id, control_name, assurance_domain, subsystem, primary_codex_ref, secondary_codex_ref, source_truth_status, risk_description, risk_rating, inherent_risk, residual_risk, control_type, control_mode, testing_frequency, ai_testing_procedure, manual_procedure, evidence_artifacts, drift_indicator, drift_threshold, reporting_sla, fabrication_flag, blind_spot_note, cot_trigger, cot_codex, cot_tier, cot_design, cot_evidence, cot_failure, fieldwork_test_steps, sample_size, evidence_request_list
Required non-string: tier_applicability (string[]), reportable_to (string[]), blind_spot_flag (boolean)
risk_rating: Critical|High|Medium|Low
control_type: Preventive|Detective|Corrective
control_mode: Automated|Manual|Hybrid
source_truth_status: VERIFIED-TRAINING
fabrication_flag: VT
CITATION RULES:
- primary_codex_ref format: DocumentName, Chapter X, Section Y.Z [VT]
- CERT-In Directions April 2022 — always include "April 2022"
- reportable_to: use exact tokens RBI_DAKSH, CERT-In, NCIIPC, DPDP_Board
- SLA always 6 hours — never 24, 48, or 72 hours
- Never cite GDPR, SOC 2, ISO 27001, NIST as primary driver`

    try {
      let p = null
      for (let attempt = 1; attempt <= 2; attempt++) {
        const raw = await callAPI(prompt, 2500)
        const fb = raw.indexOf('{'), lb = raw.lastIndexOf('}')
        const clean = fb !== -1 && lb > fb ? raw.substring(fb, lb+1) : raw
        try { p = JSON.parse(clean); break }
        catch { if (attempt===2) { setError('[JSON parse error after 2 attempts]\n\n' + raw); return } }
        await new Promise(r => setTimeout(r, 800))
      }

      const lines = [
        'CONTROL_OBJECT  ' + p.control_id,
        '─────────────────────────────────────────────────',
        'Name            ' + p.control_name,
        'Domain          ' + p.assurance_domain,
        'Subsystem       ' + p.subsystem,
        'Tier            ' + (p.tier_applicability||[]).join(', '),
        '',
        'Primary ref     ' + p.primary_codex_ref,
        'Secondary ref   ' + p.secondary_codex_ref,
        'Source truth    [' + p.source_truth_status + ']',
        '',
        'Risk            ' + p.risk_description,
        'Risk rating     ' + p.risk_rating,
        'Inherent risk   ' + p.inherent_risk,
        'Residual risk   ' + p.residual_risk,
        '',
        'Control type    ' + p.control_type,
        'Control mode    ' + p.control_mode,
        'Frequency       ' + p.testing_frequency,
        'AI procedure    ' + p.ai_testing_procedure,
        'Manual proc.    ' + p.manual_procedure,
        '',
        'Evidence        ' + p.evidence_artifacts,
        'Drift indicator ' + p.drift_indicator,
        'Drift threshold ' + p.drift_threshold,
        '',
        'Reportable to   ' + (p.reportable_to||[]).join(', '),
        'Reporting SLA   ' + p.reporting_sla,
        'Blind spot      ' + (p.blind_spot_flag ? p.blind_spot_note : 'None'),
        '',
        'COT REASONING',
        '─────────────────────────────────────────────────',
        p.cot_trigger, p.cot_codex, p.cot_tier, p.cot_design, p.cot_evidence, p.cot_failure,
        '',
        'FIELDWORK PACK  (IIA Standard 2310)',
        '─────────────────────────────────────────────────',
        'Test steps:     ' + p.fieldwork_test_steps,
        'Sample size:    ' + p.sample_size,
        'Evidence req:   ' + p.evidence_request_list,
      ]
      const displayText = lines.join('\n')
      setOutput(formatAIOutput(displayText))

      const dbRow = {
        user_id: user.id, entity_id: currentEntityId||null,
        control_id: p.control_id, ctrl_domain: ctrlDomain, ad_domain: p.assurance_domain,
        subsystem: p.subsystem, tier, focus: focus.substring(0,80),
        control_name: p.control_name, primary_codex_ref: p.primary_codex_ref,
        secondary_codex_ref: p.secondary_codex_ref, source_truth_status: p.source_truth_status,
        risk_description: p.risk_description, risk_rating: p.risk_rating,
        inherent_risk: p.inherent_risk, residual_risk: p.residual_risk,
        control_type: p.control_type, control_mode: p.control_mode,
        testing_frequency: p.testing_frequency, ai_testing_procedure: p.ai_testing_procedure,
        manual_procedure: p.manual_procedure, evidence_artifacts: p.evidence_artifacts,
        drift_indicator: p.drift_indicator, drift_threshold: p.drift_threshold,
        reportable_to: (p.reportable_to||[]).join(', '), reporting_sla: p.reporting_sla,
        fabrication_flag: p.fabrication_flag, blind_spot_flag: p.blind_spot_flag,
        blind_spot_note: p.blind_spot_note, cot_trigger: p.cot_trigger, cot_codex: p.cot_codex,
        cot_tier: p.cot_tier, cot_design: p.cot_design, cot_evidence: p.cot_evidence,
        cot_failure: p.cot_failure, fieldwork_test_steps: p.fieldwork_test_steps,
        sample_size: p.sample_size, evidence_request_list: p.evidence_request_list,
        raw_output: displayText
      }
      const { error: dbErr } = await sb.from('controls').insert(dbRow)
      if (dbErr) { showToast('DB save failed: ' + dbErr.message); return }
      await loadControls()
      showToast(controlId + ' saved - ' + (controls.length+1) + ' total controls')
      setFocus(''); setSubsystem('')
    } catch(e) { setError(e.message) } finally { setLoading(false) }
  }

  async function deleteControl(ctrl) {
    await sb.from('controls').delete().eq('user_id', user.id).eq('control_id', ctrl.id)
    await loadControls()
    showToast('Control removed')
  }

  async function clearAll() {
    if (!confirm('Clear all controls?')) return
    await sb.from('controls').delete().eq('user_id', user.id)
    await loadControls()
    showToast('Controls cleared')
  }

  const riskColor = r => ({'critical':'#991B1B','high':'#C2410C','medium':'#B45309','low':'#065F46'}[(r||'').toLowerCase()]||'#374151')

  return (
    <div>
      <SectionHeader title="Control matrix builder"
        subtitle="Generate CONTROL_OBJECTs with JSON schema, CoT reasoning, and IIA 2310 fieldwork pack."/>
      {/* Drift trigger panel */}
      {activeTriggers.length > 0 && (
        <Card title={activeTriggers.length + ' active drift triggers - generate controls for these domains first'}>
          {activeTriggers.map((t, i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50"
              onClick={() => {
                const domainMap = {
                  CBS:'AD-02', IAM:'AD-01', CLD:'AD-03', API:'AD-05',
                  AI:'AD-04', INC:'AD-06', TPR:'AD-05', DLP:'AD-07', AUD:'AD-01'
                }
                setCtrlDomain(t.domain || 'CBS')
                setDomain(domainMap[t.domain] || 'AD-01')
              }}>
              <span className="text-xs font-bold px-2 py-0.5 rounded font-mono shrink-0"
                style={{background: t.severity==='Critical'?'#FEE2E2':t.severity==='High'?'#FFEDD5':'#FEF3C7',
                        color:      t.severity==='Critical'?'#991B1B':t.severity==='High'?'#C2410C':'#92400E'}}>
                {t.trigger_ref}
              </span>
              <div className="flex-1">
                <div className="text-xs font-semibold">{t.description}</div>
                <div className="text-xs text-gray-500 mt-0.5">{t.implications}</div>
              </div>
              <span className="tag tag-bs text-xs shrink-0">{t.domain}</span>
              <span className="text-xs text-blue-600 shrink-0">Click to select</span>
            </div>
          ))}
        </Card>
      )}

      {/* Priority domains from mandate profile */}
      {priorityDomains.length > 0 && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Priority domains for {entity?.functional_type}:</span>
          {priorityDomains.map((d, i) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded cursor-pointer hover:opacity-80"
              style={{background:'#DBEAFE', color:'#1E40AF', fontWeight: i===0?700:400}}
              onClick={() => setCtrlDomain(d)}>
              {i+1}. {d}
            </span>
          ))}
        </div>
      )}

      <Card title="Generate new control">
        <FormGrid>
          <FormGroup label="Assurance domain" htmlFor="cm-domain">
            <Select id="cm-domain" value={domain} onChange={e=>setDomain(e.target.value)}>
              {DOMAINS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </Select>
          </FormGroup>
          <FormGroup label="Control domain" htmlFor="cm-ctrl">
            <Select id="cm-ctrl" value={ctrlDomain} onChange={e=>setCtrlDomain(e.target.value)}>
              {CTRL_DOMAINS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </Select>
          </FormGroup>
          <FormGroup label="Subsystem" htmlFor="cm-sub">
            <Input id="cm-sub" value={subsystem} onChange={e=>setSubsystem(e.target.value)} placeholder="e.g. Finacle CBS, Azure AD"/>
          </FormGroup>
          <FormGroup label="Entity tier" htmlFor="cm-tier">
            <Select id="cm-tier" value={tier} onChange={e=>setTier(e.target.value)}>
              {['SCB','SFB','NBFC-ML','NBFC-UL','NBFC-BL','RRB'].map(t=><option key={t} value={t}>{t}</option>)}
            </Select>
          </FormGroup>
          <FormGroup label="Control focus" htmlFor="cm-focus" span2>
            <Textarea id="cm-focus" value={focus} onChange={e=>setFocus(e.target.value)}
              placeholder="e.g. Segregation of duties for CBS parameter changes — DBA vs application admin separation..."/>
          </FormGroup>
        </FormGrid>
        <BtnRow>
          <Btn onClick={generate} disabled={loading}>Generate control object</Btn>
        </BtnRow>
      </Card>
      {loading && <Spinner label="Generating CONTROL_OBJECT..."/>}
      {(output||error) && <AIOutput html={output} error={error}/>}
      {controls.length > 0 && (
        <div className="mt-5">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-semibold">Controls ({controls.length})</div>
            <Btn onClick={clearAll} variant="danger">Clear all</Btn>
          </div>
          <Table headers={['Control ID','Domain','Subsystem','Tier','Risk','Codex ref','Type','Evidence','SLA','Status','']}>
            {controls.map((c,i) => (
              <tr key={i} className="hover:bg-gray-50 border-b border-gray-100 last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{c.id}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">{c.ad_domain}</td>
                <td className="px-3 py-2 text-xs max-w-32 break-words">{c.subsystem||'—'}</td>
                <td className="px-3 py-2"><TierBadge tier={c.tier}/></td>
                <td className="px-3 py-2 text-xs font-semibold" style={{color:riskColor(c.risk_rating)}}>{c.risk_rating||'—'}</td>
                <td className="px-3 py-2 text-xs max-w-40 break-words">{c.codex_ref||'—'}</td>
                <td className="px-3 py-2 text-xs">{c.ctrl_type||'—'}</td>
                <td className="px-3 py-2 text-xs max-w-40 break-words">{c.evidence||'—'}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">{c.sla||'—'}</td>
                <td className="px-3 py-2"><Tag type={c.source_status?.toLowerCase()||'u'}>[{c.source_status||'U'}]</Tag></td>
                <td className="px-3 py-2">
                  <Btn onClick={()=>deleteControl(c)} variant="danger">Remove</Btn>
                </td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  )
}
