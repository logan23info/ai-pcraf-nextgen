import { NextResponse } from 'next/server'

// Chunk text into segments for LLM processing
function chunkText(text, size) {
  size = size || 800
  const chunks = []
  const paragraphs = text.split('\n\n')
  let current = ''
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i]
    if ((current + para).length > size && current) {
      chunks.push(current.trim())
      current = para
    } else {
      current = current ? current + '\n\n' + para : para
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.filter(function(c) { return c.length > 50 })
}

async function extractObligations(chunk, apiKey, fetchId) {
  const prompt = [
    'You are a regulatory obligation extractor for Indian BFSI IT Audit under AI-PCRAF v3.0.',
    'Extract ONLY actionable IT control obligations from this regulatory text chunk.',
    'Regulatory source: ' + (fetchId || 'Indian regulatory document'),
    '',
    'Text chunk:',
    chunk,
    '',
    'Return ONLY a JSON array. No markdown. Start with [ end with ]',
    'Each item: {"section_ref":"Ch X Sec Y.Z","obligation_text":"precise obligation","domain":"CBS|CLD|API|IAM|AI|INC|TPR|DLP|AUD","tier":"ALL|SCB|NBFC-ML|NBFC-BL","sla":"time or null"}',
    '',
    'STRICT FILTER - DO NOT extract - return [] for these:',
    '- Short title or naming of the document (administrative, commencement, applicability)',
    '- Commencement date: come into effect immediately (administrative provision)',
    '- Applicability: applicable to commercial banks',
    '- Definitions: X means Y for the purpose of',
    '- Penalty provisions or enforcement consequences',
    '- Transitional or saving clauses',
    '',
    'ONLY extract obligations requiring IT control, process, governance, or security action.',
    'Valid: board must approve IT policy annually, SOC must operate 24x7, report within 6 hours',
    'Invalid: these directions shall be called, come into effect, applicable to, means',
    '',
    'If no valid control obligations found return []',
  ].join('\\n')

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        max_tokens: 1500,
        messages: [
          { role: 'system', content: 'Return ONLY valid JSON arrays. No markdown. No preamble.' },
          { role: 'user', content: prompt }
        ]
      })
    })
    const data = await r.json()
    const raw = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '[]'
    const fb = raw.indexOf('[')
    const lb = raw.lastIndexOf(']')
    try { return JSON.parse(fb !== -1 && lb > fb ? raw.substring(fb, lb + 1) : '[]') }
    catch (e) { return [] }
  } catch (e) { return [] }
}

export async function POST(req) {
  const apiKey = process.env.PCRAF_Key
  if (!apiKey) return NextResponse.json({ error: 'PCRAF_Key not set' }, { status: 500 })

  try {
    const formData = await req.formData()
    const file     = formData.get('file')
    const fetchId  = formData.get('fetchId') || ''

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const filename = file.name || 'document.pdf'
    const fileType = filename.split('.').pop().toLowerCase()
    const buffer   = Buffer.from(await file.arrayBuffer())

    let text = ''

    if (fileType === 'pdf') {
      // pdf-parse workaround: import the lib file directly to avoid test file ENOENT
      const pdfParse = require('pdf-parse/lib/pdf-parse.js')
      const parsed   = await pdfParse(buffer)
      text = parsed.text
    } else if (fileType === 'docx' || fileType === 'doc') {
      const mammoth = require('mammoth')
      const result  = await mammoth.extractRawText({ buffer })
      text = result.value
    } else if (fileType === 'txt') {
      text = buffer.toString('utf-8')
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Upload PDF, DOCX, or TXT.' }, { status: 400 })
    }

    if (!text || text.length < 100) {
      return NextResponse.json({ error: 'Could not extract text. Try a text-based PDF.' }, { status: 400 })
    }

    const chunks  = chunkText(text, 800).slice(0, 10)
    const results = await Promise.all(chunks.map(function(chunk) { return extractObligations(chunk, apiKey, fetchId) }))
    const obligations = results.reduce(function(acc, arr) { return acc.concat(arr) }, [])
      .filter(function(o) { return o.obligation_text && o.obligation_text.length > 20 })

    const seen = {}
    const unique = obligations.filter(function(o) {
      const key = o.obligation_text.substring(0, 60).toLowerCase()
      if (seen[key]) return false
      seen[key] = true
      return true
    })

    return NextResponse.json({
      filename: filename,
      fetch_id: fetchId,
      text_length: text.length,
      chunks_processed: chunks.length,
      obligations: unique,
      count: unique.length
    })

  } catch (e) {
    console.error('scan-document error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
