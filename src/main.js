import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'https://unpkg.com/three@0.160.0/examples/jsm/renderers/CSS2DRenderer.js';
import { decodeRouteToken, getWaypointTypeLabel } from './route-decoder.js';

// --- Debug logging helper --------------------------------------------------
// Check if debug mode is enabled via URL query parameter (?debug=true)
const DEBUG_ENABLED = (() => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('debug') === 'true';
  } catch (e) {
    return false;
  }
})();

function _makeDebugPanel(){
  if (!DEBUG_ENABLED) return null;
  try {
    let panel = document.getElementById('debug-log');
    if (!panel) {
      panel = document.createElement('pre');
      panel.id = 'debug-log';
      panel.style.position = 'fixed';
      panel.style.right = '8px';
      panel.style.bottom = '8px';
      panel.style.maxHeight = '40vh';
      panel.style.overflow = 'auto';
      panel.style.background = 'rgba(0,0,0,0.6)';
      panel.style.color = '#0f0';
      panel.style.fontSize = '11px';
      panel.style.padding = '6px';
      panel.style.zIndex = 99999;
      panel.style.whiteSpace = 'pre-wrap';
      document.body.appendChild(panel);
    }
    return panel;
  } catch (e) {
    return null;
  }
}

function debugLog(...args){
  try {
    if (DEBUG_ENABLED) {
      console.log(...args);
    }
    const panel = _makeDebugPanel();
    if (panel) {
      const ts = new Date().toISOString();
      panel.textContent += ts + ' ' + args.map(a => {
        try { return typeof a === 'string' ? a : JSON.stringify(a); } catch(e){ return String(a); }
      }).join(' ') + '\n';
      panel.scrollTop = panel.scrollHeight;
    }
  } catch (e) {
    // best-effort
  }
}

window.addEventListener('error', (ev) => {
  try { debugLog('window.error:', ev.message || ev); } catch(e){ /* ignore logging errors */ }
});
window.addEventListener('unhandledrejection', (ev) => {
  try { debugLog('unhandledrejection:', ev.reason || ev); } catch(e){ /* ignore logging errors */ }
});

debugLog('module loaded', { href: typeof location !== 'undefined' ? location.href : null, ua: navigator.userAgent });

const DATA_BASE = './data/';
const VERSION_KEY = 'starmap_data_version_v1'; // bump if data format changes

// --- Tiny helper to load binary files into typed arrays ----------------------
async function fetchArrayBuffer(path) {
  debugLog('fetchArrayBuffer:', path);
  const res = await fetch(path);
  debugLog('fetch response:', path, { ok: res.ok, status: res.status });
  if (!res.ok) throw new Error('Failed to fetch ' + path + ' (status=' + res.status + ')');
  const buf = await res.arrayBuffer();
  debugLog('fetched bytes:', path, buf.byteLength);
  return buf;
}

async function loadData() {
  // (Optional) you could store in IndexedDB; to keep this minimal, we just fetch
  // and set a flag in localStorage so you could later skip refetching or rely on HTTP cache.
  if (!localStorage.getItem(VERSION_KEY)) {
    localStorage.setItem(VERSION_KEY, String(Date.now()));
  }
  // Try to fetch the real binary data; if any fetch fails (for example while
  // developing locally without the binary blobs), fall back to generated demo
  // data so the scene still renders.
  debugLog('loadData: fetching manifest and binary blobs...');
  const [manifest, posBuf, idsBuf, namesRes, jumpsBuf, stationsBuf] = await Promise.all([
    fetch(DATA_BASE + 'manifest.json').then(r => r.json()),
    fetchArrayBuffer(DATA_BASE + 'systems_positions.bin'),
    fetchArrayBuffer(DATA_BASE + 'systems_ids.bin'),
    fetch(DATA_BASE + 'systems_names.json').then(r => r.json()),
    fetchArrayBuffer(DATA_BASE + 'jumps.bin'),
    fetchArrayBuffer(DATA_BASE + 'systems_with_stations.bin')
  ]);

  // The binary data is in native (little-endian) format from Python array.tobytes()
  // We can use TypedArray constructors directly (they default to little-endian)
  debugLog('loadData: parsing binary data (native little-endian)');
  const positions = new Float32Array(posBuf);
  const ids = new Uint32Array(idsBuf);
  const jumps = new Uint32Array(jumpsBuf);
  const stationSystemIds = new Uint32Array(stationsBuf);
  const idToName = namesRes;
  
  // Build set of station system IDs for quick lookup
  const stationSystemSet = new Set(stationSystemIds);
  debugLog('loadData: loaded station systems', { stationCount: stationSystemIds.length });

  // Apply coordinate transform from manifest: (x,y,z) -> (x,z,-y)
  // This is Rx(-90deg) rotation to convert from data space to three.js space
  debugLog('loadData: applying coordinate transform Rx(-90deg)');
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i + 0];
    const y = positions[i + 1];
    const z = positions[i + 2];
    positions[i + 0] = x;
    positions[i + 1] = z;
    positions[i + 2] = -y;
  }

  debugLog('loadData: typed arrays created', {
    positionsLength: positions.length,
    idsLength: ids.length,
    jumpsLength: jumps.length,
    namesCount: Object.keys(idToName).length,
    firstPositions: [positions[0], positions[1], positions[2], positions[3], positions[4], positions[5]],
    firstIds: [ids[0], ids[1], ids[2]]
  });

  // Build an index: systemId -> index (0..N-1)
  const indexOf = new Map();
  for (let i=0;i<ids.length;i++) indexOf.set(ids[i], i);

  debugLog('loadData: complete');
  return {manifest, positions, ids, idToName, jumps, indexOf, stationSystemSet};
}

function computeBounds(positions) {
  debugLog('computeBounds: computing for', positions.length, 'floats');
  const b = {min:[+Infinity,+Infinity,+Infinity], max:[-Infinity,-Infinity,-Infinity]};
  for (let i=0;i<positions.length;i+=3) {
    for (let k=0;k<3;k++) {
      const v = positions[i+k];
      if (v < b.min[k]) b.min[k] = v;
      if (v > b.max[k]) b.max[k] = v;
    }
  }
  const center = [(b.min[0]+b.max[0])/2, (b.min[1]+b.max[1])/2, (b.min[2]+b.max[2])/2];
  const size = [b.max[0]-b.min[0], b.max[1]-b.min[1], b.max[2]-b.min[2]];
  const radius = Math.hypot(size[0], size[1], size[2]) * 0.5;
  debugLog('computeBounds: result', {center, radius, min: b.min, max: b.max});
  return {bounds:b, center, radius};
}

function makeStarfield(positions, ids, stationSystemSet) {
  debugLog('makeStarfield: creating Points for', positions.length / 3, 'stars');
  
  const group = new THREE.Group();
  
  // Separate positions and colors for regular and station systems
  const regularPositions = [];
  const regularColors = [];
  const regularIndices = []; // Map back to original data index
  const stationPositions = [];
  const stationColors = [];
  const stationIndices = []; // Map back to original data index
  
  for (let i = 0; i < ids.length; i++) {
    const systemId = ids[i];
    const hasStation = stationSystemSet.has(systemId);
    const posIdx = i * 3;
    
    const x = positions[posIdx];
    const y = positions[posIdx + 1];
    const z = positions[posIdx + 2];
    
    if (hasStation) {
      // Bright red for station systems
      stationPositions.push(x, y, z);
      stationColors.push(1.0, 0.0, 0.0); // Pure red
      stationIndices.push(i); // Store original index
    } else {
      // Orange for regular systems
      regularPositions.push(x, y, z);
      regularColors.push(1.0, 0.278, 0.0); // Orange
      regularIndices.push(i); // Store original index
    }
  }
  
  // Create regular systems points
  if (regularPositions.length > 0) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(regularPositions), 3));
    geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(regularColors), 3));
    
    const mat = new THREE.PointsMaterial({
      size: 2.5,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    const pts = new THREE.Points(geom, mat);
    pts.frustumCulled = false;
    pts.userData.indexMap = regularIndices; // Store mapping
    group.add(pts);
  }
  
  // Create station systems points (larger, red)
  if (stationPositions.length > 0) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(stationPositions), 3));
    geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(stationColors), 3));
    
    const mat = new THREE.PointsMaterial({
      size: 7.5, // 3x larger
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    const pts = new THREE.Points(geom, mat);
    pts.frustumCulled = false;
    pts.userData.indexMap = stationIndices; // Store mapping
    group.add(pts);
  }
  
  debugLog('makeStarfield: created', regularPositions.length / 3, 'regular stars and', stationPositions.length / 3, 'station stars');
  return group;
}

function makeJumpLines(jumps, indexOf, positions) {
  // Build a LineSegments geometry; give vertex colors equal to endpoint colors
  // Note: for true gradient, vertexColors works: each 2-vertex segment will interpolate.
  const segCount = Math.floor(jumps.length / 2);
  const linePos = new Float32Array(segCount * 2 * 3);
  const lineCol = new Float32Array(segCount * 2 * 3);

  let w = 0;
  for (let i=0;i<jumps.length; i+=2) {
    const aId = jumps[i];
    const bId = jumps[i+1];
    const ai = indexOf.get(aId);
    const bi = indexOf.get(bId);
    if (ai === undefined || bi === undefined) continue;
    const ax = positions[ai*3+0], ay = positions[ai*3+1], az = positions[ai*3+2];
    const bx = positions[bi*3+0], by = positions[bi*3+1], bz = positions[bi*3+2];

    linePos[w++] = ax; linePos[w++] = ay; linePos[w++] = az;
    linePos[w++] = bx; linePos[w++] = by; linePos[w++] = bz;
  }
  // Trim if any missing
  const used = w/3;
  const finalPos = linePos.subarray(0, used*3);
  const finalCol = lineCol.subarray(0, used*3);
  // Use same red/orange color as stars: rgb(255, 71, 0) normalized to 0-1
  for (let i=0; i<finalCol.length; i+=3) {
    finalCol[i] = 1.0;      // R: 255/255
    finalCol[i+1] = 0.278;  // G: 71/255
    finalCol[i+2] = 0.0;    // B: 0/255
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(finalPos, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(finalCol, 3));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.2 });
  const lines = new THREE.LineSegments(geom, mat);
  lines.frustumCulled = false;
  return lines;
}

function makeRouteLines(waypoints, indexOf, positions, idToName) {
  // Create cyan line segments connecting route waypoints in order
  if (waypoints.length < 2) return null;
  
  const validWaypoints = waypoints.filter(wp => indexOf.has(wp.Id));
  if (validWaypoints.length < 2) {
    debugLog('makeRouteLines: insufficient valid waypoints', validWaypoints.length);
    return null;
  }
  
  debugLog('makeRouteLines: creating route with', validWaypoints.length, 'waypoints');
  
  const segCount = validWaypoints.length - 1;
  const linePos = new Float32Array(segCount * 2 * 3);
  const lineCol = new Float32Array(segCount * 2 * 3);
  
  let w = 0;
  for (let i = 0; i < validWaypoints.length - 1; i++) {
    const fromId = validWaypoints[i].Id;
    const toId = validWaypoints[i + 1].Id;
    const fromIdx = indexOf.get(fromId);
    const toIdx = indexOf.get(toId);
    
    const fx = positions[fromIdx * 3 + 0];
    const fy = positions[fromIdx * 3 + 1];
    const fz = positions[fromIdx * 3 + 2];
    const tx = positions[toIdx * 3 + 0];
    const ty = positions[toIdx * 3 + 1];
    const tz = positions[toIdx * 3 + 2];
    
    linePos[w++] = fx; linePos[w++] = fy; linePos[w++] = fz;
    linePos[w++] = tx; linePos[w++] = ty; linePos[w++] = tz;
  }
  
  // Cyan color: rgb(0, 255, 255)
  for (let i = 0; i < lineCol.length; i += 3) {
    lineCol[i] = 0.0;     // R
    lineCol[i + 1] = 1.0; // G
    lineCol[i + 2] = 1.0; // B
  }
  
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(lineCol, 3));
  const mat = new THREE.LineBasicMaterial({ 
    vertexColors: true, 
    transparent: true, 
    opacity: 0.8,
    linewidth: 2 // Note: may not work in WebGL
  });
  const lines = new THREE.LineSegments(geom, mat);
  lines.frustumCulled = false;
  
  return lines;
}

// --- Route table UI functions ---

function createRouteTable(waypoints, focusCallback) {
  const table = document.createElement('div');
  table.id = 'route-table';
  
  // Restore position from localStorage or use default
  const savedPos = localStorage.getItem('routeTablePosition');
  if (savedPos) {
    try {
      const { top, right } = JSON.parse(savedPos);
      table.style.top = top + 'px';
      table.style.right = right + 'px';
    } catch (e) {
      /* ignore invalid storage */ 
    }
  }
  
  // Create title
  const title = document.createElement('h3');
  title.textContent = `Route (${waypoints.length} waypoints)`;
  table.appendChild(title);
  
  // Create table
  const tableEl = document.createElement('table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  const headers = ['#', 'Type', 'System'];
  headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  tableEl.appendChild(thead);
  
  const tbody = document.createElement('tbody');
  waypoints.forEach((wp, idx) => {
    const row = document.createElement('tr');
    
    // Make row clickable if waypoint is valid
    if (wp.valid) {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        debugLog('Route waypoint clicked:', wp.name, wp.Id);
        if (focusCallback) {
          focusCallback(wp.Id);
        }
      });
      
      // Add hover effect
      row.addEventListener('mouseenter', () => {
        row.style.backgroundColor = 'rgba(0, 255, 255, 0.2)';
      });
      row.addEventListener('mouseleave', () => {
        row.style.backgroundColor = '';
      });
    }
    
    const stepCell = document.createElement('td');
    stepCell.className = 'step-number';
    stepCell.textContent = (idx + 1).toString();
    row.appendChild(stepCell);
    
    const typeCell = document.createElement('td');
    typeCell.className = 'waypoint-type';
    typeCell.textContent = getWaypointTypeLabel(wp.Type);
    row.appendChild(typeCell);
    
    const nameCell = document.createElement('td');
    nameCell.textContent = wp.name;
    if (!wp.valid) {
      nameCell.style.color = '#ff5555';
      nameCell.title = 'System not found in dataset';
    }
    row.appendChild(nameCell);
    
    tbody.appendChild(row);
  });
  tableEl.appendChild(tbody);
  table.appendChild(tableEl);
  
  // Note: makeDraggable will be called after controls are available
  
  return table;
}

function makeDraggable(element, orbitControls) {
  let isDragging = false;
  let startX, startY, startRight, startTop;
  
  element.addEventListener('mousedown', (e) => {
    // Only start drag if clicking on the element itself or header, not table rows
    if (e.target.tagName === 'TD' || e.target.tagName === 'TR') return;
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    // Get current position (right and top)
    const rect = element.getBoundingClientRect();
    startRight = window.innerWidth - rect.right;
    startTop = rect.top;
    
    // Disable OrbitControls while dragging to prevent camera rotation
    if (orbitControls) {
      orbitControls.enabled = false;
    }
    
    e.preventDefault();
    e.stopPropagation();
  });
  
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    const newTop = startTop + dy;
    const newRight = startRight - dx;
    
    element.style.top = newTop + 'px';
    element.style.right = newRight + 'px';
    
    e.preventDefault();
    e.stopPropagation();
  });
  
  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      
      // Re-enable OrbitControls
      if (orbitControls) {
        orbitControls.enabled = true;
      }
      
      // Ensure element is in viewport
      ensureRouteTableInViewport(element);
      
      // Save position to localStorage
      const rect = element.getBoundingClientRect();
      const position = {
        top: rect.top,
        right: window.innerWidth - rect.right
      };
      localStorage.setItem('routeTablePosition', JSON.stringify(position));
    }
  });
}

function ensureRouteTableInViewport(element) {
  const rect = element.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  
  let top = rect.top;
  let right = vw - rect.right;
  
  // Ensure top is within viewport
  if (top < 0) top = 10;
  if (top + rect.height > vh) top = vh - rect.height - 10;
  
  // Ensure right is within viewport
  if (right < 0) right = 10;
  if (vw - right < rect.width) right = vw - rect.width - 10;
  
  element.style.top = top + 'px';
  element.style.right = right + 'px';
}

(async function main(){
  debugLog('main: starting');
  const container = document.getElementById('app');
  debugLog('main: container found', container ? 'yes' : 'no');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);
  debugLog('main: WebGLRenderer created and appended');

  // CSS2DRenderer for labels
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0px';
  labelRenderer.domElement.style.pointerEvents = 'none';
  container.appendChild(labelRenderer.domElement);
  debugLog('main: CSS2DRenderer created');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  debugLog('main: scene created, background black');

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.01, 1e6);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  debugLog('main: camera and controls created');
  
  // Expose camera and controls for testing (debug mode only)
  if (DEBUG_ENABLED) {
    window.camera = camera;
    window.controls = controls;
    debugLog('main: exposed camera and controls to window for testing');
  }

  const data = await loadData();
  debugLog('main: data loaded');
  const starPoints = makeStarfield(data.positions, data.ids, data.stationSystemSet);
  scene.add(starPoints);
  debugLog('main: starPoints added to scene');

  const {center, radius} = computeBounds(data.positions);
  camera.position.set(center[0] + radius*0.6, center[1] + radius*0.3, center[2] + radius*0.6);
  controls.target.set(center[0], center[1], center[2]);
  controls.update();
  debugLog('main: camera positioned', {
    position: [camera.position.x, camera.position.y, camera.position.z],
    target: [controls.target.x, controls.target.y, controls.target.z],
    near: camera.near,
    far: camera.far
  });

  const jumpLines = makeJumpLines(data.jumps, data.indexOf, data.positions);
  scene.add(jumpLines);
  debugLog('main: jumpLines added to scene');

  // --- Focus functionality ---
  
  // Camera animation state
  let cameraAnimation = null;
  
  function animateCameraTo(targetPos, targetLookAt, duration = 1000) {
    // Cancel any existing animation
    if (cameraAnimation) {
      cameraAnimation.cancelled = true;
    }
    
    const startPos = camera.position.clone();
    const startLookAt = controls.target.clone();
    const endPos = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z);
    const endLookAt = new THREE.Vector3(targetLookAt.x, targetLookAt.y, targetLookAt.z);
    const startTime = performance.now();
    
    // Easing function: ease in-out cubic
    const easeInOutCubic = (t) => {
      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };
    
    const animation = { cancelled: false };
    cameraAnimation = animation;
    
    const tick = () => {
      if (animation.cancelled) return;
      
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutCubic(progress);
      
      // Interpolate position and look-at
      camera.position.lerpVectors(startPos, endPos, easedProgress);
      controls.target.lerpVectors(startLookAt, endLookAt, easedProgress);
      controls.update();
      
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        cameraAnimation = null;
      }
    };
    
    tick();
  }
  
  function focusOnSystem(systemIdOrName, animate = true) {
    let systemIndex = -1;
    
    // Try as ID first (numeric)
    const asNumber = parseInt(systemIdOrName, 10);
    if (!isNaN(asNumber)) {
      systemIndex = data.indexOf.get(asNumber);
    }
    
    // Try as name if not found by ID
    if (systemIndex === undefined || systemIndex === -1) {
      // Search through idToName map for matching name (case-insensitive)
      const searchName = String(systemIdOrName).toLowerCase();
      for (const [id, name] of Object.entries(data.idToName)) {
        if (name.toLowerCase() === searchName) {
          systemIndex = data.indexOf.get(parseInt(id, 10));
          break;
        }
      }
    }
    
    if (systemIndex !== undefined && systemIndex !== -1) {
      const x = data.positions[systemIndex * 3 + 0];
      const y = data.positions[systemIndex * 3 + 1];
      const z = data.positions[systemIndex * 3 + 2];
      
      // Calculate camera offset (move camera to a nice viewing distance)
      const offset = radius * 0.05; // Zoom in close
      const targetPos = { x: x + offset, y: y + offset, z: z + offset };
      const targetLookAt = { x, y, z };
      
      if (animate) {
        animateCameraTo(targetPos, targetLookAt, 1000);
      } else {
        camera.position.set(targetPos.x, targetPos.y, targetPos.z);
        controls.target.set(targetLookAt.x, targetLookAt.y, targetLookAt.z);
        controls.update();
      }
      
      debugLog('focusOnSystem: focused on', systemIdOrName, 'at index', systemIndex, 'position', [x, y, z]);
      return true;
    } else {
      debugLog('focusOnSystem: system not found', systemIdOrName);
      return false;
    }
  }
  
  // Check for focus query parameter on load
  const urlParams = new URLSearchParams(window.location.search);
  const focusParam = urlParams.get('focus');
  if (focusParam) {
    debugLog('main: focus parameter detected', focusParam);
    focusOnSystem(focusParam, false); // Don't animate on initial load
  }
  
  // Handle browser back/forward navigation
  window.addEventListener('popstate', (event) => {
    debugLog('popstate: browser navigation detected');
    const currentParams = new URLSearchParams(window.location.search);
    const newFocusParam = currentParams.get('focus');
    
    if (newFocusParam) {
      debugLog('popstate: focusing on', newFocusParam);
      focusOnSystem(newFocusParam, true); // Animate on navigation
    } else {
      debugLog('popstate: no focus parameter, resetting to initial view');
      // Reset to initial camera position
      camera.position.set(center[0] + radius*0.6, center[1] + radius*0.3, center[2] + radius*0.6);
      controls.target.set(center[0], center[1], center[2]);
      controls.update();
    }
  });
  
  // --- Route functionality ---
  let routeWaypoints = null;
  let routeLines = null;
  const routeParam = urlParams.get('route');
  
  if (routeParam) {
    try {
      debugLog('main: route parameter detected, decoding...');
      routeWaypoints = await decodeRouteToken(routeParam);
      debugLog('main: decoded', routeWaypoints.length, 'waypoints');
      
      // Validate and enrich waypoints with system names
      routeWaypoints = routeWaypoints.map(wp => ({
        ...wp,
        name: data.idToName[String(wp.Id)] || `System ${wp.Id}`,
        valid: data.indexOf.has(wp.Id)
      }));
      
      // Create route visualization
      routeLines = makeRouteLines(routeWaypoints, data.indexOf, data.positions, data.idToName);
      if (routeLines) {
        scene.add(routeLines);
        debugLog('main: route lines added to scene');
      }
    } catch (err) {
      debugLog('main: failed to decode route', err.message);
      console.error('Route decoding error:', err);
    }
  }

  // Debug output: geometry attributes and renderer/camera state
  try {
    // starPoints is now a Group, so we need to check its children
    if (starPoints.children && starPoints.children.length > 0) {
      const firstChild = starPoints.children[0];
      const posAttr = firstChild.geometry.getAttribute('position');
      const colAttr = firstChild.geometry.getAttribute('color');
      debugLog('Star geometry attrs:', {
        groupChildren: starPoints.children.length,
        positionCount: posAttr ? posAttr.count : 0,
        positionItemSize: posAttr ? posAttr.itemSize : undefined,
        colorCount: colAttr ? colAttr.count : 0
      });
    }
  } catch (e) {
    debugLog('Failed to inspect star geometry:', e);
  }

  debugLog('Renderer state:', {pixelRatio: renderer.getPixelRatio(), width: window.innerWidth, height: window.innerHeight});

  // Hover picking for labels (near stars)
  const raycaster = new THREE.Raycaster();
  // Adjust threshold so picking is easier at 1080p
  raycaster.params.Points.threshold = radius * 0.001; // scale with scene size

  const labelDiv = document.createElement('div');
  labelDiv.className = 'label';
  labelDiv.style.marginTop = '-1em';
  const labelObj = new CSS2DObject(labelDiv);
  labelObj.visible = false;
  scene.add(labelObj);

  function updateHover() {
    const mouse = new THREE.Vector2();
    function onMove(e){
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }
    window.addEventListener('mousemove', onMove, { passive: true });
    
    // Click handler to focus and update URL
    function onClick(e) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(starPoints, true);
      if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;
        const localIndex = intersects[0].index;
        const originalIndex = intersectedObject.userData.indexMap[localIndex];
        
        const sysId = data.ids[originalIndex];
        const name = data.idToName[String(sysId)] || String(sysId);
        
        // Update URL with pushState
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('focus', name);
        window.history.pushState({ focus: name }, '', newUrl);
        
        // Focus on the clicked system
        focusOnSystem(name);
        
        debugLog('onClick: focused on system', name, 'id', sysId);
      }
    }
    window.addEventListener('click', onClick);

    return () => {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(starPoints, true); // true = recursive for group
      if (intersects.length > 0) {
        // Get the intersected object and its index
        const intersectedObject = intersects[0].object;
        const localIndex = intersects[0].index;
        
        // Map back to original data index using userData.indexMap
        const originalIndex = intersectedObject.userData.indexMap[localIndex];
        
        const sysId = data.ids[originalIndex];
        const name = data.idToName[String(sysId)] || String(sysId);
        const hasStation = data.stationSystemSet.has(sysId);
        labelDiv.textContent = hasStation ? `🛰️ ${name}` : name;
        labelObj.position.set(
          data.positions[originalIndex*3+0],
          data.positions[originalIndex*3+1],
          data.positions[originalIndex*3+2]
        );
        labelObj.visible = true;
      } else {
        labelObj.visible = false;
      }
    };
  }
  const hoverStep = updateHover();
  
  // --- Route table UI ---
  if (routeWaypoints && routeWaypoints.length > 0) {
    const routeTable = createRouteTable(routeWaypoints, focusOnSystem);
    container.appendChild(routeTable);
    makeDraggable(routeTable, controls);
    debugLog('main: route table UI added');
  }

  function onResize(){
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    
    // Check if route table is out of bounds
    const routeTable = document.getElementById('route-table');
    if (routeTable) {
      ensureRouteTableInViewport(routeTable);
    }
  }
  window.addEventListener('resize', onResize);

  let frameCount = 0;
  function animate(){
    requestAnimationFrame(animate);
    hoverStep();
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    // Log only first few frames to avoid spam
    if (frameCount < 3) {
      debugLog('animate: frame', frameCount, 'rendered');
      frameCount++;
    }
  }
  debugLog('main: starting animation loop');
  animate();
})().catch(err => {
  debugLog('main() error:', err);
  console.error(err);
  alert('Failed to load starmap: ' + err.message);
});
