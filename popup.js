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
function toast(msg, kind='ok', timeout=2400) {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  
  // Add SVG icon based on message kind
  let iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="16" x2="12" y2="12"></line>
    <line x1="12" y1="8" x2="12.01" y2="8"></line>
  </svg>`;
  
  if (kind === 'ok') {
    iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>`;
  }
  
  if (kind === 'error') {
    iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>`;
  }
  
  if (kind === 'warn') {
    iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>`;
  }
  
  el.innerHTML = `
    <span class="toast-icon">${iconSvg}</span>
    <span class="toast-message">${msg}</span>
    <button class="icon-btn sm toast-close">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;
  
  el.querySelector('.toast-close').onclick = () => el.remove();
  
  // Create toasts container if it doesn't exist
  let toastsContainer = $('.toasts');
  if (!toastsContainer) {
    toastsContainer = document.createElement('div');
    toastsContainer.className = 'toasts';
    document.body.appendChild(toastsContainer);
  }
  
  toastsContainer.appendChild(el);
  
  // Auto-remove after timeout
  if (timeout > 0) {
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      setTimeout(() => el.remove(), 200);
    }, timeout);
  }
  
  return el;
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

// ======== AI Progress Indicator ========
const aiProgress = {
  start: function() {
    const indicator = $('#aiProgress');
    if (indicator) indicator.style.display = 'flex';
  },
  
  stop: function() {
    const indicator = $('#aiProgress');
    if (indicator) indicator.style.display = 'none';
  },
  
  // Simulate AI processing
  simulate: function(duration = 2000) {
    this.start();
    return new Promise(resolve => {
      setTimeout(() => {
        this.stop();
        resolve();
      }, duration);
    });
  }
};

// ======== Button Handlers ========
$('#addProfileBtn').addEventListener('click', async function() {
  try {
    aiProgress.start();
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    window.location.href = 'https://your-redirect-url.com';
  } catch (error) {
    console.error('Error adding profile:', error);
    toast('Failed to add profile', 'error');
  } finally {
    aiProgress.stop();
  }
});

$('#deleteProfileBtn').addEventListener('click', async function() {
  const selected = $('.role-row.selected');
  if (!selected) {
    toast('Please select a profile to delete', 'warn');
    return;
  }
  
  const confirmDelete = confirm('Are you sure you want to delete the selected profile?');
  if (!confirmDelete) return;
  
  try {
    aiProgress.start();
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast('Profile deleted successfully', 'ok');
    fetchProfiles();
  } catch (error) {
    console.error('Error deleting profile:', error);
    toast('Failed to delete profile', 'error');
  } finally {
    aiProgress.stop();
  }
});
const envBadge     = $('#envBadge');
const selectedName = $('#selectedName');
const rolesEmpty   = $('#rolesEmpty');
const rolesSkel    = $('#rolesSkeleton');
const searchInput  = $('#searchInput');

// Profile header refs
const phName   = $('#phName');
const phEmail  = $('#phEmail');
const phResume = $('#phResume');

// Sign in sheet
const sheet = $('#signinSheet');
const signinBtn = $('#signinOpenBtn');

function updateSignInButton(isSignedIn) {
  if (isSignedIn) {
    signinBtn.style.display = 'none';
  } else {
    signinBtn.style.display = 'flex';
  }
}

signinBtn.addEventListener('click', ()=>sheet.classList.remove('hidden'));
$('#signinCloseBtn').addEventListener('click', ()=>sheet.classList.add('hidden'));
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') sheet.classList.add('hidden'); });
$('#btnSignin').addEventListener('click', doSignin);
$('#password').addEventListener('keydown', (e)=>{ if(e.key==='Enter') doSignin(); });

async function doSignin(){
  const email = $('#email').value.trim();
  const pwd   = $('#password').value.trim();
  if (!email || !pwd){ toast('Enter email & password','error'); return; }
  try{
    const data = await apiSignin(email, pwd);
    const token = data?.token; const userId = data?.user?.id;
    if (!token || !userId) throw new Error('Missing token or userId');
    const saved = await bgSend('SIGNIN_SAVE',{ token, userId });
    if (!saved?.ok) throw new Error(saved?.error || 'Could not save signin');
    sheet.classList.add('hidden');
    toast('Successfully signed in to ProSk Assist', 'ok');
    updateSignInButton(true);
    envBadge.textContent = 'Signed in';
    await fetchProfiles(true);
    const st = await bgSend('GET_STATE');
    renderSelectedName(st?.state?.selectedProfile || null);
    renderProfileDetails(st?.state?.selectedProfile || null);
  }catch(e){
    toast('Sign in failed: '+e.message,'error');
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

  arr.forEach(p => {
    const node = tmpl.content.cloneNode(true);
    const row = node.querySelector('.role-row');
    if (!row) {
      console.error('Could not find .role-row in template');
      return;
    }
    
    const title = node.querySelector('.role-title');
    const sub = node.querySelector('.role-sub');
    const chip = node.querySelector('[data-jobtype]');
    const link = node.querySelector('.resumeLink');
    const btn = node.querySelector('.selectBtn');
    const av = node.querySelector('.avatar');
    const flag = node.querySelector('.selected-flag');

    const id = p._id || p.id || '';
    row.dataset.id = id;

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
  if (res?.ok){ logLine('Fill request sent to all frames.'); toast('Autofill started', 'ok'); }
  else { logLine(`Fill failed: ${res?.error || 'unknown error'}`, 'err'); toast(res?.error || 'Autofill failed', 'error'); }
});

// Open Panel button
$('#openPanelBtn')?.addEventListener('click', async ()=>{
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      toast('No active tab found', 'error');
      return;
    }
    
    // Send message to content script to open panel
    chrome.tabs.sendMessage(tab.id, { type: 'OPEN_PANEL' }, (response) => {
      if (chrome.runtime.lastError) {
        toast('Failed to open panel. Please refresh the page.', 'error');
        logLine('Panel open error: ' + chrome.runtime.lastError.message, 'err');
      } else if (response?.ok) {
        toast('Panel opened on page', 'ok');
        logLine('Panel opened successfully');
      }
    });
  } catch (error) {
    console.error('Error opening panel:', error);
    toast('Failed to open panel', 'error');
  }
});

$('#refreshBtn').addEventListener('click', fetchProfiles);
// Add loading state to fetch buttons
const fetchButtons = ['#fetchBtn', '#fetchBtn2'];
fetchButtons.forEach(btn => {
  $(btn)?.addEventListener('click', async () => {
    try {
      await fetchProfiles(true);
      toast('Profiles refreshed', 'ok');
    } catch (error) {
      console.error('Error refreshing profiles:', error);
    }
  });
});

async function fetchProfiles(showBusy=false){
  if (showBusy) {
    rolesSkeleton.hidden = false;
    rolesEmpty.hidden = true;
    aiProgress.start();
  }
  
  try {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const res = await fetch(`${BASE_URL}/api/profiles`);
    if (!res.ok) throw new Error('Failed to fetch profiles');
    const data = await res.json();
    
    // Simulate AI processing
    if (data.length > 0) {
      await aiProgress.simulate(1200);
    }
    
    renderRoles(data);
  } catch (err) {
    console.error('Fetch profiles error:', err);
    rolesEmpty.hidden = false;
    rolesEmpty.innerHTML = `
      <p>Failed to load profiles</p>
      <button id="retryFetch" class="btn primary">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18-5M22 12.5a10 10 0 0 1-18 5"></path>
        </svg>
        <span>Retry</span>
      </button>
    `;
    $('#retryFetch')?.addEventListener('click', ()=>fetchProfiles(true));
  } finally {
    rolesSkeleton.hidden = true;
    aiProgress.stop();
  }
}

// ======== Init ========
(async function init(){
  const st = await bgSend('GET_STATE');
  const state = st?.state || {};

  // Check if user is signed in
  const isSignedIn = !!(state.token && state.userId);
  updateSignInButton(isSignedIn);

  renderSelectedName(state.selectedProfile || null);
  renderProfileDetails(state.selectedProfile || null);

  if (Array.isArray(state.profilesCache) && state.profilesCache.length){
    renderRoles(state.profilesCache);
    envBadge.textContent = `${state.profilesCache.length} Profile${state.profilesCache.length !== 1 ? 's' : ''}`;
  } else {
    rolesEmpty.hidden = false;
    envBadge.textContent = isSignedIn ? 'Signed in' : 'Not signed in';
  }

  logLine('ProSk Assist ready.');
})();


