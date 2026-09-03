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

      // Try to detect columns — flexible mapping
      controls = rows.map((row, i) => {
        const keys = Object.keys(row).map(k => k.toLowerCase())
        const get  = (...candidates) => {
          for (const c of candidates) {
            const k = keys.find(k => k.includes(c))
            if (k) return String(row[Object.keys(row)[keys.indexOf(k)]] || '')
          }
          return ''
        }
        return {
          row_index:         i + 2,
          control_statement: get('control','description','objective','statement'),
          domain:            get('domain','category','area'),
          citation:          get('citation','reference','regulation','codex','ref'),
          sla:               get('sla','timeline','frequency'),
          evidence:          get('evidence','artifact','document'),
          control_type:      get('type','preventive','detective','corrective'),
        }
      }).filter(c => c.control_statement.length > 10)

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

    return NextResponse.json({ filename, controls, count: controls.length })

  } catch(e) {
    console.error('ingest-library error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
