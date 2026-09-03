"use client"
import { useState } from 'react'
import { callAPI } from '../lib/api'
import { formatAIOutput } from '../lib/formatter'
import { Card, SectionHeader, FormGrid, FormGroup, Input, Select, BtnRow, Btn, Spinner, AIOutput, Table } from './ui'

const STATIC_ROWS = [
  { trigger:'Ransomware on CBS', pii:'No', cii:'Yes', rbi:'✓ 6hr', certin:'✓ 6hr', nciipc:'✓ Immediate', dpdp:'✗', sla:'Immediate' },
  { trigger:'Data breach — customer PII', pii:'Yes', cii:'Depends', rbi:'✓ 6hr', certin:'✓ 6hr', nciipc:'If CII', dpdp:'✓ Immediate', sla:'Immediate' },
  { trigger:'API exfiltration — LSP', pii:'Yes', cii:'No', rbi:'✓ 6hr', certin:'✓ 6hr', nciipc:'✗', dpdp:'✓ Immediate', sla:'Immediate' },
  { trigger:'SFMS/INFINET disruption', pii:'No', cii:'Yes', rbi:'✓ 6hr', certin:'✓ 6hr', nciipc:'✓ Immediate', dpdp:'✗', sla:'Immediate' },
  { trigger:'Insider fraud — access abuse', pii:'No', cii:'No', rbi:'✓ 6hr', certin:'✓ 6hr', nciipc:'✗', dpdp:'✗', sla:'6 hours' },
  { trigger:'AI model poisoning — credit', pii:'Yes', cii:'No', rbi:'✓ 6hr', certin:'✓ 6hr', nciipc:'✗', dpdp:'✓ Immediate', sla:'Immediate' },
  { trigger:'Cloud misconfiguration', pii:'Depends', cii:'Depends', rbi:'✓ 6hr', certin:'✓ 6hr', nciipc:'If CII', dpdp:'If PII', sla:'6hr min' },
  { trigger:'DDoS on payment gateway', pii:'No', cii:'Depends', rbi:'✓ 6hr', certin:'✓ 6hr', nciipc:'If CII', dpdp:'✗', sla:'6hr min' },
]

function cellStyle(val) {
  if (val==='Depends'||val==='If CII'||val==='If PII') return {background:'#FEF3C7',color:'#92400E',textAlign:'center'}
  if (val&&val.startsWith('✓')) return {background:'#D1FAE5',color:'#065F46',textAlign:'center',fontWeight:600}
  if (val==='✗') return {color:'#9CA3AF',textAlign:'center'}
  return {textAlign:'center'}
}

export default function TruthTable({ user, sb, currentEntityId, showToast }) {
  const [incident, setIncident] = useState('')
  const [pii, setPii]           = useState('yes')
  const [cii, setCii]           = useState('yes')
  const [financial, setFinancial] = useState('yes')
  const [result, setResult]     = useState(null)
  const [output, setOutput]     = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function evaluate() {
    if (!incident) { showToast('Describe the incident'); return }
    const rows = [
      { agency:'RBI DAKSH', reqClass:'yes', req:'✓ Required', sla:'6 hours from detection', slaRed:true, start:'Time of detection', portal:'DAKSH portal [BS-02: validate schema before submission]' },
      { agency:'CERT-In',   reqClass:'yes', req:'✓ Required', sla:'6 hours from detection', slaRed:true, start:'Time of detection', portal:'cert-in.org.in — incident reporting form' },
      { agency:'NCIIPC',
        reqClass: cii==='yes'?'yes':cii==='unknown'?'dep':'no',
        req: cii==='yes'?'✓ Required':cii==='unknown'?'Depends — confirm CII':'✗ Not required',
        sla: cii==='yes'?'Immediate':cii==='unknown'?'Pending CII confirmation':'—',
        slaRed: cii!=='no', start: cii!=='no'?'Time of detection':'—',
        portal:'nciipc.gov.in [BS-04: SCB/NBFC-UL/TL presumptive CII]' },
      { agency:'DPDP Board',
        reqClass: pii==='yes'?'yes':pii==='unknown'?'dep':'no',
        req: pii==='yes'?'✓ Required':pii==='unknown'?'Depends — confirm PII':'✗ Not required',
        sla: pii==='yes'?'Immediate':pii==='unknown'?'Pending PII confirmation':'—',
        slaRed: pii!=='no', start: pii!=='no'?'Time of breach discovery':'—',
        portal:'MeitY/DPDP Board [BS-01: Rules not notified — schema unknown]' },
    ]
    const hasDeps = pii==='unknown'||cii==='unknown'
    const govSLA = (pii==='yes'||cii==='yes') ? 'Immediate' : hasDeps ? 'Immediate (worst-case — confirm dependencies)' : '6 hours'
    setResult({ rows, hasDeps, govSLA })
    setLoading(true); setOutput(''); setError('')

    const prompt = `You are a Principal Cyber Risk & Compliance Consultant under AI-PCRAF v3.0.

INCIDENT CONTEXT
Description: ${incident}
PII involved: ${pii}
CII asset involved: ${cii}
Financial system involved: ${financial}

Produce a complete incident analysis with all 6 sections:

1. SEVERITY CLASSIFICATION
   - Classify Sev-1/2/3 with justification

2. REGULATORY REPORTING OBLIGATIONS & SLA
   - RBI DAKSH: always required — 6 hours from detection — cite RBI IT Gov MD 2023 Chapter/Section [VT]
   - CERT-In: always required — 6 hours — cite CERT-In Directions April 2022, Direction number [VT]
   - NCIIPC: if CII=yes/unknown — Immediate — cite NCIIPC guidelines [VT]
   - DPDP Board: if PII=yes/unknown — Immediate — flag [BS-01] — cite DPDP Act 2023, Section [VT]
   - For each: exact SLA clock start, deadline, reporting portal
   - SLA is always 6 hours — never 24, 48, or 72 hours

3. IMMEDIATE RESPONSE STEPS (first 2 hours)
   - Minimum 5 numbered steps in chronological order

4. EVIDENCE PRESERVATION
   - Specific artifacts, chain of custody requirement

5. APPLICABLE BLIND SPOTS
   - Which of BS-01 to BS-08 apply and why

6. DE-DUPLICATION
   - Single action satisfying multiple agencies

CITATION RULES: DocumentName, Chapter/Section [VT]. CERT-In always "April 2022".`

    try {
      const res = await callAPI(prompt, 1800)
      setOutput(formatAIOutput(res))
      if (user) await sb.from('incidents').insert({
        user_id:user.id, entity_id:currentEntityId||null,
        description:incident, pii, cii, financial, ai_analysis:res
      })
    } catch(e) { setError(e.message) } finally { setLoading(false) }
  }

  function reset() { setResult(null); setOutput(''); setError(''); setIncident('') }

  const classStyle = { yes:{background:'#D1FAE5',color:'#065F46',fontWeight:600}, dep:{background:'#FEF3C7',color:'#92400E'}, no:{color:'#9CA3AF'} }

  return (
    <div>
      <SectionHeader title="Multi-agency incident truth table"
        subtitle="Evaluate any incident against all four reporting obligations. HCD rule — strictest SLA governs."/>
      <Card title="Incident classifier">
        <FormGrid>
          <FormGroup label="Incident description" htmlFor="tt-inc">
            <Input id="tt-inc" value={incident} onChange={e=>setIncident(e.target.value)} placeholder="e.g. Ransomware detected on CBS production server"/>
          </FormGroup>
          <FormGroup label="Involves PII?" htmlFor="tt-pii">
            <Select id="tt-pii" value={pii} onChange={e=>setPii(e.target.value)}>
              <option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option>
            </Select>
          </FormGroup>
          <FormGroup label="Involves CII asset?" htmlFor="tt-cii">
            <Select id="tt-cii" value={cii} onChange={e=>setCii(e.target.value)}>
              <option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown / presumptive (BS-04)</option>
            </Select>
          </FormGroup>
          <FormGroup label="Involves financial system?" htmlFor="tt-fin">
            <Select id="tt-fin" value={financial} onChange={e=>setFinancial(e.target.value)}>
              <option value="yes">Yes</option><option value="no">No</option>
            </Select>
          </FormGroup>
        </FormGrid>
        <BtnRow>
          <Btn onClick={evaluate} disabled={loading}>Evaluate incident</Btn>
          <Btn onClick={reset} variant="secondary">Reset</Btn>
        </BtnRow>
      </Card>

      {result && (
        <div className="mt-3">
          <Table headers={['Agency','Required?','SLA','Clock start','Portal / note']}>
            {result.rows.map((row,i) => (
              <tr key={i} className="border-b border-gray-100 last:border-0">
                <td className="px-3 py-2 text-xs font-semibold">{row.agency}</td>
                <td className="px-3 py-2 text-xs" style={classStyle[row.reqClass]}>{row.req}</td>
                <td className="px-3 py-2 text-xs font-semibold" style={{color:row.slaRed&&row.sla!=='—'?'#991B1B':'#6B7280'}}>{row.sla}</td>
                <td className="px-3 py-2 text-xs">{row.start}</td>
                <td className="px-3 py-2 text-xs max-w-xs break-words">{row.portal}</td>
              </tr>
            ))}
          </Table>
          <div className="mt-2 p-3 rounded text-sm font-semibold" style={{background:'#FEE2E2',color:'#991B1B'}}>
            Governing SLA (HCD rule): {result.govSLA} — all teams work to this clock.
          </div>
          {result.hasDeps && (
            <div className="mt-2 p-3 rounded text-xs" style={{background:'#FEF3C7',color:'#92400E'}}>
              ⚠ One or more cells are Depends — human judgment required. AI halts autonomous reporting pending confirmation.
            </div>
          )}
        </div>
      )}
      {loading && <Spinner label="Generating incident analysis..."/>}
      {(output||error) && <AIOutput html={output} error={error}/>}

      <div className="mt-6">
        <div className="text-sm font-semibold mb-2">Mandatory truth table — all 8 incident classes</div>
        <Table headers={['Incident trigger','PII','CII','RBI DAKSH','CERT-In','NCIIPC','DPDP Board','Governing SLA']}>
          {STATIC_ROWS.map((r,i) => (
            <tr key={i} className="border-b border-gray-100 last:border-0">
              <td className="px-3 py-2 text-xs">{r.trigger}</td>
              {[r.pii,r.cii,r.rbi,r.certin,r.nciipc,r.dpdp].map((v,j)=>(
                <td key={j} className="px-3 py-2 text-xs" style={cellStyle(v)}>{v}</td>
              ))}
              <td className="px-3 py-2 text-xs font-semibold" style={{color:'#991B1B'}}>{r.sla}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  )
}
