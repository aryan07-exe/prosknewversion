// adapters/icims.adapter.js
(function () {
    const id = 'icims';
    const match = (host) => /(^|\.)icims\.com$/.test(host);
  
    async function waitForInnerForm(api, timeout = 8000) {
      // iCIMS often loads the real form inside an inner frame/app after auth.
      // We poll for the first visible input/textarea/select in the *current* frame.
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        const has = await api.exists('input, textarea, select');
        if (has) return true;
        await api.sleep(200);
      }
      return false;
    }
  
    async function fill(page, prof, api) {
      const ready = await waitForInnerForm(api);
      if (!ready) {
        // Log but do not fail the entire run—user may be on profile hub step
        await api.log('iCIMS: no form fields visible yet (profile hub or login step?)');
        return api.done();
      }
  
      // Try common iCIMS labels/fields (generic block-based)
      await api.typeByLabel(/(full\s*)?name|first\s*name/i, prof.firstName || prof.name?.split(' ')?.[0] || '');
      await api.typeByLabel(/last\s*name/i,  prof.lastName || prof.name?.split(' ')?.slice(1).join(' ') || '');
      await api.typeByLabel(/email/i,        prof.email);
      await api.typeByLabel(/phone/i,        prof.phone);
      await api.typeByLabel(/city/i,         prof.city);
      await api.typeByLabel(/state/i,        prof.state);
      await api.typeByLabel(/country/i,      prof.country);
      await api.typeByLabel(/postal|zip/i,   prof.zip);
  
      // socials
      await api.typeByLabel(/linkedin/i,     prof.linkedin || '');
      await api.typeByLabel(/github/i,       prof.github || '');
      await api.typeByLabel(/website|portfolio/i, prof.website || prof.portfolio || '');
  
      // demographics (when present)
      await api.selectByLabel(/gender/i,     prof.gender);
      await api.selectByLabel(/race|ethnicity/i, prof.race || prof.ethnicity || '');
      await api.selectByLabel(/disability/i, prof.disability || '');
      await api.selectByLabel(/veteran/i,    prof.veteran || '');
  
      return api.done();
    }
  
    // Register
    window.AF_ADAPTERS = (window.AF_ADAPTERS || []);
    window.AF_ADAPTERS.push({ id, match, fill });
  })();
  