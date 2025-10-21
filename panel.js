/* ProSk Assist - Enhanced Draggable On-Page Panel (Full Featured) */
(function() {
  'use strict';
  
  if (window.__proskPanelInjected) return;
  window.__proskPanelInjected = true;

  const PANEL_ID = 'prosk-assist-panel';
  const BASE_URL = "https://proskai-backend.onrender.com";
  
  let panel = null;
  let isDragging = false;
  let currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;
  
  let state = { token: null, userId: null, selectedProfile: null, profilesCache: [] };

  const $ = (s, el = panel || document) => el.querySelector(s);
  const $$ = (s, el = panel || document) => Array.from(el.querySelectorAll(s));
  
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function toast(msg, kind = 'ok', timeout = 2400) {
    const toastContainer = document.getElementById('prosk-toast-container') || (() => {
      const c = document.createElement('div');
      c.id = 'prosk-toast-container';
      document.body.appendChild(c);
      return c;
    })();
    
    const iconMap = {
      ok: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
      error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
      warn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
    };
    
    const el = document.createElement('div');
    el.className = `prosk-toast prosk-toast-${kind}`;
    el.innerHTML = `<span class="prosk-toast-icon">${iconMap[kind] || iconMap.ok}</span><span class="prosk-toast-message">${escapeHtml(msg)}</span><button class="prosk-toast-close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>`;
    
    el.querySelector('.prosk-toast-close').onclick = () => el.remove();
    toastContainer.appendChild(el);
    
    if (timeout > 0) setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(10px)'; setTimeout(() => el.remove(), 200); }, timeout);
  }

  function bgSend(type, payload) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type, payload }, (resp) => {
        resolve(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : (resp || { ok: true }));
      });
    });
  }

  async function apiSignin(email, password) {
    const res = await fetch(`${BASE_URL}/api/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    return res.json();
  }

  function logLine(msg, tone = '') {
    const logBox = $('#prosk-status-log');
    if (!logBox) return;
    const line = document.createElement('div');
    line.className = `prosk-log-line ${tone ? `prosk-log-${tone}` : ''}`;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
  }

  function updateSignInButton(isSignedIn) {
    const signinBtn = $('#prosk-panel-signin');
    const signoutBtn = $('#prosk-panel-signout');
    if (signinBtn) signinBtn.style.display = isSignedIn ? 'none' : 'flex';
    if (signoutBtn) signoutBtn.style.display = isSignedIn ? 'flex' : 'none';
  }

  function renderSelectedName(profile) {
    const el = $('#prosk-selected-profile');
    if (!el) return;
    if (profile) {
      const name = profile.profileName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Unnamed';
      el.textContent = name;
      el.style.color = '#dc2626';
    } else {
      el.textContent = '—';
      el.style.color = '#a3a3a3';
    }
  }

  function renderProfileDetails(profile) {
    const header = $('#prosk-profile-header');
    const details = $('#prosk-profile-details');
    const empty = $('#prosk-profile-empty');
    
    if (!profile) {
      if (header) header.style.display = 'none';
      if (details) details.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    
    if (empty) empty.style.display = 'none';
    if (header) header.style.display = 'flex';
    
    const name = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'N/A';
    const email = profile.email || 'N/A';
    
    if (header) {
      const nameEl = $('#prosk-ph-name');
      const emailEl = $('#prosk-ph-email');
      const resumeEl = $('#prosk-ph-resume');
      if (nameEl) nameEl.textContent = name;
      if (emailEl) emailEl.textContent = email;
      if (resumeEl && profile.resumeLink) {
        resumeEl.href = profile.resumeLink;
        resumeEl.style.display = 'flex';
      } else if (resumeEl) {
        resumeEl.style.display = 'none';
      }
    }
    
    if (details) {
      const fields = [
        ['Full Name', name],
        ['Email', email],
        ['Phone', `${profile.phoneCountryCode || ''} ${profile.phone || ''}`.trim() || 'N/A'],
        ['City', profile.city || 'N/A'],
        ['Job Type', profile.jobType || 'N/A'],
        ['LinkedIn', profile.linkedinUrl || 'N/A'],
        ['GitHub', profile.githubUrl || 'N/A'],
        ['Portfolio', profile.portfolioUrl || 'N/A']
      ];
      
      details.innerHTML = '<div class="prosk-kv">' + fields.map(([k, v]) => 
        `<div class="prosk-kv-row"><div class="prosk-kv-key">${escapeHtml(k)}</div><div class="prosk-kv-value">${escapeHtml(v)}</div></div>`
      ).join('') + '</div>';
    }
  }

  function renderRoles(profiles) {
    const list = $('#prosk-roles-list');
    const empty = $('#prosk-roles-empty');
    if (!list) return;
    
    if (!profiles || profiles.length === 0) {
      list.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    
    if (empty) empty.style.display = 'none';
    
    list.innerHTML = profiles.map(p => {
      const id = p._id || p.id;
      const name = p.profileName || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unnamed';
      const email = p.email || 'No email';
      const jobType = p.jobType || 'N/A';
      const isSelected = state.selectedProfile && (state.selectedProfile._id === id || state.selectedProfile.id === id);
      
      return `
        <div class="prosk-role-row ${isSelected ? 'prosk-selected' : ''}" data-profile-id="${escapeHtml(id)}">
          <div class="prosk-role-content">
            <div class="prosk-avatar">${name.charAt(0).toUpperCase()}</div>
            <div class="prosk-role-info">
              <div class="prosk-role-title">${escapeHtml(name)}</div>
              <div class="prosk-role-sub">${escapeHtml(email)}</div>
            </div>
          </div>
          <div class="prosk-role-actions">
            <span class="prosk-chip">${escapeHtml(jobType)}</span>
            ${p.resumeLink ? `<a href="${escapeHtml(p.resumeLink)}" target="_blank" class="prosk-panel-icon-btn prosk-sm" title="Resume"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></a>` : ''}
            <button class="prosk-panel-btn prosk-btn-primary prosk-sm prosk-select-btn">${isSelected ? '✓' : 'Select'}</button>
          </div>
        </div>
      `;
    }).join('');
    
    // Attach click handlers
    $$('.prosk-role-row').forEach(row => {
      const profileId = row.dataset.profileId;
      const profile = profiles.find(p => (p._id || p.id) === profileId);
      
      row.querySelector('.prosk-select-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        const res = await bgSend('SELECT_PROFILE', { profile });
        if (res?.ok) {
          toast('Profile selected', 'ok');
          await loadPanelState();
        } else {
          toast('Failed to select profile', 'error');
        }
      });
    });
  }

  async function fetchProfiles(showToast = false) {
    try {
      logLine('Fetching profiles...');
      const res = await bgSend('FETCH_PROFILES');
      if (res?.ok && res.profiles) {
        state.profilesCache = res.profiles;
        renderRoles(res.profiles);
        logLine(`Loaded ${res.profiles.length} profiles`, 'ok');
        if (showToast) toast('Profiles refreshed', 'ok');
      } else {
        logLine('Failed to fetch profiles', 'err');
        if (showToast) toast('Failed to fetch profiles', 'error');
      }
    } catch (err) {
      console.error('Fetch profiles error:', err);
      logLine('Error fetching profiles', 'err');
      if (showToast) toast('Error fetching profiles', 'error');
    }
  }

  async function loadPanelState() {
    const st = await bgSend('GET_STATE');
    state = st?.state || state;
    
    const isSignedIn = !!(state.token && state.userId);
    updateSignInButton(isSignedIn);
    renderSelectedName(state.selectedProfile);
    renderProfileDetails(state.selectedProfile);
    
    if (state.profilesCache && state.profilesCache.length > 0) {
      renderRoles(state.profilesCache);
    }
  }

  function setupEventListeners() {
    // Dragging
    const header = $('#prosk-panel-header');
    if (header) {
      header.addEventListener('mousedown', dragStart);
      document.addEventListener('mousemove', drag);
      document.addEventListener('mouseup', dragEnd);
    }
    
    // Close button
    $('#prosk-panel-close')?.addEventListener('click', () => {
      panel.remove();
      const minimizedIcon = document.getElementById('prosk-minimized-icon');
      if (minimizedIcon) minimizedIcon.remove();
      chrome.storage.local.remove('panelPosition');
    });
    
    // Minimize button
    $('#prosk-panel-minimize')?.addEventListener('click', () => {
      const minimizedIcon = document.getElementById('prosk-minimized-icon');
      if (panel && minimizedIcon) {
        panel.style.display = 'none';
        minimizedIcon.style.display = 'flex';
        chrome.storage.local.set({ panelMinimized: true });
      }
    });
    
    // Restore from minimized icon
    const minimizedIcon = document.getElementById('prosk-minimized-icon');
    if (minimizedIcon) {
      minimizedIcon.addEventListener('click', () => {
        if (panel) {
          panel.style.display = 'block';
          minimizedIcon.style.display = 'none';
          chrome.storage.local.set({ panelMinimized: false });
        }
      });
    }
    
    // Tabs
    $$('.prosk-panel-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.prosk-panel-tab').forEach(t => t.classList.remove('active'));
        $$('.prosk-panel-pane').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        $(`#prosk-pane-${tab.dataset.tab}`)?.classList.add('active');
      });
    });
    
    // Sign-in button
    $('#prosk-panel-signin')?.addEventListener('click', () => {
      $('#prosk-signin-sheet')?.classList.remove('prosk-hidden');
    });
    
    // Sign-in close
    $('#prosk-signin-close')?.addEventListener('click', () => {
      $('#prosk-signin-sheet')?.classList.add('prosk-hidden');
    });
    
    // Sign-in submit
    $('#prosk-btn-signin')?.addEventListener('click', async () => {
      const email = $('#prosk-email')?.value;
      const password = $('#prosk-password')?.value;
      
      if (!email || !password) {
        toast('Please enter email and password', 'warn');
        return;
      }
      
      try {
        const data = await apiSignin(email, password);
        if (data.token && data.userId) {
          const res = await bgSend('SIGNIN_SAVE', { token: data.token, userId: data.userId });
          if (res?.ok) {
            toast('Signed in successfully', 'ok');
            $('#prosk-signin-sheet')?.classList.add('prosk-hidden');
            await loadPanelState();
            await fetchProfiles();
          }
        } else {
          toast(data.message || 'Sign-in failed', 'error');
        }
      } catch (err) {
        console.error('Sign-in error:', err);
        toast('Sign-in error', 'error');
      }
    });
    
    // Sign-out button
    $('#prosk-panel-signout')?.addEventListener('click', async () => {
      const res = await bgSend('SIGNOUT');
      if (res?.ok) {
        toast('Signed out', 'ok');
        state = { token: null, userId: null, selectedProfile: null, profilesCache: [] };
        updateSignInButton(false);
        renderSelectedName(null);
        renderProfileDetails(null);
        renderRoles([]);
      } else {
        toast('Failed to sign out', 'error');
      }
    });
    
    // Refresh button
    $('#prosk-panel-refresh')?.addEventListener('click', () => fetchProfiles(true));
    $('#prosk-refresh-roles')?.addEventListener('click', () => fetchProfiles(true));
    $('#prosk-fetch-profiles')?.addEventListener('click', () => fetchProfiles(true));
    
    // Auto-fill button
    $('#prosk-fill-btn')?.addEventListener('click', async () => {
      logLine('Starting auto-fill...');
      const res = await bgSend('START_FILL');
      if (res?.ok) {
        logLine('Fill request sent', 'ok');
        toast('Autofill started', 'ok');
      } else {
        logLine(`Fill failed: ${res?.error || 'unknown error'}`, 'err');
        toast(res?.error || 'Autofill failed', 'error');
      }
    });
    
    // Clear log
    $('#prosk-clear-log')?.addEventListener('click', () => {
      const logBox = $('#prosk-status-log');
      if (logBox) logBox.innerHTML = '';
    });
  }

  function dragStart(e) {
    if (e.target.closest('.prosk-panel-actions')) return;
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    isDragging = true;
  }

  function drag(e) {
    if (!isDragging) return;
    e.preventDefault();
    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;
    xOffset = currentX;
    yOffset = currentY;
    setTranslate(currentX, currentY, panel);
  }

  function dragEnd() {
    if (isDragging) {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
      chrome.storage.local.set({ panelPosition: { x: xOffset, y: yOffset } });
    }
  }

  function setTranslate(xPos, yPos, el) {
    if (el) el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
  }

  async function createPanel() {
    if (document.getElementById(PANEL_ID)) return;

    // Inject CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = chrome.runtime.getURL('panel-styles.css');
    document.head.appendChild(cssLink);

    // Create panel HTML
    const panelHTML = `
      <div id="${PANEL_ID}" class="prosk-panel">
        <div class="prosk-panel-header" id="prosk-panel-header">
          <div class="prosk-panel-brand">
            <div class="prosk-panel-logo">PA</div>
            <div class="prosk-panel-title">
              <span class="prosk-panel-name">ProSk Assist</span>
              <span class="prosk-panel-subtitle">Floating Panel</span>
            </div>
          </div>
          <div class="prosk-panel-actions">
            <button class="prosk-panel-icon-btn" id="prosk-panel-refresh" title="Refresh Profiles">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            </button>
            <button class="prosk-panel-icon-btn" id="prosk-panel-signin" title="Sign In" style="display:none;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </button>
            <button class="prosk-panel-icon-btn" id="prosk-panel-signout" title="Sign Out" style="display:none;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
            <button class="prosk-panel-icon-btn" id="prosk-panel-minimize" title="Minimize Panel">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <button class="prosk-panel-close" id="prosk-panel-close" title="Close Panel">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>
        
        <div class="prosk-panel-tabs">
          <button class="prosk-panel-tab active" data-tab="apply">Apply</button>
          <button class="prosk-panel-tab" data-tab="roles">Roles</button>
          <button class="prosk-panel-tab" data-tab="profile">Profile</button>
        </div>

        <div class="prosk-panel-body">
          <div class="prosk-panel-pane active" id="prosk-pane-apply">
            <div class="prosk-panel-card">
              <div class="prosk-panel-section">
                <div class="prosk-panel-label">Selected Profile</div>
                <div class="prosk-panel-value" id="prosk-selected-profile">—</div>
              </div>
              <button class="prosk-panel-btn prosk-btn-primary" id="prosk-fill-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                <span>Auto-Fill this page</span>
              </button>
              <div class="prosk-panel-divider"></div>
              <div class="prosk-panel-status">
                <span class="prosk-status-dot prosk-status-ready"></span>
                <span>Engine ready</span>
              </div>
            </div>
            <div class="prosk-panel-card prosk-log-card">
              <div class="prosk-card-head">
                <div class="prosk-hstack"><span>Activity</span><span class="prosk-muted prosk-sm">live</span></div>
                <button class="prosk-panel-icon-btn prosk-sm" id="prosk-clear-log" title="Clear log">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
              <div class="prosk-log" id="prosk-status-log"></div>
            </div>
          </div>

          <div class="prosk-panel-pane" id="prosk-pane-roles">
            <div class="prosk-panel-card">
              <div class="prosk-panel-section">
                <div class="prosk-panel-head-row">
                  <div>
                    <div class="prosk-panel-label">Profiles</div>
                    <div class="prosk-sub">Pick a profile to use while applying</div>
                  </div>
                  <button class="prosk-panel-icon-btn" id="prosk-refresh-roles" title="Refresh">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                  </button>
                </div>
                <div id="prosk-roles-list" class="prosk-roles-list"></div>
                <div class="prosk-panel-empty" id="prosk-roles-empty" style="display:none;">
                  <p>No profiles found</p>
                  <button class="prosk-panel-btn prosk-btn-primary" id="prosk-fetch-profiles">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    <span>Fetch from API</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="prosk-panel-pane" id="prosk-pane-profile">
            <div class="prosk-panel-card">
              <div class="prosk-panel-section">
                <div class="prosk-panel-label">Profile Details</div>
                <div class="prosk-sub">Preview the active profile details</div>
                <div id="prosk-profile-header" class="prosk-profile-header" style="display:none;">
                  <div class="prosk-avatar">A</div>
                  <div class="prosk-stack">
                    <div id="prosk-ph-name" class="prosk-profile-name">—</div>
                    <div id="prosk-ph-email" class="prosk-profile-email">—</div>
                  </div>
                  <a id="prosk-ph-resume" class="prosk-panel-btn prosk-btn-ghost prosk-sm" target="_blank" rel="noopener">Resume</a>
                </div>
                <div id="prosk-profile-details" class="prosk-profile-details"></div>
                <div class="prosk-panel-empty" id="prosk-profile-empty">
                  <p>No profile selected</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div id="prosk-signin-sheet" class="prosk-sheet prosk-hidden">
        <div class="prosk-sheet-card">
          <div class="prosk-sheet-head">
            <h3>Sign in to ProSk Assist</h3>
            <button class="prosk-panel-icon-btn" id="prosk-signin-close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div class="prosk-sheet-body">
            <label class="prosk-label">Email</label>
            <input id="prosk-email" type="email" class="prosk-input" placeholder="you@example.com" />
            <label class="prosk-label">Password</label>
            <input id="prosk-password" type="password" class="prosk-input" placeholder="••••••••" />
            <button id="prosk-btn-signin" class="prosk-panel-btn prosk-btn-primary prosk-w100">Continue</button>
            <p class="prosk-sub prosk-muted">Your token is stored locally to fetch profiles.</p>
          </div>
        </div>
      </div>
      
      <!-- Minimized Icon -->
      <div id="prosk-minimized-icon" class="prosk-minimized-icon" style="display:none;">
        <div class="prosk-minimized-logo">PA</div>
        <div class="prosk-minimized-tooltip">Click to restore ProSk Assist</div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', panelHTML);
    panel = document.getElementById(PANEL_ID);
    
    // Load saved position
    chrome.storage.local.get(['panelPosition'], (result) => {
      if (result.panelPosition) {
        xOffset = result.panelPosition.x || 0;
        yOffset = result.panelPosition.y || 0;
        setTranslate(xOffset, yOffset, panel);
      }
    });
    
    setupEventListeners();
    await loadPanelState();
    logLine('ProSk Assist panel ready');
  }

  // Listen for messages from background/popup
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'OPEN_PANEL') {
      if (!document.getElementById(PANEL_ID)) {
        createPanel();
      }
      sendResponse({ ok: true });
    } else if (msg.type === 'UPDATE_PANEL_PROFILE') {
      loadPanelState();
      sendResponse({ ok: true });
    }
    return true;
  });

})();
