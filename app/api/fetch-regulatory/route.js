import { NextResponse } from 'next/server'

const SOURCES = [
  { id:'FETCH-01', label:'RBI IT Governance Master Direction', url:'https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx' },
  { id:'FETCH-02', label:'CERT-In Directions & Advisories',    url:'https://www.cert-in.org.in' },
  { id:'FETCH-03', label:'MeitY — DPDP Rules status',          url:'https://www.meity.gov.in' },
  { id:'FETCH-04', label:'ReBIT Cybersecurity Framework',       url:'https://rebit.org.in' },
  { id:'FETCH-05', label:'NCIIPC CII Guidelines',              url:'https://nciipc.gov.in' },
  { id:'FETCH-06', label:'IFTAS SFMS/INFINET Standards',       url:'https://iftas.org.in' },
]

function extract(id, html) {
  const r = { summary:'', amendment_detected:false, amendment_note:'' }
  const hasAmend = /2024|2025|2026/i.test(html) && /amend|supersed|replac|updat/i.test(html)
  if (id==='FETCH-01') {
    r.summary = /IT\s+Governance/i.test(html) ? 'RBI IT Governance MD page fetched.' : 'RBI Master Directions page fetched — verify manually.'
    if (hasAmend) { r.amendment_detected=true; r.amendment_note='Post-2023 content detected — check for circulars superseding RBI IT Gov MD 2023.' }
  } else if (id==='FETCH-02') {
    r.summary = /direction|advisory/i.test(html) ? 'CERT-In site fetched — verify April 2022 Directions current.' : 'CERT-In fetched — manual review required.'
    if (hasAmend) { r.amendment_detected=true; r.amendment_note='New CERT-In direction/advisory possible — review for SLA changes.' }
  } else if (id==='FETCH-03') {
    r.summary = /DPDP|personal data/i.test(html) ? (/rule|notification|gazette/i.test(html) ? 'DPDP Rules/notification detected — BS-01 may be resolvable.' : 'DPDP content found — Rules not notified. BS-01 active.') : 'MeitY fetched — DPDP status not auto-parsed. BS-01 active.'
    if (/rule|notification|gazette/i.test(html)) { r.amendment_detected=true; r.amendment_note='DPDP Rules/gazette detected — verify if formally notified. BS-01 may be resolvable.' }
  } else if (id==='FETCH-04') {
    const v = html.match(/version\s*[\d.]+/i)
    r.summary = 'ReBIT fetched.' + (v ? ' Version: ' + v[0] : ' Version not parsed. BS-03 active.')
    if (v) { r.amendment_detected=true; r.amendment_note='Version reference detected — confirm matches control citations. BS-03 may be resolvable.' }
  } else if (id==='FETCH-05') {
    r.summary = /CII|critical information/i.test(html) ? 'NCIIPC fetched — CII guidelines present.' : 'NCIIPC fetched — CII list not parsed. BS-04 active.'
    if (/financial|bank|NBFC/i.test(html)) { r.amendment_detected=true; r.amendment_note='Financial sector CII reference detected — verify designation list update.' }
  } else if (id==='FETCH-06') {
    r.summary = /SFMS|INFINET/i.test(html) ? 'IFTAS fetched — SFMS content present.' : 'IFTAS fetched — standards not parsed. BS-08 active.'
    const yr = html.match(/20(2[3-9]|[3-9]\d)/)
    if (yr) { r.amendment_detected=true; r.amendment_note='Year ' + yr[0] + ' detected — verify SFMS version currency.' }
  }
  return r
}

async function fetchOne(src) {
  const start = Date.now()
  try {
    const r = await fetch(src.url, {
      headers:{ 'User-Agent':'Mozilla/5.0 (compatible; AI-PCRAF/3.0)' },
      signal: AbortSignal.timeout(8000)
    })
    if (!r.ok) return { ...src, status:'FETCH-FAILED', result_summary:'HTTP '+r.status+' — verify manually at '+src.url, amendment_detected:false, amendment_note:'', duration_ms:Date.now()-start }
    const html = await r.text()
    const ex = extract(src.id, html)
    return { ...src, status:'FETCHED', result_summary:ex.summary, amendment_detected:ex.amendment_detected, amendment_note:ex.amendment_note, duration_ms:Date.now()-start }
  } catch(e) {
    return { ...src, status:'FETCH-FAILED', result_summary:'Fetch error: '+e.message+'. Verify manually.', amendment_detected:false, amendment_note:'', duration_ms:Date.now()-start }
  }
}

export async function POST(req) {
  const { fetchIds } = await req.json()
  const sources = fetchIds ? SOURCES.filter(s=>fetchIds.includes(s.id)) : SOURCES
  const results = await Promise.all(sources.map(fetchOne))
  const summary = {
    total: results.length,
    fetched: results.filter(r=>r.status==='FETCHED').length,
    failed:  results.filter(r=>r.status==='FETCH-FAILED').length,
    amendments_found: results.filter(r=>r.amendment_detected).length,
    timestamp: new Date().toISOString()
  }
  return NextResponse.json({ results, summary })
}
