"use client"
import { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '../lib/supabase'
import Auth from '../components/Auth'
import Layout from '../components/Layout'
import EntityProfiler from '../components/EntityProfiler'
import ControlMatrix from '../components/ControlMatrix'
import TruthTable from '../components/TruthTable'
import Intelligence from '../components/Intelligence'
import Dossier from '../components/Dossier'
import DakshGenerator from '../components/DakshGenerator'
import Export from '../components/Export'

export default function Home() {
  const [user, setUser]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [activeTab, setActiveTab]     = useState('entity')
  const [controls, setControls]       = useState([])
  const [currentEntityId, setEntityId]= useState(null)
  const [entityName, setEntityName]   = useState('')
  const [toast, setToast]             = useState('')
  const sb = getSupabase()

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }, [])

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      setUser(data?.session?.user || null)
      setLoading(false)
    })
    const { data: sub } = sb.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null)
    })
    return () => sub?.subscription?.unsubscribe()
  }, [])

  const loadControls = useCallback(async () => {
    if (!user) return
    const { data } = await sb.from('controls').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
    setControls((data || []).map(r => ({
      id: r.control_id, ctrl_domain: r.ctrl_domain, ad_domain: r.ad_domain,
      subsystem: r.subsystem, tier: r.tier, risk_rating: r.risk_rating,
      codex_ref: r.primary_codex_ref, ctrl_type: r.control_type,
      evidence: r.evidence_artifacts, sla: r.reporting_sla,
      source_status: r.source_truth_status === 'VERIFIED-TRAINING' ? 'VT' : r.source_truth_status === 'INFERRED' ? 'I' : 'U',
      created: r.created_at
    })))
  }, [user])

  useEffect(() => { if (user) loadControls() }, [user, loadControls])

  if (loading) return <div className="flex items-center justify-center h-screen bg-navy text-white text-sm">Loading AI-PCRAF...</div>
  if (!user)   return <Auth sb={sb} onLogin={setUser} />

  const tabs = [
    { id:'entity',     icon:'⊙', label:'Entity Profiler' },
    { id:'controls',   icon:'≣', label:'Control Matrix' },
    { id:'truth',      icon:'≡', label:'Truth Table' },
    { id:'intelligence', icon:'⬡', label:'Intelligence' },
    { id:'dossier',    icon:'◆', label:'Dossier' },
    { id:'daksh',      icon:'⚠', label:'DAKSH' },
    { id:'export',     icon:'↓', label:'Export' },
  ]

  const tabProps = { user, sb, controls, loadControls, currentEntityId, setEntityId, entityName, setEntityName, showToast }

  return (
    <Layout
      user={user} sb={sb} tabs={tabs}
      activeTab={activeTab} setActiveTab={setActiveTab}
      toast={toast}
    >
      {activeTab === 'entity'     && <EntityProfiler  {...tabProps} />}
      {activeTab === 'controls'   && <ControlMatrix   {...tabProps} />}
      {activeTab === 'truth'      && <TruthTable       {...tabProps} />}
      {activeTab === 'intelligence' && <Intelligence   {...tabProps} />}
      {activeTab === 'dossier'    && <Dossier          {...tabProps} />}
      {activeTab === 'daksh'      && <DakshGenerator   {...tabProps} />}
      {activeTab === 'export'     && <Export           {...tabProps} />}
    </Layout>
  )
}
