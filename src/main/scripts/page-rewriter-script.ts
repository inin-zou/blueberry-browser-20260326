// src/main/scripts/page-rewriter-script.ts
// Exports the page rewriter overlay as a self-executing JS string for injection via InjectionRegistry.
// Listens for 'page:rewrite' and 'page:restore' via window.blueberry.on and renders a
// Shadow DOM overlay bar at the top of the page.

export const PAGE_REWRITER_SCRIPT = `
(function() {
  'use strict';

  // Avoid double-injection
  if (window.__blueberryPageRewriterActive) return;
  window.__blueberryPageRewriterActive = true;

  // ─── State ────────────────────────────────────────────────────────────────
  var panelHost = null;
  var isExpanded = false;

  // ─── Design tokens ────────────────────────────────────────────────────────
  var BAR_BG = 'rgba(19, 19, 24, 0.95)';
  var BACKDROP_BLUR = '40px';
  var BORDER_BOTTOM = '1px solid rgba(255, 255, 255, 0.1)';
  var BADGE_BG = '#5E5CE6';
  var TEXT_TLDR = '#e4e1e9';
  var TEXT_POINTS = '#c7c4d7';
  var TOGGLE_BORDER = '1px solid rgba(255, 255, 255, 0.1)';
  var Z_INDEX = '2147483630';
  var HEIGHT_COLLAPSED = '48px';

  // ─── Page type label map ───────────────────────────────────────────────────
  var TYPE_LABELS = {
    article: 'Article',
    documentation: 'Docs',
    product: 'Product',
    dashboard: 'Dashboard',
    search: 'Search',
    form: 'Form',
    unknown: 'Page',
  };

  // ─── Remove panel ─────────────────────────────────────────────────────────
  function removePanel() {
    if (panelHost && panelHost.parentNode) {
      panelHost.remove();
    }
    panelHost = null;
    isExpanded = false;
    // Remove the margin adjustment from the page body
    document.documentElement.style.marginTop = '';
  }

  // ─── Create the overlay panel ─────────────────────────────────────────────
  function createPanel(data) {
    // Remove any existing panel first
    removePanel();

    var pageType = data.pageType || 'unknown';
    var tldr = data.tldr || '';
    var keyPoints = Array.isArray(data.keyPoints) ? data.keyPoints : [];
    var typeLabel = TYPE_LABELS[pageType] || 'Page';

    // Build shadow host
    var host = document.createElement('div');
    host.setAttribute('data-blueberry-rewriter', 'true');
    host.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'right:0',
      'width:100%',
      'z-index:' + Z_INDEX,
      'pointer-events:none',
    ].join(';');

    var shadow = host.attachShadow({ mode: 'open' });

    // ─── Bar container ────────────────────────────────────────────────────
    var bar = document.createElement('div');
    bar.className = 'bb-rewriter-bar';
    bar.style.cssText = [
      'width:100%',
      'background:' + BAR_BG,
      '-webkit-backdrop-filter:blur(' + BACKDROP_BLUR + ')',
      'backdrop-filter:blur(' + BACKDROP_BLUR + ')',
      'border-bottom:' + BORDER_BOTTOM,
      'box-sizing:border-box',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      'overflow:hidden',
      'pointer-events:auto',
      'transition:height 200ms ease',
      'height:' + HEIGHT_COLLAPSED,
    ].join(';');

    // ─── Collapsed row ────────────────────────────────────────────────────
    var row = document.createElement('div');
    row.className = 'bb-rewriter-row';
    row.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:10px',
      'padding:0 14px',
      'height:' + HEIGHT_COLLAPSED,
      'box-sizing:border-box',
    ].join(';');

    // Page type badge
    var badge = document.createElement('span');
    badge.textContent = typeLabel;
    badge.style.cssText = [
      'background:' + BADGE_BG,
      'color:#ffffff',
      'font-size:11px',
      'font-weight:500',
      'border-radius:9999px',
      'padding:2px 8px',
      'white-space:nowrap',
      'flex-shrink:0',
      'letter-spacing:0.01em',
    ].join(';');

    // TL;DR text
    var tldrEl = document.createElement('span');
    tldrEl.className = 'bb-tldr';
    tldrEl.textContent = tldr;
    tldrEl.style.cssText = [
      'color:' + TEXT_TLDR,
      'font-size:13px',
      'flex:1',
      'overflow:hidden',
      'text-overflow:ellipsis',
      'white-space:nowrap',
      'line-height:1.4',
    ].join(';');

    // Spacer
    var spacer = document.createElement('div');
    spacer.style.cssText = 'flex:0 0 auto;';

    // Toggle button
    var toggleBtn = document.createElement('button');
    toggleBtn.className = 'bb-toggle-btn';
    toggleBtn.textContent = 'Key Points';
    toggleBtn.style.cssText = [
      'background:transparent',
      'border:' + TOGGLE_BORDER,
      'border-radius:8px',
      'color:' + TEXT_TLDR,
      'font-size:11px',
      'font-family:inherit',
      'padding:4px 10px',
      'cursor:pointer',
      'white-space:nowrap',
      'flex-shrink:0',
      'transition:background 120ms ease,border-color 120ms ease',
    ].join(';');

    toggleBtn.addEventListener('mouseenter', function() {
      toggleBtn.style.background = 'rgba(255,255,255,0.06)';
      toggleBtn.style.borderColor = 'rgba(255,255,255,0.2)';
    });
    toggleBtn.addEventListener('mouseleave', function() {
      toggleBtn.style.background = 'transparent';
      toggleBtn.style.borderColor = 'rgba(255,255,255,0.1)';
    });

    // Dismiss button
    var dismissBtn = document.createElement('button');
    dismissBtn.textContent = '\\u00D7';
    dismissBtn.style.cssText = [
      'background:transparent',
      'border:none',
      'color:rgba(255,255,255,0.35)',
      'font-size:18px',
      'line-height:1',
      'padding:0 2px',
      'cursor:pointer',
      'flex-shrink:0',
      'transition:color 120ms ease',
    ].join(';');

    dismissBtn.addEventListener('mouseenter', function() {
      dismissBtn.style.color = 'rgba(255,255,255,0.75)';
    });
    dismissBtn.addEventListener('mouseleave', function() {
      dismissBtn.style.color = 'rgba(255,255,255,0.35)';
    });
    dismissBtn.addEventListener('click', function() {
      removePanel();
    });

    row.appendChild(badge);
    row.appendChild(tldrEl);
    row.appendChild(spacer);

    // ─── Key points section (collapsed by default) ────────────────────────
    var pointsSection = document.createElement('div');
    pointsSection.className = 'bb-points-section';
    pointsSection.style.cssText = [
      'padding:0 14px 12px 14px',
      'display:none',
    ].join(';');

    if (keyPoints.length > 0) {
      row.appendChild(toggleBtn);

      var ul = document.createElement('ul');
      ul.style.cssText = [
        'list-style:none',
        'margin:0',
        'padding:0',
        'display:flex',
        'flex-direction:column',
        'gap:6px',
      ].join(';');

      keyPoints.forEach(function(point) {
        var li = document.createElement('li');
        li.style.cssText = [
          'display:flex',
          'align-items:flex-start',
          'gap:8px',
          'color:' + TEXT_POINTS,
          'font-size:13px',
          'line-height:1.5',
        ].join(';');

        var dot = document.createElement('span');
        dot.style.cssText = [
          'width:6px',
          'height:6px',
          'border-radius:50%',
          'background:' + BADGE_BG,
          'flex-shrink:0',
          'margin-top:5px',
        ].join(';');

        var text = document.createElement('span');
        text.textContent = point;

        li.appendChild(dot);
        li.appendChild(text);
        ul.appendChild(li);
      });

      pointsSection.appendChild(ul);

      // Toggle expand/collapse
      toggleBtn.addEventListener('click', function() {
        isExpanded = !isExpanded;
        if (isExpanded) {
          pointsSection.style.display = 'block';
          var expandedHeight = HEIGHT_COLLAPSED;
          // Measure natural height after display:block
          bar.style.height = 'auto';
          toggleBtn.textContent = 'Hide Points';
          tldrEl.style.whiteSpace = 'normal';
        } else {
          pointsSection.style.display = 'none';
          bar.style.height = HEIGHT_COLLAPSED;
          toggleBtn.textContent = 'Key Points';
          tldrEl.style.whiteSpace = 'nowrap';
        }
      });
    }

    row.appendChild(dismissBtn);

    bar.appendChild(row);
    bar.appendChild(pointsSection);
    shadow.appendChild(bar);
    document.documentElement.appendChild(host);
    panelHost = host;
  }

  // ─── Listen for commands from main process ────────────────────────────────
  if (window.blueberry) {
    window.blueberry.on('page:rewrite', function(data) {
      createPanel(data);
    });

    window.blueberry.on('page:restore', function() {
      removePanel();
    });
  }

})();
`.trim()
