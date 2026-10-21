(() => {
  async function regenerateRSS(config) {
    const url  = `https://${Autonom.OWNER}.github.io`;
    const name = config.displayName || Autonom.OWNER;
    const rss  = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${name}'s Page</title>
    <link>${url}</link>
    <description>${config.bio || ''}</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${config.status ? `<item><title>Status Update</title><description>${config.status}</description><pubDate>${new Date().toUTCString()}</pubDate></item>` : ''}
  </channel>
</rss>`;
    await Autonom.commitFile('rss.xml', rss, 'Regenerate RSS feed');
  }

  async function regenerateSitemap(config) {
    if (!config.directory?.listed) return;
    const base     = `https://${Autonom.OWNER}.github.io`;
    const pages    = config.pages || {};
    const pageFiles = {
      gallery:   'gallery.html',
      music:     'music.html',
      videos:    'videos.html',
      friends:   'friends.html',
      guestbook: 'guestbook.html',
      games:     'games.html',
    };
    const today = new Date().toISOString().split('T')[0];
    const urls  = [`  <url><loc>${base}/</loc><lastmod>${today}</lastmod></url>`];

    Object.entries(pageFiles).forEach(([key, file]) => {
      if (pages[key]) urls.push(`  <url><loc>${base}/${file}</loc><lastmod>${today}</lastmod></url>`);
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
    await Autonom.commitFile('sitemap.xml', xml, 'Regenerate sitemap');
    fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(`${base}/sitemap.xml`)}`).catch(() => {});
  }

  async function regenerateRobots(config) {
    const listed  = config.directory?.listed !== false;
    const robots  = listed ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n';
    await Autonom.commitFile('robots.txt', robots, 'Regenerate robots.txt');
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  Object.assign(window.Autonom, {
    regenerateRSS,
    regenerateSitemap,
    regenerateRobots,
  });
})();
