// content.js — bridges BG ↔ page, injects page-world engine, frame guards, logs

(function () {
  const DEBUG = true;
  function log(...a){ if(DEBUG){ const m=(top===window?"TOP":"IFRAME"); console.log(`[AF][${m}][${location.hostname}]`, ...a); } }

  // Skip captcha/Google/analytics & sandbox/blank frames early
  const IGNORE_HOSTS = [
    /(^|\.)newassets\.hcaptcha\.com$/i,
    /(^|\.)hcaptcha\.com$/i,
    /(^|\.)google\.com$/i,
    /(^|\.)recaptcha\.net$/i,
    /(^|\.)doubleclick\.net$/i,
    /(^|\.)googletagmanager\.com$/i,
    /(^|\.)content\.googleapis\.com$/i
  ];
  const isIgnoredHost = IGNORE_HOSTS.some(rx => rx.test(location.hostname));
  const sandboxed = (() => {
    try { return document?.documentElement?.matches?.("html[sandbox], iframe[sandbox]") || window?.frameElement?.hasAttribute?.("sandbox"); }
    catch { return false; }
  })();
  const aboutBlank = location.protocol === "about:" || location.href === "about:blank";

  if (isIgnoredHost || sandboxed || aboutBlank) {
    log("Ignoring frame (host/sandbox/about:blank):", location.hostname);
    return;
  }

  // Inject page-world file only once per frame
  function injectOnce() {
    if (document.documentElement.dataset.afInjected) return;
    document.documentElement.dataset.afInjected = "1";

    const s = document.createElement("script");
    s.src = chrome.runtime.getURL("injected.js");
    s.type = "text/javascript";
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
    log("Injected page-world script.");
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectOnce);
  } else {
    injectOnce();
  }

  // Relay fill requests from background → page, and reply back
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "FILL_PROFILE" && msg?.action !== "fill_form") return;

    // Wait for injected engine to boot
    const t0 = performance.now();
    function sendFill() {
      window.postMessage({ __af_action: "FILL", profile: msg.profile, __trace: { ts: Date.now(), tabId: msg.tabId, frameId: msg.frameId } }, "*");
    }

    function onResult(evt){
      const data = evt?.data || {};
      if (data?.__af_action !== "FILL_RESULT") return;
      window.removeEventListener("message", onResult);
      sendResponse(data.ok ? { ok:true, result: data.result } : { ok:false, error: data.error || "Unknown error" });
    }

    window.addEventListener("message", onResult);
    try { sendFill(); } catch {}
    const done = () => true;
    setTimeout(() => { if (!done) sendResponse({ ok:false, error:"Timeout waiting for page response" }); }, 8000);

    return true; // async
  });

  log("Content script ready.");
})();
