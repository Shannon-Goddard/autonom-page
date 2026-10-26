# Testing Checklist

Each test session gets its own file in this folder named `YYYY-MM-DD.md`.
Log pass/fail, console errors, and any fix applied with commit hash.

---

## Priority 1 — Must Pass Before Public Launch

### Onboarding Flow
- [ X ] TOS checkbox enables Connect button
- [ X ] Connect GitHub redirects to OAuth
- [ X ] OAuth callback redirects to install step
- [ X ] Install step scroll-into-view works
- [ X ] App install redirects back to form step
- [ X ] Form step scroll-into-view works
- [ X ] Deploy button disabled while deploying
- [ X ] Progress steps animate correctly (pending → done)
- [ X ] Repo created on GitHub
- [ X ] All template files committed in single commit
- [ X ] README.md present in user repo and renders on GitHub homepage
- [ X ] GitHub Pages enabled automatically
- [ X ] Site comes online within 3 minutes
- [ X ] Redirect to `username.github.io` with token in hash
- [ X ] Token read from hash and stored in sessionStorage
- [ X ] Hash stripped from URL after read

### First-Time Wizard
- [ X ] Wizard appears on first land (not to visitors)
- [ X ] Status field saves to site-config.json
- [ X ] Cover photo upload commits to assets/cover.webp
- [ X ] Page toggles save correctly
- [ X ] Save & Finish dismisses wizard and shows success toast
- [ X ] Skip for now dismisses wizard without saving
- [ X ] Wizard does not appear on reload after dismiss

### Edit Mode
- [ X ] Edit buttons visible when logged in as owner
- [ X ] Edit buttons hidden from visitors
- [ X ] Cover photo upload commits and updates live
- [ X ] Profile photo upload commits and updates live
- [ X ] Bio edit saves and persists after reload
- [ X ] Status edit saves and persists after reload
- [ X ] Log Out clears session and hides edit buttons
- [ X ] Preview as Visitor hides all edit UI
- [ X ] Exit Preview restores edit UI

### Customization Panel
- [ ] Theme toggle (dark/light) applies immediately
after light is selected from drop, have to scroll to bottom to save changes. Need to move save changes button to a more easy access location. White/light text needs to change to blackish. Such as " Pages
 Gallery  Music  Videos  Friends  Guestbook"
- [ X ] Background solid color saves and applies
- [ ] Background image upload saves and applies
no. goes back to original dark blue solid color state.
- [ ] Background type select shows/hides correct input no. gradiant goes to previous solid color picked with no options for gradiant effects.
- [ ] Custom CSS field saves and applies
no, and has no explaination of what it is supose to do.
- [ ] Page toggles save and update nav
no. unslected pages and they remained in the nav.
- [ X] Save Changes commits and persists after reload yes. however I need to note when viewing as a guest "Videos" is always present on the page.
- [] Switch to Business Mode works
note. price range has $, $$, $$$, $$$$ as options and not explained why. Business mode is not saved and never shows on guest page.
- [ ] Switch back to Personal Mode restores previous state

### Admin Panel
- [ ] Storage meter loads repo size
- [ ] Export / Backup opens zip download
- [ X ] Share My Page copies URL to clipboard
- [ X ] QR code generates and displays
- [ X ] QR code download link works
- [ X ] Directory label reads "List your domain in the directory" thinking how this opens up potential spam into our directory.Should have a yes/no toggle. No input. 
- [ X ] Domain input pre-populated with username.github.io thinking how if they decided to point to a paid domain, they are now a profession of some type. Not part of autonom community. Shouldn't be able to list that custom domain
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
