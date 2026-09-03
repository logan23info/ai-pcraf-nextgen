import { NextResponse } from 'next/server'

export async function POST(req) {
  const apiKey = process.env.PCRAF_Key
  if (!apiKey) return NextResponse.json({ error: 'PCRAF_Key not set' }, { status: 500 })

  try {
    const formData = await req.formData()
    const file     = formData.get('file')
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const filename = file.name || 'library.xlsx'
    const fileType = filename.split('.').pop().toLowerCase()
    const buffer   = Buffer.from(await file.arrayBuffer())

    let controls = []

    if (fileType === 'xlsx' || fileType === 'xls' || fileType === 'csv') {
      const XLSX = require('xlsx')
      const wb   = XLSX.read(buffer, { type: 'buffer' })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

      if (!rows.length) {
        return NextResponse.json({ error: 'No data rows found in file', filename, controls: [], count: 0 })
      }

      // Get actual headers for debugging
      const actualHeaders = Object.keys(rows[0])
      console.log('Excel headers found:', actualHeaders)

      // Clean a key for matching
      function cleanKey(k) { return k.toLowerCase().replace(/[^a-z0-9]/g,'') }

      // Find the best column for a field using ordered candidates
      // Uses longest-description column when multiple match 'control'
      function getBestCol(row, candidates) {
        const rowKeys = Object.keys(row)
        // First: exact prefix match (e.g. 'statement' matches 'Control Statement' but not 'Control ID')
        for (const candidate of candidates) {
          const c = candidate.toLowerCase().replace(/[^a-z0-9]/g,'')
          const match = rowKeys.find(k => {
            const ck = cleanKey(k)
            // Prefer keys where candidate appears NOT at position 0 (avoids 'controlid' matching 'control')
            return ck.includes(c) && ck.indexOf(c) > 0
          })
          if (match) {
            const val = String(row[match] || '').trim()
            if (val) return val
          }
        }
        // Second: any match
        for (const candidate of candidates) {
          const c = candidate.toLowerCase().replace(/[^a-z0-9]/g,'')
          const match = rowKeys.find(k => cleanKey(k).includes(c))
          if (match) {
            const val = String(row[match] || '').trim()
            if (val) return val
          }
        }
        return ''
      }

      // For control statement specifically — pick the longest text column
      function getControlStatement(row) {
        const rowKeys = Object.keys(row)
        const candidates = rowKeys.filter(k => {
          const ck = cleanKey(k)
          return ck.includes('statement') || ck.includes('objective') ||
                 ck.includes('description') || ck.includes('activity') ||
                 ck.includes('requirement') || ck.includes('procedure')
        })
        // If no match, pick the longest value column
        const pool = candidates.length ? candidates : rowKeys
        let best = '', bestLen = 0
        for (const k of pool) {
          const v = String(row[k] || '').trim()
          if (v.length > bestLen && v.length > 10) { best = v; bestLen = v.length }
        }
        return best
      }

      controls = rows.map(function(row, i) {
        return {
          row_index:         i + 2,
          control_statement: getControlStatement(row),
          domain:            getBestCol(row, ['domain','category','area']),
          citation:          getBestCol(row, ['citation','reference','regulation','codex','rbi','cert','dpdp','standard']),
          sla:               getBestCol(row, ['sla','timeline','frequency','period','schedule']),
          evidence:          getBestCol(row, ['evidence','artifact','document','proof','record']),
          control_type:      getBestCol(row, ['type','preventive','detective','corrective','nature']),
          _headers:          actualHeaders.join(' | ')
        }
      }).filter(function(c) { return c.control_statement && c.control_statement.length > 10 })

    } else if (fileType === 'json') {
      const data = JSON.parse(buffer.toString('utf-8'))
      const arr  = Array.isArray(data) ? data : (data.controls || [])
      controls   = arr.map((c, i) => ({
        row_index:         i + 1,
        control_statement: c.control_name || c.control_statement || c.focus || '',
        domain:            c.ctrl_domain  || c.domain || c.ad_domain || '',
        citation:          c.codex_ref    || c.primary_codex_ref || c.citation || '',
        sla:               c.sla          || c.reporting_sla || '',
        evidence:          c.evidence     || c.evidence_artifacts || '',
        control_type:      c.ctrl_type    || c.control_type || '',
      })).filter(c => c.control_statement.length > 10)

    } else if (fileType === 'docx' || fileType === 'doc') {
      const mammoth = require('mammoth')
      const result  = await mammoth.extractRawText({ buffer })
      const lines   = result.value.split('\n').filter(l => l.trim().length > 20)

      // Use AI to extract controls from Word document
      const prompt = `Extract all IT audit controls from this document text.
Return ONLY a JSON array. Each item: {"control_statement":"...","domain":"CBS|IAM|CLD|API|INC|TPR|DLP|AUD","citation":"...","sla":"...","evidence":"..."}
Text: ${lines.slice(0,100).join('\n')}`

      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},
        body: JSON.stringify({ model:'openai/gpt-oss-120b', max_tokens:2000,
          messages:[{role:'user',content:prompt}] })
      })
      const data = await r.json()
      const raw  = data.choices?.[0]?.message?.content || '[]'
      const fb = raw.indexOf('['), lb = raw.lastIndexOf(']')
      try { controls = JSON.parse(fb!==-1&&lb>fb ? raw.substring(fb,lb+1) : '[]') }
      catch { controls = [] }

    } else if (fileType === 'pdf') {
      const pdfParse = require('pdf-parse')
      const parsed   = await pdfParse(buffer)
      const lines    = parsed.text.split('\n').filter(l => l.trim().length > 20)

      const prompt = `Extract all IT audit controls from this document text.
Return ONLY a JSON array. Each item: {"control_statement":"...","domain":"CBS|IAM|CLD|API|INC|TPR|DLP|AUD","citation":"...","sla":"...","evidence":"..."}
Text: ${lines.slice(0,100).join('\n')}`

      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},
        body: JSON.stringify({ model:'openai/gpt-oss-120b', max_tokens:2000,
          messages:[{role:'user',content:prompt}] })
      })
      const data = await r.json()
      const raw  = data.choices?.[0]?.message?.content || '[]'
      const fb = raw.indexOf('['), lb = raw.lastIndexOf(']')
      try { controls = JSON.parse(fb!==-1&&lb>fb ? raw.substring(fb,lb+1) : '[]') }
      catch { controls = [] }

    } else {
      return NextResponse.json({ error: 'Unsupported format. Use Excel, CSV, JSON, Word, or PDF.' }, { status: 400 })
    }

    const headers = controls.length > 0 ? controls[0]._headers : 'no headers detected'
    controls = controls.map(function(c) { delete c._headers; return c })
    return NextResponse.json({ filename, controls, count: controls.length, detected_headers: headers })

  } catch(e) {
    console.error('ingest-library error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
