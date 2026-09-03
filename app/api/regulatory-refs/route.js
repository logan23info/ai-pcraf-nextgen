import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req) {
  const { functionalType, sbrLayer } = await req.json()

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  try {
    const { data, error } = await sb
      .from('regulatory_references')
      .select('*')
      .eq('active', true)
      .order('effective_date', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Filter by applicability
    const applicable = []
    const notApplicable = []

    ;(data || []).forEach(function(ref) {
      const app = ref.applicability || {}
      const types = app.entity_types || []
      const excludes = app.excludes || []

      const isExcluded = excludes.includes(functionalType)
      const isApplicable = types.includes('ALL') || types.includes(functionalType) ||
        (sbrLayer && types.some(function(t) {
          return t.includes(sbrLayer.split(' ')[0])
        }))

      if (!isExcluded && isApplicable) applicable.push(ref)
      else notApplicable.push(ref)
    })

    return NextResponse.json({ applicable, notApplicable })
  } catch(e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
