import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'https://unpkg.com/three@0.160.0/examples/jsm/renderers/CSS2DRenderer.js';

// --- Debug logging helper --------------------------------------------------
function _makeDebugPanel(){
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
    console.log(...args);
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
  const [manifest, posBuf, idsBuf, namesRes, jumpsBuf] = await Promise.all([
    fetch(DATA_BASE + 'manifest.json').then(r => r.json()),
    fetchArrayBuffer(DATA_BASE + 'systems_positions.bin'),
    fetchArrayBuffer(DATA_BASE + 'systems_ids.bin'),
    fetch(DATA_BASE + 'systems_names.json').then(r => r.json()),
    fetchArrayBuffer(DATA_BASE + 'jumps.bin')
  ]);

  // The binary data is in native (little-endian) format from Python array.tobytes()
  // We can use TypedArray constructors directly (they default to little-endian)
  debugLog('loadData: parsing binary data (native little-endian)');
  const positions = new Float32Array(posBuf);
  const ids = new Uint32Array(idsBuf);
  const jumps = new Uint32Array(jumpsBuf);
  const idToName = namesRes;

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
  return {manifest, positions, ids, idToName, jumps, indexOf};
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

function makeStarfield(positions) {
  debugLog('makeStarfield: creating Points for', positions.length / 3, 'stars');
  // THREE.Points with additive blending so stars pop at 1080p
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // Per-vertex color - rgb(255, 71, 0) normalized to 0-1 range
  const colors = new Float32Array(positions.length);
  for (let i=0; i<colors.length; i+=3) {
    colors[i] = 1.0;      // R: 255/255
    colors[i+1] = 0.278;  // G: 71/255
    colors[i+2] = 0.0;    // B: 0/255
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 2.5, // tweak for 1080p
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const pts = new THREE.Points(geom, mat);
  pts.frustumCulled = false;
  debugLog('makeStarfield: created Points object');
  return pts;
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
  // White endpoints => gradient looks white; customize per-system color if desired
  for (let i=0;i<finalCol.length;i++) finalCol[i] = 0.7;

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(finalPos, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(finalCol, 3));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8 });
  const lines = new THREE.LineSegments(geom, mat);
  lines.frustumCulled = false;
  return lines;
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

  const data = await loadData();
  debugLog('main: data loaded');
  const starPoints = makeStarfield(data.positions);
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

  // Debug output: geometry attributes and renderer/camera state
  try {
    const posAttr = starPoints.geometry.getAttribute('position');
    const colAttr = starPoints.geometry.getAttribute('color');
    debugLog('Star geometry attrs:', {
      positionCount: posAttr ? posAttr.count : 0,
      positionItemSize: posAttr ? posAttr.itemSize : undefined,
      colorCount: colAttr ? colAttr.count : 0
    });
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

    return () => {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(starPoints, false);
      if (intersects.length > 0) {
        const i = intersects[0].index;
        const sysId = data.ids[i];
        const name = data.idToName[String(sysId)] || String(sysId);
        labelDiv.textContent = name;
        labelObj.position.set(
          data.positions[i*3+0],
          data.positions[i*3+1],
          data.positions[i*3+2]
        );
        labelObj.visible = true;
      } else {
        labelObj.visible = false;
      }
    };
  }
  const hoverStep = updateHover();

  function onResize(){
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
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
