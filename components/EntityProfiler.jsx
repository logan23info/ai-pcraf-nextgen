"use client"
import { useState } from 'react'
import { callAPI } from '../lib/api'
import { formatAIOutput } from '../lib/formatter'
import { Card, SectionHeader, FormGrid, FormGroup, Input, Select, Textarea, BtnRow, Btn, Spinner, AIOutput } from './ui'

const TIER_LABELS = {
  'NBFC-BL':'NBFC-BL (Base Layer — Scale-Based Regulation)',
  'NBFC-ML':'NBFC-ML (Middle Layer — Scale-Based Regulation)',
  'NBFC-UL':'NBFC-UL (Upper Layer — Scale-Based Regulation)',
  'NBFC-TL':'NBFC-TL (Top Layer — Scale-Based Regulation)',
}

export default function EntityProfiler({ user, sb, setEntityId, setEntityName, showToast }) {
  const [form, setForm] = useState({ name:'',type:'',cbs:'',cloud:'none',assets:'',period:'',risks:'' })
  const [output, setOutput] = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  async function generate() {
    if (!form.name||!form.type) { showToast('Enter entity name and type'); return }
    setLoading(true); setOutput(''); setError('')
    const tierLabel = TIER_LABELS[form.type] || form.type
    const prompt = `You are a Principal Cyber Risk & Compliance Consultant under AI-PCRAF v3.0 for Indian BFSI IT Audit.

ENTITY CONTEXT
Name: ${form.name}
Regulatory classification: ${tierLabel}
Core banking system: ${form.cbs||'Unknown'}
Cloud footprint: ${form.cloud}
IT assets: ${form.assets||'Not specified'}
Audit period: ${form.period||'Not specified'}
Key risk areas: ${form.risks||'Not specified'}

INSTRUCTIONS
Produce a complete Phase 1 Entity Risk Profile with all 5 sections:

1. TIER CLASSIFICATION
   - Use exact RBI terminology: ${tierLabel}
   - Never use generic Tier-1/Tier-2/Tier-3 labels
   - Cite RBI IT Gov MD 2023 obligations with Chapter and Section number [VT]
   - CERT-In Directions April 2022 incident reporting SLA is 6 hours from detection — never 72 hours [VT]

2. TOP 5 ASSURANCE DOMAINS
   - Select from AD-01 to AD-07 only
   - For each: domain name, rationale, governing regulation with section number [VT]

3. TIER-DRIFT ALERT MATRIX
   - Additional obligations if entity moves UP one tier
   - Obligations that reduce if entity moves DOWN one tier

4. CII DESIGNATION ASSESSMENT
   - Likely CII-designated under NCIIPC? State reasoning.
   - If uncertain: apply BS-04 presumptive treatment

5. RECOMMENDED AUDIT FOCUS AREAS
   - Minimum 4 specific areas linked to control domains (CBS/IAM/CLD/API/INC/TPR/DLP/AUD)

CITATION RULES
- Every citation: DocumentName, Chapter X, Section Y.Z [VT]
- Incident reporting SLA is always 6 hours — never 24, 48, or 72 hours
- Flag DPDP items [BS-01]
- Do not cite GDPR, SOC 2, ISO 27001, or NIST as primary driver`

    try {
      const result = await callAPI(prompt, 2000)
      setOutput(formatAIOutput(result))
    } catch(e) { setError(e.message) } finally { setLoading(false) }
  }

  async function saveToDB() {
    if (!form.name||!form.type) { showToast('Enter entity name and type first'); return }
    const { data, error } = await sb.from('entities').insert({
      user_id: user.id, name: form.name, type: form.type,
      cbs: form.cbs, cloud: form.cloud, assets: form.assets,
      period: form.period, risks: form.risks,
      profile_ai: output ? output.replace(/<[^>]+>/g,' ') : null
    }).select()
    if (error) { showToast('Save failed: ' + error.message); return }
    setEntityId(data[0].id); setEntityName(form.name)
    showToast('Entity saved to Supabase')
  }

  async function loadFromDB() {
    const { data } = await sb.from('entities').select('*').eq('user_id', user.id).order('created_at',{ascending:false}).limit(1)
    if (!data?.length) { showToast('No saved entity found'); return }
    const e = data[0]
    setForm({ name:e.name||'', type:e.type||'', cbs:e.cbs||'', cloud:e.cloud||'none', assets:e.assets||'', period:e.period||'', risks:e.risks||'' })
    setEntityId(e.id); setEntityName(e.name)
    if (e.profile_ai) setOutput(formatAIOutput(e.profile_ai))
    showToast('Entity loaded from Supabase')
  }

  return (
    <div>
      <SectionHeader title="Entity risk profiling & tier classification"
        subtitle="Profile the target entity. AI generates tier classification, regulatory obligations, and drift alert matrix."/>
      <Card title="Entity details">
        <FormGrid>
          <FormGroup label="Entity name" htmlFor="ep-name">
            <Input id="ep-name" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. ABC Small Finance Bank Ltd"/>
          </FormGroup>
          <FormGroup label="Entity type" htmlFor="ep-type">
            <Select id="ep-type" value={form.type} onChange={e=>set('type',e.target.value)}>
              <option value="">— select —</option>
              <optgroup label="Banking">
                <option value="SCB">Scheduled Commercial Bank (SCB)</option>
                <option value="SFB">Small Finance Bank (SFB)</option>
                <option value="RRB">Regional Rural Bank (RRB)</option>
                <option value="FB">Foreign Bank (FB)</option>
              </optgroup>
              <optgroup label="NBFC — SBR Tiers">
                <option value="NBFC-BL">NBFC — Base Layer</option>
                <option value="NBFC-ML">NBFC — Middle Layer</option>
                <option value="NBFC-UL">NBFC — Upper Layer</option>
                <option value="NBFC-TL">NBFC — Top Layer</option>
              </optgroup>
            </Select>
          </FormGroup>
          <FormGroup label="Core banking system" htmlFor="ep-cbs">
            <Input id="ep-cbs" value={form.cbs} onChange={e=>set('cbs',e.target.value)} placeholder="e.g. Finacle, Flexcube, BaNCS"/>
          </FormGroup>
          <FormGroup label="Cloud footprint" htmlFor="ep-cloud">
            <Select id="ep-cloud" value={form.cloud} onChange={e=>set('cloud',e.target.value)}>
              <option value="none">No cloud / on-premises only</option>
              <option value="private">Private cloud</option>
              <option value="hybrid">Hybrid</option>
              <option value="public">Public cloud (AWS/Azure/GCP)</option>
            </Select>
          </FormGroup>
          <FormGroup label="Total IT assets" htmlFor="ep-assets">
            <Input id="ep-assets" value={form.assets} onChange={e=>set('assets',e.target.value)} placeholder="e.g. 250 servers, 1200 endpoints"/>
          </FormGroup>
          <FormGroup label="Audit period" htmlFor="ep-period">
            <Input id="ep-period" value={form.period} onChange={e=>set('period',e.target.value)} placeholder="e.g. FY 2025-26, Q2"/>
          </FormGroup>
          <FormGroup label="Key risk areas" htmlFor="ep-risks" span2>
            <Textarea id="ep-risks" value={form.risks} onChange={e=>set('risks',e.target.value)}
              placeholder="e.g. Recent CBS migration, new UPI integration, third-party lending partnership..."/>
          </FormGroup>
        </FormGrid>
        <BtnRow>
          <Btn onClick={generate} disabled={loading}>Generate profile</Btn>
          <Btn onClick={saveToDB} variant="secondary">Save to DB</Btn>
          <Btn onClick={loadFromDB} variant="secondary">Load saved</Btn>
        </BtnRow>
      </Card>
      {loading && <Spinner label="Generating entity profile..."/>}
      <AIOutput html={output} error={error}/>
    </div>
  )
}
