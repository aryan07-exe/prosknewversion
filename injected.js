// injected.js — page-world autofill engine (MAIN world)
// - Deep Shadow DOM traversal
// - Greenhouse/Lever adapters (div-choice groups, react-select variants incl. .select__*)
// - Confirmed dropdown selection
// - Fast skip for frames with no inputs

(function () {
  const DEBUG = true;
  const STEP_MODE = true;
  const STEP_DELAY = 160;
  const OPEN_MENU_TIMEOUT = 2000;

  function log(...a){ if(DEBUG){ const m=(top===window?"TOP":"IFRAME"); console.log(`[AF-INJECT][${m}][${location.hostname}]`, ...a); } }
  function warn(...a){ if(DEBUG) console.warn("[AF-INJECT][WARN]", ...a); }
  function err(...a){ if(DEBUG) console.error("[AF-INJECT][ERR]", ...a); }
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

  // ---------- Quick frame capability check ----------
  // If a frame has no obvious fields, we skip quickly (reduces noisy logs on content.googleapis.com)
  function frameHasFields() {
    const qs = "input,textarea,select,[role='combobox'],[aria-haspopup='listbox'],.select__control,.react-select__control,.ant-select,.MuiInputBase-root";
    return document.querySelector(qs) != null;
  }
  if (!frameHasFields()) {
    log("No fields in this frame -> fast skip");
  }

  // ---------- User-like event helpers (MAIN world) ----------
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
  function setInputValue(input, value) {
    const proto = input.__proto__ || HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value") || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    desc?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  function setTextareaValue(ta, value) {
    const proto = ta.__proto__ || HTMLTextAreaElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value") || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
    desc?.set?.call(ta, value);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  function setNativeSelect(sel, labelOrValue) {
    const want = String(labelOrValue).toLowerCase();
    for (const opt of sel.options) {
      const v = String(opt.value).toLowerCase();
      const t = String(opt.textContent || "").toLowerCase();
      if (v === want || t === want || t.includes(want)) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event("input", { bubbles: true }));
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
    }
    return false;
  }
  async function waitFor(pred, timeout = OPEN_MENU_TIMEOUT, step = 60) {
    const t0 = performance.now();
    return new Promise((res, rej) => {
      (function loop() {
        let el = null;
        try { el = typeof pred === "function" ? pred() : document.querySelector(pred); } catch {}
        if (el) return res(el);
        if (performance.now() - t0 > timeout) return rej(new Error("waitFor timeout"));
        setTimeout(loop, step);
      })();
    });
  }

  // ---------- Deep-shadow traversal ----------
  // queryAllDeep("selector") walks the composed tree including shadow roots.
  function queryAllDeep(selector, root = document) {
    const out = [];
    const seen = new Set();

    function pushMatch(node) {
      try {
        node.querySelectorAll?.(selector)?.forEach(el => { if (!seen.has(el)) { seen.add(el); out.push(el); } });
      } catch {}
    }

    function walk(node) {
      if (!node) return;
      pushMatch(node);
      // shadow root
      if (node.shadowRoot) walk(node.shadowRoot);
      // children
      const kids = node.children || [];
      for (let i = 0; i < kids.length; i++) walk(kids[i]);
    }
    walk(root);
    return out;
  }

  // ---------- Normalization & helpers ----------
  const norm = (s)=>String(s||"").toLowerCase().replace(/[\s_]+/g," ").replace(/[^\w ]+/g,"").trim();
  const ALIASES = {
    "non-binary": ["non binary","nonbinary","gender non conforming","gender nonconforming","genderqueer"],
    "prefer not to say": ["prefer not to say","prefer not to disclose","i choose not to disclose","decline to answer","prefer not to answer"],
    "hispanic or latino": ["hispanic","latino","latina","latinx"],
    "not hispanic or latino": ["not hispanic","not latino"],
    "two or more races": ["two or more","multiracial","two or more race"],
    "native hawaiian or other pacific islander": ["pacific islander","native hawaiian"],
    "american indian or alaska native": ["american indian","alaska native","native american"],
    "master of science": ["ms","m s","m.sc","msc"]
  };
  function aliasMatch(hay, needle) {
    const H = norm(hay);
    const N = norm(needle);
    if (!H || !N) return false;
    if (H === N || H.includes(N)) return true;
    const alt = ALIASES[N] || [];
    return alt.some(a => H === norm(a) || H.includes(norm(a)));
  }

  function monthName(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return isNaN(d) ? "" : d.toLocaleString("en-US", { month: "short" });
  }
  function yearStr(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return isNaN(d) ? "" : String(d.getFullYear());
  }
  function getLabelFor(el) {
    if (!el) return "";
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) return (label.textContent || "").trim();
    }
    const wrap = el.closest("label") || el.closest("div,section,fieldset");
    return wrap ? (wrap.innerText || wrap.textContent || "").trim() : "";
  }

  // ---------- Finder ----------
  function synonyms(k) {
    const s = String(k).toLowerCase();
    const map = {
      "full name": ["full name", "name"],
      "first name": ["first name", "given name", "forename"],
      "last name": ["last name", "surname", "family name"],
      "email": ["email", "email address"],
      "phone": ["phone", "mobile", "phone number", "contact number"],
      "address": ["address", "street address", "current address"],
      "city": ["city", "town", "location"],
      "state": ["state", "province", "region"],
      "country": ["country", "nation"],
      "zip": ["zip", "zip code", "postal", "postal code"],

      "linkedin": ["linkedin", "linkedin url", "linkedin profile"],
      "github":   ["github", "github url", "github profile"],
      "portfolio":["portfolio", "website", "personal site", "site", "url", "homepage"],

      "citizenship": ["citizenship", "citizenship status"],
      "work authorization": ["work authorization", "authorized to work", "work permit", "work eligibility"],
      "require sponsorship": ["sponsorship", "require sponsorship", "sponsorship required", "need sponsorship"],
      "nationality": ["nationality", "citizen of"],

      "gender": ["gender", "gender identity"],
      "ethnicity": ["ethnicity"],
      "race": ["race"],
      "disability": ["disability", "disability status"],
      "veteran": ["veteran", "veteran status"],

      "skills": ["skills"],
      "languages": ["languages", "language proficiency"],
      "achievements": ["achievements", "accomplishments"],
      "job type": ["job type", "work preference", "work type"],
      "preferred location": ["preferred location", "location preference", "desired location", "location"],
      "current ctc": ["current ctc", "current compensation", "current salary"],
      "expected ctc": ["expected ctc", "expected compensation", "expected salary"],
      "relocate": ["relocate", "willing to relocate"],
      "notice period": ["notice period", "notice", "availability"],

      "school": ["school", "university", "college"],
      "degree": ["degree", "education level"],
      "field of study": ["field of study", "major"],
      "grade": ["grade", "gpa"],
      "company": ["company", "employer", "organization"],
      "role": ["role", "position", "job title", "title"],
      "experience type": ["experience type", "employment type"],
      "start month": ["start month", "from month", "month started"],
      "start year": ["start year", "from year", "year started"],
      "end month": ["end month", "to month", "month ended"],
      "end year": ["end year", "to year", "year ended"],
      "current": ["current", "currently working"]
    };
    return map[s] || [s];
  }

  function collectAttrs(el) {
    const bits = [];
    const push = (t) => { if (t) bits.push(String(t).trim()); };
    try {
      push(el.placeholder);
      push(el.name);
      push(el.id);
      push(el.getAttribute?.("aria-label"));
      push(el.getAttribute?.("role"));
      push(el.getAttribute?.("data-testid"));
      push(el.getAttribute?.("data-qa"));
      push(el.getAttribute?.("data-test-id"));
      push(getLabelFor(el));
      push(el.className);
    } catch {}
    return bits.join(" | ").toLowerCase();
  }

  function findFields(fieldType) {
    const keys = synonyms(fieldType);
    const nodes = queryAllDeep(
      "input, textarea, select, [role='combobox'], [role='textbox'], [aria-haspopup='listbox'], [aria-expanded], " +
      ".select2-selection, .choices__inner, .vs__selected-options, " +
      ".react-select__control, .select__control, .MuiInputBase-root, .ant-select, " +
      "[data-testid*='select'], [class*='select'], [class*='dropdown']"
    );

    return nodes.filter(el => {
      const attr = collectAttrs(el);
      if (keys.some(k => attr.includes(k))) return true;

      const grp = el.closest("label,fieldset,section,div");
      const grpText = (grp?.querySelector("legend,h1,h2,h3,label")?.innerText || grp?.innerText || "").toLowerCase();
      if (grpText && keys.some(k => grpText.includes(k))) return true;

      const ids = (el.getAttribute?.("aria-labelledby") || "").split(/\s+/).filter(Boolean);
      if (ids.length) {
        const txt = ids.map(id => document.getElementById(id)?.innerText || "").join(" ").toLowerCase();
        if (txt && keys.some(k => txt.includes(k))) return true;
      }
      return false;
    });
  }

  function looksLikeCombo(el) {
    const role = (el.getAttribute?.("role") || "").toLowerCase();
    const hasPopup = (el.getAttribute?.("aria-haspopup") || "").toLowerCase() === "listbox";
    const hasExpanded = el.hasAttribute?.("aria-expanded");
    const cls = (el.className || "").toLowerCase();
    return role === "combobox" || hasPopup || hasExpanded ||
      cls.includes("select") || cls.includes("dropdown") ||
      cls.includes("react-select") || cls.includes("select__control") ||
      cls.includes("mui") || cls.includes("ant-select");
  }
  function closestCombo(el) {
    return el.closest(
      "[role='combobox'], [aria-haspopup='listbox'], [aria-expanded], " +
      ".select2-selection, .choices__inner, .vs__selected-options, " +
      ".react-select__control, .select__control, .MuiInputBase-root, .ant-select, [class*='select'], [class*='dropdown']"
    );
  }

  // ---------- Dropdown driver (portal-aware + confirmation) ----------
  async function fillDropdownElement(trigger, labelOrValue) {
    const want = String(labelOrValue || "").trim();
    if (!want) return false;
    const wantLower = want.toLowerCase();
    log("Dropdown attempt:", { want });

    // Resolve a visible trigger: react-select often has an inner control
    const control = trigger.querySelector?.(".select__control, .react-select__control") || trigger;

    // Nearby <select>?
    const sel = trigger.tagName === "SELECT" ? trigger
      : trigger.closest("label,div,section,fieldset")?.querySelector("select");
    if (sel && setNativeSelect(sel, want)) {
      log("Dropdown via native <select>");
      return true;
    }

    // Open control
    control.scrollIntoView({ block: "center" });
    realClick(control);
    await sleep(80);

    // Wait for menu
    try {
      await waitFor(() => document.querySelector(
        "[role='listbox'], [id*='listbox'], [role='menu'], " +
        ".MuiPopover-root, .MuiMenu-paper, .ant-select-dropdown, " +
        ".select2-results__options, .react-select__menu, .select__menu, [class$='__menu']"
      ), OPEN_MENU_TIMEOUT);
    } catch { /* tolerate */ }

    // Gather options (local + global portals)
    const localOptions = Array.from((trigger.closest("div,section,fieldset,li,td") || document).querySelectorAll(
      "[role='option'], [role='menuitem'], .ant-select-item, .MuiAutocomplete-option, " +
      ".select2-results__option, .choices__item--choice, .react-select__option, .select__option, [class$='__option']"
    ));
    const globalOptions = queryAllDeep(
      "[role='listbox'] [role='option'], [role='menu'] [role='menuitem'], [id*='listbox'] [role='option'], " +
      ".ant-select-item, .MuiAutocomplete-option, .select2-results__option, .choices__item--choice, " +
      ".react-select__option, .select__option, [class$='__option']"
    );
    const options = localOptions.length ? localOptions : globalOptions;
    log("Options found:", options.length);

    // Pick match
    let match = options.find(o => norm(o.textContent || "") === norm(want));
    if (!match) match = options.find(o => aliasMatch(o.textContent || "", want));
    if (!match) match = options.find(o => (o.textContent || "").toLowerCase().includes(wantLower));

    if (match) {
      match.scrollIntoView({ block: "center" });
      realClick(match);
      await sleep(150);
      // Confirm: control value/placeholder should now include chosen text
      const ctrlText = (control.innerText || control.textContent || "").toLowerCase();
      if (ctrlText.includes(wantLower)) {
        log("Dropdown confirmed via control text");
        return true;
      }
      log("Option clicked but control text not updated; trying Enter");
      press(control, "Enter");
      await sleep(120);
      return true;
    }

    // Type-to-filter
    const input = document.querySelector(
      "[role='combobox'] input, .react-select__input input, .select__control input, .MuiAutocomplete-input, .ant-select-selection-search-input"
    );
    if (input) {
      input.focus();
      setInputValue(input, "");
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

    // Keyboard fallback
    press(control, "ArrowDown");
    await sleep(80);
    press(control, "Enter");
    await sleep(120);
    log("Dropdown fallback: ArrowDown + Enter");
    return true;
  }

  // ---------- Choice groups (div radios/checkboxes) ----------
  function findChoiceCandidates(scope) {
    return queryAllDeep(
      "input[type='radio'], input[type='checkbox'], " +
      "[role='radio'], [role='checkbox'], " +
      "[data-test-id], .checkbox-module_selector, .radio-module_selector, .checkbox-module_selector-medium, " +
      ".choice, .option, [class*='option'], .segmented-control button, .pill, .chip, .selectable, .item"
    , scope);
  }
  function textOf(el) {
    const t = (el.innerText || el.textContent || "").trim();
    const data = el.getAttribute?.("data-test-id") || "";
    return (t + " " + data).trim();
  }
  async function clickChoiceByText(scope, value) {
    const want = String(value || "").trim();
    if (!want) return false;
    let cands = findChoiceCandidates(scope).filter(el => el.offsetParent !== null);
    if (!cands.length && scope !== document) cands = findChoiceCandidates(document).filter(el => el.offsetParent !== null);

    let match = cands.find(el => norm(textOf(el)) === norm(want) || aliasMatch(textOf(el), want));
    if (!match) match = cands.find(el => {
      const txt = textOf(el);
      return norm(txt).includes(norm(want)) || aliasMatch(txt, want);
    });

    if (match) {
      match.scrollIntoView({ block: "center" });
      realClick(match);
      const inp = match.matches("input") ? match : match.querySelector?.("input[type='radio'],input[type='checkbox']");
      if (inp && !inp.checked) { realClick(inp); }
      await sleep(120);
      log("Choice picked:", textOf(match));
      return true;
    }
    return false;
  }
  async function fillChoiceGroupByLabel(labelRegex, value) {
    if (!value) return false;
    const labs = queryAllDeep("label, .label, .field-label, legend, [data-test-id*='legend']");
    const labelEl = labs.find(l => labelRegex.test((l.innerText || l.textContent || "").trim()));
    const scope = labelEl?.closest("fieldset, section, div, form") || document;
    const ok = await clickChoiceByText(scope, value);
    if (!ok) warn("Choice group not matched for", labelRegex, "value:", value);
    return ok;
  }

  // ---------- Field driver ----------
  async function fillField(keyword, value) {
    if (!value) return false;
    const candidates = findFields(keyword);
    log(`Field "${keyword}" -> "${value}" | candidates:`, candidates.length);

    for (const el of candidates) {
      try {
        const tag = (el.tagName || "").toLowerCase();

        if (tag === "select") {
          const ok = setNativeSelect(el, value);
          log("native <select>:", ok, el);
          if (ok) return true;
        }

        if (looksLikeCombo(el)) {
          const ok = await fillDropdownElement(el, value);
          log("combobox:", ok, el);
          if (ok) return true;
        }

        if (tag === "input") {
          const type = (el.getAttribute?.("type") || "").toLowerCase();
          if (["checkbox","radio"].includes(type)) {
            const want = typeof value === "string" ? ["yes","true","1","on"].includes(value.toLowerCase()) : !!value;
            if (el.checked !== want) realClick(el);
            return true;
          }
          const ok = setInputValue(el, String(value));
          if (ok) { log("input set:", el); return true; }
        }

        if (tag === "textarea") {
          const ok = setTextareaValue(el, String(value));
          if (ok) { log("textarea set:", el); return true; }
        }

        const parentCombo = closestCombo(el);
        if (parentCombo) {
          const ok = await fillDropdownElement(parentCombo, value);
          log("parent combobox:", ok, parentCombo);
          if (ok) return true;
        }
      } catch (e) {
        warn("fillField candidate error:", e.message);
      }
    }

    // Final attempt for semantic groups
    if (/^(gender|race|ethnicity|veteran|disability|experience type|job type|relocate|current)$/i.test(String(keyword))) {
      const ok = await fillChoiceGroupByLabel(new RegExp(keyword, "i"), value);
      if (ok) return true;
    }

    warn(`Field "${keyword}" not filled.`);
    return false;
  }

  // ---------- Profile normalizer ----------
  function normalizeProfile(api) {
    const fullName = [api.firstName, api.lastName].filter(Boolean).join(" ").trim();
    const address = [api.street, api.city, api.state, api.zipCode, api.country].filter(Boolean).join(", ");
    const yn = (b) => (b === true ? "Yes" : b === false ? "No" : "");

    const gender = normGender(api.gender);
    const ethnicity = normEthnicity(api.ethnicity);
    const race = normRace(api.race);
    const disabilityStatus = normYesNoPrefer(api.disabilityStatus);
    const veteranStatus = normYesNoPrefer(api.veteranStatus);
    const jobType = normJobType(api.jobType);

    const skillsStr = (api.skills || []).join(", ");
    const languagesStr = (api.languages || [])
      .map(l => l?.proficiency ? `${l.language} (${l.proficiency})` : l.language)
      .join(", ");
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

      gender, ethnicity, race, disabilityStatus, veteranStatus,

      totalExperienceInYears: api.totalExperienceInYears || "",
      skills: skillsStr,
      languages: languagesStr,
      achievements: achievementsStr,

      jobType,
      preferredLocations: (api.preferredLocations || []).join(", "),
      currentCTC: api.currentCTC || "",
      expectedCTC: api.expectedCTC || "",
      willingToRelocate: yn(api.willingToRelocate),
      noticePeriodDays: String(api.noticePeriodDurationInDays ?? ""),

      _experience: api.experience || [],
      _education: api.education || []
    };
  }
  function normGender(s){ if(!s) return ""; const v=s.toLowerCase(); if(v.includes("male"))return"Male"; if(v.includes("female"))return"Female"; if(v.includes("non"))return"Non-binary"; if(v.includes("prefer")&&v.includes("not"))return"Prefer not to say"; return "Other"; }
  function normEthnicity(s){ if(!s) return ""; const v=s.toLowerCase(); if(v.includes("not hispanic"))return"Not Hispanic or Latino"; if(v.includes("hispanic")||v.includes("latino"))return"Hispanic or Latino"; if(v.includes("prefer")&&v.includes("not"))return"Prefer not to say"; return s; }
  function normRace(s){ if(!s) return ""; const v=s.toLowerCase(); if(v.includes("two")&&v.includes("race"))return"Two or More Races"; if(v.includes("white"))return"White"; if(v.includes("black")||v.includes("african"))return"Black or African American"; if(v.includes("asian"))return"Asian"; if(v.includes("hawaiian")||v.includes("pacific"))return"Native Hawaiian or Other Pacific Islander"; if(v.includes("american indian")||v.includes("alaska"))return"American Indian or Alaska Native"; if(v.includes("prefer")&&v.includes("not"))return"Prefer not to say"; return s; }
  function normYesNoPrefer(s){ if(s==null) return ""; const v=String(s).toLowerCase(); if(v==="yes"||v==="true")return"Yes"; if(v==="no"||v==="false")return"No"; if(v.includes("prefer")&&v.includes("not"))return"Prefer not to say"; return s; }
  function normJobType(s){ if(!s) return ""; const v=s.toLowerCase(); if(v.includes("remote"))return"Remote"; if(v.includes("on")&&v.includes("site"))return"Onsite"; if(v.includes("hybrid"))return"Hybrid"; return s; }

  // ---------- Pipelines ----------
  async function fillAll(m) {
    const tasks = [];

    tasks.push(() => fillField("full name", m.fullName));
    tasks.push(() => fillField("first name", m.firstName));
    tasks.push(() => fillField("last name", m.lastName));
    tasks.push(() => fillField("email", m.email));
    tasks.push(() => fillField("phone", m.phone));

    tasks.push(() => fillField("address", m.address));
    tasks.push(() => fillField("city", m.city));
    tasks.push(() => fillField("state", m.state));
    tasks.push(() => fillField("country", m.country));
    tasks.push(() => fillField("zip", m.zipCode));
    tasks.push(() => fillField("postal code", m.zipCode));

    tasks.push(() => fillField("linkedin", m.linkedin));
    tasks.push(() => fillField("github", m.github));
    tasks.push(() => fillField("portfolio", m.portfolio));
    tasks.push(() => fillField("website", m.portfolio));

    tasks.push(() => fillField("citizenship", m.citizenshipStatus));
    tasks.push(() => fillField("work authorization", m.usAuthorized));
    tasks.push(() => fillField("require sponsorship", m.sponsorshipRequired));
    tasks.push(() => fillField("nationality", m.nationality));

    tasks.push(() => fillField("gender", m.gender) || fillChoiceGroupByLabel(/gender/i, m.gender));
    tasks.push(() => fillField("ethnicity", m.ethnicity) || fillChoiceGroupByLabel(/ethnicity/i, m.ethnicity));
    tasks.push(() => fillField("race", m.race) || fillChoiceGroupByLabel(/race/i, m.race));
    tasks.push(() => fillField("disability", m.disabilityStatus) || fillChoiceGroupByLabel(/disability/i, m.disabilityStatus));
    tasks.push(() => fillField("veteran", m.veteranStatus) || fillChoiceGroupByLabel(/veteran/i, m.veteranStatus));

    tasks.push(() => fillField("skills", m.skills));
    tasks.push(() => fillField("languages", m.languages));
    tasks.push(() => fillField("achievements", m.achievements));

    tasks.push(() => fillField("job type", m.jobType) || fillChoiceGroupByLabel(/job\s*type|work\s*(preference|type)/i, m.jobType));
    tasks.push(() => fillField("preferred location", m.preferredLocations));
    tasks.push(() => fillField("current ctc", m.currentCTC));
    tasks.push(() => fillField("expected ctc", m.expectedCTC));
    tasks.push(() => fillField("relocate", m.willingToRelocate) || fillChoiceGroupByLabel(/relocat/i, m.willingToRelocate));
    tasks.push(() => fillField("notice period", m.noticePeriodDays));

    tasks.push(() => fillEducationRepeater(m._education));
    tasks.push(() => fillExperienceRepeater(m._experience));

    let filled = 0;
    for (let i = 0; i < tasks.length; i++) {
      try {
        const ok = await tasks[i]();
        log(`Task ${i + 1}/${tasks.length} -> ${ok ? "OK" : "skip"}`);
        if (ok) filled++;
      } catch (e) {
        warn(`Task ${i + 1} error:`, e.message);
      }
      if (STEP_MODE) await sleep(STEP_DELAY);
    }
    log("Sequential fill complete. Filled:", filled);
    return { filledCount: filled, totalTasks: tasks.length };
  }

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
    ok |= await fillField("experience type", row.experienceType || "") ||
          await fillChoiceGroupByLabel(/experience\s*type|employment\s*type/i, row.experienceType || "");
    ok |= await fillField("start month", monthName(row.startDate));
    ok |= await fillField("start year", yearStr(row.startDate));
    ok |= await fillField("end month", monthName(row.endDate));
    ok |= await fillField("end year", yearStr(row.endDate));
    ok |= await fillField("current", row.isCurrent ? "Yes" : "No") ||
          await fillChoiceGroupByLabel(/current|currently working/i, row.isCurrent ? "Yes" : "No");
    ok |= await fillField("description", row.description || "");
    return !!ok;
  }

  // ---------- Site adapters ----------
  async function greenhouseAdapter(mapped) {
    let used = 0;

    // name/email/phone when present
    const byName = [
      ["name", mapped.fullName],
      ["email", mapped.email],
      ["phone", mapped.phone]
    ];
    for (const [nameAttr, val] of byName) {
      const el = queryAllDeep(`input[name='${nameAttr}']`)[0];
      if (el && val) { setInputValue(el, val); used++; await sleep(60); }
    }

    // Self-ID choice groups
    used += (await fillChoiceGroupByLabel(/gender|gender\s*identity/i, mapped.gender)) ? 1 : 0;
    used += (await fillChoiceGroupByLabel(/race/i, mapped.race)) ? 1 : 0;
    used += (await fillChoiceGroupByLabel(/ethnicity/i, mapped.ethnicity)) ? 1 : 0;
    used += (await fillChoiceGroupByLabel(/veteran/i, mapped.veteranStatus)) ? 1 : 0;
    used += (await fillChoiceGroupByLabel(/disability/i, mapped.disabilityStatus)) ? 1 : 0;

    // Location react-select
    const locLabel = queryAllDeep("label, .field-label, legend")
      .find(l => /location|city/i.test((l.innerText || "").trim()));
    const locTrigger = locLabel?.closest("label,div,section,fieldset")?.querySelector(".select__control, .react-select__control, [role='combobox'], [aria-haspopup='listbox']");
    if (locTrigger) {
      const val = mapped.city || mapped.preferredLocations || "";
      if (val) { await fillDropdownElement(locTrigger, val); used++; }
    }

    if (used) log("Greenhouse adapter used:", used);
    return used;
  }

  async function leverAdapter(mapped) {
    let used = 0;
    const name = queryAllDeep("input[data-qa='name-input'][name='name']")[0];
    if (name && mapped.fullName) { setInputValue(name, mapped.fullName); used++; }
    const email = queryAllDeep("input[data-qa='email-input'][name='email']")[0];
    if (email && mapped.email) { setInputValue(email, mapped.email); used++; }
    const phone = queryAllDeep("input[data-qa='phone-input'][name='phone']")[0];
    if (phone && mapped.phone) { setInputValue(phone, mapped.phone); used++; }

    used += (await fillChoiceGroupByLabel(/gender|gender\s*identity/i, mapped.gender)) ? 1 : 0;
    used += (await fillChoiceGroupByLabel(/race/i, mapped.race)) ? 1 : 0;
    used += (await fillChoiceGroupByLabel(/ethnicity/i, mapped.ethnicity)) ? 1 : 0;
    used += (await fillChoiceGroupByLabel(/veteran/i, mapped.veteranStatus)) ? 1 : 0;
    used += (await fillChoiceGroupByLabel(/disability/i, mapped.disabilityStatus)) ? 1 : 0;

    const labels = queryAllDeep("label, .field-label, legend");
    const locLabel = labels.find(l => /location/i.test((l.innerText || "").trim()));
    const locTrigger = locLabel?.closest("label,div,section,fieldset")?.querySelector(".application-dropdown, .select__control, .react-select__control, [role='combobox']");
    if (locTrigger) {
      const val = mapped.city || mapped.preferredLocations || "";
      if (val) { await fillDropdownElement(locTrigger, val); used++; }
    }

    if (used) log("Lever adapter used:", used);
    return used;
  }

  async function trySiteAdapter(mapped) {
    const host = location.hostname;
    if (/job-boards\.greenhouse\.io$/i.test(host)) {
      const n = await greenhouseAdapter(mapped);
      if (n > 0) return true;
    }
    if (/(^|\.)jobs\.lever\.co$/i.test(host)) {
      const n = await leverAdapter(mapped);
      if (n > 0) return true;
    }
    return false;
  }

  // ---------- Entry from bridge ----------
  window.addEventListener("message", async (ev) => {
    if (!ev || ev.source !== window) return;
    const data = ev.data;
    if (!data || data.type !== "AF_FILL") return;

    try {
      log("AF_FILL received", data.__trace || {});
      const mapped = normalizeProfile(data.profile);

      // site adapter first
      const handled = await trySiteAdapter(mapped);
      // generic pipeline (frame has to have fields)
      if (!handled && frameHasFields()) {
        const result = await fillAll(mapped);
        log("Generic fill result:", result);
      } else if (!frameHasFields()) {
        log("Skipped generic fill (no fields here).");
      } else {
        log("Site adapter completed fill");
      }
    } catch (e) {
      err("AF_FILL error:", e);
    }
  });

  log("Injected engine ready.");
})();
