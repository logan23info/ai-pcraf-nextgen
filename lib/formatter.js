// lib/formatter.js — AI output formatter
export function formatAIOutput(text) {
  if (!text) return ''
  const lines = text.split('\n')
  let html = '', inOL = false, inUL = false
  const closeList = () => {
    if (inOL) { html += '</ol>'; inOL = false }
    if (inUL) { html += '</ul>'; inUL = false }
  }
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const tags = s => {
    s = s.replace(/\[VERIFIED-TRAINING\]/g,'<span class="tag tag-vt">[VT]</span>')
    s = s.replace(/\[VT\]/g,'<span class="tag tag-vt">[VT]</span>')
    s = s.replace(/\[V\]/g,'<span class="tag tag-v">[V]</span>')
    s = s.replace(/\[I\]/g,'<span class="tag tag-i">[I]</span>')
    s = s.replace(/\[U\]/g,'<span class="tag tag-u">[U]</span>')
    s = s.replace(/\[FR\]/g,'<span class="tag tag-fr">[FR]</span>')
    s = s.replace(/\[BS-0?(\d+)\]/g,'<span class="tag tag-bs">[BS-$1]</span>')
    s = s.replace(/\bCritical\b/g,'<span class="risk-badge critical">Critical</span>')
    s = s.replace(/\bHigh\b/g,'<span class="risk-badge high">High</span>')
    s = s.replace(/\bMedium\b/g,'<span class="risk-badge medium">Medium</span>')
    s = s.replace(/\bLow\b/g,'<span class="risk-badge low">Low</span>')
    s = s.replace(/\[DRIFT-RISK\]/g,'<span class="alert-badge red">[DRIFT-RISK]</span>')
    return s
  }
  const proc = s => tags(esc(s))
  lines.forEach(line => {
    const t = line.trim()
    if (!t) { closeList(); html += '<br>'; return }
    if (/^[─\-]{4,}$/.test(t)) { closeList(); html += '<hr>'; return }
    if (/^[A-Z0-9\s&\/\-\u2013\u2014:()]{4,}$/.test(t) && t.length < 80 && /[A-Z]{2}/.test(t)) {
      closeList(); html += `<h3>${proc(t)}</h3>`; return
    }
    const step = t.match(/^(Step\s+\d+\s*[\u2014:\-]+)\s*(.+)$/i)
    if (step) { closeList(); html += `<div class="step-block"><div class="step-title">${proc(step[1])}</div><div class="step-body">${proc(step[2])}</div></div>`; return }
    const ol = t.match(/^(\d+)\.\s+(.+)$/)
    if (ol) { if (!inOL){if(inUL){html+='</ul>';inUL=false};html+='<ol>';inOL=true}; html+=`<li>${proc(ol[2])}</li>`; return }
    const ul = t.match(/^[-\u2022*]\s+(.+)$/)
    if (ul) { if (!inUL){if(inOL){html+='</ol>';inOL=false};html+='<ul>';inUL=true}; html+=`<li>${proc(ul[1])}</li>`; return }
    const field = t.match(/^([A-Za-z][A-Za-z0-9 _\/&()\-]{1,35}):\s+(.+)$/)
    if (field) { closeList(); html+=`<div class="field-row"><span class="field-label">${proc(field[1])}</span><span class="field-value">${proc(field[2])}</span></div>`; return }
    const padded = t.match(/^([A-Za-z][A-Za-z0-9 _.\/]{1,20})\s{3,}(.+)$/)
    if (padded) { closeList(); html+=`<div class="field-row"><span class="field-label">${proc(padded[1].trim())}</span><span class="field-value">${proc(padded[2].trim())}</span></div>`; return }
    closeList(); html += `<p>${proc(t)}</p>`
  })
  closeList()
  return html
}
