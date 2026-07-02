'use strict';
const pad = n => String(n).padStart(2,'0');
const fmtHM = hours => hours==null ? '—' : (h=>Math.floor(h/60)+'h '+pad(h%60)+'m')(Math.round(hours*60));
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
  document.getElementById('obs-daily').href = 'obsidian://open?vault=Brain&file=Daily+Notes%2F'+ds;
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
  window.open('obsidian://new?vault=Brain&file=0-Inbox%2FQuick-'+encodeURIComponent(new Date().toISOString().slice(0,16).replace(':','-'))+'&content='+encodeURIComponent(val),'_blank');
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

    /* Health goals + baselines */
    const H_GOALS = { steps:12000, active:600, sleep:8 };
    let _health = null, _healthDays = [];

    function loadHealthTab() {
      const iframe = document.getElementById('macros-iframe');
      if (iframe && !iframe.src) iframe.src = 'https://hilmirkarlsson.github.io/macrostracker/';
      renderBodyControls();

      fetch(API + '/api/health-json').then(r=>r.json()).then(z=>{
        _health = z; logWeightSnapshot();
        try { localStorage.setItem('dash-zepp-data', JSON.stringify(z)); } catch(e){}
        renderHealthAll(z, _healthDays);
      }).catch(()=>{
        try { const z=JSON.parse(localStorage.getItem('dash-zepp-data')||'null'); if(z&&!isStaleZepp(z)){ _health=z; renderHealthAll(z, _healthDays); } } catch(e){}
      });
      fetch(API + '/api/health-history').then(r=>r.json()).then(d=>{
        _healthDays = d.days||[]; if(_health) renderHealthAll(_health, _healthDays);
      }).catch(()=>{});
      fetch(API + '/api/workout-json').then(r=>r.json()).then(d=>{ _workoutData=d; renderWorkouts(d,'all'); }).catch(()=>{
        document.getElementById('workout-list').innerHTML='<div style="padding:16px 20px;" class="ghost">No workout data yet</div>';
      });
      fetch(API + '/api/workout-history').then(r=>r.json()).then(d=>renderWorkoutHeatmap(d.workouts||[])).catch(()=>{});

      const ds = new Date().toISOString().slice(0,10);
      document.getElementById('h-dn-link').href = 'obsidian://open?vault=Brain&file=Daily+Notes%2F'+ds;
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

    /* ── SVG helpers ─────────────────────────────────────── */
    function svgRing(pct, color, size, stroke, center, sub) {
      pct = Math.max(0, Math.min(100, pct||0));
      const r=(size-stroke)/2, c=2*Math.PI*r, off=c*(1-pct/100), mid=size/2;
      const cText = center!=null ? '<text x="'+mid+'" y="'+(mid+(sub?0:1))+'" text-anchor="middle" dominant-baseline="central" font-size="'+(size*0.28)+'" font-weight="800" fill="#111827">'+center+'</text>' : '';
      const sText = sub ? '<text x="'+mid+'" y="'+(mid+size*0.19)+'" text-anchor="middle" font-size="'+(size*0.12)+'" font-weight="700" letter-spacing=".06em" fill="#9ca3af">'+sub+'</text>' : '';
      return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'">'
        +'<circle cx="'+mid+'" cy="'+mid+'" r="'+r+'" fill="none" stroke="#eef0f2" stroke-width="'+stroke+'"/>'
        +'<circle cx="'+mid+'" cy="'+mid+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+stroke+'" stroke-linecap="round" stroke-dasharray="'+c+'" stroke-dashoffset="'+off+'" transform="rotate(-90 '+mid+' '+mid+')"/>'
        +cText+sText+'</svg>';
    }
    function svgSpark(vals, color, w, h, fill) {
      vals = (vals||[]).filter(v=>v!=null);
      if (vals.length < 2) return '<div class="ghost" style="font-size:11px;">no trend yet</div>';
      const mn=Math.min(...vals), mx=Math.max(...vals), rng=(mx-mn)||1, pad=3;
      const pts = vals.map((v,i)=>{
        const x = pad + i*(w-2*pad)/(vals.length-1);
        const y = h-pad - (v-mn)/rng*(h-2*pad);
        return [x, y];
      });
      const line = pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
      const area = fill ? '<path d="'+line+' L'+pts[pts.length-1][0].toFixed(1)+' '+h+' L'+pts[0][0].toFixed(1)+' '+h+' Z" fill="'+color+'" opacity=".08"/>' : '';
      return '<svg width="100%" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'+area
        +'<path d="'+line+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    /* ── Master render ───────────────────────────────────── */
    function renderHealthAll(z, days) {
      renderSyncStatus(z);
      renderReadiness(z, days);
      renderRingCards(z, days);
      renderMiniRow(z, days);
      renderSleepQuality(z);
      renderRecovery(z, days);
      renderHeart(z);
      renderCalories(z);
      renderWeight(z, days);
      renderFlags(z, days);
    }

    function renderSyncStatus(z) {
      if (!z.synced) return;
      const mins = Math.round((Date.now()-new Date(z.synced))/60000);
      const stale = mins > 20;
      const el = document.getElementById('z-sync-status');
      el.textContent = stale ? '⚠ stale — synced '+mins+'m ago' : (mins < 1 ? 'synced just now' : 'synced '+mins+'m ago');
      el.style.color = stale ? '#dc2626' : '';
      el.style.fontWeight = stale ? '600' : '';
    }

    /* Averages over the last N history days, excluding today */
    function avgOf(days, key, n) {
      const today = new Date().toISOString().slice(0,10);
      const vals = (days||[]).filter(d=>d.date!==today).map(d=>d[key]).filter(v=>v!=null);
      const use = vals.slice(-(n||7));
      return use.length ? use.reduce((a,b)=>a+b,0)/use.length : null;
    }
    function seriesOf(days, key, n) {
      const today = new Date().toISOString().slice(0,10);
      return (days||[]).filter(d=>d.date!==today).map(d=>d[key]).filter(v=>v!=null).slice(-(n||14));
    }

    // Rolling sleep debt/surplus vs your own 14-day average (Oura calls
    // this "Sleep Balance"). Loss-averse on purpose: an hour under your
    // baseline costs more than an hour over it gains, so debt reads as
    // debt instead of averaging out against one long night. 80 at
    // delta=0 rather than 100, since the baseline itself may carry debt.
    //
    // Blended 50/50 with an absolute comparison against H_GOALS.sleep —
    // Oura's own docs describe Sleep Balance as "compared to your
    // baseline AND general recommendations," not baseline alone. Without
    // the absolute half, several short nights in a row drag your own
    // rolling average down with them, so "deviation from baseline"
    // shrinks toward zero even while you're in real debt — the metric
    // quietly forgives a multi-night spiral instead of catching it.
    // Rolling average of *effective* (awake-discounted) hours, so a
    // fragmented night doesn't get counted as a full one when it becomes
    // part of your own baseline later.
    function avgEffectiveSleep(days, n) {
      const today = new Date().toISOString().slice(0,10);
      const vals = (days||[]).filter(d=>d.date!==today && d.sleepHours!=null)
        .map(d=>effectiveSleepHours(d.sleepHours, d.sleepAwake)).slice(-(n||14));
      return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
    }

    function sleepBalanceScore(z, days) {
      if (z.sleepHours == null) return 70;
      const effToday = effectiveSleepHours(z.sleepHours, z.sleepAwake);
      const goalComp = Math.max(0, Math.min(100, effToday/H_GOALS.sleep*100));
      const base = avgEffectiveSleep(days, 14);
      if (base == null) return Math.round(0.5*sleepDurationCurve(effToday) + 0.5*goalComp);
      const delta = effToday - base;
      const pts = delta >= 0 ? Math.min(20, delta * 12) : delta * 22;
      const relComp = Math.max(0, Math.min(100, 80 + pts));
      return Math.round(0.5*relComp + 0.5*goalComp);
    }

    // HRV/RHR compared to your own rolling baseline (Whoop's approach),
    // not a fixed population constant.
    function hrvBalanceScore(z, days) {
      const base = avgOf(days, 'hrv', 14);
      if (z.hrv == null || base == null) return 70;
      return Math.max(0, Math.min(100, z.hrv / base * 80));
    }
    function rhrBalanceScore(z, days) {
      const base = avgOf(days, 'restingHR', 14);
      if (z.restingHR == null || base == null) return 70;
      return Math.max(0, Math.min(100, base / z.restingHR * 80));
    }

    function renderReadiness(z, days) {
      // Oura-shaped contributors (Previous Night, Sleep Balance, HRV
      // Balance, RHR Balance) with Whoop's rolling-personal-baseline
      // philosophy. Sleep still carries 65% combined weight rather than
      // Whoop's HRV-dominant split: HRV can read high the morning after a
      // short night (rebound/stress artifact), so it can't be trusted to
      // carry most of the score — that was exactly how a bad night used
      // to score "Ready". Previous Night specifically leans heaviest of
      // the four — sleep-debt research (two-process model) shows recent
      // sleep loss has disproportionately more impact on how you feel
      // today than sleep lost further back, and apps like RISE weight
      // last night above an equally-split rolling average for the same
      // reason.
      const prevNight = sleepScore(z);
      const sleepBal  = sleepBalanceScore(z, days);
      const hrvBal    = hrvBalanceScore(z, days);
      const rhrBal    = rhrBalanceScore(z, days);
      let score = Math.round(0.45*prevNight + 0.20*sleepBal + 0.20*hrvBal + 0.15*rhrBal);
      // HRV/RHR can read fine (or even elevated — a known rebound/stress
      // artifact) after several bad nights in a row, which would let them
      // rescue the score even though the sleep contributors both agree
      // there's a real trend, not just one off night. When last night AND
      // the rolling balance both confirm debt, cap the score so it can't
      // cross into "Fair" on the strength of cardio markers alone.
      //
      // debtBuilding also checks the raw rolling baseline against the
      // absolute goal, not just the blended sleepBal — awake-discounting
      // a fragmented baseline night (see effectiveSleepHours) pulls the
      // baseline itself down, which would otherwise make *today* look
      // like less of a deviation and quietly loosen this gate right when
      // it should be tightening it.
      const baselineHrs  = avgEffectiveSleep(days, 14);
      const debtBuilding = sleepBal < 65 || (baselineHrs != null && baselineHrs < H_GOALS.sleep*0.75);
      const roughNight   = prevNight < 50;
      if (roughNight && debtBuilding) score = Math.min(score, 45);
      const cls = score>=75?'good':score>=50?'fair':'low';
      const col = score>=75?'#16a34a':score>=50?'#d97706':'#dc2626';
      const label = score>=75?'Ready':score>=50?'Fair Recovery':'Low Recovery';
      document.getElementById('rdy-ring').innerHTML = svgRing(score, col, 92, 9, score, 'READY');
      const pill = document.getElementById('rdy-pill');
      pill.textContent = '● '+label; pill.className = 'rdy-pill '+cls;
      // Contextual insight — speaks to the trend (Sleep Balance), not just
      // last night, so one off-night against a healthy week reads
      // differently from genuine multi-night debt.
      let head='', sub='';
      if (roughNight && debtBuilding) {
        head = 'Sleep debt is building — last night ran short at '+fmtHM(z.sleepHours)+', on top of a shorter week.';
        sub  = 'Your recent nights are trending below your own average, so HRV ('+(z.hrv??'—')+'ms) and resting HR ('+(z.restingHR??'—')+'bpm) can only offset so much today — treat it as a lighter day and protect tonight.';
      } else if (roughNight) {
        head = 'Last night was short ('+fmtHM(z.sleepHours)+'), but your recent sleep trend still looks solid.';
        sub  = 'One off night against a healthy baseline — HRV ('+(z.hrv??'—')+'ms) and resting HR ('+(z.restingHR??'—')+'bpm) are holding up, so an earlier night tonight should reset you.';
      } else if (score>=75) {
        head = 'You\'re well recovered — good day to push.';
        sub  = 'Sleep balance, HRV and resting heart rate all sit in a healthy range against your own baseline. Green light for a harder session.';
      } else {
        head = 'Recovery is moderate today.';
        sub  = 'Nothing alarming, but keep intensity in check and protect tonight\'s sleep window.';
      }
      document.getElementById('rdy-headline').textContent = head;
      document.getElementById('rdy-sub').textContent = sub;
      document.getElementById('rdy-hrv').textContent = z.hrv ?? '—';
      document.getElementById('rdy-rhr').textContent = z.restingHR ?? '—';
      document.getElementById('rdy-slp').textContent = fmtHM(z.sleepHours);
    }

    function cumHourly(arr) {
      if (!arr) return null;
      let run=0; return arr.map(v=>run+=v);
    }

    function renderRingCards(z, days) {
      const $=id=>document.getElementById(id);
      // Steps
      const stepsPct = z.steps ? z.steps/H_GOALS.steps*100 : 0;
      $('ring-steps').innerHTML = svgRing(stepsPct, '#C16A41', 46, 6, Math.round(stepsPct)+'%');
      $('big-steps').textContent = z.steps ? z.steps.toLocaleString() : '—';
      $('big-steps-sub').textContent = z.steps>=H_GOALS.steps ? 'Goal smashed'+(z.distanceKm?' · '+z.distanceKm+' km':'') : (z.distanceKm?z.distanceKm+' km today':'today');
      $('spark-steps').innerHTML = svgSpark(cumHourly(z.intraday?.stepsHourly), '#C16A41', 200, 46, true);
      const stAvg = avgOf(days,'steps');
      $('big-steps-avg').textContent = stAvg ? '7-day avg '+(stAvg/1000).toFixed(1)+'k' : 'building history';
      $('big-steps-side').textContent = z.flightsClimbed!=null ? z.flightsClimbed+' flights' : '';
      // Sleep
      const sScore = sleepScore(z);
      $('ring-sleep').innerHTML = svgRing(sScore, '#7C8FA6', 46, 6, sScore||'—');
      $('big-sleep').textContent = fmtHM(z.sleepHours);
      const sBase = avgOf(days,'sleepHours');
      $('big-sleep-sub').textContent = sBase && z.sleepHours!=null ? (z.sleepHours<sBase?(sBase-z.sleepHours).toFixed(1)+'h below your baseline':(z.sleepHours-sBase).toFixed(1)+'h above baseline') : 'last night';
      renderSleepStages('sleep-stages', z);
      $('big-sleep-deep').textContent = z.sleepDeep!=null ? 'deep '+z.sleepDeep+'h' : '';
      $('big-sleep-core').textContent = z.sleepCore!=null ? 'core '+z.sleepCore+'h' : '';
      // Active
      const actPct = z.activeCal ? z.activeCal/H_GOALS.active*100 : 0;
      $('ring-active').innerHTML = svgRing(actPct, '#C99A3F', 46, 6, Math.round(actPct)+'%');
      $('big-active').textContent = z.activeCal ? z.activeCal.toLocaleString() : '—';
      $('big-active-sub').textContent = Math.round(actPct)+'% of '+H_GOALS.active+' goal';
      $('spark-active').innerHTML = svgSpark(cumHourly(z.intraday?.activeHourly), '#C99A3F', 200, 46, true);
      const acAvg = avgOf(days,'activeCal');
      $('big-active-avg').textContent = acAvg ? '7-day avg '+Math.round(acAvg) : 'building history';
      $('big-active-side').textContent = z.basalCal ? 'basal '+z.basalCal.toLocaleString() : '';
    }

    function renderSleepStages(id, z) {
      const el = document.getElementById(id); if (!el) return;
      const segs = [['#3b4a63',z.sleepDeep],['#7C8FA6',z.sleepREM],['#A9BACB',z.sleepCore],['#e5e7eb',z.sleepAwake]];
      const total = segs.reduce((s,x)=>s+(x[1]||0),0)||1;
      el.innerHTML = segs.map(x=>x[1]?'<span style="background:'+x[0]+';width:'+(x[1]/total*100)+'%"></span>':'').join('');
    }

    // Awake time embedded inside a sleep session is real signal a plain
    // "total hours" figure hides — 2 hours up in the middle of the night
    // (e.g. an airport run) still lands on a healthy-looking total if the
    // bouts before/after add up fine. Discount duration by how much of
    // the session was actually spent awake before treating it as sleep.
    function effectiveSleepHours(hours, awake) {
      if (hours == null) return null;
      const total = hours + (awake || 0);
      return total ? hours * (hours / total) : hours;
    }

    // Duration adequacy, but as a gate rather than a plain ratio: under 4h
    // bottoms out at 0 (no partial credit — HRV/RHR are the only way up
    // from there), 4-6h only earns up to 25/100, and 6-8h ramps the rest
    // of the way. Matches sleep-debt research (Whoop "sleep performance",
    // Oura sleep balance) treating short nights as a hard ceiling, not
    // something recovery markers can average away.
    function sleepDurationCurve(h) {
      if (h <= 4) return 0;
      if (h <= 6) return (h - 4) / 2 * 25;
      if (h <= 8) return 25 + (h - 6) / 2 * 75;
      return 100;
    }

    function sleepScore(z) {
      if (z.sleepHours==null) return 0;
      const durCurve = sleepDurationCurve(effectiveSleepHours(z.sleepHours, z.sleepAwake));
      const deepRatio = z.sleepHours ? (z.sleepDeep||0)/z.sleepHours : 0;
      const remRatio  = z.sleepHours ? (z.sleepREM ||0)/z.sleepHours : 0;
      const deepEff = Math.min(1, deepRatio/0.20);   // ~20% deep is the sleep-science target
      const remEff  = Math.min(1, remRatio/0.225);   // ~20-25% REM target (midpoint 22.5%)
      // Deep/REM quality scales the duration score by 80-100% — a short
      // night can't be rescued by good staging, but poor staging can
      // still dock a long one.
      const qualityMult = 0.8 + 0.2*((deepEff+remEff)/2);
      return Math.round(durCurve * qualityMult);
    }

    function chipDelta(id, delta, unit, invert) {
      const el = document.getElementById(id); if (!el) return;
      if (delta==null || !isFinite(delta)) { el.textContent=''; el.className='chip'; return; }
      const r = Math.round(delta*10)/10;
      const good = invert ? r<0 : r>0;
      el.className = 'chip '+(r===0?'':(good?'up':'down'));
      el.textContent = (r>0?'▲ ':(r<0?'▼ ':'· '))+Math.abs(r)+(unit||'');
    }

    function renderMiniRow(z, days) {
      const $=id=>document.getElementById(id);
      // Resting HR — lower is better
      $('mini-rhr').textContent = z.restingHR ?? '—';
      const rhrAvg = avgOf(days,'restingHR',14);
      chipDelta('chip-rhr', z.restingHR!=null&&rhrAvg!=null?z.restingHR-rhrAvg:null, '', true);
      $('sub-rhr').textContent = rhrAvg ? 'vs 14-day avg '+Math.round(rhrAvg) : 'building history';
      $('spark-rhr').innerHTML = svgSpark(seriesOf(days,'restingHR'), '#A86B6B', 56, 22, false);
      // HRV — higher is better
      $('mini-hrv').textContent = z.hrv ?? '—';
      const hrvAvg = avgOf(days,'hrv',14);
      chipDelta('chip-hrv', z.hrv!=null&&hrvAvg!=null?z.hrv-hrvAvg:null, '', false);
      $('sub-hrv').textContent = hrvAvg ? 'vs baseline '+Math.round(hrvAvg)+'ms' : 'building history';
      $('spark-hrv').innerHTML = svgSpark(seriesOf(days,'hrv'), '#C99A3F', 56, 22, false);
      // SpO2
      $('mini-spo2').textContent = z.spo2 ?? '—';
      $('sub-spo2').textContent = z.spo2 ? 'blood oxygen' : 'wear overnight to capture';
      $('spark-spo2').innerHTML = '';
      // Resp
      $('mini-resp').textContent = z.respiratoryRate ?? '—';
      $('sub-resp').textContent = 'breaths per minute';
      $('spark-resp').innerHTML = '';
    }

    function renderSleepQuality(z) {
      const score = sleepScore(z);
      const rating = score>=75?'Good':score>=50?'Fair':'Poor';
      document.getElementById('sleep-score-chip').textContent = rating+' · '+score;
      document.getElementById('sleep-score-chip').className = 'chip '+(score>=75?'up':score>=50?'warn':'down');
      document.getElementById('sleep-donut').innerHTML = svgRing(score, '#7C8FA6', 112, 11, score, '/ 100');
      const total = z.sleepHours||0;
      const stages = [['Deep',z.sleepDeep,'#3b4a63'],['REM',z.sleepREM,'#7C8FA6'],['Core',z.sleepCore,'#A9BACB'],['Awake',z.sleepAwake,'#d1d5db']];
      document.getElementById('sleep-bars').innerHTML = stages.filter(s=>s[1]!=null).map(s=>{
        const pct = total?Math.round(s[1]/total*100):0;
        return '<div class="sqbar-row"><span class="sqbar-name">'+s[0]+'</span>'
          +'<span class="sqbar"><span class="sqbar-fill" style="background:'+s[2]+';width:'+pct+'%"></span></span>'
          +'<span class="sqbar-val">'+s[1]+'h · '+pct+'%</span></div>';
      }).join('') || '<div class="ghost">No sleep data</div>';
      const fmtT = s => { if(!s) return '—'; return new Date(s.replace(' +0000','+00:00')).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); };
      let note = z.sleepStart? 'In bed '+fmtT(z.sleepStart)+' – '+fmtT(z.sleepEnd)+'.' : '';
      if (z.sleepHours!=null && z.sleepHours<H_GOALS.sleep-1) note += ' Total time was well below target — protect tonight\'s window.';
      document.getElementById('sleep-note').textContent = note;
    }

    function renderRecovery(z, days) {
      const rows = [];
      const hrvBase = avgOf(days,'hrv')||80;
      const rhrBase = avgOf(days,'restingHR')||58;
      const add=(name,pct,tag,col)=>rows.push({name,pct:Math.max(6,Math.min(100,pct)),tag,col});
      if (z.hrv!=null) add('HRV', z.hrv/hrvBase*80, z.hrv>=hrvBase?'Strong':'Below', z.hrv>=hrvBase?'#C99A3F':'#d97706');
      if (z.restingHR!=null) add('Resting HR', 100-(z.restingHR-50)*3, z.restingHR<=rhrBase?'Good':'Elevated', z.restingHR<=rhrBase?'#A86B6B':'#dc2626');
      if (z.sleepHours!=null) add('Sleep', z.sleepHours/H_GOALS.sleep*100, z.sleepHours>=7?'Strong':z.sleepHours>=6?'Fair':'Low', z.sleepHours>=7?'#5E7E63':z.sleepHours>=6?'#d97706':'#dc2626');
      document.getElementById('recovery-bars').innerHTML = rows.map(r=>
        '<div class="rec-row"><div class="rec-top"><span class="rec-name">'+r.name+'</span><span class="rec-tag" style="color:'+r.col+'">'+r.tag+'</span></div>'
        +'<div class="rec-bar"><span class="rec-bar-fill" style="background:'+r.col+';width:'+r.pct+'%"></span></div></div>'
      ).join('') || '<div class="ghost">No recovery data</div>';
      const low = rows.slice().sort((a,b)=>a.pct-b.pct)[0];
      const sc = document.getElementById('rec-summary');
      if (low) sc.textContent = low.name+' is the main thing holding you back today.';
      else sc.textContent = '';
    }

    function renderHeart(z) {
      const $=id=>document.getElementById(id);
      $('heart-spark').innerHTML = svgSpark(z.intraday?.hrSeries, '#A86B6B', 300, 66, true);
      $('ht-avg').textContent  = z.avgHR ? z.avgHR+' bpm' : '—';
      $('ht-min').textContent  = z.minHR ? z.minHR+' bpm' : '—';
      $('ht-max').textContent  = z.maxHR ? z.maxHR+' bpm' : '—';
      $('ht-rest').textContent = z.restingHR ? z.restingHR+' bpm' : '—';
    }

    function renderCalories(z) {
      const $=id=>document.getElementById(id);
      const burned = (z.activeCal||0)+(z.basalCal||0);
      const intake = getIntake();
      const maxV = Math.max(burned, intake, 1);
      $('cal-burned').textContent = burned?burned.toLocaleString():'—';
      $('cal-burned-bar').style.width = burned/maxV*100+'%';
      $('cal-burned-meta').textContent = (z.activeCal?'Active '+z.activeCal.toLocaleString():'')+(z.basalCal?' · Basal '+z.basalCal.toLocaleString():'');
      $('cal-intake').textContent = intake?intake.toLocaleString():'—';
      $('cal-intake-bar').style.width = (intake/maxV*100)+'%';
      $('cal-intake-meta').textContent = intake?'logged in Macros':'log intake in Macros ↓';
      const net = intake-burned;
      const chip = document.getElementById('cal-net-chip');
      if (intake && burned) {
        $('cal-net').textContent = (net>0?'+':'')+net.toLocaleString()+' kcal';
        $('cal-net').style.color = net<0?'#16a34a':'#dc2626';
        chip.textContent = net<0?Math.abs(net)+' deficit':net+' surplus';
        chip.className = 'chip '+(net<0?'up':'warn');
      } else { $('cal-net').textContent='—'; chip.textContent='no intake yet'; chip.className='chip'; }
    }
    function getIntake() {
      // Pull today's calories from macrostracker if it shares localStorage; else 0.
      try {
        const keys = ['macros-today','mt-today','macrostracker-log'];
        for (const k of keys) { const v=localStorage.getItem(k); if(v){ const d=JSON.parse(v); if(d && (d.calories||d.kcal)) return Math.round(d.calories||d.kcal); } }
      } catch(e){}
      return 0;
    }

    /* Weight: manual entry, snapshotted daily for a real trend line */
    function getWeightLog(){ try{return JSON.parse(localStorage.getItem('dash-weight-log'))||{};}catch{return {};} }
    function saveWeightLog(o){ try{localStorage.setItem('dash-weight-log',JSON.stringify(o));}catch{} }
    function logWeightSnapshot(){
      const h=gh(); const wt=parseFloat(h.wt); if(!wt) return;
      const log=getWeightLog(); const today=new Date().toISOString().slice(0,10);
      if(log[today]!==wt){ log[today]=wt; saveWeightLog(log); }
    }
    function renderWeight(z, days) {
      const $=id=>document.getElementById(id);
      const h=gh(); const wt=parseFloat(h.wt)||84;
      $('wt-val').textContent = wt.toFixed(1);
      const log=getWeightLog();
      const series=Object.keys(log).sort().map(k=>log[k]);
      $('wt-trend').innerHTML = series.length>=2 ? svgSpark(series,'#2563eb',260,52,false) : '<div class="ghost" style="font-size:11px;">trend builds as you log weight</div>';
      const start=series.length?series[0]:wt, target=80;
      const pct=Math.round(Math.max(0,Math.min(100,(start-wt)/(start-target)*100)));
      $('wt-bar').style.width=pct+'%';
      $('wt-meta').textContent = wt<=target ? 'Target reached 🎉' : pct+'% of the way · target '+target+' kg';
      const chip=document.getElementById('wt-chip');
      if(series.length>=2){ const d=wt-series[0]; chip.textContent=(d>0?'▲ ':'▼ ')+Math.abs(d).toFixed(1)+' kg'; chip.className='chip '+(d<0?'up':'down'); }
      else { chip.textContent='start '+start+' kg'; chip.className='chip'; }
    }

    function renderBodyControls() {
      const h=gh();
      const gym=document.getElementById('h-gym2');
      if(gym){ gym.textContent=h.gym?'✓ done':'tap to log'; gym.style.color=h.gym?'#16a34a':'#9ca3af'; }
      document.querySelectorAll('#panel-health .nb').forEach(b=>b.classList.toggle('sel', b.classList.contains(h.nutr||'')));
    }

    function renderWorkoutHeatmap(workouts) {
      const el=document.getElementById('wk-heat'); if(!el) return;
      const colOf = n => /soccer|fótbolt|football/i.test(n)?'#5E7E63':/run|hlaup|walk|göngu/i.test(n)?'#C99A3F':/rest/i.test(n)?'#e5e7eb':'#C16A41';
      // Build 5-week grid ending this week (Mon-Sun)
      const today=new Date(); const day=(today.getDay()+6)%7; // 0=Mon
      const monday=new Date(today); monday.setDate(today.getDate()-day-28);
      const byDate={};
      workouts.forEach(w=>{ if(!w.start)return; const d=w.start.slice(0,10); (byDate[d]=byDate[d]||[]).push(w); });
      let total=0;
      let grid='<div class="wk-grid"><span></span>'+['M','T','W','T','F','S','S'].map(d=>'<span class="wk-collbl">'+d+'</span>').join('');
      for(let wk=0;wk<5;wk++){
        grid+='<span class="wk-rowlbl">'+(wk===4?'Now':'W'+(wk+1))+'</span>';
        for(let dd=0;dd<7;dd++){
          const cur=new Date(monday); cur.setDate(monday.getDate()+wk*7+dd);
          const ds=cur.toISOString().slice(0,10);
          const ws=byDate[ds];
          const future=cur>today;
          const isToday=ds===today.toISOString().slice(0,10);
          if(ws&&ws.length){ total++; grid+='<div class="wk-cell" style="background:'+colOf(ws[0].name)+'" title="'+ds+' · '+ws.map(w=>w.name).join(', ')+'"></div>'; }
          else grid+='<div class="wk-cell"'+(isToday?' style="box-shadow:inset 0 0 0 2px #C16A41;background:#fff"':future?' style="background:#f7f8f9"':'')+'></div>';
        }
      }
      grid+='</div>';
      const perWk=(total/5).toFixed(1);
      el.innerHTML=grid+'<div class="wk-summary"><div><div class="lbl">sessions</div><div class="big">'+total+'</div></div><div style="margin-top:14px;"><div class="lbl">per week</div><div class="big" style="color:#C16A41;">'+perWk+'</div></div></div>';
      document.getElementById('wk-legend').innerHTML=['#C16A41 Gym','#5E7E63 Soccer','#C99A3F Run','#e5e7eb Rest'].map(x=>{const[c,n]=x.split(' ');return '<span><span class="dot" style="background:'+c+'"></span>'+n+'</span>';}).join('');
    }

    function renderFlags(z, days) {
      const flags=[];
      if(z.sleepHours!=null && z.sleepHours<6) flags.push(['#dc2626','Short sleep',z.sleepHours.toFixed(1)+'h vs '+H_GOALS.sleep+'h target']);
      const sAvg=avgOf(days,'sleepHours');
      if(sAvg!=null && sAvg<7) flags.push(['#d97706','Sleep debt building','7-day avg '+sAvg.toFixed(1)+'h']);
      const hrvBase=avgOf(days,'hrv');
      if(z.hrv!=null && hrvBase!=null && z.hrv>hrvBase*1.05) flags.push(['#16a34a','HRV above baseline',z.hrv+'ms vs '+Math.round(hrvBase)+' · good recovery signal']);
      if(z.restingHR!=null && rhrElevated(z,days)) flags.push(['#d97706','Resting HR elevated',z.restingHR+'bpm above your usual']);
      const el=document.getElementById('flags-list');
      el.innerHTML = flags.length ? flags.map(f=>'<div class="flag"><span class="flag-dot" style="background:'+f[0]+'"></span><div><div class="flag-name">'+f[1]+'</div><div class="flag-sub">'+f[2]+'</div></div></div>').join('') : '<div class="ghost">All clear — nothing flagged today.</div>';
    }
    function rhrElevated(z,days){ const a=avgOf(days,'restingHR'); return a!=null && z.restingHR>a+4; }

    function editWtH() { const h=gh(); const v=prompt('Weight (kg):',h.wt||'84'); if(v!==null&&v.trim()){h.wt=v.trim();sh(h);renderH();logWeightSnapshot();loadHealthTab();} }
    function togGym2() { const h=gh(); h.gym=!h.gym; sh(h); renderH(); renderBodyControls(); }
    function setN2(v) { setN(v); renderBodyControls(); }

    function isStaleZepp(z) {
      // Cached data from a previous day is stale once past 00:00 — the
      // daily stats (steps, calories, etc.) should reset, not persist.
      if (!z.synced) return false;
      return z.synced.slice(0,10) !== new Date().toISOString().slice(0,10);
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
        _health = data;
        renderHealthAll(data, _healthDays);
        localStorage.setItem('dash-zepp-data', JSON.stringify(data));
        fetch(API + '/api/health-history').then(r=>r.json()).then(d=>{ _healthDays=d.days||[]; renderHealthAll(data,_healthDays); }).catch(()=>{});
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

/* ── FINANCE TAB — live from spreadsheet (/api/finance-json) ───────────
   Data is parsed server-side from "Hilmir Finance vN.xlsx" in the vault and
   fetched here as JSON; charts are rendered with Chart.js. */
let _finData=null, _finRendered=false;
const finCharts={};

function loadFinanceTab(){
  wireFinSubnav();
  if(_finData){ if(!_finRendered) finRenderAll(); return; }
  fetch(API+'/api/finance-json').then(r=>{if(!r.ok)throw new Error('no data');return r.json();})
    .then(d=>{ _finData=d; document.getElementById('fin-source').textContent=d.source||'spreadsheet';
      document.getElementById('fin-loading').style.display='none';
      document.getElementById('fin-views').style.display='block';
      finRenderAll(); })
    .catch(()=>{ document.getElementById('fin-loading').innerHTML='<span class="ghost">Couldn\'t load finance data. Make sure the server is running and the workbook is shared.</span>'; });
}

function wireFinSubnav(){
  const nav=document.getElementById('fin-tabs');
  if(!nav||nav._wired)return; nav._wired=true;
  nav.addEventListener('click',e=>{
    const b=e.target.closest('button[data-fv]'); if(!b)return;
    nav.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));
    document.querySelectorAll('#fin-views .fv').forEach(v=>v.classList.toggle('active',v.id==='fv-'+b.dataset.fv));
  });
}

const finFmt=n=>{ if(n===null||n===undefined)return '—'; if(typeof n!=='number')return n;
  return Math.round(n).toLocaleString('is-IS').replace(/,/g,'.')+' kr.'; };
const finPlain=n=>{ if(n===null||n===undefined)return '—'; return Math.round(n).toLocaleString('is-IS').replace(/,/g,'.'); };
const FIN_EMOJI=/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}️‍]/gu;
const finStrip=s=>(s||'').replace(FIN_EMOJI,'').replace(/\s+/g,' ').trim();
function finChipTone(raw){ const l=finStrip(raw).toLowerCase();
  if(/^high$/.test(l))return 'neg'; if(/^med(ium)?$/.test(l))return 'warn'; if(/^low$/.test(l))return 'neutral';
  if(/regularly over|duplicate|impulse/.test(l))return 'neg'; if(/over budget/.test(l))return 'warn';
  if(/on track|smart/.test(l))return 'pos'; if(/start now|automate/.test(l))return 'accent'; return 'neutral'; }
const finChip=raw=>`<span class="chip chip-${finChipTone(raw)}">${finStrip(raw)}</span>`;
const FIN_PALETTE=['#2563eb','#16a34a','#C99A3F','#C16A41','#0e9488','#8b6fd6','#64748b','#0284c7','#65a30d','#b45309','#94a3b8','#9333ea','#475569'];
const FIN_GRID='rgba(15,15,15,.06)';
function finDraw(id,config){ const el=document.getElementById(id); if(!el||typeof Chart==='undefined')return;
  if(finCharts[id])finCharts[id].destroy();
  Chart.defaults.color='#6b7280'; Chart.defaults.font.family="'Plus Jakarta Sans',sans-serif";
  finCharts[id]=new Chart(el.getContext('2d'),config); }

function finRenderAll(){
  const D=_finData; if(!D)return;
  finOverview(D); finTrends(D); finCategories(D); finTransactions(D);
  finSubscriptions(D); finNetWorth(D); finTravel(D); finPlan(D); finInsights(D); finInvest(D);
  _finRendered=true;
}

function finOverview(D){
  document.getElementById('ovStats').innerHTML=D.overview.map(s=>`
    <div class="stat"><div class="label">${s.label}</div><div class="value">${s.value}</div><div class="sub">${s.sub}</div></div>`).join('');
  const last4=D.monthlyTrend.slice(-4), cur=last4[last4.length-1];
  document.getElementById('ieSummary').innerHTML=`<strong>${cur.month}:</strong> Income ${finFmt(cur.income)} · Spending ${finFmt(cur.spending)} · Net <span style="color:${cur.net>=0?'#16a34a':'#dc2626'}">${finFmt(cur.net)}</span>`;
  finDraw('incomeExpenseChart',{type:'bar',data:{labels:last4.map(m=>m.month),datasets:[
    {label:'Income',data:last4.map(m=>m.income),backgroundColor:'#2563eb',borderRadius:4},
    {label:'Spending',data:last4.map(m=>m.spending),backgroundColor:'#C16A41',borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,scales:{x:{grid:{display:false}},y:{grid:{color:FIN_GRID},ticks:{callback:v=>finPlain(v)}}},plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:11.5}}}}}});
  const rate=D.overview.find(o=>/savings rate/i.test(o.label));
  if(rate){document.getElementById('savingsRateBig').textContent=rate.value;document.getElementById('savingsRateSub').textContent=rate.sub;}
  const paid=D.monthlyTrend.filter(m=>m.income>0).slice(-10);
  finDraw('savingsRateSpark',{type:'line',data:{labels:paid.map(m=>m.month),datasets:[{data:paid.map(m=>m.net/m.income*100),borderColor:'#2563eb',backgroundColor:'rgba(37,99,235,.08)',tension:.35,fill:true,pointRadius:0,borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,scales:{x:{display:false},y:{display:false}},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>Math.round(c.parsed.y)+'%'}}}}});
  const cats=D.monthly2026Category.filter(c=>c.category!=='TOTAL SPENDING').slice().sort((a,b)=>b.total-a.total).slice(0,6);
  const mx=Math.max(...cats.map(c=>c.total));
  document.getElementById('topCategoryBars').innerHTML=cats.map((c,i)=>`
    <div class="cat-bar-row"><div class="cat-bar-top"><span class="name">${c.category}</span><span class="amt">${finFmt(c.total)}</span></div>
    <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${(c.total/mx*100).toFixed(1)}%;background:${FIN_PALETTE[i%FIN_PALETTE.length]}"></div></div></div>`).join('');
  const bh=D.netWorth.balanceHistory, change=(bh[bh.length-1].balance-bh[0].balance)/bh[0].balance*100;
  const pill=document.getElementById('growthChangeLabel');
  pill.textContent=(change>=0?'+':'')+change.toFixed(1)+'% since '+bh[0].period; pill.classList.toggle('neg',change<0);
  finDraw('growthChart',{type:'line',data:{labels:bh.map(b=>b.period),datasets:[{data:bh.map(b=>b.balance),borderColor:'#16a34a',backgroundColor:'rgba(22,163,74,.08)',tension:.3,fill:true,pointRadius:2}]},
    options:{responsive:true,maintainAspectRatio:false,scales:{x:{grid:{display:false}},y:{grid:{color:FIN_GRID},ticks:{callback:v=>finPlain(v)}}},plugins:{legend:{display:false}}}});
  const fr=D.netWorth.breakdown.find(b=>/Framt/i.test(b.account));
  document.getElementById('growthFootnote').textContent=`Auður savings only — the account with a full historical series.${fr?' Framtíðarreikningur ('+finFmt(fr.value)+') is a current snapshot with no timeline in the report.':''} Combined net worth today: ${finFmt(D.netWorth.total)}.`;
}

function finTrends(D){
  finDraw('trendChart',{type:'bar',data:{labels:D.monthlyTrend.map(m=>m.month),datasets:[
    {label:'Income',data:D.monthlyTrend.map(m=>m.income),backgroundColor:'#2563eb'},
    {label:'Spending',data:D.monthlyTrend.map(m=>-m.spending),backgroundColor:'#C16A41'},
    {label:'Net',type:'line',data:D.monthlyTrend.map(m=>m.net),borderColor:'#16a34a',backgroundColor:'#16a34a',tension:.3,pointRadius:0}]},
    options:{responsive:true,maintainAspectRatio:false,scales:{x:{grid:{display:false}},y:{grid:{color:FIN_GRID},ticks:{callback:v=>finPlain(v)}}},plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:11.5}}}}}});
  document.getElementById('trendTableBody').innerHTML=D.monthlyTrend.map(m=>`
    <tr><td>${m.month}</td><td class="amt pos">${finFmt(m.income)}</td><td class="amt neg">${finFmt(m.spending)}</td><td class="amt ${m.net>=0?'pos':'neg'}">${finFmt(m.net)}</td></tr>`).join('');
}

function finCategories(D){
  const rows=D.yearlyCategory.filter(c=>c.category!=='TOTAL');
  finDraw('yearlyCatChart',{type:'bar',data:{labels:rows.map(c=>c.category),datasets:[
    {label:'2024',data:rows.map(c=>c.y2024),backgroundColor:'#2563eb'},
    {label:'2025',data:rows.map(c=>c.y2025),backgroundColor:'#0e9488'},
    {label:'2026 (annualised)',data:rows.map(c=>c.y2026ann),backgroundColor:'#C99A3F'}]},
    options:{responsive:true,maintainAspectRatio:false,scales:{x:{grid:{display:false},ticks:{font:{size:10}}},y:{grid:{color:FIN_GRID},ticks:{callback:v=>finPlain(v)}}},plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:11.5}}}}}});
  document.getElementById('yearlyCatTableBody').innerHTML=D.yearlyCategory.map(c=>`
    <tr${c.category==='TOTAL'?' style="font-weight:700;background:#f7f8f9"':''}><td>${c.category}</td><td class="amt">${finFmt(c.y2024)}</td><td class="amt">${finFmt(c.y2025)}</td><td class="amt">${finFmt(c.y2026h1)}</td><td class="amt">${finFmt(c.y2026ann)}</td></tr>`).join('');
  document.getElementById('monthly2026TableBody').innerHTML=D.monthly2026Category.map(c=>`
    <tr${/TOTAL/.test(c.category)?' style="font-weight:700;background:#f7f8f9"':''}><td>${c.category}</td><td class="amt">${finFmt(c.jan)}</td><td class="amt">${finFmt(c.feb)}</td><td class="amt">${finFmt(c.mar)}</td><td class="amt">${finFmt(c.apr)}</td><td class="amt">${finFmt(c.may)}</td><td class="amt">${finFmt(c.jun)}</td><td class="amt">${finFmt(c.total)}</td><td class="amt">${finFmt(c.avgMo)}</td></tr>`).join('');
}

function finTransactions(D){
  document.getElementById('keyTxTableBody').innerHTML=D.keyTransactions.map(t=>`
    <tr><td style="white-space:nowrap">${t.date}</td><td>${t.merchant}</td><td class="amt">${t.amount===null?'—':finFmt(t.amount)}</td><td><span class="chip chip-neutral">${t.category}</span></td><td>${finChip(t.flag)}</td><td class="muted" style="font-size:12.5px">${finStrip(t.insight)}</td></tr>`).join('');
}

function finSubscriptions(D){
  const s=D.subscriptions;
  document.getElementById('subsTableBody').innerHTML=s.items.map(i=>`
    <tr style="${i.active?'':'opacity:.55'}"><td>${i.active?'<span class="chip chip-pos">Active</span>':'<span class="chip chip-neg">Cancelled</span>'}</td>
    <td><strong style="${i.active?'':'text-decoration:line-through'}">${i.service}</strong><br><span class="muted" style="font-size:11.5px">${i.domain}</span></td>
    <td>${i.billing}</td><td class="amt">${finFmt(i.monthly)}</td><td class="amt">${finFmt(i.annual)}</td><td class="muted" style="font-size:12.5px">${finStrip(i.notes)}</td></tr>`).join('');
  document.getElementById('subsActiveMonthly').textContent=finFmt(s.currentActiveMonthly);
  document.getElementById('subsActiveAnnual').textContent=finFmt(s.currentActiveAnnual);
  document.getElementById('subsTotalMonthly').textContent=finFmt(s.totalMonthly);
  document.getElementById('subsTotalAnnual').textContent=finFmt(s.totalAnnual);
  document.getElementById('savingsTableBody').innerHTML=s.savingsOpportunities.map(i=>`
    <tr><td><strong>${i.cut}</strong></td><td class="muted" style="font-size:12.5px">${i.reason}</td><td class="amt pos">${finFmt(i.monthlySave)}</td><td class="amt pos">${finFmt(i.annualSave)}</td></tr>`).join('');
  document.getElementById('savingsTotalMonthly').textContent=finFmt(s.totalPotentialSavingsMonthly);
  document.getElementById('savingsTotalAnnual').textContent=finFmt(s.totalPotentialSavingsAnnual);
}

function finNetWorth(D){
  const nw=D.netWorth;
  finDraw('balanceChart',{type:'line',data:{labels:nw.balanceHistory.map(b=>b.period),datasets:[{data:nw.balanceHistory.map(b=>b.balance),borderColor:'#2563eb',backgroundColor:'rgba(37,99,235,.08)',tension:.3,fill:true,pointRadius:2}]},
    options:{responsive:true,maintainAspectRatio:false,scales:{x:{grid:{display:false}},y:{grid:{color:FIN_GRID},ticks:{callback:v=>finPlain(v)}}},plugins:{legend:{display:false}}}});
  document.getElementById('balanceTableBody').innerHTML=nw.balanceHistory.map(b=>`
    <tr><td>${b.period}</td><td class="amt">${finFmt(b.balance)}</td><td class="amt pos">${finFmt(b.interest)}</td><td class="muted" style="font-size:12.5px">${b.notes}</td></tr>`).join('');
  finDraw('netWorthChart',{type:'doughnut',data:{labels:nw.breakdown.map(a=>a.account),datasets:[{data:nw.breakdown.map(a=>a.value),backgroundColor:FIN_PALETTE,borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:11}}}}}});
  document.getElementById('netWorthList').innerHTML=nw.breakdown.map((a,i)=>`
    <li><div class="rank-name"><span class="idx">${i+1}</span><span class="txt">${a.account}<br><span class="muted" style="font-size:11.5px">${a.notes||''}</span></span></div><div class="rank-val">${finFmt(a.value)}</div></li>`).join('');
  document.getElementById('netWorthTotal').textContent=finFmt(nw.total);
}

function finTravel(D){
  document.getElementById('tripsContainer').innerHTML=D.travel.trips.map(t=>`
    <div class="trip-card"><div class="top"><div><h4>${t.name}</h4><div class="period">${t.period}</div></div><div class="total">${finFmt(t.total)}</div></div>
    <div class="trip-items">${t.items.map(i=>`<div class="trip-line"><div class="name">${i.name}</div><div class="amt">${finFmt(i.amount)}</div><div class="detail">${i.detail||''}${i.notes?' · '+i.notes:''}</div></div>`).join('')}</div></div>`).join('');
}

function finPlan(D){
  document.getElementById('planBasis').textContent=finStrip(D.budgetPlan.basis);
  document.getElementById('planGroups').innerHTML=D.budgetPlan.groups.map(g=>`
    <div class="group-title">${finStrip(g.title)}</div>
    ${g.items.map(i=>`<div class="plan-item"><div class="top"><span class="title" style="font-weight:600">${i.item}</span><span class="amt" style="font-weight:700">${finFmt(i.budget)}</span></div>
    <div class="detail" style="color:#6b7280;font-size:13px;margin:6px 0">${i.notes||''}</div><div class="meta">${finChip(i.status)}</div></div>`).join('')}`).join('');
}

function finInsights(D){
  document.getElementById('overallGrade').textContent=D.budgetScore.grade;
  document.getElementById('overallSummary').textContent=D.budgetScore.summary;
  document.getElementById('scoreCategories').innerHTML=D.budgetScore.categories.map(c=>`
    <div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:4px">
    <span><strong>${c.category}</strong> <span class="chip chip-neutral" style="margin-left:6px">${c.grade}</span></span><span class="muted">${c.score}/100</span></div>
    <div class="score-bar-track"><div class="score-bar-fill" style="width:${c.score}%"></div></div>
    <div class="muted" style="font-size:12.5px;margin-top:4px">${c.assessment}</div></div>`).join('');
  document.getElementById('recGroups').innerHTML=D.recommendations.groups.map(g=>`
    <div class="group-title">${finStrip(g.title)}</div>
    ${g.items.map(i=>`<div class="rec-item"><div class="top"><span class="title">${i.recommendation}</span>${finChip(i.priority)}</div>
    <div class="detail">${i.detail}</div><div class="meta"><span class="impact">${i.impact}</span><span class="action">${i.action}</span></div></div>`).join('')}`).join('');
}

function finInvest(D){
  const last6=D.monthlyTrend.slice(-6),last12=D.monthlyTrend.slice(-12);
  const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
  const avgNet6=avg(last6.map(m=>m.net)), avgSpend6=avg(last6.map(m=>m.spending));
  const nets12=last12.map(m=>m.net).slice().sort((a,b)=>a-b), medianNet12=(nets12[5]+nets12[6])/2;
  const auður=(D.netWorth.breakdown.find(b=>/^Auður/.test(b.account))||{}).value||0;
  const checking=(D.netWorth.breakdown.find(b=>/checking/i.test(b.account))||{}).value||0;
  const framtid=(D.netWorth.breakdown.find(b=>/^Framt/.test(b.account))||{}).value||0;
  const milan=(D.travel.trips.find(t=>/Milan/i.test(t.name))||{}).total||0;
  const liquid=auður+checking, bufLow=avgSpend6*3, bufHigh=avgSpend6*6;
  const excess=Math.max(liquid-bufHigh-milan,0), waste=D.subscriptions.totalPotentialSavingsMonthly;
  document.getElementById('invStats').innerHTML=[
    {label:'Typical month (avg, last 6mo)',value:finFmt(avgNet6),sub:'Skewed up by one large payout'},
    {label:'Typical month (median, last 12mo)',value:finFmt(medianNet12),sub:'A more honest "normal" month'},
    {label:'Cash held (Auður + checking)',value:finFmt(liquid),sub:'6-month buffer ~'+finFmt(bufHigh)},
    {label:'Ready to invest now',value:finFmt(excess),sub:'After Milan + 6-month buffer'}
  ].map(s=>`<div class="stat"><div class="label">${s.label}</div><div class="value">${s.value}</div><div class="sub">${s.sub}</div></div>`).join('');
  document.getElementById('invCapacityText').innerHTML=`Your average net cash flow over the last 6 months (${finFmt(avgNet6)}/mo) is carried almost entirely by one large payout. The <strong>median</strong> month over the last 12 is closer to <strong>${finFmt(medianNet12)}</strong> — don't size a plan around your best month. This dashboard flags ~<strong>${finFmt(waste)}/mo</strong> of recoverable spending; fix that and you have a repeatable <strong>${finFmt(waste)}–50.000 kr.</strong>/mo to invest. For irregular pay, sweep a fixed <em>percentage</em> (20–25%) of each payout the day it lands.`;
  document.getElementById('invEmergencyText').innerHTML=`No debt shows up in your tracked accounts. Your emergency fund is <strong>overfunded</strong>: a 3–6 month buffer against real spending (${finFmt(avgSpend6)}/mo) is ${finFmt(bufLow)}–${finFmt(bufHigh)}. You hold ${finFmt(liquid)} across Auður + checking — set aside the ${finFmt(milan)} Milan budget, keep a 6-month buffer, and roughly <strong>${finFmt(excess)}</strong> is idle. That lands near your Framtíðarreikningur (${finFmt(framtid)}) — your starting lump sum.`;
  const split=(t,e,s,sp,c,st)=>({etf:t*e,ser:t*s,crypto:t*sp*c,stocks:t*sp*st});
  const lump=split(excess,.70,.15,.15,2/3,1/3), mLow=split(waste,.70,.15,.15,2/3,1/3), mHi=split(50000,.70,.15,.15,2/3,1/3);
  document.getElementById('invLumpHead').textContent=finFmt(excess)+' total';
  document.getElementById('invLumpTableBody').innerHTML=`
    <tr><td><strong>70% ETF</strong></td><td class="amt">${finFmt(lump.etf)}</td><td>Interactive Brokers</td><td>Auto-invest into <strong>VWCE</strong> over 12 months.</td></tr>
    <tr><td><strong>15% séreign</strong></td><td class="amt">${finFmt(lump.ser)}</td><td>Payroll</td><td>Raise withholding % for ~6 paychecks if no lump option.</td></tr>
    <tr><td><strong>10% crypto</strong></td><td class="amt">${finFmt(lump.crypto)}</td><td>Kraken/Coinbase</td><td>BTC/ETH only, 4–6 monthly tranches.</td></tr>
    <tr><td><strong>5% stocks</strong></td><td class="amt">${finFmt(lump.stocks)}</td><td>Same IBKR</td><td>A few high-conviction names, phased.</td></tr>`;
  document.getElementById('invMonthlyHead').textContent=finFmt(waste)+'–'+finFmt(50000)+'/mo';
  document.getElementById('invMonthlyTableBody').innerHTML=`
    <tr><td><strong>70% ETF</strong></td><td class="amt">${finFmt(mLow.etf)}–${finFmt(mHi.etf)}</td><td>Revolut</td><td>Recurring order into the same VWCE.</td></tr>
    <tr><td><strong>15% séreign</strong></td><td class="amt">${finFmt(mLow.ser)}–${finFmt(mHi.ser)}</td><td>Payroll</td><td>Set ongoing séreign withholding %.</td></tr>
    <tr><td><strong>10% crypto</strong></td><td class="amt">${finFmt(mLow.crypto)}–${finFmt(mHi.crypto)}</td><td>Kraken/Coinbase</td><td>Recurring buy.</td></tr>
    <tr><td><strong>5% stocks</strong></td><td class="amt">${finFmt(mLow.stocks)}–${finFmt(mHi.stocks)}</td><td>Revolut</td><td>Fractional shares.</td></tr>`;
  finDraw('investAllocChart',{type:'doughnut',data:{labels:['Global index ETF','Séreign top-up','Speculative'],datasets:[{data:[70,15,15],backgroundColor:[FIN_PALETTE[0],FIN_PALETTE[1],FIN_PALETTE[3]],borderWidth:0}]},
    options:{plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:11.5}}}},cutout:'60%'}});
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
  document.getElementById('notes-dn-link').href='obsidian://open?vault=Brain&file=Daily+Notes%2F'+ds;
  renderObs2();
  fetchVault('Daily Notes/'+ds+'.md').then(md=>renderDailyNote(md,'notes-daily-content')).catch(()=>{
    document.getElementById('notes-daily-content').innerHTML=
      '<div class="ghost" style="margin-bottom:16px">No note for '+ds+' found</div>'+
      '<a href="obsidian://new?vault=Brain&file=Daily+Notes%2F'+ds+'" target="_blank" class="btn btn-dk">Create today\'s note in Obsidian</a>';
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
  window.open('obsidian://new?vault=Brain&file=0-Inbox%2FQuick-'+encodeURIComponent(new Date().toISOString().slice(0,16).replace(':','-'))+'&content='+encodeURIComponent(val),'_blank');
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
  document.getElementById('obs-tab-today').href='obsidian://open?vault=Brain&file=Daily+Notes%2F'+ds;
  document.getElementById('obs-tab-new').href='obsidian://new?vault=Brain&file=Daily+Notes%2F'+ds;
  document.getElementById('obs-goals-link').href='obsidian://open?vault=Brain&file=2-Areas%2FGoals%2FWeekly%2F'+y.getFullYear()+'-W'+String(wk).padStart(2,'0');
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
      return `<a href="obsidian://open?vault=Brain&file=Daily+Notes%2F${encodeURIComponent(n.replace('.md',''))}" target="_blank" class="obs-note-link">`+
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
  window.open('obsidian://new?vault=Brain&file=0-Inbox%2FQuick-'+encodeURIComponent(new Date().toISOString().slice(0,16).replace(':','-'))+'&content='+encodeURIComponent(val),'_blank');
  inp.value='';
}
function renderNotes3(){
  const notes=loadNotes();
  const el=document.getElementById('obs-tab-list'); if(!el) return;
  el.innerHTML=notes.map(n=>`<div class="obs-note"><div class="obs-dot"></div>${n.text}<span class="obs-time">${n.time}</span></div>`).join('');
}