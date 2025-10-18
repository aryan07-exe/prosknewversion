// // ======== CONFIG ========
// const BASE_URL = "https://proskai-backend.onrender.com"; // your backend

// // Storage keys we use
// const K = {
//   token: "token",
//   userId: "userId",
//   profilesCache: "profilesCache",
//   selectedProfileId: "selectedProfileId",
//   selectedProfile: "selectedProfile"
// };

// // ======== Small logger ========
// function log(...a){ console.log("[BG]", ...a); }

// // ======== Helpers ========
// async function save(obj) { return chrome.storage.local.set(obj); }
// async function load(keys) {
//   if (!keys) return chrome.storage.local.get(null);
//   return chrome.storage.local.get(keys);
// }

// async function fetchProfilesForUser(userId, token) {
//   if (!userId) throw new Error("Missing userId");
//   const url = `${BASE_URL}/api/profiles/getdemoprofiles/${encodeURIComponent(userId)}`;
//   log("GET", url);
//   const res = await fetch(url, {
//     headers: token ? { "Authorization": `Bearer ${token}` } : {}
//   });
//   if (!res.ok) throw new Error(`Profiles fetch failed (${res.status})`);
//   const data = await res.json();
//   log("Fetched profiles:", Array.isArray(data) ? data.length : typeof data);
//   return data;
// }

// async function broadcastFillToAllFrames(profile) {
//   if (!profile) throw new Error("No profile to fill");
//   const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//   if (!tab?.id) throw new Error("No active tab found");

//   const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
//   log(`Broadcasting to ${frames.length} frames for tab`, tab.id);

//   const results = await Promise.all(frames.map(f => new Promise((resolve) => {
//     const payload = { type: "FILL_PROFILE", profile, __trace: { tabId: tab.id, frameId: f.frameId, ts: Date.now() } };
//     chrome.tabs.sendMessage(tab.id, payload, { frameId: f.frameId }, () => {
//       const ok = !chrome.runtime.lastError;
//       if (!ok) log("SendMessage error (frameId:", f.frameId, "):", chrome.runtime.lastError?.message);
//       resolve({ frameId: f.frameId, ok });
//     });
//   })));

//   const anyOk = results.some(r => r.ok);
//   log("Broadcast results:", results);
//   if (!anyOk) throw new Error("No frame accepted the fill request (cross-origin iframe or no form present)");
//   return results;
// }

// // ======== Message router ========
// chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//   (async () => {
//     try {
//       if (msg?.type === "SIGNIN_SAVE") {
//         const { token, userId } = msg.payload || {};
//         log("SIGNIN_SAVE", { hasToken: !!token, userId });
//         if (!token || !userId) throw new Error("Missing token or userId");
//         await save({ [K.token]: token, [K.userId]: userId });
//         sendResponse({ ok: true });
//         return;
//       }

//       if (msg?.type === "FETCH_PROFILES") {
//         const st = await load([K.userId, K.token]);
//         const profiles = await fetchProfilesForUser(st.userId, st.token);
//         await save({ [K.profilesCache]: profiles });
//         sendResponse({ ok: true, profiles });
//         return;
//       }

//       if (msg?.type === "SELECT_PROFILE") {
//         const { profile } = msg.payload || {};
//         if (!profile) throw new Error("Missing profile");
//         await save({ [K.selectedProfileId]: profile._id || profile.id, [K.selectedProfile]: profile });
//         const results = await broadcastFillToAllFrames(profile);
//         sendResponse({ ok: true, results });
//         return;
//       }

//       if (msg?.type === "START_FILL") {
//         const st = await load([K.selectedProfile, K.profilesCache, K.selectedProfileId]);
//         let profile = st.selectedProfile;
//         if (!profile && st.selectedProfileId && Array.isArray(st.profilesCache)) {
//           profile = st.profilesCache.find(p => (p._id || p.id) === st.selectedProfileId);
//         }
//         if (!profile) throw new Error("No selected profile in storage");
//         const results = await broadcastFillToAllFrames(profile);
//         sendResponse({ ok: true, results });
//         return;
//       }

//       if (msg?.type === "GET_STATE") {
//         const st = await load([K.token, K.userId, K.profilesCache, K.selectedProfileId, K.selectedProfile]);
//         sendResponse({ ok: true, state: st });
//         return;
//       }

//       sendResponse({ ok: false, error: "Unknown message type" });
//     } catch (e) {
//       console.error("[BG] error:", e);
//       sendResponse({ ok: false, error: String(e?.message || e) });
//     }
//   })();
//   return true;
// });
// ===== CONFIG =====
const BASE_URL = "https://proskai-backend.onrender.com";

const K = {
  token: "token",
  userId: "userId",
  profilesCache: "profilesCache",
  selectedProfileId: "selectedProfileId",
  selectedProfile: "selectedProfile"
};

function log(...a){ console.log("[BG]", ...a); }

async function save(obj) { return chrome.storage.local.set(obj); }
async function load(keys) {
  if (!keys) return chrome.storage.local.get(null);
  return chrome.storage.local.get(keys);
}

async function fetchProfilesForUser(userId, token) {
  if (!userId) throw new Error("Missing userId");
  const url = `${BASE_URL}/api/profiles/getprofiles/${encodeURIComponent(userId)}`;
  log("GET", url);
  const res = await fetch(url, {
    headers: token ? { "Authorization": `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error(`Profiles fetch failed (${res.status})`);
  const data = await res.json();
  log("Fetched profiles:", Array.isArray(data) ? data.length : typeof data);
  return data;
}

async function injectIntoAllFrames(tabId) {
  console.log("[BG] Injecting injected.js into all frames (MAIN world) for tab:", tabId);
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ["injected.js"],
    // IMPORTANT: run in page context so React/ATS handlers see our events
    world: "MAIN"
  });
}

async function postFillToAllFrames(profile) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found");
  await injectIntoAllFrames(tab.id);

  const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
  log(`Broadcasting FILL_PROFILE to ${frames.length} frames for tab ${tab.id}`);

  const payload = { type: "FILL_PROFILE", profile, __trace: { tabId: tab.id, ts: Date.now() } };
  const results = await Promise.all(frames.map(f => new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, payload, { frameId: f.frameId }, () => {
      const ok = !chrome.runtime.lastError;
      if (!ok) log("SendMessage error (frameId:", f.frameId, "):", chrome.runtime.lastError?.message);
      resolve({ frameId: f.frameId, ok });
    });
  })));

  const anyOk = results.some(r => r.ok);
  if (!anyOk) throw new Error("No frame accepted the fill request");
  return results;
}

// ===== Message router =====
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "SIGNIN_SAVE") {
        const { token, userId } = msg.payload || {};
        if (!token || !userId) throw new Error("Missing token or userId");
        await save({ [K.token]: token, [K.userId]: userId });
        sendResponse({ ok: true });
        return;
      }

      if (msg?.type === "FETCH_PROFILES") {
        const st = await load([K.userId, K.token]);
        const profiles = await fetchProfilesForUser(st.userId, st.token);
        await save({ [K.profilesCache]: profiles });
        sendResponse({ ok: true, profiles });
        return;
      }

      if (msg?.type === "SELECT_PROFILE") {
        const { profile } = msg.payload || {};
        if (!profile) throw new Error("Missing profile");
        await save({ [K.selectedProfileId]: profile._id || profile.id, [K.selectedProfile]: profile });
        const results = await postFillToAllFrames(profile);
        sendResponse({ ok: true, results });
        return;
      }

      if (msg?.type === "START_FILL") {
        const st = await load([K.selectedProfile, K.profilesCache, K.selectedProfileId]);
        let profile = st.selectedProfile;
        if (!profile && st.selectedProfileId && Array.isArray(st.profilesCache)) {
          profile = st.profilesCache.find(p => (p._id || p.id) === st.selectedProfileId);
        }
        if (!profile) throw new Error("No selected profile in storage");
        const results = await postFillToAllFrames(profile);
        sendResponse({ ok: true, results });
        return;
      }

      if (msg?.type === "GET_STATE") {
        const st = await load([K.token, K.userId, K.profilesCache, K.selectedProfileId, K.selectedProfile]);
        sendResponse({ ok: true, state: st });
        return;
      }

      sendResponse({ ok: false, error: "Unknown message type" });
    } catch (e) {
      console.error("[BG] error:", e);
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })();
  return true;
});
