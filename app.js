'use strict';
const pad = n => String(n).padStart(2,'0');
const API = 'https://dashboard-production-100b.up.railway.app';
let evs = [];

/* ── TAB NAV ───────────────────────────────────────── */
function setTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
  ({health:loadHealthTab, finance:loadFinanceTab, projects:loadProjectsTab,
    travel:loadTravelTab, notes:loadNotesTab, obsidian:loadObsidianTab})[name]?.();
}

/* ── SIDEBAR ───────────────────────────────────────── */
function toggleSidebar(open) {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const menuBtn = document.querySelector('.menu-btn');
  const next = typeof open === 'boolean' ? open : !sidebar.classList.contains('open');
  const isDesktop = window.innerWidth > 640;
  sidebar.classList.toggle('open', next);
  overlay.classList.toggle('open', next);
  document.body.classList.toggle('sidebar-open', next);
  sidebar.setAttribute('aria-hidden', String(!next));
  menuBtn?.setAttribute('aria-expanded', String(next));
  document.body.style.overflow = (next && !isDesktop) ? 'hidden' : '';
  if (isDesktop) { try { localStorage.setItem('dashSidebarOpen', String(next)); } catch(e) {} }
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') toggleSidebar(false); });
if (window.innerWidth > 640) {
  try { if (localStorage.getItem('dashSidebarOpen') === 'true') toggleSidebar(true); } catch(e) {}
}

/* ── CLOCK TICK ────────────────────────────────────── */
function tick() {
  const n = new Date(), h = n.getHours();
  const hm = pad(h)+':'+pad(n.getMinutes());
  document.getElementById('bighm').textContent = hm;
  document.getElementById('bigs').textContent = pad(n.getSeconds());
  document.getElementById('ampm').textContent = h < 12 ? 'AM' : 'PM';
  document.getElementById('greet').textContent = (h<5?'Good night':h<12?'Good morning':h<18?'Good afternoon':'Good evening')+', Hilmir.';
  updateCountdown();
}
tick(); setInterval(tick, 1000);

/* ── STATIC DATE SETUP ─────────────────────────────── */
(function(){
  const n = new Date();
  const D = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const y = n.getFullYear(), mo = pad(n.getMonth()+1), d = pad(n.getDate()), ds = y+'-'+mo+'-'+d;
  document.getElementById('hd-date').textContent = D[n.getDay()]+', '+M[n.getMonth()]+' '+n.getDate()+', '+y;
  document.getElementById('caldlbl').textContent = '· '+n.getDate()+' '+M[n.getMonth()];
  document.getElementById('obs-dt').textContent = ds;
  document.getElementById('obs-daily').href = 'obsidian://open?vault=Vault&file=Daily+Notes%2F'+ds;
})();

/* ── MILAN COUNTDOWN ───────────────────────────────── */
function updateMilan() {
  const target = new Date('2026-08-03T00:00:00'), now = new Date(), diff = target - now;
  const days = Math.max(0, Math.floor(diff/86400000));
  const hours = Math.max(0, Math.floor((diff%86400000)/3600000));
  document.getElementById('milan-days').textContent = days;
  document.getElementById('milan-hours').textContent = '+ '+hours+' hours';
  document.getElementById('stat-milan').textContent = days+' days';
}
updateMilan(); setInterval(updateMilan, 60000);

/* ── WEATHER ───────────────────────────────────────── */
(async()=>{
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=64.1355&longitude=-21.8954&current=temperature_2m,weather_code&timezone=Atlantic%2FReykjavik');
    const d = await r.json();
    const t = Math.round(d.current.temperature_2m);
    const w = {0:'clear sky',1:'mostly clear',2:'partly cloudy',3:'overcast',45:'fog',48:'fog',51:'drizzle',53:'drizzle',55:'drizzle',61:'light rain',63:'rain',65:'heavy rain',71:'light snow',73:'snow',75:'heavy snow',80:'showers',81:'showers',82:'showers',95:'storm'}[String(d.current.weather_code)]||'—';
    document.getElementById('wxline').textContent = t+'° · Reykjavík · '+w;
  } catch { document.getElementById('wxline').textContent = 'Reykjavík'; }
})();

/* ── CALENDAR WIDGET ───────────────────────────────── */
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
let calY = new Date().getFullYear(), calM = new Date().getMonth();
const calEvents = {};
function calNav(d) { calM+=d; if(calM>11){calM=0;calY++;}else if(calM<0){calM=11;calY--;} renderCalWidget(); }
function renderCalWidget() {
  document.getElementById('cal-month-name').textContent = MONTHS[calM]+' '+calY;
  const first = new Date(calY,calM,1).getDay(), dim = new Date(calY,calM+1,0).getDate();
  const now = new Date(), isNow = now.getFullYear()===calY && now.getMonth()===calM, today = now.getDate();
  const cells = [];
  for(let i=0;i<first;i++) cells.push(null);
  for(let d=1;d<=dim;d++) cells.push(d);
  while(cells.length%7) cells.push(null);
  let html='';
  for(let i=0;i<cells.length;i+=7){
    html+='<div class="cal-week">';
    for(let j=0;j<7;j++){
      const d=cells[i+j];
      if(!d){html+='<div class="cal-day"></div>';continue;}
      const key=calY+'-'+pad(calM+1)+'-'+pad(d);
      const cls='cal-day'+(isNow&&d===today?' today':'')+(calEvents[key]?' dot':'');
      html+=`<div class="${cls}">${d}</div>`;
    }
    html+='</div>';
  }
  document.getElementById('cal-days').innerHTML=html;
}
renderCalWidget();

/* ── GOOGLE CALENDAR / ICAL ────────────────────────── */
const ICAL='https://calendar.google.com/calendar/ical/hilmirkarlsson%40gmail.com/private-e7b30b79827f02af2531a0a678ad7a28/basic.ics';
(async()=>{
  try {
    const r=await fetch('https://api.allorigins.win/raw?url='+encodeURIComponent(ICAL));
    evs=parseIcal(await r.text());
    evs.forEach(e=>{ const k=e.s.getFullYear()+'-'+pad(e.s.getMonth()+1)+'-'+pad(e.s.getDate()); calEvents[k]=true; });
    renderCalWidget(); renderTodayEvents(); updateCountdown();
  } catch {
    document.getElementById('cal-today').innerHTML='<div class="ghost">Could not load calendar</div>';
  }
})();
function parseIcal(txt) {
  const out=[];
  txt.split('BEGIN:VEVENT').slice(1).forEach(b=>{
    const g=k=>{const m=b.match(new RegExp(k+'[^:\\r\\n]*:([^\\r\\n]+)'));return m?m[1].trim():'';};
    const sum=g('SUMMARY'),dts=g('DTSTART');
    if(!sum||!dts) return;
    const s=idate(dts),allDay=dts.replace(/^[^:]+:/,'').length===8;
    if(s) out.push({sum,s,allDay});
  });
  return out.sort((a,b)=>a.s-b.s);
}
function idate(raw) {
  const s=raw.replace(/^[^:]+:/,'');
  if(s.length===8) return new Date(+s.slice(0,4),s.slice(4,6)-1,+s.slice(6,8));
  const y=+s.slice(0,4),mo=s.slice(4,6)-1,d=+s.slice(6,8),h=+(s.slice(9,11)||0),mi=+(s.slice(11,13)||0);
  return s.endsWith('Z')?new Date(Date.UTC(y,mo,d,h,mi)):new Date(y,mo,d,h,mi);
}
function ftime(d,a) { return a?'all day':pad(d.getHours())+':'+pad(d.getMinutes()); }
function renderTodayEvents() {
  const now=new Date(),d0=new Date(now.getFullYear(),now.getMonth(),now.getDate()),d1=new Date(d0.getTime()+864e5);
  const td=evs.filter(e=>e.s>=d0&&e.s<d1);
  document.getElementById('cal-today').innerHTML=td.length
    ?td.map(e=>`<div class="ev-item"><div class="ev-line"></div><div><div class="ev-time">${ftime(e.s,e.allDay)}</div><div class="ev-name">${e.sum}</div></div></div>`).join('')
    :'<div class="ghost">Nothing scheduled today</div>';
}
function updateCountdown() {
  const now=new Date(),coming=evs.filter(e=>e.s>now&&!e.allDay);
  const tEl=document.getElementById('stat-next-time'),nEl=document.getElementById('stat-next-name');
  if(!coming.length){if(tEl)tEl.textContent='—';if(nEl)nEl.textContent='nothing upcoming';return;}
  const nx=coming[0],diff=nx.s-now,h=Math.floor(diff/3600000),m=Math.floor((diff%3600000)/60000);
  if(tEl) tEl.textContent=h>0?h+'h '+pad(m)+'m':m+'m';
  if(nEl) nEl.textContent=nx.sum;
}

/* ── GITHUB ────────────────────────────────────────── */
(async()=>{
  try {
    const r=await fetch('https://api.github.com/users/hilmirkarlsson/events/public?per_page=80');
    const ev=await r.json(),pushes=ev.filter(e=>e.type==='PushEvent');
    const days=new Set(pushes.map(e=>e.created_at.slice(0,10)));
    let streak=0; const today=new Date();
    for(let i=0;i<90;i++){const d=new Date(today);d.setDate(d.getDate()-i);if(days.has(d.toISOString().slice(0,10)))streak++;else if(i>0)break;}
    document.getElementById('ghstreak').textContent=streak;
    document.getElementById('stat-streak').textContent=streak;
    document.getElementById('stat-streak-sub').textContent='day streak';
    const contribs=pushes.reduce((s,e)=>s+(e.payload.commits?.length||1),0);
    document.getElementById('gh-contribs').textContent=contribs;
    function hsh(i){const x=Math.sin(i*99.13+1.7)*7919;return x-Math.floor(x);}
    const colors=['#ebedf0','#9be9a8','#40c463','#30a14e','#216e39'];
    const N=13*7; let html='';
    for(let i=0;i<N;i++){
      let lvl; if(i>=N-13){lvl=2+(i%3);if(lvl>4)lvl=4;}else lvl=Math.floor(hsh(i)*hsh(i)*5);
      html+=`<div class="streak-cell" style="background:${colors[lvl]};"></div>`;
    }
    document.getElementById('streak-grid').innerHTML=html;
  } catch {
    document.getElementById('ghstreak').textContent='—';
    document.getElementById('stat-streak').textContent='—';
  }
})();

/* ── HEALTH ────────────────────────────────────────── */
const HK='dash-h-'+new Date().toISOString().slice(0,10);
const gh=()=>{try{return JSON.parse(localStorage.getItem(HK))||{};}catch{return{};}};
const sh=d=>{try{localStorage.setItem(HK,JSON.stringify(d));}catch{}};
function setN(v){const h=gh();h.nutr=v;sh(h);renderH();}
function togGym(){const h=gh();h.gym=!h.gym;sh(h);renderH();}
function editWt(){const h=gh();const v=prompt('Weight (kg):',h.wt||'84');if(v!==null&&v.trim()){h.wt=v.trim();sh(h);renderH();}}
function renderH(){
  const h=gh();
  document.querySelectorAll('.nb').forEach(b=>b.classList.toggle('sel',b.classList.contains(h.nutr||'')));
  const g=document.getElementById('gym');
  g.textContent=h.gym?'✓ done':'tap to log';
  g.style.color=h.gym?'#16a34a':'#9ca3af';
  document.getElementById('wt').textContent=h.wt?h.wt+' kg':'—';
}
renderH();

/* ── MACROS ────────────────────────────────────────── */
const MK='dash-m-'+new Date().toISOString().slice(0,10);
const gm=()=>{try{return JSON.parse(localStorage.getItem(MK))||{};}catch{return{};}};
const sm=d=>{try{localStorage.setItem(MK,JSON.stringify(d));}catch{}};
function saveMacros(){const m=gm();m.cal=document.getElementById('mi-cal').value||'';m.pro=document.getElementById('mi-pro').value||'';m.carb=document.getElementById('mi-carb').value||'';sm(m);renderMacros();}
function setTarget(){const v=prompt('Daily calorie target:',localStorage.getItem('dash-cal-target')||'2200');if(v&&+v>0){localStorage.setItem('dash-cal-target',v);renderMacros();}}
function renderMacros(){
  const m=gm();
  if(m.cal) document.getElementById('mi-cal').value=m.cal;
  if(m.pro) document.getElementById('mi-pro').value=m.pro;
  if(m.carb) document.getElementById('mi-carb').value=m.carb;
  const cal=parseInt(m.cal)||0,pro=parseInt(m.pro)||0,carb=parseInt(m.carb)||0;
  const target=parseInt(localStorage.getItem('dash-cal-target'))||2200;
  document.getElementById('macnum').textContent=cal.toLocaleString();
  document.getElementById('tgtlbl').textContent=target.toLocaleString();
  document.getElementById('tgt-edit-lbl').textContent=target.toLocaleString();
  document.getElementById('stat-cal').textContent=cal.toLocaleString();
  document.getElementById('stat-cal-sub').textContent='/ '+target.toLocaleString()+' kcal';
  document.getElementById('m-cal-lbl').textContent=cal+' kcal';
  document.getElementById('m-pro-lbl').textContent=pro+'g';
  document.getElementById('m-carb-lbl').textContent=carb+'g';
  document.getElementById('macbar').style.width=Math.min(100,(cal/target)*100)+'%';
  document.getElementById('macbar-pro').style.width=Math.min(100,(pro/160)*100)+'%';
  document.getElementById('macbar-carb').style.width=Math.min(100,(carb/250)*100)+'%';
}
renderMacros();

/* ── OBSIDIAN NOTES ────────────────────────────────── */
const NK='personal-os-notes';
function loadNotes(){try{return JSON.parse(localStorage.getItem(NK))||[];}catch{return[];}}
function saveNotes(n){try{localStorage.setItem(NK,JSON.stringify(n));}catch{}}
function renderNotes(){
  const notes=loadNotes();
  document.getElementById('obs-notes-list').innerHTML=notes.map(n=>`<div class="obs-note"><div class="obs-dot"></div>${n.text}<span class="obs-time">${n.time}</span></div>`).join('');
}
renderNotes();
function sendInbox(){
  const inp=document.getElementById('obs-inp'),val=inp.value.trim();
  if(!val) return;
  const time=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const notes=[{text:val,time},...loadNotes()].slice(0,6);
  saveNotes(notes); renderNotes();
  window.open('obsidian://new?vault=Vault&file=0-Inbox%2FQuick-'+encodeURIComponent(new Date().toISOString().slice(0,16).replace(':','-'))+'&content='+encodeURIComponent(val),'_blank');
  inp.value='';
}

/* ── OBSIDIAN FUTURE GOALS ─────────────────────────── */
const OGK='dash-obs-goals';
const defOG=['Finish Software Engineering degree','Build and ship monetisable apps','Start a business','Read as much as possible'];
const gog=()=>{try{return JSON.parse(localStorage.getItem(OGK))||defOG;}catch{return defOG;}};
const sog=v=>{try{localStorage.setItem(OGK,JSON.stringify(v));}catch{}};
function addObsGoal(){const t=prompt('New future goal:');if(!t||!t.trim())return;const g=gog();g.push(t.trim());sog(g);renderObs();}
function renderObs(){document.getElementById('obsgoals').innerHTML=gog().map(g=>`<div class="obs-fi"><div class="obs-fi-dot"></div><span class="obs-fi-txt">${g}</span></div>`).join('');}
renderObs();

/* ── FINANCE CORE ───────────────────────────────────── */
const FK='dash-finance';
const gf=()=>{try{return JSON.parse(localStorage.getItem(FK))||{};}catch{return{};}};
const sf=d=>{try{localStorage.setItem(FK,JSON.stringify(d));}catch{}};
function editFin(field){editFinField(field);}
function editFinField(field){
  const f=gf();
  const labels={bal:'Balance (kr)',spent:'Spent this month (kr)',budget:'Monthly budget (kr)',income:'Monthly income (kr)'};
  const v=prompt((labels[field]||field)+':',f[field]||'');
  if(v!==null&&v.trim()){f[field]=v.replace(/[^0-9.]/g,'');sf(f);renderFin();if(document.getElementById('panel-finance').classList.contains('active'))loadFinanceTab();}
}
function fmtISK(n){return n?Number(n).toLocaleString('is-IS')+' kr':'—';}
function fmtISKShort(n){if(!n)return'0';const v=Number(n);return v>=1000000?(v/1000000).toFixed(1)+'M':v>=1000?(v/1000).toFixed(0)+'k':String(Math.round(v));}
function renderFin(){
  const f=gf();
  const e=id=>document.getElementById(id);
  if(e('fin-bal'))e('fin-bal').textContent=fmtISK(f.bal);
  if(e('fin-spent'))e('fin-spent').textContent=fmtISK(f.spent);
  if(e('fin-budget'))e('fin-budget').textContent=fmtISK(f.budget);
  if(e('stat-balance'))e('stat-balance').textContent=fmtISK(f.bal);
  const spent=parseFloat(f.spent)||0,budget=parseFloat(f.budget)||0,rem=budget-spent;
  const remEl=e('fin-rem');
  if(remEl){remEl.textContent=budget?fmtISK(String(Math.abs(rem))):'—';remEl.className='fin-val'+(rem<0?' warn':budget?' good':'');}
  if(e('fin-remsub'))e('fin-remsub').textContent=budget?(rem<0?'over budget':'remaining'):'';
  const bar=e('fin-bar');
  if(bar){bar.style.width=budget?Math.min(100,(spent/budget)*100)+'%':'0%';bar.className='fin-fill'+(rem<0?' warn':'');}
}
renderFin();

/* ── GOALS ─────────────────────────────────────────── */
const GK='dash-goals';
const DEF=[{t:'Redesign Telpurnar theme',d:false},{t:'Push Isavia-Eftirlit',d:false},{t:'Start Personal Dashboard',d:true}];
const gg2=()=>{try{return JSON.parse(localStorage.getItem(GK))||DEF;}catch{return DEF;}};
const sg2=g=>{try{localStorage.setItem(GK,JSON.stringify(g));}catch{}};
function togGoal(i){const g=gg2();g[i].d=!g[i].d;sg2(g);renderGoals();}
function addGoal(){const t=prompt('New goal:');if(!t||!t.trim())return;const g=gg2();g.push({t:t.trim(),d:false});sg2(g);renderGoals();}
function renderGoals(){
  const goals=gg2(),done=goals.filter(g=>g.d).length;
  document.getElementById('gbar').style.width=goals.length?(done/goals.length*100)+'%':'0%';
  document.getElementById('gpct').textContent=done+'/'+goals.length;
  document.getElementById('goals').innerHTML=goals.map((g,i)=>`<div class="goal"><div class="gbox ${g.d?'done':''}" onclick="togGoal(${i})" role="checkbox" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' ')togGoal(${i})"></div><span class="gtxt ${g.d?'done':''}">${g.t}</span></div>`).join('');
  document.getElementById('stat-goals').textContent=done+'/'+goals.length;
  document.getElementById('stat-goals-sub').textContent=(goals.length-done)+' remaining';
}
renderGoals();

/* ── SHARED HELPERS ─────────────────────────────────── */
async function fetchVault(file) {
  const r = await fetch(API + '/api/vault?file=' + encodeURIComponent(file));
  if (!r.ok) throw new Error('not found');
  return r.text();
}
function parseFM(md) {
  const m = md.match(/^---\n([\s\S]+?)\n---/);
  if (!m) return {};
  const o = {};
  m[1].split('\n').forEach(l => { const [k,...v]=l.split(':'); if(k&&v.length) o[k.trim()]=v.join(':').trim(); });
  return o;
}
function parseSection(md, name) {
  const m = md.match(new RegExp('## '+name+'\\n([\\s\\S]*?)(?=\\n## |$)'));
  return m ? m[1].trim() : '';
}
function parseChecklist(txt) {
  return txt.split('\n').filter(l => /^- \[[ x]\]/.test(l))
    .map(l => ({ done: l.includes('[x]'), text: l.replace(/^- \[[ x]\] /,'').trim() }));
}
function stripMd(t) { return t.replace(/\*\*(.+?)\*\*/g,'$1').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/^- /,'').trim(); }
function relTime(d) {
  const diff = (Date.now()-d)/864e5;
  if (diff < 1) return 'today';
  if (diff < 2) return 'yesterday';
  if (diff < 8) return Math.floor(diff)+' days ago';
  return Math.floor(diff/7)+' weeks ago';
}

/* server health check */
fetch(API + '/api/vault?file=CLAUDE.md').catch(()=>{
  const b=document.getElementById('server-banner');
  if(b){ b.style.display='flex'; }
});

    /* ── HEALTH TAB ──────────────────────────────────────────────── */
    let _workoutData = null;

    function loadHealthTab() {
      const iframe = document.getElementById('macros-iframe');
      if (iframe && !iframe.src) iframe.src = 'https://hilmirkarlsson.github.io/macrostracker/';
      const h = gh();
      const wt = parseFloat(h.wt)||84;
      document.getElementById('h-wt2').textContent = wt+' kg';
      document.getElementById('h-gym2').textContent = h.gym ? '✓ done' : 'tap to log';
      document.getElementById('h-gym2').style.color = h.gym ? '#16a34a' : '#9ca3af';
      document.querySelectorAll('#panel-health .nb').forEach(b => b.classList.toggle('sel', b.classList.contains(h.nutr||'')));
      const pct = Math.round(Math.max(0,Math.min(100,((95-wt)/(95-70))*100)));
      document.getElementById('h-wt-bar').style.width = pct+'%';
      document.getElementById('h-wt-pct').textContent = pct+'%';
      fetch(API + '/api/health-json').then(r=>r.json()).then(z=>{
        renderZeppStats(z); renderHealthGroups(z);
      }).catch(()=>{
        try { const z=JSON.parse(localStorage.getItem('dash-zepp-data')||'null'); if(z&&!isStaleZepp(z)){ renderZeppStats(z); renderHealthGroups(z); } } catch(e){}
      });
      fetch(API + '/api/workout-json').then(r=>r.json()).then(d=>{ _workoutData=d; renderWorkouts(d,'all'); }).catch(()=>{
        document.getElementById('workout-list').innerHTML='<div style="padding:16px 20px;" class="ghost">No workout data yet</div>';
      });
      const ds = new Date().toISOString().slice(0,10);
      document.getElementById('h-dn-link').href = 'obsidian://open?vault=Vault&file=Daily+Notes%2F'+ds;
      fetchVault('Daily Notes/'+ds+'.md').then(md => {
        const hsec = parseSection(md,'Health');
        if (!hsec) { document.getElementById('h-daily-content').innerHTML='<div class="ghost">No health data in today\'s note yet</div>'; return; }
        const rows = hsec.split('\n').filter(l=>l.trim()&&l.startsWith('- '));
        document.getElementById('h-daily-content').innerHTML = rows.map(l => {
          const clean = l.replace(/^- /,'');
          const [key,...val] = clean.split(':');
          return '<div class="hrow"><span class="hlbl">'+key.trim()+'</span><span class="hval">'+val.join(':').trim()+'</span></div>';
        }).join('');
      }).catch(()=>{ document.getElementById('h-daily-content').innerHTML='<div class="ghost">Start server.js to load vault data</div>'; });
    }

    function editWtH() { const h=gh(); const v=prompt('Weight (kg):',h.wt||'84'); if(v!==null&&v.trim()){h.wt=v.trim();sh(h);renderH();loadHealthTab();} }
    function togGym2() { const h=gh(); h.gym=!h.gym; sh(h); renderH(); loadHealthTab(); }
    function setN2(v) { setN(v); loadHealthTab(); }

    function isStaleZepp(z) {
      // Cached data from a previous day is stale once past 00:00 — the
      // daily stats (steps, calories, etc.) should reset, not persist.
      if (!z.synced) return false;
      return z.synced.slice(0,10) !== new Date().toISOString().slice(0,10);
    }

    function renderZeppStats(z) {
      const $=id=>document.getElementById(id);
      $('z-steps').textContent  = z.steps     ? z.steps.toLocaleString()       : '—';
      $('z-sleep').textContent  = z.sleepHours ? z.sleepHours.toFixed(1)+'h'   : '—';
      if (z.sleepDeep || z.sleepREM)
        $('z-sleep-sub').textContent = (z.sleepDeep?'deep '+z.sleepDeep+'h ':'')+(z.sleepREM?'REM '+z.sleepREM+'h':'');
      $('z-hr').textContent     = z.restingHR  ? z.restingHR+' bpm'            : '—';
      $('z-hrv').textContent    = z.hrv        ? z.hrv+' ms'                   : '—';
      $('z-spo2').textContent   = z.spo2       ? z.spo2+'%'                    : '—';
      $('z-active').textContent = z.activeCal  ? z.activeCal.toLocaleString()+' kcal' : '—';
      if (z.synced) {
        const mins = Math.round((Date.now()-new Date(z.synced))/60000);
        $('z-sync-status').textContent = mins < 1 ? 'synced just now' : 'synced '+mins+'m ago';
      }
    }

    function renderHealthGroups(z) {
      const $=id=>document.getElementById(id);
      const fmtT = s => {
        if (!s) return '—';
        const d = new Date(s.replace(' +0000','+00:00'));
        return d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
      };
      $('hg-sleep-total').textContent  = z.sleepHours  ? z.sleepHours+'h'   : '—';
      $('hg-sleep-inbed').textContent  = z.sleepInBed  ? z.sleepInBed+'h'   : '—';
      $('hg-sleep-deep').textContent   = z.sleepDeep   ? z.sleepDeep+'h'    : '—';
      $('hg-sleep-rem').textContent    = z.sleepREM    ? z.sleepREM+'h'     : '—';
      $('hg-sleep-core').textContent   = z.sleepCore   ? z.sleepCore+'h'    : '—';
      $('hg-sleep-awake').textContent  = z.sleepAwake  ? z.sleepAwake+'h'   : '—';
      $('hg-sleep-start').textContent  = fmtT(z.sleepStart);
      $('hg-sleep-end').textContent    = fmtT(z.sleepEnd);
      $('hg-hr-resting').textContent = z.restingHR       ? z.restingHR+' bpm'        : '—';
      $('hg-hr-hrv').textContent     = z.hrv             ? z.hrv+' ms'               : '—';
      $('hg-hr-avg').textContent     = z.avgHR           ? z.avgHR+' bpm'            : '—';
      $('hg-hr-min').textContent     = z.minHR           ? z.minHR+' bpm'            : '—';
      $('hg-hr-max').textContent     = z.maxHR           ? z.maxHR+' bpm'            : '—';
      $('hg-hr-resp').textContent    = z.respiratoryRate ? z.respiratoryRate+' /min'  : '—';
      $('hg-act-steps').textContent   = z.steps      ? z.steps.toLocaleString()           : '—';
      $('hg-act-dist').textContent    = z.distanceKm ? z.distanceKm+' km'                : '—';
      $('hg-act-active').textContent  = z.activeCal  ? z.activeCal.toLocaleString()+' kcal'  : '—';
      $('hg-act-basal').textContent   = z.basalCal   ? z.basalCal.toLocaleString()+' kcal'   : '—';
      const total = (z.activeCal||0)+(z.basalCal||0);
      $('hg-act-total').textContent   = total ? total.toLocaleString()+' kcal' : '—';
      $('hg-act-flights').textContent = z.flightsClimbed != null ? z.flightsClimbed : '—';
      $('hg-act-speed').textContent   = z.walkingSpeed  ? z.walkingSpeed+' km/h'            : '—';
      $('hg-act-steplen').textContent = z.stepLength    ? z.stepLength+' cm'                : '—';
    }

    function renderWorkouts(d, filter) {
      const el = document.getElementById('workout-list');
      const wf = document.getElementById('workout-file');
      if (wf && d.file) wf.textContent = d.file;
      if (!d.workouts?.length) {
        el.innerHTML = '<div style="padding:16px 20px;" class="ghost">No workouts in latest file</div>';
        return;
      }
      const types = [...new Set(d.workouts.map(w=>w.name))];
      const filterEl = document.getElementById('wk-type-filters');
      if (filterEl && types.length > 1) {
        filterEl.innerHTML = ['all',...types].map(t =>
          '<button class="btn'+(filter===t?' btn-dk':'')+'" style="font-size:11px;padding:3px 10px;" data-t="'+t+'" onclick="filterWorkouts(this.dataset.t)">'+(t==='all'?'All':t)+'</button>'
        ).join('');
      }
      const list = filter==='all' ? d.workouts : d.workouts.filter(w=>w.name===filter);
      const sorted = [...list].sort((a,b)=>new Date(b.start||0)-new Date(a.start||0));
      el.innerHTML = sorted.map((w,i) => {
        const dt = w.start ? new Date(w.start.replace(' +0000','+00:00')) : null;
        const dateStr = dt ? dt.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}) : '';
        const timeStr = dt ? dt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : '';
        return '<div style="border-bottom:1px solid #f3f4f6;">'
          +'<div style="display:flex;align-items:center;gap:14px;padding:12px 20px;cursor:pointer;" onclick="toggleWorkout('+i+')">'
          +'<div style="font-weight:600;font-size:14px;min-width:90px;">'+w.name+'</div>'
          +'<div style="font-size:13px;color:#6b7280;flex:1;">'+dateStr+' · '+timeStr+'</div>'
          +'<div style="font-size:13px;font-weight:600;">'+w.duration+' <span style="font-weight:400;color:#9ca3af;">min</span></div>'
          +(w.avgHR?'<div style="font-size:13px;">❤️ '+w.avgHR+' <span style="color:#9ca3af;">avg</span></div>':'')
          +(w.kcal ?'<div style="font-size:13px;">🔥 '+w.kcal+' <span style="color:#9ca3af;">kcal</span></div>':'')
          +'<div style="font-size:11px;color:#9ca3af;user-select:none;">▾</div>'
          +'</div>'
          +'<div id="wk-detail-'+i+'" style="display:none;padding:0 20px 16px;">'
          +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:10px;margin-top:4px;">'
          +'<div class="hst" style="min-width:0;"><div class="hst-lbl">Duration</div><div class="hst-val" style="font-size:22px;">'+w.duration+'</div><div class="hst-sub">min</div></div>'
          +(w.avgHR?'<div class="hst" style="min-width:0;"><div class="hst-lbl">Avg HR</div><div class="hst-val" style="font-size:22px;">'+w.avgHR+'</div><div class="hst-sub">bpm</div></div>':'')
          +(w.maxHR?'<div class="hst" style="min-width:0;"><div class="hst-lbl">Max HR</div><div class="hst-val" style="font-size:22px;">'+w.maxHR+'</div><div class="hst-sub">bpm</div></div>':'')
          +(w.minHR?'<div class="hst" style="min-width:0;"><div class="hst-lbl">Min HR</div><div class="hst-val" style="font-size:22px;">'+w.minHR+'</div><div class="hst-sub">bpm</div></div>':'')
          +(w.kcal ?'<div class="hst" style="min-width:0;"><div class="hst-lbl">Active Cal</div><div class="hst-val" style="font-size:22px;">'+w.kcal+'</div><div class="hst-sub">kcal</div></div>':'')
          +'</div></div></div>';
      }).join('');
    }

    function toggleWorkout(i) {
      const el = document.getElementById('wk-detail-'+i);
      if (el) el.style.display = el.style.display==='none' ? 'block' : 'none';
    }
    function filterWorkouts(type) {
      if (_workoutData) renderWorkouts(_workoutData, type);
    }

    async function syncZepp() {
      const btns = ['z-sync-btn'].map(id=>document.getElementById(id)).filter(Boolean);
      btns.forEach(b=>{ b.textContent='↻ …'; b.disabled=true; });
      try {
        const r = await fetch(API + '/api/health-json');
        if (!r.ok) throw new Error('no data');
        const data = await r.json();
        renderZeppStats(data); renderHealthGroups(data);
        localStorage.setItem('dash-zepp-data', JSON.stringify(data));
      } catch(e) {
        document.getElementById('z-sync-status').textContent = 'no data — export from Health Auto Export';
      }
      btns.forEach(b=>{ b.textContent='↻ Sync'; b.disabled=false; });
      fetch(API + '/api/workout-json').then(r=>r.json()).then(d=>{ _workoutData=d; renderWorkouts(d,'all'); }).catch(()=>{});
    }

function parseHealthCsv(csv) {
  const lines = csv.split('\n').filter(l=>l.trim());
  if (lines.length < 2) return {};
  const headers = lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,'').toLowerCase());
  const last = lines[lines.length-1].split(',').map(v=>v.trim().replace(/^"|"$/g,''));
  const d = {};
  headers.forEach((h,i)=>{
    const v = last[i];
    if (h.includes('step')&&!h.includes('climb')) d.steps = parseInt(v)||0;
    else if (h.includes('resting heart')||(h.includes('heart')&&h.includes('rest'))) d.restingHR = parseInt(v)||0;
    else if (h.includes('sleep')&&h.includes('asleep')) d.sleepHours = parseFloat(v)||0;
    else if (h.includes('spo2')||h.includes('oxygen')) d.spo2 = parseFloat(v)||0;
    else if (h.includes('active energy')||h.includes('active calorie')) d.activeCal = parseInt(v)||0;
  });
  return d;
}
function saveZeppSheet() {
  const url = document.getElementById('z-sheet-inp').value.trim();
  if (!url) return;
  localStorage.setItem('dash-zepp-sheet', url);
  document.getElementById('z-sheet-saved').style.display='block';
  document.getElementById('z-sheet-saved').textContent = '✓ Saved: '+url.slice(0,60)+'…';
  document.getElementById('z-sheet-status').textContent = 'configured';
  syncZepp();
}

/* ── FINANCE TAB ────────────────────────────────────── */
const FIN_CATS=['Housing','Food','Transport','Subscriptions','Shopping','Other'];
const FIN_CAT_COLORS=['#C16A41','#5E7E63','#C99A3F','#7C8FA6','#A86B6B','#CDBBA8'];
const getFinCats=()=>{try{return JSON.parse(localStorage.getItem('dash-finance-cats'))||{};}catch{return{};}};
const saveFinCats=d=>{try{localStorage.setItem('dash-finance-cats',JSON.stringify(d));}catch{}};
const getFinCatBudgets=()=>{try{return JSON.parse(localStorage.getItem('dash-finance-cat-budgets'))||{};}catch{return{};}};
const saveFinCatBudgets=d=>{try{localStorage.setItem('dash-finance-cat-budgets',JSON.stringify(d));}catch{}};
const getFinTxns=()=>{try{return JSON.parse(localStorage.getItem('dash-finance-txns'))||[];}catch{return[];}};
const saveFinTxns=arr=>{try{localStorage.setItem('dash-finance-txns',JSON.stringify(arr));}catch{}};
const getFinGoals=()=>{try{return JSON.parse(localStorage.getItem('dash-finance-goals'))||[];}catch{return[];}};
const saveFinGoals=arr=>{try{localStorage.setItem('dash-finance-goals',JSON.stringify(arr));}catch{}};
const getMonthlyFin=()=>{try{return JSON.parse(localStorage.getItem('dash-finance-monthly'))||[];}catch{return[];}};
const saveMonthlyFin=arr=>{try{localStorage.setItem('dash-finance-monthly',JSON.stringify(arr));}catch{}};

function archiveCurrentMonth(){
  const f=gf();if(!f.spent)return;
  const cur=new Date().toISOString().slice(0,7);
  let arr=getMonthlyFin();
  const idx=arr.findIndex(m=>m.m===cur);
  if(idx>=0)arr[idx].spent=parseFloat(f.spent)||0;
  else arr.push({m:cur,spent:parseFloat(f.spent)||0});
  arr=arr.sort((a,b)=>a.m.localeCompare(b.m)).slice(-8);
  saveMonthlyFin(arr);
}

function loadFinanceTab(){
  const f=gf();
  const e=id=>document.getElementById(id);
  const spent=parseFloat(f.spent)||0,budget=parseFloat(f.budget)||0,rem=budget-spent;
  if(e('fp-bal'))e('fp-bal').textContent=fmtISK(f.bal);
  if(e('fp-spent'))e('fp-spent').textContent=fmtISK(f.spent);
  if(e('fp-budget'))e('fp-budget').textContent=fmtISK(f.budget);
  const remEl=e('fp-rem');
  if(remEl){remEl.textContent=budget?fmtISK(String(Math.abs(rem))):'—';remEl.className='fin2-sc-val'+(rem<0?' warn':budget?' good':'');}
  if(e('fp-rem-sub'))e('fp-rem-sub').textContent=budget?(rem<0?'over budget':'remaining'):'';
  if(budget){
    const pct=Math.round((spent/budget)*100);
    if(e('fp-spent-sub'))e('fp-spent-sub').textContent=pct+'% of budget';
    if(e('fp-budget-sub'))e('fp-budget-sub').textContent=pct+'% used · '+new Date().getDate()+' days in';
  }
  archiveCurrentMonth();
  renderFinMonthlyBars();
  renderFinIncomeVsExp(f,spent);
  renderFinDonut();
  renderFinCatBudgets();
  renderFinTxns();
  renderFinGoals();
}

function renderFinMonthlyBars(){
  const el=document.getElementById('fp-monthly-bars');if(!el)return;
  const arr=getMonthlyFin();
  if(!arr.length){el.innerHTML='<div class="ghost" style="margin:auto;align-self:center;padding:20px 0;">No data yet — save a month to start</div>';return;}
  const curM=new Date().toISOString().slice(0,7);
  const maxV=Math.max(...arr.map(m=>m.spent),1);
  const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  el.innerHTML=arr.map(m=>{
    const cur=m.m===curM;
    const h=Math.max(10,Math.round((m.spent/maxV)*100));
    const mon=MN[parseInt(m.m.slice(5,7))-1];
    return '<div class="fin2-bar-col">'
      +'<div style="font:500 10px \'Plus Jakarta Sans\',sans-serif;color:'+(cur?'#C16A41':'#9ca3af')+';text-align:center;white-space:nowrap;">'+fmtISKShort(m.spent)+'</div>'
      +'<div class="fin2-bar-col-bar" style="height:'+h+'px;background:'+(cur?'#C16A41':'#e5e7eb')+'"></div>'
      +'<div class="fin2-bar-col-lbl'+(cur?' cur':'')+'">'+mon+'</div>'
    +'</div>';
  }).join('');
}

function renderFinIncomeVsExp(f,spent){
  const e=id=>document.getElementById(id);
  const income=parseFloat(f.income)||0;
  if(e('fp-income'))e('fp-income').textContent=income?fmtISK(f.income):'tap to set';
  if(e('fp-expenses-vs'))e('fp-expenses-vs').textContent=spent?fmtISK(String(spent)):'—';
  const maxV=Math.max(income,spent,1);
  if(e('fp-income-bar'))e('fp-income-bar').style.width=income?Math.round((income/maxV)*100)+'%':'4%';
  if(e('fp-expenses-bar'))e('fp-expenses-bar').style.width=spent?Math.round((spent/maxV)*100)+'%':'0%';
  const net=income-spent;
  const netEl=e('fp-net');
  if(netEl){netEl.textContent=income?(net>=0?'+':'')+fmtISK(String(Math.abs(net))):'—';netEl.className='fin2-net-val'+(net<0?' neg':'');}
  const rateEl=e('fp-savings-rate');
  if(rateEl)rateEl.textContent=(income&&net>0)?Math.round((net/income)*100)+'% savings rate this month':'';
}

function renderFinDonut(){
  const cats=getFinCats();
  const total=FIN_CATS.reduce((s,c)=>s+(parseFloat(cats[c])||0),0);
  const arcsEl=document.getElementById('fp-donut-arcs');
  const legendEl=document.getElementById('fp-cat-legend');
  const totalEl=document.getElementById('fp-donut-total');
  if(totalEl)totalEl.textContent=total?fmtISKShort(total)+'kr':'—';
  if(!arcsEl||!legendEl)return;
  const circ=2*Math.PI*54;
  let offset=0;
  let arcsHtml='<circle cx="66" cy="66" r="54" fill="none" stroke="#eef0f2" stroke-width="20"/>';
  if(total){
    FIN_CATS.forEach((cat,i)=>{
      const v=parseFloat(cats[cat])||0;if(!v)return;
      const dash=(v/total)*circ;
      arcsHtml+=`<circle cx="66" cy="66" r="54" fill="none" stroke="${FIN_CAT_COLORS[i]}" stroke-width="20" stroke-dasharray="${dash.toFixed(1)} ${(circ-dash).toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}"/>`;
      offset+=dash;
    });
  }
  arcsEl.innerHTML=arcsHtml;
  legendEl.innerHTML=FIN_CATS.map((cat,i)=>{
    const v=parseFloat(cats[cat])||0;
    return '<div style="display:flex;align-items:center;gap:8px;font:500 12.5px \'Plus Jakarta Sans\',sans-serif;color:#374151;">'
      +'<span style="width:9px;height:9px;border-radius:3px;background:'+FIN_CAT_COLORS[i]+';flex:none;"></span>'
      +cat
      +'<span style="margin-left:auto;color:#6b7280;font-variant-numeric:tabular-nums;font-size:12px;">'+fmtISK(String(v))+'</span>'
    +'</div>';
  }).join('');
}

function editFinCats(){
  const cats=getFinCats();
  for(const cat of FIN_CATS){
    const v=prompt(cat+' spending (kr):',cats[cat]||'');
    if(v===null)break;
    if(v.trim())cats[cat]=v.replace(/[^0-9.]/g,'');
  }
  saveFinCats(cats);renderFinDonut();renderFinCatBudgets();
}

function renderFinCatBudgets(){
  const el=document.getElementById('fp-cat-budget-bars');if(!el)return;
  const cats=getFinCats(),budgets=getFinCatBudgets();
  el.innerHTML=FIN_CATS.map((cat,i)=>{
    const spent=parseFloat(cats[cat])||0,budget=parseFloat(budgets[cat])||0;
    const pct=budget?Math.min(100,Math.round((spent/budget)*100)):0;
    const color=pct>=90?'#ef4444':pct>=70?'#C99A3F':'#5E7E63';
    return '<div class="fin2-budget-bar-row">'
      +'<div class="fin2-budget-bar-hd" onclick="editFinCatBudgetItem(\''+cat+'\')">'
      +'<span class="fin2-budget-bar-name" style="display:flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:2px;background:'+FIN_CAT_COLORS[i]+';flex:none;"></span>'+cat+'</span>'
      +'<span style="color:#9ca3af;font-size:12px;font-variant-numeric:tabular-nums;">'+fmtISK(String(spent))+' / '+(budget?fmtISK(String(budget)):'set budget')+'</span>'
      +'</div>'
      +'<div class="fin2-budget-bar-track"><div class="fin2-budget-bar-fill" style="width:'+pct+'%;background:'+color+'"></div></div>'
    +'</div>';
  }).join('');
}

function editFinCatBudgetItem(cat){
  const budgets=getFinCatBudgets();
  const v=prompt(cat+' budget (kr):',budgets[cat]||'');
  if(v!==null&&v.trim()){budgets[cat]=v.replace(/[^0-9.]/g,'');saveFinCatBudgets(budgets);renderFinCatBudgets();}
}

function editFinCatBudgets(){
  const budgets=getFinCatBudgets();
  for(const cat of FIN_CATS){
    const v=prompt(cat+' budget (kr):',budgets[cat]||'');
    if(v===null)break;
    if(v.trim())budgets[cat]=v.replace(/[^0-9.]/g,'');
  }
  saveFinCatBudgets(budgets);renderFinCatBudgets();
}

function renderFinTxns(){
  const el=document.getElementById('fp-txns');if(!el)return;
  const txns=getFinTxns();
  if(!txns.length){el.innerHTML='<div class="ghost" style="padding:16px 20px;">No transactions yet — tap + Add</div>';return;}
  el.innerHTML=txns.slice(0,10).map((t,i)=>{
    const isInc=t.amount>0;
    const bg=isInc?'#e6ede5':'#f3f4f6';
    const amtStr=(isInc?'+':'')+fmtISK(String(Math.abs(t.amount)));
    return '<div class="fin2-txn">'
      +'<div class="fin2-txn-icon" style="background:'+bg+'">'+t.emoji+'</div>'
      +'<div class="fin2-txn-info"><div class="fin2-txn-name">'+t.name+'</div><div class="fin2-txn-meta">'+t.category+' · '+t.date+'</div></div>'
      +'<div class="fin2-txn-amount'+(isInc?' income':'')+'">'+amtStr+'</div>'
      +'<span class="fin2-txn-del" onclick="delFinTxn('+i+')" title="Delete">×</span>'
    +'</div>';
  }).join('');
}

function addFinTxn(){
  const name=prompt('Transaction name:','');if(!name)return;
  const amtStr=prompt('Amount (positive = income, negative = expense, e.g. -5000):','');if(amtStr===null)return;
  const cat=prompt('Category (Housing / Food / Transport / Subscriptions / Shopping / Other / Income):','Other');
  const emoji=prompt('Emoji icon:','💰');
  const date=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'});
  const txns=getFinTxns();
  txns.unshift({name,amount:parseFloat(amtStr.replace(/[^0-9.-]/g,''))||0,category:cat||'Other',emoji:emoji||'💰',date});
  saveFinTxns(txns.slice(0,20));renderFinTxns();
}

function delFinTxn(i){
  const txns=getFinTxns();txns.splice(i,1);saveFinTxns(txns);renderFinTxns();
}

function renderFinGoals(){
  const el=document.getElementById('fp-goals');if(!el)return;
  const goals=getFinGoals();
  if(!goals.length){el.innerHTML='<div class="ghost">No goals yet — tap + Add goal</div>';return;}
  el.innerHTML=goals.map((g,i)=>{
    const pct=g.target?Math.min(100,Math.round((g.saved/g.target)*100)):0;
    return '<div class="fin2-goal-row">'
      +'<div class="fin2-goal-hd" onclick="editFinGoalItem('+i+')">'
      +'<span>'+g.name+'</span>'
      +'<span style="color:#9ca3af;font-size:12px;font-variant-numeric:tabular-nums;">'+fmtISK(String(g.saved))+' / '+fmtISK(String(g.target))+'</span>'
      +'</div>'
      +'<div class="fin2-goal-track"><div class="fin2-goal-fill" style="width:'+pct+'%"></div></div>'
    +'</div>';
  }).join('');
}

function addFinGoal(){
  const name=prompt('Goal name (e.g. Emergency fund):','');if(!name)return;
  const saved=prompt('Saved so far (kr):','0');if(saved===null)return;
  const target=prompt('Target amount (kr):','');if(!target)return;
  const goals=getFinGoals();
  goals.push({name,saved:parseFloat(saved.replace(/[^0-9.]/g,''))||0,target:parseFloat(target.replace(/[^0-9.]/g,''))||0});
  saveFinGoals(goals);renderFinGoals();
}

function editFinGoalItem(i){
  const goals=getFinGoals();const g=goals[i];
  const action=prompt(g.name+'\n\n1. Update saved amount\n2. Delete this goal\n\nEnter 1 or 2:','1');
  if(action==='2'){goals.splice(i,1);saveFinGoals(goals);renderFinGoals();return;}
  const saved=prompt(g.name+' — saved so far (kr):',g.saved||'');
  if(saved!==null&&saved.trim()){g.saved=parseFloat(saved.replace(/[^0-9.]/g,''))||0;saveFinGoals(goals);renderFinGoals();}
}

/* ── PROJECTS TAB ───────────────────────────────────── */
const PROJECTS=[
  {name:'Isavia-Eftirlit',vault:'1-Projects/Isavia-Eftirlit/Isavia-Eftirlit.md',repo:'hilmirkarlsson/Isavia-Eftirlit',live:'https://isavia-eftirlit.vercel.app',status:'active'},
  {name:'Telpurnar',vault:'1-Projects/Telpurnar/Telpurnar.md',repo:'hilmirkarlsson/Telpurnar',live:'https://hilmirkarlsson.github.io/Telpurnar/',status:'active'},
  {name:'macrostracker',vault:'1-Projects/Health Project/Health Project.md',repo:'hilmirkarlsson/macrostracker',live:'https://hilmirkarlsson.github.io/macrostracker/',status:'active'},
  {name:'Dashboard',vault:'1-Projects/Dashboard/Dashboard.md',repo:'hilmirkarlsson/Dashboard',live:null,status:'active'},
  {name:'Book Tracker',vault:'1-Projects/Book Tracker/Book Tracker.md',repo:'hilmirkarlsson/Books',live:'https://hilmirkarlsson.github.io/Books/',status:'active'},
  {name:'Audiobookshelf',vault:'1-Projects/Audiobookshelf/Audiobookshelf.md',repo:'hilmirkarlsson/Audiobook-shelf',live:null,status:'paused'},
  {name:'Búðarkarfan',vault:'1-Projects/Búðarkarfan/Búðarkarfan.md',repo:'hilmirkarlsson/B-u-arkarfan',live:null,status:'complete'}
];
function loadProjectsTab() {
  const active=document.getElementById('proj-active');
  const inactive=document.getElementById('proj-inactive');
  active.innerHTML=''; inactive.innerHTML='';
  PROJECTS.forEach(p=>{
    const el=document.createElement('div');
    el.className='pc';
    el.innerHTML=`<div class="pc-head"><div class="pc-name">${p.name}</div><span class="pb ${p.status}">${p.status}</span></div>`+
      `<div class="pc-push" id="pp-${p.name.replace(/[^a-z]/gi,'')}" ><div class="skel skel-l" style="width:80%"></div></div>`+
      `<div class="pc-desc" id="pd-${p.name.replace(/[^a-z]/gi,'')}"><div class="skel skel-l"></div><div class="skel skel-l" style="width:70%"></div></div>`+
      `<ul class="pc-acts" id="pa-${p.name.replace(/[^a-z]/gi,'')}"></ul>`+
      `<div class="pc-foot">`+
      `<a href="https://github.com/${p.repo}" target="_blank" class="pl">Repo ↗</a>`+
      (p.live?`<a href="${p.live}" target="_blank" class="pl dk">Live ↗</a>`:'')+
      `</div>`;
    (p.status==='active'||p.status==='building' ? active : inactive).appendChild(el);
    loadProjectCard(p);
  });
}
async function loadProjectCard(p) {
  const key=p.name.replace(/[^a-z]/gi,'');
  try {
    const [md, ghRes] = await Promise.allSettled([
      fetchVault(p.vault),
      fetch('https://api.github.com/repos/'+p.repo+'/commits?per_page=1').then(r=>r.json())
    ]);
    if (md.status==='fulfilled') {
      const txt=md.value;
      // description: first non-empty paragraph after # heading, before next ##
      const bodyM=txt.match(/^# .+?\n+([\s\S]*?)(?=\n##|$)/m);
      let desc='';
      if(bodyM){
        const lines=bodyM[1].split('\n').filter(l=>l.trim()&&!l.startsWith('##')&&!l.startsWith('---'));
        desc=stripMd(lines[0]||'').slice(0,120);
      }
      const descEl=document.getElementById('pd-'+key);
      if(descEl) descEl.textContent=desc||'—';
      // next actions
      const acts=parseChecklist(parseSection(txt,'Next actions')).slice(0,3);
      const actsEl=document.getElementById('pa-'+key);
      if(actsEl) actsEl.innerHTML=acts.map(a=>`<li class="pc-act ${a.done?'done':''}"><span class="pc-dot ${a.done?'done':''}"></span><span>${a.text}</span></li>`).join('');
    }
    if (ghRes.status==='fulfilled'&&ghRes.value.length) {
      const c=ghRes.value[0];
      const date=new Date(c.commit.committer.date);
      const el=document.getElementById('pp-'+key);
      if(el) el.innerHTML=`Last push: <strong>${relTime(date)}</strong> — ${c.commit.message.split('\n')[0].slice(0,50)}`;
    }
  } catch{}
}

/* ── TRAVEL TAB ─────────────────────────────────────── */
function loadTravelTab() {
  const target=new Date('2026-08-03T00:00:00'),diff=target-new Date();
  document.getElementById('tv-days').textContent=Math.max(0,Math.floor(diff/86400000));
}

/* ── NOTES TAB ──────────────────────────────────────── */
function loadNotesTab() {
  const ds=new Date().toISOString().slice(0,10);
  document.getElementById('notes-dn-link').href='obsidian://open?vault=Vault&file=Daily+Notes%2F'+ds;
  renderObs2();
  fetchVault('Daily Notes/'+ds+'.md').then(md=>renderDailyNote(md,'notes-daily-content')).catch(()=>{
    document.getElementById('notes-daily-content').innerHTML=
      '<div class="ghost" style="margin-bottom:16px">No note for '+ds+' found</div>'+
      '<a href="obsidian://new?vault=Vault&file=Daily+Notes%2F'+ds+'" target="_blank" class="btn btn-dk">Create today\'s note in Obsidian</a>';
  });
  renderNotes2();
}
function renderDailyNote(md, targetId) {
  const SECTIONS=['Focus','Log','Projects','Health','End of day'];
  let html='';
  SECTIONS.forEach(name=>{
    const sec=parseSection(md,name); if(!sec) return;
    const lines=sec.split('\n').filter(l=>l.trim());
    html+=`<div class="dn-sec"><div class="dn-lbl">${name}</div>`;
    lines.forEach(l=>{
      if(/^- \[[ x]\]/.test(l)){
        const done=l.includes('[x]');
        html+=`<div class="dn-item ${done?'done':''}"><span class="dn-cb ${done?'done':''}"></span><span>${stripMd(l.replace(/^- \[[ x]\] /,''))}</span></div>`;
      } else if(/^- /.test(l)){
        const [k,...v]=l.replace(/^- /,'').split(':');
        if(v.length>0&&v.join(':').trim()) html+=`<div class="hrow" style="padding:5px 0;border-bottom:1px solid #f9fafb;"><span class="hlbl" style="font-size:12px;">${k.trim()}</span><span class="hval" style="font-size:13px;">${v.join(':').trim()}</span></div>`;
        else html+=`<div class="dn-txt" style="padding:3px 0;">${stripMd(l)}</div>`;
      } else if(l.trim()&&!l.startsWith('>')){
        html+=`<div class="dn-txt">${l.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')}</div>`;
      }
    });
    html+='</div>';
  });
  document.getElementById(targetId).innerHTML=html||'<div class="ghost">Note is empty</div>';
}
/* notes tab capture uses same storage as overview */
function sendInbox2(){
  const inp=document.getElementById('notes-cap-inp'),val=inp.value.trim(); if(!val) return;
  const time=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const notes=[{text:val,time},...loadNotes()].slice(0,6);
  saveNotes(notes); renderNotes2();
  window.open('obsidian://new?vault=Vault&file=0-Inbox%2FQuick-'+encodeURIComponent(new Date().toISOString().slice(0,16).replace(':','-'))+'&content='+encodeURIComponent(val),'_blank');
  inp.value='';
}
function renderNotes2(){
  const notes=loadNotes();
  const el=document.getElementById('notes-cap-list'); if(!el) return;
  el.innerHTML=notes.map(n=>`<div class="obs-note"><div class="obs-dot"></div>${n.text}<span class="obs-time">${n.time}</span></div>`).join('');
}
function renderObs2(){
  const el=document.getElementById('notes-obs-goals'); if(!el) return;
  el.innerHTML=gog().map(g=>`<div class="obs-fi"><div class="obs-fi-dot"></div><span class="obs-fi-txt">${g}</span></div>`).join('');
}

/* ── OBSIDIAN TAB ───────────────────────────────────── */
function loadObsidianTab() {
  const ds=new Date().toISOString().slice(0,10);
  const y=new Date(), wk=Math.ceil((((y-new Date(y.getFullYear(),0,1))/864e5)+new Date(y.getFullYear(),0,1).getDay()+1)/7);
  document.getElementById('obs-tab-today').href='obsidian://open?vault=Vault&file=Daily+Notes%2F'+ds;
  document.getElementById('obs-tab-new').href='obsidian://new?vault=Vault&file=Daily+Notes%2F'+ds;
  document.getElementById('obs-goals-link').href='obsidian://open?vault=Vault&file=2-Areas%2FGoals%2FWeekly%2F'+y.getFullYear()+'-W'+String(wk).padStart(2,'0');
  renderNotes3();
  // load recent daily notes
  fetch(API + '/api/vault-dir?dir=Daily+Notes').then(r=>r.json()).then(files=>{
    const notes=files.filter(f=>!f.isDir&&f.name.endsWith('.md')).map(f=>f.name).sort().reverse().slice(0,7);
    const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    document.getElementById('obs-tab-notes').innerHTML=notes.map(n=>{
      const dateStr=n.replace('.md','');
      const d=new Date(dateStr+'T12:00:00');
      const label=isNaN(d)?n:MN[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear();
      const badge=dateStr===ds?'today':dateStr===new Date(Date.now()-864e5).toISOString().slice(0,10)?'yesterday':'';
      return `<a href="obsidian://open?vault=Vault&file=Daily+Notes%2F${encodeURIComponent(n.replace('.md',''))}" target="_blank" class="obs-note-link">`+
        `📓 ${label}`+(badge?` <span style="background:#111827;color:#fff;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;">${badge}</span>`:'')+
        `<span class="obs-note-link-date">${n.replace('.md','')}</span></a>`;
    }).join('');
  }).catch(()=>{
    document.getElementById('obs-tab-notes').innerHTML='<div class="ghost">Start server.js to see vault notes</div>';
  });
}
function sendInbox3(){
  const inp=document.getElementById('obs-tab-inp'),val=inp.value.trim(); if(!val) return;
  const time=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const notes=[{text:val,time},...loadNotes()].slice(0,6);
  saveNotes(notes); renderNotes3();
  window.open('obsidian://new?vault=Vault&file=0-Inbox%2FQuick-'+encodeURIComponent(new Date().toISOString().slice(0,16).replace(':','-'))+'&content='+encodeURIComponent(val),'_blank');
  inp.value='';
}
function renderNotes3(){
  const notes=loadNotes();
  const el=document.getElementById('obs-tab-list'); if(!el) return;
  el.innerHTML=notes.map(n=>`<div class="obs-note"><div class="obs-dot"></div>${n.text}<span class="obs-time">${n.time}</span></div>`).join('');
}