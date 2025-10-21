// injected.js — page-world autofill (scoped matching, editor support, dropdown confirm, de-dupe)

(function () {
  const DEBUG = true;
  const STEP_MODE = true;
  const STEP_DELAY = 140;
  const OPEN_MENU_TIMEOUT = 2200;

  // ---- Logging ----
  function log(...a){ if(DEBUG){ const m=(top===window?"TOP":"IFRAME"); console.log(`[AF-INJECT][${m}][${location.hostname}]`, ...a); } }
  function warn(...a){ if(DEBUG) console.warn("[AF-INJECT][WARN]", ...a); }
  function err(...a){ if(DEBUG) console.error("[AF-INJECT][ERR]", ...a); }

  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
  const norm  = (s)=>String(s||"").toLowerCase().replace(/\s+/g," ").trim();

  // ---- Fast frame skip (no inputs / sandboxed / about:blank) ----
  try {
    const sandboxed = document?.documentElement?.matches?.("html[sandbox], iframe[sandbox]") ||
                      window?.frameElement?.hasAttribute?.("sandbox");
    const aboutBlank = location.protocol === "about:" || location.href === "about:blank";
    if (sandboxed || aboutBlank) {
      log("Sandbox/about:blank -> skip");
      return;
    }
  } catch {}
  if (!document.querySelector("input,textarea,select,[role='combobox'],[contenteditable],.select__control,.react-select__control,.ant-select,.MuiInputBase-root")) {
    log("No fields in this frame -> fast skip");
  }

  // ---- User-like events ----
  function realClick(el) {
    el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    el.dispatchEvent(new MouseEvent("mouseup",   { bubbles: true, cancelable: true, view: window }));
    el.dispatchEvent(new MouseEvent("click",     { bubbles: true, cancelable: true, view: window }));
  }
  function press(el, key) {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keyup",   { key, bubbles: true }));
  }
  function setValueLikeReact(input, value) {
    const proto = input.__proto__ || HTMLInputElement.prototype;
    const desc  = Object.getOwnPropertyDescriptor(proto, "value") || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    if (desc && desc.set) desc.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input",  { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  function setTextareaLikeReact(ta, v){
    const proto = ta.__proto__ || HTMLTextAreaElement.prototype;
    const desc  = Object.getOwnPropertyDescriptor(proto, "value") || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
    if (desc && desc.set) desc.set.call(ta, v);
    else ta.value = v;
    ta.dispatchEvent(new Event("input",  { bubbles: true }));
    ta.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  function setNativeSelect(sel, labelOrValue) {
    const want = norm(labelOrValue);
    for (const opt of sel.options) {
      const v = norm(opt.value);
      const t = norm(opt.textContent || "");
      if (v === want || t === want || t.includes(want)) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event("input", { bubbles: true }));
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
    }
    return false;
  }
  async function waitFor(pred, timeout = OPEN_MENU_TIMEOUT, step = 80) {
    const t0 = performance.now();
    return new Promise((res, rej) => {
      (function loop(){
        let el = null;
        try { el = typeof pred === "function" ? pred() : document.querySelector(pred); } catch {}
        if (el) return res(el);
        if (performance.now() - t0 > timeout) return rej(new Error("waitFor timeout"));
        setTimeout(loop, step);
      })();
    });
  }

  // ---- Deep shadow traversal ----
  function queryAllDeep(selector, root = document) {
    const out = [];
    const seen = new Set();
    function push(node) {
      try {
        node.querySelectorAll?.(selector)?.forEach(el => { if(!seen.has(el)){ seen.add(el); out.push(el); } });
      } catch {}
    }
    function walk(node) {
      if (!node) return;
      push(node);
      if (node.shadowRoot) walk(node.shadowRoot);
      const kids = node.children || [];
      for (let i=0;i<kids.length;i++) walk(kids[i]);
    }
    walk(root);
    return out;
  }

  // ---- Group/label helpers ----
  function textOf(el){ return (el?.innerText || el?.textContent || "").trim(); }
  function collectAttrs(el){
    const bits = [];
    const push = (t)=>{ if(t) bits.push(String(t).trim()); };
    try{
      push(el.placeholder); push(el.name); push(el.id);
      push(el.getAttribute?.("aria-label"));
      push(el.getAttribute?.("role"));
      push(el.getAttribute?.("data-testid"));
      push(el.getAttribute?.("data-qa"));
      push(el.getAttribute?.("data-test-id"));
      push(getLabelFor(el));
      push(el.className);
    }catch{}
    return bits.join(" | ").toLowerCase();
  }
  function getLabelFor(el){
    if (!el) return "";
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) return textOf(label);
    }
    const wrap = el.closest("label") || el.closest("div,section,fieldset,li,td,tr");
    if (!wrap) return "";
    // Prefer heading/legend inside the same group
    const h = wrap.querySelector("legend,h1,h2,h3,h4,h5,.label,.field-label");
    if (h) return textOf(h) || textOf(wrap);
    return textOf(wrap);
  }

  // ---- Field discovery with group scoping ----
  function synonyms(k){
    const s = String(k).toLowerCase();
    const map = {
      "full name": ["full name","name"],
      "first name":["first name","given name","forename"],
      "last name":["last name","surname","family name"],
      "email":["email","email address"],
      "phone":["phone","mobile","phone number","contact number"],
      "address":["address","street address","current address"],
      "city":["city","town","location"],
      "state":["state","province","region"],
      "country":["country","nation"],
      "zip":["zip","zip code","postal","postal code"],
      "linkedin":["linkedin","linkedin url","linkedin profile"],
      "github":["github","github url","github profile"],
      "portfolio":["portfolio","website","personal site","site","url","homepage"],
      "citizenship":["citizenship","citizenship status"],
      "work authorization":["work authorization","authorized to work","work permit","work eligibility"],
      "require sponsorship":["sponsorship","require sponsorship","sponsorship required","need sponsorship"],
      "nationality":["nationality","citizen of"],
      "gender":["gender","gender identity"],
      "ethnicity":["ethnicity"],
      "race":["race"],
      "disability":["disability","disability status"],
      "veteran":["veteran","veteran status"],
      "skills":["skills"],
      "languages":["languages","language proficiency"],
      "achievements":["achievements","accomplishments"],
      "job type":["job type","work preference","work type"],
      "preferred location":["preferred location","location preference","desired location","location"],
      "current ctc":["current ctc","current compensation","current salary"],
      "expected ctc":["expected ctc","expected compensation","expected salary"],
      "relocate":["relocate","willing to relocate"],
      "notice period":["notice period","notice","availability"],
      "school":["school","university","college"],
      "degree":["degree","education level"],
      "field of study":["field of study","major"],
      "grade":["grade","gpa"],
      "company":["company","employer","organization"],
      "role":["role","position","job title","title"],
      "experience type":["experience type","employment type"],
      "start month":["start month","from month","month started"],
      "start year":["start year","from year","year started"],
      "end month":["end month","to month","month ended"],
      "end year":["end year","to year","year ended"],
      "current":["current","currently working"],
      "description":["description","summary","responsibilities"]
    };
    return map[s] || [s];
  }

  // Restrict search to a “group” (closest fieldset/section/div with label/legend/headline).
  function closestGroup(el){
    return el.closest("fieldset,section,form,div,li,td,tr") || document;
  }

  function looksLikeCombo(el){
    const role = (el.getAttribute?.("role") || "").toLowerCase();
    const hasPopup    = (el.getAttribute?.("aria-haspopup") || "").toLowerCase() === "listbox";
    const hasExpanded = el.hasAttribute?.("aria-expanded");
    const cls = (el.className || "").toLowerCase();
    return role === "combobox" || hasPopup || hasExpanded ||
           cls.includes("select") || cls.includes("dropdown") ||
           cls.includes("react-select") || cls.includes("select__control") ||
           cls.includes("mui") || cls.includes("ant-select");
  }
  function closestCombo(el){
    return el.closest("[role='combobox'], [aria-haspopup='listbox'], [aria-expanded], .select2-selection, .choices__inner, .vs__selected-options, .react-select__control, .select__control, .MuiInputBase-root, .ant-select, [class*='select'], [class*='dropdown']");
  }

  // ---- Dropdown driver (portal-aware + confirmation) ----
  async function fillDropdownElement(trigger, labelOrValue) {
    const want = String(labelOrValue || "").trim();
    if (!want) return false;
    const wantLower = want.toLowerCase();
    log("Dropdown attempt:", { want });

    const control = trigger.querySelector?.(".select__control, .react-select__control") || trigger;

    // Nearby native <select>?
    const sel = trigger.tagName === "SELECT" ? trigger
      : trigger.closest("label,div,section,fieldset")?.querySelector("select");
    if (sel && setNativeSelect(sel, want)) {
      log("Dropdown via native <select>");
      return true;
    }

    control.scrollIntoView({ block: "center" });
    realClick(control);
    await sleep(80);

    try{
      await waitFor(() => document.querySelector(
        "[role='listbox'], [id*='listbox'], [role='menu'], .MuiPopover-root, .MuiMenu-paper, .ant-select-dropdown, .select2-results__options, .react-select__menu, .select__menu, [class$='__menu']"
      ), OPEN_MENU_TIMEOUT);
    }catch{/* tolerate */ }

    const localOptions = Array.from((trigger.closest("div,section,fieldset,li,td") || document).querySelectorAll(
      "[role='option'], [role='menuitem'], .ant-select-item, .MuiAutocomplete-option, .select2-results__option, .choices__item--choice, .react-select__option, .select__option, [class$='__option']"
    ));
    const portalOptions = queryAllDeep(
      "[role='listbox'] [role='option'], [role='menu'] [role='menuitem'], [id*='listbox'] [role='option'], .ant-select-item, .MuiAutocomplete-option, .select2-results__option, .choices__item--choice, .react-select__option, .select__option, [class$='__option']"
    );
    const options = localOptions.length ? localOptions : portalOptions;
    log("Options found:", options.length);

    // exact -> alias -> contains
    let match = options.find(o => norm(o.textContent || "") === norm(want));
    if (!match) match = options.find(o => norm(o.textContent || "") === norm(want.replace(/\./g,""))); // minor clean
    if (!match) match = options.find(o => (o.textContent || "").toLowerCase().includes(wantLower));

    if (match) {
      match.scrollIntoView({ block: "center" });
      realClick(match);
      await sleep(150);
      const ctrlText = (control.innerText || control.textContent || "").toLowerCase();
      if (ctrlText.includes(wantLower)) {
        log("Dropdown confirmed via control text");
        return true;
      }
      press(control, "Enter");
      await sleep(120);
      return true;
    }

    // searchable input
    const input = document.querySelector("[role='combobox'] input, .react-select__input input, .select__control input, .MuiAutocomplete-input, .ant-select-selection-search-input");
    if (input) {
      input.focus();
      setValueLikeReact(input, "");
      for (const ch of want) {
        const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
        desc?.set?.call(input, (input.value || "") + ch);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent("keydown", { key: ch, bubbles: true }));
        input.dispatchEvent(new KeyboardEvent("keyup",   { key: ch, bubbles: true }));
      }
      await sleep(220);
      press(input, "Enter");
      await sleep(150);
      log("Dropdown selected via type+Enter");
      return true;
    }

    // keyboard fallback
    press(control, "ArrowDown");
    await sleep(80);
    press(control, "Enter");
    await sleep(120);
    log("Dropdown fallback: ArrowDown + Enter");
    return true;
  }

  // ---- Choice groups (div radios/checkboxes) ----
  function findChoiceCandidates(scope) {
    return queryAllDeep(
      "input[type='radio'], input[type='checkbox'], [role='radio'], [role='checkbox'], [data-test-id], .choice, .option, .pill, .chip, .selectable, .segmented-control button, [class*='option'], .checkbox, .radio",
      scope
    );
  }
  function clickChoiceByText(scope, value) {
    const want = norm(value);
    if (!want) return false;
    let cands = findChoiceCandidates(scope).filter(el => el.offsetParent !== null);
    if (!cands.length && scope !== document) cands = findChoiceCandidates(document).filter(el => el.offsetParent !== null);
    let match = cands.find(el => norm(textOf(el)).includes(want));
    if (!match) match = cands.find(el => norm(el.value || "") === want);
    if (match) {
      match.scrollIntoView({ block: "center" });
      realClick(match);
      const inp = match.matches("input") ? match : match.querySelector?.("input[type='radio'],input[type='checkbox']");
      if (inp && !inp.checked) realClick(inp);
      return true;
    }
    return false;
  }
  async function fillChoiceGroupByLabel(labelRegex, value) {
    if (!value) return false;
    const labs = queryAllDeep("label, .label, .field-label, legend, [data-test-id*='legend'], h1,h2,h3,h4");
    const labelEl = labs.find(l => labelRegex.test(textOf(l)));
    const scope = labelEl?.closest("fieldset, section, div, form") || document;
    const ok = clickChoiceByText(scope, value);
    if (!ok) warn("Choice group not matched for", labelRegex, "value:", value);
    return ok;
  }

  // ---- Rich editors (contenteditable, Quill, Draft.js, ProseMirror, Slate) ----
  function looksLikeEditor(el){
    const cls = (el.className || "").toLowerCase();
    return el.isContentEditable ||
           cls.includes("ql-editor") || cls.includes("notion") ||
           cls.includes("public-draft") || cls.includes("DraftEditor-root".toLowerCase()) ||
           cls.includes("ProseMirror".toLowerCase()) || cls.includes("slate-editor") ||
           el.getAttribute?.("role") === "textbox";
  }
  function setEditorValue(el, value){
    try{
      // contenteditable
      if (el.isContentEditable || el.getAttribute?.("contenteditable")==="true") {
        el.focus();
        // replace entire contents
        el.innerHTML = "";
        el.textContent = value;
        el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      // Draft.js / Slate / ProseMirror often attach input role="textbox"
      if (el.getAttribute?.("role")==="textbox") {
        el.focus();
        el.textContent = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
    }catch(e){ warn("setEditorValue error:", e.message); }
    return false;
  }

  // ---- Field registry to avoid re-touching the same element ----
  const filledOnce = new WeakSet();

  function markFilled(el){
    filledOnce.add(el);
    try { el.dataset.afFilled = "1"; } catch {}
  }
  function wasFilled(el){
    return filledOnce.has(el) || el.dataset?.afFilled === "1";
  }

  // ---- Candidate search (scoped) ----
  function findFields(keyword) {
    const keys = synonyms(keyword);
    const nodes = queryAllDeep(
      "input, textarea, select, [role='combobox'], [role='textbox'], [contenteditable], [aria-haspopup='listbox'], [aria-expanded], " +
      ".select2-selection, .choices__inner, .vs__selected-options, .react-select__control, .select__control, .MuiInputBase-root, .ant-select, " +
      "[data-testid*='select'], [class*='select'], [class*='dropdown']"
    );

    return nodes.filter(el => {
      const attr = collectAttrs(el);
      if (keys.some(k => attr.includes(k))) return true;

      // Group text
      const grp = closestGroup(el);
      const head = grp?.querySelector?.("legend,h1,h2,h3,h4,label,.label,.field-label");
      const grpText = norm((head ? textOf(head) : textOf(grp)));
      if (grpText && keys.some(k => grpText.includes(k))) return true;

      // aria-labelledby
      const ids = (el.getAttribute?.("aria-labelledby") || "").split(/\s+/).filter(Boolean);
      if (ids.length) {
        const txt = ids.map(id => document.getElementById(id)?.innerText || "").join(" ").toLowerCase();
        if (txt && keys.some(k => txt.includes(k))) return true;
      }
      return false;
    });
  }

  // ---- Profile normalization (same as before) ----
  function normalizeProfile(api) {
    const fullName = [api.firstName, api.lastName].filter(Boolean).join(" ").trim();
    const address  = [api.street, api.city, api.state, api.zipCode, api.country].filter(Boolean).join(", ");
    const yn = (b)=> (b===true ? "Yes" : b===false ? "No" : "");

    function normGender(s){ if(!s) return ""; const v=s.toLowerCase(); if(v.includes("male"))return"Male"; if(v.includes("female"))return"Female"; if(v.includes("non"))return"Non-binary"; if(v.includes("prefer")&&v.includes("not"))return"Prefer not to say"; return "Other"; }
    function normEthnicity(s){ if(!s) return ""; const v=s.toLowerCase(); if(v.includes("not hispanic"))return"Not Hispanic or Latino"; if(v.includes("hispanic")||v.includes("latino"))return"Hispanic or Latino"; if(v.includes("prefer")&&v.includes("not"))return"Prefer not to say"; return s; }
    function normRace(s){ if(!s) return ""; const v=s.toLowerCase(); if(v.includes("two")&&v.includes("race"))return"Two or More Races"; if(v.includes("white"))return"White"; if(v.includes("black")||v.includes("african"))return"Black or African American"; if(v.includes("asian"))return"Asian"; if(v.includes("hawaiian")||v.includes("pacific"))return"Native Hawaiian or Other Pacific Islander"; if(v.includes("american indian")||v.includes("alaska"))return"American Indian or Alaska Native"; if(v.includes("prefer")&&v.includes("not"))return"Prefer not to say"; return s; }
    function normYesNoPrefer(s){ if(s==null) return ""; const v=String(s).toLowerCase(); if(v==="yes"||v==="true")return"Yes"; if(v==="no"||v==="false")return"No"; if(v.includes("prefer")&&v.includes("not"))return"Prefer not to say"; return s; }
    function normJobType(s){ if(!s) return ""; const v=s.toLowerCase(); if(v.includes("remote"))return"Remote"; if(v.includes("on")&&v.includes("site"))return"Onsite"; if(v.includes("hybrid"))return"Hybrid"; return s; }

    const skillsStr = (api.skills || []).join(", ");
    const languagesStr = (api.languages || []).map(l => l?.proficiency ? `${l.language} (${l.proficiency})` : l.language).join(", ");
    const achievementsStr = (api.achievements || []).join(", ");

    return {
      fullName,
      firstName: api.firstName || "",
      lastName: api.lastName || "",
      pronouns: api.pronouns || "",
      email: api.email || "",
      phoneCountryCode: api.phoneCountryCode || "",
      phone: api.phone || "",
      street: api.street || "",
      city: api.city || "",
      state: api.state || "",
      country: api.country || "",
      zipCode: api.zipCode || "",
      address,

      portfolio: api.portfolio || "",
      linkedin: api.linkedin || "",
      github: api.github || "",
      twitter: api.twitter || "",
      other: api.otherSocialLink || "",

      nationality: api.nationality || "",
      usAuthorized: yn(api.usAuthorized),
      sponsorshipRequired: yn(api.sponsorshipRequired),
      citizenshipStatus: api.citizenshipStatus || "",

      gender: normGender(api.gender),
      ethnicity: normEthnicity(api.ethnicity),
      race: normRace(api.race),
      disabilityStatus: normYesNoPrefer(api.disabilityStatus),
      veteranStatus: normYesNoPrefer(api.veteranStatus),

      totalExperienceInYears: api.totalExperienceInYears || "",
      skills: skillsStr,
      languages: languagesStr,
      achievements: achievementsStr,

      jobType: normJobType(api.jobType),
      preferredLocations: (api.preferredLocations || []).join(", "),
      currentCTC: api.currentCTC || "",
      expectedCTC: api.expectedCTC || "",
      willingToRelocate: yn(api.willingToRelocate),
      noticePeriodDays: String(api.noticePeriodDurationInDays ?? ""),

      _experience: api.experience || [],
      _education: api.education || []
    };
  }

  // ---- Public entry: fill pipeline ----
  async function fillAll(mapped) {
    const tasks = [];

    // Basic/contact
    tasks.push(() => fillField("full name", mapped.fullName));
    tasks.push(() => fillField("first name", mapped.firstName));
    tasks.push(() => fillField("last name", mapped.lastName));
    tasks.push(() => fillField("email", mapped.email));
    tasks.push(() => fillField("phone", mapped.phone));
    tasks.push(() => fillField("address", mapped.address));
    tasks.push(() => fillField("city", mapped.city));
    tasks.push(() => fillField("state", mapped.state));
    tasks.push(() => fillField("country", mapped.country));
    tasks.push(() => fillField("zip", mapped.zipCode));
    tasks.push(() => fillField("postal code", mapped.zipCode));

    // Socials
    tasks.push(() => fillField("linkedin", mapped.linkedin));
    tasks.push(() => fillField("github", mapped.github));
    tasks.push(() => fillField("portfolio", mapped.portfolio));
    tasks.push(() => fillField("website", mapped.portfolio));

    // Work auth
    tasks.push(() => fillField("citizenship", mapped.citizenshipStatus) || fillChoiceGroupByLabel(/citizenship/i, mapped.citizenshipStatus));
    tasks.push(() => fillField("work authorization", mapped.usAuthorized) || fillChoiceGroupByLabel(/work\s*authorization|work\s*eligibility/i, mapped.usAuthorized));
    tasks.push(() => fillField("require sponsorship", mapped.sponsorshipRequired) || fillChoiceGroupByLabel(/sponsorship/i, mapped.sponsorshipRequired));
    tasks.push(() => fillField("nationality", mapped.nationality));

    // Demographics
    tasks.push(() => fillField("gender", mapped.gender) || fillChoiceGroupByLabel(/gender/i, mapped.gender));
    tasks.push(() => fillField("ethnicity", mapped.ethnicity) || fillChoiceGroupByLabel(/ethnicity/i, mapped.ethnicity));
    tasks.push(() => fillField("race", mapped.race) || fillChoiceGroupByLabel(/race/i, mapped.race));
    tasks.push(() => fillField("disability", mapped.disabilityStatus) || fillChoiceGroupByLabel(/disability/i, mapped.disabilityStatus));
    tasks.push(() => fillField("veteran", mapped.veteranStatus) || fillChoiceGroupByLabel(/veteran/i, mapped.veteranStatus));

    // Career summary
    tasks.push(() => fillField("skills", mapped.skills));
    tasks.push(() => fillField("languages", mapped.languages));
    tasks.push(() => fillField("achievements", mapped.achievements));

    // Preferences/comp
    tasks.push(() => fillField("job type", mapped.jobType) || fillChoiceGroupByLabel(/job\s*type|work\s*(preference|type)/i, mapped.jobType));
    tasks.push(() => fillField("preferred location", mapped.preferredLocations));
    tasks.push(() => fillField("current ctc", mapped.currentCTC));
    tasks.push(() => fillField("expected ctc", mapped.expectedCTC));
    tasks.push(() => fillField("relocate", mapped.willingToRelocate) || fillChoiceGroupByLabel(/relocat/i, mapped.willingToRelocate));
    tasks.push(() => fillField("notice period", mapped.noticePeriodDays));

    // Repeaters (first row for now; adapters can override)
    tasks.push(() => fillEducationRepeater(mapped._education));
    tasks.push(() => fillExperienceRepeater(mapped._experience));

    let filled = 0;
    for (let i=0;i<tasks.length;i++){
      try{
        const ok = await tasks[i]();
        log(`Task ${i+1}/${tasks.length} -> ${ok ? "OK" : "skip"}`);
        if (ok) filled++;
      }catch(e){ warn(`Task ${i+1} error:`, e.message); }
      if (STEP_MODE) await sleep(STEP_DELAY);
    }
    log("Sequential fill complete. Filled:", filled);
    return { filledCount: filled, totalTasks: tasks.length };
  }

  // ---- Repeaters (scoped) ----
  function monthName(dateStr){ if(!dateStr) return ""; const d=new Date(dateStr); return isNaN(d)?"":d.toLocaleString("en-US",{month:"short"}); }
  function yearStr(dateStr){ if(!dateStr) return ""; const d=new Date(dateStr); return isNaN(d)?"":String(d.getFullYear()); }

  async function fillEducationRepeater(list) {
    if (!Array.isArray(list) || !list.length) return false;
    const row = list[0];
    let ok = false;
    ok |= await fillField("school", row.school || "");
    ok |= await fillField("degree", row.degree || "");
    ok |= await fillField("field of study", row.fieldOfStudy || "");
    ok |= await fillField("grade", row.grade || "");
    ok |= await fillField("start month", monthName(row.startDate));
    ok |= await fillField("start year", yearStr(row.startDate));
    ok |= await fillField("end month", monthName(row.endDate));
    ok |= await fillField("end year", yearStr(row.endDate));
    return !!ok;
  }

  async function fillExperienceRepeater(list) {
    if (!Array.isArray(list) || !list.length) return false;
    const row = list[0];
    let ok = false;
    ok |= await fillField("company", row.company || "");
    ok |= await fillField("role", row.role || "");
    ok |= await fillField("title", row.role || "");
    ok |= await fillField("experience type", row.experienceType || "") || await fillChoiceGroupByLabel(/experience\s*type|employment\s*type/i, row.experienceType || "");
    ok |= await fillField("start month", monthName(row.startDate));
    ok |= await fillField("start year", yearStr(row.startDate));
    ok |= await fillField("end month", monthName(row.endDate));
    ok |= await fillField("end year", yearStr(row.endDate));
    ok |= await fillField("current", row.isCurrent ? "Yes" : "No") || await fillChoiceGroupByLabel(/current|currently working/i, row.isCurrent ? "Yes" : "No");
    ok |= await fillField("description", row.description || "");
    return !!ok;
  }

  // ---- Field driver (with de-dupe + editor support + scoped dropdown) ----
  async function fillField(keyword, value){
    if (!value) return false;
    const candidates = findFields(keyword).filter(el => el.offsetParent !== null);
    log(`Field "${keyword}" -> "${value}" | candidates:`, candidates.length);
    for (const el of candidates) {
      try {
        if (wasFilled(el)) continue;

        const tag  = (el.tagName || "").toLowerCase();
        const type = (el.getAttribute?.("type") || "").toLowerCase();

        // Native select
        if (tag === "select") {
          const ok = setNativeSelect(el, value);
          log("native <select>:", ok, el);
          if (ok) { markFilled(el); return true; }
        }

        // Combobox/custom dropdown
        if (looksLikeCombo(el)) {
          const ok = await fillDropdownElement(el, value);
          log("combobox:", ok, el);
          if (ok) { markFilled(el); return true; }
        }

        // contenteditable / rich editors
        if (looksLikeEditor(el)) {
          const ok = setEditorValue(el, String(value));
          if (ok) { log("editor set:", el); markFilled(el); return true; }
        }

        // Inputs
        if (tag === "input") {
          if (["checkbox","radio"].includes(type)) {
            const want = typeof value === "string" ? ["yes","true","1","on"].includes(value.toLowerCase()) : !!value;
            if (el.checked !== want) realClick(el);
            markFilled(el);
            return true;
          }
          const ok = setValueLikeReact(el, String(value));
          if (ok) { log("input set:", el); markFilled(el); return true; }
        }

        // Textarea
        if (tag === "textarea") {
          const ok = setTextareaLikeReact(el, String(value));
          if (ok) { log("textarea set:", el); markFilled(el); return true; }
        }

        // Parent combobox wrapper
        const parentCombo = closestCombo(el);
        if (parentCombo) {
          const ok = await fillDropdownElement(parentCombo, value);
          log("parent combobox:", ok, parentCombo);
          if (ok) { markFilled(el); return true; }
        }
      } catch (e) {
        warn("fillField candidate error:", e.message);
      }
    }

    // Semantic choice-group backup
    if (/^(gender|race|ethnicity|veteran|disability|experience type|job type|relocate|current)$/i.test(String(keyword))) {
      const ok = await fillChoiceGroupByLabel(new RegExp(keyword, "i"), value);
      if (ok) return true;
    }

    warn(`Field "${keyword}" not filled.`);
    return false;
  }

  // ---- Main message entry ----
  window.addEventListener("message", async (evt) => {
    const data = evt?.data || {};
    if (data?.__af_action !== "FILL") return;

    try{
      const mapped = normalizeProfile(data.profile || {});
      const result = await fillAll(mapped);
      window.postMessage({ __af_action: "FILL_RESULT", ok: true, result }, "*");
    }catch(e){
      window.postMessage({ __af_action: "FILL_RESULT", ok: false, error: String(e?.message || e) }, "*");
    }
  });

  log("Injected engine ready.");
})();
