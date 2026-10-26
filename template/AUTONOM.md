# Your Autonom Page

[![Built by Amazon Q](https://img.shields.io/badge/Built%20by-Amazon%20Q-FF9900?style=flat&logo=amazonaws&logoColor=white)](https://aws.amazon.com/q/)
[![Idea by Shannon](https://img.shields.io/badge/Idea%20by-Shannon-e94560?style=flat&logoColor=white)](https://autonom.page)
[![Hosted on GitHub Pages](https://img.shields.io/badge/Hosted%20on-GitHub%20Pages-181717?style=flat&logo=github&logoColor=white)](https://pages.github.com)
[![Powered by Autonom](https://img.shields.io/badge/Powered%20by-Autonom-0f3460?style=flat)](https://autonom.page) 
[![Backed by Loyal9 LLC](https://img.shields.io/badge/Backed%20by-Loyal9%20LLC-04aa6d?style=flat)](https://autonom.page)


---

Your site is a standard set of HTML, CSS, and JavaScript files hosted free on GitHub Pages.
You own everything in this repository. Autonom has no access to it.

---

## What is HTML, CSS, and JavaScript?

**HTML** is the structure of your page — the text, images, buttons, and sections.
Think of it as the bones.

**CSS** is the visual style — colors, fonts, spacing, layout.
Think of it as the skin and clothes.

**JavaScript** is the behavior — what happens when you click a button, save a setting, upload a photo.
Think of it as the brain.

> **DO NOT edit the `.js` files** unless you know exactly what you are doing.
> They talk to GitHub's API to save your content. One wrong character and saves will break silently.
> The only files safe to hand-edit are `styles.css` and `site-config.json`.

---

## How to Edit a File on GitHub

1. Open this repository on GitHub
2. Click the file you want to edit (e.g. `styles.css`)
3. Click the **pencil icon** (✏️) in the top right of the file view
4. Make your changes
5. Scroll down and click **Commit changes**
6. Your site will rebuild automatically — changes are live in about 60 seconds

---

## File Structure

```
your-username.github.io/
│
├── index.html          ← Your profile page (home)
├── gallery.html        ← Photo gallery
├── music.html          ← Music player
├── videos.html         ← YouTube video links
├── friends.html        ← Friends list
├── guestbook.html      ← Guestbook / friend posts
├── games.html          ← Built-in games
├── 404.html            ← Custom "page not found" page
├── callback.html       ← Handles GitHub login redirect (do not edit)
│
├── styles.css          ← All visual styles — safe to edit
├── site-config.json    ← Your page settings — safe to edit carefully
├── manifest.json       ← PWA app info (name, icons, theme color)
├── robots.txt          ← Search engine crawl rules
├── sitemap.xml         ← Page index for search engines
├── rss.xml             ← RSS feed of your status updates
├── friends.json        ← Your friends list data
├── guestbook.json      ← Approved guestbook posts
│
├── auth.js             ← Login, edit mode, session — DO NOT TOUCH
├── github-api.js       ← All GitHub API calls — DO NOT TOUCH
├── theme.js            ← Applies your theme on load — DO NOT TOUCH
├── nav.js              ← Navigation drawer — DO NOT TOUCH
├── index.js            ← Profile page logic — DO NOT TOUCH
├── media.js            ← Photo/cover upload and compression — DO NOT TOUCH
├── feeds.js            ← RSS, sitemap, robots generation — DO NOT TOUCH
├── business.js         ← Business mode and JSON-LD — DO NOT TOUCH
├── admin.js            ← Storage, QR code, export, directory — DO NOT TOUCH
├── gallery.js          ← Gallery page logic — DO NOT TOUCH
├── music.js            ← Music player logic — DO NOT TOUCH
├── videos.js           ← Videos page logic — DO NOT TOUCH
├── friends.js          ← Friends page logic — DO NOT TOUCH
├── guestbook.js        ← Guestbook logic — DO NOT TOUCH
├── games.js            ← Games orchestrator — DO NOT TOUCH
├── sw.js               ← Service worker / offline cache — DO NOT TOUCH
│
├── AUTONOM.md          ← This file
│
├── assets/
│   ├── profile.webp    ← Your profile photo
│   ├── cover.webp      ← Your cover banner photo
│   ├── favicon.ico     ← Browser tab icon (auto-generated from profile photo)
│   ├── icon-192.png    ← PWA home screen icon
│   ├── icon-512.png    ← PWA splash screen icon
│   ├── icon-32.png     ← Small icon
│   ├── background.webp ← Background image (only if you set one)
│   ├── gallery/        ← Your uploaded gallery photos
│   ├── music/          ← Your uploaded MP3
│   └── posts/          ← Images from approved guestbook posts
│
└── games/
    ├── tetris.js
    ├── snake.js
    ├── breakout.js
    ├── pacman.js
    └── spaceinvaders.js
```

---

## File Use Cases

| File | What it does |
|---|---|
| `index.html` | Your profile page — cover photo, profile photo, bio, status, videos, customization panel |
| `styles.css` | Every color, font, spacing, and layout rule on your site |
| `site-config.json` | Your settings — display name, bio, theme, pages on/off, background, custom domain |
| `manifest.json` | Makes your site installable as an app on phones |
| `sw.js` | Caches your site for offline use |
| `auth.js` | Handles GitHub login and unlocks edit mode when you visit your own page |
| `github-api.js` | Saves all your edits back to this repository via GitHub's API |
| `theme.js` | Reads your theme settings and applies them before the page renders |
| `nav.js` | Builds the hamburger navigation drawer from your page settings |
| `index.js` | Wires up all the buttons and logic on your profile page |
| `media.js` | Compresses photos to WebP and uploads them to your repo |
| `feeds.js` | Regenerates your RSS feed, sitemap, and robots.txt when you make changes |
| `business.js` | Powers Business Mode and generates structured data for Google search |
| `admin.js` | Storage meter, QR code, export/backup, directory listing |
| `gallery.js` | Photo grid, upload, and delete logic |
| `music.js` | MP3 player, upload, and track metadata |
| `videos.js` | YouTube embed grid, add and remove links |
| `friends.js` | Friends grid, add by username, fetches their profile automatically |
| `guestbook.js` | Displays approved posts, handles new post submissions and moderation |
| `games.js` | Loads and switches between the five built-in games |
| `friends.json` | Stores your friends list — edited automatically when you add/remove friends |
| `guestbook.json` | Stores approved guestbook posts — edited automatically on approval |
| `robots.txt` | Tells search engines whether to index your site |
| `sitemap.xml` | Lists all your active pages for search engines |
| `rss.xml` | RSS feed — updates when you change your status |
| `callback.html` | Handles the GitHub login redirect — do not edit |
| `404.html` | Shown when someone visits a page that doesn't exist |
| `AUTONOM.md` | This file |

---

## Hex Color Reference

These are the colors used across your site. You can change them in `styles.css` under `:root`.

### Dark Mode (default)

| Variable | Hex | Used for |
|---|---|---|
| `--bg` | `#1a1a2e` | Page background |
| `--surface` | `#16213e` | Cards, panels, nav drawer |
| `--surface-2` | `#0f3460` | Inputs, secondary buttons, hover states |
| `--accent` | `#e94560` | Buttons, links, highlights |
| `--text` | `#eaeaea` | Main text |
| `--text-muted` | `#888888` | Secondary text, labels, hints |

### Light Mode

| Variable | Hex | Used for |
|---|---|---|
| `--bg` | `#f5f5f5` | Page background |
| `--surface` | `#ffffff` | Cards, panels |
| `--surface-2` | `#e8e8e8` | Inputs, secondary buttons |
| `--accent` | `#e94560` | Buttons, links (same as dark) |
| `--text` | `#1a1a2e` | Main text |
| `--text-muted` | `#666666` | Secondary text |

### Other Colors

| Hex | Used for |
|---|---|
| `#2d6a4f` | Success toast (green) |
| `#c1121f` | Error toast (red) |
| `#04AA6D` | DNS verified indicator |

---

## If You Broke It

Don't panic. Your content is safe — it's all still in this repository.

### Option 1 — Undo a specific file

If you edited a file and something broke:

1. Open the file on GitHub
2. Click **History** (top right of the file view)
3. Find the last working version and click it
4. Click the **pencil icon** to edit, then immediately click **Commit changes** to restore it

### Option 2 — Full reset (nuclear option)

If things are really broken and you want to start fresh:

1. **Delete this repository**
   - Go to your repository on GitHub
   - Click **Settings** → scroll to the bottom → **Delete this repository**
   - Type the repo name to confirm

2. **Remove the Autonom app from your GitHub account**
   - Go to [github.com/settings/installations](https://github.com/settings/installations)
   - Find **Autonom Page** and click **Configure**
   - Scroll down and click **Uninstall**

3. **Go back to [autonom.page](https://autonom.page) and start over**
   - Click **Get Started**
   - Connect your GitHub account
   - Install the app when prompted
   - Fill in your name and bio
   - Your site will be rebuilt fresh in about a minute

> Your old photos and content are gone after a full reset — export a backup first from your page's Admin panel if you want to keep anything.

---

*Built by [Amazon Q](https://aws.amazon.com/q/). Shannon kinda had an idea... kinda.*
