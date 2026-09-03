"use client"
import { Card, SectionHeader } from './ui'

const BS = [
  { id:'BS-01', title:'DPDP Rules not yet notified', impact:'DPDP controls inferred from Act only.', mitigation:'Mark all DPDP Rule references [U]. Review when Rules are notified by MeitY.' },
  { id:'BS-02', title:'DAKSH portal field schema unknown', impact:'Reporting payload templates may not match live DAKSH form.', mitigation:'Validate against live DAKSH portal before client submission.' },
  { id:'BS-03', title:'ReBIT assessment framework — version currency', impact:'May reference superseded criteria.', mitigation:'Fetch latest from rebit.org.in before engagement.' },
  { id:'BS-04', title:'NCIIPC CII financial sector list not fully public', impact:'Cannot confirm formal CII designation.', mitigation:'Treat all SCBs and NBFC-UL/TL as presumptively CII-designated.' },
  { id:'BS-05', title:'RBI circulars post-August 2025 may be missing', impact:'Controls may not reflect latest amendments.', mitigation:'Run live fetch of rbi.org.in/notifications before every engagement.' },
  { id:'BS-06', title:'State cooperative banks — limited coverage', impact:'Cooperative bank IT governance rules not fully mapped.', mitigation:'Exclude or add explicit caveat in engagement letter.' },
  { id:'BS-07', title:'Foreign bank branch compliance nuances', impact:'Branch-level circular specifics may differ from subsidiary rules.', mitigation:'Flag all foreign bank controls for branch-level legal review.' },
  { id:'BS-08', title:'IFTAS SFMS security standards — version unknown', impact:'INFINET security specs may be outdated.', mitigation:'Fetch current standards from iftas.org.in.' },
]

const FETCHES = [
  { id:'FETCH-01', url:'https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx', label:'rbi.org.in — Master Directions', purpose:'RBI IT Governance MD current version' },
  { id:'FETCH-02', url:'https://www.cert-in.org.in/', label:'cert-in.org.in', purpose:'CERT-In Directions & empanelled auditor list' },
  { id:'FETCH-03', url:'https://www.meity.gov.in/', label:'meity.gov.in', purpose:'DPDP Rules notification status' },
  { id:'FETCH-04', url:'https://rebit.org.in/', label:'rebit.org.in', purpose:'ReBIT cybersecurity framework version' },
  { id:'FETCH-05', url:'https://nciipc.gov.in/', label:'nciipc.gov.in', purpose:'CII designation criteria' },
  { id:'FETCH-06', url:'https://iftas.org.in/', label:'iftas.org.in', purpose:'SFMS/INFINET security standards' },
]

const TAGS = [
  { cls:'tag-v',  label:'[V]',    desc:'Verified — live-fetched primary source' },
  { cls:'tag-vt', label:'[VT]',   desc:'Verified-Training — confirm before client use' },
  { cls:'tag-i',  label:'[I]',    desc:'Inferred — logical derivation' },
  { cls:'tag-u',  label:'[U]',    desc:'Unverified — placeholder only' },
  { cls:'tag-fr', label:'[FR]',   desc:'Fabrication-Risk — do not use' },
  { cls:'tag-bs', label:'[BS-XX]',desc:'Blind spot governed' },
]

export default function BlindSpots() {
  return (
    <div>
      <SectionHeader title="Blind spot register & fabrication control"
        subtitle="Declared uncertainties. Every control affected by a blind spot carries its BS-ID."/>
      <Card title="Source truth tags">
        <div className="flex flex-wrap gap-3 text-xs">
          {TAGS.map(t => (
            <span key={t.cls}><span className={"tag " + t.cls}>{t.label}</span> {t.desc}</span>
          ))}
        </div>
      </Card>
      <Card title="BS-01 to BS-08">
        {BS.map(b => (
          <div key={b.id} className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
            <span className="tag tag-bs shrink-0 self-start">{b.id}</span>
            <div>
              <div className="text-sm font-semibold mb-1">{b.title}</div>
              <div className="text-xs text-gray-500"><span className="font-semibold text-orange-700">Impact: </span>{b.impact}</div>
              <div className="text-xs text-gray-500 mt-1">{b.mitigation}</div>
            </div>
          </div>
        ))}
      </Card>
      <Card title="Live fetch protocol — open and verify manually">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead><tr>
              {['Fetch','URL','Purpose'].map(h=><th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 bg-gray-50 border-b border-gray-200">{h}</th>)}
            </tr></thead>
            <tbody>
              {FETCHES.map(f=>(
                <tr key={f.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 font-mono">{f.id}</td>
                  <td className="px-3 py-2"><a href={f.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{f.label}</a></td>
                  <td className="px-3 py-2 text-gray-600">{f.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
