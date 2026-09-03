"use client"
import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const EngagementContext = createContext(null)

// SBR layer derivation — per RBI SBR Master Direction October 19, 2023 [VT]
// Upper Layer and Top Layer cannot be auto-derived — RBI identifies these specifically
// Auditor must manually confirm UL/TL if RBI has notified the entity
export function deriveSBRLayer(functionalType, totalAssets) {
  const assets = parseFloat(totalAssets) || 0

  // Categorically Base Layer regardless of asset size — per RBI SBR MD 2023
  if (['NBFC-AA','NBFC-P2P','NOFHC'].includes(functionalType)) {
    return 'Base Layer (BL)'
  }

  // Categorically Middle Layer regardless of asset size — per RBI SBR MD 2023
  // HFC, IDF-NBFC, NBFC-CIC, NBFC-IFC are ML by activity classification
  if (['NBFC-HFC','IDF-NBFC','NBFC-CIC','NBFC-IFC'].includes(functionalType)) {
    return 'Middle Layer (ML)'
  }

  // Asset-based classification for ICC, MFI, Factor, MGC, SPD and Banking entities
  // Threshold: Rs 1,000 crore — per RBI SBR MD 2023
  if (assets >= 1000) return 'Middle Layer (ML)'
  if (assets > 0)     return 'Base Layer (BL)'

  // No assets entered — cannot derive
  return 'Enter total assets to derive SBR layer'
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
  // Shared incident state — Truth Table sets, DAKSH reads
  const [activeIncident, setActiveIncident] = useState(null)
  // Last dossier fetch timestamps — Truth Table reads for staleness check
  const [lastFetchDates, setLastFetchDates] = useState({})

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

      // Load controls — filtered by active entity
      // Shows controls matching entity_id, plus legacy controls with no entity_id
      let ctrlData = []
      if (ent?.id) {
        const { data: withEntity }   = await sb.from('controls').select('*')
          .eq('user_id', user.id).eq('entity_id', ent.id).order('created_at', { ascending: true })
        const { data: noEntity }     = await sb.from('controls').select('*')
          .eq('user_id', user.id).is('entity_id', null).order('created_at', { ascending: true })
        ctrlData = [...(withEntity||[]), ...(noEntity||[])]
      } else {
        const { data: all } = await sb.from('controls').select('*')
          .eq('user_id', user.id).order('created_at', { ascending: true })
        ctrlData = all || []
      }
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
      // Load last fetch dates for staleness check
      const { data: fetchData } = await sb.from('dossier_log')
        .select('fetch_id, fetched_at')
        .eq('user_id', user.id)
        .order('fetched_at', { ascending: false })
        .limit(60)
      if (fetchData?.length) {
        const dates = {}
        fetchData.forEach(function(r) {
          if (!dates[r.fetch_id]) dates[r.fetch_id] = r.fetched_at
        })
        setLastFetchDates(dates)
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
    // Shared incident state
    activeIncident, setActiveIncident,
    // Dossier staleness
    lastFetchDates, setLastFetchDates,
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
