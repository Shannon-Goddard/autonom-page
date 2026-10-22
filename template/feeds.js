(() => {
  async function regenerateRSS(config) {
    const base = `https://${Autonom.OWNER}.github.io`;
    const name = config.displayName || Autonom.OWNER;
    const now  = new Date().toUTCString();

    // Build items — status update + approved guestbook posts
    const items = [];

    if (config.status) {
      items.push(`    <item>
      <title>Status Update</title>
      <description>${escXml(config.status)}</description>
      <link>${base}/</link>
      <pubDate>${now}</pubDate>
      <guid isPermaLink="false">status-${Date.now()}</guid>
    </item>`);
    }

    // Pull approved guestbook posts if available
    try {
      const res = await fetch(`${base}/guestbook.json`, { cache: 'no-store' });
      if (res.ok) {
        const posts = await res.json();
        posts.slice(-10).reverse().forEach(p => {
          items.push(`    <item>
      <title>Post from ${escXml(p.displayName)}</title>
      <description>${escXml(p.text)}</description>
      <link>${base}/guestbook.html</link>
      <pubDate>${new Date(p.createdAt).toUTCString()}</pubDate>
      <guid isPermaLink="false">post-${p.createdAt}</guid>
    </item>`);
        });
      }
    } catch { /* offline or no posts yet */ }

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escXml(name)}'s Page</title>
    <link>${base}/</link>
    <description>${escXml(config.bio || '')}</description>
    <atom:link href="${base}/rss.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${now}</lastBuildDate>
    <language>en</language>
${items.join('\n')}
  </channel>
</rss>`;

    await Autonom.commitFile('rss.xml', rss, 'Regenerate RSS feed');
  }

  async function regenerateSitemap(config) {
    // Don't generate sitemap for off-grid sites
    if (config.directory?.listed === false) return;

    const base      = `https://${Autonom.OWNER}.github.io`;
    const pages     = config.pages || {};
    const today     = new Date().toISOString().split('T')[0];
    const pageFiles = {
      gallery:   { file: 'gallery.html',   priority: '0.7' },
      music:     { file: 'music.html',     priority: '0.6' },
      videos:    { file: 'videos.html',    priority: '0.6' },
      friends:   { file: 'friends.html',   priority: '0.5' },
      guestbook: { file: 'guestbook.html', priority: '0.5' },
      games:     { file: 'games.html',     priority: '0.4' },
    };

    const urls = [`  <url>
    <loc>${base}/</loc>
    <lastmod>${today}</lastmod>
    <priority>1.0</priority>
  </url>`];

    Object.entries(pageFiles).forEach(([key, { file, priority }]) => {
      if (pages[key]) {
        urls.push(`  <url>
    <loc>${base}/${file}</loc>
    <lastmod>${today}</lastmod>
    <priority>${priority}</priority>
  </url>`);
      }
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

    await Autonom.commitFile('sitemap.xml', xml, 'Regenerate sitemap');
  }

  async function regenerateRobots(config) {
    const listed = config.directory?.listed !== false;
    const robots = listed
      ? 'User-agent: *\nAllow: /\n'
      : 'User-agent: *\nDisallow: /\n';
    await Autonom.commitFile('robots.txt', robots, 'Regenerate robots.txt');
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  function escXml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  Object.assign(window.Autonom, {
    regenerateRSS,
    regenerateSitemap,
    regenerateRobots,
  });
})();
