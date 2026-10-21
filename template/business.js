(() => {
  function populateBusinessForm(config) {
    const bp = config.businessProfile || {};
    setVal('business-type',        bp.type || '');
    setVal('business-name',        bp.name || '');
    setVal('business-category',    bp.category || '');
    setVal('business-city',        bp.address?.locality || '');
    setVal('business-region',      bp.address?.region || '');
    setVal('business-country',     bp.address?.country || '');
    setVal('business-phone',       bp.phone || '');
    setVal('business-email',       bp.email || '');
    setVal('business-price-range', bp.priceRange || '');
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function getVal(id) {
    return document.getElementById(id)?.value || '';
  }

  async function saveBusinessProfile(config) {
    const bp = {
      enabled:  true,
      type:     getVal('business-type'),
      name:     getVal('business-name'),
      category: getVal('business-category'),
      address: {
        locality: getVal('business-city'),
        region:   getVal('business-region'),
        country:  getVal('business-country'),
      },
      phone:      getVal('business-phone'),
      email:      getVal('business-email'),
      priceRange: getVal('business-price-range'),
      services:   config.businessProfile?.services || [],
      hours:      config.businessProfile?.hours    || [],
    };

    await Autonom.saveConfig(config, { businessProfile: bp }, 'Update business profile');
    await rewriteIndexHead(config, generateJSONLD(bp));
    Autonom.toast('Business profile saved', 'success');
  }

  function generateJSONLD(bp) {
    const typeMap = {
      LocalBusiness:       'LocalBusiness',
      ProfessionalService: 'ProfessionalService',
      Restaurant:          'Restaurant',
      Store:               'Store',
      EventVenue:          'EventVenue',
    };
    const schema = {
      '@context': 'https://schema.org',
      '@type':    typeMap[bp.type] || 'LocalBusiness',
      name:       bp.name,
      image:      `https://${Autonom.OWNER}.github.io/assets/profile.webp`,
      url:        `https://${Autonom.OWNER}.github.io`,
      telephone:  bp.phone,
      email:      bp.email,
      address: {
        '@type':         'PostalAddress',
        addressLocality: bp.address.locality,
        addressRegion:   bp.address.region,
        addressCountry:  bp.address.country,
      },
      priceRange: bp.priceRange,
    };
    if (bp.hours?.length) schema.openingHoursSpecification = bp.hours;
    return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n<\/script>`;
  }

  async function rewriteIndexHead(config, jsonLDBlock) {
    try {
      const data = await Autonom.ghGet(`/repos/${Autonom.OWNER}/${Autonom.REPO}/contents/index.html`);
      let html = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));

      // Remove existing JSON-LD block
      html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, '');

      // Inject new block before </head> if provided
      if (jsonLDBlock) html = html.replace('</head>', `${jsonLDBlock}\n</head>`);

      // Rewrite OG + Twitter tags
      const name = config.displayName || 'My Page';
      const bio  = config.bio || '';
      html = html
        .replace(/(<meta property="og:title" content=")[^"]*(")/,       `$1${name}'s Page$2`)
        .replace(/(<meta property="og:description" content=")[^"]*(")/,  `$1${bio}$2`)
        .replace(/(<meta name="twitter:title" content=")[^"]*(")/,       `$1${name}'s Page$2`)
        .replace(/(<meta name="twitter:description" content=")[^"]*(")/,  `$1${bio}$2`);

      await Autonom.ghPut(`/repos/${Autonom.OWNER}/${Autonom.REPO}/contents/index.html`, {
        message: 'Update JSON-LD and OG tags',
        content: btoa(unescape(encodeURIComponent(html))),
        sha: data.sha,
      });
    } catch (e) {
      Autonom.toast(`Failed to update page metadata — ${e.message}`, 'error');
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  Object.assign(window.Autonom, {
    populateBusinessForm,
    saveBusinessProfile,
    generateJSONLD,
    rewriteIndexHead,
  });
})();
