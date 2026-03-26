# Manual Test Plan: Blueberry AI Co-Pilot

**Date:** 2026-03-26
**Pre-requisite:** `pnpm dev` running, fresh localStorage (cleared app data)

---

## Test Sequence

Run these steps in order. Each step builds on the previous one.

### Step 1: App Launch + Onboarding

- [ ] App opens with Google.com loaded in the main tab
- [ ] Open sidebar with **Cmd+E**
- [ ] **"Welcome to Blueberry"** onboarding screen appears
- [ ] Chrome and/or Safari checkboxes are shown (with "Available" label)
- [ ] Firefox shows "Not installed" (or "Available" if installed)
- [ ] Select Chrome, click **"Import Selected"**
- [ ] Progress bar animates, text shows "Analyzing browsing patterns..."
- [ ] **Profile summary screen** appears with:
  - Green checkmark
  - "Analyzed X URLs" count
  - Purple interest tags (e.g., Development, AI/ML, Social)
- [ ] Click **"Start Browsing"** to enter chat view

**If onboarding doesn't appear:** localStorage was already set. Clear with: DevTools (right-click sidebar → Inspect) → Console → `localStorage.removeItem('blueberry-onboarded')` → reload app

---

### Step 2: Sidebar Chat (basic)

- [ ] Sidebar shows chat view with input at bottom
- [ ] Type **"Hello, what can you help me with?"** and press Enter
- [ ] Message appears in chat as user bubble (right-aligned)
- [ ] AI responds with assistant bubble (left-aligned) — should mention browser tools
- [ ] Response streams in (text appears progressively)
- [ ] No error messages in the terminal console

---

### Step 3: Navigate to a Content Page

- [ ] Click the address bar, type **`en.wikipedia.org/wiki/Artificial_intelligence`** and press Enter
- [ ] Page loads in the main content area
- [ ] Wait 2-3 seconds for scripts to inject (check terminal for "Registry scripts injected OK")

---

### Step 4: Selection Pill — "Ask AI"

- [ ] Select a paragraph of text on the Wikipedia page (more than 3 characters)
- [ ] A floating glass pill appears above the selection with "Explain" and "Ask AI" buttons
- [ ] Click **"Ask AI"**
- [ ] Sidebar opens (if closed) and auto-sends a message with the selected text
- [ ] AI responds with context about the selected text
- [ ] The pill disappears after clicking

---

### Step 5: Selection Pill — "Explain" (inline tooltip)

- [ ] Select a different paragraph of text
- [ ] Pill appears again
- [ ] Click **"Explain"**
- [ ] A glass tooltip appears **below** the selection (not in sidebar)
- [ ] Tooltip shows a 1-2 sentence explanation
- [ ] Tooltip has "Blueberry AI" badge and "Ask more" link
- [ ] Clicking "Ask more" opens the sidebar
- [ ] Tooltip auto-dismisses after 15 seconds, or dismiss with Esc/click-away

---

### Step 6: Ghost Text Auto-Completion

- [ ] Navigate to a page with a text input (e.g., Google.com search bar, or any form)
- [ ] Click into the text field
- [ ] Start typing a few characters (e.g., "artif")
- [ ] After ~500ms debounce, ghost text appears (dimmed, after your cursor)
- [ ] Press **Tab** to accept the suggestion
- [ ] The ghost text becomes real text in the field
- [ ] Press **Esc** to dismiss ghost text without accepting
- [ ] Keep typing — ghost text updates after each debounce

---

### Step 7: Browser Action Tools (Agent Mode)

- [ ] Open sidebar (Cmd+E)
- [ ] Type: **"What buttons and links are on this page?"**
- [ ] AI uses `get_page_elements` tool and lists interactive elements
- [ ] Type: **"Navigate to github.com"**
- [ ] AI uses `navigate` tool, page changes to GitHub
- [ ] Type: **"Scroll down"**
- [ ] AI uses `scroll` tool, page scrolls
- [ ] Type: **"Click the Sign up button"** (or any visible button)
- [ ] AI uses `click` tool and confirms the action
- [ ] Check terminal — should see `[Browser Tool]` and `[Browser Tool Result]` logs

---

### Step 8: Page Rewrite (Summarize Page)

- [ ] Navigate to a long article (e.g., Wikipedia article)
- [ ] In the sidebar, find the **"Summarize Page"** button (below chat messages, above input)
- [ ] Click it
- [ ] A TL;DR overlay bar appears at the top of the page with:
  - Page type badge (e.g., "article")
  - TL;DR summary text
  - "Key Points" toggle button
  - Dismiss (X) button
- [ ] Click "Key Points" to expand/collapse the bullet list
- [ ] Click X to dismiss the overlay

---

### Step 9: Cross-Tab Synthesis

- [ ] Open 3 tabs with similar content:
  - Tab 1: Navigate to any GPU provider page (e.g., `lambda.com`)
  - Tab 2: Navigate to another (e.g., `runpod.io`)
  - Tab 3: Navigate to another (e.g., `vast.ai`)
- [ ] Switch between the 3 tabs rapidly (3+ switches in 60 seconds)
- [ ] A purple banner should appear in the sidebar: **"Comparing X tabs? Generate a comparison table?"**
- [ ] Click **"Compare tabs"**
- [ ] Synthesis view appears with:
  - Comparison table with headers and rows
  - Recommendation section
  - "Chat" back button

---

### Step 10: Attention Engine + Page Annotations

- [ ] Navigate to a long article page
- [ ] Hover your mouse over a paragraph and **stop moving** for 3+ seconds (dwell)
- [ ] A subtle purple highlight should appear on/near the element you dwelled on
- [ ] Move mouse away — the annotation stays (fades in slowly)
- [ ] Click the X on the annotation to dismiss it
- [ ] Dismiss 3 annotations — subsequent annotations should be throttled (won't appear for 10 minutes)

---

### Step 11: Workflow Recorder

- [ ] In the sidebar, find the **"Record"** button (next to "Summarize Page")
- [ ] Click it — button should change to "Stop" and indicate recording is active
- [ ] Perform some actions: click links, type in fields, navigate
- [ ] Click **"Stop"**
- [ ] Workflow replay view appears with:
  - Step list (numbered, with action descriptions)
  - Time offsets per step
  - "Make Replayable" button
  - "Discard" button
- [ ] Click "Make Replayable" to save, or "Discard" to go back to chat

---

### Step 12: Code Sandbox

- [ ] Navigate to a data-heavy page (e.g., Amazon product page, any table-based page)
- [ ] In sidebar chat, type: **"Extract all the links from this page"**
- [ ] AI should generate JavaScript code and execute it in the sandbox
- [ ] Sandbox result view appears with:
  - Status badge (success/error)
  - Collapsible code block
  - Output data
  - "Apply to Page" and "Copy" buttons
- [ ] Click "Copy" to copy the results

---

### Step 13: Dark Mode Toggle

- [ ] Find the dark mode toggle in the address bar area
- [ ] Toggle between dark and light mode
- [ ] All browser chrome (tabs, address bar, sidebar) should update
- [ ] Injected UI (pill, ghost text, annotations) should remain visible and styled

---

### Step 14: Multiple Tabs

- [ ] Create a new tab (click +)
- [ ] Navigate to a different page
- [ ] Switch between tabs — content updates correctly
- [ ] Close a tab (click X on tab)
- [ ] Scripts re-inject on new tab navigation (check terminal logs)

---

## Quick Smoke Test (5 minutes)

If short on time, test only these critical paths:

1. **Cmd+E** → sidebar opens → type message → AI responds
2. Select text → pill → "Explain" → inline tooltip appears
3. Select text → pill → "Ask AI" → sidebar opens with context
4. Type in search field → ghost text appears → Tab accepts
5. Chat: "Navigate to github.com" → page navigates

---

## Known Limitations

- Ghost text may not appear on some sites with strict CSP (Content Security Policy)
- Attention annotations need 3+ seconds of mouse stillness — be patient
- Cross-tab synthesis needs rapid switching (3+ times in 60 seconds)
- Local model (Qwen2.5-0.5B) may take 30-60 seconds to load on first launch
- Workflow recorder captures clicks and inputs only (not hover or complex gestures)
- Sandbox creates a new WebContentsView per execution — may be slow on first run

---

## Reporting Issues

For each failed step, note:
1. Step number
2. What you expected
3. What happened instead
4. Any error messages in terminal console
