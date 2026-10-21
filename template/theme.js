(() => {
  // ─── Apply theme immediately from localStorage cache ─────────────────────────
  // Prevents flash of unstyled content on repeat visits before fetch completes
  const cached = localStorage.getItem('autonom_theme');
  if (cached) applyTheme(JSON.parse(cached));

  // ─── Apply Theme ─────────────────────────────────────────────────────────────
  function applyTheme(config) {
    if (!config) return;

    const root = document.documentElement;
    const body = document.body;

    // Light / dark
    root.setAttribute('data-theme', config.theme || 'dark');

    // Background
    const bg = config.background || {};
    body.style.backgroundImage = '';
    body.style.background = '';

    if (bg.type === 'color') {
      body.style.background = bg.value || '#1a1a2e';

    } else if (bg.type === 'gradient') {
      body.style.background = bg.value || '#1a1a2e';

    } else if (bg.type === 'image') {
      body.style.backgroundImage = `url('${bg.value}')`;
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
      body.style.backgroundRepeat = 'no-repeat';
      body.style.backgroundAttachment = 'fixed';

    } else if (bg.type === 'scattered') {
      // Multiple images scattered — applied as repeating background tiles
      if (Array.isArray(bg.value) && bg.value.length) {
        body.style.backgroundImage = bg.value.map(url => `url('${url}')`).join(', ');
        body.style.backgroundRepeat = 'no-repeat';
        body.style.backgroundSize = '200px 200px';
      }
    }

    // Custom CSS — injected into a dedicated style tag
    let styleTag = document.getElementById('autonom-custom-css');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'autonom-custom-css';
      document.head.appendChild(styleTag);
    }
    // CSP blocks script execution in CSS — safe to inject raw CSS string
    styleTag.textContent = config.customCSS || '';
  }

  // ─── Fetch fresh config and re-apply ─────────────────────────────────────────
  async function loadAndApply() {
    try {
      const res = await fetch('site-config.json', { cache: 'no-store' });
      if (!res.ok) return;
      const config = await res.json();

      applyTheme(config);

      // Cache theme-relevant fields only — not the full config
      localStorage.setItem('autonom_theme', JSON.stringify({
        theme:     config.theme,
        background: config.background,
        customCSS: config.customCSS || '',
      }));

    } catch {
      // Network unavailable — cached theme already applied above, nothing to do
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────────
  // Called by index.js when owner saves theme changes in edit mode
  // Applies immediately without a page reload
  window.AutonomTheme = { applyTheme };

  loadAndApply();
})();
