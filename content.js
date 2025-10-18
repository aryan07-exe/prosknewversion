// /* content.js — universal autofill engine (with frame guard, Lever adapter, deep logs, sequential fill) */

// (function () {
//     // ===== Debug / Behavior toggles =====
//     const DEBUG = true;
//     const STEP_MODE = true;      // fill one field at a time
//     const STEP_DELAY = 180;      // ms between fields
//     const OPEN_MENU_TIMEOUT = 1800;
  
//     // ===== Known frames we should ignore (captcha, analytics, etc.) =====
//     const IGNORE_HOSTS = [
//       /(^|\.)newassets\.hcaptcha\.com$/i,
//       /(^|\.)hcaptcha\.com$/i,
//       /(^|\.)google\.com$/i,
//       /(^|\.)recaptcha\.net$/i,
//       /(^|\.)doubleclick\.net$/i,
//       /(^|\.)googletagmanager\.com$/i
//     ];
  
//     // ===== Logger =====
//     function log(...a) {
//       if (!DEBUG) return;
//       const mark = window.top === window ? "TOP" : "IFRAME";
//       const host = location.hostname;
//       console.log(`[AF][${mark}][${host}]`, ...a);
//     }
//     function warn(...a){ if (DEBUG) console.warn(`[AF][WARN]`, ...a); }
//     function err(...a){ if (DEBUG) console.error(`[AF][ERR]`, ...a); }
  
//     // ===== Early exit for non-target frames =====
//     if (IGNORE_HOSTS.some(rx => rx.test(location.hostname))) {
//       log("Ignoring frame due to host rule:", location.hostname);
//       return;
//     }
  
//     log("Content script loaded.", {
//       url: location.href,
//       isTop: window.top === window
//     });
  
//     // ===== Message entry =====
//     chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
//       (async () => {
//         try {
//           if (msg?.type === "FILL_PROFILE" || msg?.action === "fill_form") {
//             log("Fill requested", msg.__trace || {});
//             const apiProfile = msg.profile;
//             if (!apiProfile) throw new Error("No profile supplied");
  
//             // 1) Try host-specific adapter first (fast path)
//             const adapted = await tryHostAdapter(apiProfile);
//             if (adapted?.handled) {
//               log("Host adapter handled:", adapted.host, "->", adapted.stats);
//               sendResponse({ ok: true, result: adapted });
//               return;
//             }
  
//             // 2) Generic normalizer + generic fill
//             const mapped = normalizeProfile(apiProfile);
//             const result = await fillAll(mapped);
//             sendResponse({ ok: true, result });
//             return;
//           }
//           sendResponse({ ok: false, error: "Unknown message" });
//         } catch (e) {
//           err("Handler error:", e);
//           sendResponse({ ok: false, error: String(e?.message || e) });
//         }
//       })();
//       return true; // async
//     });
  
//     // ===== Host adapters (site-specific selectors) =====
//     async function tryHostAdapter(apiProfile) {
//       const host = location.hostname;
//       if (/(^|\.)jobs\.lever\.co$/i.test(host)) {
//         const mapped = normalizeProfile(apiProfile);
//         const stats = { host, filled: 0, tried: 0 };
  
//         // Known Lever inputs by data-qa
//         const name = document.querySelector("input[data-qa='name-input'][name='name']");
//         if (name) { setReactInputValue(name, mapped.fullName); stats.filled++; }
//         stats.tried++;
  
//         const email = document.querySelector("input[data-qa='email-input'][name='email']");
//         if (email) { setReactInputValue(email, mapped.email); stats.filled++; }
//         stats.tried++;
  
//         const phone = document.querySelector("input[data-qa='phone-input'][name='phone']");
//         if (phone) { setReactInputValue(phone, mapped.phone); stats.filled++; }
//         stats.tried++;
  
//         // Location on Lever is a dropdown with .application-dropdown; use our dropdown driver
//         const locLabel = findByLabelText(/location/i);
//         const locTrigger = locLabel?.closest("label,div,section,fieldset")?.querySelector(".application-dropdown, [role='combobox'], [aria-haspopup='listbox']");
//         if (locTrigger) {
//           await fillDropdownElement(locTrigger, mapped.preferredLocations || mapped.city || "");
//           stats.filled++;
//         }
//         stats.tried++;
  
//         // If we filled anything, mark handled to avoid double-filling
//         if (stats.filled > 0) return { handled: true, host, stats };
//         return { handled: false, host };
//       }
//       return { handled: false, host };
//     }
  
//     // ===== Normalizer (matches your API shape) =====
//     function normalizeProfile(api) {
//       const fullName = [api.firstName, api.lastName].filter(Boolean).join(" ").trim();
//       const address = [api.street, api.city, api.state, api.zipCode, api.country].filter(Boolean).join(", ");
//       const yn = (b) => (b === true ? "Yes" : b === false ? "No" : "");
  
//       const gender = normGender(api.gender);
//       const ethnicity = normEthnicity(api.ethnicity);
//       const race = normRace(api.race);
//       const disabilityStatus = normYesNoPrefer(api.disabilityStatus);
//       const veteranStatus = normYesNoPrefer(api.veteranStatus);
//       const jobType = normJobType(api.jobType);
  
//       const skillsStr = (api.skills || []).join(", ");
//       const languagesStr = (api.languages || [])
//         .map(l => l?.proficiency ? `${l.language} (${l.proficiency})` : l.language)
//         .join(", ");
//       const achievementsStr = (api.achievements || []).join(", ");
  
//       return {
//         // basics & contact
//         fullName,
//         firstName: api.firstName || "",
//         lastName: api.lastName || "",
//         pronouns: api.pronouns || "",
//         email: api.email || "",
//         phoneCountryCode: api.phoneCountryCode || "",
//         phone: api.phone || "",
//         street: api.street || "",
//         city: api.city || "",
//         state: api.state || "",
//         country: api.country || "",
//         zipCode: api.zipCode || "",
//         address,
  
//         // socials
//         portfolio: api.portfolio || "",
//         linkedin: api.linkedin || "",
//         github: api.github || "",
//         twitter: api.twitter || "",
//         other: api.otherSocialLink || "",
  
//         // work auth
//         nationality: api.nationality || "",
//         usAuthorized: yn(api.usAuthorized),
//         sponsorshipRequired: yn(api.sponsorshipRequired),
//         citizenshipStatus: api.citizenshipStatus || "",
  
//         // demographics
//         gender,
//         ethnicity,
//         race,
//         disabilityStatus,
//         veteranStatus,
  
//         // career summary
//         totalExperienceInYears: api.totalExperienceInYears || "",
//         skills: skillsStr,
//         languages: languagesStr,
//         achievements: achievementsStr,
  
//         // prefs/comp
//         jobType,
//         preferredLocations: (api.preferredLocations || []).join(", "),
//         currentCTC: api.currentCTC || "",
//         expectedCTC: api.expectedCTC || "",
//         willingToRelocate: yn(api.willingToRelocate),
//         noticePeriodDays: String(api.noticePeriodDurationInDays ?? ""),
  
//         // raw arrays for repeaters
//         _experience: api.experience || [],
//         _education: api.education || []
//       };
//     }
  
//     function normGender(s) {
//       if (!s) return "";
//       const v = s.toLowerCase();
//       if (v.includes("male")) return "Male";
//       if (v.includes("female")) return "Female";
//       if (v.includes("non")) return "Non-binary";
//       if (v.includes("prefer") && v.includes("not")) return "Prefer not to say";
//       return "Other";
//     }
//     function normEthnicity(s) {
//       if (!s) return "";
//       const v = s.toLowerCase();
//       if (v.includes("not hispanic")) return "Not Hispanic or Latino";
//       if (v.includes("hispanic") || v.includes("latino")) return "Hispanic or Latino";
//       if (v.includes("prefer") && v.includes("not")) return "Prefer not to say";
//       return s;
//     }
//     function normRace(s) {
//       if (!s) return "";
//       const v = s.toLowerCase();
//       if (v.includes("two") && v.includes("race")) return "Two or More Races";
//       if (v.includes("white")) return "White";
//       if (v.includes("black") || v.includes("african")) return "Black or African American";
//       if (v.includes("asian")) return "Asian";
//       if (v.includes("hawaiian") || v.includes("pacific")) return "Native Hawaiian or Other Pacific Islander";
//       if (v.includes("american indian") || v.includes("alaska")) return "American Indian or Alaska Native";
//       if (v.includes("prefer") && v.includes("not")) return "Prefer not to say";
//       return s;
//     }
//     function normYesNoPrefer(s) {
//       if (s == null) return "";
//       const v = String(s).toLowerCase();
//       if (v === "yes" || v === "true") return "Yes";
//       if (v === "no" || v === "false") return "No";
//       if (v.includes("prefer") && v.includes("not")) return "Prefer not to say";
//       return s;
//     }
//     function normJobType(s) {
//       if (!s) return "";
//       const v = s.toLowerCase();
//       if (v.includes("remote")) return "Remote";
//       if (v.includes("on") && v.includes("site")) return "Onsite";
//       if (v.includes("hybrid")) return "Hybrid";
//       return s;
//     }
  
//     // ===== Sequential fill pipeline =====
//     async function fillAll(m) {
//       const tasks = [];
  
//       // Basic/contact
//       tasks.push(() => fillField("full name", m.fullName));
//       tasks.push(() => fillField("first name", m.firstName));
//       tasks.push(() => fillField("last name", m.lastName));
//       tasks.push(() => fillField("email", m.email));
//       tasks.push(() => fillField("phone", m.phone));
//       tasks.push(() => fillField("address", m.address));
//       tasks.push(() => fillField("city", m.city));
//       tasks.push(() => fillField("state", m.state));
//       tasks.push(() => fillField("country", m.country));
//       tasks.push(() => fillField("zip", m.zipCode));
//       tasks.push(() => fillField("postal code", m.zipCode));
  
//       // Socials
//       tasks.push(() => fillField("linkedin", m.linkedin));
//       tasks.push(() => fillField("github", m.github));
//       tasks.push(() => fillField("portfolio", m.portfolio));
//       tasks.push(() => fillField("website", m.portfolio));
  
//       // Work auth
//       tasks.push(() => fillField("citizenship", m.citizenshipStatus));
//       tasks.push(() => fillField("work authorization", m.usAuthorized));
//       tasks.push(() => fillField("require sponsorship", m.sponsorshipRequired));
//       tasks.push(() => fillField("nationality", m.nationality));
  
//       // Demographics
//       tasks.push(() => fillDemographic("gender", m.gender));
//       tasks.push(() => fillDemographic("ethnicity", m.ethnicity));
//       tasks.push(() => fillDemographic("race", m.race));
//       tasks.push(() => fillDemographic("disability", m.disabilityStatus));
//       tasks.push(() => fillDemographic("veteran", m.veteranStatus));
  
//       // Career summary
//       tasks.push(() => fillField("skills", m.skills));
//       tasks.push(() => fillField("languages", m.languages));
//       tasks.push(() => fillField("achievements", m.achievements));
  
//       // Preferences/comp
//       tasks.push(() => fillField("job type", m.jobType));
//       tasks.push(() => fillField("preferred location", m.preferredLocations));
//       tasks.push(() => fillField("current ctc", m.currentCTC));
//       tasks.push(() => fillField("expected ctc", m.expectedCTC));
//       tasks.push(() => fillField("relocate", m.willingToRelocate));
//       tasks.push(() => fillField("notice period", m.noticePeriodDays));
  
//       // Repeaters
//       tasks.push(() => fillEducationRepeater(m._education));
//       tasks.push(() => fillExperienceRepeater(m._experience));
  
//       let filled = 0;
//       for (let i = 0; i < tasks.length; i++) {
//         try {
//           const ok = await tasks[i]();
//           log(`Task ${i + 1}/${tasks.length} -> ${ok ? "OK" : "skip"}`);
//           if (ok) filled++;
//         } catch (e) {
//           warn(`Task ${i + 1} error:`, e.message);
//         }
//         if (STEP_MODE) await sleep(STEP_DELAY);
//       }
//       log("Sequential fill complete. Filled fields:", filled);
//       return { filledCount: filled, totalTasks: tasks.length };
//     }
  
//     // ===== Demographics helper =====
//     async function fillDemographic(labelKey, value) {
//       if (!value) return false;
//       log(`Demographic: ${labelKey} -> "${value}"`);
//       if (await fillField(labelKey, value)) return true;
  
//       // radios/checkboxes fallback
//       const radios = queryAllDeep("input[type='radio'], input[type='checkbox']");
//       const v = value.toLowerCase();
//       for (const el of radios) {
//         const lbl = (getLabelFor(el) || "").toLowerCase();
//         if (lbl && (lbl === v || lbl.includes(v))) {
//           realClick(el);
//           log("Radio/Checkbox selected by label:", lbl);
//           return true;
//         }
//       }
//       warn(`Demographic fallback failed for ${labelKey}`);
//       return false;
//     }
  
//     // ===== Repeaters =====
//     async function fillEducationRepeater(list) {
//       if (!Array.isArray(list) || !list.length) return false;
//       log("Education repeater: entries", list.length);
//       const row = list[0];
//       let ok = false;
//       ok |= await fillField("school", row.school || "");
//       ok |= await fillField("degree", row.degree || "");
//       ok |= await fillField("field of study", row.fieldOfStudy || "");
//       ok |= await fillField("grade", row.grade || "");
//       ok |= await fillField("start month", monthName(row.startDate));
//       ok |= await fillField("start year", yearStr(row.startDate));
//       ok |= await fillField("end month", monthName(row.endDate));
//       ok |= await fillField("end year", yearStr(row.endDate));
//       return !!ok;
//     }
  
//     async function fillExperienceRepeater(list) {
//       if (!Array.isArray(list) || !list.length) return false;
//       log("Experience repeater: entries", list.length);
//       const row = list[0];
//       let ok = false;
//       ok |= await fillField("company", row.company || "");
//       ok |= await fillField("role", row.role || "");
//       ok |= await fillField("title", row.role || "");
//       ok |= await fillField("experience type", row.experienceType || "");
//       ok |= await fillField("start month", monthName(row.startDate));
//       ok |= await fillField("start year", yearStr(row.startDate));
//       ok |= await fillField("end month", monthName(row.endDate));
//       ok |= await fillField("end year", yearStr(row.endDate));
//       ok |= await fillField("current", row.isCurrent ? "Yes" : "No");
//       ok |= await fillField("description", row.description || "");
//       return !!ok;
//     }
  
//     // ===== Field driver =====
//     async function fillField(keyword, value) {
//       if (!value) return false;
//       const candidates = findFields(keyword);
//       log(`Field "${keyword}" -> "${value}" | candidates:`, candidates.length);
  
//       for (const el of candidates) {
//         try {
//           // 1) Native <select>
//           if (el.tagName === "SELECT") {
//             const ok = setNativeSelect(el, value);
//             log("native <select> try:", ok, el);
//             if (ok) return true;
//           }
  
//           // 2) Combobox / custom dropdown
//           if (looksLikeCombo(el)) {
//             const ok = await fillDropdownElement(el, value);
//             log("combobox try:", ok, el);
//             if (ok) return true;
//           }
  
//           // 3) Plain input/textarea
//           if (setValue(el, value)) {
//             log("input/textarea set:", el);
//             return true;
//           }
  
//           // 4) Parent wrapper has the combobox behavior
//           const parentCombo = closestCombo(el);
//           if (parentCombo) {
//             const ok = await fillDropdownElement(parentCombo, value);
//             log("parent combobox try:", ok, parentCombo);
//             if (ok) return true;
//           }
//         } catch (e) {
//           warn(`fillField error on candidate:`, e.message);
//         }
//       }
//       warn(`Field "${keyword}" not filled.`);
//       return false;
//     }
  
//     // ===== Discovery across DOM + shadow (+ stronger label association) =====
//     function queryAllDeep(sel) { return queryDeep(document, sel); }
//     function queryDeep(root, sel) {
//       const out = [];
//       (function walk(n) {
//         if (!n) return;
//         if (n.querySelectorAll) out.push(...n.querySelectorAll(sel));
//         if (n.shadowRoot) walk(n.shadowRoot);
//         const kids = n.children || [];
//         for (let i = 0; i < kids.length; i++) walk(kids[i]);
//       })(root);
//       return out;
//     }
  
//     function findFields(fieldType) {
//       const keys = getSynonyms(fieldType);
//       const nodes = queryAllDeep(
//         [
//           "input", "textarea", "select", "[role='combobox']",
//           "button", "[role='button']",
//           "[aria-haspopup='listbox']", "[aria-expanded]",
//           ".select2-selection", ".choices__inner", ".vs__selected-options",
//           ".react-select__control", ".MuiInputBase-root", ".ant-select",
//           "[data-testid*='select']", "[class*='select']", "[class*='dropdown']"
//         ].join(", ")
//       );
  
//       // Candidate if the element or its label/group text includes our key
//       return nodes.filter((el) => {
//         const attr = squash(collectAttrs(el));
//         if (keys.some((k) => attr.includes(k))) return true;
  
//         // Stronger association: check closest group’s title/legend/preceding label
//         const grp = el.closest("label,fieldset,section,div");
//         const grpText = squash([grp?.querySelector("legend,h1,h2,h3,label")?.innerText || grp?.innerText || ""]);
//         if (grpText && keys.some(k => grpText.includes(k))) return true;
  
//         // aria-labelledby
//         const ids = (el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
//         if (ids.length) {
//           const txt = ids.map(id => document.getElementById(id)?.innerText || "").join(" ").toLowerCase();
//           if (txt && keys.some(k => txt.includes(k))) return true;
//         }
//         return false;
//       });
//     }
  
//     function getSynonyms(k) {
//       const s = String(k).toLowerCase();
//       const map = {
//         "full name": ["full name", "name"],
//         "first name": ["first name", "given name", "forename"],
//         "last name": ["last name", "surname", "family name"],
//         "email": ["email", "email address"],
//         "phone": ["phone", "mobile", "phone number", "contact number"],
//         "address": ["address", "street address", "current address"],
//         "city": ["city", "town", "location"],
//         "state": ["state", "province", "region"],
//         "country": ["country", "nation"],
//         "zip": ["zip", "zip code", "postal", "postal code"],
  
//         "linkedin": ["linkedin", "linkedin url", "linkedin profile"],
//         "github":   ["github", "github url", "github profile"],
//         "portfolio":["portfolio", "website", "personal site", "site", "url", "homepage"],
  
//         "citizenship": ["citizenship", "citizenship status"],
//         "work authorization": ["work authorization", "authorized to work", "work permit", "work eligibility"],
//         "require sponsorship": ["sponsorship", "require sponsorship", "sponsorship required", "need sponsorship"],
//         "nationality": ["nationality", "citizen of"],
  
//         "gender": ["gender", "gender identity", "what is your gender"],
//         "ethnicity": ["ethnicity"],
//         "race": ["race"],
//         "disability": ["disability", "disability status"],
//         "veteran": ["veteran", "veteran status"],
  
//         "skills": ["skills"],
//         "languages": ["languages", "language proficiency"],
//         "achievements": ["achievements", "accomplishments"],
//         "job type": ["job type", "work preference", "work type"],
//         "preferred location": ["preferred location", "location preference", "desired location", "location"],
//         "current ctc": ["current ctc", "current compensation", "current salary"],
//         "expected ctc": ["expected ctc", "expected compensation", "expected salary"],
//         "relocate": ["relocate", "willing to relocate"],
//         "notice period": ["notice period", "notice", "availability"],
  
//         // edu/exp
//         "school": ["school", "university", "college"],
//         "degree": ["degree"],
//         "field of study": ["field of study", "major"],
//         "grade": ["grade", "gpa"],
//         "company": ["company", "employer", "organization"],
//         "role": ["role", "position", "job title", "title"],
//         "experience type": ["experience type", "employment type"],
//         "start month": ["start month", "from month", "month started"],
//         "start year": ["start year", "from year", "year started"],
//         "end month": ["end month", "to month", "month ended"],
//         "end year": ["end year", "to year", "year ended"],
//         "current": ["current", "currently working"]
//       };
//       return map[s] || [s];
//     }
  
//     function collectAttrs(el) {
//       const texts = [];
//       const push = (t) => { if (t) texts.push(String(t).trim()); };
//       push(el.placeholder);
//       push(el.name);
//       push(el.id);
//       push(el.getAttribute?.("aria-label"));
//       push(el.getAttribute?.("role"));
//       push(el.getAttribute?.("data-testid"));
//       push(el.getAttribute?.("data-qa"));
//       push(getLabelFor(el));
//       push(el.className);
//       return texts;
//     }
//     function getLabelFor(el) {
//       if (!el) return "";
//       if (el.id) {
//         const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
//         if (label) return (label.textContent || "").trim();
//       }
//       const wrap = el.closest("label") || el.closest("div,section,fieldset");
//       return wrap ? (wrap.innerText || wrap.textContent || "").trim() : "";
//     }
//     function findByLabelText(rx) {
//       const labels = queryAllDeep("label, .label, .field-label, legend");
//       return labels.find(l => rx.test((l.innerText || l.textContent || "").trim()));
//     }
//     function squash(arr) { return (arr || []).filter(Boolean).join(" | ").toLowerCase(); }
  
//     // ===== Value drivers =====
//     function realClick(el) {
//       el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
//       el.dispatchEvent(new MouseEvent("mouseup",   { bubbles: true, cancelable: true, view: window }));
//       el.dispatchEvent(new MouseEvent("click",     { bubbles: true, cancelable: true, view: window }));
//     }
//     function press(el, key) {
//       el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
//       el.dispatchEvent(new KeyboardEvent("keyup",   { key, bubbles: true }));
//     }
//     function setReactInputValue(input, value) {
//       const proto = Object.getPrototypeOf(input);
//       const desc = Object.getOwnPropertyDescriptor(proto, "value") || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
//       desc?.set?.call(input, value);
//       input.dispatchEvent(new Event("input", { bubbles: true }));
//       input.dispatchEvent(new Event("change", { bubbles: true }));
//       return true;
//     }
//     function setValue(el, v) {
//       const tag = (el.tagName || "").toLowerCase();
//       const type = (el.getAttribute?.("type") || "").toLowerCase();
//       if (tag === "input") {
//         if (["checkbox", "radio"].includes(type)) {
//           const want = typeof v === "string" ? ["yes","true","1","on"].includes(v.toLowerCase()) : !!v;
//           if (el.checked !== want) realClick(el);
//           return true;
//         }
//         return setReactInputValue(el, String(v));
//       }
//       if (tag === "textarea") return setReactInputValue(el, String(v));
//       if (tag === "select")   return setNativeSelect(el, v);
//       return false;
//     }
//     function setNativeSelect(sel, labelOrValue) {
//       const want = String(labelOrValue).toLowerCase();
//       for (const opt of sel.options) {
//         const v = String(opt.value).toLowerCase();
//         const t = String(opt.textContent || "").toLowerCase();
//         if (v === want || t === want || t.includes(want)) {
//           sel.value = opt.value;
//           sel.dispatchEvent(new Event("input", { bubbles: true }));
//           sel.dispatchEvent(new Event("change", { bubbles: true }));
//           return true;
//         }
//       }
//       return false;
//     }
  
//     const sleep = (ms) => new Promise(r => setTimeout(r, ms));
//     async function waitFor(pred, timeout = OPEN_MENU_TIMEOUT, step = 60) {
//       const t0 = performance.now();
//       return new Promise((res, rej) => {
//         (function loop() {
//           const el = typeof pred === "function" ? pred() : document.querySelector(pred);
//           if (el) return res(el);
//           if (performance.now() - t0 > timeout) return rej(new Error("waitFor timeout"));
//           setTimeout(loop, step);
//         })();
//       });
//     }
  
//     // ===== Dropdown driver (improved) =====
//     async function fillDropdownElement(trigger, labelOrValue) {
//       const want = String(labelOrValue).toLowerCase();
//       log("Dropdown attempt:", { labelOrValue, trigger });
  
//       // 0) Nearby native <select>
//       const sel = trigger.tagName === "SELECT" ? trigger
//         : trigger.closest("label,div,section,fieldset")?.querySelector("select");
//       if (sel && setNativeSelect(sel, labelOrValue)) {
//         log("Dropdown satisfied by nearby <select>");
//         return true;
//       }
  
//       // 1) Open
//       trigger.scrollIntoView({ block: "center" });
//       realClick(trigger);
  
//       // 2) Local options (same container)
//       const container = trigger.closest("div,section,fieldset,li,td") || document;
//       let optionsLocal = Array.from(container.querySelectorAll(
//         "[role='option'], .ant-select-item, .MuiAutocomplete-option, .select2-results__option, .choices__item--choice, .react-select__option"
//       ));
  
//       // 3) If none, wait for global/portal menu then query globally
//       if (!optionsLocal.length) {
//         try {
//           await waitFor(() => document.querySelector(
//             "[role='listbox'], [id*='listbox'], .MuiPopover-root, .MuiMenu-paper, .ant-select-dropdown, .select2-results__options, .react-select__menu"
//           ));
//         } catch {}
//       }
  
//       const optionsGlobal = queryAllDeep(
//         "[role='listbox'] [role='option'], [id*='listbox'] [role='option'], " +
//         ".ant-select-item, .MuiAutocomplete-option, " +
//         ".select2-results__option, .choices__item--choice, " +
//         ".react-select__option"
//       );
  
//       const options = optionsLocal.length ? optionsLocal : optionsGlobal;
//       log("Options found:", options.length);
  
//       // 4) Click best match
//       let match = options.find(o => ((o.innerText || o.textContent || "").trim().toLowerCase() === want));
//       if (!match) match = options.find(o => ((o.innerText || o.textContent || "").trim().toLowerCase().includes(want)));
//       if (match) {
//         match.scrollIntoView({ block: "center" });
//         realClick(match);
//         await sleep(80);
//         log("Dropdown picked by option click:", (match.innerText || "").trim());
//         return true;
//       }
  
//       // 5) Type-to-filter
//       const input = document.querySelector(
//         "[role='combobox'] input, .react-select__input input, .MuiAutocomplete-input, .ant-select-selection-search-input"
//       );
//       if (input) {
//         input.focus();
//         input.value = "";
//         for (const ch of String(labelOrValue)) {
//           const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
//           desc?.set?.call(input, (input.value || "") + ch);
//           input.dispatchEvent(new Event("input", { bubbles: true }));
//           input.dispatchEvent(new KeyboardEvent("keydown", { key: ch, bubbles: true }));
//           input.dispatchEvent(new KeyboardEvent("keyup",   { key: ch, bubbles: true }));
//         }
//         await sleep(140);
//         press(input, "Enter");
//         await sleep(80);
//         log("Dropdown selected via type+Enter");
//         return true;
//       }
  
//       // 6) Keyboard fallback
//       press(trigger, "ArrowDown");
//       await sleep(60);
//       press(trigger, "Enter");
//       await sleep(60);
//       log("Dropdown fallback: ArrowDown + Enter");
//       return true;
//     }
  
//     function looksLikeCombo(el) {
//       const role = (el.getAttribute("role") || "").toLowerCase();
//       const hasPopup = (el.getAttribute("aria-haspopup") || "").toLowerCase() === "listbox";
//       const hasExpanded = el.hasAttribute("aria-expanded");
//       const cls = (el.className || "").toLowerCase();
//       return role === "combobox" || hasPopup || hasExpanded ||
//         cls.includes("select") || cls.includes("dropdown") ||
//         cls.includes("react-select") || cls.includes("mui") || cls.includes("ant-select");
//     }
//     function closestCombo(el) {
//       return el.closest(
//         "[role='combobox'], [aria-haspopup='listbox'], [aria-expanded], .select2-selection, .choices__inner, .vs__selected-options, .react-select__control, .MuiInputBase-root, .ant-select, [class*='select'], [class*='dropdown']"
//       );
//     }
  
//     // ===== Utils =====
//     function monthName(dateStr) {
//       if (!dateStr) return "";
//       const d = new Date(dateStr);
//       return isNaN(d) ? "" : d.toLocaleString("en-US", { month: "short" });
//     }
//     function yearStr(dateStr) {
//       if (!dateStr) return "";
//       const d = new Date(dateStr);
//       return isNaN(d) ? "" : String(d.getFullYear());
//     }
//   })();
  
/* content.js — bridge & progress tap */
(function () {
  const DEBUG = true;
  const log  = (...a)=>DEBUG&&console.log(`[AF][${top===window?'TOP':'IFRAME'}][${location.hostname}]`, ...a);
  const warn = (...a)=>DEBUG&&console.warn('[AF][WARN]', ...a);

  // Ignore known non-fill frames
  const IGNORE_HOSTS = [
    /(^|\.)newassets\.hcaptcha\.com$/i,
    /(^|\.)hcaptcha\.com$/i,
    /(^|\.)google\.com$/i,
    /(^|\.)recaptcha\.net$/i,
    /(^|\.)doubleclick\.net$/i,
    /(^|\.)googletagmanager\.com$/i,
    /(^|\.)gstatic\.com$/i,
    /(^|\.)content\.googleapis\.com$/i
  ];
  if (IGNORE_HOSTS.some(rx => rx.test(location.hostname))) {
    log('Ignoring frame by host rule:', location.hostname);
    return;
  }

  log('Content loaded', { url: location.href });

  // -- handshake: let BG know this frame can receive fill
  window.addEventListener('message', (ev)=>{
    const d = ev.data || {};
    if (d && d.type === 'AF_PING') {
      window.postMessage({ type:'AF_PONG', frame: location.href }, '*');
    }
  });

  // -- listen to page progress & log (you can forward to popup later)
  window.addEventListener('message', (ev)=>{
    const d = ev.data || {};
    if (!d || !d.type) return;
    if (d.type === 'AF_PROGRESS') {
      log(`Progress: ${d.done}/${d.total} | filled=${d.filled} | ${d.label||''}`);
    } else if (d.type === 'AF_DONE') {
      log(`Done: filled=${d.filled}/${d.tasks}`);
    }
  });

  // -- BG → CS messages (accept both names)
  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    (async () => {
      if (!msg) return sendResponse({ ok:false, error:'Empty message' });

      if (msg.type === 'PING_FRAMES') {
        // BG can call this to check at least one frame is alive
        window.postMessage({ type:'AF_PING' }, '*');
        sendResponse({ ok:true });
        return;
      }

      if (msg.type === 'FILL_PROFILE' || msg.action === 'fill_form' || msg.type === 'START_FILL') {
        const profile = msg.profile;
        if (!profile) { sendResponse({ ok:false, error:'No profile supplied' }); return; }
        // forward to injected (page world)
        window.postMessage({ type:'AF_FILL', profile, __trace: msg.__trace || {} }, '*');
        sendResponse({ ok:true });
        return;
      }

      sendResponse({ ok:false, error:'Unknown message type' });
    })();
    return true;
  });
})();
