import { NextResponse } from 'next/server'

export async function POST(req) {
  const body       = await req.json()
  const entityName = body.entityName || ''
  const rbiRegNo   = body.rbiRegNo   || ''

  const urls = [
    'https://www.rbi.org.in/Scripts/BS_NBFCList.aspx',
    'https://www.rbi.org.in/Scripts/banklinks.aspx',
  ]

  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI-PCRAF/3.0)' },
        signal: AbortSignal.timeout(8000)
      })
      if (!r.ok) continue
      const html      = await r.text()
      const nameFound = entityName ? html.toLowerCase().includes(entityName.toLowerCase().substring(0, 10)) : false
      const regFound  = rbiRegNo   ? html.includes(rbiRegNo) : false
      const verified  = nameFound || regFound

      return NextResponse.json({
        verified:     verified,
        name_found:   nameFound,
        reg_found:    regFound,
        source_url:   url,
        status:       verified ? 'VERIFIED' : 'NOT_FOUND',
        note:         verified
          ? 'Entity reference found in RBI registry. Verify full details manually at ' + url
          : 'Entity not auto-detected. Site may block automated search. Verify manually at ' + url,
        verified_at: new Date().toISOString()
      })
    } catch(e) { continue }
  }

  return NextResponse.json({
    verified:    false,
    status:      'FETCH_FAILED',
    note:        'RBI registry sites blocked automated fetch. Verify manually at rbi.org.in/Scripts/BS_NBFCList.aspx',
    source_url:  urls[0],
    verified_at: new Date().toISOString()
  })
}
