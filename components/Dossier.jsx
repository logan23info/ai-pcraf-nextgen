"use client"
import { useState } from 'react'
import { Card, SectionHeader, BtnRow, Btn, Spinner, Table } from './ui'

export default function Dossier({ user, sb, controls, showToast }) {
  const [results, setResults]   = useState([])
  const [summary, setSummary]   = useState(null)
  const [history, setHistory]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [amendments, setAmendments] = useState([])
  const [driftControls, setDriftControls] = useState([])

  async function runFetches() {
    setLoading(true); setResults([]); setSummary(null); setAmendments([]); setDriftControls([])
    try {
      const res = await fetch('/api/fetch-regulatory', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ fetchIds:['FETCH-01','FETCH-02','FETCH-03','FETCH-04','FETCH-05','FETCH-06'] })
      })
      const data = await res.json()
      if (!res.ok||data.error) throw new Error(data.error||'Fetch error')
      const fetchResults = data.results||[]
      setResults(fetchResults)
      setSummary(data.summary)
      setAmendments(fetchResults.filter(r=>r.amendment_detected))

      // Duplicate-safe insert: check last 60 seconds
      const sixtyAgo = new Date(Date.now()-60000).toISOString()
      const { data: recent } = await sb.from('dossier_log').select('fetch_id').eq('user_id',user.id).gte('fetched_at',sixtyAgo)
      const recentIds = (recent||[]).map(r=>r.fetch_id)
      const toInsert = fetchResults.filter(r=>!recentIds.includes(r.id)).map(r=>({
        user_id:user.id, fetch_id:r.id, url:r.url, status:r.status,
        result_summary:r.result_summary, amendment_detected:r.amendment_detected, amendment_note:r.amendment_note||''
      }))
      if (toInsert.length) await sb.from('dossier_log').insert(toInsert)

      // Drift check
      const failed    = fetchResults.filter(r=>r.status==='FETCH-FAILED')
      const amended   = fetchResults.filter(r=>r.amendment_detected)
      const drift = []
      controls.forEach(c => {
        const ref = (c.codex_ref||'').toLowerCase()
        if ((ref.includes('rbi')||ref.includes('md')) && amended.find(f=>f.id==='FETCH-01')) drift.push({id:c.id,reason:'RBI MD amendment signal — re-verify citation'})
        else if (ref.includes('cert-in') && amended.find(f=>f.id==='FETCH-02')) drift.push({id:c.id,reason:'CERT-In amendment signal — re-verify citation'})
        else if (ref.includes('dpdp') && amended.find(f=>f.id==='FETCH-03')) drift.push({id:c.id,reason:'DPDP signal — BS-01 may be resolvable'})
        else if (ref.includes('rebit') && amended.find(f=>f.id==='FETCH-04')) drift.push({id:c.id,reason:'ReBIT version signal — re-verify'})
        else if (ref.includes('nciipc') && failed.find(f=>f.id==='FETCH-05')) drift.push({id:c.id,reason:'NCIIPC fetch failed — BS-04 active'})
        else if ((ref.includes('iftas')||ref.includes('sfms')) && failed.find(f=>f.id==='FETCH-06')) drift.push({id:c.id,reason:'IFTAS fetch failed — BS-08 active'})
      })
      setDriftControls(drift)
      showToast((data.summary?.fetched||0) + '/6 fetched')
    } catch(e) { showToast('Fetch error: ' + e.message) }
    finally { setLoading(false) }
  }

  async function loadHistory() {
    const tenYearsAgo = new Date()
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear()-10)
    const { data } = await sb.from('dossier_log').select('*').eq('user_id',user.id)
      .gte('fetched_at',tenYearsAgo.toISOString()).order('fetched_at',{ascending:false})
    setHistory(data||[])
    showToast('Fetch history — ' + (data?.length||0) + ' records (last 10 years)')
  }

  function StatusTag({ status }) {
    if (status==='FETCHED') return <span className="tag tag-v">[V]</span>
    return <span className="tag tag-fr">[FETCH-FAILED]</span>
  }

  return (
    <div>
      <SectionHeader title="Regulatory dossier — live fetch engine"
        subtitle="Run all 6 regulatory fetches server-side. Results stored in Supabase. Controls with amended codex refs flagged [DRIFT-RISK]."/>
      <Card title="Fetch controls">
        <BtnRow>
          <Btn onClick={runFetches} disabled={loading}>Run all 6 fetches</Btn>
          <Btn onClick={loadHistory} variant="secondary">Load fetch history</Btn>
          {summary && <span className="text-xs text-gray-500">{summary.fetched}/{summary.total} fetched | {summary.failed} failed | {summary.amendments_found} amendment signals</span>}
        </BtnRow>
      </Card>
      {loading && <Spinner label="Fetching regulatory sources..."/>}

      {results.length>0 && (
        <>
          <Table headers={['Fetch ID','Source','Status','Amendment?','Summary','Fetched at']}>
            {results.map((r,i)=>(
              <tr key={i} className="border-b border-gray-100 last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
                <td className="px-3 py-2 text-xs font-semibold">{r.label}</td>
                <td className="px-3 py-2"><StatusTag status={r.status}/></td>
                <td className="px-3 py-2">{r.amendment_detected?<span className="tag tag-i">[AMENDMENT]</span>:<span className="text-xs text-gray-400">None</span>}</td>
                <td className="px-3 py-2 text-xs max-w-xs break-words">{r.result_summary||'—'}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">{new Date().toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </Table>
          {amendments.length>0 && (
            <div className="mt-2 p-3 rounded text-xs" style={{background:'#FEF3C7',color:'#92400E'}}>
              <strong>⚠ Amendment signals ({amendments.length}):</strong>
              {amendments.map(a=><div key={a.id} className="mt-1"><strong>{a.id}:</strong> {a.amendment_note}</div>)}
            </div>
          )}
          {driftControls.length>0 && (
            <div className="mt-2 p-3 rounded text-xs" style={{background:'#FEE2E2',color:'#991B1B'}}>
              <strong>[DRIFT-RISK] {driftControls.length} control(s) require re-verification:</strong>
              {driftControls.map(d=><div key={d.id} className="mt-1"><span className="font-mono">{d.id}</span> — {d.reason}</div>)}
            </div>
          )}
        </>
      )}

      {history.length>0 && (
        <Card title="Fetch history (last 10 years)" className="mt-3">
          <Table headers={['Fetch ID','Status','Amendment','Summary','When']}>
            {history.map((r,i)=>(
              <tr key={i} className="border-b border-gray-100 last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{r.fetch_id}</td>
                <td className="px-3 py-2"><StatusTag status={r.status}/></td>
                <td className="px-3 py-2">{r.amendment_detected?<span className="tag tag-i">[AMEND]</span>:'—'}</td>
                <td className="px-3 py-2 text-xs max-w-xs break-words">{(r.result_summary||'—').substring(0,120)}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">{new Date(r.fetched_at).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  )
}
