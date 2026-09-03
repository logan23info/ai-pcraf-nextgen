"use client"
import { useState } from 'react'
import { useEngagement } from '../lib/EngagementContext'
import { Card, SectionHeader, BtnRow, Btn } from './ui'

export default function Export({ user, sb, controls, showToast }) {
  const { driftTriggers, coverageMap } = useEngagement()
  const [status, setStatus] = useState('')

  async function exportExcel() {
    setStatus('Building 4-sheet workbook...')
    try {
      const [dRes, eRes, cRes, iRes] = await Promise.all([
        sb.from('dossier_log').select('*').eq('user_id',user.id).order('fetched_at',{ascending:false}).limit(60),
        sb.from('entities').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1),
        sb.from('controls').select('*').eq('user_id',user.id).order('created_at',{ascending:true}),
        sb.from('incidents').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20),
      ])
      const dossierData   = dRes.data||[]
      const entityData    = eRes.data?.[0]||{}
      const incidentsData = iRes.data||[]
      const fullControls = (cRes.data||[]).map(r=>({
        id:r.control_id, ctrl_domain:r.ctrl_domain, ad_domain:r.ad_domain,
        subsystem:r.subsystem, tier:r.tier, risk_rating:r.risk_rating,
        codex_ref:r.primary_codex_ref, ctrl_type:r.control_type,
        evidence:r.evidence_artifacts, sla:r.reporting_sla,
        source_status:r.source_truth_status==='VERIFIED-TRAINING'?'VT':r.source_truth_status==='INFERRED'?'I':'U',
        created:r.created_at,
        parsed:{
          control_id:r.control_id, control_name:r.control_name, assurance_domain:r.ad_domain,
          subsystem:r.subsystem, tier_applicability:[], primary_codex_ref:r.primary_codex_ref,
          secondary_codex_ref:r.secondary_codex_ref, source_truth_status:r.source_truth_status,
          risk_description:r.risk_description, risk_rating:r.risk_rating,
          inherent_risk:r.inherent_risk, residual_risk:r.residual_risk,
          control_type:r.control_type, control_mode:r.control_mode,
          testing_frequency:r.testing_frequency, ai_testing_procedure:r.ai_testing_procedure,
          manual_procedure:r.manual_procedure, evidence_artifacts:r.evidence_artifacts,
          drift_indicator:r.drift_indicator, drift_threshold:r.drift_threshold,
          reportable_to:(r.reportable_to||'').split(',').map(s=>s.trim()),
          reporting_sla:r.reporting_sla, blind_spot_flag:r.blind_spot_flag,
          blind_spot_note:r.blind_spot_note, cot_trigger:r.cot_trigger,
          cot_codex:r.cot_codex, cot_tier:r.cot_tier, cot_design:r.cot_design,
          cot_evidence:r.cot_evidence, cot_failure:r.cot_failure,
          fieldwork_test_steps:r.fieldwork_test_steps, sample_size:r.sample_size,
          evidence_request_list:r.evidence_request_list
        }
      }))
      if (!fullControls.length) { showToast('No controls — generate controls first'); setStatus(''); return }
      setStatus('Sending to export engine...')
      const res = await fetch('/api/export-rcm', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          entity:entityData, controls:fullControls, dossier:dossierData,
          driftTriggers:driftTriggers, coverageMap:coverageMap,
          incidents:incidentsData
        })
      })
      if (!res.ok) { const e=await res.json(); throw new Error(e.error||'Export failed') }
      const blob = await res.blob()
      const entityName = (entityData.name||'').replace(/[^a-zA-Z0-9]/g,'_').substring(0,20)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `AI_PCRAF_RCM_${entityName?entityName+'_':''}${new Date().toISOString().slice(0,10)}.xlsx`
      a.click(); URL.revokeObjectURL(a.href)
      setStatus(fullControls.length + ' controls exported')
      showToast('RCM Excel downloaded')
    } catch(e) { setStatus('Error: ' + e.message); showToast('Export failed') }
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify({framework:'AI-PCRAF v3.0',exported:new Date().toISOString(),controls},null,2)],{type:'application/json'})
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `AI_PCRAF_export_${new Date().toISOString().slice(0,10)}.json`
    a.click(); URL.revokeObjectURL(a.href)
    showToast('JSON exported')
  }

  const vt = controls.filter(c=>c.source_status==='V'||c.source_status==='VT').length
  const inf = controls.filter(c=>c.source_status==='I').length
  const unv = controls.filter(c=>c.source_status==='U'||c.source_status==='FR').length

  return (
    <div>
      <SectionHeader title="Export & backup"
        subtitle="Download formatted RCM workbook or JSON backup. Excel includes 4 sheets."/>
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold mb-1">📄 RCM Excel workbook</div>
          <div className="text-xs text-gray-500">4-sheet workbook — colour-coded by risk and source truth. RBI inspection ready.</div>
          <div className="text-xs text-gray-400 mt-1">Sheets: RCM Summary · Control Matrix · Fieldwork Pack (IIA 2310) · Dossier Status</div>
          {status && <div className="text-xs text-blue-600 mt-1">{status}</div>}
        </div>
        <Btn onClick={exportExcel}>Download RCM (.xlsx)</Btn>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold mb-1">💾 Full framework backup (JSON)</div>
          <div className="text-xs text-gray-500">All controls — use to migrate or restore session.</div>
        </div>
        <Btn onClick={exportJSON} variant="secondary">Download JSON</Btn>
      </div>
      <Card title="Session statistics">
        <div className="grid grid-cols-4 gap-4 mt-2">
          {[['Controls',controls.length,'#2563EB'],['Verified',vt,'#065F46'],['Inferred',inf,'#B45309'],['Unverified',unv,'#991B1B']].map(([label,val,color])=>(
            <div key={label} className="text-center">
              <div className="text-3xl font-bold" style={{color}}>{val}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
