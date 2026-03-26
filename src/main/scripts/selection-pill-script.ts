// src/main/scripts/selection-pill-script.ts
// Exports the selection pill as a self-executing JS string for injection via InjectionRegistry.
// This mirrors the TypeScript source in src/renderer/common/injected/selection-pill.ts
// but is transpiled to plain ES5-compatible JavaScript.

export const SELECTION_PILL_SCRIPT = `
(function() {
  'use strict';

  console.log('[Blueberry] Selection pill script injecting...');

  // Avoid double-injection
  if (window.__blueberrySelectionPillActive) return;
  window.__blueberrySelectionPillActive = true;

  console.log('[Blueberry] Selection pill active. window.blueberry =', typeof window.blueberry);

  // ─── State ────────────────────────────────────────────────────────────────
  var pillHost = null;
  var dismissTimer = null;

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function getContext(range) {
    var parent = range.startContainer.parentElement;
    if (!parent) return '';
    return (parent.textContent || '').trim().slice(0, 500);
  }

  function dismissPill() {
    if (!pillHost) return;
    var shadow = pillHost.shadowRoot;
    var pill = shadow && shadow.querySelector('.bb-pill');
    if (pill) {
      pill.style.opacity = '0';
      pill.style.transform = 'translateY(4px)';
      var hostRef = pillHost;
      setTimeout(function() {
        if (hostRef && hostRef.parentNode) hostRef.remove();
        if (pillHost === hostRef) pillHost = null;
      }, 150);
    } else {
      pillHost.remove();
      pillHost = null;
    }
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
  }

  function buildPill(text, rect) {
    // Remove any existing pill first
    dismissPill();

    var host = document.createElement('div');
    host.setAttribute('data-blueberry-pill', 'true');
    host.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:2147483647',
      'top:0',
      'left:0',
    ].join(';');

    var shadow = host.attachShadow({ mode: 'open' });

    var pill = document.createElement('div');
    pill.className = 'bb-pill';

    var PILL_HEIGHT = 36;
    var PILL_MARGIN = 8;

    var x = Math.max(0, rect.left + rect.width / 2);
    var y = Math.max(0, rect.top - PILL_HEIGHT - PILL_MARGIN);

    pill.style.cssText = [
      'position:fixed',
      'top:' + y + 'px',
      'left:' + x + 'px',
      'transform:translateX(-50%) translateY(4px)',
      'background:rgba(19,19,24,0.85)',
      'backdrop-filter:blur(40px)',
      '-webkit-backdrop-filter:blur(40px)',
      'border:1px solid rgba(255,255,255,0.1)',
      'border-radius:9999px',
      'box-shadow:0 4px 30px rgba(0,0,0,0.5)',
      'display:flex',
      'align-items:center',
      'gap:4px',
      'padding:4px 6px',
      'pointer-events:auto',
      'opacity:0',
      'transition:opacity 200ms ease-out,transform 200ms ease-out',
    ].join(';');

    var btnBase = [
      'font-family:-apple-system,system-ui,sans-serif',
      'font-size:13px',
      'font-weight:500',
      'color:#c2c1ff',
      'background:transparent',
      'border:none',
      'border-radius:9999px',
      'padding:4px 10px',
      'cursor:pointer',
      'line-height:1',
      'transition:background 120ms ease',
    ].join(';');

    var btnExplain = document.createElement('button');
    btnExplain.textContent = 'Explain';
    btnExplain.style.cssText = btnBase;

    var btnAsk = document.createElement('button');
    btnAsk.textContent = 'Ask AI';
    btnAsk.style.cssText = btnBase;

    function addHover(btn) {
      btn.addEventListener('mouseenter', function() {
        btn.style.background = 'rgba(194,193,255,0.12)';
      });
      btn.addEventListener('mouseleave', function() {
        btn.style.background = 'transparent';
      });
    }
    addHover(btnExplain);
    addHover(btnAsk);

    var divider = document.createElement('div');
    divider.style.cssText = [
      'width:1px',
      'height:16px',
      'background:rgba(255,255,255,0.1)',
      'flex-shrink:0',
    ].join(';');

    pill.appendChild(btnExplain);
    pill.appendChild(divider);
    pill.appendChild(btnAsk);
    shadow.appendChild(pill);

    document.documentElement.appendChild(host);
    pillHost = host;

    // Animate in
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        pill.style.opacity = '1';
        pill.style.transform = 'translateX(-50%) translateY(0)';
      });
    });

    // Auto-dismiss after 5 s
    dismissTimer = setTimeout(function() { dismissPill(); }, 5000);

    // Capture context from current selection
    var url = window.location.href;
    var sel = window.getSelection();
    var context = '';
    if (sel && sel.rangeCount > 0) {
      context = getContext(sel.getRangeAt(0));
    }

    btnExplain.addEventListener('click', function(e) {
      e.stopPropagation();
      if (window.blueberry) {
        window.blueberry.send('selection:action', {
          action: 'explain',
          text: text,
          url: url,
          context: context,
        });
      }
      dismissPill();
    });

    btnAsk.addEventListener('click', function(e) {
      e.stopPropagation();
      if (window.blueberry) {
        window.blueberry.send('selection:action', {
          action: 'ask',
          text: text,
          url: url,
          context: context,
        });
      }
      dismissPill();
    });
  }

  // ─── mouseup: detect selection ────────────────────────────────────────────
  document.addEventListener('mouseup', function() {
    setTimeout(function() {
      var sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) { dismissPill(); return; }
      var text = sel.toString().trim();
      if (text.length <= 3) { dismissPill(); return; }

      var range = sel.getRangeAt(0);
      var rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) { dismissPill(); return; }

      buildPill(text, rect);
    }, 10);
  }, true);

  // ─── Dismiss on click outside ─────────────────────────────────────────────
  document.addEventListener('mousedown', function(e) {
    if (!pillHost) return;
    var path = e.composedPath ? e.composedPath() : [];
    if (path.indexOf(pillHost) !== -1) return;
    dismissPill();
  }, true);

  // ─── Dismiss on scroll ────────────────────────────────────────────────────
  window.addEventListener('scroll', function() { dismissPill(); }, true);

  // ─── Dismiss on Esc ───────────────────────────────────────────────────────
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') dismissPill();
  }, true);

})();
`.trim()
