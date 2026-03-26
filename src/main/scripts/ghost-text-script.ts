// src/main/scripts/ghost-text-script.ts
// This module exports the ghost text script as a JS string constant.
// The placeholder __TAB_ID__ is replaced at injection time with the real tab ID.

export function buildGhostTextScript(tabId: string): string {
  const script = `
(function() {
  'use strict';

  // Avoid double-injection
  if (window.__blueberryGhostTextActive) return;
  window.__blueberryGhostTextActive = true;

  const TAB_ID = ${JSON.stringify(tabId)};

  // ─── State ───────────────────────────────────────────────────────────────
  let focusedElement = null;
  let ghostContainer = null;   // Shadow-DOM host element
  let shadowRoot = null;
  let ghostSpan = null;         // The visible dimmed text span
  let tabHintSpan = null;       // "Tab ↹" badge
  let debounceTimer = null;
  let currentRequestId = null;
  let currentSuggestion = '';

  // ─── CSS selector helper ──────────────────────────────────────────────────
  function getCssSelector(el) {
    if (!el) return '';
    if (el.id) return '#' + CSS.escape(el.id);

    const parts = [];
    let node = el;
    while (node && node !== document.body && node !== document.documentElement) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        part += '#' + CSS.escape(node.id);
        parts.unshift(part);
        break;
      }
      // nth-child index among same-tag siblings
      const siblings = Array.from(node.parentNode ? node.parentNode.children : []);
      const sameTags = siblings.filter(s => s.tagName === node.tagName);
      if (sameTags.length > 1) {
        const idx = sameTags.indexOf(node) + 1;
        part += ':nth-of-type(' + idx + ')';
      }
      parts.unshift(part);
      node = node.parentNode;
    }
    return parts.join(' > ') || el.tagName.toLowerCase();
  }

  // ─── Text field detector ─────────────────────────────────────────────────
  function isTextField(el) {
    if (!el) return false;
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (tag === 'textarea') return true;
    if (tag === 'input') {
      const type = (el.type || 'text').toLowerCase();
      const textTypes = ['text', 'search', 'url', 'email', 'tel', 'password', ''];
      return textTypes.includes(type);
    }
    if (el.isContentEditable) return true;
    return false;
  }

  // ─── Ghost text rendering ─────────────────────────────────────────────────
  function createGhostContainer() {
    // Use a fixed-position host that we teleport near the cursor
    const host = document.createElement('div');
    host.setAttribute('data-blueberry-ghost', 'true');
    host.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'pointer-events: none',
      'z-index: 2147483647',
      'overflow: visible',
    ].join(';');

    const sr = host.attachShadow({ mode: 'open' });
    const wrapper = document.createElement('div');
    wrapper.style.cssText = [
      'position: absolute',
      'top: 0',
      'left: 0',
      'white-space: pre',
      'pointer-events: none',
      'display: flex',
      'align-items: baseline',
    ].join(';');

    ghostSpan = document.createElement('span');
    ghostSpan.style.cssText = [
      'color: rgba(194, 193, 255, 0.4)',
      'pointer-events: none',
    ].join(';');

    tabHintSpan = document.createElement('span');
    tabHintSpan.textContent = ' Tab \u21B9';
    tabHintSpan.style.cssText = [
      'font-size: 10px',
      'opacity: 0.5',
      'color: rgba(194, 193, 255, 0.4)',
      'pointer-events: none',
      'margin-left: 4px',
      'font-family: system-ui, sans-serif',
    ].join(';');

    wrapper.appendChild(ghostSpan);
    wrapper.appendChild(tabHintSpan);
    sr.appendChild(wrapper);

    document.documentElement.appendChild(host);
    ghostContainer = host;
    shadowRoot = sr;
    return { host, sr, wrapper };
  }

  function dismissGhostText() {
    currentSuggestion = '';
    currentRequestId = null;
    if (ghostContainer) {
      ghostContainer.remove();
      ghostContainer = null;
      shadowRoot = null;
      ghostSpan = null;
      tabHintSpan = null;
    }
  }

  function getCaretCoordinates(el) {
    // For <input> and <textarea>, use a mirror div technique
    if (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea') {
      const rect = el.getBoundingClientRect();
      const computed = window.getComputedStyle(el);

      const mirror = document.createElement('div');
      mirror.style.cssText = [
        'position: fixed',
        'visibility: hidden',
        'white-space: pre-wrap',
        'word-wrap: break-word',
        'overflow: hidden',
      ].join(';');

      // Copy relevant styles
      const copyProps = [
        'font', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
        'letterSpacing', 'lineHeight', 'textTransform',
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
        'boxSizing',
      ];
      copyProps.forEach(p => { mirror.style[p] = computed[p]; });
      mirror.style.width = rect.width + 'px';
      mirror.style.height = rect.height + 'px';
      mirror.style.left = rect.left + 'px';
      mirror.style.top = rect.top + 'px';

      const value = el.value || '';
      const cursorPos = el.selectionStart || 0;
      const beforeText = value.substring(0, cursorPos);

      mirror.textContent = beforeText;
      const caretEl = document.createElement('span');
      caretEl.textContent = '|';
      mirror.appendChild(caretEl);

      document.documentElement.appendChild(mirror);
      const caretRect = caretEl.getBoundingClientRect();
      mirror.remove();

      return { x: caretRect.left, y: caretRect.top, height: caretRect.height || parseInt(computed.fontSize, 10) };
    }

    // ContentEditable: use Selection API
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0).cloneRange();
      range.collapse(true);
      const rects = range.getClientRects();
      if (rects.length > 0) {
        const r = rects[0];
        return { x: r.right, y: r.top, height: r.height };
      }
    }
    const rect = el.getBoundingClientRect();
    return { x: rect.left, y: rect.top, height: parseInt(window.getComputedStyle(el).fontSize, 10) };
  }

  function showGhostText(el, suggestion) {
    if (!suggestion || !el) return;
    dismissGhostText();

    const { host, wrapper } = createGhostContainer();

    // Inherit font from the focused element
    const computed = window.getComputedStyle(el);
    ghostSpan.style.font = computed.font;
    ghostSpan.style.fontSize = computed.fontSize;
    ghostSpan.style.fontFamily = computed.fontFamily;
    ghostSpan.style.letterSpacing = computed.letterSpacing;
    ghostSpan.textContent = suggestion;

    // Position near cursor
    const caret = getCaretCoordinates(el);
    wrapper.style.left = caret.x + 'px';
    wrapper.style.top = caret.y + 'px';
    wrapper.style.lineHeight = caret.height + 'px';
  }

  // ─── Accept suggestion ────────────────────────────────────────────────────
  function acceptSuggestion(el, suggestion) {
    if (!el || !suggestion) return;
    const tag = el.tagName.toLowerCase();

    if (tag === 'input' || tag === 'textarea') {
      const start = el.selectionStart || 0;
      const end = el.selectionEnd || 0;
      const value = el.value || '';
      el.value = value.substring(0, start) + suggestion + value.substring(end);
      const newPos = start + suggestion.length;
      el.setSelectionRange(newPos, newPos);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (el.isContentEditable) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(suggestion));
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    dismissGhostText();

    // Notify main process of acceptance
    if (window.blueberry) {
      window.blueberry.send('completion:request', {
        tabId: TAB_ID,
        fieldValue: '__accept__',
        cursorPosition: 0,
        fieldSelector: getCssSelector(el),
        pageUrl: window.location.href,
        pageTitle: document.title,
        _accepted: true,
      });
    }
  }

  // ─── Request completion ───────────────────────────────────────────────────
  function requestCompletion(el) {
    if (!el || !window.blueberry) return;
    const value = el.value !== undefined ? el.value : (el.textContent || '');
    if (!value.trim()) return;

    window.blueberry.send('completion:request', {
      tabId: TAB_ID,
      fieldValue: value,
      cursorPosition: el.selectionStart || 0,
      fieldLabel: el.placeholder || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || '',
      fieldSelector: getCssSelector(el),
      pageUrl: window.location.href,
      pageTitle: document.title,
    });
  }

  // ─── Listen for completion response ──────────────────────────────────────
  if (window.blueberry) {
    window.blueberry.on('completion:response', function(data) {
      if (!data || !focusedElement) return;
      // Store and display
      currentSuggestion = data.suggestion || '';
      currentRequestId = data.requestId || null;
      if (currentSuggestion) {
        showGhostText(focusedElement, currentSuggestion);
      }
    });
  }

  // ─── Focus in ────────────────────────────────────────────────────────────
  document.addEventListener('focusin', function(e) {
    const el = e.target;
    if (isTextField(el)) {
      focusedElement = el;
    }
  }, true);

  // ─── Focus out / blur ─────────────────────────────────────────────────────
  document.addEventListener('focusout', function() {
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    dismissGhostText();
    focusedElement = null;
  }, true);

  // ─── Input event (debounced) ──────────────────────────────────────────────
  document.addEventListener('input', function(e) {
    const el = e.target;
    if (!isTextField(el)) return;
    focusedElement = el;

    // Dismiss current ghost text on new input
    dismissGhostText();

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
      requestCompletion(el);
    }, 500);
  }, true);

  // ─── Keydown: Tab / Esc ───────────────────────────────────────────────────
  document.addEventListener('keydown', function(e) {
    if (!focusedElement) return;

    if (e.key === 'Tab' && currentSuggestion) {
      e.preventDefault();
      e.stopPropagation();
      acceptSuggestion(focusedElement, currentSuggestion);
      return;
    }

    if (e.key === 'Escape') {
      if (currentSuggestion) {
        e.preventDefault();
        e.stopPropagation();
        dismissGhostText();
        return;
      }
    }

    // Any other key: dismiss ghost text (new one may appear after debounce)
    if (e.key !== 'Tab' && e.key !== 'Escape' && e.key.length === 1) {
      dismissGhostText();
    }
  }, true);

  // ─── Scroll / resize: dismiss ────────────────────────────────────────────
  window.addEventListener('scroll', function() { dismissGhostText(); }, true);
  window.addEventListener('resize', function() { dismissGhostText(); });

})();
`.trim()

  return script
}
