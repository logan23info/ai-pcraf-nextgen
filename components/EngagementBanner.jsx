"use client"
import { useEngagement } from '../lib/EngagementContext'

const SEV_COLOR = {
  Critical: { bg:'#FEE2E2', color:'#991B1B' },
  High:     { bg:'#FFEDD5', color:'#C2410C' },
  Medium:   { bg:'#FEF3C7', color:'#92400E' },
  Low:      { bg:'#D1FAE5', color:'#065F46' },
}

export default function EngagementBanner() {
  const { entity, activeTriggers, criticalTriggers, coverageMap, mandateProfile, loading } = useEngagement()

  if (!entity || loading) return null

  const hasCritical = criticalTriggers.length > 0
  const coveragePct = coverageMap.pct || 0
  const coverageColor = coveragePct >= 80 ? '#065F46' : coveragePct >= 50 ? '#92400E' : '#991B1B'

  return (
    <div className="border-b px-6 py-2" style={{
      background: hasCritical ? '#FEF2F2' : '#F0F4FF',
      borderColor: hasCritical ? '#FECACA' : '#BFD0FE'
    }}>
      <div className="flex items-center justify-between flex-wrap gap-2">

        {/* Entity identity */}
        <div className="flex items-center gap-3">
          <div className="text-sm font-bold" style={{color:'#0F1E3C'}}>
            {entity.name}
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{background:'#DBEAFE',color:'#1E3A8A'}}>
            {entity.functional_type || entity.type}
          </span>
          {entity.sbr_layer && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{background:'#EDE9FE',color:'#5B21B6'}}>
              {entity.sbr_layer}
            </span>
          )}
          {mandateProfile?.profile_locked && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{background:'#D1FAE5',color:'#065F46'}}>
              &#128274; Profile locked
            </span>
          )}
        </div>

        {/* Drift triggers */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeTriggers.length > 0 ? (
            <>
              <span className="text-xs text-gray-500">
                {activeTriggers.length} drift trigger{activeTriggers.length>1?'s':''}:
              </span>
              {activeTriggers.slice(0,4).map(t => (
                <span key={t.id} className="text-xs px-2 py-0.5 rounded font-semibold"
                  style={SEV_COLOR[t.severity]||SEV_COLOR.Medium}>
                  {t.trigger_ref} {t.domain} [{t.severity}]
                </span>
              ))}
              {activeTriggers.length > 4 && (
                <span className="text-xs text-gray-400">+{activeTriggers.length-4} more</span>
              )}
            </>
          ) : (
            <span className="text-xs text-gray-400">No active drift triggers</span>
          )}
        </div>

        {/* Coverage map */}
        {coverageMap.total > 0 && (
          <div className="flex items-center gap-3 text-xs">
            <span style={{color:coverageColor,fontWeight:600}}>
              {coveragePct}% coverage
            </span>
            <span style={{color:'#991B1B'}}>GAP: {coverageMap.gap}</span>
            <span style={{color:'#92400E'}}>WEAK: {coverageMap.weak}</span>
            <span style={{color:'#1E40AF'}}>[VT]: {coverageMap.covered_vt}</span>
            <span style={{color:'#065F46'}}>[V]: {coverageMap.covered_v}</span>
          </div>
        )}
      </div>
    </div>
  )
}
