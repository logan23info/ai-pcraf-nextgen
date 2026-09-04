import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Map SBR layer string to column name
function getSBRColumn(sbrLayer, functionalType) {
  if (['SCB','FB'].includes(functionalType))  return 'applies_scb'
  if (functionalType === 'SFB')               return 'applies_sfb'
  if (functionalType === 'RRB')               return 'applies_rrb'
  if (sbrLayer && sbrLayer.includes('Upper')) return 'applies_ul'
  if (sbrLayer && sbrLayer.includes('Top'))   return 'applies_tl'
  if (sbrLayer && sbrLayer.includes('Middle'))return 'applies_ml'
  return 'applies_bl'
}

// Get value for this SBR layer
function getValue(req, sbrColumn) {
  if (sbrColumn === 'applies_scb') return req.value_scb || req.value_ul
  if (sbrColumn === 'applies_ul')  return req.value_ul
  if (sbrColumn === 'applies_ml')  return req.value_ml
  return req.value_bl
}

export async function POST(req) {
  const { functionalType, sbrLayer } = await req.json()

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  try {
    const { data, error } = await sb
      .from('regulatory_compliance_matrix')
      .select('*')
      .eq('active', true)
      .order('category', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const sbrCol = getSBRColumn(sbrLayer, functionalType)

    const applicable = []
    const notApplicable = []

    ;(data || []).forEach(function(req) {
      // Check entity exceptions first
      const exceptions = req.entity_exceptions || {}
      const isExempt = exceptions[functionalType] &&
        (exceptions[functionalType].includes('exempt') ||
         exceptions[functionalType].includes('not applicable') ||
         exceptions[functionalType].includes('not required'))

      const applies = req[sbrCol] === true && !isExempt
      const value   = getValue(req, sbrCol)
      const exceptionNote = exceptions[functionalType] || null

      const item = {
        requirement_code:  req.requirement_code,
        requirement_name:  req.requirement_name,
        category:          req.category,
        source_ref:        req.source_ref,
        description:       req.description,
        value:             applies ? value : (exceptionNote || 'Not applicable'),
        evidence_required: req.evidence_required,
        testing_procedure: req.testing_procedure,
        audit_frequency:   req.audit_frequency,
        applies:           applies,
        exception_note:    exceptionNote,
      }

      if (applies) applicable.push(item)
      else notApplicable.push(item)
    })

    return NextResponse.json({
      functional_type: functionalType,
      sbr_layer:       sbrLayer,
      applicable,
      not_applicable:  notApplicable,
      summary: {
        total:      data.length,
        applicable: applicable.length,
        categories: [...new Set(applicable.map(function(r){return r.category}))]
      }
    })
  } catch(e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
