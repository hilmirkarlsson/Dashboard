// Parse "Hilmir Finance vN.xlsx" into the JSON shape the Finance tab renders.
// Each sheet is a header block followed by clean tables with section-header
// rows (only the first cell filled). We locate tables by their known sheets
// and slice rows by section markers, so edits to the numbers flow through
// live while the layout stays stable.
const XLSX = require('xlsx');

const rowsOf = (wb, name) =>
  XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, blankrows: false });

// "-" / "" / null -> null; "35,000" / "35.000 kr." -> 35000; number -> number.
function num(v) {
  if (v == null || v === '-' || v === '') return null;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
}
const num0 = v => { const n = num(v); return n == null ? 0 : n; };
// A section divider: first cell set, the rest of the row empty.
const isDivider = r => r[0] != null && r.slice(1).every(c => c == null);

function findSheet(wb, needle) {
  return wb.SheetNames.find(n => n.includes(needle));
}

function parseOverview(wb) {
  const d = rowsOf(wb, findSheet(wb, 'Dashboard'));
  return [0, 2, 4, 6, 8, 10]
    .map(c => ({ label: d[2] && d[2][c], value: d[3] && d[3][c], sub: d[4] && d[4][c] }))
    .filter(x => x.label);
}

function parseYearlyCategory(wb) {
  const d = rowsOf(wb, findSheet(wb, 'Yearly Trends'));
  const out = [];
  for (let i = 4; i < d.length; i++) {
    const r = d[i];
    if (!r[0]) continue;
    if (/^SPENDING BY|^MONTHLY INCOME/.test(r[0])) break;
    out.push({ category: r[0], y2024: num0(r[1]), y2025: num0(r[2]), y2026h1: num0(r[3]), y2026ann: num0(r[4]) });
    if (r[0] === 'TOTAL') break;
  }
  return out;
}

function parseMonthlyTrend(wb) {
  const d = rowsOf(wb, findSheet(wb, 'Yearly Trends'));
  const start = d.findIndex(r => r[0] === 'Month'); // header of the 30-month table
  const out = [];
  for (let i = start + 1; i < d.length; i++) {
    const r = d[i];
    if (!r[0]) continue;
    out.push({ month: r[0], income: num0(r[1]), spending: num0(r[2]), net: num0(r[3]) });
  }
  return out;
}

function parseMonthly2026Category(wb) {
  const d = rowsOf(wb, findSheet(wb, 'Dashboard'));
  const start = d.findIndex(r => r[0] === 'Category' && r[7] === 'TOTAL');
  const out = [];
  for (let i = start + 1; i < d.length; i++) {
    const r = d[i];
    if (!r[0]) continue;
    if (/^\d{4}/.test(String(r[0]))) break; // next year block
    out.push({
      category: r[0], jan: num0(r[1]), feb: num0(r[2]), mar: num0(r[3]),
      apr: num0(r[4]), may: num0(r[5]), jun: num0(r[6]), total: num0(r[7]), avgMo: num0(r[8]),
    });
    if (/^TOTAL/.test(r[0])) break;
  }
  return out;
}

function parseSubscriptions(wb) {
  const d = rowsOf(wb, findSheet(wb, 'Subscriptions'));
  const items = [];
  let totalMonthly = 0, totalAnnual = 0;
  const savingsOpportunities = [];
  let totalPotentialSavingsMonthly = 0, totalPotentialSavingsAnnual = 0;

  const hdr = d.findIndex(r => r[0] === 'Service');
  let i = hdr + 1;
  for (; i < d.length; i++) {
    const r = d[i];
    if (!r[0]) continue;
    if (/^TOTAL MONTHLY/.test(r[0])) { totalMonthly = num0(r[3]); totalAnnual = num0(r[4]); i++; break; }
    const notes = r[5] || '';
    items.push({
      service: r[0], domain: r[1], billing: r[2],
      monthly: num0(r[3]), annual: num0(r[4]), notes,
      active: !/cancelled/i.test(notes),
    });
  }
  const cutHdr = d.findIndex(r => r[0] === 'What to Cut');
  for (let j = cutHdr + 1; j < d.length; j++) {
    const r = d[j];
    if (!r[0]) continue;
    if (/^TOTAL POTENTIAL/.test(r[0])) { totalPotentialSavingsMonthly = num0(r[2]); totalPotentialSavingsAnnual = num0(r[3]); break; }
    savingsOpportunities.push({ cut: r[0], reason: r[1], monthlySave: num0(r[2]), annualSave: num0(r[3]) });
  }
  const active = items.filter(x => x.active);
  return {
    items, totalMonthly, totalAnnual, savingsOpportunities,
    totalPotentialSavingsMonthly, totalPotentialSavingsAnnual,
    currentActiveMonthly: active.reduce((s, x) => s + x.monthly, 0),
    currentActiveAnnual: active.reduce((s, x) => s + x.annual, 0),
  };
}

function parseNetWorth(wb) {
  const d = rowsOf(wb, findSheet(wb, 'Savings'));
  const balanceHistory = [], breakdown = [];
  let total = 0;
  const bhHdr = d.findIndex(r => r[0] === 'Period');
  let i = bhHdr + 1;
  for (; i < d.length; i++) {
    const r = d[i];
    if (!r[0]) continue;
    if (/NET WORTH BREAKDOWN/.test(r[0])) break;
    balanceHistory.push({ period: r[0], balance: num0(r[1]), interest: num0(r[2]), notes: r[3] });
  }
  const bdHdr = d.findIndex(r => r[0] === 'Account / Asset');
  for (let j = bdHdr + 1; j < d.length; j++) {
    const r = d[j];
    if (!r[0]) continue;
    if (/^TOTAL NET WORTH/.test(r[0])) { total = num0(r[1]); break; }
    breakdown.push({ account: r[0], value: num0(r[1]), notes: r[2] });
  }
  return { balanceHistory, breakdown, total };
}

function parseTravel(wb) {
  const d = rowsOf(wb, findSheet(wb, 'Travel'));
  const trips = [];
  let cur = null;
  for (let i = 1; i < d.length; i++) {
    const r = d[i];
    if (!r[0]) continue;
    if (isDivider(r) && r[0].includes('|')) {           // trip header
      const [name, period] = r[0].split('|').map(s => s.replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️]/gu, '').trim());
      cur = { name, period, total: 0, items: [] };
      trips.push(cur);
    } else if (/TOTAL/.test(r[0]) && cur) {              // trip total
      cur.total = num0(r[1]);
    } else if (cur && r[0] !== 'Destination' && r[0] !== 'Category' && num(r[1]) != null) {
      cur.items.push({ name: r[0], amount: num0(r[1]), detail: r[2] || null, notes: r[3] || null });
    }
  }
  return { trips };
}

function parseKeyTransactions(wb) {
  const d = rowsOf(wb, findSheet(wb, 'Key Transactions'));
  const hdr = d.findIndex(r => r[0] === 'Date');
  const out = [];
  for (let i = hdr + 1; i < d.length; i++) {
    const r = d[i];
    if (!r[0]) continue;
    out.push({ date: String(r[0]), merchant: r[1], amount: num(r[2]), category: r[3], flag: r[4], insight: r[5] });
  }
  return out;
}

function parseRecommendations(wb) {
  const d = rowsOf(wb, findSheet(wb, 'Recommendations'));
  const groups = [];
  let cur = null;
  const hdr = d.findIndex(r => r[0] === 'Priority');
  for (let i = hdr + 1; i < d.length; i++) {
    const r = d[i];
    if (!r[0]) continue;
    if (isDivider(r)) { cur = { title: r[0], items: [] }; groups.push(cur); }
    else if (cur) cur.items.push({ priority: r[0], recommendation: r[1], detail: r[2], impact: r[3], action: r[4] });
  }
  return { groups };
}

function parseBudgetScore(wb) {
  const d = rowsOf(wb, findSheet(wb, 'Budget Score'));
  const gradeRow = (d[1] && d[1][0]) || '';
  const m = gradeRow.match(/OVERALL GRADE:\s*([A-F][+-]?)\s*\|\s*(.+)/i);
  const categories = [];
  const hdr = d.findIndex(r => r[0] === 'Category');
  for (let i = hdr + 1; i < d.length; i++) {
    const r = d[i];
    if (!r[0]) continue;
    categories.push({ category: r[0], grade: r[1], score: num0(r[2]), assessment: r[3] });
  }
  return { grade: m ? m[1] : '', summary: m ? m[2].trim() : '', categories };
}

function parseBudgetPlan(wb) {
  const d = rowsOf(wb, findSheet(wb, 'Budget Plan'));
  const basis = (d[1] && d[1][0]) || '';
  const groups = [];
  let cur = null;
  const hdr = d.findIndex(r => r[0] === 'Item');
  for (let i = hdr + 1; i < d.length; i++) {
    const r = d[i];
    if (!r[0]) continue;
    if (isDivider(r)) { cur = { title: r[0], items: [] }; groups.push(cur); }
    else if (cur) cur.items.push({ item: r[0], budget: num0(r[1]), notes: r[2], status: r[3] });
  }
  return { basis, groups };
}

function parseFinanceWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  return {
    overview: parseOverview(wb),
    yearlyCategory: parseYearlyCategory(wb),
    monthlyTrend: parseMonthlyTrend(wb),
    monthly2026Category: parseMonthly2026Category(wb),
    subscriptions: parseSubscriptions(wb),
    netWorth: parseNetWorth(wb),
    travel: parseTravel(wb),
    keyTransactions: parseKeyTransactions(wb),
    recommendations: parseRecommendations(wb),
    budgetScore: parseBudgetScore(wb),
    budgetPlan: parseBudgetPlan(wb),
  };
}

module.exports = { parseFinanceWorkbook };
