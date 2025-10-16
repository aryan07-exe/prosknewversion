// ======== CONFIG ========
const BASE_URL = "https://proskai-backend.onrender.com"; // <— set yours

// ======== DOM ========
const signinView = document.getElementById("signinView");
const profilesView = document.getElementById("profilesView");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const btnSignin = document.getElementById("btnSignin");
const profileSelect = document.getElementById("profileSelect");
const btnUseProfile = document.getElementById("btnUseProfile");
const btnFillOnly = document.getElementById("btnFillOnly");

// ======== BG messaging ========
function bgSend(type, payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (resp) => {
      if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
      else resolve(resp || { ok: true });
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

// ======== UI state ========
async function refreshState() {
  const st = await bgSend("GET_STATE");
  if (!st?.ok) return showSignin();

  const state = st.state || {};
  if (state.token && state.userId) {
    // fetch profiles if not cached
    if (!Array.isArray(state.profilesCache) || !state.profilesCache.length) {
      const resp = await bgSend("FETCH_PROFILES");
      if (!resp?.ok) return showSignin();
      populateProfiles(resp.profiles);
      showProfiles();
      return;
    }
    populateProfiles(state.profilesCache);
    showProfiles();
  } else {
    showSignin();
  }
}

function populateProfiles(list) {
  profileSelect.innerHTML = "";
  (list || []).forEach(p => {
    const opt = document.createElement("option");
    opt.value = p._id || p.id;
    opt.textContent = p.profileName || `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Profile";
    opt.dataset.idx = p._id || p.id;
    profileSelect.appendChild(opt);
  });
}

function showSignin() {
  signinView.style.display = "block";
  profilesView.style.display = "none";
}
function showProfiles() {
  signinView.style.display = "none";
  profilesView.style.display = "block";
}

// ======== Events ========
btnSignin.addEventListener("click", async () => {
  const email = emailEl.value.trim();
  const password = passwordEl.value.trim();
  if (!email || !password) return alert("Enter email & password");
  try {
    const data = await apiSignin(email, password);
    // response shape:
    // {
    //   message: "Signin successful",
    //   token: "...",
    //   user: { id: "<targetUserId>", email, profileIds: [...], name }
    // }
    const token = data?.token;
    const userId = data?.user?.id;
    if (!token || !userId) throw new Error("Missing token or userId in response");

    const saved = await bgSend("SIGNIN_SAVE", { token, userId });
    if (!saved?.ok) throw new Error(saved?.error || "Could not save signin");

    const resp = await bgSend("FETCH_PROFILES");
    if (!resp?.ok) throw new Error(resp?.error || "Could not fetch profiles");

    populateProfiles(resp.profiles);
    showProfiles();
  } catch (e) {
    alert("Signin error: " + e.message);
  }
});

btnUseProfile.addEventListener("click", async () => {
  const id = profileSelect.value;
  if (!id) return alert("Pick a profile");
  // get current profiles cache so we can pass the full object
  const st = await bgSend("GET_STATE");
  const list = st?.state?.profilesCache || [];
  const profile = list.find(p => (p._id || p.id) === id);
  if (!profile) return alert("Profile not found in cache");
  const resp = await bgSend("SELECT_PROFILE", { profile });
  if (!resp?.ok) return alert(resp?.error || "Fill failed");
  window.close();
});

btnFillOnly.addEventListener("click", async () => {
  const resp = await bgSend("START_FILL");
  if (!resp?.ok) return alert(resp?.error || "Fill failed");
  window.close();
});

// ======== Init ========
refreshState();
