import { NextResponse } from 'next/server'

export const config = { api: { bodyParser: false } }

// Chunk text into ~800 char segments for LLM processing
function chunkText(text, size = 800) {
  const chunks = []
  const paragraphs = text.split(/
{2,}/)
  let current = ''
  for (const para of paragraphs) {
    if ((current + para).length > size && current) {
      chunks.push(current.trim())
      current = para
    } else {
      current += '\n\n' + para
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.filter(c => c.length > 50)
}

async function extractObligations(chunk, apiKey, fetchId) {
  const prompt = `You are a regulatory obligation extractor for Indian BFSI IT Audit under AI-PCRAF v3.0.

Extract all control obligations from this regulatory text chunk.
Regulatory source: ${fetchId || 'Indian regulatory document'}

Text chunk:
${chunk}

Return ONLY a JSON array. No markdown. No preamble. Start with [ end with ]
Each item must have:
{
  "section_ref": "Chapter X, Section Y.Z or clause number",
  "obligation_text": "precise obligation statement",
  "domain": "CBS|CLD|API|IAM|AI|INC|TPR|DLP|AUD",
  "tier": "ALL|SCB|SFB|NBFC-ML|NBFC-UL|NBFC-BL",
  "sla": "time constraint if any, else null"
}
If no obligations found in this chunk return []`

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
  const raw = data.choices?.[0]?.message?.content || '[]'
  const fb = raw.indexOf('['), lb = raw.lastIndexOf(']')
  try { return JSON.parse(fb !== -1 && lb > fb ? raw.substring(fb, lb+1) : '[]') }
  catch { return [] }
}

export async function POST(req) {
  const apiKey = process.env.PCRAF_Key
  if (!apiKey) return NextResponse.json({ error: 'PCRAF_Key not set' }, { status: 500 })

  try {
    const formData = await req.formData()
    const file     = formData.get('file')
    const fetchId  = formData.get('fetchId') || ''
    const userId   = formData.get('userId')  || ''

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const filename = file.name || 'document.pdf'
    const fileType = filename.split('.').pop().toLowerCase()
    const buffer   = Buffer.from(await file.arrayBuffer())

    let text = ''

    if (fileType === 'pdf') {
      const pdfParse = require('pdf-parse')
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
      return NextResponse.json({ error: 'Could not extract text from document. Try a text-based PDF.' }, { status: 400 })
    }

    // Chunk and extract obligations in parallel (max 10 chunks to control tokens)
    const chunks = chunkText(text, 800).slice(0, 10)
    const results = await Promise.all(chunks.map(chunk => extractObligations(chunk, apiKey, fetchId)))
    const obligations = results.flat().filter(o => o.obligation_text && o.obligation_text.length > 20)

    // Deduplicate by obligation_text similarity
    const seen = new Set()
    const unique = obligations.filter(o => {
      const key = o.obligation_text.substring(0, 60).toLowerCase()
      if (seen.has(key)) return false
      seen.add(key); return true
    })

    return NextResponse.json({
      filename,
      fetch_id:     fetchId,
      text_length:  text.length,
      chunks_processed: chunks.length,
      obligations:  unique,
      count:        unique.length
    })

  } catch(e) {
    console.error('scan-document error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
