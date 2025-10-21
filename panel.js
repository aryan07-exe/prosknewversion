/* ProSk Assist - Draggable On-Page Panel */
(function() {
  'use strict';
  
  // Prevent multiple injections
  if (window.__proskPanelInjected) return;
  window.__proskPanelInjected = true;

  const PANEL_ID = 'prosk-assist-panel';
  let panel = null;
  let isDragging = false;
  let currentX = 0;
  let currentY = 0;
  let initialX = 0;
  let initialY = 0;
  let xOffset = 0;
  let yOffset = 0;

  // Create panel HTML
  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;

    const panelHTML = `
      <div id="${PANEL_ID}" class="prosk-panel">
        <div class="prosk-panel-header" id="prosk-panel-header">
          <div class="prosk-panel-brand">
            <div class="prosk-panel-logo">PA</div>
            <div class="prosk-panel-title">
              <span class="prosk-panel-name">ProSk Assist</span>
              <span class="prosk-panel-subtitle">Auto Apply Assistant</span>
            </div>
          </div>
          <button class="prosk-panel-close" id="prosk-panel-close" title="Close Panel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="prosk-panel-body">
          <div class="prosk-panel-section">
            <div class="prosk-panel-label">Selected Profile</div>
            <div class="prosk-panel-value" id="prosk-selected-profile">No profile selected</div>
          </div>
          <div class="prosk-panel-section">
            <div class="prosk-panel-label">Status</div>
            <div class="prosk-panel-status">
              <span class="prosk-status-dot prosk-status-ready"></span>
              <span>Ready to fill</span>
            </div>
          </div>
          <button class="prosk-panel-btn prosk-btn-primary" id="prosk-fill-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span>Auto-Fill Form</span>
          </button>
          <button class="prosk-panel-btn prosk-btn-secondary" id="prosk-select-profile-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>Select Profile</span>
          </button>
        </div>
      </div>
    `;

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = `
      .prosk-panel {
        position: fixed;
        top: 100px;
        right: 20px;
        width: 320px;
        background: #1a1a1a;
        border: 1px solid #262626;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        color: #ffffff;
        user-select: none;
        backdrop-filter: blur(10px);
      }

      .prosk-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        background: linear-gradient(135deg, #1f1f1f, #1a1a1a);
        border-bottom: 1px solid #262626;
        border-radius: 12px 12px 0 0;
        cursor: move;
      }

      .prosk-panel-brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .prosk-panel-logo {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: linear-gradient(135deg, #dc2626, #ef4444);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        color: #fff;
        font-size: 14px;
        letter-spacing: 1px;
        box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
      }

      .prosk-panel-title {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .prosk-panel-name {
        font-size: 14px;
        font-weight: 600;
        color: #ffffff;
      }

      .prosk-panel-subtitle {
        font-size: 11px;
        color: #a3a3a3;
      }

      .prosk-panel-close {
        background: transparent;
        border: 1px solid #262626;
        color: #a3a3a3;
        padding: 6px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }

      .prosk-panel-close:hover {
        background: rgba(220, 38, 38, 0.1);
        border-color: #dc2626;
        color: #dc2626;
      }

      .prosk-panel-body {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .prosk-panel-section {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .prosk-panel-label {
        font-size: 12px;
        color: #a3a3a3;
        font-weight: 500;
      }

      .prosk-panel-value {
        font-size: 13px;
        color: #ffffff;
        padding: 8px 12px;
        background: #0a0a0a;
        border: 1px solid #262626;
        border-radius: 8px;
      }

      .prosk-panel-status {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #ffffff;
      }

      .prosk-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
      }

      .prosk-status-ready {
        background: #10b981;
        box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
      }

      .prosk-status-filling {
        background: #f59e0b;
        box-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
      }

      .prosk-panel-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
      }

      .prosk-btn-primary {
        background: linear-gradient(135deg, #dc2626, #ef4444);
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
      }

      .prosk-btn-primary:hover {
        box-shadow: 0 6px 16px rgba(220, 38, 38, 0.4);
        transform: translateY(-1px);
      }

      .prosk-btn-secondary {
        background: #1f1f1f;
        color: #ffffff;
        border: 1px solid #262626;
      }

      .prosk-btn-secondary:hover {
        background: #262626;
        border-color: #333333;
        transform: translateY(-1px);
      }

      .prosk-panel-btn:active {
        transform: translateY(0);
      }

      .prosk-panel-btn svg {
        flex-shrink: 0;
      }

      @keyframes proskFadeIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .prosk-panel {
        animation: proskFadeIn 0.3s ease;
      }
    `;
    document.head.appendChild(style);

    // Inject panel
    const container = document.createElement('div');
    container.innerHTML = panelHTML;
    document.body.appendChild(container.firstElementChild);

    panel = document.getElementById(PANEL_ID);
    
    // Set initial position from storage or default
    chrome.storage.local.get(['panelX', 'panelY'], (result) => {
      if (result.panelX !== undefined && result.panelY !== undefined) {
        xOffset = result.panelX;
        yOffset = result.panelY;
        setTranslate(xOffset, yOffset, panel);
      }
    });

    setupEventListeners();
  }

  function setupEventListeners() {
    const header = document.getElementById('prosk-panel-header');
    const closeBtn = document.getElementById('prosk-panel-close');
    const fillBtn = document.getElementById('prosk-fill-btn');
    const selectProfileBtn = document.getElementById('prosk-select-profile-btn');

    // Dragging
    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    // Close button - only way to close the panel
    closeBtn.addEventListener('click', () => {
      if (panel) {
        panel.remove();
        window.__proskPanelInjected = false;
      }
    });

    // Fill button
    fillBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'START_FILL' }, (response) => {
        if (response?.ok) {
          showNotification('Auto-fill started!', 'success');
        } else {
          showNotification('Failed to start auto-fill', 'error');
        }
      });
    });

    // Select profile button - opens extension popup
    selectProfileBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
    });

    // Update selected profile
    updateSelectedProfile();
  }

  function dragStart(e) {
    if (e.target.closest('.prosk-panel-close')) return;
    
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;

    if (e.target === document.getElementById('prosk-panel-header') || 
        e.target.closest('#prosk-panel-header')) {
      isDragging = true;
      panel.style.cursor = 'grabbing';
    }
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      xOffset = currentX;
      yOffset = currentY;

      setTranslate(currentX, currentY, panel);
    }
  }

  function dragEnd() {
    if (isDragging) {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
      panel.style.cursor = 'default';
      
      // Save position
      chrome.storage.local.set({ panelX: xOffset, panelY: yOffset });
    }
  }

  function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate(${xPos}px, ${yPos}px)`;
  }

  function updateSelectedProfile() {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
      if (response?.ok && response.state?.selectedProfile) {
        const profile = response.state.selectedProfile;
        const profileName = profile.profileName || 
                          `${profile.firstName || ''} ${profile.lastName || ''}`.trim() ||
                          'Unnamed Profile';
        document.getElementById('prosk-selected-profile').textContent = profileName;
      }
    });
  }

  function showNotification(message, type = 'info') {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#dc2626' : '#1a1a1a'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 1000000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      animation: proskFadeIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'OPEN_PANEL') {
      if (!document.getElementById(PANEL_ID)) {
        createPanel();
      }
      sendResponse({ ok: true });
    } else if (msg.type === 'UPDATE_PANEL_PROFILE') {
      updateSelectedProfile();
      sendResponse({ ok: true });
    }
    return true;
  });

  // Auto-create panel on load (optional - can be triggered by button instead)
  // createPanel();

})();
