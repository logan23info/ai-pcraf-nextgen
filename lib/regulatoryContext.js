// AI-PCRAF — Regulatory Context Utility
// Server-side only — called by API routes
// Queries Supabase compliance matrix and regulatory references
// This is the single source of truth for all AI mandate generation

import { createClient } from '@supabase/supabase-js'

function getSBRColumn(sbrLayer, functionalType) {
  if (['SCB','FB'].includes(functionalType))  return 'applies_scb'
  if (functionalType === 'SFB')               return 'applies_sfb'
  if (functionalType === 'RRB')               return 'applies_rrb'
  if (sbrLayer && sbrLayer.includes('Upper')) return 'applies_ul'
  if (sbrLayer && sbrLayer.includes('Top'))   return 'applies_tl'
  if (sbrLayer && sbrLayer.includes('Middle'))return 'applies_ml'
  return 'applies_bl'
}

function getValue(row, sbrCol) {
  if (sbrCol === 'applies_scb') return row.value_scb || row.value_ul
  if (sbrCol === 'applies_ul')  return row.value_ul
  if (sbrCol === 'applies_ml')  return row.value_ml
  return row.value_bl
}

export async function getEntityRegulatoryContext(functionalType, sbrLayer) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const sbrCol = getSBRColumn(sbrLayer, functionalType)

  // Load matrix requirements
  const { data: matrix } = await sb
    .from('regulatory_compliance_matrix')
    .select('*')
    .eq('active', true)
    .order('category', { ascending: true })

  // Load applicable regulatory references
  const { data: refs } = await sb
    .from('regulatory_references')
    .select('ref_code,title,issuing_body,effective_date,applicability')
    .eq('active', true)
    .order('effective_date', { ascending: false })

  const applicable = []
  const notApplicable = []

  ;(matrix || []).forEach(function(row) {
    const exceptions = row.entity_exceptions || {}
    const isExempt = exceptions[functionalType] &&
      (exceptions[functionalType].includes('exempt') ||
       exceptions[functionalType].includes('not applicable') ||
       exceptions[functionalType].includes('not required'))
    const applies = row[sbrCol] === true && !isExempt
    const value   = getValue(row, sbrCol)

    if (applies) {
      applicable.push({
        code:              row.requirement_code,
        name:              row.requirement_name,
        category:          row.category,
        source_ref:        row.source_ref,
        value:             value || 'Required',
        evidence:          row.evidence_required,
        testing:           row.testing_procedure,
        frequency:         row.audit_frequency,
        exception:         exceptions[functionalType] || null,
      })
    } else {
      notApplicable.push({
        code: row.requirement_code,
        name: row.requirement_name,
        reason: exceptions[functionalType] || ('Not applicable to ' + sbrLayer),
      })
    }
  })

  // Filter applicable refs
  const applicableRefs = (refs || []).filter(function(ref) {
    const app = ref.applicability || {}
    const types = app.entity_types || []
    const excludes = app.excludes || []
    return !excludes.includes(functionalType) &&
      (types.includes('ALL') || types.includes(functionalType))
  })

  // Build structured context string for AI system prompt
  const contextLines = [
    'VERIFIED REGULATORY CONTEXT FOR: ' + functionalType + ' | ' + sbrLayer,
    'Source: Supabase regulatory_compliance_matrix (verified facts)',
    '',
    'APPLICABLE REGULATORY FRAMEWORKS:',
    applicableRefs.map(function(r) {
      return '- ' + r.ref_code + ': ' + r.title + ' (effective ' + r.effective_date + ')'
    }).join('
'),
    '',
    'MANDATORY REQUIREMENTS (' + applicable.length + '):',
    applicable.map(function(r) {
      return '[' + r.code + '] ' + r.name + ' | ' + r.category +
        '
  Required: ' + r.value +
        '
  Source: ' + r.source_ref +
        '
  Evidence: ' + (r.evidence || 'Not specified') +
        '
  Frequency: ' + (r.frequency || 'Annual')
    }).join('

'),
    '',
    'NOT APPLICABLE TO THIS ENTITY (' + notApplicable.length + '):',
    notApplicable.map(function(r) {
      return '- ' + r.code + ' ' + r.name + ': ' + r.reason
    }).join('
'),
    '',
    'INSTRUCTION: Generate output based ONLY on the MANDATORY REQUIREMENTS above.',
    'Do not add requirements not in this list.',
    'Do not remove requirements that are in this list.',
    'Your role is to explain and elaborate — not to decide what applies.',
  ].join('
')

  return {
    applicable,
    notApplicable,
    applicableRefs,
    contextString: contextLines,
    sbrColumn: sbrCol,
  }
}
