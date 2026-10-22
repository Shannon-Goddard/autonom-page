# Testing Checklist

Each test session gets its own file in this folder named `YYYY-MM-DD.md`.
Log pass/fail, console errors, and any fix applied with commit hash.

---

## Priority 1 — Must Pass Before Public Launch

### Onboarding Flow
- [ ] TOS checkbox enables Connect button
- [ ] Connect GitHub redirects to OAuth
- [ ] OAuth callback redirects to install step
- [ ] Install step scroll-into-view works
- [ ] App install redirects back to form step
- [ ] Form step scroll-into-view works
- [ ] Deploy button disabled while deploying
- [ ] Progress steps animate correctly (pending → done)
- [ ] Repo created on GitHub
- [ ] All template files committed in single commit
- [ ] README.md present in user repo and renders on GitHub homepage
- [ ] GitHub Pages enabled automatically
- [ ] Site comes online within 3 minutes
- [ ] Redirect to `username.github.io` with token in hash
- [ ] Token read from hash and stored in sessionStorage
- [ ] Hash stripped from URL after read

### First-Time Wizard
- [ ] Wizard appears on first land (not to visitors)
- [ ] Status field saves to site-config.json
- [ ] Cover photo upload commits to assets/cover.webp
- [ ] Page toggles save correctly
- [ ] Save & Finish dismisses wizard and shows success toast
- [ ] Skip for now dismisses wizard without saving
- [ ] Wizard does not appear on reload after dismiss

### Edit Mode
- [ ] Edit buttons visible when logged in as owner
- [ ] Edit buttons hidden from visitors
- [ ] Cover photo upload commits and updates live
- [ ] Profile photo upload commits and updates live
- [ ] Bio edit saves and persists after reload
- [ ] Status edit saves and persists after reload
- [ ] Log Out clears session and hides edit buttons
- [ ] Preview as Visitor hides all edit UI
- [ ] Exit Preview restores edit UI

### Customization Panel
- [ ] Theme toggle (dark/light) applies immediately
- [ ] Background solid color saves and applies
- [ ] Background image upload saves and applies
- [ ] Background type select shows/hides correct input
- [ ] Custom CSS field saves and applies
- [ ] Page toggles save and update nav
- [ ] Save Changes commits and persists after reload
- [ ] Switch to Business Mode works
- [ ] Switch back to Personal Mode restores previous state

### Admin Panel
- [ ] Storage meter loads repo size
- [ ] Export / Backup opens zip download
- [ ] Share My Page copies URL to clipboard
- [ ] QR code generates and displays
- [ ] QR code download link works
- [ ] Directory label reads "List your domain in the directory"
- [ ] Domain input pre-populated with username.github.io
- [ ] Save Domain commits CNAME file
- [ ] DNS helper appears after domain saved
- [ ] Directory toggle saves to site-config.json

---

## Priority 2 — Sub-Pages

### Gallery
- [ ] Gallery page loads
- [ ] Photos display in grid
- [ ] Upload photo compresses and commits
- [ ] Delete photo removes from repo and grid
- [ ] Empty state message shown when no photos

### Music
- [ ] Music page loads
- [ ] Player hidden when no track uploaded
- [ ] Upload MP3 commits and player appears
- [ ] Play / pause works
- [ ] Seek bar works
- [ ] Volume works
- [ ] Download link works
- [ ] Track title and artist display correctly

### Videos
- [ ] Videos page loads
- [ ] Add YouTube URL embeds video
- [ ] Remove video works
- [ ] Enter key triggers add
- [ ] Empty state shown when no videos

### Friends
- [ ] Friends page loads
- [ ] Add friend by username fetches their profile
- [ ] Friend card shows name and photo
- [ ] Remove friend works
- [ ] Broken avatar falls back gracefully

### Guestbook
- [ ] Guestbook page loads
- [ ] Approved posts render from guestbook.json
- [ ] Visitor sees post CTA
- [ ] Unauthenticated visitor sees welcome modal
- [ ] Owner sees moderation inbox when posts pending

### Games
- [ ] Games page loads
- [ ] All 5 game tiles visible
- [ ] Each game launches in canvas
- [ ] Back button returns to picker
- [ ] High scores save to localStorage

---

## Priority 3 — Polish and Edge Cases

### Navigation
- [ ] Nav drawer opens and closes
- [ ] Only toggled-ON pages appear in nav
- [ ] Active page highlighted in nav
- [ ] Escape key closes nav
- [ ] Focus trap works inside open nav
- [ ] Nav logout button visible in edit mode only
- [ ] Nav preview button visible in edit mode only

### PWA
- [ ] manifest.json has correct display name
- [ ] Site installable on mobile (Add to Home Screen prompt)
- [ ] Service worker registers without errors
- [ ] Offline load works for cached pages
- [ ] Template updates reach user on next reload (no stale SW cache)

### README
- [ ] README.md renders on user GitHub repo homepage
- [ ] Badges display correctly
- [ ] File structure tree is accurate
- [ ] Hex color table is accurate
- [ ] "If You Broke It" links work

### Misc
- [ ] 404 page loads for bad URLs
- [ ] OG tags populated correctly (check with og:debugger)
- [ ] No console errors on clean load (visitor view)
- [ ] No console errors on clean load (edit mode)
- [ ] Light mode has no contrast issues
- [ ] Mobile layout looks correct on 375px width
