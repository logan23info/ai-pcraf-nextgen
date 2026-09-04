"use client"
import { useState, useEffect } from 'react'
import { callAPI } from '../lib/api'
import { formatAIOutput } from '../lib/formatter'
import { useEngagement, deriveSBRLayer, deriveNOF } from '../lib/EngagementContext'
import { Card, SectionHeader, FormGrid, FormGroup, Input, Select, Textarea, BtnRow, Btn, Spinner, AIOutput, Tag } from './ui'

const FUNCTIONAL_TYPES = [
  { group:'Banking', types:[
    ['SCB','Scheduled Commercial Bank'],['SFB','Small Finance Bank'],
    ['RRB','Regional Rural Bank'],['FB','Foreign Bank (Branch)'],
    ['UCB','Urban Cooperative Bank'],['PB','Payments Bank'],
  ]},
  { group:'NBFC — Functional', types:[
    ['NBFC-ICC','NBFC-ICC — Investment & Credit Company'],
    ['NBFC-MFI','NBFC-MFI — Micro Finance Institution'],
    ['NBFC-HFC','NBFC-HFC — Housing Finance Company'],
    ['NBFC-Factor','NBFC-Factor — Factoring Company'],
    ['NBFC-AA','NBFC-AA — Account Aggregator'],
    ['NBFC-P2P','NBFC-P2P — Peer-to-Peer Lending'],
    ['NBFC-CIC','NBFC-CIC — Core Investment Company'],
    ['NBFC-IFC','NBFC-IFC — Infrastructure Finance Company'],
    ['IDF-NBFC','IDF-NBFC — Infrastructure Debt Fund'],
    ['NBFC-MGC','NBFC-MGC — Mortgage Guarantee Company'],
    ['NOFHC','NOFHC — Non-Operative Financial Holding'],
    ['NBFC-SPD','NBFC-SPD — Standalone Primary Dealer'],
  ]},
]

const SEV_COLOR = {
  Critical:{ bg:'#FEE2E2',color:'#991B1B' },
  High:    { bg:'#FFEDD5',color:'#C2410C' },
  Medium:  { bg:'#FEF3C7',color:'#92400E' },
  Low:     { bg:'#D1FAE5',color:'#065F46' },
}

export default function EntityProfiler({ user, sb, showToast }) {
  const { setEntity, setMandateProfile, setDriftTriggers, loadContext } = useEngagement()

  const [form, setForm] = useState({
    name:'', functionalType:'', totalAssets:'', rbiRegNo:'',
    cbs:'', cloud:'none', assets:'', period:'',
    recentChanges:'', knownWeaknesses:'', externalSignals:'',
    sbrOverride:''
  })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const sbrLayer = form.functionalType ? deriveSBRLayer(form.functionalType, form.totalAssets) : ''
  const nofThreshold = form.functionalType ? deriveNOF(form.functionalType) : ''

  // ALL useState hooks declared first — React Rules of Hooks
  const [output, setOutput]           = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [regRefs, setRegRefs]         = useState({ applicable:[], notApplicable:[] })
  const [refsLoading, setRefsLoading] = useState(false)
  const [matrix, setMatrix]           = useState({ applicable:[], summary:{} })
  const [matrixLoading, setMatrixLoading] = useState(false)
  const [verifying, setVerifying]     = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)
  const [triggers, setTriggers]       = useState([])
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [profile, setProfile]         = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileLocked, setProfileLocked]   = useState(false)
  const [activeSection, setActiveSection]   = useState('identity')

  // useEffect after all useState — P1 regulatory refs load
  useEffect(function() {
    if (!form.functionalType) return
    setRefsLoading(true)
    fetch('/api/regulatory-refs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ functionalType: form.functionalType, sbrLayer })
    })
    .then(function(r) { return r.json() })
    .then(function(data) { setRegRefs(data) })
    .catch(function() {})
    .finally(function() { setRefsLoading(false) })

    setMatrixLoading(true)
    fetch('/api/compliance-matrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ functionalType: form.functionalType, sbrLayer })
    })
    .then(function(r) { return r.json() })
    .then(function(data) { setMatrix(data) })
    .catch(function() {})
    .finally(function() { setMatrixLoading(false) })
  }, [form.functionalType, sbrLayer])


  // Section A: Generate entity profile narrative
  async function generate() {
    if (!form.name||!form.functionalType) { showToast('Enter entity name and functional type'); return }
    setLoading(true); setOutput(''); setError('')
    const prompt = [
      'You are a Principal Cyber Risk Compliance Consultant under AI-PCRAF v3.0.',
      'Entity: ' + form.name + ' | Type: ' + form.functionalType + ' | SBR: ' + sbrLayer,
      'Assets: Rs ' + (form.totalAssets||'?') + ' Crore | CBS: ' + (form.cbs||'Unknown') + ' | Cloud: ' + form.cloud,
      'Period: ' + (form.period||'Not specified'),
      'Recent changes: ' + (form.recentChanges||'None'),
      'Known weaknesses: ' + (form.knownWeaknesses||'None'),
      'External signals: ' + (form.externalSignals||'None'),
      '',
      'Produce Phase 1 Entity Risk Profile for ' + form.functionalType + ' (' + sbrLayer + ').',
      '1. TIER CLASSIFICATION: use exact terminology ' + form.functionalType + ' never generic Tier-N. Cite RBI IT Gov MD 2023 Chapter/Section [VT]. CERT-In SLA = 6 hours always.',
      '2. MANDATORY IT REQUIREMENTS specific to ' + form.functionalType + ' at ' + sbrLayer + '. SOC/CISO/IT Committee with section [VT].',
      '3. TOP 5 ASSURANCE DOMAINS from AD-01 to AD-07 with rationale.',
      '4. TIER-DRIFT ALERT MATRIX: obligations if assets cross next SBR threshold.',
      '5. CII DESIGNATION ASSESSMENT with BS-04 if uncertain.',
      '6. RISK SIGNAL IMPLICATIONS: how declared risk signals amplify audit risk.',
      '',
      'Citations must include Chapter/Section. Flag DPDP [BS-01]. No GDPR/ISO/SOC2.',
    ].join('\n')
    try {
      const result = await callAPI(prompt, 2000)
      setOutput(formatAIOutput(result))
    } catch(e) { setError(e.message) } finally { setLoading(false) }
  }

  // Section B: Generate drift triggers from risk signals
  async function generateTriggers() {
    if (!form.recentChanges && !form.knownWeaknesses && !form.externalSignals) {
      showToast('Enter at least one risk signal field'); return
    }
    setTriggerLoading(true)
    try {
      const res  = await fetch('/api/drift-triggers', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          recentChanges: form.recentChanges, knownWeaknesses: form.knownWeaknesses,
          externalSignals: form.externalSignals, entityType: form.functionalType, sbrLayer
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTriggers(data.triggers || [])
      showToast((data.triggers||[]).length + ' drift triggers generated')
    } catch(e) { showToast('Trigger error: ' + e.message) }
    finally { setTriggerLoading(false) }
  }

  // Section C: Generate mandate profile
  async function generateMandateProfile() {
    if (!form.functionalType) { showToast('Select functional type first'); return }
    setProfileLoading(true)
    try {
      const res  = await fetch('/api/entity-mandate', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          functionalType: form.functionalType, sbrLayer, totalAssets: form.totalAssets,
          entityName: form.name, cbs: form.cbs, cloud: form.cloud,
          recentChanges: form.recentChanges, knownWeaknesses: form.knownWeaknesses,
          externalSignals: form.externalSignals
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setProfile(data.profile)
      showToast('Mandate profile generated — review and lock')
    } catch(e) { showToast('Profile error: ' + e.message) }
    finally { setProfileLoading(false) }
  }

  // RBI verification
  async function verifyRBI() {
    if (!form.name && !form.rbiRegNo) { showToast('Enter entity name or RBI registration number'); return }
    setVerifying(true); setVerifyResult(null)
    try {
      const res  = await fetch('/api/rbi-verify', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ entityName: form.name, rbiRegNo: form.rbiRegNo, entityType: form.functionalType })
      })
      const data = await res.json()
      setVerifyResult(data)
    } catch(e) { setVerifyResult({ status:'FETCH_FAILED', note: e.message }) }
    finally { setVerifying(false) }
  }

  // Save everything to DB
  async function saveToDB() {
    if (!form.name||!form.functionalType) { showToast('Enter name and type first'); return }
    const payload = {
      user_id: user.id, name: form.name,
      type: form.functionalType, functional_type: form.functionalType,
      sbr_layer: form.sbrOverride || sbrLayer, nof_threshold: nofThreshold,
      total_assets: parseFloat(form.totalAssets)||null,
      rbi_registration_no: form.rbiRegNo,
      rbi_verified: verifyResult?.verified||false,
      rbi_verified_at: verifyResult?.verified ? new Date().toISOString() : null,
      cbs: form.cbs, cloud: form.cloud, assets: form.assets, period: form.period,
      recent_changes: form.recentChanges, known_weaknesses: form.knownWeaknesses,
      external_signals: form.externalSignals,
      mandate_profile: profile || null,
      profile_locked: profileLocked,
      profile_locked_at: profileLocked ? new Date().toISOString() : null,
      profile_locked_by: profileLocked ? user.email : null,
      profile_version: '1.0',
      profile_ai: output ? output.replace(/<[^>]+>/g,' ') : null
    }
    const { data, error } = await sb.from('entities').insert(payload).select()
    if (error) { showToast('Save failed: ' + error.message); return }
    const entityId = data[0].id
    setEntity(data[0])
    if (profile) setMandateProfile(profile)

    // Save drift triggers
    if (triggers.length) {
      await sb.from('risk_signals').insert(
        triggers.map(t => ({
          user_id: user.id, entity_id: entityId,
          trigger_ref: t.trigger_ref, description: t.description,
          domain: t.domain, severity: t.severity,
          layer_impact: t.layer_impact, implications: t.implications,
          cascade_status: 'ACTIVE'
        }))
      )
      setDriftTriggers(triggers)
    }
    await loadContext()
    showToast('Entity saved - ' + (triggers.length||0) + ' drift triggers active')
  }

  async function loadFromDB() {
    const { data } = await sb.from('entities').select('*').eq('user_id',user.id)
      .order('created_at',{ascending:false}).limit(1)
    if (!data?.length) { showToast('No saved entity'); return }
    const e = data[0]
    setForm({
      name: e.name||'', functionalType: e.functional_type||e.type||'',
      totalAssets: e.total_assets||'', rbiRegNo: e.rbi_registration_no||'',
      cbs: e.cbs||'', cloud: e.cloud||'none', assets: e.assets||'', period: e.period||'',
      recentChanges: e.recent_changes||'', knownWeaknesses: e.known_weaknesses||'',
      externalSignals: e.external_signals||''
    })
    if (e.mandate_profile) { setProfile(e.mandate_profile); setMandateProfile(e.mandate_profile) }
    setProfileLocked(e.profile_locked||false)
    if (e.id) {
      const { data: sigs } = await sb.from('risk_signals').select('*')
        .eq('entity_id',e.id).eq('cascade_status','ACTIVE')
      if (sigs?.length) setTriggers(sigs)
    }
    setEntity(e)
    await loadContext()
    showToast('Entity loaded from Supabase')
  }

  const sections = [
    { id:'identity', label:'A. Entity Identity' },
    { id:'signals',  label:'B. Risk Signals' },
    { id:'mandate',  label:'C. Mandate Profile' },
  ]

  return (
    <div>
      <SectionHeader title="Entity risk profiling & tier classification"
        subtitle="Profile the engagement entity. AI generates mandate profile, drift triggers, and tier classification."/>

      {/* Section tabs */}
      <div className="flex gap-0 mb-4 border border-gray-200 rounded overflow-hidden">
        {sections.map(s => (
          <button key={s.id} onClick={()=>setActiveSection(s.id)}
            className={"flex-1 py-2 text-xs font-medium " + (activeSection===s.id?'text-white':'bg-gray-50 text-gray-600')}
            style={activeSection===s.id?{background:'#0F1E3C'}:{}}>
            {s.label}
          </button>
        ))}
      </div>

      {/* SECTION A — ENTITY IDENTITY */}
      {activeSection === 'identity' && (
        <div>
          <Card title="Entity details">
            <FormGrid>
              <FormGroup label="Entity name" htmlFor="ep-name">
                <Input id="ep-name" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Vertex Capital Private Limited"/>
              </FormGroup>
              <FormGroup label="Functional type" htmlFor="ep-ftype">
                <select id="ep-ftype" value={form.functionalType} onChange={e=>set('functionalType',e.target.value)}
                  className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500 bg-white">
                  <option value="">— select —</option>
                  {FUNCTIONAL_TYPES.map(g=>(
                    <optgroup key={g.group} label={g.group}>
                      {g.types.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                    </optgroup>
                  ))}
                </select>
              </FormGroup>
              <FormGroup label="Total assets (₹ Crore)" htmlFor="ep-assets-cr">
                <Input id="ep-assets-cr" type="number" value={form.totalAssets}
                  onChange={e=>set('totalAssets',e.target.value)} placeholder="e.g. 1200"/>
              </FormGroup>
              <FormGroup label="RBI registration no." htmlFor="ep-rbi">
                <div className="flex gap-2">
                  <Input id="ep-rbi" value={form.rbiRegNo} onChange={e=>set('rbiRegNo',e.target.value)} placeholder="e.g. N-13.01234"/>
                  <Btn onClick={verifyRBI} disabled={verifying} variant="secondary">{verifying?'...':'Verify'}</Btn>
                </div>
              </FormGroup>
              {/* Auto-derived fields */}
              {form.functionalType && (
                <>
                  <FormGroup label="SBR layer (auto-derived)">
                    <div className="px-2.5 py-1.5 text-sm rounded border border-gray-100 bg-gray-50 font-semibold" style={{color:'#5B21B6'}}>{form.sbrOverride || sbrLayer}</div>
                  </FormGroup>
                  {sbrLayer === 'Middle Layer (ML)' && (
                    <FormGroup label="RBI-identified upper/top layer? (override)" htmlFor="ep-sbr-override">
                      <Select id="ep-sbr-override" value={form.sbrOverride} onChange={e=>set('sbrOverride',e.target.value)}>
                        <option value="">No — Middle Layer (auto-derived)</option>
                        <option value="Upper Layer (UL)">Yes — Upper Layer (RBI notified)</option>
                        <option value="Top Layer (TL)">Yes — Top Layer (RBI notified)</option>
                      </Select>
                      <div className="text-xs mt-1" style={{color:'#6B7280'}}>
                        UL/TL cannot be auto-derived. Select only if RBI has formally notified this entity.
                      </div>
                    </FormGroup>
                  )}
                  <FormGroup label="Min NOF threshold (auto-derived)">
                    <div className="px-2.5 py-1.5 text-sm rounded border border-gray-100 bg-gray-50">{nofThreshold}</div>
                  </FormGroup>
                </>
              )}
              <FormGroup label="Core banking system" htmlFor="ep-cbs">
                <Input id="ep-cbs" value={form.cbs} onChange={e=>set('cbs',e.target.value)} placeholder="e.g. Finacle, Flexcube, BaNCS"/>
              </FormGroup>
              <FormGroup label="Cloud footprint" htmlFor="ep-cloud">
                <Select id="ep-cloud" value={form.cloud} onChange={e=>set('cloud',e.target.value)}>
                  <option value="none">No cloud / on-premises</option>
                  <option value="private">Private cloud</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="public">Public cloud (AWS/Azure/GCP)</option>
                </Select>
              </FormGroup>
              <FormGroup label="IT assets (approx)" htmlFor="ep-it">
                <Input id="ep-it" value={form.assets} onChange={e=>set('assets',e.target.value)} placeholder="e.g. 620 servers, 1200 endpoints"/>
              </FormGroup>
              <FormGroup label="Audit period" htmlFor="ep-period">
                <Input id="ep-period" value={form.period} onChange={e=>set('period',e.target.value)} placeholder="e.g. FY 2025-26 Q2"/>
              </FormGroup>
            </FormGrid>
            {verifyResult && (
              <div className="mt-2 p-2 rounded text-xs"
                style={{background:verifyResult.verified?'#D1FAE5':'#FEF3C7', color:verifyResult.verified?'#065F46':'#92400E'}}>
                {verifyResult.verified?'✓ ':'⚠ '}{verifyResult.note}
              </div>
            )}

            {/* P1: Regulatory references panel */}
            {regRefs.applicable.length > 0 && (
              <div className="mt-3 col-span-2">
                <div className="text-xs font-semibold text-gray-500 mb-2">
                  Applicable regulatory frameworks for {form.functionalType}:
                </div>
                <div className="space-y-1">
                  {regRefs.applicable.map(function(ref) {
                    return (
                      <div key={ref.ref_code} className="flex items-start gap-2 p-2 rounded border border-gray-100 bg-gray-50">
                        <span className="tag tag-v text-xs shrink-0">[V]</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate">{ref.title}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {ref.issuing_body} · {ref.effective_date} · {ref.doc_type}
                            {ref.notes && <span className="ml-1 text-amber-700"> — {ref.notes.substring(0,80)}</span>}
                          </div>
                        </div>
                        {ref.url && (
                          <a href={ref.url} target="_blank" rel="noreferrer"
                            className="text-xs text-blue-600 shrink-0">↗</a>
                        )}
                      </div>
                    )
                  })}
                  {regRefs.notApplicable.length > 0 && (
                    <div className="text-xs text-gray-400 mt-1">
                      Not applicable: {regRefs.notApplicable.map(function(r){return r.ref_code}).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Compliance Matrix Panel */}
            {matrixLoading && (
              <div className="mt-3 col-span-2 text-xs text-gray-400">Loading compliance matrix...</div>
            )}
            {matrix.applicable && matrix.applicable.length > 0 && (
              <div className="mt-3 col-span-2">
                <div className="text-xs font-semibold text-gray-500 mb-2">
                  Compliance matrix — {matrix.applicable.length} requirements applicable to {form.functionalType} ({sbrLayer}):
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{background:'#D1FAE5',color:'#065F46'}}>VERIFIED</span>
                </div>
                {['Governance','Risk','Infrastructure','Incident','Data','ThirdParty','Prudential'].map(function(cat) {
                  const items = matrix.applicable.filter(function(r){return r.category===cat})
                  if (!items.length) return null
                  return (
                    <div key={cat} className="mb-3">
                      <div className="text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">{cat}</div>
                      {items.map(function(req) {
                        return (
                          <div key={req.requirement_code} className="mb-1 p-2 rounded border border-gray-100 bg-gray-50">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <span className="font-mono text-xs text-gray-400 mr-1">{req.requirement_code}</span>
                                <span className="text-xs font-semibold">{req.requirement_name}</span>
                              </div>
                              <span className="text-xs px-1.5 py-0.5 rounded shrink-0"
                                style={{background:'#D1FAE5',color:'#065F46'}}>Required</span>
                            </div>
                            <div className="text-xs text-gray-600 mt-0.5">{req.value}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{req.source_ref}</div>
                            {req.exception_note && (
                              <div className="text-xs mt-0.5" style={{color:'#92400E'}}>{req.exception_note}</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
                {matrix.not_applicable && matrix.not_applicable.length > 0 && (
                  <div className="text-xs text-gray-400">
                    Not applicable ({matrix.not_applicable.length}): {matrix.not_applicable.map(function(r){return r.requirement_code}).join(', ')}
                  </div>
                )}
              </div>
            )}
            <BtnRow>
              <Btn onClick={generate} disabled={loading}>Generate profile</Btn>
              <Btn onClick={saveToDB} variant="secondary">Save to DB</Btn>
              <Btn onClick={loadFromDB} variant="secondary">Load saved</Btn>
            </BtnRow>
          </Card>
          {loading && <Spinner label="Generating entity profile..."/>}
          <AIOutput html={output} error={error}/>
        </div>
      )}

      {/* SECTION B — RISK SIGNALS */}
      {activeSection === 'signals' && (
        <div>
          <Card title="Risk signal entry — Drift Trigger Register">
            <p className="text-xs text-gray-500 mb-3">
              Enter engagement-specific observations. AI converts these into structured Drift Triggers (DT-01 to DT-N)
              that travel to every tab and influence control generation, incident classification, and gap analysis.
            </p>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Recent changes</label>
              <Textarea value={form.recentChanges} onChange={e=>set('recentChanges',e.target.value)}
                placeholder="e.g. CBS migration from Flexcube to Finacle (completed Q1). New UPI integration with 3 FinTech LSPs. AI-based credit scoring deployed 6 months ago."/>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Known weaknesses</label>
              <Textarea value={form.knownWeaknesses} onChange={e=>set('knownWeaknesses',e.target.value)}
                placeholder="e.g. Prior RBI inspection flagged IAM gaps (June 2024). Privileged access recertification overdue. No formal DLP policy."/>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">External signals</label>
              <Textarea value={form.externalSignals} onChange={e=>set('externalSignals',e.target.value)}
                placeholder="e.g. RBI inspection expected Q3 2026. Industry ransomware incidents on NBFC CBSs (Jan 2026). DPDP Rules notification expected."/>
            </div>
            <BtnRow>
              <Btn onClick={generateTriggers} disabled={triggerLoading}>Generate drift triggers</Btn>
            </BtnRow>
          </Card>
          {triggerLoading && <Spinner label="Parsing risk signals into drift triggers..."/>}
          {triggers.length > 0 && (
            <Card title={triggers.length + ' drift triggers generated — review before saving'}>
              {triggers.map((t,i) => (
                <div key={i} className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
                  <span className="text-xs font-bold px-2 py-0.5 rounded font-mono"
                    style={SEV_COLOR[t.severity]||SEV_COLOR.Medium}>
                    {t.trigger_ref}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold">{t.description}</span>
                      <span className="tag tag-bs">{t.domain}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded" style={SEV_COLOR[t.severity]||SEV_COLOR.Medium}>{t.severity}</span>
                    </div>
                    <div className="text-xs text-gray-500">{t.implications}</div>
                    <div className="text-xs text-gray-400 mt-1">Scaffold layers affected: {(t.layer_impact||[]).join(', ')}</div>
                  </div>
                </div>
              ))}
              <BtnRow>
                <Btn onClick={saveToDB} variant="secondary">Save entity + triggers to DB</Btn>
              </BtnRow>
            </Card>
          )}
        </div>
      )}

      {/* SECTION C — MANDATE PROFILE */}
      {activeSection === 'mandate' && (
        <div>
          <Card title="Regulatory mandate profile">
            <p className="text-xs text-gray-500 mb-3">
              AI generates the complete regulatory mandate profile for this entity type and SBR layer.
              Review, edit if needed, then lock. Locked profile injects into every AI prompt across all tabs.
            </p>
            {profileLocked && (
              <div className="mb-3 p-2 rounded text-xs" style={{background:'#D1FAE5',color:'#065F46'}}>
                &#128274; Profile locked — all downstream tabs are using this mandate profile.
                Click Unlock to refresh when a new RBI mandate is released.
              </div>
            )}
            <BtnRow>
              <Btn onClick={generateMandateProfile} disabled={profileLoading||profileLocked}>
                {profileLoading?'Generating...':'Generate mandate profile'}
              </Btn>
              {profile && !profileLocked && (
                <Btn onClick={()=>{ setProfileLocked(true); showToast('Mandate profile locked') }}>
                  Lock profile
                </Btn>
              )}
              {profileLocked && (
                <Btn onClick={()=>{ setProfileLocked(false); showToast('Profile unlocked for refresh') }} variant="secondary">
                  Unlock for refresh
                </Btn>
              )}
            </BtnRow>
          </Card>
          {profileLoading && <Spinner label="Generating regulatory mandate profile..."/>}
          {profile && (
            <div className="space-y-3 mt-3">

              {/* SECTION A: VERIFIED from matrix - source of truth */}
              <div className="p-2 rounded text-xs font-bold" style={{background:'#0F1E3C',color:'white'}}>
                SECTION A - VERIFIED FROM REGULATORY MATRIX (source of truth)
              </div>

              <Card title={'Applicable frameworks for ' + form.functionalType + ' (' + (form.sbrLayer || sbrLayer) + ')'}>
                <div className="space-y-1">
                  {(profile.applicable_refs||[]).map(function(r,i) {
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-gray-100 last:border-0">
                        <span className="tag tag-v">[V]</span>
                        <span className="font-semibold">{r.ref_code}</span>
                        <span className="text-gray-600">{r.title}</span>
                        <span className="text-gray-400 ml-auto">eff. {r.effective_date}</span>
                      </div>
                    )
                  })}
                </div>
              </Card>

              <Card title={'Mandatory requirements (' + (profile.mandatory_requirements||[]).length + ') - verified from matrix'}>
                {['Governance','Risk','Infrastructure','Incident','Data','ThirdParty','Prudential'].map(function(cat) {
                  const items = (profile.mandatory_requirements||[]).filter(function(r){return r.category===cat})
                  if (!items.length) return null
                  return (
                    <div key={cat} className="mb-3">
                      <div className="text-xs font-bold text-gray-500 mb-1 uppercase">{cat}</div>
                      {items.map(function(req) {
                        return (
                          <div key={req.code} className="mb-1 p-2 rounded bg-gray-50 border border-gray-100">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-gray-400">{req.code}</span>
                              <span className="text-xs font-semibold">{req.name}</span>
                              <span className="tag tag-v ml-auto">[V]</span>
                            </div>
                            <div className="text-xs text-gray-600 mt-0.5">{req.value}</div>
                            <div className="text-xs text-gray-400">{req.source_ref}</div>
                            <div className="text-xs text-blue-600 mt-0.5">Evidence: {req.evidence}</div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </Card>

              <Card title={'Not applicable to this entity (' + (profile.not_applicable||[]).length + ')'}>
                <div className="flex flex-wrap gap-2">
                  {(profile.not_applicable||[]).map(function(r,i) {
                    return (
                      <div key={i} className="text-xs px-2 py-1 rounded" style={{background:'#F3F4F6',color:'#6B7280'}}>
                        <span className="font-mono">{r.code}</span> {r.name}
                        <span className="ml-1 text-gray-400">— {r.reason}</span>
                      </div>
                    )
                  })}
                </div>
              </Card>

              <Card title="Compliance flags (verified from matrix)">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    ['CISO', profile.ciso_required],
                    ['IT Committee', profile.it_committee_required],
                    ['SOC 24x7', profile.soc_required],
                    ['CRO', profile.cro_required],
                    ['IS Audit', profile.is_audit_required],
                    ['BCP/DR', profile.bcp_required],
                    ['VA', profile.va_required],
                    ['Pen Test', profile.pt_required],
                    ['Data Localisation', profile.data_localisation],
                  ].map(function(item) {
                    return (
                      <div key={item[0]} className="p-2 rounded border border-gray-100 text-center">
                        <div className="text-gray-500 mb-0.5">{item[0]}</div>
                        <div className="font-bold text-sm" style={{color:item[1]?'#065F46':'#DC2626'}}>
                          {item[1] ? 'Required' : 'Not required'}
                        </div>
                        <div className="text-xs mt-0.5 px-1 rounded" style={{background:'#DBEAFE',color:'#1E40AF',fontSize:9}}>VERIFIED</div>
                      </div>
                    )
                  })}
                </div>
              </Card>

              {/* SECTION B: AI CONTEXT - narrative only */}
              <div className="p-2 rounded text-xs font-bold mt-4" style={{background:'#1E40AF',color:'white'}}>
                SECTION B - AI CONTEXT (narrative - not regulatory decisions)
              </div>

              <Card title="CII and PII assessment">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2 rounded border border-gray-100">
                    <div className="font-semibold text-gray-600 mb-0.5">CII presumption</div>
                    <div className="font-bold" style={{color:profile.cii_presumption?'#065F46':'#374151'}}>
                      {profile.cii_presumption ? 'Yes' : 'No'}
                    </div>
                    <div className="text-gray-400 mt-0.5">{profile.cii_reasoning}</div>
                  </div>
                  <div className="p-2 rounded border border-gray-100">
                    <div className="font-semibold text-gray-600 mb-0.5">PII always involved</div>
                    <div className="font-bold" style={{color:profile.pii_always_involved?'#065F46':'#374151'}}>
                      {profile.pii_always_involved ? 'Yes' : 'No'}
                    </div>
                    <div className="text-gray-400 mt-0.5">{profile.pii_reasoning}</div>
                  </div>
                </div>
              </Card>

              {(profile.audit_focus_areas||[]).length > 0 && (
                <Card title="Audit focus areas (AI generated)">
                  <ul className="text-xs space-y-1">
                    {profile.audit_focus_areas.map(function(a,i) {
                      return <li key={i} className="flex gap-2"><span className="text-blue-600">{i+1}.</span>{a}</li>
                    })}
                  </ul>
                </Card>
              )}

              {(profile.sbr_specific_obligations||[]).length > 0 && (
                <Card title={'SBR-specific obligations for ' + sbrLayer + ' (AI generated)'}>
                  <ul className="text-xs space-y-1">
                    {profile.sbr_specific_obligations.map(function(o,i) {
                      return <li key={i} className="flex gap-2"><span className="text-purple-600">{i+1}.</span>{o}</li>
                    })}
                  </ul>
                </Card>
              )}

              {profile.drift_risk_summary && (
                <Card title="Drift risk summary (AI generated)">
                  <p className="text-xs text-gray-600">{profile.drift_risk_summary}</p>
                </Card>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  )
}
