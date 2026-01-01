import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "https://unpkg.com/three@0.160.0/examples/jsm/renderers/CSS2DRenderer.js";
import { decodeRouteToken, getWaypointTypeLabel } from "./route-decoder.js";

// --- Debug logging helper --------------------------------------------------
// Check if debug mode is enabled via URL query parameter (?debug=true)
const DEBUG_ENABLED = (() => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("debug") === "true";
  } catch {
    return false;
  }
})();

// Debug panel visibility can be toggled at runtime via the UI button or keyboard.
 // Initialize visible state from URL param, but allow toggling to override it.
let DEBUG_VISIBLE = DEBUG_ENABLED;

function _makeDebugPanel() {
  try {
    let panel = document.getElementById("debug-log");
    if (!panel) {
      panel = document.createElement("pre");
      panel.id = "debug-log";
      panel.style.position = "fixed";
      panel.style.right = "8px";
      panel.style.bottom = "8px";
      panel.style.maxHeight = "40vh";
      panel.style.overflow = "auto";
      panel.style.background = "rgba(0,0,0,0.6)";
      panel.style.color = "#0f0";
      panel.style.fontSize = "11px";
      panel.style.padding = "6px";
      panel.style.minWidth = "220px";
      panel.style.minHeight = "80px";
      panel.style.border = "1px solid rgba(255,140,60,0.2)";
      panel.style.zIndex = 99999;
      panel.style.whiteSpace = "pre-wrap";
      panel.setAttribute("role", "log");
      panel.setAttribute("aria-live", "polite");
      // Add a small visually-friendly header so the panel is obvious when shown
      const hdr = document.createElement("div");
      hdr.className = 'debug-header';
      hdr.textContent = "Debug Log — Ctrl+Shift+D to toggle";
      hdr.style.fontSize = "12px";
      hdr.style.fontWeight = "600";
      hdr.style.marginBottom = "6px";
      hdr.style.color = "#ffdca3";
      panel.appendChild(hdr);
      document.body.appendChild(panel);
    } else {
      // If an inline fallback created the panel before the module loaded, remove
      // the placeholder text and ensure the module header is present so we can
      // take over cleanly.
      try {
        // Remove any initial text nodes left by the inline fallback
        for (const node of Array.from(panel.childNodes)) {
          if (node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.includes('Debug (fallback)')) {
            panel.removeChild(node);
          }
        }
        // Ensure header exists
        if (!panel.querySelector('.debug-header')) {
          const hdr = document.createElement('div');
          hdr.className = 'debug-header';
          hdr.textContent = 'Debug Log — Ctrl+Shift+D to toggle';
          hdr.style.fontSize = '12px';
          hdr.style.fontWeight = '600';
          hdr.style.marginBottom = '6px';
          hdr.style.color = '#ffdca3';
          panel.insertBefore(hdr, panel.firstChild);
        }
      } catch (e) {
        /* best-effort cleanup; ignore errors */
      }
    }

    // Control visibility: prefer the runtime-visible flag so user toggles override
    // the URL `?debug=true` parameter. DEBUG_VISIBLE is initialized from the
    // URL but can be changed via the button/keyboard.
    const visible = Boolean(DEBUG_VISIBLE);
    panel.style.display = visible ? "block" : "none";
    panel.setAttribute("aria-hidden", visible ? "false" : "true");
    return panel;
  } catch {
    return null;
  }
}

function showDebugPanel() {
  DEBUG_VISIBLE = true;
  const p = _makeDebugPanel();
  if (p) p.style.display = "block";
  // Provide immediate feedback in the panel and console
  debugLog("debug panel: shown");
  const btn = document.getElementById("tool-debug");
  if (btn) btn.setAttribute("aria-pressed", "true");
}

function hideDebugPanel() {
  DEBUG_VISIBLE = false;
  const p = _makeDebugPanel();
  if (p) p.style.display = "none";
  debugLog("debug panel: hidden");
  const btn = document.getElementById("tool-debug");
  if (btn) btn.setAttribute("aria-pressed", "false");
}

function toggleDebugPanel() {
  const p = _makeDebugPanel();
  // Use computed style to determine visibility reliably (handles cases where
  // inline `style.display` may be empty but computed style is 'none')
  const isShown = p && window.getComputedStyle(p).display !== "none";
  if (isShown) hideDebugPanel();
  else showDebugPanel();
}

// Expose for HTML onclick fallback and console debugging
window.toggleDebugPanel = toggleDebugPanel;
window.showDebugPanel = showDebugPanel;
window.hideDebugPanel = hideDebugPanel;

function debugLog(...args) {
  try {
    if (DEBUG_ENABLED) {
      console.log(...args);
    }
    const panel = _makeDebugPanel();
    if (panel) {
      const ts = new Date().toISOString();
      panel.textContent +=
        ts +
        " " +
        args
          .map((a) => {
            try {
              return typeof a === "string" ? a : JSON.stringify(a);
            } catch {
              return String(a);
            }
          })
          .join(" ") +
        "\n";
      panel.scrollTop = panel.scrollHeight;
    }
  } catch {
    // best-effort
  }
}

window.addEventListener("error", (ev) => {
  try {
    debugLog("window.error:", ev.message || ev);
  } catch {
    /* ignore logging errors */
  }
});
window.addEventListener("unhandledrejection", (ev) => {
  try {
    debugLog("unhandledrejection:", ev.reason || ev);
  } catch {
    /* ignore logging errors */
  }
});

// Wire up the debug toggle button (if present) and add keyboard shortcut
try {
  // Button toggles debug panel visibility
  const dbgBtn = document.getElementById("tool-debug");
  if (dbgBtn) {
    // Prevent pointer events from reaching the canvas beneath the UI
    const _stop = (ev) => {
      try {
        ev.stopPropagation();
        if (ev.cancelable) ev.preventDefault();
      } catch (e) {
        /* ignore */
      }
    };
    // Attach to common pointer / mouse / touch events so drags & clicks don't fall through
    dbgBtn.addEventListener('pointerdown', _stop, { passive: false });
    dbgBtn.addEventListener('mousedown', _stop, { passive: false });
    dbgBtn.addEventListener('touchstart', _stop, { passive: false });
    // Also ensure the whole tool panel captures pointer events
    try {
      const panel = document.getElementById('tool-panel');
      if (panel) {
        panel.addEventListener('pointerdown', _stop, { passive: false });
      }
    } catch (e) {
      /* ignore */
    }
    // If an inline `onclick` fallback exists (for very early clicks before the
    // module loads), remove it now that the module has initialized to avoid
    // duplicate click handling between the inline handler and this listener.
    try {
      if (dbgBtn.getAttribute && dbgBtn.getAttribute("onclick")) {
        try {
          dbgBtn.removeAttribute("onclick");
        } catch (err) {}
        // Also clear any legacy `onclick` property that the browser may have set
        try {
          dbgBtn.onclick = null;
        } catch (err) {}
      }
    } catch (err) {
      /* ignore */
    }

    dbgBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      // Avoid double-handling clicks when an inline onclick fallback already
      // performed the toggle (inline handlers run before addEventListener). If
      // the inline handler set a recent flag, skip handling here.
      try {
        if (window.__lastDebugClick && Date.now() - window.__lastDebugClick < 250) {
          // Clear the marker so future clicks are handled normally
          window.__lastDebugClick = null;
          return;
        }
      } catch (err) {
        /* ignore */
      }
      try {
        // Mark that the module-handled click occurred so any inline fallback
        // handler can skip its own toggle to avoid double-handling.
        try { dbgBtn.setAttribute('data-handled-by-module', String(Date.now())); } catch (err) {}
        toggleDebugPanel();
        // Clear the marker after a short delay to keep state clean
        setTimeout(() => { try { dbgBtn.removeAttribute('data-handled-by-module'); } catch (err) {} }, 250);
      } catch (err) {
        console.error("toggleDebugPanel failed:", err);
        // Best-effort: ensure a visible panel exists so the user can see errors
        try {
          let p = document.getElementById("debug-log");
          if (!p) {
            p = document.createElement("pre");
            p.id = "debug-log";
            p.style.position = "fixed";
            p.style.right = "8px";
            p.style.bottom = "8px";
            p.style.background = "rgba(0,0,0,0.75)";
            p.style.color = "#0f0";
            p.style.padding = "8px";
            p.style.minWidth = "220px";
            p.style.minHeight = "80px";
            p.style.zIndex = 99999;
            document.body.appendChild(p);
          }
          p.style.display = "block";
          p.textContent += "toggleDebugPanel failed: " + String(err) + "\n";
        } catch (err2) {
          console.error("Failed to create fallback debug panel:", err2);
        }
      }
    });
  }

  // Keyboard shortcut: Ctrl+Shift+D toggles debug panel
  window.addEventListener("keydown", (ev) => {
    // Ignore if typing in input or textarea
    const tag = (ev.target && ev.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (ev.ctrlKey && ev.shiftKey && ev.code === "KeyD") {
      ev.preventDefault();
      try {
        toggleDebugPanel();
      } catch (err) {
        console.error("toggleDebugPanel failed (keyboard):", err);
      }
    }
  });
} catch (e) {
  debugLog("debug toggle wiring failed", e);
}

debugLog("module loaded", {
  href: typeof location !== "undefined" ? location.href : null,
  ua: navigator.userAgent,
});

const DATA_BASE = "/data/";
const VERSION_KEY = "starmap_data_version_v1"; // bump if data format changes

// Cache-bust parameter (will be populated after loading build-info)
let cacheVersion = "";

// Load build info for cache-busting
async function loadBuildInfo() {
  try {
    const response = await fetch("/build-info.json", { cache: "no-store" });
    if (!response.ok) {
      debugLog("Could not load build-info.json: HTTP", response.status);
      return;
    }

    const contentType =
      (response.headers && response.headers.get("content-type")) || "";
    const bodyText = await response.text();

    if (!contentType.includes("application/json")) {
      debugLog("build-info.json not JSON; skipping cache bust", {
        contentType,
        preview: bodyText.slice(0, 120),
      });
      return;
    }

    let buildInfo;
    try {
      buildInfo = JSON.parse(bodyText);
    } catch (parseErr) {
      debugLog(
        "Could not parse build-info.json; skipping cache bust",
        parseErr,
      );
      return;
    }

    cacheVersion = buildInfo.commit;
    debugLog("Build info loaded", buildInfo);
  } catch (e) {
    debugLog("Could not load build-info.json:", e);
    console.error("Build info fetch error:", e);
  }
}

// Helper to add cache-bust param to URLs
function cacheBustUrl(path) {
  const result = cacheVersion ? path + "?v=" + cacheVersion : path;
  return result;
}

function extractDataRelease(manifest) {
  if (!manifest || typeof manifest !== "object") return null;
  const meta = manifest.meta || manifest.metadata;
  const candidates = [
    manifest.release,
    manifest.version,
    manifest.data_release,
    manifest.dataset,
    manifest.dataset_version,
    manifest.tag,
    manifest.rev,
    manifest.revision,
    manifest.build,
    meta && meta.release,
    meta && meta.version,
    meta && meta.tag,
    meta && meta.rev,
    meta && meta.revision,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function setDataReleaseBadge(text) {
  try {
    let badge = document.getElementById("data-release");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "data-release";
      badge.setAttribute("aria-live", "polite");
      badge.setAttribute("role", "status");
      document.body.appendChild(badge);
    }
    badge.textContent = text;
  } catch (e) {
    debugLog("setDataReleaseBadge error", e);
  }
}

function setOverlayText(text) {
  try {
    const overlay = document.getElementById("overlay");
    if (overlay) {
      overlay.textContent = text;
    }
  } catch (e) {
    debugLog("setOverlayText error", e);
  }
}

function makeGlowSprite(color = 0xffaa00, size = 128) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grd = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  grd.addColorStop(0.0, "rgba(255, 200, 120, 0.7)");
  grd.addColorStop(0.35, "rgba(255, 170, 60, 0.45)");
  grd.addColorStop(1.0, "rgba(255, 140, 30, 0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.9,
    sizeAttenuation: false, // Keep constant screen size regardless of distance
  });
  const sprite = new THREE.Sprite(material);
  sprite.visible = false;
  sprite.frustumCulled = false;
  return sprite;
}

// --- Tiny helper to load binary files into typed arrays ----------------------
// Guard so that if a second copy of the script is parsed (e.g., in some
// production deployments where both `src/main.js` and `public/src/main.js`
