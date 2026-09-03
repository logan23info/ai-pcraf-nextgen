// AI-PCRAF M5 — DAKSH PDF Export
// /api/export-daksh.js — Vercel Serverless Function
// Generates formatted PDF of the DAKSH incident payload using pdfkit

const PDFDocument = require('pdfkit')

var NAVY   = '#0F1E3C';
var ACCENT = '#2563EB';
var RED    = '#991B1B';
var AMBER  = '#92400E';
var GREY   = '#6B7280';

function addSection(doc, title, color) {
  doc.moveDown(0.5)
     .fillColor(color || NAVY)
     .fontSize(11)
     .font('Helvetica-Bold')
     .text(title)
     .moveTo(doc.page.margins.left, doc.y)
     .lineTo(doc.page.width - doc.page.margins.right, doc.y)
     .strokeColor(color || NAVY)
     .lineWidth(0.5)
     .stroke()
     .moveDown(0.3);
}

function addField(doc, label, value, warning) {
  doc.fillColor(GREY).fontSize(9).font('Helvetica-Bold').text(label + ':', { continued: true })
     .fillColor(warning ? RED : '#111827').font('Helvetica').text('  ' + (value || '—'))
     .moveDown(0.2);
}

function addChecklist(doc, checklist) {
  Object.keys(checklist).forEach(function(key) {
    var label = key.replace(/_/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();});
    var done  = checklist[key];
    doc.fillColor(done ? '#065F46' : RED)
       .fontSize(9).font('Helvetica')
       .text((done ? '☑ ' : '☐ ') + label)
       .moveDown(0.15);
  });
}

import { NextResponse } from 'next/server'

export async function POST(req) {
  const body = await req.json()
  const payload = body.payload
  if (!payload) return NextResponse.json({ error: 'payload is required' }, { status: 400 })

  try {
    var doc  = new PDFDocument({ margin: 50, size: 'A4' });
    var bufs = [];
    doc.on('data', function(d) { bufs.push(d); });

    var pdfDone = new Promise(function(resolve) { doc.on('end', resolve); });

    // ── HEADER ─────────────────────────────────────────────────────────────
    doc.fillColor(NAVY).rect(50, 50, doc.page.width - 100, 60).fill()
       .fillColor('#FFFFFF').fontSize(16).font('Helvetica-Bold')
       .text('AI-PCRAF v2.0 — RBI DAKSH Incident Report', 60, 65)
       .fontSize(9).font('Helvetica')
       .text('Ref: ' + (payload.incident_ref || '—') + '   |   Generated: ' + (payload.report_generated_at || new Date().toISOString()), 60, 90)
       .moveDown(2);

    // ── BS-02 WARNING ───────────────────────────────────────────────────────
    doc.fillColor(AMBER).fontSize(9).font('Helvetica-Bold')
       .text('[BS-02] DRAFT ONLY — ' + (payload.bs02_declaration || 'Validate against live DAKSH portal before submission.'))
       .moveDown(0.5);

    // ── ENTITY DETAILS ──────────────────────────────────────────────────────
    addSection(doc, '1. ENTITY DETAILS');
    addField(doc, 'Entity name', payload.entity_name);
    addField(doc, 'Entity type', payload.entity_type);
    addField(doc, 'RBI registration no.', payload.rbi_registration_no, !payload.rbi_registration_no || payload.rbi_registration_no.includes('fill'));
    addField(doc, 'CERT-In empanelled', payload.cert_in_empanelled);

    // ── INCIDENT CLASSIFICATION ─────────────────────────────────────────────
    addSection(doc, '2. INCIDENT CLASSIFICATION');
    addField(doc, 'Incident type', payload.incident_type);
    addField(doc, 'Severity', payload.severity);
    addField(doc, 'Attack vector', payload.attack_vector);
    addField(doc, 'Description', payload.incident_description);

    // ── TIMELINE & SLA ──────────────────────────────────────────────────────
    addSection(doc, '3. TIMELINE & SLA', RED);
    addField(doc, 'Detected at', payload.detected_at);
    addField(doc, 'Reported at', payload.reported_at);
    addField(doc, 'SLA deadline', payload.sla_deadline, true);
    addField(doc, 'RBI DAKSH SLA', payload.rbi_daksh_sla);
    addField(doc, 'CERT-In SLA', payload.cert_in_sla);

    // ── IMPACT ASSESSMENT ───────────────────────────────────────────────────
    addSection(doc, '4. IMPACT ASSESSMENT');
    addField(doc, 'Systems affected', payload.systems_affected);
    addField(doc, 'PII involved', payload.pii_involved);
    addField(doc, 'PII records affected', payload.pii_records_affected);
    addField(doc, 'CII involved', payload.cii_involved);
    addField(doc, 'Financial system', payload.financial_system_involved);
    addField(doc, 'Estimated financial impact', payload.estimated_financial_impact);

    // ── REGULATORY OBLIGATIONS ──────────────────────────────────────────────
    addSection(doc, '5. REGULATORY REPORTING OBLIGATIONS', RED);
    addField(doc, 'RBI DAKSH', 'Required — ' + (payload.rbi_daksh_sla || '6 hours'));
    addField(doc, 'CERT-In', 'Required — ' + (payload.cert_in_sla || '6 hours'));
    addField(doc, 'NCIIPC', payload.nciipc_required);
    addField(doc, 'DPDP Board', payload.dpdp_board_required);
    if (payload.bs01_declaration && payload.bs01_declaration !== 'Not applicable') {
      doc.fillColor(AMBER).fontSize(8).font('Helvetica').text(payload.bs01_declaration).moveDown(0.2);
    }
    if (payload.bs04_declaration && payload.bs04_declaration !== 'Not applicable') {
      doc.fillColor(AMBER).fontSize(8).font('Helvetica').text(payload.bs04_declaration).moveDown(0.2);
    }

    // ── CONTAINMENT ─────────────────────────────────────────────────────────
    addSection(doc, '6. CONTAINMENT & RESPONSE');
    addField(doc, 'Containment status', payload.containment_status);
    addField(doc, 'Containment actions', payload.containment_actions);
    addField(doc, 'Root cause (preliminary)', payload.root_cause_preliminary);
    addField(doc, 'Attack indicators (IOCs)', payload.attack_indicators);

    // ── EVIDENCE ────────────────────────────────────────────────────────────
    addSection(doc, '7. EVIDENCE ARTIFACTS');
    addField(doc, 'Evidence list', payload.evidence_artifacts);
    addField(doc, 'Escalation path', payload.escalation_path);
    addField(doc, 'Nodal officer', payload.nodal_officer_name, !payload.nodal_officer_name || payload.nodal_officer_name.includes('fill'));
    addField(doc, 'Nodal officer contact', payload.nodal_officer_contact, !payload.nodal_officer_contact || payload.nodal_officer_contact.includes('fill'));

    // ── PRE-SUBMISSION CHECKLIST ────────────────────────────────────────────
    addSection(doc, '8. PRE-SUBMISSION CHECKLIST [BS-02]', AMBER);
    doc.fillColor(AMBER).fontSize(8).font('Helvetica')
       .text('All items must be checked before submission to DAKSH portal.')
       .moveDown(0.3);
    if (payload.pre_submission_checklist) {
      addChecklist(doc, payload.pre_submission_checklist);
    }

    // ── FOOTER ──────────────────────────────────────────────────────────────
    doc.moveDown(1)
       .fillColor(GREY).fontSize(8).font('Helvetica')
       .text('Generated by AI-PCRAF v2.0. Source truth status: [' + (payload.source_truth_status || 'I') + ']. This is a first-draft audit tool. All fields must be independently verified before submission to the RBI DAKSH portal.')
       .moveDown(0.3)
       .text('Framework: AI-PCRAF v2.0  |  Regulatory anchor: RBI IT Gov MD 2023, CERT-In Dir 2022, DPDP Act 2023');

    doc.end();
    await pdfDone;

    var pdfBuf = Buffer.concat(bufs);
    var filename = 'DAKSH_Incident_' + (payload.incident_ref || 'draft') + '_' + new Date().toISOString().slice(0,10) + '.pdf';

    return new Response(pdfBuf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="' + filename + '"',
      }
    })

  } catch(err) {
    console.error('PDF generation error:', err);
    return NextResponse.json({ error: 'PDF generation failed: ' + err.message }, { status: 500 })
  }
}
