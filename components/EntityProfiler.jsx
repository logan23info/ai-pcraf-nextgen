"use client"
import { useState } from 'react'
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

  const [output, setOutput]           = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [verifying, setVerifying]     = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)
  const [triggers, setTriggers]       = useState([])
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [profile, setProfile]         = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileLocked, setProfileLocked]   = useState(false)
  const [activeSection, setActiveSection]   = useState('identity')

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
              <Card title="Mandatory IT mandates">
                <ul className="text-xs space-y-1">
                  {(profile.mandatory_it_mandates||[]).map((m,i)=><li key={i} className="flex gap-2"><span className="text-green-600">✓</span>{m}</li>)}
                </ul>
              </Card>
              <Card title="Priority control domains">
                <div className="flex flex-wrap gap-2">
                  {(profile.priority_domains||[]).map((d,i)=>(
                    <span key={i} className="tag tag-bs">{i+1}. {d}</span>
                  ))}
                </div>
              </Card>
              <Card title="Applicable regulations">
                <ul className="text-xs space-y-1">
                  {(profile.applicable_regulations||[]).map((r,i)=><li key={i}>{r}</li>)}
                </ul>
              </Card>
              <Card title="Entity flags">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ['CII presumption', profile.cii_presumption, profile.cii_reasoning],
                    ['PII always involved', profile.pii_always_involved, profile.pii_reasoning],
                    ['SOC required', profile.soc_required, null],
                    ['CISO required', profile.ciso_required, null],
                    ['IT Committee required', profile.it_committee_required, null],
                  ].map(([label,val,reason])=>(
                    <div key={label} className="p-2 rounded border border-gray-100">
                      <div className="font-semibold text-gray-600">{label}</div>
                      <div className="font-bold mt-0.5" style={{color:val?'#065F46':'#374151'}}>{val?'Yes':'No'}</div>
                      {reason && <div className="text-gray-400 mt-0.5">{reason}</div>}
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Audit focus areas">
                <ul className="text-xs space-y-1">
                  {(profile.audit_focus_areas||[]).map((a,i)=><li key={i} className="flex gap-2"><span className="text-blue-600">{i+1}.</span>{a}</li>)}
                </ul>
              </Card>
              {(profile.blind_spots_active||[]).length > 0 && (
                <Card title="Active blind spots for this entity">
                  <div className="flex flex-wrap gap-2">
                    {profile.blind_spots_active.map((bs,i)=><span key={i} className="tag tag-bs">{bs}</span>)}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
