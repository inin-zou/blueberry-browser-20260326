// src/main/scripts/rrweb-capture-script.ts
// Injects rrweb recording into tabs. Events are sent to main process via IPC bridge.
// Uses a CDN-loaded rrweb since we can't bundle Node modules into page context.

export const RRWEB_CAPTURE_SCRIPT = `
(function() {
  'use strict';
  if (window.__blueberryRrwebActive) return;
  window.__blueberryRrwebActive = true;

  // Load rrweb from CDN
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/rrweb@2.0.0-alpha.13/dist/rrweb-all.min.js';
  script.onload = function() {
    if (!window.rrweb || !window.rrweb.record) {
      console.warn('[Blueberry] rrweb loaded but record not found');
      return;
    }

    // Throttle: batch events and send every 100ms max
    var eventBuffer = [];
    var flushTimer = null;

    function flushEvents() {
      if (eventBuffer.length === 0) return;
      var events = eventBuffer;
      eventBuffer = [];
      for (var i = 0; i < events.length; i++) {
        if (window.blueberry) {
          window.blueberry.send('rrweb:event', events[i]);
        }
      }
    }

    window.rrweb.record({
      emit: function(event) {
        // Only send IncrementalSnapshot (type 3) and Meta (type 4) events
        // Skip FullSnapshot (type 2) — too large for IPC
        if (event.type === 3 || event.type === 4) {
          eventBuffer.push(event);
          if (!flushTimer) {
            flushTimer = setTimeout(function() {
              flushTimer = null;
              flushEvents();
            }, 100);
          }
        }
      },
      sampling: {
        mousemove: 50,      // sample mouse moves every 50ms
        mouseInteraction: true,
        scroll: 100,         // sample scroll every 100ms
        input: 'last',       // only capture last input value
      },
      recordCanvas: false,
      recordCrossOriginIframes: false,
      collectFonts: false,
    });

    console.log('[Blueberry] rrweb recording started');
  };
  script.onerror = function() {
    console.warn('[Blueberry] Failed to load rrweb from CDN');
  };
  document.head.appendChild(script);
})();
`;
