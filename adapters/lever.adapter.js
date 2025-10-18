// adapters/lever.adapter.js
(function () {
    const id = 'lever';
    const match = (host) => /(^|\.)jobs\.lever\.co$/.test(host);
  
    // Normalizers for option texts (example: gender)
    const NORMALIZE = {
      gender(v) {
        const s = String(v || '').trim().toLowerCase();
        if (!s) return '';
        if (/(^m(ale)?$)/.test(s)) return 'Male';
        if (/(^f(emale)?$)/.test(s)) return 'Female';
        if (/prefer/.test(s)) return 'Prefer not to disclose';
        // fallthrough: title-case original
        return v;
      },
    };
  
    async function fill(page, prof, api) {
      // TEXT INPUTS (native/controlled-safe via injected helper)
      await api.type('input[name="name"], [data-qa="name-input"]', prof.name);
      await api.type('input[name="email"], [data-qa="email-input"]', prof.email);
      await api.type('input[name="phone"], [data-qa="phone-input"]', prof.phone);
      await api.type('input[name="org"], [data-qa="org-input"]', prof.company || prof.currentCompany || '');
  
      // LOCATION (Lever often uses plain text + hidden selectedLocation)
      await api.type('input#location-input, input[name="location"], .location-input', prof.city || '');
      // if the board expects a hidden field, set it too if present
      await api.nativeSet('input#selected-location, input[name="selectedLocation"]', prof.city || '');
  
      // SOCIALS
      await api.type('input[name="urls[LinkedIn]"]', prof.linkedin || '');
      await api.type('input[name="urls[Github / Stack Overflow]"]', prof.github || '');
      await api.type('input[name="urls[Portfolio]"]', prof.website || prof.portfolio || '');
      await api.type('input[name="urls[Other]"]', prof.other || '');
  
      // DEMOGRAPHICS (visible on some postings)
      // Gender is a native <select> in your dump
      if (prof.gender) {
        await api.selectAny(
          'select[name^="cards"][name$="[field0]"]',
          NORMALIZE.gender(prof.gender)
        );
      }
  
      // Cover letter / comments (optional)
      if (prof.coverLetter) {
        await api.type('textarea[name="comments"], #additional-information', prof.coverLetter);
      }
  
      // Return a summary
      return api.done();
    }
  
    // Register
    window.AF_ADAPTERS = (window.AF_ADAPTERS || []);
    window.AF_ADAPTERS.push({ id, match, fill });
  })();
  