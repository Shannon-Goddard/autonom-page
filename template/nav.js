(() => {
  const PAGES = [
    { key: 'gallery',   label: 'Gallery',   href: 'gallery.html' },
    { key: 'music',     label: 'Music',     href: 'music.html' },
    { key: 'videos',    label: 'Videos',    href: 'videos.html' },
    { key: 'friends',   label: 'Friends',   href: 'friends.html' },
    { key: 'guestbook', label: 'Guestbook', href: 'guestbook.html' },
    { key: 'games',     label: 'Games',     href: 'games.html' },
  ];

  const currentPage = location.pathname.split('/').pop() || 'index.html';

  // ─── Build Nav ───────────────────────────────────────────────────────────────
  function buildNav(config) {
    const drawer = document.getElementById('nav-drawer');
    if (!drawer) return;

    const pages = config?.pages || {};
    const displayName = config?.displayName || 'Home';

    const ul = document.createElement('ul');
    ul.setAttribute('role', 'list');

    // Home always visible
    const homeLi = document.createElement('li');
    const homeA = document.createElement('a');
    homeA.href = 'index.html';
    homeA.textContent = displayName;
    homeA.setAttribute('aria-label', 'Go to home page');
    if (currentPage === 'index.html' || currentPage === '') {
      homeA.setAttribute('aria-current', 'page');
      homeA.classList.add('nav-active');
    }
    homeLi.appendChild(homeA);
    ul.appendChild(homeLi);

    // Toggled pages
    PAGES.forEach(({ key, label, href }) => {
      if (!pages[key]) return;

      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = href;
      a.textContent = label;
      a.setAttribute('aria-label', `Go to ${label} page`);
      if (currentPage === href) {
        a.setAttribute('aria-current', 'page');
        a.classList.add('nav-active');
      }
      li.appendChild(a);
      ul.appendChild(li);
    });

    // Logout button — only visible in edit mode
    const logoutLi = document.createElement('li');
    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'nav-logout';
    logoutBtn.textContent = 'Log Out';
    logoutBtn.setAttribute('aria-label', 'Log out of edit mode');
    logoutBtn.classList.add('hidden');
    logoutBtn.addEventListener('click', () => {
      if (window.Autonom) Autonom.logout();
      closeNav();
    });
    logoutLi.appendChild(logoutBtn);
    ul.appendChild(logoutLi);

    // Close button inside drawer
    const closeBtn = document.createElement('button');
    closeBtn.id = 'nav-close';
    closeBtn.setAttribute('aria-label', 'Close navigation menu');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', closeNav);

    drawer.innerHTML = '';
    drawer.appendChild(closeBtn);
    drawer.appendChild(ul);

    // Show logout in edit mode
    if (document.body.classList.contains('edit-mode')) {
      logoutBtn.classList.remove('hidden');
    }

    // Observe edit-mode class changes to show/hide logout
    const observer = new MutationObserver(() => {
      if (document.body.classList.contains('edit-mode')) {
        logoutBtn.classList.remove('hidden');
      } else {
        logoutBtn.classList.add('hidden');
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  // ─── Open / Close ─────────────────────────────────────────────────────────────
  function openNav() {
    const drawer = document.getElementById('nav-drawer');
    const toggle = document.getElementById('nav-toggle');
    if (!drawer) return;

    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    toggle?.setAttribute('aria-expanded', 'true');

    // Focus first link in drawer
    const firstLink = drawer.querySelector('a, button');
    firstLink?.focus();

    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleOutsideClick);
  }

  function closeNav() {
    const drawer = document.getElementById('nav-drawer');
    const toggle = document.getElementById('nav-toggle');
    if (!drawer) return;

    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    toggle?.setAttribute('aria-expanded', 'false');
    toggle?.focus();

    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('click', handleOutsideClick);
  }

  // ─── Keyboard Support ─────────────────────────────────────────────────────────
  function handleKeydown(e) {
    const drawer = document.getElementById('nav-drawer');
    if (!drawer) return;

    if (e.key === 'Escape') {
      closeNav();
      return;
    }

    // Focus trap inside drawer
    if (e.key === 'Tab') {
      const focusable = Array.from(drawer.querySelectorAll('a, button')).filter(el => !el.classList.contains('hidden'));
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function handleOutsideClick(e) {
    const drawer = document.getElementById('nav-drawer');
    const toggle = document.getElementById('nav-toggle');
    if (drawer && !drawer.contains(e.target) && e.target !== toggle) {
      closeNav();
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  async function init() {
    const toggle = document.getElementById('nav-toggle');
    toggle?.addEventListener('click', () => {
      const drawer = document.getElementById('nav-drawer');
      drawer?.classList.contains('open') ? closeNav() : openNav();
    });

    // Fetch config network-first — sw.js bypasses cache for .json
    let config = null;
    try {
      const res = await fetch('site-config.json', { cache: 'no-store' });
      if (res.ok) config = await res.json();
    } catch {
      // Offline — drawer will still build with whatever config is available
    }

    buildNav(config);

    // Set initial aria-hidden on drawer
    const drawer = document.getElementById('nav-drawer');
    if (drawer) drawer.setAttribute('aria-hidden', 'true');
  }

  init();
})();
