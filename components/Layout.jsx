"use client"
import { useState } from 'react'

const CHECKLIST = [
  'Scaffolding: all six scaffold layers addressed?',
  'Codex: every control has a named Codex citation?',
  'Reasoning: every control has a complete CoT reasoning chain?',
  'OOP: every control is a complete CONTROL_OBJECT — no missing fields?',
  'Truth Table: every incident class resolved?',
  'Blind Spots: all affected controls carry their BS-ID?',
  'Shape Up: negative-shape items actively removed?',
  'Dossier: all six fetches attempted and recorded?',
  'Source Truth: every claim carries a source truth status tag?',
  'Fabrication: no FABRICATION-RISK items in client-facing output?',
]

export default function Layout({ user, sb, tabs, activeTab, setActiveTab, toast, children }) {
  const [checklist, setChecklist] = useState(Array(10).fill(false))
  const [showChecklist, setShowChecklist] = useState(false)

  async function signOut() {
    await sb.auth.signOut()
    window.location.reload()
  }

  const TITLES = {
    entity:'Entity Profiler', controls:'Control Matrix Builder',
    truth:'Truth Table — Incident Classifier', blindspots:'Blind Spot Register',
    dossier:'Regulatory Dossier — Live Fetch Engine',
    daksh:'DAKSH Incident Payload Generator', export:'Export & Backup'
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',fontSize:14,color:'#111827',background:'#F7F8FA'}}>

      {/* Sidebar */}
      <aside className="flex flex-col" style={{width:220,minWidth:220,background:'#0F1E3C'}}>
        <div className="px-4 py-5 border-b" style={{borderColor:'#243D6E'}}>
          <div className="text-sm font-bold text-white">AI-PCRAF v3.0</div>
          <div className="text-xs mt-1" style={{color:'#7B93C4'}}>Cyber Risk Assurance Framework</div>
          <div className="text-xs mt-0.5" style={{color:'#5A729A'}}>Indian BFSI · IT Audit</div>
        </div>
        <nav className="flex-1 py-3">
          {tabs.map(t => (
            <div key={t.id} onClick={()=>setActiveTab(t.id)}
              className="flex items-center gap-2 px-4 py-2 cursor-pointer text-sm transition-colors"
              style={{
                color: activeTab===t.id ? '#FFFFFF' : '#A8C0E8',
                background: activeTab===t.id ? '#1A2F55' : 'transparent',
                borderLeft: activeTab===t.id ? '3px solid #2563EB' : '3px solid transparent'
              }}
            >
              <span>{t.icon}</span> {t.label}
            </div>
          ))}
        </nav>
        <div className="px-4 py-3 border-t" style={{borderColor:'#243D6E'}}>
          <div className="text-xs mb-2" style={{color:'#7B93C4',wordBreak:'break-all'}}>{user?.email}</div>
          <button onClick={signOut} className="w-full py-1.5 text-xs rounded"
            style={{background:'#243D6E',color:'#A8C0E8'}}>Sign out</button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-3 bg-white border-b flex items-center justify-between" style={{borderColor:'#E2E5EA',minHeight:52}}>
          <div className="text-sm font-semibold">{TITLES[activeTab]}</div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="px-2 py-0.5 rounded-full text-xs" style={{background:'#D1FAE5',color:'#065F46'}}>Supabase connected</span>
            <button onClick={()=>setShowChecklist(true)}
              className="px-3 py-1 rounded-full border text-xs cursor-pointer hover:border-blue-500 hover:text-blue-600"
              style={{borderColor:'#E2E5EA'}}>Self-audit checklist</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </main>

      {/* Checklist Modal */}
      {showChecklist && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{background:'rgba(0,0,0,.45)'}}>
          <div className="bg-white rounded-xl p-6" style={{width:480,maxHeight:'80vh',overflowY:'auto'}}>
            <div className="text-base font-semibold mb-4">Self-audit checklist — AI-PCRAF v3.0</div>
            {CHECKLIST.map((item, i) => (
              <div key={i} className="flex items-start gap-2 py-2 border-b border-gray-100 text-sm last:border-0">
                <input type="checkbox" checked={checklist[i]}
                  onChange={()=>setChecklist(c=>{const n=[...c];n[i]=!n[i];return n})}
                  className="mt-0.5 accent-blue-600"/>
                <label className={checklist[i]?'line-through text-gray-400':''}>{item}</label>
              </div>
            ))}
            <div className="flex gap-2 mt-4">
              <button onClick={()=>setShowChecklist(false)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">Done</button>
              <button onClick={()=>setChecklist(Array(10).fill(false))} className="px-4 py-2 bg-gray-100 rounded text-sm">Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-2.5 rounded text-sm text-white z-50"
          style={{background:'#0F1E3C'}}>{toast}</div>
      )}
    </div>
  )
}
