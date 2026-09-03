"use client"
import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const EngagementContext = createContext(null)

// SBR layer derivation — deterministic from functional type + assets
export function deriveSBRLayer(functionalType, totalAssets) {
  const assets = parseFloat(totalAssets) || 0
  // Always Base Layer types
  if (['NBFC-AA','NBFC-P2P','NOFHC'].includes(functionalType)) return 'Base Layer (BL)'
  // Always Middle Layer types
  if (['NBFC-CIC','NBFC-IFC','IDF-NBFC','NBFC-MGC','NBFC-SPD','NBFC-HFC'].includes(functionalType)) return 'Middle Layer (ML)'
  // Asset-based for ICC, MFI, Factor
  if (assets >= 1000) return 'Middle Layer (ML)'
  if (assets > 0)     return 'Base Layer (BL)'
  return 'Base Layer (BL)'
}

// NOF threshold by functional type
export function deriveNOF(functionalType) {
  const map = {
    'NBFC-AA':'₹2 Crore', 'NBFC-P2P':'₹2 Crore',
    'NBFC-HFC':'₹20 Crore', 'NBFC-MGC':'₹100 Crore',
    'NBFC-CIC':'₹100 Crore', 'NBFC-IFC':'₹300 Crore',
    'IDF-NBFC':'₹300 Crore', 'NBFC-SPD':'₹150 Crore',
  }
  return map[functionalType] || '₹10 Crore'
}

export function EngagementProvider({ children, user, sb }) {
  const [entity, setEntity]               = useState(null)
  const [mandateProfile, setMandateProfile] = useState(null)
  const [driftTriggers, setDriftTriggers] = useState([])
  const [controls, setControls]           = useState([])
  const [coverageMap, setCoverageMap]     = useState({ covered_v:0, covered_vt:0, weak:0, gap:0, total:0, pct:0 })
  const [loading, setLoading]             = useState(false)

  // Load engagement context from DB + localStorage
  const loadContext = useCallback(async () => {
    if (!user || !sb) return
    setLoading(true)
    try {
      // Load latest entity
      const { data: entities } = await sb.from('entities').select('*')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)
      const ent = entities?.[0] || null
      setEntity(ent)
      if (ent?.mandate_profile) setMandateProfile(ent.mandate_profile)

      // Load drift triggers
      if (ent?.id) {
        const { data: signals } = await sb.from('risk_signals').select('*')
          .eq('user_id', user.id).eq('entity_id', ent.id)
          .eq('cascade_status', 'ACTIVE').order('created_at', { ascending: true })
        setDriftTriggers(signals || [])
      }

      // Load controls
      const { data: ctrlData } = await sb.from('controls').select('*')
        .eq('user_id', user.id).order('created_at', { ascending: true })
      const mapped = (ctrlData || []).map(r => ({
        id: r.control_id, ctrl_domain: r.ctrl_domain, ad_domain: r.ad_domain,
        subsystem: r.subsystem, tier: r.tier, risk_rating: r.risk_rating,
        codex_ref: r.primary_codex_ref, ctrl_type: r.control_type,
        evidence: r.evidence_artifacts, sla: r.reporting_sla,
        source_status: r.source_truth_status === 'VERIFIED-TRAINING' ? 'VT' :
                       r.source_truth_status === 'INFERRED' ? 'I' : 'U',
        created: r.created_at
      }))
      setControls(mapped)

      // Load coverage map from gap_analysis
      if (ent?.id) {
        const { data: gaps } = await sb.from('gap_analysis').select('status')
          .eq('user_id', user.id).eq('entity_id', ent.id)
        if (gaps?.length) {
          const cv  = gaps.filter(g => g.status === 'COVERED_V').length
          const cvt = gaps.filter(g => g.status === 'COVERED_VT').length
          const wk  = gaps.filter(g => g.status === 'WEAK').length
          const gp  = gaps.filter(g => g.status === 'GAP').length
          const tot = gaps.length
          setCoverageMap({ covered_v:cv, covered_vt:cvt, weak:wk, gap:gp, total:tot,
            pct: Math.round(((cv+cvt)/tot)*100) })
        }
      }
    } catch(e) { console.error('loadContext error:', e) }
    finally { setLoading(false) }
  }, [user, sb])

  useEffect(() => { loadContext() }, [loadContext])

  // Derived flags from mandate profile
  const ciiPresumption     = mandateProfile?.cii_presumption     || false
  const piiAlwaysInvolved  = mandateProfile?.pii_always_involved || false
  const priorityDomains    = mandateProfile?.priority_domains    || []
  const activeTriggers     = driftTriggers.filter(t => t.cascade_status === 'ACTIVE')
  const criticalTriggers   = activeTriggers.filter(t => t.severity === 'Critical')

  const value = {
    entity, setEntity, mandateProfile, setMandateProfile,
    driftTriggers, setDriftTriggers, controls, setControls,
    coverageMap, setCoverageMap,
    loadContext, loading,
    // Derived
    ciiPresumption, piiAlwaysInvolved, priorityDomains,
    activeTriggers, criticalTriggers,
    currentEntityId: entity?.id || null,
    entityName: entity?.name || '',
  }

  return <EngagementContext.Provider value={value}>{children}</EngagementContext.Provider>
}

export function useEngagement() {
  const ctx = useContext(EngagementContext)
  if (!ctx) throw new Error('useEngagement must be used within EngagementProvider')
  return ctx
}
