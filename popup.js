// ======== CONFIG ========
const BASE_URL = "https://proskai-backend.onrender.com";

// ======== UTIL ========
const $  = (s, el=document)=>el.querySelector(s);
const $$ = (s, el=document)=>Array.from(el.querySelectorAll(s));
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// Tabs underline animation
const tabs = $$('.tab');
const ink  = $('#tabInk');
function moveInk(){
  const active = $('.tab.active');
  if (!active) return;
  const idx = tabs.indexOf(active);
  ink.style.left = `calc(${idx * 33.333}% + 8px)`;
}
tabs.forEach(btn=>{
  btn.addEventListener('click',()=>{
    tabs.forEach(b=>b.classList.remove('active'));
    $$('.pane').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    $(`#tab-${btn.dataset.tab}`).classList.add('active');
    moveInk();
  });
});
moveInk();

// Toasts
const toasts = $('#toasts');
function toast(msg, kind='ok', timeout=2400){
  const el = document.createElement('div');
  el.className = `toast ${kind==='err'?'err':''}`;
  el.innerHTML = `<div>${escapeHtml(msg)}</div><button class="x">✕</button>`;
  toasts.appendChild(el);
  const close=()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(),160); };
  el.querySelector('.x').onclick = close;
  setTimeout(close, timeout);
}

// ======== BG messaging ========
function bgSend(type,payload){
  return new Promise((resolve)=>{
    chrome.runtime.sendMessage({type,payload},(resp)=>{
      if (chrome.runtime.lastError) resolve({ ok:false, error: chrome.runtime.lastError.message });
      else resolve(resp || { ok:true });
    });
  });
}

// ======== API ========
async function apiSignin(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error(`Signin failed (${res.status})`);
  return res.json();
}

// ======== LOGGING ========
const logBox = $('#statusLog');
$('#clearLog').addEventListener('click', () => logBox.innerHTML = '');
function logLine(msg,tone=''){
  const ts = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  const div = document.createElement('div');
  div.textContent = `[${ts}] ${msg}`;
  if (tone==='warn') div.style.color='#f8c77e';
  if (tone==='err')  div.style.color='#ff7b7b';
  logBox.prepend(div);
}

// ======== UI Refs ========
const envBadge     = $('#envBadge');
const selectedName = $('#selectedName');
const profileBadge = $('#profileBadge');
const rolesList    = $('#rolesList');
const rolesEmpty   = $('#rolesEmpty');
const rolesSkel    = $('#rolesSkeleton');
const searchInput  = $('#searchInput');

// Profile header refs
const phName   = $('#phName');
const phEmail  = $('#phEmail');
const phResume = $('#phResume');

// Sign in sheet
const sheet = $('#signinSheet');
$('#signinOpenBtn').addEventListener('click', ()=>sheet.classList.remove('hidden'));
$('#signinCloseBtn').addEventListener('click', ()=>sheet.classList.add('hidden'));
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') sheet.classList.add('hidden'); });
$('#btnSignin').addEventListener('click', doSignin);
$('#password').addEventListener('keydown', (e)=>{ if(e.key==='Enter') doSignin(); });

async function doSignin(){
  const email = $('#email').value.trim();
  const pwd   = $('#password').value.trim();
  if (!email || !pwd){ toast('Enter email & password','err'); return; }
  try{
    const data = await apiSignin(email, pwd);
    const token = data?.token; const userId = data?.user?.id;
    if (!token || !userId) throw new Error('Missing token or userId');
    const saved = await bgSend('SIGNIN_SAVE',{ token, userId });
    if (!saved?.ok) throw new Error(saved?.error || 'Could not save signin');
    sheet.classList.add('hidden');
    toast('Signed in');
    await fetchProfiles(true);
    const st = await bgSend('GET_STATE');
    renderSelectedName(st?.state?.selectedProfile || null);
    renderProfileDetails(st?.state?.selectedProfile || null);
  }catch(e){
    toast('Signin error: '+e.message,'err');
  }
}

// ======== Render helpers ========
function renderSelectedName(p){
  selectedName.textContent = p ? (p.profileName || ([p.firstName,p.lastName].filter(Boolean).join(' ') || '—')) : '—';
  profileBadge.textContent = p ? 'Selected' : '—';
  const a = $('.profile-head .avatar');
  const initials = (p ? (p.firstName?.[0] || '') + (p.lastName?.[0] || '') : 'A') || 'A';
  a.textContent = initials.toUpperCase();
  phName.textContent  = p ? (p.profileName || [p.firstName,p.lastName].filter(Boolean).join(' ') || '—') : '—';
  phEmail.textContent = p?.email || '—';
  if (p?.resumeUrl) { phResume.href = p.resumeUrl; phResume.style.display='inline-flex'; }
  else phResume.style.display='none';

  // highlight selected in Roles list
  highlightSelectedInList(p?._id || p?.id);
}

function pillList(arr){
  if (!Array.isArray(arr) || !arr.length) return '—';
  return arr.map(v=>`<span class="pill">${escapeHtml(String(v))}</span>`).join(' ');
}

function renderProfileDetails(p){
  const box = $('#profileDetails');
  if (!p){ box.innerHTML = '<div class="k">No profile selected</div><div class="v">—</div>'; return; }

  const kv = (k,v)=>`<div class="k">${k}</div><div class="v">${v ?? '—'}</div>`;
  const name = [p.firstName,p.lastName].filter(Boolean).join(' ') || '—';
  const address = [p.street,p.city,p.state,p.zipCode,p.country].filter(Boolean).join(', ') || '—';
  const skills = Array.isArray(p.skills) ? pillList(p.skills) : (p.skills || '—');
  const langs  = Array.isArray(p.languages) ? pillList(p.languages.map(l=>l.proficiency?`${l.language} (${l.proficiency})`:l.language)) : (p.languages || '—');
  const exp0 = p.experience?.[0] || {}; const edu0 = p.education?.[0] || {};

  box.innerHTML = [
    kv('Name', escapeHtml(name)),
    kv('Email', escapeHtml(p.email || '—')),
    kv('Phone', escapeHtml(((p.phoneCountryCode||'')+' '+(p.phone||'')).trim())),
    kv('Address', escapeHtml(address)),
    kv('Job Type', escapeHtml(p.jobType || '—')),
    kv('Relocate', String(p.willingToRelocate ?? '—')),
    kv('Skills', skills),
    kv('Languages', langs),
    kv('LinkedIn', p.linkedin ? `<a class="btn ghost sm" href="${escapeHtml(p.linkedin)}" target="_blank">Open</a>` : '—'),
    kv('GitHub',  p.github ? `<a class="btn ghost sm" href="${escapeHtml(p.github)}" target="_blank">Open</a>` : '—'),
    kv('Portfolio', p.portfolio ? `<a class="btn ghost sm" href="${escapeHtml(p.portfolio)}" target="_blank">Open</a>` : '—'),
    '<div class="k">Experience</div><div class="v"></div>',
    kv('Company', escapeHtml(exp0.company || '—')),
    kv('Role', escapeHtml(exp0.role || '—')),
    kv('Type', escapeHtml(exp0.experienceType || '—')),
    kv('Current', String(exp0.isCurrent ?? '—')),
    kv('Description', escapeHtml(exp0.description || '—')),
    '<div class="k">Education</div><div class="v"></div>',
    kv('School', escapeHtml(edu0.school || '—')),
    kv('Degree', escapeHtml(edu0.degree || '—')),
    kv('Field',  escapeHtml(edu0.fieldOfStudy || '—')),
    kv('Grade',  escapeHtml(edu0.grade || '—')),
  ].join('');
}
function renderRoles(list){
  rolesList.innerHTML = '';
  const arr = Array.isArray(list) ? list : [];
  rolesEmpty.hidden = arr.length > 0;
  if (!arr.length) return;

  const tmpl = document.getElementById('roleItemTmpl');

  arr.forEach(p=>{
    const node  = tmpl.content.cloneNode(true);
    const row   = node.querySelector('.role-row');
    const title = node.querySelector('.role-title');
    const sub   = node.querySelector('.role-sub');
    const chip  = node.querySelector('[data-jobtype]');
    const link  = node.querySelector('.resumeLink');
    const btn   = node.querySelector('.selectBtn');
    const av    = node.querySelector('.avatar');
    const flag  = node.querySelector('.selected-flag');

    const id = p._id || p.id;
    row.dataset.id = id || '';

    av.textContent = ((p.firstName?.[0]||'R')+(p.lastName?.[0]||'')).toUpperCase();
    title.textContent = p.profileName || 'Untitled Profile';
    sub.textContent   = [[p.firstName,p.lastName].filter(Boolean).join(' '), p.email].filter(Boolean).join(' • ');
    chip.textContent  = p.jobType || '—';

    // IMPORTANT: never remove the link node; just hide it if missing
    if (p.resumeUrl) { link.href = p.resumeUrl; link.hidden = false; }
    else { link.hidden = true; }

    // Belt-and-suspenders: ensure the Select button renders even if CSS collides
    btn.style.display = 'inline-flex';
    btn.style.visibility = 'visible';

    btn.addEventListener('click', async ()=>{
      const res = await bgSend('SELECT_PROFILE',{ profile:p });
      if (res?.ok){
        renderSelectedName(p);
        renderProfileDetails(p);
        toast(`Selected “${p.profileName || (p.firstName+' '+p.lastName)}”`);
        highlightSelectedInList(id);
      } else {
        toast(res?.error || 'Failed to select profile','err');
      }
    });

    rolesList.appendChild(node);
  });

  // paint selected state after render
  bgSend('GET_STATE').then(st=>{
    const selected = st?.state?.selectedProfile;
    highlightSelectedInList(selected?._id || selected?.id);
  });
}

// Visually mark the selected row (check + border)
function highlightSelectedInList(selectedId){
  $$('.role-row', rolesList).forEach(r=>{
    const match = (r.dataset.id && selectedId) ? (r.dataset.id === String(selectedId)) : false;
    r.classList.toggle('selected', !!match);
    const flag = $('.selected-flag', r);
    if (flag) flag.hidden = !match;
  });
}

// ======== Search filter ========
$('#searchInput').addEventListener('input', ()=>{
  const q = searchInput.value.toLowerCase();
  $$('.role-row', rolesList).forEach(el=>{
    const t = el.innerText.toLowerCase();
    el.style.display = t.includes(q) ? '' : 'none';
  });
});

// ======== Actions ========
$('#autofillBtn').addEventListener('click', async ()=>{
  logLine('Starting auto-fill…');
  const res = await bgSend('START_FILL');
  if (res?.ok){ logLine('Fill request sent to all frames.'); toast('Autofill started'); }
  else { logLine(`Fill failed: ${res?.error || 'unknown error'}`, 'err'); toast(res?.error || 'Autofill failed', 'err'); }
});

$('#refreshBtn').addEventListener('click', fetchProfiles);
$('#fetchBtn').addEventListener('click', fetchProfiles);
$('#fetchBtn2').addEventListener('click', fetchProfiles);

async function fetchProfiles(showBusy=false){
  if (showBusy){ rolesSkel.hidden = false; rolesList.innerHTML = ''; }
  envBadge.textContent = 'Loading…';
  const res = await bgSend('FETCH_PROFILES');
  rolesSkel.hidden = true;

  if (res?.ok){
    renderRoles(res.profiles);
    envBadge.textContent = `Loaded ${res.profiles?.length || 0}`;
    if (!res.profiles?.length) rolesEmpty.hidden = false;
    logLine('Profiles refreshed from API.');
  } else {
    envBadge.textContent = 'Error';
    rolesEmpty.hidden = false;
    toast(res?.error || 'Failed to fetch profiles','err');
  }
}

// ======== Init ========
(async function init(){
  const st = await bgSend('GET_STATE');
  const state = st?.state || {};

  renderSelectedName(state.selectedProfile || null);
  renderProfileDetails(state.selectedProfile || null);

  if (Array.isArray(state.profilesCache) && state.profilesCache.length){
    renderRoles(state.profilesCache);
    envBadge.textContent = `Cached ${state.profilesCache.length}`;
  } else {
    rolesEmpty.hidden = false;
    envBadge.textContent = state.token && state.userId ? 'Signed in' : 'Sign in';
  }

  logLine('Popup ready.');
})();


