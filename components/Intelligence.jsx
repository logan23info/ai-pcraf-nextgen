"use client"
import { useState } from 'react'
import { Card, SectionHeader, BtnRow, Btn, Spinner, Table, Tag } from './ui'

const FETCH_LABELS = {
  'FETCH-01':'RBI IT Gov MD 2023',
  'FETCH-02':'CERT-In Directions April 2022',
  'FETCH-03':'MeitY — DPDP Act/Rules',
  'FETCH-04':'ReBIT Cybersecurity Framework',
  'FETCH-05':'NCIIPC CII Guidelines',
  'FETCH-06':'IFTAS SFMS/INFINET Standards',
}

const STATUS_STYLE = {
  COVERED_V:  { bg:'#D1FAE5', color:'#065F46', label:'COVERED [V]' },
  COVERED_VT: { bg:'#DBEAFE', color:'#1E40AF', label:'COVERED [VT]' },
  WEAK:       { bg:'#FEF3C7', color:'#92400E', label:'NEEDS IMPROVEMENT' },
  GAP:        { bg:'#FEE2E2', color:'#991B1B', label:'GAP — MISSING' },
}

export default function Intelligence({ user, sb, controls, currentEntityId, showToast }) {
  // Panel 1 — PDF Scanner
  const [scanFile, setScanFile]       = useState(null)
  const [scanFetchId, setScanFetchId] = useState('FETCH-01')
  const [scanning, setScanning]       = useState(false)
  const [obligations, setObligations] = useState([])
  const [uploadId, setUploadId]       = useState(null)

  // Panel 2 — Library Importer
  const [libFile, setLibFile]       = useState(null)
  const [ingesting, setIngesting]   = useState(false)
  const [libControls, setLibControls] = useState([])

  // Panel 3 — Delta / Gap Analysis
  const [analyzing, setAnalyzing]   = useState(false)
  const [gapResults, setGapResults] = useState([])
  const [gapSummary, setGapSummary] = useState(null)
  const [activePanel, setActivePanel] = useState('scan')

  // ── PANEL 1: PDF SCAN ───────────────────────────────────────────────────
  async function scanDocument() {
    if (!scanFile) { showToast('Select a PDF, DOCX, or TXT file'); return }
    setScanning(true); setObligations([])
    try {
      // Save upload record
      const { data: uploadRec } = await sb.from('document_uploads').insert({
        user_id: user.id, fetch_id: scanFetchId,
        filename: scanFile.name, file_size: scanFile.size,
        doc_type: scanFile.name.split('.').pop().toLowerCase()
      }).select()
      const uid = uploadRec?.[0]?.id
      setUploadId(uid)

      const fd = new FormData()
      fd.append('file', scanFile)
      fd.append('fetchId', scanFetchId)
      fd.append('userId', user.id)

      const res  = await fetch('/api/scan-document', { method:'POST', body: fd })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Scan failed')

      setObligations(data.obligations || [])

      // Save obligations to DB
      if (uid && data.obligations?.length) {
        await sb.from('document_obligations').insert(
          data.obligations.map(o => ({
            upload_id: uid, user_id: user.id,
            section_ref: o.section_ref, obligation_text: o.obligation_text,
            domain: o.domain, tier: o.tier, sla: o.sla
          }))
        )
        // Mark upload as processed
        await sb.from('document_uploads').update({ processed: true }).eq('id', uid)
      }
      showToast(data.count + ' obligations extracted from ' + data.filename)
    } catch(e) { showToast('Scan error: ' + e.message) }
    finally { setScanning(false) }
  }

  // ── PANEL 2: LIBRARY IMPORT ─────────────────────────────────────────────
  async function ingestLibrary() {
    if (!libFile) { showToast('Select a file'); return }
    setIngesting(true); setLibControls([])
    try {
      const fd = new FormData()
      fd.append('file', libFile)
      const res  = await fetch('/api/ingest-library', { method:'POST', body: fd })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Ingest failed')
      setLibControls(data.controls || [])

      // Save to DB
      if (data.controls?.length) {
        await sb.from('library_controls').insert(
          data.controls.map(c => ({
            user_id: user.id, entity_id: currentEntityId || null,
            source_filename: data.filename,
            control_statement: c.control_statement, domain: c.domain,
            citation: c.citation, sla: c.sla,
            evidence: c.evidence, control_type: c.control_type
          }))
        )
      }
      showToast(data.count + ' controls ingested from ' + data.filename)
    } catch(e) { showToast('Ingest error: ' + e.message) }
    finally { setIngesting(false) }
  }

  // ── PANEL 3: GAP ANALYSIS ───────────────────────────────────────────────
  async function runGapAnalysis() {
    if (!obligations.length && !libControls.length) {
      showToast('Run PDF scan and/or import library first'); return
    }
    if (!obligations.length) { showToast('Scan a regulatory document first'); return }
    setAnalyzing(true); setGapResults([]); setGapSummary(null)
    try {
      const res  = await fetch('/api/gap-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ obligations, aiControls: controls, libraryControls: libControls })
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Analysis failed')
      setGapResults(data.results || [])
      setGapSummary(data.summary)

      // Save to DB
      if (data.results?.length && uploadId) {
        const { data: obRows } = await sb.from('document_obligations')
          .select('id, obligation_text').eq('upload_id', uploadId)
        const obMap = {}
        ;(obRows||[]).forEach(r => { obMap[r.obligation_text?.substring(0,60)] = r.id })

        await sb.from('gap_analysis').insert(
          data.results.map(r => ({
            user_id: user.id, entity_id: currentEntityId || null,
            obligation_id: obMap[r.obligation?.obligation_text?.substring(0,60)] || null,
            status: r.status, delta_action: r.delta_action,
            improvement_note: r.improvement_note || r.gap_reason || null,
            ai_control_id: r.matched_ai_control || null
          }))
        )
      }
      showToast('Gap analysis complete — ' + data.summary?.coverage_pct + '% coverage')
    } catch(e) { showToast('Analysis error: ' + e.message) }
    finally { setAnalyzing(false) }
  }

  const panels = [
    { id:'scan',    label:'1. PDF Scanner' },
    { id:'library', label:'2. Library Import' },
    { id:'delta',   label:'3. Delta Report' },
  ]

  return (
    <div>
      <SectionHeader title="Document intelligence & gap analysis"
        subtitle="Upload regulatory PDFs when fetch fails. Import your control library. Generate a delta report showing coverage gaps."/>

      {/* Panel tabs */}
      <div className="flex gap-0 mb-4 border border-gray-200 rounded overflow-hidden">
        {panels.map(p => (
          <button key={p.id} onClick={()=>setActivePanel(p.id)}
            className={"flex-1 py-2 text-xs font-medium transition-colors " + (activePanel===p.id ? 'bg-navy text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100')}
            style={activePanel===p.id ? {background:'#0F1E3C'} : {}}>
            {p.label}
          </button>
        ))}
      </div>

      {/* PANEL 1 — PDF SCANNER */}
      {activePanel === 'scan' && (
        <div>
          <Card title="Upload regulatory document">
            <p className="text-xs text-gray-500 mb-3">
              Use when a Dossier fetch fails. Download the document manually, upload here.
              Supports: PDF, DOCX, TXT.
            </p>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Regulatory source</label>
              <select value={scanFetchId} onChange={e=>setScanFetchId(e.target.value)}
                className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500">
                {Object.entries(FETCH_LABELS).map(([id,label]) => (
                  <option key={id} value={id}>{id} — {label}</option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Document file</label>
              <input type="file" accept=".pdf,.docx,.doc,.txt"
                onChange={e=>setScanFile(e.target.files?.[0]||null)}
                className="text-sm text-gray-600"/>
            </div>
            <BtnRow>
              <Btn onClick={scanDocument} disabled={scanning||!scanFile}>
                {scanning ? 'Scanning...' : 'Scan document'}
              </Btn>
            </BtnRow>
          </Card>
          {scanning && <Spinner label="Extracting obligations from document..."/>}
          {obligations.length > 0 && (
            <Card title={obligations.length + ' obligations extracted — review before gap analysis'}>
              <Table headers={['Section ref','Obligation','Domain','Tier','SLA']}>
                {obligations.map((o,i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{o.section_ref||'—'}</td>
                    <td className="px-3 py-2 text-xs max-w-xs">{o.obligation_text}</td>
                    <td className="px-3 py-2"><span className="tag tag-bs">{o.domain||'—'}</span></td>
                    <td className="px-3 py-2 text-xs">{o.tier||'ALL'}</td>
                    <td className="px-3 py-2 text-xs">{o.sla||'—'}</td>
                  </tr>
                ))}
              </Table>
              <BtnRow>
                <Btn onClick={()=>setActivePanel('delta')}>Run gap analysis →</Btn>
              </BtnRow>
            </Card>
          )}
        </div>
      )}

      {/* PANEL 2 — LIBRARY IMPORT */}
      {activePanel === 'library' && (
        <div>
          <Card title="Import existing control library">
            <p className="text-xs text-gray-500 mb-3">
              Upload your organisation&apos;s existing RCM or control library.
              Supports: Excel (.xlsx), CSV, JSON (AI-PCRAF export), Word (.docx), PDF.
            </p>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Control library file</label>
              <input type="file" accept=".xlsx,.xls,.csv,.json,.docx,.doc,.pdf"
                onChange={e=>setLibFile(e.target.files?.[0]||null)}
                className="text-sm text-gray-600"/>
            </div>
            <BtnRow>
              <Btn onClick={ingestLibrary} disabled={ingesting||!libFile}>
                {ingesting ? 'Importing...' : 'Import library'}
              </Btn>
            </BtnRow>
          </Card>
          {ingesting && <Spinner label="Parsing control library..."/>}
          {libControls.length > 0 && (
            <Card title={libControls.length + ' controls imported'}>
              <Table headers={['Control statement','Domain','Citation','SLA','Evidence']}>
                {libControls.slice(0,20).map((c,i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2 text-xs max-w-xs">{(c.control_statement||'—').substring(0,80)}</td>
                    <td className="px-3 py-2 text-xs">{c.domain||'—'}</td>
                    <td className="px-3 py-2 text-xs max-w-xs">{(c.citation||'—').substring(0,60)}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{c.sla||'—'}</td>
                    <td className="px-3 py-2 text-xs">{c.evidence?'Yes':'—'}</td>
                  </tr>
                ))}
              </Table>
              {libControls.length > 20 && <p className="text-xs text-gray-400 mt-2">Showing first 20 of {libControls.length}</p>}
              <BtnRow>
                <Btn onClick={()=>setActivePanel('delta')}>Run gap analysis →</Btn>
              </BtnRow>
            </Card>
          )}
        </div>
      )}

      {/* PANEL 3 — DELTA REPORT */}
      {activePanel === 'delta' && (
        <div>
          <Card title="Gap analysis — delta report">
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 mb-3">
              <div>Obligations loaded: <strong className="text-gray-800">{obligations.length}</strong></div>
              <div>Library controls: <strong className="text-gray-800">{libControls.length}</strong></div>
              <div>AI-PCRAF controls: <strong className="text-gray-800">{controls.length}</strong></div>
            </div>
            {(!obligations.length) && (
              <div className="p-3 rounded text-xs" style={{background:'#FEF3C7',color:'#92400E'}}>
                ⚠ No obligations loaded — go to PDF Scanner first and scan a regulatory document.
              </div>
            )}
            <BtnRow>
              <Btn onClick={runGapAnalysis} disabled={analyzing||!obligations.length}>
                {analyzing ? 'Analysing...' : 'Run gap analysis'}
              </Btn>
            </BtnRow>
          </Card>
          {analyzing && <Spinner label="Cross-referencing obligations vs controls..."/>}

          {gapSummary && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                {[
                  ['Coverage rate', gapSummary.coverage_pct + '%', '#2563EB'],
                  ['Covered [V]',   gapSummary.covered_v,  '#065F46'],
                  ['Covered [VT]',  gapSummary.covered_vt, '#1E40AF'],
                  ['Needs improvement', gapSummary.weak, '#B45309'],
                  ['Gaps — missing',    gapSummary.gap,  '#991B1B'],
                  ['Total obligations', gapSummary.total, '#374151'],
                ].map(([label,val,color]) => (
                  <div key={label} className="bg-white border border-gray-200 rounded p-3 text-center">
                    <div className="text-2xl font-bold" style={{color}}>{val}</div>
                    <div className="text-xs text-gray-500 mt-1">{label}</div>
                  </div>
                ))}
              </div>

              {/* Audit risk banner */}
              <div className="p-3 rounded mb-3 text-sm font-semibold"
                style={{background: gapSummary.coverage_pct>=80?'#D1FAE5':gapSummary.coverage_pct>=50?'#FEF3C7':'#FEE2E2',
                        color: gapSummary.coverage_pct>=80?'#065F46':gapSummary.coverage_pct>=50?'#92400E':'#991B1B'}}>
                Audit risk: {gapSummary.coverage_pct>=80?'LOW':'gapSummary.coverage_pct>=50?MEDIUM:HIGH'} —
                {gapSummary.coverage_pct}% of regulatory obligations are covered.
                {gapSummary.gap > 0 && ` ${gapSummary.gap} gaps require immediate remediation.`}
              </div>

              {/* Delta table */}
              <Table headers={['Section ref','Obligation','Status','Action','Note']}>
                {gapResults.map((r,i) => {
                  const s = STATUS_STYLE[r.status] || STATUS_STYLE.GAP
                  return (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{r.obligation?.section_ref||'—'}</td>
                      <td className="px-3 py-2 text-xs max-w-xs">{(r.obligation?.obligation_text||'—').substring(0,80)}</td>
                      <td className="px-3 py-2">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold"
                          style={{background:s.bg,color:s.color}}>{s.label}</span>
                      </td>
                      <td className="px-3 py-2 text-xs">{r.delta_action||'—'}</td>
                      <td className="px-3 py-2 text-xs max-w-xs text-gray-600">{r.improvement_note||r.gap_reason||'—'}</td>
                    </tr>
                  )
                })}
              </Table>
            </>
          )}
        </div>
      )}
    </div>
  )
}
