"use client"
import { useState } from 'react'
import { Card, SectionHeader, FormGrid, FormGroup, Input, Select, Textarea, BtnRow, Btn, Spinner, Table } from './ui'

function genRef() {
  const n=new Date(), p=n=>String(n).padStart(2,'0')
  return `PCRAF-${n.getFullYear()}${p(n.getMonth()+1)}${p(n.getDate())}-${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`
}

export default function DakshGenerator({ user, sb, currentEntityId, showToast }) {
  const [incident, setIncident] = useState('')
  const [severity, setSeverity] = useState('Sev-1')
  const [detectedAt, setDetected] = useState('')
  const [pii, setPii]           = useState('yes')
  const [cii, setCii]           = useState('yes')
  const [financial, setFinancial] = useState('yes')
  const [payload, setPayload]   = useState(null)
  const [loading, setLoading]   = useState(false)
  const [history, setHistory]   = useState([])
  const [incRef, setIncRef]     = useState('')

  async function generate() {
    if (!incident||!detectedAt) { showToast('Enter incident description and detection time'); return }
    setLoading(true); setPayload(null)
    const ref = genRef(); setIncRef(ref)

    let entityData = {}
    if (currentEntityId) {
      const { data } = await sb.from('entities').select('*').eq('id',currentEntityId).limit(1)
      if (data?.length) entityData = data[0]
    }

    try {
      const res = await fetch('/api/generate-daksh', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ incident, pii, cii, financial, severity, detectedAt, incidentRef:ref, entity:entityData })
      })
      const data = await res.json()
      if (!res.ok||data.error) throw new Error(data.error||'Generation failed')
      if (data.parse_error) { showToast('Parse error — see raw output'); setPayload({_raw:data.raw}); return }
      setPayload(data.payload)
      await sb.from('daksh_payloads').insert({
        user_id:user.id, entity_id:currentEntityId||null,
        incident_ref:ref, incident_description:incident,
        severity, incident_type:data.payload.incident_type||'',
        payload_json:data.payload
      })
      showToast('Payload generated — ' + ref)
    } catch(e) { showToast('Error: ' + e.message) }
    finally { setLoading(false) }
  }

  async function downloadPDF() {
    if (!payload) return
    const res = await fetch('/api/export-daksh', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ payload })
    })
    if (!res.ok) { showToast('PDF error'); return }
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `DAKSH_Incident_${incRef}_${new Date().toISOString().slice(0,10)}.pdf`
    a.click(); URL.revokeObjectURL(a.href)
    showToast('DAKSH PDF downloaded')
  }

  async function loadHistory() {
    const { data } = await sb.from('daksh_payloads').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20)
    setHistory(data||[])
  }

  const F = ({ label, value, warn=false }) => (
    <div className="mb-2">
      <div className="text-xs font-semibold text-gray-500 mb-0.5">{label}{warn&&<span className="ml-1 text-red-600">*fill before submission</span>}</div>
      <div className="text-sm text-gray-800">{value||'—'}</div>
    </div>
  )

  return (
    <div>
      <SectionHeader title="RBI DAKSH incident payload generator"
        subtitle="Generate a pre-filled DAKSH incident report. Review all fields before submission."/>
      <div className="p-3 rounded mb-3 text-xs" style={{background:'#FEF3C7',color:'#92400E'}}>
        ⚠ <strong>[BS-02] DRAFT ONLY:</strong> The DAKSH portal field schema has not been independently verified. Validate all field names against the live portal at daksh.rbi.org.in before submission.
      </div>
      <Card title="Incident details">
        <FormGrid>
          <FormGroup label="Incident description" htmlFor="dk-inc" span2>
            <Textarea id="dk-inc" value={incident} onChange={e=>setIncident(e.target.value)}
              placeholder="e.g. Ransomware detected on CBS production server — database encrypted, transaction processing halted"/>
          </FormGroup>
          <FormGroup label="Severity" htmlFor="dk-sev">
            <Select id="dk-sev" value={severity} onChange={e=>setSeverity(e.target.value)}>
              <option value="Sev-1">Sev-1 — Critical</option>
              <option value="Sev-2">Sev-2 — High</option>
              <option value="Sev-3">Sev-3 — Medium</option>
            </Select>
          </FormGroup>
          <FormGroup label="Detection date/time" htmlFor="dk-det">
            <Input id="dk-det" type="datetime-local" value={detectedAt} onChange={e=>setDetected(e.target.value)}/>
          </FormGroup>
          <FormGroup label="PII involved?" htmlFor="dk-pii">
            <Select id="dk-pii" value={pii} onChange={e=>setPii(e.target.value)}>
              <option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option>
            </Select>
          </FormGroup>
          <FormGroup label="CII asset involved?" htmlFor="dk-cii">
            <Select id="dk-cii" value={cii} onChange={e=>setCii(e.target.value)}>
              <option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown / presumptive (BS-04)</option>
            </Select>
          </FormGroup>
        </FormGrid>
        <BtnRow>
          <Btn onClick={generate} disabled={loading}>Generate DAKSH payload</Btn>
          <Btn onClick={loadHistory} variant="secondary">Load history</Btn>
        </BtnRow>
      </Card>
      {loading && <Spinner label="Generating DAKSH payload..."/>}

      {payload && !payload._raw && (
        <>
          <div className="p-3 rounded mb-3 text-xs mt-3" style={{background:'#FEF3C7',color:'#92400E'}}>{payload.bs02_declaration}</div>
          <Card title="1. Entity details">
            <FormGrid>
              <F label="Incident reference" value={payload.incident_ref}/>
              <F label="Entity" value={`${payload.entity_name} (${payload.entity_type})`}/>
              <F label="RBI registration no." value={payload.rbi_registration_no} warn/>
              <F label="CERT-In empanelled" value={payload.cert_in_empanelled}/>
            </FormGrid>
          </Card>
          <Card title="2. Incident classification">
            <FormGrid>
              <F label="Incident type" value={payload.incident_type}/>
              <F label="Severity" value={payload.severity}/>
              <F label="Attack vector" value={payload.attack_vector}/>
              <F label="Systems affected" value={payload.systems_affected}/>
            </FormGrid>
          </Card>
          <Card title="3. Timeline & SLA" className="border-red-200">
            <FormGrid>
              <F label="Detected at" value={payload.detected_at}/>
              <F label="SLA deadline" value={payload.sla_deadline}/>
              <F label="RBI DAKSH SLA" value={payload.rbi_daksh_sla}/>
              <F label="CERT-In SLA" value={payload.cert_in_sla}/>
            </FormGrid>
          </Card>
          <Card title="4. Regulatory obligations">
            <FormGrid>
              <F label="NCIIPC required" value={payload.nciipc_required}/>
              <F label="DPDP Board required" value={payload.dpdp_board_required}/>
            </FormGrid>
            {payload.bs01_declaration && payload.bs01_declaration!=='Not applicable' && (
              <div className="text-xs mt-2" style={{color:'#92400E'}}>⚠ {payload.bs01_declaration}</div>
            )}
            {payload.bs04_declaration && payload.bs04_declaration!=='Not applicable' && (
              <div className="text-xs mt-1" style={{color:'#92400E'}}>⚠ {payload.bs04_declaration}</div>
            )}
          </Card>
          <Card title="5. Containment & response">
            <F label="Containment status" value={payload.containment_status}/>
            <F label="Actions taken" value={payload.containment_actions}/>
            <F label="Root cause (preliminary)" value={payload.root_cause_preliminary}/>
            <F label="IOCs" value={payload.attack_indicators}/>
          </Card>
          <Card title="6. Evidence & escalation">
            <F label="Evidence artifacts" value={payload.evidence_artifacts}/>
            <F label="Escalation path" value={payload.escalation_path}/>
            <F label="Nodal officer" value={payload.nodal_officer_name} warn/>
          </Card>
          <Card title="7. Pre-submission checklist [BS-02]">
            <p className="text-xs text-gray-500 mb-3">All items must be checked before submission to DAKSH portal.</p>
            {payload.pre_submission_checklist && Object.keys(payload.pre_submission_checklist).map(key => (
              <div key={key} className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0 text-xs">
                <input type="checkbox" className="accent-blue-600"/>
                <label>{key.replace(/_/g,' ').replace(/\w/g,c=>c.toUpperCase())}</label>
              </div>
            ))}
          </Card>
          <BtnRow>
            <Btn onClick={downloadPDF}>Download PDF</Btn>
          </BtnRow>
        </>
      )}

      {history.length>0 && (
        <Card title="Payload history" className="mt-3">
          <Table headers={['Reference','Incident','Severity','Generated']}>
            {history.map((r,i)=>(
              <tr key={i} className="border-b border-gray-100 last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{r.incident_ref}</td>
                <td className="px-3 py-2 text-xs max-w-xs">{(r.incident_description||'—').substring(0,60)}</td>
                <td className="px-3 py-2 text-xs">{r.severity||'—'}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  )
}
