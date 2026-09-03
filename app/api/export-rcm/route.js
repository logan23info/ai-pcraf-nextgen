// AI-PCRAF M4 — RCM Excel Export
// /api/export-rcm.js — Vercel Serverless Function
// Generates formatted Excel workbook server-side using SheetJS

const XLSX = require('xlsx')

// ── COLOUR CONSTANTS ───────────────────────────────────────────────────────
const NAVY    = '0F1E3C';
const WHITE   = 'FFFFFF';
const AMBER   = 'FEF3C7';
const AMBER_D = '92400E';
const GREEN_L = 'D1FAE5';
const GREEN_D = '065F46';
const BLUE_L  = 'DBEAFE';
const BLUE_D  = '1E40AF';
const GREY_L  = 'F3F4F6';
const GREY_D  = '374151';
const RED_L   = 'FEE2E2';
const RED_D   = '991B1B';
const ORANGE  = 'FFEDD5';
const ORANGE_D= 'C2410C';

// ── STYLE HELPERS ──────────────────────────────────────────────────────────
function headerStyle() {
  return {
    font:      { bold: true, color: { rgb: WHITE }, sz: 11 },
    fill:      { fgColor: { rgb: NAVY } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border:    { bottom: { style: 'thin', color: { rgb: WHITE } } }
  };
}

function riskStyle(rating) {
  var map = {
    'critical': { bg: RED_L,    fg: RED_D    },
    'high':     { bg: ORANGE,   fg: ORANGE_D },
    'medium':   { bg: AMBER,    fg: AMBER_D  },
    'low':      { bg: GREEN_L,  fg: GREEN_D  }
  };
  var c = map[(rating || '').toLowerCase()] || { bg: GREY_L, fg: GREY_D };
  return {
    font:      { bold: true, color: { rgb: c.fg }, sz: 10 },
    fill:      { fgColor: { rgb: c.bg } },
    alignment: { horizontal: 'center' }
  };
}

function sourceStyle(status) {
  var map = {
    'VT': { bg: BLUE_L,  fg: BLUE_D  },
    'V':  { bg: GREEN_L, fg: GREEN_D },
    'I':  { bg: AMBER,   fg: AMBER_D },
    'U':  { bg: GREY_L,  fg: GREY_D  },
    'FR': { bg: RED_L,   fg: RED_D   }
  };
  var c = map[status] || { bg: GREY_L, fg: GREY_D };
  return {
    font:      { bold: true, color: { rgb: c.fg }, sz: 10 },
    fill:      { fgColor: { rgb: c.bg } },
    alignment: { horizontal: 'center' }
  };
}

function cellStyle(wrap) {
  return {
    font:      { sz: 10 },
    alignment: { vertical: 'top', wrapText: !!wrap },
    border:    { bottom: { style: 'hair', color: { rgb: 'E2E5EA' } } }
  };
}

function subHeaderStyle() {
  return {
    font:      { bold: true, color: { rgb: NAVY }, sz: 10 },
    fill:      { fgColor: { rgb: 'F1F3F7' } },
    alignment: { horizontal: 'left', vertical: 'center' }
  };
}

// ── CELL BUILDER ───────────────────────────────────────────────────────────
function c(value, style) {
  return { v: value || '', t: 's', s: style || cellStyle(false) };
}

// ── SHEET 1: RCM SUMMARY ───────────────────────────────────────────────────
function buildSummarySheet(entity, controls, dossier) {
  var ws = {};
  var rows = [
    [c('AI-PCRAF v2.0 — Risk & Control Matrix', headerStyle()), c(''), c(''), c('')],
    [c('Framework', subHeaderStyle()), c('AI-PCRAF v2.0 — Indian BFSI IT Audit'), c(''), c('')],
    [c('Generated', subHeaderStyle()), c(new Date().toLocaleString('en-IN')), c(''), c('')],
    [c('Entity name', subHeaderStyle()), c(entity.name || '—'), c(''), c('')],
    [c('Entity type', subHeaderStyle()), c(entity.type || '—'), c(''), c('')],
    [c('CBS', subHeaderStyle()), c(entity.cbs || '—'), c(''), c('')],
    [c('Audit period', subHeaderStyle()), c(entity.period || '—'), c(''), c('')],
    [c(''), c(''), c(''), c('')],
    [c('FABRICATION SUMMARY', headerStyle()), c(''), c(''), c('')],
    [c('Verified [V/VT]', subHeaderStyle()), c(String(controls.filter(function(x){return x.source_status==='V'||x.source_status==='VT';}).length)), c(''), c('')],
    [c('Inferred [I]', subHeaderStyle()),    c(String(controls.filter(function(x){return x.source_status==='I';}).length)), c(''), c('')],
    [c('Unverified [U]', subHeaderStyle()),  c(String(controls.filter(function(x){return x.source_status==='U';}).length)), c(''), c('')],
    [c('Fabrication-Risk [FR]', subHeaderStyle()), c(String(controls.filter(function(x){return x.source_status==='FR';}).length)), c(''), c('')],
    [c('Total controls', subHeaderStyle()), c(String(controls.length)), c(''), c('')],
    [c(''), c(''), c(''), c('')],
    [c('ACTIVE BLIND SPOTS', headerStyle()), c(''), c(''), c('')],
    [c('BS-01', subHeaderStyle()), c('DPDP Rules not yet notified — all DPDP controls tagged [I]'), c(''), c('')],
    [c('BS-02', subHeaderStyle()), c('DAKSH portal field schema unknown — validate before submission'), c(''), c('')],
    [c('BS-03', subHeaderStyle()), c('ReBIT framework version currency — verify manually'), c(''), c('')],
    [c('BS-04', subHeaderStyle()), c('NCIIPC CII designation list not fully public — presumptive treatment applied'), c(''), c('')],
    [c('BS-05', subHeaderStyle()), c('RBI circulars post-August 2025 may be missing — run FETCH-01'), c(''), c('')],
    [c('BS-06', subHeaderStyle()), c('State cooperative banks — limited coverage'), c(''), c('')],
    [c('BS-07', subHeaderStyle()), c('Foreign bank branch nuances — flag for legal review'), c(''), c('')],
    [c('BS-08', subHeaderStyle()), c('IFTAS SFMS standards version unknown — verify manually'), c(''), c('')],
    [c(''), c(''), c(''), c('')],
    [c('DISCLAIMER', subHeaderStyle()), c('All AI-generated controls are tagged with source truth status. [VT] citations require independent verification against live regulatory sources before use in a client deliverable or RBI inspection submission. This output is a first-draft audit tool, not final audit evidence.'), c(''), c('')]
  ];

  rows.forEach(function(row, r) {
    row.forEach(function(cell, col) {
      var addr = XLSX.utils.encode_cell({ r: r, c: col });
      ws[addr] = cell;
    });
  });

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: 3 } });
  ws['!cols'] = [{ wch: 28 }, { wch: 60 }, { wch: 20 }, { wch: 20 }];
  ws['!rows'] = [{ hpt: 22 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 8, c: 0 }, e: { r: 8, c: 3 } },
    { s: { r: 15, c: 0 }, e: { r: 15, c: 3 } },
    { s: { r: 25, c: 1 }, e: { r: 25, c: 3 } }
  ];
  return ws;
}

// ── SHEET 2: CONTROL MATRIX ────────────────────────────────────────────────
function buildControlMatrix(controls) {
  var ws = {};
  var headers = [
    'Control ID', 'Domain', 'Subsystem', 'Tier',
    'Risk Rating', 'Codex Ref (Primary)', 'Codex Ref (Secondary)',
    'Source Truth', 'Control Type', 'Mode', 'Frequency',
    'AI Test Procedure', 'Manual Procedure',
    'Evidence Artifacts', 'Drift Indicator', 'Drift Threshold',
    'Reportable To', 'Reporting SLA',
    'Blind Spot', 'Blind Spot Note', 'Created'
  ];

  // Header row
  headers.forEach(function(h, col) {
    ws[XLSX.utils.encode_cell({ r: 0, c: col })] = c(h, headerStyle());
  });

  // Data rows
  controls.forEach(function(ctrl, rowIdx) {
    var p = ctrl.parsed || {};
    var r = rowIdx + 1;
    var row = [
      c(ctrl.id || p.control_id || '', cellStyle(false)),
      c(ctrl.ad_domain || p.assurance_domain || '', cellStyle(false)),
      c(ctrl.subsystem || p.subsystem || '', cellStyle(true)),
      c(ctrl.tier || '', cellStyle(false)),
      c(ctrl.risk_rating || p.risk_rating || '', riskStyle(ctrl.risk_rating || p.risk_rating)),
      c(ctrl.codex_ref || p.primary_codex_ref || '', cellStyle(true)),
      c(p.secondary_codex_ref || '', cellStyle(true)),
      c(ctrl.source_status || '', sourceStyle(ctrl.source_status)),
      c(ctrl.ctrl_type || p.control_type || '', cellStyle(false)),
      c(p.control_mode || '', cellStyle(false)),
      c(p.testing_frequency || '', cellStyle(false)),
      c(p.ai_testing_procedure || '', cellStyle(true)),
      c(p.manual_procedure || '', cellStyle(true)),
      c(ctrl.evidence || p.evidence_artifacts || '', cellStyle(true)),
      c(p.drift_indicator || '', cellStyle(true)),
      c(p.drift_threshold || '', cellStyle(true)),
      c(Array.isArray(p.reportable_to) ? p.reportable_to.join(', ') : (ctrl.sla || ''), cellStyle(false)),
      c(ctrl.sla || p.reporting_sla || '', cellStyle(false)),
      c(p.blind_spot_flag ? 'Yes' : 'No', cellStyle(false)),
      c(p.blind_spot_note || '', cellStyle(true)),
      c(ctrl.created ? new Date(ctrl.created).toLocaleDateString('en-IN') : '', cellStyle(false))
    ];
    row.forEach(function(cell, col) {
      ws[XLSX.utils.encode_cell({ r: r, c: col })] = cell;
    });
  });

  var lastRow = controls.length;
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: headers.length - 1 } });
  ws['!cols'] = [
    { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 10 },
    { wch: 10 }, { wch: 32 }, { wch: 24 },
    { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
    { wch: 30 }, { wch: 30 },
    { wch: 30 }, { wch: 24 }, { wch: 20 },
    { wch: 20 }, { wch: 16 },
    { wch: 10 }, { wch: 24 }, { wch: 12 }
  ];
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };
  return ws;
}

// ── SHEET 3: FIELDWORK PACK ────────────────────────────────────────────────
function buildFieldworkSheet(controls) {
  var ws = {};
  var headers = [
    'Control ID', 'Control Name', 'Domain', 'Risk Rating',
    'CoT Step 1 — Trigger', 'CoT Step 2 — Codex',
    'CoT Step 3 — Tier', 'CoT Step 4 — Design',
    'CoT Step 5 — Evidence', 'CoT Step 6 — Failure Mode',
    'Test Steps (IIA 2310)', 'Sample Size', 'Evidence Request List'
  ];

  headers.forEach(function(h, col) {
    ws[XLSX.utils.encode_cell({ r: 0, c: col })] = c(h, headerStyle());
  });

  controls.forEach(function(ctrl, rowIdx) {
    var p = ctrl.parsed || {};
    var r = rowIdx + 1;
    var row = [
      c(ctrl.id || p.control_id || '', cellStyle(false)),
      c(p.control_name || '', cellStyle(true)),
      c(ctrl.ad_domain || p.assurance_domain || '', cellStyle(false)),
      c(ctrl.risk_rating || p.risk_rating || '', riskStyle(ctrl.risk_rating || p.risk_rating)),
      c(p.cot_trigger || '', cellStyle(true)),
      c(p.cot_codex  || '', cellStyle(true)),
      c(p.cot_tier   || '', cellStyle(true)),
      c(p.cot_design || '', cellStyle(true)),
      c(p.cot_evidence || '', cellStyle(true)),
      c(p.cot_failure  || '', cellStyle(true)),
      c(p.fieldwork_test_steps  || '', cellStyle(true)),
      c(p.sample_size           || '', cellStyle(true)),
      c(p.evidence_request_list || '', cellStyle(true))
    ];
    row.forEach(function(cell, col) {
      ws[XLSX.utils.encode_cell({ r: r, c: col })] = cell;
    });
  });

  var lastRow = controls.length;
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: headers.length - 1 } });
  ws['!cols'] = [
    { wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 10 },
    { wch: 28 }, { wch: 28 }, { wch: 24 }, { wch: 28 },
    { wch: 28 }, { wch: 28 },
    { wch: 36 }, { wch: 20 }, { wch: 36 }
  ];
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };
  return ws;
}

// ── SHEET 4: DOSSIER STATUS ────────────────────────────────────────────────
function buildDossierSheet(dossier) {
  var ws = {};
  var headers = ['Fetch ID', 'Source', 'Status', 'Amendment Detected', 'Summary', 'Fetched At'];

  headers.forEach(function(h, col) {
    ws[XLSX.utils.encode_cell({ r: 0, c: col })] = c(h, headerStyle());
  });

  var FETCHES = [
    { id: 'FETCH-01', label: 'RBI IT Governance Master Direction' },
    { id: 'FETCH-02', label: 'CERT-In Directions & Advisories' },
    { id: 'FETCH-03', label: 'MeitY — DPDP Rules notification status' },
    { id: 'FETCH-04', label: 'ReBIT Cybersecurity Assessment Framework' },
    { id: 'FETCH-05', label: 'NCIIPC CII Guidelines' },
    { id: 'FETCH-06', label: 'IFTAS SFMS/INFINET Security Standards' }
  ];

  // Match dossier log entries to fetch IDs — use latest per source
  var latestByFetch = {};
  (dossier || []).forEach(function(entry) {
    if (!latestByFetch[entry.fetch_id] ||
        new Date(entry.fetched_at) > new Date(latestByFetch[entry.fetch_id].fetched_at)) {
      latestByFetch[entry.fetch_id] = entry;
    }
  });

  FETCHES.forEach(function(fetch, rowIdx) {
    var entry = latestByFetch[fetch.id];
    var r = rowIdx + 1;
    var statusStyle = entry
      ? (entry.status === 'FETCHED' ? sourceStyle('V') : sourceStyle('FR'))
      : sourceStyle('U');
    var amendStyle = (entry && entry.amendment_detected) ? riskStyle('high') : cellStyle(false);

    ws[XLSX.utils.encode_cell({ r: r, c: 0 })] = c(fetch.id, cellStyle(false));
    ws[XLSX.utils.encode_cell({ r: r, c: 1 })] = c(fetch.label, cellStyle(true));
    ws[XLSX.utils.encode_cell({ r: r, c: 2 })] = c(entry ? entry.status : 'NOT RUN', statusStyle);
    ws[XLSX.utils.encode_cell({ r: r, c: 3 })] = c(entry ? (entry.amendment_detected ? 'YES — review required' : 'No') : '—', amendStyle);
    ws[XLSX.utils.encode_cell({ r: r, c: 4 })] = c(entry ? (entry.result_summary || '—') : 'Fetch not yet run — verify manually', cellStyle(true));
    ws[XLSX.utils.encode_cell({ r: r, c: 5 })] = c(entry ? new Date(entry.fetched_at).toLocaleString('en-IN') : '—', cellStyle(false));
  });

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 6, c: 5 } });
  ws['!cols'] = [{ wch: 12 }, { wch: 36 }, { wch: 14 }, { wch: 20 }, { wch: 60 }, { wch: 20 }];
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };
  return ws;
}

// ── MAIN HANDLER ───────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'

export async function POST(req) {
  const body = await req.json()
  const entity   = body.entity   || {}
  const controls = body.controls || []
  const dossier  = body.dossier  || []

  if (!controls.length) {
    return NextResponse.json({ error: 'No controls to export' }, { status: 400 })
  }

  try {
    var wb = XLSX.utils.book_new();

    // Sheet tab colours
    var ws1 = buildSummarySheet(entity, controls, dossier);
    var ws2 = buildControlMatrix(controls);
    var ws3 = buildFieldworkSheet(controls);
    var ws4 = buildDossierSheet(dossier);

    XLSX.utils.book_append_sheet(wb, ws1, 'RCM Summary');
    XLSX.utils.book_append_sheet(wb, ws2, 'Control Matrix');
    XLSX.utils.book_append_sheet(wb, ws3, 'Fieldwork Pack');
    XLSX.utils.book_append_sheet(wb, ws4, 'Dossier Status');

    // Set sheet tab colours
    wb.Sheets['RCM Summary']['!sheetView']    = {};
    wb.SheetNames.forEach(function(name, i) {
      if (!wb.Workbook) wb.Workbook = { Sheets: [] };
      while (wb.Workbook.Sheets.length <= i) wb.Workbook.Sheets.push({});
      var colours = [NAVY, '2563EB', '065F46', '92400E'];
      wb.Workbook.Sheets[i].TabColor = { rgb: colours[i] || NAVY };
    });

    var filename = 'AI_PCRAF_RCM_' +
      (entity.name ? entity.name.replace(/[^a-zA-Z0-9]/g,'_').substring(0,20) + '_' : '') +
      new Date().toISOString().slice(0,10) + '.xlsx';

    var buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true });

    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="' + filename + '"',
        'Content-Length': buf.length
      }
    })

  } catch(err) {
    console.error('Excel export error:', err);
    return NextResponse.json({ error: 'Export failed: ' + err.message }, { status: 500 })
  }
}
