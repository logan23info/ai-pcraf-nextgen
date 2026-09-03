"use client"
import { useState } from 'react'

export default function Auth({ sb, onLogin }) {
  const [mode, setMode]   = useState('login')
  const [email, setEmail] = useState('')
  const [pass, setPass]   = useState('')
  const [err, setErr]     = useState('')
  const [msg, setMsg]     = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    setErr(''); setMsg(''); setLoading(true)
    if (mode === 'signup') {
      const { error } = await sb.auth.signUp({ email, password: pass })
      if (error) setErr(error.message)
      else { setMsg('Account created — check email to confirm.'); setMode('login') }
    } else {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pass })
      if (error) setErr(error.message)
      else onLogin(data.user)
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-center h-screen" style={{background:'#0F1E3C'}}>
      <div className="bg-white rounded-xl p-9 w-80">
        <div className="text-lg font-bold text-navy mb-1">AI-PCRAF v3.0</div>
        <div className="text-xs text-gray-500 mb-5">Cyber Risk Assurance Framework — Indian BFSI IT Audit</div>
        <div className="flex mb-5 rounded overflow-hidden border border-gray-200">
          {['login','signup'].map(m => (
            <button key={m} onClick={()=>setMode(m)}
              className={"flex-1 py-2 text-xs font-medium " + (mode===m ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-500')}
            >{m==='login'?'Sign in':'Sign up'}</button>
          ))}
        </div>
        <div className="mb-3">
          <label className="text-xs font-medium text-gray-500 block mb-1" htmlFor="auth-email">Email</label>
          <input id="auth-email" type="email" value={email} onChange={e=>setEmail(e.target.value)}
            placeholder="auditor@yourfirm.com"
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
        </div>
        <div className="mb-1">
          <label className="text-xs font-medium text-gray-500 block mb-1" htmlFor="auth-pass">Password</label>
          <input id="auth-pass" type="password" value={pass} onChange={e=>setPass(e.target.value)}
            placeholder="minimum 6 characters"
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
        </div>
        {err && <div className="text-xs text-red-700 mt-2">{err}</div>}
        {msg && <div className="text-xs text-green-700 mt-2">{msg}</div>}
        <button onClick={submit} disabled={loading}
          className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 rounded text-sm font-medium">
          {loading ? 'Please wait...' : mode==='login' ? 'Sign in' : 'Create account'}
        </button>
      </div>
    </div>
  )
}
