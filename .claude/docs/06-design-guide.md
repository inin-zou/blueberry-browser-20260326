# Design Guide: Blueberry Liquid Monolith

**Date:** 2026-03-26
**Source:** Stitch design drafts + ui-ux-pro-max design system analysis
**Style:** Dark Mode (OLED) + Glassmorphism + Apple-inspired Minimalism
**Product Type:** Developer Tool / AI IDE (Dark Mode + Minimalism primary)

---

## 1. Design Audit: Which Drafts to Use

| Draft | Verdict | Notes |
|-------|---------|-------|
| `main_browser_window_liquid_glass` | **Primary reference** | Best overall browser shell. Dark, glassy sidebar, clean layout. Use as the foundation. |
| `first_launch_onboarding_flow` | **Use** | Clean onboarding card with browser history import. Well-structured, dark theme consistent. |
| `ghost_text_auto_completion` | **Use** | Ghost text in Gmail compose. Subtle, correct interaction. Minimal and clean. |
| `cross_tab_synthesis_view` | **Use** | Synthesis sidebar with comparison table. Good data layout, purple accent badges. |
| `workflow_replay_player` | **Use** | Sidebar replay player. Mini viewport + timeline + step list. Good layout. |
| `workflow_replay_sidebar` | **Use** | Replay in context with browser content visible. Good spatial relationship. |
| `floating_ai_action_pill` | **Adapt** | Shows a selection pill but it's in a left-sidebar layout (Monolith AI style, not our design). Extract the pill concept, not the layout. |
| `main_browser_window` | **Skip** | Earlier version, replaced by liquid_glass variant. Has sidebar nav tabs that don't fit our architecture. |
| `ai_visual_annotations_mobile` | **Skip** | Mobile viewport — we're desktop only. Annotation style is good reference but layout is wrong. |
| `onboarding_liquid_glass` | **Skip** | Light mode variant — inconsistent with our dark-first approach. |
| `synthesis_view_liquid_glass` | **Skip** | Low quality render, broken layout. |
| `workflow_replay_liquid_glass` | **Skip** | Too low-res to use, but layout concept is captured in the other two replay drafts. |
| `liquid_monolith` / `blueberry_monolith` | **Palette only** | No screenshot files. Use for color tokens. |

---

## 2. Design Tokens (Liquid Monolith Palette)

### Colors

```css
/* Surface hierarchy (darkest → lightest) */
--surface-dim:                #131318;    /* App background, deepest layer */
--surface-container-lowest:   #0e0e13;    /* Content area background */
--surface-container-low:      #1b1b20;    /* Cards, panels */
--surface-container:          #1f1f25;    /* Elevated cards */
--surface-container-high:     #2a292f;    /* Inputs, active areas */
--surface-container-highest:  #35343a;    /* Hover states, highlights */

/* Text */
--on-surface:                 #e4e1e9;    /* Primary text */
--on-surface-variant:         #c7c4d7;    /* Secondary text, descriptions */
--outline:                    #918fa0;    /* Tertiary text, placeholders */
--outline-variant:            #464554;    /* Borders, dividers */

/* Brand / Accent */
--primary:                    #c2c1ff;    /* Primary text accent, links */
--primary-container:          #5e5ce6;    /* Buttons, active indicators, badges */
--on-primary:                 #1800a7;    /* Text on primary buttons (rare) */

/* Semantic */
--error:                      #ffb4ab;
--tertiary:                   #ffb786;    /* Warnings, orange accents */

/* Gradient */
--liquid-gradient:            linear-gradient(135deg, #5e5ce6 0%, #c2c1ff 100%);
```

### Glass Effect

```css
.glass-panel {
  background: rgba(19, 19, 24, 0.7);     /* surface-dim at 70% */
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
}

.glass-border {
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

### Typography

```css
/* Fonts */
--font-body:     'Inter', sans-serif;       /* All UI text */
--font-mono:     'JetBrains Mono', monospace; /* Code, labels, timestamps */

/* Scale */
--text-xs:       11px;    /* Timestamps, labels, badges */
--text-sm:       13px;    /* Body text, inputs, messages */
--text-base:     14px;    /* Standard UI text */
--text-lg:       18px;    /* Section headers */
--text-xl:       24px;    /* Page titles */
--text-3xl:      30px;    /* Hero text */

/* Weights */
--font-regular:  400;
--font-medium:   500;
--font-semibold: 600;
--font-bold:     700;
--font-extrabold: 800;   /* Headlines only */

/* Labels (mono, uppercase) */
.label-xs {
  font-family: 'JetBrains Mono';
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
}
```

### Spacing Scale (4px base grid)

```css
/* Spacing tokens — use consistently, no arbitrary values */
--space-1:   4px;      /* Inline icon padding, tight gaps */
--space-2:   8px;      /* Between related elements, icon-to-text */
--space-3:   12px;     /* Small component internal padding */
--space-4:   16px;     /* Default component padding, list item gaps */
--space-5:   20px;     /* macOS traffic light offset */
--space-6:   24px;     /* Section padding, card internal padding */
--space-8:   32px;     /* Between sections, large gaps */
--space-10:  40px;     /* Page-level padding */
--space-12:  48px;     /* Between major page sections */
--space-16:  64px;     /* Hero-level spacing */
```

### Border Radii

```css
--radius-sm:     4px;     /* Small buttons, badges, chips */
--radius-default: 8px;    /* Inputs, cards, panels, most elements */
--radius-lg:     12px;    /* Large cards, modals, sidebar containers */
--radius-xl:     16px;    /* Feature cards, onboarding card */
--radius-full:   9999px;  /* Pills, avatars, circular buttons */
```

### Shadows & Elevation

```css
/* Level 0 — Flat (content, in-page elements) */
--shadow-none:    none;

/* Level 1 — Subtle (cards, panels) */
--shadow-card:    0 4px 30px rgba(0, 0, 0, 0.5);

/* Level 2 — Glow (primary buttons, active elements) */
--shadow-glow:    0 0 8px rgba(94, 92, 230, 0.4);

/* Level 3 — Sidebar edge */
--shadow-sidebar: -20px 0 60px rgba(94, 92, 230, 0.06);

/* Level 4 — Modal/overlay */
--shadow-modal:   0 32px 64px -12px rgba(0, 0, 0, 0.8);
```

### Z-Index Scale

```css
/* Defined layers — no random z-index values */
--z-content:     0;       /* Page content, cards */
--z-sticky:      10;      /* Sticky headers within content */
--z-sidebar:     40;      /* Sidebar panel */
--z-topbar:      50;      /* Top navigation bar */
--z-dropdown:    60;      /* Dropdowns, popovers */
--z-modal:       100;     /* Modals, overlays */
--z-toast:       200;     /* Toast notifications */
--z-injected:    2147483647; /* Injected page elements (pill, ghost text) */
```

### Scrollbar

```css
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
```

---

## 3. Component Patterns (from Stitch Drafts)

### 3.1 Sidebar Chat Messages

From `main_browser_window_liquid_glass`:

```
AI message:
  bg-white/5, backdrop-blur-md, border border-white/10
  rounded-tr-xl rounded-b-xl (sharp top-left = "from AI")
  text-sm, text-on-surface-variant

User message:
  bg-[#5E5CE6]/20, border border-[#5E5CE6]/30
  rounded-tl-xl rounded-b-xl (sharp top-right = "from user")
  text-sm, text-[#C2C1FF]
  aligned right (self-end)

Timestamp:
  text-[10px] font-mono text-slate-600
```

### 3.2 Sidebar Input

```
Container: bg-surface-container-lowest, border border-white/10, rounded-xl
Textarea: bg-transparent, no ring, text-sm, resize-none
Send button: liquid-gradient, rounded-lg, w-10 h-10
  shadow-lg shadow-[#5E5CE6]/40
  hover:scale-105 active:scale-95
```

### 3.3 Active Tab Indicator

```
Active tab:
  bg-white/5, border-t border-x border-white/10
  border-b-2 border-[#5E5CE6]   ← purple bottom border = active
  text-[#C2C1FF]

Inactive tab:
  text-slate-400 opacity-60
  hover:bg-white/5
```

### 3.4 URL Bar

```
Container: bg-white/5, border border-white/10, rounded-lg
  focus-within:border-[#5E5CE6]/50
Input: text-[13px] font-['Inter'] text-slate-300
Lock icon: text-slate-500, 18px
```

### 3.5 Glass Card (for onboarding, modals)

```
bg-surface-container-low
border border-outline-variant/15
rounded-xl
shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)]
monolith-blur (backdrop-filter: blur(20px))
```

### 3.6 Primary CTA Button

```
bg-gradient-to-r from-primary-container to-secondary-container
  (or simpler: liquid-gradient)
text-white, text-sm, font-bold
px-8 py-3, rounded-lg
shadow-lg shadow-primary-container/20
hover:scale-[1.02] active:scale-95
```

### 3.7 Ghost Text Button

```
px-3 py-1
bg-white/5, rounded-full
text-[10px]
border border-white/10
hover:bg-white/10
```

### 3.8 Comparison Table (Synthesis View)

From `cross_tab_synthesis_view`:

```
Table container: sidebar width, no outer border
Header row: text-xs font-mono uppercase, text-slate-500
Data cells: text-sm
  Green highlight for "best" values
  Red/orange for "worst"
Recommendation section below:
  bg-surface-container-low, border-l-2 border-[#5E5CE6]
  or highlighted box with primary accent
```

### 3.9 Workflow Step List

From `workflow_replay_player`:

```
Each step:
  Numbered circle (filled = completed, outline = pending)
  Step title in semibold
  Subtitle: "0:18 · Interaction" in text-xs text-slate-500
  Vertical line connecting steps

Completed step circle: bg-[#5E5CE6], white checkmark
Active step: ring-2 ring-[#5E5CE6]
Pending step: bg-transparent, border border-white/10
```

---

## 4. Animation System

### Timing Tokens

```css
/* Duration — contextual, not one-size-fits-all */
--duration-instant:   0ms;       /* Immediate state changes (color on click) */
--duration-fast:      100ms;     /* Button press feedback, opacity */
--duration-default:   200ms;     /* Most transitions (hover, focus, toggle) */
--duration-moderate:  300ms;     /* Panel open/close, tab switch */
--duration-slow:      500ms;     /* Annotation fade-in (intentionally gradual) */

/* Easing — from ui-ux-pro-max "Modern Dark Cinema" */
--ease-out:           cubic-bezier(0.16, 1, 0.3, 1);   /* Enter/appear — fast start, soft land */
--ease-in:            cubic-bezier(0.55, 0, 1, 0.45);   /* Exit/disappear — soft start, fast end */
--ease-in-out:        cubic-bezier(0.4, 0, 0.2, 1);     /* Move/reposition */
--ease-spring:        cubic-bezier(0.34, 1.56, 0.64, 1); /* Playful bounce (pills, toasts) */
```

### Animation Rules

| Element | Duration | Easing | Effect |
|---------|----------|--------|--------|
| Button hover | 200ms | ease-out | `opacity 0.8 → 1` or `bg-white/5 → bg-white/10` |
| Button press | 100ms | ease-out | `scale(0.97)` → release `scale(1.0)` in 200ms |
| Send button press | 100ms | ease-out | `scale(0.95)` with glow pulse |
| Selection pill appear | 200ms | ease-spring | `opacity 0→1, translateY(4px→0)` |
| Selection pill dismiss | 150ms | ease-in | `opacity 1→0, translateY(0→-4px)` |
| Ghost text appear | 150ms | ease-out | `opacity 0→0.6` |
| Ghost text accept (Tab) | 100ms | ease-out | `opacity 0.6→1, color muted→on-surface` |
| Annotation fade-in | 500ms | ease-out | `opacity 0→0.7` (intentionally slow — non-intrusive) |
| Annotation dismiss | 200ms | ease-in | `opacity 0.7→0` |
| Sidebar open | 300ms | ease-out | `width 0→400px` or `translateX(400→0)` |
| Sidebar close | 200ms | ease-in | Exit faster than enter (70% of enter duration) |
| Tab switch content | 150ms | ease-in-out | Crossfade content area |
| Modal/onboarding appear | 300ms | ease-spring | `scale(0.95→1), opacity 0→1` |
| Toast notification | 300ms in, 200ms out | ease-spring / ease-in | Slide in from top-right |

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

All animations must degrade to instant state changes when reduced motion is enabled.

---

## 5. Component States

### 5.1 Interactive Element States

Every interactive element must define all 5 states:

| State | Visual Treatment | Transition |
|-------|-----------------|------------|
| **Default** | Base appearance | — |
| **Hover** | `bg-white/5 → bg-white/10` or opacity increase | 200ms ease-out |
| **Pressed/Active** | `scale(0.97)`, slightly darker bg | 100ms ease-out |
| **Focused** | `ring-2 ring-[#5E5CE6]/50 ring-offset-2 ring-offset-[#131318]` | 150ms ease-out |
| **Disabled** | `opacity-0.38`, `cursor-not-allowed`, no hover/press effects | instant |

### 5.2 Button Variants

```
Primary CTA:
  default:   liquid-gradient, text-white, shadow-glow
  hover:     scale(1.02), shadow-glow intensifies
  pressed:   scale(0.95)
  focused:   ring-2 ring-[#c2c1ff]/50
  disabled:  opacity-0.38, no gradient (flat bg-[#5E5CE6]/20)

Secondary (Ghost):
  default:   bg-white/5, border border-white/10, text-on-surface-variant
  hover:     bg-white/10
  pressed:   bg-white/15, scale(0.97)
  focused:   ring-2 ring-[#5E5CE6]/50
  disabled:  opacity-0.38

Icon button:
  default:   text-slate-400
  hover:     text-[#C2C1FF]
  pressed:   scale(0.95), text-[#C2C1FF]
  focused:   ring-2 ring-[#5E5CE6]/50
  disabled:  opacity-0.38
```

### 5.3 Input Field States

```
Default:
  bg-white/5, border border-white/10, text-slate-300
  placeholder: text-slate-600

Focused:
  border-[#5E5CE6]/50, ring-1 ring-[#5E5CE6]/20
  placeholder: text-slate-500 (slightly lighter)

Error:
  border-[#ffb4ab]/50, ring-1 ring-[#ffb4ab]/20
  error text below: text-[#ffb4ab] text-xs

Disabled:
  opacity-0.38, bg-white/3, cursor-not-allowed
```

### 5.4 Tab States

```
Active:
  bg-white/5, border-b-2 border-[#5E5CE6], text-[#C2C1FF]

Inactive:
  text-slate-400, opacity-60

Hover (inactive):
  bg-white/5, opacity-80

Close button:
  opacity-0 → opacity-60 on tab hover → opacity-100 on button hover
```

### 5.5 Selection Pill States

```
Appearing:
  200ms ease-spring, translateY(4→0), opacity 0→1

Idle:
  glass background, border-white/10

Button hover ("Explain" / "Ask AI"):
  bg-white/10

Auto-dismiss:
  After 5s idle → 200ms fade out

Manual dismiss:
  Click away → 150ms fade out
```

---

## 6. Accessibility

### Contrast Requirements

| Pair | Ratio | WCAG Level |
|------|-------|------------|
| `#e4e1e9` on `#131318` (primary text on bg) | 13.2:1 | AAA |
| `#c7c4d7` on `#131318` (secondary text on bg) | 9.5:1 | AAA |
| `#918fa0` on `#131318` (tertiary text on bg) | 5.4:1 | AA |
| `#c2c1ff` on `#131318` (accent text on bg) | 9.1:1 | AAA |
| `#c2c1ff` on `#1b1b20` (accent on cards) | 7.8:1 | AAA |
| `#e4e1e9` on `#5e5ce6` (text on primary button) | 4.8:1 | AA |

All pass WCAG AA minimum. Primary and secondary text pass AAA.

### Focus Indicators

```css
/* Global focus style — visible, high-contrast */
:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px #131318,           /* offset matches background */
    0 0 0 4px rgba(194, 193, 255, 0.5);  /* primary ring */
}

/* Never remove focus outlines without replacement */
/* cursor-pointer on all clickable elements */
```

### Keyboard Navigation

- Tab order must match visual reading order (left→right, top→bottom)
- All sidebar views navigable via keyboard
- Esc closes: sidebar, pills, modals, annotations
- Enter/Space activates buttons
- Arrow keys navigate within tab bar, comparison tables

### Screen Reader Considerations

- Injected page elements (pill, annotations, ghost text) use `aria-live="polite"` for non-intrusive announcements
- Ghost text suggestions use `aria-label` describing the suggestion
- Selection pill uses `role="tooltip"` with `aria-describedby`
- Annotations use `role="note"` with descriptive labels
- Comparison tables use proper `<th>` headers with `scope`

### Color Not Sole Indicator

- Comparison table: green/red values also have up/down arrow icons
- Error states: red border + error icon + text message
- Active tab: purple border + text color change + aria-selected
- Workflow steps: checkmark icon + filled circle (not just color)

---

## 7. Design Principles

Based on your direction: **Liquid Monolith palette + smoother edges + Apple design + flat + clean + minimal**

### Do
- **Flat surfaces, no skeuomorphism** — depth comes from glass blur + subtle borders, not gradients
- **Generous whitespace** — let elements breathe, don't cram
- **Smooth rounded corners** — 8px minimum, 12-16px for cards
- **Subtle animations** — 150-300ms transitions, ease-out curves, scale for button presses
- **Monochrome + one accent** — the purple (#5E5CE6 / #C2C1FF) is the ONLY color accent. Everything else is grayscale
- **Glass hierarchy** — blur intensity signals depth (40px for chrome, 20px for cards, 0 for content)
- **Inter everywhere** — clean, neutral, Apple-adjacent. JetBrains Mono for code/labels only

### Don't
- No thick borders — use `border-white/10` (10% white) or `border-white/5`
- No loud shadows — shadows should be near-invisible, just enough to separate layers
- No emoji in UI — use Material Symbols Outlined icons
- No bright colors besides the purple accent — even green/red should be muted (emerald-400, not green-500)
- No rounded-full on cards — only on pills, avatars, and circular buttons

---

## 8. Tailwind Config to Add

Merge this into the existing `tailwind.config.js`:

```javascript
// Add to tailwind.config.js theme.extend
colors: {
  'surface-dim': '#131318',
  'surface-lowest': '#0e0e13',
  'surface-low': '#1b1b20',
  'surface-base': '#1f1f25',
  'surface-high': '#2a292f',
  'surface-highest': '#35343a',
  'on-surface': '#e4e1e9',
  'on-surface-variant': '#c7c4d7',
  'outline': '#918fa0',
  'outline-variant': '#464554',
  'bb-primary': '#c2c1ff',
  'bb-primary-container': '#5e5ce6',
},
fontFamily: {
  'mono': ['JetBrains Mono', 'monospace'],
},
```

---

## 9. Injected UI Styling (Shadow DOM)

For elements injected INTO web pages (pill, ghost text, annotations), use Shadow DOM with inline Liquid Monolith styles:

```javascript
// Base template for all injected elements
function createBlueberryElement(id, innerHtml, styles) {
  const host = document.createElement('div')
  host.id = `blueberry-${id}`
  host.style.cssText = 'all: initial; position: absolute; z-index: 2147483647;'

  const shadow = host.attachShadow({ mode: 'closed' })
  shadow.innerHTML = `
    <style>
      :host { font-family: 'Inter', -apple-system, sans-serif; }
      * { box-sizing: border-box; margin: 0; padding: 0; }

      /* Liquid Monolith tokens */
      .glass {
        background: rgba(19, 19, 24, 0.85);
        backdrop-filter: blur(40px);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .text-primary { color: #c2c1ff; }
      .text-muted { color: #c7c4d7; }
      .bg-accent { background: #5e5ce6; }
      .gradient { background: linear-gradient(135deg, #5e5ce6, #c2c1ff); }

      ${styles}
    </style>
    ${innerHtml}
  `
  return host
}
```

This ensures injected UI:
- Looks consistent regardless of host page styles
- Uses the Liquid Monolith palette
- Has smooth rounded corners and glass effects
- Won't be affected by host page CSS resets
