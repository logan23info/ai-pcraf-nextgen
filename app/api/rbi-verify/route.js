import { NextResponse } from 'next/server'

export async function POST(req) {
  const { entityName, rbiRegNo, entityType } = await req.json()

  // RBI NBFC public list — attempt fetch
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
      const html = await r.text()
      const nameFound = entityName && html.toLowerCase().includes(entityName.toLowerCase().substring(0,10))
      const regFound  = rbiRegNo   && html.includes(rbiRegNo)

      return NextResponse.json({
        verified:     nameFound || regFound,
        name_found:   nameFound,
        reg_found:    regFound,
        source_url:   url,
        status:       nameFound || regFound ? 'VERIFIED' : 'NOT_FOUND',
        note:         nameFound || regFound
          ? 'Entity reference found in RBI registry. Verify full details manually at ' + url
          : 'Entity not auto-detected. Government site may block automated search. Verify manually at ' + url,
        verified_at:  new Date().toISOString()
      })
    } catch(e) { continue }
  }

  return NextResponse.json({
    verified: false,
    status: 'FETCH_FAILED',
    note: 'RBI registry sites blocked automated fetch. Verify manually at rbi.org.in/Scripts/BS_NBFCList.aspx',
    source_url: urls[0],
    verified_at: new Date().toISOString()
  })
}
