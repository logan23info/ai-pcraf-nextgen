
// Shared UI helpers
export function Card({ title, children, className='' }) {
  return (
    <div className={"bg-white border border-gray-200 rounded-lg p-4 mb-3 " + className}>
      {title && <div className="text-sm font-semibold mb-2">{title}</div>}
      {children}
    </div>
  )
}

export function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  )
}

export function FormGrid({ children }) {
  return <div className="grid grid-cols-2 gap-3 mb-3">{children}</div>
}

export function FormGroup({ label, htmlFor, span2=false, children }) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

export function Input({ id, type='text', value, onChange, placeholder, disabled=false }) {
  return (
    <input id={id} type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled}
      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500 bg-white"/>
  )
}

export function Select({ id, value, onChange, children }) {
  return (
    <select id={id} value={value} onChange={onChange}
      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500 bg-white">
      {children}
    </select>
  )
}

export function Textarea({ id, value, onChange, placeholder, rows=3 }) {
  return (
    <textarea id={id} value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500 resize-y"/>
  )
}

export function BtnRow({ children }) {
  return <div className="flex gap-2 items-center mt-3">{children}</div>
}

export function Btn({ onClick, disabled=false, variant='primary', children }) {
  const styles = {
    primary:   'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white',
    secondary: 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200',
    danger:    'bg-red-50 hover:bg-red-100 text-red-800 border border-red-200',
  }
  return (
    <button onClick={onClick} disabled={disabled}
      className={"px-4 py-2 rounded text-sm font-medium cursor-pointer " + styles[variant]}>
      {children}
    </button>
  )
}

export function Spinner({ label='Loading...' }) {
  return (
    <div className="flex items-center gap-2 text-gray-500 text-sm mt-3">
      <div className="spinner w-4 h-4 border-2 border-gray-200 rounded-full" style={{borderTopColor:'#2563EB'}}/>
      {label}
    </div>
  )
}

export function AIOutput({ html, error }) {
  if (error) return <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
  if (!html) return null
  return (
    <div className="ai-output mt-3 p-3 rounded border"
      style={{background:'#F0F4FF',borderColor:'#BFD0FE'}}
      dangerouslySetInnerHTML={{__html: html}}/>
  )
}

export function Tag({ type='u', children }) {
  return <span className={"tag tag-" + type}>{children}</span>
}

export function TierBadge({ tier }) {
  return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" style={{background:'#DBEAFE',color:'#1E3A8A'}}>{tier}</span>
}

export function Table({ headers, children }) {
  return (
    <div className="overflow-x-auto border border-gray-200 rounded mt-3">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>{headers.map((h,i) => <th key={i} className="px-3 py-2 text-left font-semibold text-gray-500 bg-gray-50 border-b border-gray-200 whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
