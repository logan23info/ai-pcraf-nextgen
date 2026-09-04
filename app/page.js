"use client"
import { useState, useEffect } from 'react'
import { getSupabase } from '../lib/supabase'
import { EngagementProvider, useEngagement } from '../lib/EngagementContext'
import Auth from '../components/Auth'
import Layout from '../components/Layout'
import EngagementBanner from '../components/EngagementBanner'
import EntityProfiler from '../components/EntityProfiler'
import ControlMatrix from '../components/ControlMatrix'
import TruthTable from '../components/TruthTable'
import Dossier from '../components/Dossier'
import Intelligence from '../components/Intelligence'
import DakshGenerator from '../components/DakshGenerator'
import Export from '../components/Export'
import FirmSettings from '../components/FirmSettings'

function AppShell({ user, sb }) {
  const [activeTab, setActiveTab] = useState('entity')
  const [toast, setToast]         = useState('')
  const { controls, loadContext, currentEntityId, entityName, ciiPresumption, piiAlwaysInvolved } = useEngagement()

  const showToast = (msg) => {
    const time = new Date().toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'})
    setToast(msg + ' [' + time + ']')
    setTimeout(() => setToast(''), 3500)
  }

  const tabs = [
    { id:'entity',       icon:'⊙', label:'Entity Profiler' },
    { id:'controls',     icon:'≣', label:'Control Matrix' },
    { id:'truth',        icon:'≡', label:'Truth Table' },
    { id:'dossier',      icon:'◆', label:'Dossier' },
    { id:'intelligence', icon:'⬡', label:'Intelligence' },
    { id:'daksh',        icon:'⚠', label:'DAKSH' },
    { id:'export',       icon:'↓', label:'Export' },
    { id:'settings',     icon:'⚙', label:'Settings' },
  ]

  const tabProps = {
    user, sb, controls,
    loadControls: loadContext,
    currentEntityId,
    entityName,
    ciiPresumption,
    piiAlwaysInvolved,
    showToast
  }

  return (
    <Layout user={user} sb={sb} tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} toast={toast}>
      <EngagementBanner/>
      <div className="p-6">
        {activeTab === 'entity'       && <EntityProfiler  {...tabProps}/>}
        {activeTab === 'controls'     && <ControlMatrix   {...tabProps}/>}
        {activeTab === 'truth'        && <TruthTable      {...tabProps}/>}
        {activeTab === 'dossier'      && <Dossier         {...tabProps}/>}
        {activeTab === 'intelligence' && <Intelligence    {...tabProps}/>}
        {activeTab === 'daksh'        && <DakshGenerator  {...tabProps}/>}
        {activeTab === 'export'       && <Export          {...tabProps}/>}
        {activeTab === 'settings'     && <FirmSettings     user={user} sb={sb} showToast={showToast}/>}
      </div>
    </Layout>
  )
}

export default function Home() {
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(true)
  const sb = getSupabase()

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

  if (loading) return <div className="flex items-center justify-center h-screen" style={{background:'#0F1E3C',color:'white',fontSize:14}}>Loading AI-PCRAF...</div>
  if (!user)   return <Auth sb={sb} onLogin={setUser}/>

  return (
    <EngagementProvider user={user} sb={sb}>
      <AppShell user={user} sb={sb}/>
    </EngagementProvider>
  )
}
