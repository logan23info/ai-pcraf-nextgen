"use client"
import { useState, useEffect } from 'react'
import { Card, SectionHeader, BtnRow, Btn, Spinner, Table } from './ui'

export default function FirmSettings({ user, sb, showToast }) {
  const [firm, setFirm]           = useState(null)
  const [members, setMembers]     = useState([])
  const [engagements, setEngagements] = useState([])
  const [loading, setLoading]     = useState(false)
  const [firmName, setFirmName]   = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState('auditor')
  const [engName, setEngName]     = useState('')
  const [engClient, setEngClient] = useState('')
  const [activeTab, setActiveTab] = useState('firm')

  useEffect(function() { loadFirm() }, [])

  async function loadFirm() {
    setLoading(true)
    try {
      const { data: firms } = await sb.from('firms')
        .select('*').eq('owner_id', user.id).limit(1)
      if (firms?.length) {
        setFirm(firms[0])
        setFirmName(firms[0].name)
        await loadMembers(firms[0].id)
      }
      await loadEngagements()
    } catch(e) { showToast('Load error: ' + e.message) }
    finally { setLoading(false) }
  }

  async function loadMembers(firmId) {
    const { data } = await sb.from('firm_members')
      .select('*, user:user_id(email)').eq('firm_id', firmId)
    setMembers(data || [])
  }

  async function loadEngagements() {
    const { data } = await sb.from('engagements')
      .select('*').eq('owner_id', user.id).order('created_at', { ascending: false })
    setEngagements(data || [])
  }

  async function createFirm() {
    if (!firmName) { showToast('Enter firm name'); return }
    const { data, error } = await sb.from('firms')
      .insert({ name: firmName, owner_id: user.id }).select()
    if (error) { showToast('Error: ' + error.message); return }
    setFirm(data[0])
    showToast('Firm created: ' + firmName)
  }

  async function inviteMember() {
    if (!inviteEmail || !firm) { showToast('Enter email and create firm first'); return }
    const { data: users } = await sb.from('auth.users')
      .select('id').eq('email', inviteEmail).limit(1)
    if (!users?.length) { showToast('User not found - they must sign up first'); return }
    const { error } = await sb.from('firm_members').insert({
      firm_id: firm.id, user_id: users[0].id,
      role: inviteRole, invited_by: user.id, accepted: false
    })
    if (error) { showToast('Error: ' + error.message); return }
    setInviteEmail('')
    await loadMembers(firm.id)
    showToast('Invitation sent to ' + inviteEmail)
  }

  async function createEngagement() {
    if (!engName) { showToast('Enter engagement name'); return }
    const { error } = await sb.from('engagements').insert({
      owner_id: user.id, firm_id: firm?.id || null,
      name: engName, client_name: engClient,
      status: 'active'
    })
    if (error) { showToast('Error: ' + error.message); return }
    setEngName(''); setEngClient('')
    await loadEngagements()
    showToast('Engagement created: ' + engName)
  }

  async function updateEngagementStatus(id, status) {
    await sb.from('engagements').update({ status }).eq('id', id)
    await loadEngagements()
    showToast('Engagement ' + status)
  }

  const tabs = [
    { id:'firm', label:'Firm & Members' },
    { id:'engagements', label:'Engagements' },
  ]

  return (
    <div>
      <SectionHeader title="Firm & Engagement Management"
        subtitle="Manage your firm, invite colleagues, and group work by client engagement."/>

      <div className="flex gap-0 mb-4 border border-gray-200 rounded overflow-hidden">
        {tabs.map(function(t) {
          return (
            <button key={t.id} onClick={function(){setActiveTab(t.id)}}
              className={"flex-1 py-2 text-xs font-medium " + (activeTab===t.id?'text-white':'bg-gray-50 text-gray-600')}
              style={activeTab===t.id?{background:'#0F1E3C'}:{}}>
              {t.label}
            </button>
          )
        })}
      </div>

      {loading && <Spinner label="Loading..."/>}

      {/* FIRM & MEMBERS */}
      {activeTab === 'firm' && (
        <div>
          <Card title={firm ? 'Your firm: ' + firm.name : 'Create your firm'}>
            {!firm ? (
              <div className="flex gap-2">
                <input value={firmName} onChange={function(e){setFirmName(e.target.value)}}
                  placeholder="Firm name e.g. XYZ & Associates"
                  className="flex-1 border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500"/>
                <Btn onClick={createFirm}>Create firm</Btn>
              </div>
            ) : (
              <div className="text-sm text-gray-600">
                Firm ID: <span className="font-mono text-xs">{firm.id.substring(0,8)}...</span>
              </div>
            )}
          </Card>

          {firm && (
            <Card title="Invite colleague">
              <div className="grid grid-cols-3 gap-2 mb-2">
                <input value={inviteEmail} onChange={function(e){setInviteEmail(e.target.value)}}
                  placeholder="colleague@firm.com"
                  className="col-span-2 border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500"/>
                <select value={inviteRole} onChange={function(e){setInviteRole(e.target.value)}}
                  className="border border-gray-200 rounded px-2.5 py-1.5 text-sm">
                  <option value="auditor">Auditor</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="partner">Partner</option>
                </select>
              </div>
              <Btn onClick={inviteMember}>Send invitation</Btn>
              <p className="text-xs text-gray-400 mt-2">Colleague must have an AI-PCRAF account first.</p>
            </Card>
          )}

          {members.length > 0 && (
            <Card title={'Team members (' + members.length + ')'}>
              <Table headers={['Email','Role','Status']}>
                {members.map(function(m, i) {
                  return (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-2 text-xs">{m.user?.email || m.user_id}</td>
                      <td className="px-3 py-2">
                        <span className="text-xs px-2 py-0.5 rounded"
                          style={{background:'#DBEAFE',color:'#1E40AF'}}>
                          {m.role}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {m.accepted
                          ? <span style={{color:'#065F46'}}>Active</span>
                          : <span style={{color:'#92400E'}}>Pending</span>}
                      </td>
                    </tr>
                  )
                })}
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* ENGAGEMENTS */}
      {activeTab === 'engagements' && (
        <div>
          <Card title="New engagement">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input value={engName} onChange={function(e){setEngName(e.target.value)}}
                placeholder="Engagement name e.g. FY26 Q2 IT Audit"
                className="border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500"/>
              <input value={engClient} onChange={function(e){setEngClient(e.target.value)}}
                placeholder="Client name"
                className="border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500"/>
            </div>
            <Btn onClick={createEngagement}>Create engagement</Btn>
          </Card>

          {engagements.length > 0 && (
            <Card title={'Engagements (' + engagements.length + ')'}>
              <Table headers={['Engagement','Client','Status','Created','Actions']}>
                {engagements.map(function(e, i) {
                  return (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-2 text-xs font-semibold">{e.name}</td>
                      <td className="px-3 py-2 text-xs">{e.client_name||'—'}</td>
                      <td className="px-3 py-2">
                        <span className="text-xs px-2 py-0.5 rounded"
                          style={{background:e.status==='active'?'#D1FAE5':'#F3F4F6',
                                  color:e.status==='active'?'#065F46':'#374151'}}>
                          {e.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {new Date(e.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-3 py-2">
                        {e.status === 'active' ? (
                          <button onClick={function(){updateEngagementStatus(e.id,'closed')}}
                            className="text-xs px-2 py-0.5 rounded border border-gray-200">
                            Close
                          </button>
                        ) : (
                          <button onClick={function(){updateEngagementStatus(e.id,'active')}}
                            className="text-xs px-2 py-0.5 rounded border border-gray-200">
                            Reopen
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </Table>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
