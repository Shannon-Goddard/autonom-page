# Project Roadmap: The Decentralized Personal Web OS

---

## Architectural Principles (Non-Negotiable)
- Zero backend servers — GitHub Pages is the only host for user content
- All user content lives exclusively in the user's own GitHub repository
- Platform founder stores ONLY GitHub username + public URL in DynamoDB directory
- All content liability belongs to the user — enforced via Terms of Service on onboarding page
- OAuth tokens never touch any repo or config file — sessionStorage only, cleared on logout
- Edit mode is driven entirely by GitHub OAuth state — no separate admin page, no pin
- Platform uses a GitHub App (not OAuth App) for fine-grained, scoped, short-lived tokens
- Broad repo-creation scope is requested only during onboarding, then dropped permanently
- Edit mode re-prompts OAuth only when owner actively enters edit mode
- A stateless AWS Lambda OAuth Proxy handles all token exchanges — client secret never touches the browser
- Content Security Policy (CSP) meta tags included in every skeleton HTML file from day one
- Guestbook/friend posts use GitHub Issues API — not Pull Requests — for cross-account submissions
- All client-side reads use raw static URLs (`username.github.io/file.json`) — `api.github.com` is reserved strictly for authenticated write operations in edit mode
- Every user site ships as an installable PWA via `manifest.json` and `sw.js`
- All interactive elements include proper `aria-label` attributes and keyboard navigation support from day one
- Every GitHub API call in edit mode has explicit success/failure toast notification feedback

---

## Phase 0: AWS OAuth Proxy Lambda (Prerequisite — Must Build First)

### Why This Exists
GitHub's OAuth Web Application Flow requires a client secret to exchange an authorization code for an access token. A client secret cannot exist in client-side JavaScript — anyone opening DevTools could steal it. This Lambda is the secure middleman.

### GitHub App Installation Flow (Not Standard OAuth)
This is a GitHub App, not a standard OAuth App. The flow is different and must be implemented correctly:
- Onboarding "Get Started" link points to: `https://github.com/apps/[your-app-name]/installations/new`
- GitHub redirects back to your callback URL with an `installation_id` parameter (not just a `code`)
- The Lambda receives the `installation_id` and generates a short-lived installation access token by:
  1. Generating a JWT signed with the GitHub App's private key (stored in Lambda environment variable)
  2. Calling `POST /app/installations/{installation_id}/access_tokens` with that JWT
  3. Returning the installation access token to the browser → stored in sessionStorage only
- The GitHub App private key lives in Lambda environment variables — never in code, never in any repo

### How It Works
```
[ User clicks "Get Started" → redirected to github.com/apps/[app-name]/installations/new ]
              │
              ▼
[ GitHub redirects back with installation_id ]
              │
              ▼
[ Browser sends installation_id to Lambda endpoint ]
              │
              ▼
[ Lambda signs JWT with private key, calls GitHub /access_tokens endpoint ]
              │
              ▼
[ Lambda returns installation access_token to browser → stored in sessionStorage only ]
```

### Infrastructure
- Single AWS Lambda function (Node.js or Python, stateless)
- API Gateway endpoint (HTTPS only)
- GitHub App private key stored in Lambda environment variable (never in code)
- CORS locked strictly to your onboarding domain — `Access-Control-Allow-Origin: https://yourdomain.com`
- Allowed origin stored as Lambda environment variable — configurable without code redeploy if domain changes
- `Access-Control-Allow-Methods: POST` only — no GET, no unnecessary OPTIONS beyond preflight
- CORS must never be set to `*` — a wildcard allows any malicious site to route authorization codes through your proxy
- This same Lambda extended in Phase 3 to handle DynamoDB directory writes

### GitHub App Token Scopes
- Onboarding scope: `contents:write`, `pages:write`, `metadata:read` — only for initial deploy
- Edit mode scope: `contents:write` on their specific repo only
- Token lifespan: sessionStorage, cleared on tab close or logout
- After onboarding deploy completes: broad token cleared, user prompted to re-auth with narrow scope on next edit session

---

## Phase 1: Marketing & Onboarding Page (Your `index.html`)

### Goal
A clean, modern landing page that explains the platform, handles GitHub OAuth via the proxy Lambda, and deploys a fully built personal site to the user's GitHub Pages — redirecting only after confirmed deployment.

### Pages / Files
- `index.html` — marketing + onboarding UI
- `onboard.js` — GitHub OAuth flow + repo creation logic + deployment poller
- `template/` — the full site template pushed to the user's repo on deploy

### Features
- Hero section: platform pitch, value proposition, "own your web presence for free"
- Accordion FAQ:
  - "What is GitHub?" — plain English explanation
  - "Why do I need a GitHub account?" — explains it's your free hosting provider
  - "How do I create one?" — direct link to github.com/signup
  - "Is this really free?" — explains GitHub Pages free tier
- "Get Started" button → GitHub OAuth login via proxy Lambda
- Simple input form collected before deploy: display name, bio, profile photo upload
- Profile photo client-side compressed to WebP under 200kb before any API call

### Onboarding Deploy Flow
1. User clicks "Get Started" → redirected to `https://github.com/apps/[app-name]/installations/new`
2. User installs the GitHub App on their account → GitHub redirects back with `installation_id`
3. `onboard.js` sends `installation_id` to Lambda proxy → receives installation access token → stored in sessionStorage
4. Form submitted → onboard.js runs:
   - Creates `username.github.io` repo via GitHub REST API
   - Pushes full template suite to repo
   - Enables GitHub Pages via API
5. Deployment poller starts — polls `GET /repos/{owner}/{repo}/pages/builds/latest` every 5 seconds
6. Animated progress checklist shown to user during wait:
   - ✅ GitHub account connected
   - ✅ Repository created
   - ✅ Template deployed
   - ⏳ Building your site... (live spinner)
   - ✅ Site is live!
7. Redirect to `username.github.io` only after build status returns `built` or HTTP 200 confirmed
8. Broad onboarding token cleared from sessionStorage immediately after redirect

### Aesthetic
- Glassmorphism, dark base, clean modern feel
- Hints at the customization users will get on their own page
- Fully responsive

### Terms of Service (Displayed Before OAuth)
- Platform stores only GitHub username and public URL in directory
- All uploaded content is stored in the user's own GitHub repository
- Platform has zero access to, control over, or liability for user content
- User is solely responsible for all content they publish and all content they approve from friends
- GitHub's own Terms of Service apply to all repository content
- Must be acknowledged (checkbox) before "Get Started" activates

---

## Phase 2: User Profile Template (Deployed to `username.github.io`)

### Goal
A Facebook-style personal profile page with MySpace-level customization, full media sharing, GitHub OAuth-gated edit mode, and all pages shipped and toggleable from day one.

### Files Deployed to User Repo
```
username.github.io/
├── index.html           — Profile page
├── gallery.html         — Photo gallery
├── music.html           — Music player
├── videos.html          — Video links
├── friends.html         — Friends / address book
├── guestbook.html       — Friend posts (Issues-based moderation)
├── games.html           — Games page
├── 404.html             — Custom styled 404
├── manifest.json        — PWA manifest (app name, icons, theme color, display mode)
├── sw.js                — Service Worker (caching strategy, offline fallback)
├── robots.txt           — Crawl rules (allow all in personal/business, disallow all if off-grid)
├── sitemap.xml          — Auto-generated, lists all active public pages
├── site-config.json     — Master config (pages on/off, theme, bio, display name)
├── friends.json         — Friend list (URLs, display names, photo paths)
├── guestbook.json       — Approved posts (committed on approval)
├── rss.xml              — Auto-generated RSS/Atom feed (updated on every post/status change)
├── nav.js               — Shared navigation drawer (reads site-config.json)
├── auth.js              — GitHub OAuth state, edit mode unlock, sessionStorage only
├── theme.js             — Theme engine (light/dark, background, color picker)
└── assets/
    ├── profile.webp
    ├── cover.webp
    ├── favicon.ico       — Auto-generated 32x32 from profile photo via Canvas API
    ├── icon-192.png      — PWA home screen icon
    ├── icon-512.png      — PWA splash screen icon
    ├── music/            — One active MP3 at a time
    ├── gallery/          — Compressed WebP photos
    └── posts/            — Approved friend post image assets
```

### `site-config.json` Structure
```json
{
  "displayName": "",
  "bio": "",
  "status": "",
  "theme": "dark",
  "background": {
    "type": "color",
    "value": "#1a1a2e"
  },
  "pages": {
    "gallery": true,
    "music": true,
    "videos": true,
    "friends": true,
    "guestbook": true,
    "games": true
  },
  "directory": {
    "listed": true
  },
  "customDomain": "",
  "currentTrack": {
    "filename": "",
    "title": "",
    "artist": ""
  },
  "videos": [],
  "rss": {
    "enabled": true
  },
  "lastUpdated": "",
  "firstTimeSetup": true,
  "mode": "personal",
  "personalModeSnapshot": null,
  "configVersion": 1,
  "businessProfile": {
    "enabled": false,
    "type": "",
    "name": "",
    "category": "",
    "address": {
      "locality": "",
      "region": "",
      "country": ""
    },
    "phone": "",
    "email": "",
    "priceRange": "",
    "services": [],
    "hours": []
  }
}
```

### Content Security Policy
Every skeleton HTML file includes:
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' https: data:; media-src 'self'; frame-src https://www.youtube.com;">
```
- Allows inline styles (needed for theme engine + custom CSS)
- Blocks inline script execution (XSS protection for custom CSS injection fields)
- Allows YouTube iframes only for video embeds
- Allows external images via HTTPS (for friend profile photos fetched from their repos)

### OpenGraph & Twitter Card Meta Tags
Every `index.html` template includes pre-populated OG and Twitter card meta tags:
```html
<meta property="og:title" content="[DisplayName]'s Web Space" />
<meta property="og:description" content="[bio]" />
<meta property="og:image" content="https://[username].github.io/assets/profile.webp" />
<meta property="og:url" content="https://[username].github.io" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="[DisplayName]'s Web Space" />
<meta name="twitter:description" content="[bio]" />
<meta name="twitter:image" content="https://[username].github.io/assets/profile.webp" />
```
- Populated at deploy time with display name, bio, and profile photo URL
- Auto-rewritten in `index.html` via GitHub API commit whenever owner updates display name or bio in edit mode
- Ensures rich preview cards on iMessage, WhatsApp, Discord, X/Twitter, and any OG-aware platform
- No server-side rendering needed — tags are static strings committed directly to the file

---

## Phase 2A: Profile Page (`index.html`)

### Layout (Facebook-style)
- Full-width cover photo across top
- Profile photo overlapping cover, bottom-left
- Display name + bio below profile photo
- Current status / pinned text post
- Video links section (YouTube embeds, owner-curated)
- No public wall — profile is owner content only

### Edit Mode (Owner Only — GitHub OAuth Gated)
- Unlocks when authenticated GitHub user matches repo owner
- Edit mode re-prompts OAuth if no active session — narrow scope (`contents:write` on their repo only)
- Edit buttons appear on every section (cover, profile photo, bio, status, videos)
- All edits commit directly to repo via GitHub REST API
- Edit mode hidden entirely from public — no buttons, no overlays visible to visitors
- Status update triggers `rss.xml` regeneration and commit

### Profile & Cover Photo
- Client-side resize + convert to WebP before upload
- Hard cap: 200kb per image
- Replaces existing file in repo on upload (no accumulation)

### Customization Panel (Edit Mode Only)
- Light / dark mode toggle
- Background options:
  - Solid color picker
  - Single centered image upload
  - Multiple scattered images upload
  - Gradient presets
- Custom CSS injection field for power users (CSP blocks script execution in CSS fields)
- Page visibility toggles for all pages (writes to `site-config.json`)
- All changes write to `site-config.json` and apply via `theme.js`

### Admin Utilities (Edit Mode Only)
- Storage meter: current repo size via GitHub API, warning at 500MB, prompt at 800MB
- Export / Backup button: downloads a `.zip` of their entire repo using JSZip — proves true ownership, no server needed
- Directory toggle: opt in/out of DynamoDB searchable directory
- Custom domain field (see Phase 4)
- Share My Page button: copies `username.github.io` URL to clipboard in one click
- QR code generator: vanilla JS (no library), generates a downloadable/printable QR code pointing to their page — shareable in real life
- Notifications badge: unread count pulled from open `pending-post` Issues via GitHub API — visible in edit mode so owner knows when posts are waiting without checking GitHub directly

### First-Time Setup Wizard
- Triggered once after onboarding deploy completes, before owner lands on their live page
- One-time welcome overlay walks them through:
  - Set your status
  - Upload a cover photo
  - Toggle pages on/off
- Dismissible at any point
- Never shows again — controlled by `firstTimeSetup: false` flag written to `site-config.json` on dismiss

### Site Last Updated Timestamp
- Small public-facing "Last updated: X days ago" displayed on profile page
- Written to `site-config.json` as `lastUpdated` ISO timestamp on every edit/commit
- Signals to visitors the site is active
- Encourages owners to keep their page fresh

### Favicon
- Default platform favicon ships in template
- When owner uploads a profile photo, Canvas API generates a 32x32 version and commits it as `favicon.ico` in the same upload commit
- Browser tab shows their face or logo — feels polished and personal
- Replaces on every profile photo update

### Accessibility (a11y)
- All interactive elements have `aria-label` attributes
- Proper heading hierarchy (`h1` → `h2` → `h3`) enforced across all pages
- Hamburger menu and edit mode panels fully keyboard navigable (focus trap in modals, Escape to close)
- All images have descriptive `alt` attributes (populated from display name / caption fields)
- Accessibility signals contribute to Google SEO ranking alongside JSON-LD structured data
- Applies to both public view and edit mode UI

### Error Handling & Toast Notifications
- Every GitHub API call in edit mode has explicit success/failure feedback
- Toast notification system (vanilla JS, no library) — slides in from bottom-right, auto-dismisses after 4 seconds
- Success toasts: green — "Profile photo updated", "Post approved", "Settings saved"
- Error toasts: red — "Save failed — please try again", "Token expired — please log in again", "File too large"
- Token expiry errors automatically prompt re-auth rather than silently failing
- Network errors on guestbook approval/reject show specific retry option
- Applies to every edit mode action across all pages

---

## Phase 2I: PWA — Progressive Web App

### `manifest.json`
- Ships in every deployed template
- Contains: app name (display name), short name, theme color (synced with their chosen theme), background color, display mode (`standalone`), start URL, icon paths
- Enables "Add to Home Screen" on iOS and Android — friends can install the site as an app icon
- `theme_color` updated via GitHub API commit whenever owner changes their theme color

### `sw.js` — Service Worker & Caching Strategy

**Cache-hard assets (shell cache — invalidated only on Service Worker version bump):**
- `nav.js`, `auth.js`, `theme.js`
- All HTML skeleton files
- Game JS files
- PWA icons

**Network-first assets (always fetch fresh, fall back to cache if offline):**
- All `.json` files — Service Worker fetch handler explicitly checks `url.endsWith('.json')` and bypasses cache entirely, goes straight to network
- All `.xml` files — same explicit bypass: `url.endsWith('.xml')` skips cache, hits GitHub Pages CDN directly
- No query param cache-busting needed — the bypass is enforced at the Service Worker fetch event level
- All gallery images and MP3 — network first, cached on first load

**Offline fallback:**
- If network unavailable: shell assets, games, and cached music player load seamlessly
- Gallery shows cached images if previously visited
- `.json` and `.xml` files fall back to last cached version with a visible "You're viewing a cached version" indicator — never silently serves stale data

**Cache-busting via `configVersion`:**
- `site-config.json` includes `"configVersion": 1` — incremented by 1 on every edit mode commit
- Service Worker compares stored version to fetched version on load
- If version changed: shell cache invalidated and refreshed silently in background
- Ensures visitors never see stale nav, theme, or page toggle states after owner makes changes

**Install prompt:**
- Subtle "Add to your home screen" banner shown to mobile visitors after 2nd visit
- Dismissible, never shown again if dismissed (flag in localStorage)
- Framed as: "Install [DisplayName]'s page as an app"

---

## Phase 2J: Personal / Business Mode

### Overview
A single toggle in the customization panel that shifts the entire site between two visibility presets. Switching modes never deletes any content — it only changes what is shown to visitors. The owner can switch back at any time and their previous state is fully restored.

### Personal Mode (Default)
- All pages on: profile, gallery, music, videos, friends, guestbook, games
- Full interactive experience — visitors can post to guestbook, friends grid visible, music player active
- MySpace/Facebook feel

### Business Mode
- Auto-hides on switch: music, games, friends, guestbook
- Auto-shows on switch: profile, gallery, videos
- Bio field becomes a professional summary, status becomes a tagline
- "Last updated" timestamp hidden by default (feels less personal blog)
- All visitor input stripped from DOM entirely — no post buttons, no forms, no interactive elements for non-owners
- Guestbook if manually toggled back on becomes a read-only announcements page — owner posts only
- Friends page if manually toggled back on becomes a read-only partners/team showcase — owner curated only
- Pure showcase mode: visitors can browse, download, and watch — nothing else
- Individual page toggles still fully functional on top of business mode defaults

### Mode Switch Flow (Personal → Business)
1. Owner clicks "Switch to Business Mode" in customization panel
2. Confirm modal: "This will hide interactive features from visitors. You can switch back anytime."
3. On confirm, single GitHub API commit writes three changes at once:
   - Current `pages` object snapshot saved to `personalModeSnapshot`
   - `pages` object overwritten with business mode defaults
   - `mode` set to `"business"`
4. Site immediately reflects business mode on next page load

### Mode Switch Flow (Business → Personal)
1. Owner clicks "Switch to Personal Mode" in customization panel
2. No confirm needed — switching back is always safe
3. Single GitHub API commit writes three changes at once:
   - `personalModeSnapshot` restored to `pages` object exactly as it was
   - `personalModeSnapshot` cleared to `null`
   - `mode` set to `"personal"`
4. Site immediately reflects previous personal state — no customizations lost

### `auth.js` Behavior
- Reads `mode` from `site-config.json` on every page load
- If `"business"`: strips all visitor input UI from DOM before render, applies business layout adjustments
- If `"personal"`: normal interactive behavior
- Mode flag is read-only for non-owners — visitors cannot influence it

### Business Profile Form (Edit Mode — Business Mode Only)
When Business Mode is active, a configuration form unrolls in the customization panel:

**Form Fields:**
- Business Type (dropdown): Local Business, Freelancer/Professional, Restaurant, Store, Event Venue
- Business Name
- Category (text input, e.g. "Graphic Design", "Italian Cuisine")
- Address / Service Area: City, State/Region, Country
- Contact Phone
- Contact Email
- Price Range (dropdown): $, $$, $$$, $$$$
- Services Offered (tag input — add/remove individual service tags)
- Operating Hours (day-by-day selectors): each day has open/close time pickers, supports different weekend hours, supports "Closed" toggle per day

**PII Notice (displayed above form):**
> "This information will be publicly visible on your site and in your GitHub repository. Only enter details you are comfortable sharing publicly."

**On Save:**
1. Form values written to `businessProfile` object in `site-config.json`
2. JSON-LD structured data block generated from form values
3. Single GitHub API commit writes both `site-config.json` and rewrites `index.html` with updated JSON-LD block in `<head>` and updated OG tags

### JSON-LD Structured Data (Auto-Generated)
Business Type dropdown maps to Schema.org `@type`:
| Business Type | Schema.org @type |
|---|---|
| Local Business | `LocalBusiness` |
| Freelancer/Professional | `ProfessionalService` |
| Restaurant | `Restaurant` |
| Store | `Store` |
| Event Venue | `EventVenue` |

Generated block injected into `<head>` of `index.html`:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "[mapped type]",
  "name": "[businessName]",
  "image": "https://[username].github.io/assets/profile.webp",
  "url": "https://[username].github.io",
  "telephone": "[phone]",
  "email": "[email]",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "[city]",
    "addressRegion": "[state]",
    "addressCountry": "[country]"
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "09:00",
      "closes": "17:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Saturday"],
      "opens": "10:00",
      "closes": "14:00"
    }
  ],
  "priceRange": "[priceRange]"
}
</script>
```
- Block is fully regenerated and recommitted on every business profile save
- If Business Mode is toggled OFF, JSON-LD block is removed from `index.html` in the same commit
- Enables Google rich results, local business search cards, and knowledge panel eligibility
- No server-side rendering needed — static string committed directly to file via GitHub API

---

## Phase 2K: Gallery Page (`gallery.html`)

### Public View
- Responsive photo grid
- Click or tap-and-hold to save image to device (native browser behavior — raw GitHub URLs serve files directly)
- Right-click save on desktop
- No download button needed — native behavior handles it

### Edit Mode
- Upload photos — client-side compressed to WebP, hard cap 200kb per image
- Delete individual photos (removes file from repo via GitHub API)
- No hard photo count cap — compression math keeps it manageable
- Storage meter visible (shared with admin utilities panel)

---

## Phase 2L: Music Page (`music.html`)

### Public View
- Retro cassette/deck styled MP3 player
- Play, pause, seek, volume controls
- Download button — direct download of raw MP3 from repo to user's device
- Track title and artist displayed

### Edit Mode
- Upload one MP3 at a time — replaces previous track in `/assets/music/`
- Client-side file size warning on upload (recommend under 10MB)
- Track metadata fields (title, artist) — writes to `site-config.json`
- "Current Track" framing — intentional, curated, feels like a MySpace profile song status

---

## Phase 2M: Videos Page (`videos.html`)

### Public View
- Grid of YouTube embed viewports
- "Watch on YouTube" external link per video
- Clean, responsive layout

### Edit Mode
- Add YouTube URL → generates embed, stores URL in `site-config.json`
- Remove video links
- No file storage — URLs only, zero repo size impact
- Unlimited video links

---

## Phase 2N: Friends Page (`friends.html`)

### Public View
- Toggleable — owner can hide entirely from public via `site-config.json`
- Grid of friend cards: their profile photo + display name + link to their `username.github.io`
- Clicking a friend card navigates to their site

### Edit Mode
- Add friend by entering their `username.github.io` URL
- Platform fetches their `site-config.json` to pull display name + profile photo automatically
- Remove friend card
- Toggle entire friends page public/private
- Friend data stored in `friends.json` in repo — no localStorage dependency

---

## Phase 2O: Guestbook / Friend Posts (`guestbook.html`)

### Architecture Decision
Cross-account Pull Requests require the poster to fork the owner's repo first, which is slow and complex via REST API. Instead, the platform uses the **GitHub Issues API** as the post submission and moderation queue. Issues are native to every repo, support CORS, require no fork, and map perfectly to an approve/reject workflow.

### Public View
- Approved posts displayed chronologically (rendered from `guestbook.json`)
- Each post shows: friend's profile photo, display name, link to their site, post text, optional image, optional video link
- No unapproved content ever visible to public

### Posting Flow (Platform Users Only)
- "Post to [username]'s page" button visible to all visitors
- Clicking prompts GitHub OAuth login if not authenticated (via proxy Lambda)
- After auth, platform verifies poster has their own `username.github.io` repo — confirms real platform user, not a bot or random GitHub account
- Post form unlocks: text (required), one image (optional, client-side compressed to WebP under 200kb), one video link (optional)
- On submit:
  - If image included: image committed to a `/assets/posts/pending/` path in owner's repo via GitHub API using poster's token
  - A GitHub Issue is opened on owner's repo containing structured JSON payload: poster identity, text, image path (if any), video link (if any)
  - Issue is labeled `pending-post` automatically
- Owner sees poster's GitHub username, profile photo, and link to their site on every issue

### Owner Moderation (Edit Mode)
- Pending posts inbox reads all open issues labeled `pending-post` via GitHub API
- Each pending post renders as a full preview before any action
- Approve:
  - Post JSON appended to `guestbook.json` and committed to repo
  - Issue closed via GitHub API
  - Post appears live on guestbook page
- Reject:
  - Issue closed and labeled `rejected` via GitHub API
  - Pending image asset deleted from repo if one was included
  - Nothing appears on public page

### Visitor Post CTA (Organic Growth Mechanic)
- "Post to [DisplayName]'s page" button visible to all visitors
- If visitor is not authenticated, clicking opens a welcoming modal — not a cold OAuth prompt:
  - Headline: "Want to post on [DisplayName]'s page?"
  - Subtext: "You'll need your own free page to do it."
  - **"Log In"** button — already have an account, GitHub OAuth via proxy Lambda
  - **"Create My Page"** button — redirects to platform onboarding `index.html`
  - Small line: "It's free. You get your own page too."
- If visitor is an authenticated platform user: post form opens directly, no modal
- This is the primary organic acquisition funnel — every page visit is a potential new user

### Returning Platform User Experience
- When a logged-in platform user visits someone else's page, a subtle "You're on the network" indicator is shown
- "Post to this page" button is surfaced more prominently for authenticated platform members
- Rewards being a member, reinforces the network feel

### Spam / Abuse Protection
- GitHub OAuth required — no anonymous submissions
- Platform membership check (must have own `username.github.io` repo) — additional filter
- GitHub account creation requires email verification — natural bot deterrent
- Every issue is traceable to a verified GitHub identity
- GitHub's native abuse reporting tools apply to all bad actors

---

## Phase 2P: Games Page (`games.html`)

### Public View
- Game picker UI — grid of game tiles
- Click a game → loads in a canvas viewport on the same page
- Toggleable page (owner can hide from nav)

### Games (All Vanilla JS + Canvas API — No External Libraries)
- Tetris
- Pac-Man
- Snake
- Breakout
- Space Invaders

### Data
- High scores saved to localStorage — device only, zero repo impact
- No external dependencies, no iframes, fully owned code

---

## Phase 2Q: Navigation & Shared Systems

### `nav.js`
- Reads `site-config.json` on every page load
- Auto-populates hamburger/drawer menu with only toggled-ON pages
- Toggled-OFF pages invisible in nav and inaccessible to public (files exist in repo but not linked)
- Smooth off-canvas slide animation

### `auth.js`
- GitHub OAuth state management via proxy Lambda
- Checks if authenticated user matches repo owner
- If match: unlocks edit mode across all pages
- If no match or not logged in: pure read-only, zero edit UI rendered in DOM
- Token stored in sessionStorage only — never written to any file or repo
- Token cleared on logout or session end
- Edit mode re-prompts OAuth with narrow scope if session has expired

### `theme.js`
- Reads theme settings from `site-config.json`
- Applies light/dark mode, background type/value, custom CSS
- Executes before page render to prevent flash of unstyled content

### `rss.xml` (Auto-Generated)
- Updated automatically whenever owner publishes a status update or new post
- Standard RSS/Atom format — compatible with all RSS readers and feed aggregators
- Allows external subscribers to follow a user's site without visiting it
- Generated client-side and committed to repo via GitHub API on each update

### GitHub API Rate Limit Strategy
- All read operations (fetching friend profiles, guestbook posts, site config) use raw static URLs: `https://username.github.io/file.json`
- Raw static file fetches hit GitHub's CDN — unlimited, fast, no rate limit
- `api.github.com` REST calls reserved exclusively for authenticated write operations in edit mode (5,000 requests/hour with token)
- The only unauthenticated API call allowed: notifications badge Issues count in edit mode — acceptable since edit mode requires login
- `friends.html` fetches each friend's `site-config.json` directly from their GitHub Pages URL, never from the API

### `robots.txt` (Auto-Generated)
- Ships in every deployed template
- Personal mode: `Allow: /` — fully crawlable by search engines
- Business mode: `Allow: /` — fully crawlable, maximizes JSON-LD SEO benefit
- Off-grid mode (directory toggle OFF): `Disallow: /` — true off-grid, search engines cannot index the site
- Regenerated and committed via GitHub API whenever directory toggle or mode changes

### `sitemap.xml` (Auto-Generated)
- Lists all currently toggled-ON public pages with their full URLs
- Regenerated alongside `rss.xml` whenever page toggles change
- Committed to repo via GitHub API
- Not generated if off-grid mode is active

### `404.html`
- Custom styled to match user's current theme
- Friendly message + link back to their index

---

## Phase 3: AWS Infrastructure (OAuth Proxy + Directory)

### Lambda Functions
| Function | Purpose |
|---|---|
| `oauth-proxy` | Exchanges GitHub OAuth code for access token using hidden client secret |
| `directory-api` | Handles DynamoDB read/write/delete for opt-in user directory |

### API Gateway Throttling (Both Lambdas)
- Requests per second limit: 10 RPS per endpoint — prevents hammering
- Daily quota: 10,000 requests/day per endpoint — prevents runaway AWS bill
- Burst limit: 50 requests — handles legitimate traffic spikes
- 429 Too Many Requests response returned when limits exceeded
- Configured directly in API Gateway — zero code changes, zero cost to set up
- Protects the $0 platform cost model from abuse or accidental loops

### DynamoDB Directory Table
- Partition key: `github_username`
- Attributes: `display_name`, `site_url`, `listed` (boolean)
- Stores nothing else — no email, no content, no tracking

### Privacy Toggle (Edit Mode)
- ON → writes/updates record in DynamoDB via `directory-api` Lambda
- OFF → deletes record from DynamoDB
- Default on deploy: ON (changeable immediately in edit mode)

### Search Widget
- Available on platform marketing page
- Search by display name → returns matching `username.github.io` URLs
- Optionally embeddable on user sites

---

## Phase 4: Custom Domain Support

### How It Works
- Owner enters custom domain in edit mode (e.g. `www.myname.com`)
- Platform commits a `CNAME` file to repo root via GitHub API
- GitHub Pages picks it up automatically on next build
- `site-config.json` updated with `customDomain` value

### DNS Helper UI (Edit Mode)
- Copy-paste DNS configuration shown immediately after domain is entered:
  - For apex domains: GitHub's A records (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`)
  - For `www` subdomains: CNAME record pointing to `username.github.io`
- Plain English instructions for common registrars (Namecheap, GoDaddy, Cloudflare)
- "Verify DNS" button that checks if records have propagated

---

## Phase 5: WebRTC P2P Music Vault (Future)

### Goal
Browser-to-browser direct audio streaming between connected friends when both are online — nothing stored on any server.

### How It Works
- Uses PeerJS (WebRTC wrapper)
- Friend visits music page while owner is online → P2P connection established
- Stream or download directly browser-to-browser
- Nothing uploaded to any server or repo
- Falls back to static hosted MP3 if owner is offline

---

## Storage Budget Reference

| Asset | Size Cap | Notes |
|---|---|---|
| Profile photo | 200kb WebP | Replaces on update |
| Cover photo | 200kb WebP | Replaces on update |
| Gallery photos | 200kb WebP each | No hard count cap, storage meter warns at 500MB |
| Active MP3 | ~10MB recommended | One at a time, replaces on update |
| Friend post image | 200kb WebP | Per post, client-side compressed before Issue submission |
| Video links | 0kb | URLs only in site-config.json |
| Friends list | Negligible | JSON URLs only |
| Games | ~50kb total | Vanilla JS, no binary assets |
| RSS feed | Negligible | Plain XML, auto-generated |
| GitHub repo soft limit | 1GB | Storage meter warns at 500MB, cleanup prompt at 800MB |

---

## Security Reference

| Risk | Mitigation |
|---|---|
| OAuth client secret exposure | Lambda proxy — GitHub App private key in Lambda env var only, never in code |
| CORS wildcard on Lambda | `Access-Control-Allow-Origin` locked to onboarding domain only — never `*` |
| Malicious site stealing auth codes via proxy | CORS domain lock + `POST` only on Lambda endpoint prevents cross-origin code theft |
| GitHub App installation flow misimplemented | Onboarding link points to `/installations/new` — returns `installation_id`, not OAuth `code` |
| Overly broad token scope | GitHub App fine-grained tokens, scope dropped after onboarding |
| Token persistence | sessionStorage only, cleared on logout/tab close |
| XSS via custom CSS injection | CSP meta tag blocks script execution in all skeleton files |
| Anonymous spam posts | GitHub OAuth required + platform membership check |
| Bot submissions | GitHub account email verification + identity traceability via Issues API |
| Unauthorized repo modification | Edit mode re-prompts OAuth, tokens scoped to owner's repo only |
| Cold barrier to new visitors | "Log In / Create My Page" modal replaces raw OAuth prompt — welcoming not blocking |
| Stale cached content after edits | `configVersion` increment + network-first fetch strategy for all dynamic JSON files |
| API rate limit exhaustion | All reads use raw static CDN URLs — API calls reserved for authenticated writes only |
| AWS Lambda abuse / bill shock | API Gateway throttling — 10 RPS limit + 10k daily quota on all Lambda endpoints |
| Search engine indexing of off-grid users | `robots.txt` set to `Disallow: /` when directory toggle is OFF |
| Silent edit mode failures | Toast notification system on every API call — success, error, and retry feedback |

---

## Deployed Infrastructure (Live)

### GitHub App
- App name: `autonom-page`
- App ID: `5417193`
- Permissions: Contents (R/W), Issues (R/W), Pages (R/W), Metadata (read-only)
- Callback URL: `https://autonom.page/callback`
- Installation URL: `https://github.com/apps/autonom-page/installations/new`

### AWS Lambda — `autonom-oauth-proxy`
- Runtime: Node.js 22.x
- Region: `us-east-1`
- Account: `170377509849`
- Handler: `index.handler`
- Timeout: 10s, Memory: 128MB
- IAM Role: `autonom-lambda-role` (AWSLambdaBasicExecutionRole)
- Env vars: `ALLOWED_ORIGIN`, `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`

### API Gateway
- API ID: `f8rcwlcsz8`
- Endpoint: `https://f8rcwlcsz8.execute-api.us-east-1.amazonaws.com/prod/token`
- Route: `POST /token`
- Throttling: 10 RPS, burst 50

### Domain
- `autonom.page` — registered on Squarespace, $20/yr flat
- Point to GitHub Pages via CNAME once onboarding page is built

### Repository
- `https://github.com/Shannon-Goddard/autonom-page`
- Personal account, public repo
- Branch: `main`

---

## Implementation Notes (For Context Recovery)

### `lambda/oauth-proxy/index.js`
- `GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n')` — Lambda env vars store newlines as literal `\n`, this restores real PEM format
- JWT `iat` set 60 seconds in the past — GitHub recommendation to account for clock skew
- Origin validated server-side before processing — CORS headers alone are not sufficient
- Returns only `token` and `expires_at` — never echoes request body back
- Single dependency: `jsonwebtoken` — `https` is Node built-in

### `template/auth.js`
- Exposes `window.Autonom` as public API — all other JS files call `Autonom.toast()`, `Autonom.getToken()`, `Autonom.isOwner()` etc.
- `applyBusinessMode()` runs synchronously before render — visitor input removed from DOM, not just hidden with CSS
- `REPO_OWNER` derived from `location.hostname.split('.')[0]` — works for any `username.github.io` deployment
- `callback.html` handles the post-install redirect — grabs `installation_id` from URL params, calls Lambda, stores token, redirects to `index.html`
- Toast system: 4 second auto-dismiss, optional retry button, uses `aria-live` region for screen readers

### `template/nav.js`
- `MutationObserver` on `document.body` watches for `edit-mode` class added by `auth.js` — logout button appears without nav.js needing to know auth timing
- `cache: 'no-store'` on `site-config.json` fetch is belt — `sw.js` network-first bypass is suspenders
- Focus trap: Tab/Shift+Tab cycle only within open drawer, Escape closes and returns focus to hamburger button
- Logout button hidden by default, revealed only when `edit-mode` class is present on body

### `template/theme.js`
- Reads `localStorage` cache first and applies instantly — then fetches fresh config in background — prevents flash of unstyled content on repeat visits
- `AutonomTheme.applyTheme()` exposed on `window` — `index.js` calls it live when owner saves theme changes without a page reload
- Sets `data-theme` attribute on `<html>` — `styles.css` CSS variables cascade automatically from there
- Caches only theme-relevant fields to localStorage — not the full config

### `template/styles.css`
- CSS custom properties on `:root` (dark) and `[data-theme="light"]` — single attribute flip switches entire theme
- `.glass` utility class for glassmorphism surfaces — used on customization panel and modals
- `.hidden` utility maps to `display: none !important` — used by auth.js and nav.js to show/hide elements
- Toast slide-in animation via `@keyframes slideIn` — matches bottom-right fixed position container

### `template/sw.js`
- `.json` and `.xml` bypass uses `url.endsWith()` checks — no query param tricks, enforced at fetch event level
- `X-Autonom-Stale: true` response header set on cached fallback — page JS reads this to show "viewing cached version" indicator
- `configVersion` invalidation: `auth.js` compares stored version in `localStorage` to fetched config on every load — posts `INVALIDATE_SHELL` message to SW if changed
- `self.skipWaiting()` + `self.clients.claim()` — new SW takes over immediately without waiting for tab close
- Shell cache keyed as `shell-v1` — bump version string to force full shell refresh on major deploys

### `template/github-api.js`
- Foundation module — all other modules call `Autonom.commitFile()`, `Autonom.saveConfig()`, etc.
- `ghGet` / `ghPut` / `ghDelete` are thin wrappers around `fetch` with auth header — single place to update if GitHub API changes
- `getFileSHA` fetches current SHA before every write — required by GitHub API to avoid 409 conflicts
- `saveConfig` takes `(configRef, updates, commitMsg)` — mutates config in place, increments `configVersion`, commits `site-config.json` in one call
- Extends `window.Autonom` via `Object.assign` — load order: must come after `auth.js`

### `template/media.js`
- `compressToWebP` uses Canvas API — draws image at scaled dimensions to hit `maxKb` target, no external library
- `generateFavicon` draws 32x32 Canvas from profile photo, exports as data URL, commits as `favicon.ico`
- `handleProfilePhotoUpload`: compress → commit `profile.webp` → generate favicon → commit `favicon.ico` — two commits, one user action
- `handleCoverPhotoUpload`: compress → commit `cover.webp` — single commit
- Extends `window.Autonom` — depends on `github-api.js` being loaded first

### `template/feeds.js`
- `regenerateRSS`, `regenerateSitemap`, `regenerateRobots` all take `config` as param — no internal state
- All three called together whenever page toggles or mode changes — keeps all three in sync in one edit session
- `regenerateSitemap` pings Google after commit: `https://www.google.com/ping?sitemap=...` — fire and forget
- `regenerateRobots` sets `Disallow: /` when directory toggle is OFF — true off-grid behavior
- Google sitemap ping removed — blocked by CSP and CORS regardless of intent

### `template/business.js`
- `populateBusinessForm` reads `config.businessProfile` and fills form fields — called on edit mode unlock
- `saveBusinessProfile` writes form values to `config.businessProfile`, calls `generateJSONLD`, then `rewriteIndexHead`
- `generateJSONLD` maps Business Type dropdown to Schema.org `@type` — returns full JSON-LD string
- `rewriteIndexHead` fetches current `index.html`, removes old JSON-LD block, injects new block before `</head>`, rewrites OG/Twitter tags — single GitHub API commit for both changes
- Extends `window.Autonom` — depends on `github-api.js`

### `template/admin.js`
- `loadStorageMeter` calls GitHub repo size API — warns at 500MB, prompts cleanup at 800MB
- `renderQRCode` sets `<img src>` to `api.qrserver.com` URL — no JS library, no Canvas, just an image tag
- `handleShare` writes `location.href` to clipboard — single line, no library
- `loadNotificationsBadge` fetches open Issues labeled `pending-post` — count shown as badge in edit mode
- `handleExport` opens GitHub's native zip download URL directly — no JSZip needed, GitHub generates the archive
- Extends `window.Autonom` — depends on `github-api.js`

### `template/index.js` (refactored orchestrator)
- Lean ~200 lines — loads config, renders DOM, wires all event listeners, calls module functions
- No business logic — delegates everything to the appropriate module
- Script load order in `index.html`: `theme.js` → `auth.js` → `github-api.js` → `media.js` → `feeds.js` → `business.js` → `admin.js` → `nav.js` → `index.js`
- `window.Autonom` pattern: `auth.js` creates the object, every subsequent module extends it via `Object.assign` — no globals, no tight coupling

### `template/index.html` first-time wizard (step 9)
- Three steps in one overlay: set status, upload cover photo, toggle pages on/off
- Full-screen backdrop with `fadeIn` animation, `.glass` box centered max 480px
- Shown only when `config.firstTimeSetup === true` and `Autonom.isOwner()` — never visible to public
- Save: writes status + page toggles to `site-config.json`, triggers `regenerateRSS` + `regenerateSitemap`, hides overlay
- Dismiss (skip): writes `firstTimeSetup: false` only, no other changes
- `.btn-ghost` class for skip button — visually distinct from primary save

### `template/gallery.js`
- `loadPhotos()` reads `assets/gallery/` via GitHub contents API — no hardcoded list, picks up any `.webp` file
- `uploadPhotos()` loops files, runs each through `Autonom.compressToWebP(file, 200)`, commits with timestamp-prefixed filename
- `deletePhoto()` fetches SHA first via `getFileSHA`, then calls `ghDelete` — correct GitHub API flow, avoids 409
- Delete button rendered only for owner, fades in on hover via CSS — clean public view
- `gallery.html` script order: `auth.js` → `github-api.js` → `media.js` → `nav.js` → `gallery.js`

### `template/music.js`
- Reads `currentTrack` from `site-config.json` on load — player hidden entirely if no track uploaded
- Native `<audio>` element kept `display:none` — driven entirely via JS controls
- Upload: 20MB cap with toast warning, filename sanitized (`/[^a-z0-9._-]/gi`), raw `arrayBuffer()` passed to `commitFile`
- Saves `currentTrack` to `site-config.json` and calls `regenerateRSS` on upload — track change = feed update
- Player updates live after upload — no page reload needed
- `music.html` script order: `auth.js` → `github-api.js` → `nav.js` → `music.js`

### `template/videos.js`
- Reads `config.videos` array from `site-config.json` — same `youtubeId()` regex as `index.js`
- Add/remove both call `saveConfig` and re-render in place — no reload
- Enter key on URL input triggers add — keyboard UX
- 16:9 iframe wrapper via `padding-bottom: 56.25%` CSS trick — no JS sizing needed
- `videos.html` script order: `auth.js` → `github-api.js` → `nav.js` → `videos.js`

### `template/friends.js`
- `normalisedUrl()` accepts bare `username`, `username.github.io`, or full URL — owner doesn't need exact format
- `fetchFriendProfile()` hits `username.github.io/site-config.json` via raw static CDN — zero API calls, no rate limit impact
- `onerror` on avatar img falls back to local `assets/profile.webp` silently — broken image never shown
- `saveFriends()` commits `friends.json` directly via `commitFile` — separate file from `site-config.json`, not routed through `saveConfig`
- Duplicate check before add — `friends.some(f => f.url === url)`
- `friends.html` script order: `auth.js` → `github-api.js` → `nav.js` → `friends.js`

### `template/guestbook.js`
- Approved posts rendered from `guestbook.json` via raw static fetch — no API
- `escHtml()` applied to all post text before innerHTML — XSS protection
- Visitor flow: unauthenticated → welcoming modal with owner's display name in headline. Authenticated non-member → same modal (platform membership check via `username.github.io/site-config.json`). Authenticated member → post form directly
- Post submission: image compressed to WebP, committed to `assets/posts/pending/`, Issue opened with JSON payload in fenced code block — parseable on moderation side
- `parseIssuePayload()` extracts JSON from fenced code block in issue body — structured, not free-text
- Approve: moves image `pending/` → `posts/`, appends entry to `guestbook.json`, closes Issue
- Reject: deletes pending image, closes Issue with `rejected` label — nothing touches public page
- `ghPost` and `ghPatch` added to `github-api.js` in this step; `ghDelete` signature fixed to accept body object instead of bare sha string
- `guestbook.html` script order: `auth.js` → `github-api.js` → `nav.js` → `guestbook.js`

### `template/games.js` + `games/`
- `window.Games` registry pattern — each game file registers `{ start(canvas), stop() }`, orchestrator handles all picker/viewport/back logic
- Adding a new game = one new file + one tile button, zero changes to orchestrator
- All 5 games: Snake (120ms tick, WASD + arrows), Tetris (7 tetrominoes, level speed, hard drop), Breakout (mouse + keyboard, angle deflection, lives), Space Invaders (chase AI, shields with 3 HP states, wave speed increase), Pac-Man (tile map, 4 ghosts, power pellets, tunnel wrap)
- High scores in `localStorage` — device only, zero repo impact
- `image-rendering: pixelated` on canvas — crisp pixel art scaling
- `games.html` script order: `auth.js` → `nav.js` → all 5 game files → `games.js`

---

## Build Order

1. AWS Lambda OAuth proxy (`oauth-proxy`) + API Gateway throttling — prerequisite for everything
2. Template file structure + `site-config.json` schema + CSP meta tags + OG/Twitter card meta tags + accessibility attributes in all HTML skeletons
3. `auth.js` — OAuth state, edit mode unlock, sessionStorage management, mode reading + DOM stripping, toast notification system
4. `nav.js` — navigation drawer, reads site-config.json with cache-busting, keyboard navigation support
5. `theme.js` — theme engine, runs before render
6. `manifest.json` + PWA icons + default `favicon.ico` — app name, theme color, icons
7. `sw.js` — Service Worker, shell cache, network-first strategy, offline fallback, configVersion cache invalidation
8. `index.html` profile page — layout, edit mode, customization panel, admin utilities, share/QR, last updated timestamp, favicon auto-generation on photo upload, Personal/Business mode toggle, OG tag auto-rewrite on bio/name edit, business profile form + JSON-LD generation. **Refactored into 6 modules:** `github-api.js`, `media.js`, `feeds.js`, `business.js`, `admin.js`, `index.js` (orchestrator). Committed as `9d2cf19`.
9. First-time setup wizard overlay — CSS + full 3-step wizard HTML (status, cover photo, page toggles). `dismissWizard()` and `saveWizard()` wired in `index.js`. Shown only to owner when `firstTimeSetup: true`. Committed as `3061e98`.
10. `gallery.html` + `gallery.js` — photo grid, WebP upload (200kb cap), delete with SHA fetch, owner-only controls. Gallery CSS in `styles.css`. Committed as `3061e98`.
11. `music.html` + `music.js` — player (play/pause/seek/volume), MP3 upload (20MB cap), track metadata saved to `site-config.json`, `regenerateRSS` on upload, live player update without reload. Music CSS in `styles.css`. Committed as `664cfde`.
12. `videos.html` + `videos.js` — YouTube embed grid, add/remove URLs saved to `site-config.json`, Enter key support, 16:9 iframe wrapper CSS. Committed as `f23eb63`.
13. `friends.html` + `friends.js` + `friends.json` — `normalisedUrl()` accepts bare username/partial/full URL, fetches friend profile via raw static `username.github.io/site-config.json` (no API calls), `onerror` fallback on avatar, saves to `friends.json` via `commitFile`. Friends card CSS in `styles.css`. Committed as `e7e85e8`.
14. `guestbook.html` + `guestbook.js` — Issues API moderation + visitor modal + platform membership check + approve/reject flow + `ghPost`/`ghPatch` added to `github-api.js`. Committed as `f6dcd87`.
15. `games.html` + all 5 games — `window.Games` registry, `games.js` orchestrator. Snake, Tetris, Breakout, Space Invaders, Pac-Man — all Canvas API, no libraries, high scores in localStorage. Committed as `8171e81`.
16. `404.html`
17. `robots.txt` + `sitemap.xml` + `rss.xml` auto-generation logic — all three regenerated together on page toggle or mode change
18. Marketing/onboarding `index.html` + `onboard.js` — OAuth flow, deploy, animated poller
19. AWS Lambda `directory-api` + API Gateway throttling + DynamoDB table
20. Phase 4: Custom domain support + DNS helper UI — `#dns-helper` panel, `showDNSHelper()` (apex A records / www CNAME), verify button (`no-cors HEAD`), auto-shows if domain already set. Committed as `ee1efcd`. ✅
21. Phase 5: WebRTC P2P music vault — future, not yet built

## Bug Fixes (Post-Launch Testing)

- **SVG icons** — replaced emoji feature icons with white SVG files in `assets/`. Fixed `.feature-icon` CSS from `font-size` to `width`/`height`. Added `align-items: center` + `text-align: center` to `.feature-card`. Committed as `93d8ac6`, `43d7f23`.
- **GitHub App visibility** — App was private, blocking all installs. Made public via `github.com/settings/apps/autonom-page`. No code change.
- **Existing repo guard** — `onboard.js` `createRepo()` now checks if `username.github.io` already exists and bails with a clear message instead of failing silently. Committed as `fa3970d`.
- **GitHub install hint** — Added note below Connect button explaining to choose "All repositories" for new accounts. Committed as `fa3970d`.
- **CSP blocking callback** — `callback.html` had `script-src 'self'` which blocked its own inline `<script>`. Extracted to `callback.js`. This was the root cause of "Connecting your account..." hanging forever. Committed as `4ac9fd5`.
- **API Gateway CORS missing** — `CorsConfiguration` was null on the API Gateway. Browser preflight OPTIONS requests were blocked before reaching Lambda. Fixed via `aws apigatewayv2 update-api --cors-configuration`. Committed as `d3acd40`.
- **Installation token cannot call `/user`** — GitHub installation tokens are repo-scoped, not user-scoped. `/user` always returns 403. Fixed by fetching login from `GET /app/installations/{id}` in Lambda using the App JWT, returning `login` alongside the token. Committed as `d026a2f`.
- **GitHub App was private** — blocked all installs from non-owners. Made public via `github.com/settings/apps/autonom-page`. No code change.
- **Installation token cannot create repos** — `POST /user/repos` requires a user OAuth token, not an installation token. Redesigned auth as a two-step flow: (1) OAuth authorize → user token for repo creation, (2) App installation → installation token for content writes. Added `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` to Lambda. Rewrote Lambda, `onboard.js`, `callback.js`. Added `step-install` card to `index.html`. Committed as `e52d23f`.
- **CSP blocking photo preview** — `img-src` didn't allow `blob:` URLs. Added `blob:` to `img-src` in `index.html`. Committed as `a385749`.
- **Installation token cannot write to new repo** — App installation predates repo creation so the new repo is out of scope for the installation token. Fixed by using `userToken` for all onboarding writes (repo creation, file commits, Pages enable). Installation token retained in sessionStorage for future edit mode use on the user's own site. Committed as `20284ce`.
- **Wizard not firing — sessionStorage doesn't cross domains** — Token stored on `autonom.page` is invisible to `username.github.io`. Fixed by passing token and owner in URL hash on deploy redirect (`#autonom_token=TOKEN|owner`). `auth.js` reads hash on init, stores to sessionStorage, strips hash via `history.replaceState`. Committed as `605a15f`.
- **Hash parsing broken by `&amp;` encoding** — Using `&` as separator in the hash caused HTML encoding to mangle the URL, splitting into one long unparseable token. Fixed by using `|` as separator instead of `&autonom_owner=`. Committed as `2dcd461`.
- **Hash parsing confirmed working in console but sessionStorage still null** — Hash arrives correctly, pipe parsing splits token and owner correctly when run manually. Moved hash-reading to top of IIFE before `init()` to ensure synchronous execution before any async calls. Committed as `1d621e3`. Still not resolving — under investigation.
- **Session handoff root cause: GitHub Pages redirect strips hash** — Confirmed hash arrives at user site but `auth.js` reads null from sessionStorage. Root cause: script runs before hash is processed. Fixed by reading hash synchronously at very top of IIFE before any function definitions. Committed as `1d621e3`. Resolved by single-commit deploy fix below.
- **44 commits on deploy → single commit via Git tree API** — Replaced file-by-file `commitFile` loop with Git tree API: fetch all files in parallel, build full tree in memory, create one commit "Initial Autonom deploy". Binary files get blob SHAs first. `auto_init: true` on repo creation ensures `main` branch exists. Deploy is now ~10x faster. Committed as `2d775b4`.
- **Wizard firing confirmed** — Session handoff via URL hash working after single-commit deploy. Wizard shows on first land at user site. Committed as `2d775b4`.
- **Videos missing from wizard page toggles** — `wiz-videos` checkbox absent from `template/index.html` wizard. Added. Reads dynamically so no `index.js` change needed. Committed as `32ae95b`.
- **Progress step timing notes** — Removed timing note from deploy step (now fast). Updated build wait note to "this takes about a minute". Committed as `2be55bb`.
- **UX: template deploy timing note** — Added "(this takes about a minute)" hint to the Deploying template files progress step. Committed as `ec7ed69`.

- **CSP missing connect-src on user site** — `template/index.html` had no `connect-src` directive, blocking all `fetch()` calls to GitHub API and Lambda. Added `connect-src 'self' https://api.github.com https://f8rcwlcsz8.execute-api.us-east-1.amazonaws.com`. Committed as `265755c`. Then `'self'` was missing causing same-origin fetches like `site-config.json` to fail. Fixed as `60e0da0`.
- **Wizard videos loop missing videos key** — `index.js` wizard save loop didn't include `videos`. Fixed as `265755c`.

---

- **SW cache serving stale index.html** — Service Worker cached `index.html` under `shell-v1`. New deploy pushed same version string, so SW never evicted old cache. Users saw old CSP (no `connect-src`) even after GitHub Pages had the correct file. Fixed by bumping to `shell-v2` and patching `sw.js` at deploy time in `onboard.js` to inject a unique `shell-v{timestamp}` per deploy — guarantees every fresh install gets a unique cache key and future deploys always bust the old shell. Committed as `2ae39a8`.
- **UX: page lands at top after callback redirect** — After OAuth and app install redirects back to `autonom.page`, page loaded at the top. Added `scrollIntoView({ behavior: 'smooth', block: 'center' })` after `show('step-install')` and `show('step-form')` in `resumeFromCallback()`. Committed as `9020cda`.
- **blob: URLs blocked in img-src** — Cover photo preview in wizard failed with CSP violation. `img-src` in `template/index.html` was missing `blob:`. Added. Committed as `199b605`.
- **SW throwing on PUT requests** — `networkFirstWithIndicator` in `sw.js` called `cache.put()` on all responses including GitHub API `PUT` writes. Cache API doesn't support non-GET requests. Added `request.method === 'GET'` guard before `cache.put`. Committed as `199b605`.
- **Google sitemap ping blocked by CSP** — `feeds.js` fired `fetch('https://www.google.com/ping?...')` after every sitemap regeneration. Blocked by `connect-src` and would fail CORS regardless. Removed entirely — no value from a browser-side ping. Committed as `199b605`.
- **Cover/profile photo layout broken** — No CSS for `#cover-section`, `#cover-photo`, `#profile-section`, or `#profile-photo`. Cover rendered at natural image size with no containment. Profile photo appeared full-width instead of circular. Edit Cover button fell out of flow (no `position: relative` on parent). Added cover section (220px fixed height, `object-fit: cover`), profile section (centered column, 100px circle avatar, border), and Edit Cover positioned bottom-right. Committed as `a35a2e4`.
- **Background color input full-width** — `input { width: 100% }` global rule made the color picker a giant swatch. Scoped `#bg-color` to `width: 3rem; height: 2rem`. Committed as `a35a2e4`.
- **Background type select didn't show/hide inputs** — Selecting "Image" still showed the color picker; selecting "Solid Color" still showed the file input. Added `syncBgInputs()` wired to `bg-type` change event in `index.js`, called once on load. Committed as `a35a2e4`.

- **SW caching HTML/JS/CSS blocking template updates** — SW used cache-first for all shell assets including `index.html`, `styles.css`, `nav.js` etc. Template updates pushed to the autonom-page repo never reached already-deployed user sites because `configVersion` only increments on owner saves, not on template pushes. Fixed by splitting shell assets into two lists: icons and game files stay cache-first (truly static), all HTML/JS/CSS moved to network-first with cache fallback for offline. Committed as `c75bb8a`.
- **Admin panel button spacing** — Export/Backup and Share My Page buttons had no breathing room before the QR code. Added `margin-bottom` and `flex-direction: column` with `gap` to `#admin-utilities`. Save Domain and Save Changes got more vertical padding and `margin-top`. Committed as `46de675`.
- **Directory label shows actual URL** — "List me in the directory" was generic placeholder text. Added `#directory-label` span, populated at runtime in `populateCustomizationPanel()` as `List https://username.github.io in the directory`. Committed as `46de675`.
- **Onboarding photo used as cover** — Deploy set both `assets/profile.webp` and `assets/cover.webp` to the same onboarding photo buffer, making cover and profile identical on first load. Fixed by only writing to `profile.webp` during deploy. Added transparent 1px WebP placeholders for both `cover.webp` and `profile.webp` in template assets so images never 404. Committed as `911d6b9`.
- **Preview as Visitor** — No way to see the page without edit buttons. Added "Preview as Visitor" button to nav drawer (edit mode only). Toggles `preview-mode` class on body which hides all `.edit-btn` and `#customization-panel`. Button text flips to "Exit Preview". Committed as `4b769a5`.
- **Panel buttons oversized** — Buttons inside `#customization-panel` inherited the base `button` rule (`0.5rem 1.2rem` padding, full width feel). Scoped `#customization-panel button` to match `.edit-btn` size (`0.8rem` font, `0.3rem 0.8rem` padding). Committed as `4b769a5`.
- **SW networkFirstDynamic throwing on PUT** — Same `cache.put` on non-GET issue as `networkFirstWithIndicator`, but in `networkFirstDynamic`. Added `request.method === 'GET'` guard. Committed as `a8a00ee`.

- **Directory label and domain input UX** — Mobile users couldn't easily copy the URL from the directory label. Changed label to "List your domain in the directory" and pre-populated the custom domain input with `username.github.io` so it's ready to save with one tap. If a custom domain is already set it shows that instead. Committed as `0e2e23f`.

- **AUTONOM.md / README.md** — Added `AUTONOM.md` to the template. Deployed to every user repo as `README.md` (renamed in the Git tree at deploy time so it renders on their GitHub repo homepage). Contains: badges for Amazon Q, Shannon, GitHub repo, Autonom; plain-English explanation of HTML/CSS/JS; how to edit a file on GitHub; full file structure tree; file use case table; hex color reference for dark/light mode and UI colors; "If You Broke It" section with undo steps and full nuclear reset instructions. Committed as `d39bc94`, rename fix as `bbe7a68`.

## Marketing Site (`autonom.page`) Build-Out

### Site Nav — All Pages
- Added fixed top nav bar to `index.html` and `about.html`: logo + hamburger, right-side drawer, overlay + Escape to close, inline script. `body { padding-top: 56px }` pushes content below fixed bar. Nav links to all planned pages. Committed as `70006db`.
- Nav CSS added to top of `onboard.css` (before `:root` variables block). `.page-hero` added for sub-page headers.

### `about.html`
- Four sections: The Project (what Autonom is and why), Is It Really Free (pricing table with real market rates vs Free), Shannon Goddard (tagline, three projects with stats and links, connect section with beer button), Amazon Q (honest account of how built, link to try it). Committed as `70006db`.
- About page CSS appended to `onboard.css`: `.about-section`, `.about-tagline`, `.about-honest`, `.pricing-table`, `.project-card`, `.project-header`, `.project-links`, `.about-connect`.

### `legal.html`
- Single page, two sections: Terms of Service (6 sections: what Autonom does, your responsibility, GitHub dependency, no warranty, changes, contact) and Privacy Policy (6 sections: onboarding token flow, what we don't do, your deployed site data, GitHub's privacy policy, third-party opt-ins, contact). Plain English throughout. Committed as `f02c337`.

### How It Works section — `index.html`
- Added `#how-it-works` section between Features and FAQ. Three numbered steps: make a GitHub account (with direct link to `github.com/signup`), fill in the form (name/bio/photo, we handle the rest), your site is live. Closes with "You've filled out harder forms than this." CSS appended to `onboard.css`. Committed as `2e37f6b`.

### `how-to-domain.html`
- Five steps: buy a domain (Namecheap/Squarespace/Cloudflare/GoDaddy with honest notes on each), tell GitHub about your domain (repo → Settings → Pages → Custom domain), add DNS records (full table: 4 A records + CNAME, registrar-specific notes), wait and verify (honest 15min–24hr window, two most common mistakes), update Autonom site URL. Committed as `d8fb872`.

### `how-to-google.html`
- Part 1: Google Search Console — add property, HTML tag verification (paste code into Autonom settings), submit `sitemap.xml`. Part 2: Google Analytics — create account, get `G-XXXXXXXXXX` measurement ID, paste into Autonom settings. Closes with realistic indexing timeline (day 1–3, week 1–2, month 1+). Committed as `d8fb872`.
- **Rich Results Test section** added — plain English explanation of JSON-LD, why Squarespace/Wix charge for it, 4-step walkthrough of the Rich Results Test tool, what entities they'll see (Person in personal mode, LocalBusiness + Person in business mode). Committed as `9af4deb`.
- **Directory section** added — explains auto-listing (no user input, name/URL from profile), how to opt out (Settings → uncheck toggle), honest design rationale (no spam, no typos, no one submitting someone else's URL). Committed as `9af4deb`.
- How-to CSS appended to `onboard.css`: `.howto-list` (arrow bullets, green accent), `.howto-steps` (auto-numbered, red circle counters, surface-2 background), `code` inline style.

### JSON-LD — `autonom.page`
- Added hardcoded `WebSite` + `SoftwareApplication` JSON-LD schema to `index.html`. `SoftwareApplication` includes `price: "0"`, `priceCurrency: "USD"`, `applicationCategory: "WebApplication"`, Shannon as `author` (Person). Enables rich results on the marketing site itself — used as the screenshot example in `how-to-google.html`. Committed as `56c01d3`.

### JSON-LD — User Template
- **`business.js`**: Added `generatePersonJSONLD(config)` for personal mode — outputs `Person` schema with name, URL, image, description, `mainEntityOfPage`. Updated `generateJSONLD(bp, config)` to output `@type: [LocalBusiness, Person]` combined type, pass `config` for bio/name, strip `undefined` values via `JSON.parse(JSON.stringify(schema))`. Exposed `generatePersonJSONLD` in public API. Committed as `5a128cb`.
- **`index.js`**: On every owner page load, `rewriteIndexHead` runs silently to keep schema current. Bio edit handler picks correct schema based on mode (Person vs LocalBusiness+Person). Committed as `5a128cb`.
- **`onboard.js`**: `patchIndexHtml` now injects `Person` schema into `index.html` at deploy time — schema present from day one before user ever logs in. Committed as `5a128cb`.

---

- **Nav links to unbuilt pages removed** — `directory.html`, `colors.html`, `changelog.html` removed from nav drawer on all five marketing pages until they are built. Home link fixed from `/` (resolved to C drive locally) to absolute `https://autonom.page`. Legal dates updated from June 2025 to October 2026. `how-to-domain.html` Step 5 ("Update your Autonom site settings") removed — custom domain is now a toggle only, no URL input, to protect the directory from spam and errors. Get Started card centered on desktop (`margin: 0 auto` on `.onboard-card`). — Nav script was an inline `<script>` block but `index.html` and `about.html` had `script-src 'self'` with no `'unsafe-inline'`. Browser silently blocked the click listener — hamburger did nothing. Extracted nav logic to `nav.js`, replaced inline block with `<script src="nav.js">` across all five marketing pages (`index.html`, `about.html`, `legal.html`, `how-to-domain.html`, `how-to-google.html`). Fixed `about.html` CSP to add `'unsafe-inline'` for consistency with the other pages.

---

## Known Issues / Future Work

- **App already installed edge case** — If a user has previously installed the GitHub App and returns to `autonom.page` to start over, the OAuth + installation flow throws an error (installation already exists). Needs a graceful handler — detect existing installation and skip to the form, or surface a clear message. Low priority edge case for now.
- **Template testing required first** — Before images, before the how-to guides are considered done, the deployed user site needs a full test pass: onboarding flow end-to-end, edit mode login, profile photo upload, cover photo upload, all six page toggles, customization panel saves, business mode switch, directory toggle, custom domain field, preview as visitor, wizard on first login. Use `shannon-not-tom` test account, delete repo between runs. See `testing/TESTING.md` for full checklist.
- **Images needed — BLOCKED on template testing** — Cannot take real screenshots of the deployed user site until toggles, image uploads, and edit mode are fully tested and working. All how-to screenshots that show the Autonom site in action (settings panel, customization toggles, profile photo upload, etc.) must use a real working deploy, not a mockup. Images to create once template is confirmed working:
  - How It Works steps: GitHub signup page, Autonom onboarding form, finished live site (3 images, 400×260px)
  - how-to-domain: GitHub Pages settings panel with custom domain field, registrar DNS records panel (2 images, 640×360px)
  - how-to-google: Search Console HTML tag screen, Analytics measurement ID screen, Rich Results Test result for `autonom.page` (3 images, 640×360px)
  - about.html hero banner — abstract/dark palette, no site dependency (900×300px)
  - All images go in `assets/`. Wire into HTML in one pass once delivered.
- **Remaining 404 pages** — `directory.html`, `colors.html`, `changelog.html` not yet built. Linked in nav.
- **`directory.html`** — Searchable list of all public Autonom sites. Reads from DynamoDB via `directory-api` Lambda. No user input — listings auto-populated from onboarding data, toggled via Settings panel.
- **`colors.html`** — Interactive hex/RGB color reference tool.
- **`changelog.html`** — Version history page.

---

## Phase 6: vCard Share (Planned)

### Vision
When the owner clicks "Share My Page", instead of silently copying a URL to the clipboard, a modal opens pre-filled with everything the site already knows about them. They review it, optionally fill in extra fields, and walk away with a real digital business card — a `.vcf` file anyone can tap to save directly to their phone contacts, plus the URL and QR code in the same flow.

### Why
A URL is a link. A vCard is an identity. One tap and the person who just visited your page has your name, photo, phone, email, and website saved in their contacts forever — no app, no platform, no middleman.

### Share Modal — UX Flow
1. Owner clicks **Share My Page** in admin utilities (edit mode)
2. Modal opens — pre-filled from `site-config.json` and `businessProfile` (if business mode)
3. Owner reviews, edits any field, adds anything missing
4. Three actions available:
   - **Download .vcf** — generates and downloads a standards-compliant vCard 3.0 file
   - **Copy Link** — copies `username.github.io` (or custom domain) to clipboard
   - **QR Code** — shows the existing QR code inline, with download button
5. Modal dismisses with Escape or clicking outside

### Pre-filled Fields (from existing data)
| vCard Field | Source |
|---|---|
| Full Name (`FN`, `N`) | `config.displayName` |
| Note / Bio (`NOTE`) | `config.bio` |
| URL (`URL`) | `config.customDomain` or `username.github.io` |
| Photo (`PHOTO`) | `assets/profile.webp` — fetched as blob, base64 encoded into vCard |
| Title (`TITLE`) | `config.status` (if set) |
| Organization (`ORG`) | `businessProfile.name` (business mode only) |
| Phone (`TEL`) | `businessProfile.phone` (business mode only) |
| Email (`EMAIL`) | `businessProfile.email` (business mode only) |
| Address (`ADR`) | `businessProfile.address` (business mode only) |

### Additional vCard Fields (optional, modal input only — not stored)
Fields the owner can fill in the modal that are useful for a contact card but don't belong in the public site config:
- Mobile phone (if different from business phone)
- Second email
- Birthday (`BDAY`)
- Pronouns (`X-PRONOUNS` — non-standard but widely supported)
- Social handles — Twitter/X, Instagram, LinkedIn, GitHub (each a separate `X-SOCIALPROFILE` or `URL` entry)

### vCard 3.0 Format
```
BEGIN:VCARD
VERSION:3.0
FN:Shannon Goddard
N:Goddard;Shannon;;;
TITLE:Founder, Loyal9 LLC
ORG:Loyal9 LLC
URL:https://shannon-goddard.github.io
EMAIL:shannon@loyal9.app
TEL;TYPE=WORK:+1-555-000-0000
NOTE:Full-stack developer. We pass them left and watch the industry blink.
PHOTO;ENCODING=b;TYPE=JPEG:[base64 encoded profile photo]
END:VCARD
```

### Implementation Notes
- Entirely client-side — no server, no API call, no new Lambda
- `generateVCard(config)` function in `admin.js` — builds the `.vcf` string from config + modal form values
- Profile photo fetched via `fetch('assets/profile.webp')` → `arrayBuffer()` → `btoa()` — embedded directly in the vCard so the contact saves with a photo
- Download triggered via `URL.createObjectURL(new Blob([vcf], { type: 'text/vcard' }))` + programmatic `<a>` click — no library needed
- Modal fields that aren't stored anywhere — they exist only in the modal, used only for the download. Owner fills them in each time or leaves them blank. No privacy concern, no extra config bloat.
- `site-config.json` gets a new optional `vcard` object for fields the owner wants pre-filled next time: `{ phone, socialHandles: { twitter, instagram, linkedin } }` — owner can save these from the modal with a "Remember these" checkbox
- QR code in modal reuses the existing `api.qrserver.com` image tag — no new code
- Keyboard accessible: Tab through fields, Enter to download, Escape to close
