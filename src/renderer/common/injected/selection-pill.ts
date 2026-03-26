// src/renderer/common/injected/selection-pill.ts
// This file is NOT imported by any renderer or main process module directly.
// Its content is mirrored as a JS string in src/main/scripts/selection-pill-script.ts
// and injected into tab web contents via InjectionRegistry.
//
// It runs in the page context (no Node / Electron imports allowed).
// window.blueberry.send() is provided by src/preload/tab.ts.

(function () {
  'use strict';

  // Avoid double-injection
  if ((window as any).__blueberrySelectionPillActive) return;
  (window as any).__blueberrySelectionPillActive = true;

  // ─── State ────────────────────────────────────────────────────────────────
  let pillHost: HTMLElement | null = null;
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function getContext(range: Range): string {
    const parent = range.startContainer.parentElement;
    if (!parent) return '';
    return (parent.textContent || '').trim().slice(0, 500);
  }

  function dismissPill(): void {
    if (!pillHost) return;
    const shadow = pillHost.shadowRoot;
    const pill = shadow?.querySelector('.bb-pill') as HTMLElement | null;
    if (pill) {
      pill.style.opacity = '0';
      pill.style.transform = 'translateY(4px)';
      setTimeout(() => {
        pillHost?.remove();
        pillHost = null;
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

  function buildPill(text: string, rect: DOMRect): void {
    // Remove any existing pill
    dismissPill();

    const host = document.createElement('div');
    host.setAttribute('data-blueberry-pill', 'true');
    host.style.cssText = [
      'position: fixed',
      'pointer-events: none',
      'z-index: 2147483647',
      'top: 0',
      'left: 0',
    ].join(';');

    const shadow = host.attachShadow({ mode: 'open' });

    const pill = document.createElement('div');
    pill.className = 'bb-pill';

    const PILL_HEIGHT = 36;
    const PILL_MARGIN = 8;

    const x = Math.max(0, rect.left + rect.width / 2);
    const y = Math.max(0, rect.top - PILL_HEIGHT - PILL_MARGIN);

    pill.style.cssText = [
      'position: fixed',
      `top: ${y}px`,
      `left: ${x}px`,
      'transform: translateX(-50%) translateY(4px)',
      'background: rgba(19, 19, 24, 0.85)',
      'backdrop-filter: blur(40px)',
      '-webkit-backdrop-filter: blur(40px)',
      'border: 1px solid rgba(255, 255, 255, 0.1)',
      'border-radius: 9999px',
      'box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5)',
      'display: flex',
      'align-items: center',
      'gap: 4px',
      'padding: 4px 6px',
      'pointer-events: auto',
      'opacity: 0',
      'transition: opacity 200ms ease-out, transform 200ms ease-out',
    ].join(';');

    const btnBase = [
      'font-family: -apple-system, system-ui, sans-serif',
      'font-size: 13px',
      'font-weight: 500',
      'color: #c2c1ff',
      'background: transparent',
      'border: none',
      'border-radius: 9999px',
      'padding: 4px 10px',
      'cursor: pointer',
      'line-height: 1',
      'transition: background 120ms ease',
    ].join(';');

    const btnExplain = document.createElement('button');
    btnExplain.textContent = 'Explain';
    btnExplain.style.cssText = btnBase;

    const btnAsk = document.createElement('button');
    btnAsk.textContent = 'Ask AI';
    btnAsk.style.cssText = btnBase;

    const addHover = (btn: HTMLButtonElement) => {
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(194, 193, 255, 0.12)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
      });
    };
    addHover(btnExplain);
    addHover(btnAsk);

    const divider = document.createElement('div');
    divider.style.cssText = [
      'width: 1px',
      'height: 16px',
      'background: rgba(255, 255, 255, 0.1)',
      'flex-shrink: 0',
    ].join(';');

    pill.appendChild(btnExplain);
    pill.appendChild(divider);
    pill.appendChild(btnAsk);
    shadow.appendChild(pill);

    document.documentElement.appendChild(host);
    pillHost = host;

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        pill.style.opacity = '1';
        pill.style.transform = 'translateX(-50%) translateY(0)';
      });
    });

    // Auto-dismiss after 5s
    dismissTimer = setTimeout(() => dismissPill(), 5000);

    // Button click handlers
    const url = window.location.href;
    const context = getContext(window.getSelection()!.getRangeAt(0));

    btnExplain.addEventListener('click', (e) => {
      e.stopPropagation();
      if ((window as any).blueberry) {
        (window as any).blueberry.send('selection:action', {
          action: 'explain',
          text,
          url,
          context,
        });
      }
      dismissPill();
    });

    btnAsk.addEventListener('click', (e) => {
      e.stopPropagation();
      if ((window as any).blueberry) {
        (window as any).blueberry.send('selection:action', {
          action: 'ask',
          text,
          url,
          context,
        });
      }
      dismissPill();
    });
  }

  // ─── mouseup: detect selection ────────────────────────────────────────────
  document.addEventListener('mouseup', (e) => {
    // Small delay so the browser finalises the selection
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        dismissPill();
        return;
      }
      const text = sel.toString().trim();
      if (text.length <= 3) {
        dismissPill();
        return;
      }

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        dismissPill();
        return;
      }

      buildPill(text, rect);
    }, 10);
  }, true);

  // ─── Dismiss on click outside ─────────────────────────────────────────────
  document.addEventListener('mousedown', (e) => {
    if (!pillHost) return;
    // Check if click is inside the shadow host
    if (e.composedPath().includes(pillHost)) return;
    dismissPill();
  }, true);

  // ─── Dismiss on scroll ────────────────────────────────────────────────────
  window.addEventListener('scroll', () => dismissPill(), true);

  // ─── Dismiss on Esc ───────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dismissPill();
  }, true);
})();
