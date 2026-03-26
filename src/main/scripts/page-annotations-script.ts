// src/main/scripts/page-annotations-script.ts
// Exports the page annotations injected script as a JS string constant.
// Injected via InjectionRegistry on dom-ready; listens for 'attention:command'
// via window.blueberry.on and renders Shadow DOM annotations on the page.

export const PAGE_ANNOTATIONS_SCRIPT = `
(function() {
  'use strict';

  // Avoid double-injection
  if (window.__blueberryPageAnnotationsActive) return;
  window.__blueberryPageAnnotationsActive = true;

  // ─── State ────────────────────────────────────────────────────────────────
  var annotations = []; // { id, host, timer }
  var MAX_ANNOTATIONS = 3;
  var AUTO_DISMISS_MS = 30000;
  var FADE_IN_MS = 500;
  var FADE_OUT_MS = 200;

  // ─── Design tokens ────────────────────────────────────────────────────────
  var HIGHLIGHT_BG = 'rgba(94, 92, 230, 0.08)';
  var HIGHLIGHT_BORDER = '2px solid rgba(94, 92, 230, 0.3)';
  var BORDER_RADIUS = '4px';
  var Z_INDEX = '2147483640';

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function removeAnnotation(id, host) {
    // Fade out
    var shadow = host.shadowRoot;
    var overlay = shadow && shadow.querySelector('.bb-annotation-overlay');
    if (overlay) {
      overlay.style.transition = 'opacity ' + FADE_OUT_MS + 'ms ease-in';
      overlay.style.opacity = '0';
    }
    var hostRef = host;
    setTimeout(function() {
      if (hostRef && hostRef.parentNode) hostRef.remove();
    }, FADE_OUT_MS);

    // Remove from tracking array
    annotations = annotations.filter(function(a) { return a.id !== id; });
  }

  function sendDismiss(annotationId) {
    if (window.blueberry) {
      window.blueberry.send('attention:signal', {
        type: 'annotation:dismissed',
        annotationId: annotationId,
      });
    }
  }

  function buildDismissButton(shadow, id, host) {
    var btn = document.createElement('button');
    btn.className = 'bb-dismiss';
    btn.textContent = '\\u00D7'; // ×
    btn.style.cssText = [
      'position:absolute',
      'top:2px',
      'right:4px',
      'background:transparent',
      'border:none',
      'cursor:pointer',
      'font-size:16px',
      'line-height:1',
      'padding:0 2px',
      'color:rgba(255,255,255,0.4)',
      'transition:color 120ms ease',
      'z-index:1',
    ].join(';');

    btn.addEventListener('mouseenter', function() {
      btn.style.color = 'rgba(255,255,255,0.8)';
    });
    btn.addEventListener('mouseleave', function() {
      btn.style.color = 'rgba(255,255,255,0.4)';
    });

    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      sendDismiss(id);
      var entry = annotations.find(function(a) { return a.id === id; });
      if (entry && entry.timer) clearTimeout(entry.timer);
      removeAnnotation(id, host);
    });

    shadow.appendChild(btn);
  }

  function createHighlightOverlay(cmd) {
    var targetEl = null;

    // Try to find element by selector first
    if (cmd.selector) {
      try {
        targetEl = document.querySelector(cmd.selector);
      } catch (e) {
        targetEl = null;
      }
    }

    // Fall back to element at position
    if (!targetEl && cmd.position) {
      targetEl = document.elementFromPoint(cmd.position.x, cmd.position.y);
    }

    // Compute bounding rect
    var rect = null;
    if (targetEl && targetEl !== document.documentElement && targetEl !== document.body) {
      rect = targetEl.getBoundingClientRect();
    } else if (cmd.position) {
      // Create a small rect around the position if no element found
      rect = {
        left: cmd.position.x - 60,
        top: cmd.position.y - 20,
        width: 120,
        height: 40,
      };
    }

    if (!rect) return null;

    // Build shadow host — positioned fixed over the target
    var host = document.createElement('div');
    host.setAttribute('data-blueberry-annotation', cmd.id);
    host.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:' + Z_INDEX,
      'top:0',
      'left:0',
    ].join(';');

    var shadow = host.attachShadow({ mode: 'open' });

    var overlay = document.createElement('div');
    overlay.className = 'bb-annotation-overlay';
    overlay.style.cssText = [
      'position:fixed',
      'left:' + Math.round(rect.left) + 'px',
      'top:' + Math.round(rect.top) + 'px',
      'width:' + Math.round(rect.width) + 'px',
      'height:' + Math.round(rect.height) + 'px',
      'background:' + HIGHLIGHT_BG,
      'border-left:' + HIGHLIGHT_BORDER,
      'border-radius:' + BORDER_RADIUS,
      'pointer-events:auto',
      'opacity:0',
      'transition:opacity ' + FADE_IN_MS + 'ms ease-out',
    ].join(';');

    shadow.appendChild(overlay);

    // Add dismiss button (pointer-events need to work inside shadow DOM)
    host.style.pointerEvents = 'none';
    overlay.style.pointerEvents = 'auto';

    buildDismissButton(shadow, cmd.id, host);

    document.documentElement.appendChild(host);

    // Fade in
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        overlay.style.opacity = '1';
      });
    });

    return host;
  }

  // ─── Main handler ─────────────────────────────────────────────────────────
  function handleAnnotationCommand(cmd) {
    if (!cmd || !cmd.id || !cmd.type) return;

    // Enforce maximum visible annotations — remove oldest
    if (annotations.length >= MAX_ANNOTATIONS) {
      var oldest = annotations[0];
      if (oldest.timer) clearTimeout(oldest.timer);
      removeAnnotation(oldest.id, oldest.host);
    }

    var host = null;

    if (cmd.type === 'highlight') {
      host = createHighlightOverlay(cmd);
    }
    // margin-note and simplification reserved for future phases

    if (!host) return;

    // Auto-dismiss after 30 seconds
    var timer = setTimeout(function() {
      removeAnnotation(cmd.id, host);
    }, AUTO_DISMISS_MS);

    annotations.push({ id: cmd.id, host: host, timer: timer });
  }

  // ─── Listen for commands from main process ────────────────────────────────
  if (window.blueberry) {
    window.blueberry.on('attention:command', function(cmd) {
      handleAnnotationCommand(cmd);
    });
  }

})();
`.trim()
