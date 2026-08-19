import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

import { PAL } from './wedding/shared.js';
import { createMandap } from './wedding/mandap.js';
import { createToranGate, createFloralArch, createCarvedPillar } from './wedding/arches.js';
import { createHorseGroom } from './wedding/horseGroom.js';
import { createBride } from './wedding/bride.js';
import { createElephant } from './wedding/elephant.js';
import { createAttendant } from './wedding/attendants.js';
import { createDancer } from './wedding/dancers.js';
import { createGuest } from './wedding/guests.js';
import { createDiya, createLantern, createHangingGarland, createKalash, createPetalTray } from './wedding/decor.js';
import { createCeremonialPath, createRangoli } from './wedding/ground.js';
import { createPetalSystem, createVolumetricRays, ATMOSPHERE_PARAMS } from './wedding/atmosphere.js';
import { createPlaneBanner, createSwan, createMoneyFountain, createFirework, createTeamGroomBanner } from './wedding/extras.js';
import { createWeddingSoundscape } from './wedding/soundscape.js';

// =====================================================================
//  Scene director's layout (from the planning pass)
// =====================================================================
const COUPLE = window.WEDDING_COUPLE || { bride: 'Harshitha', groom: 'Sai Charan' };
const WELCOME_PIVOT = [-2, -29];
const WELCOME_YAW = Math.atan2(8, 2); // final carpet tangent, about 76 degrees
const WELCOME_FACE = [6, -27];
function alignWelcomePoint(point) {
  const dx = point[0] - WELCOME_PIVOT[0];
  const dz = point[1] - WELCOME_PIVOT[1];
  const c = Math.cos(WELCOME_YAW), s = Math.sin(WELCOME_YAW);
  return [WELCOME_PIVOT[0] + dx * c + dz * s, WELCOME_PIVOT[1] - dx * s + dz * c];
}
function alignWelcomeSpec(spec) {
  return {
    ...spec,
    pos: alignWelcomePoint(spec.pos),
    ...(spec.faceToward ? { faceToward: alignWelcomePoint(spec.faceToward) } : {}),
  };
}
const LAYOUT = {
  mandap: { pos: alignWelcomePoint([-2, -34]), faceToward: WELCOME_FACE },
  // She begins looking up the aisle, then turns toward the live groom during
  // the arrival instead of staring at an empty final position from frame one.
  bride: { pos: alignWelcomePoint([-2, -28]), faceToward: WELCOME_FACE },
  horseGroom: { pos: [24, 14], faceToward: [23, -8] },
  // Elephant directly BEHIND the groom on the red carpet, facing the same way
  elephant: { pos: [24, 27], faceToward: [24, 8] },
  path: {
    points: [[14, 44], [20, 34], [24, 22], [25, 8], [23, -8], [16, -20], [6, -27], [-2, -29]],
    width: 7,
  },
  toranGates: [
    // Every gate is centered on the runner so its two columns read as one arch.
    { pos: [19.5, 35], faceToward: [23, 20] },
    { pos: [24.5, 6], faceToward: [24, -8] },
    { pos: [10, -25], faceToward: [-2, -29] },
  ],
  attendants: [
    { item: 'chhatri', pos: [20.5, 14], faceToward: [23, -8] }, // flank the groom
    { item: 'chhatri', pos: [28, 14], faceToward: [23, -8] },
    // Lead musicians form one neat row across the runner instead of drifting
    // farther and farther into the grass.
    { item: 'dhol', pos: [16.9, -13.8], faceToward: [0, -30] },
    { item: 'shehnai', pos: [18.9, -15], faceToward: [0, -30] },
    { item: 'turhi', pos: [21, -16.2], faceToward: [0, -30] },
    { item: 'flag', pos: [20, 27], faceToward: [24, 12] }, // flank the elephant
    { item: 'morchhal', pos: [28, 27], faceToward: [24, 12] },
    // Greeters are separated from the bride, dancers and floral arch.
    alignWelcomeSpec({ item: 'lamp', pos: [-6.5, -22.8], faceToward: [-2, -30] }),
    alignWelcomeSpec({ item: 'garland', pos: [2.5, -22.2], faceToward: [-2, -30] }),
    alignWelcomeSpec({ item: 'lamp', pos: [-8.5, -30.5], faceToward: [-2, -30] }),
  ],
  petalArea: { cx: 16, cz: 0, radius: 32 },
  // Default framing features the PEOPLE, with the path leading back to the mandap + bride.
  camera: { introFrom: [-8, 25, 70], introTo: [0, 13, 54], target: [18, 3, 38], introDurationSec: 4.5 },
  // Coordinated dance floor: tidy rows flanking the carpet, facing the groom.
  dancers: [
    { variant: 'armsUpM', pos: [20.5, 7] },
    { variant: 'bhangraM', pos: [29, 7] },
    { variant: 'spinF', pos: [20, 0] },
    { variant: 'jumpM', pos: [28, 0] },
    { variant: 'clapM', pos: [19.2, -7] },
    { variant: 'thumkaF', pos: [27.2, -7] },
  ],
  // Two female dancers flanking the bride so she is not isolated
  brideDancers: [
    alignWelcomeSpec({ variant: 'spinF', pos: [-5.5, -27.5], faceToward: [-5.5, 6] }),
    alignWelcomeSpec({ variant: 'thumkaF', pos: [1.5, -27.5], faceToward: [1.5, 6] }),
  ],
  // A few guests lining the near carpet edge, facing the procession
  guests: [
    { variant: 'cheering', pos: [18, 30], faceToward: [24, 26] },
    { variant: 'namaste', pos: [30, 10], faceToward: [25, 8] },
    { variant: 'clapping', pos: [16, -14], faceToward: [21, -18] },
  ],
  // Two musicians playing right beside the groom
  groomMusicians: [
    { item: 'shehnai', pos: [21, 18], faceToward: [23, -8] },
    { item: 'dhol', pos: [27, 18], faceToward: [23, -8] },
  ],
  moneyThrower: { pos: [31.5, 15], faceToward: [24, 14] },
  fireworkGuy: { pos: [16.5, 15], faceToward: [24, 14] },
  swans: [{ pos: [-4, -2], phase: 0 }, { pos: [3, 3], phase: 2.1 }],
};

// Keep rendering policy aligned with the coarse-pointer mobile UI. This also
// catches iPads and phones requesting a desktop user agent.
const IS_MOBILE = window.matchMedia?.('(pointer: coarse)').matches
  || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// Collected per-frame updaters from animated assets
const updaters = [];
const processionActors = [];

// Story timing: the same existing actors travel, arrange themselves for the
// welcome, then keep their individual idle/dance animation during celebration.
const PROCESSION = {
  holdEnd: 5.1,
  travelEnd: 29,
  arrivalEnd: 45,
  anchorStart: 0.5,
  anchorEnd: 58,
};
let processionPhase = 'opening';
let arrivalProgress = 0;
let arrivalCueFired = false;
let arrivalCueAt = Infinity;
let cameraFollowing = true;

// =====================================================================
//  Renderer / scene / camera
// =====================================================================
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(ATMOSPHERE_PARAMS.fogColor, IS_MOBILE ? 0.0052 : 0.006);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(...LAYOUT.camera.introFrom);

const renderer = new THREE.WebGLRenderer({ antialias: !IS_MOBILE });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.25 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = IS_MOBILE ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const root = document.getElementById('root') ?? document.body;
root.appendChild(renderer.domElement);

// Post-processing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.58, // strength — glow on gold/flames without washing the scene
  0.6, // radius
  0.72 // threshold — only genuinely bright things bloom
);
composer.addPass(bloomPass);

let fxaaPass = null;
if (!IS_MOBILE) {
  fxaaPass = new ShaderPass(FXAAShader);
  const renderDpr = renderer.getPixelRatio();
  fxaaPass.uniforms['resolution'].value.set(1 / (window.innerWidth * renderDpr), 1 / (window.innerHeight * renderDpr));
  composer.addPass(fxaaPass);
}
composer.addPass(new OutputPass());

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = IS_MOBILE ? 0.08 : 0.05;
controls.rotateSpeed = IS_MOBILE ? 0.65 : 1;
controls.zoomSpeed = IS_MOBILE ? 0.85 : 1;
controls.panSpeed = IS_MOBILE ? 0.75 : 1;
controls.touches.ONE = THREE.TOUCH.ROTATE;
controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
controls.zoomToCursor = true;
controls.maxPolarAngle = Math.PI / 2.08;
controls.minDistance = 6;
controls.maxDistance = 135;
controls.target.set(...LAYOUT.camera.target);
controls.enabled = true; // any drag immediately takes over from the director

// =====================================================================
//  Sunset sky (kept from the original world)
// =====================================================================
const skyCanvas = document.createElement('canvas');
skyCanvas.width = 1024; skyCanvas.height = 1024;
const skyCtx = skyCanvas.getContext('2d');
const grad = skyCtx.createLinearGradient(0, 0, 0, 1024);
grad.addColorStop(0, '#0a0520');
grad.addColorStop(0.15, '#1a0a3a');
grad.addColorStop(0.3, '#4a1555');
grad.addColorStop(0.42, '#8b2252');
grad.addColorStop(0.52, '#d4553a');
grad.addColorStop(0.6, '#e87730');
grad.addColorStop(0.68, '#f09838');
grad.addColorStop(0.76, '#f5be5a');
grad.addColorStop(0.85, '#fad48e');
grad.addColorStop(0.92, '#ffe8c0');
grad.addColorStop(1, '#fff0d6');
skyCtx.fillStyle = grad;
skyCtx.fillRect(0, 0, 1024, 1024);
const sunGlowGrad = skyCtx.createRadialGradient(512, 620, 0, 512, 620, 250);
sunGlowGrad.addColorStop(0, 'rgba(255,240,200,0.5)');
sunGlowGrad.addColorStop(0.3, 'rgba(255,180,80,0.3)');
sunGlowGrad.addColorStop(0.7, 'rgba(255,100,50,0.1)');
sunGlowGrad.addColorStop(1, 'rgba(255,80,30,0)');
skyCtx.fillStyle = sunGlowGrad;
skyCtx.fillRect(0, 0, 1024, 1024);
const skyTexture = new THREE.CanvasTexture(skyCanvas);
skyTexture.mapping = THREE.EquirectangularReflectionMapping;
scene.background = skyTexture;
scene.environment = skyTexture;

// =====================================================================
//  Lighting — warm golden hour (base rig + tuned atmosphere accents)
// =====================================================================
const ambientLight = new THREE.AmbientLight(ATMOSPHERE_PARAMS.ambient.color, ATMOSPHERE_PARAMS.ambient.intensity);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(ATMOSPHERE_PARAMS.keyLight.color, ATMOSPHERE_PARAMS.keyLight.intensity);
sunLight.position.set(-50, 22, -40);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(IS_MOBILE ? 1024 : 2048, IS_MOBILE ? 1024 : 2048);
sunLight.shadow.camera.left = -70;
sunLight.shadow.camera.right = 70;
sunLight.shadow.camera.top = 70;
sunLight.shadow.camera.bottom = -70;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 170;
sunLight.shadow.bias = -0.001;
sunLight.shadow.normalBias = 0.02;
scene.add(sunLight);

const warmFill = new THREE.DirectionalLight(0xff9955, 0.45);
warmFill.position.set(30, 10, 20);
scene.add(warmFill);

const rimLight = new THREE.DirectionalLight(0xff5522, 0.5);
rimLight.position.set(-40, 6, -30);
scene.add(rimLight);

const hemiLight = new THREE.HemisphereLight(ATMOSPHERE_PARAMS.hemi.sky, ATMOSPHERE_PARAMS.hemi.ground, ATMOSPHERE_PARAMS.hemi.intensity);
scene.add(hemiLight);

// =====================================================================
//  Sun sphere with glow (kept)
// =====================================================================
const sunGroup = new THREE.Group();
const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffe5a0 }));
sunGroup.add(sun);
for (let i = 0; i < 3; i++) {
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(7 + i * 3, 32, 32),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(0.08, 0.9, 0.6 - i * 0.1),
      transparent: true, opacity: 0.15 - i * 0.04, side: THREE.BackSide,
    })
  );
  sunGroup.add(glow);
}
const SUN_POS = new THREE.Vector3(-55, 12, -80);
sunGroup.position.copy(SUN_POS);
scene.add(sunGroup);

// =====================================================================
//  Terrain helpers (kept) + placement helpers
// =====================================================================
function baseTerrain(x, z) {
  let h = 0;
  h += Math.sin(x * 0.05) * Math.cos(z * 0.05) * 4;
  h += Math.sin(x * 0.1 + 1) * Math.cos(z * 0.08) * 2;
  h += Math.sin(x * 0.02) * Math.sin(z * 0.03) * 6;
  h += Math.cos(x * 0.15) * Math.sin(z * 0.12) * 1.5;
  h += Math.sin(x * 0.07 + 2) * Math.cos(z * 0.06 - 1) * 1.5;
  const distSq = x * x + z * z;
  if (distSq < 400) h *= 0.3 * (distSq / 400);
  return h;
}
// Raised ceremonial terrace. Instead of just ADDING height (which keeps the
// bumps, so humps still poke above the carpet), it FLATTENS the carpet corridor
// and the mandap/bride area up to (carpet-centerline base height + LIFT). That
// removes the side-humps so no land ever sits above the carpet. Fades out before
// the lake and blends smoothly into the valley.
function getTerrainHeight(x, z) {
  const b = baseTerrain(x, z);
  const near = nearestOnPath(x, z);
  const corridor = 1 - smoothstep(PATH_HALF + 7, PATH_HALF + 17, near.d);
  const dm = Math.hypot(x - LAYOUT.mandap.pos[0], z - (LAYOUT.bride.pos[1] - 3));
  const disc = 1 - smoothstep(11, 22, dm);
  const f = Math.max(corridor, disc) * smoothstep(15, 20.5, Math.hypot(x, z));
  if (f <= 0) return b;
  const LIFT = 1.44; // 40% lower than before — a gentle raised terrace, not a mound
  const target = baseTerrain(near.cx, near.cz) + LIFT; // flat level for this stretch
  return b + (target - b) * f; // lift/flatten toward the terrace, blend at the edges
}

function faceAngle(px, pz, tx, tz) { return Math.atan2(tx - px, tz - pz); }

// One shared runner height keeps the carpet, rangolis, props and actors on the
// same physical surface. A small clearance covers the deepest dance/bow pose.
const CARPET_LIFT = 0.32;
const ACTOR_CLEARANCE = 0.06;
const PROP_CLEARANCE = 0.015;

// Facing helper for [x,z] + faceToward[x,z]. Static props seat on the highest
// ground under their small footprint (never sink into a bump).
function place(group, spec, opts = {}) {
  const x = spec.pos[0], z = spec.pos[1];
  const footprint = opts.footprint ?? 0.7;
  const y = (opts.y !== undefined)
    ? opts.y
    : sampleMaxSurfaceHeight(x, z, footprint) + (opts.clearance ?? PROP_CLEARANCE);
  group.position.set(x, y, z);
  if (spec.faceToward) group.rotation.y = faceAngle(x, z, spec.faceToward[0], spec.faceToward[1]);
  scene.add(group);
  return group;
}
// Accepts either a THREE.Object3D (static) or { group, update } (animated).
// Animated assets are wrapped in a grounded/oriented parent so an asset's own
// update() (which may bob/sway its group.position) can never un-ground it.
function mount(asset, spec, opts = {}) {
  if (asset.isObject3D) {
    place(asset, spec, opts);
    return asset;
  }
  const wrap = new THREE.Group();
  const x = spec.pos[0], z = spec.pos[1];
  const footprint = opts.footprint ?? 1.0;
  wrap.position.set(
    x,
    opts.y !== undefined
      ? opts.y
      : sampleMaxSurfaceHeight(x, z, footprint) + (opts.clearance ?? ACTOR_CLEARANCE),
    z
  );
  if (spec.faceToward) wrap.rotation.y = faceAngle(x, z, spec.faceToward[0], spec.faceToward[1]);
  wrap.add(asset.group);
  scene.add(wrap);
  // Distance-driven gait state is shared with the asset updater. It adds only
  // transform groups: no physics engine, meshes, textures, or draw calls.
  const locomotion = {
    amount: 0,
    phase: asset.gaitOffset ?? 0,
    gaitScale: asset.gaitScale ?? 6,
  };
  wrap.userData.locomotion = locomotion;
  if (typeof asset.update === 'function') {
    updaters.push((t, dt) => asset.update(t, dt, locomotion));
  }
  return wrap;
}

function sampleMaxHeight(cx, cz, r) {
  let m = getTerrainHeight(cx, cz);
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    m = Math.max(m, getTerrainHeight(cx + Math.cos(ang) * r, cz + Math.sin(ang) * r));
  }
  return m;
}
function sampleMinHeight(cx, cz, r) {
  let m = getTerrainHeight(cx, cz);
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    m = Math.min(m, getTerrainHeight(cx + Math.cos(ang) * r, cz + Math.sin(ang) * r));
  }
  return m;
}

// The runner is a raised surface. Anything whose contact patch overlaps it
// must be seated against the carpet, not the terrain hidden underneath.
function getSurfaceHeight(x, z) {
  const runnerHalf = PATH_HALF + LAYOUT.path.width * 0.16 + 0.08;
  return getTerrainHeight(x, z) + (distToPath(x, z) <= runnerHalf ? CARPET_LIFT : 0);
}

function sampleMaxSurfaceHeight(cx, cz, r) {
  let m = getSurfaceHeight(cx, cz);
  const rings = r > 0.05 ? [r * 0.5, r] : [];
  for (const rr of rings) {
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      m = Math.max(m, getSurfaceHeight(cx + Math.cos(ang) * rr, cz + Math.sin(ang) * rr));
    }
  }
  return m;
}

// ---- keep-clear tests so landscape never overgrows the procession ----
const PATH_PTS = LAYOUT.path.points;
const PATH_HALF = LAYOUT.path.width / 2;
function distToSeg(x, z, a, b) {
  const ax = a[0], az = a[1], bx = b[0], bz = b[1];
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz || 1e-6;
  let t = ((x - ax) * dx + (z - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = ax + t * dx, pz = az + t * dz;
  return Math.hypot(x - px, z - pz);
}
function distToPath(x, z) {
  let best = Infinity;
  for (let i = 0; i < PATH_PTS.length - 1; i++) best = Math.min(best, distToSeg(x, z, PATH_PTS[i], PATH_PTS[i + 1]));
  return best;
}

// ---- Raised ceremonial terrace ------------------------------------------
// Lifts the actual GROUND along the carpet corridor and around the mandap+bride
// so the whole procession stands on elevated, clearly-visible ground (fixes the
// "everyone looks half underground" problem) — added into getTerrainHeight so
// the terrain mesh, carpet and every character rise together. Fades out before
// the lake so we never raise ground up through the water.
function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
// Nearest point on the carpet centerline — used to flatten the terrace across
// its width to a single per-stretch height (kills side-humps above the carpet).
function nearestOnPath(x, z) {
  let best = Infinity, cx = PATH_PTS[0][0], cz = PATH_PTS[0][1];
  for (let i = 0; i < PATH_PTS.length - 1; i++) {
    const a = PATH_PTS[i], b = PATH_PTS[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len2 = dx * dx + dz * dz || 1e-6;
    let t = ((x - a[0]) * dx + (z - a[1]) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a[0] + t * dx, pz = a[1] + t * dz;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; cx = px; cz = pz; }
  }
  return { d: best, cx, cz };
}

// One tiny polyline sampler drives the entire procession. It deliberately
// follows the authored carpet instead of a spline, so actors cannot overshoot
// the runner at its sharper turns.
const PATH_SEGMENTS = [];
let PATH_TOTAL = 0;
for (let i = 0; i < PATH_PTS.length - 1; i++) {
  const a = PATH_PTS[i], b = PATH_PTS[i + 1];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  PATH_SEGMENTS.push({ a, b, start: PATH_TOTAL, len });
  PATH_TOTAL += len;
}
const _pathCenter = { x: 0, z: 0 };
const _pathBefore = { x: 0, z: 0 };
const _pathAfter = { x: 0, z: 0 };
function samplePathCenter(distance, out = { x: 0, z: 0 }) {
  let seg = PATH_SEGMENTS[0];
  if (distance >= PATH_TOTAL) seg = PATH_SEGMENTS[PATH_SEGMENTS.length - 1];
  else if (distance > 0) {
    for (let i = 0; i < PATH_SEGMENTS.length; i++) {
      if (distance <= PATH_SEGMENTS[i].start + PATH_SEGMENTS[i].len) {
        seg = PATH_SEGMENTS[i];
        break;
      }
    }
  }
  // Values outside 0..PATH_TOTAL intentionally extrapolate: the elephant and
  // rear escorts begin just beyond the carpet and then enter behind the groom.
  const u = (distance - seg.start) / seg.len;
  out.x = THREE.MathUtils.lerp(seg.a[0], seg.b[0], u);
  out.z = THREE.MathUtils.lerp(seg.a[1], seg.b[1], u);
  return out;
}
function distanceAlongPathTo(x, z) {
  let best = Infinity;
  let bestDistance = 0;
  for (const seg of PATH_SEGMENTS) {
    const dx = seg.b[0] - seg.a[0], dz = seg.b[1] - seg.a[1];
    const u = THREE.MathUtils.clamp(((x - seg.a[0]) * dx + (z - seg.a[1]) * dz) / (seg.len * seg.len), 0, 1);
    const px = seg.a[0] + dx * u, pz = seg.a[1] + dz * u;
    const distance = Math.hypot(x - px, z - pz);
    if (distance < best) {
      best = distance;
      bestDistance = seg.start + seg.len * u;
    }
  }
  return bestDistance;
}
const GATE_PATH_DISTANCES = LAYOUT.toranGates.map((gate) => distanceAlongPathTo(gate.pos[0], gate.pos[1]));
function gateProximity(distance) {
  let proximity = 0;
  for (const gateDistance of GATE_PATH_DISTANCES) {
    proximity = Math.max(proximity, 1 - smoothstep(1.8, 4.8, Math.abs(distance - gateDistance)));
  }
  return proximity;
}
function gateLaneScale(distance) {
  return 1 - gateProximity(distance) * 0.5;
}
function processionSurfaceHeight(x, z, distance) {
  const terrain = getTerrainHeight(x, z);
  const surface = getSurfaceHeight(x, z);
  if (distance >= 0) return surface;
  // Followers begin just beyond the runner. Blend any endpoint lift as they
  // step onto it so the elephant never pops upward by a full carpet thickness.
  return terrain + (surface - terrain) * ease01((distance + 8) / 8);
}
function samplePathPose(distance, lateral, out = {}) {
  samplePathCenter(distance, _pathCenter);
  samplePathCenter(distance - 0.7, _pathBefore);
  samplePathCenter(distance + 0.7, _pathAfter);
  let tx = _pathAfter.x - _pathBefore.x;
  let tz = _pathAfter.z - _pathBefore.z;
  const invLen = 1 / (Math.hypot(tx, tz) || 1);
  tx *= invLen; tz *= invLen;
  // Left-hand normal across the carpet.
  out.x = _pathCenter.x - tz * lateral;
  out.z = _pathCenter.z + tx * lateral;
  out.y = processionSurfaceHeight(out.x, out.z, distance) + ACTOR_CLEARANCE;
  out.yaw = Math.atan2(tx, tz);
  out.centerX = _pathCenter.x;
  out.centerZ = _pathCenter.z;
  return out;
}
function ease01(value) {
  const p = THREE.MathUtils.clamp(value, 0, 1);
  return p * p * p * (p * (p * 6 - 15) + 10);
}
function lerpAngle(a, b, t) {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
}
// Three deliberate lamp pairs, each between major procession stations. The old
// bend-based placement collided with Gate 1 and two dancers.
const LAMP_POS = [
  [19.7, 44.7], [10.7, 39.3],
  [27.4, -11.6], [17.1, -10.4],
  [17.6, -25.3], [11.6, -16.7],
];

const CLEAR = [
  { x: LAYOUT.mandap.pos[0], z: LAYOUT.mandap.pos[1], r: 11 },
  { x: LAYOUT.bride.pos[0], z: LAYOUT.bride.pos[1], r: 3 },
  { x: LAYOUT.horseGroom.pos[0], z: LAYOUT.horseGroom.pos[1], r: 6.5 },
  { x: LAYOUT.elephant.pos[0], z: LAYOUT.elephant.pos[1], r: 7.5 },
  ...LAYOUT.toranGates.map((g) => ({ x: g.pos[0], z: g.pos[1], r: 4.5 })),
  ...LAMP_POS.map((p) => ({ x: p[0], z: p[1], r: 1.8 })),
  ...LAYOUT.attendants.map((a) => ({ x: a.pos[0], z: a.pos[1], r: 2.2 })),
  ...LAYOUT.dancers.map((d) => ({ x: d.pos[0], z: d.pos[1], r: 2 })),
  ...LAYOUT.brideDancers.map((d) => ({ x: d.pos[0], z: d.pos[1], r: 2 })),
  ...LAYOUT.guests.map((g) => ({ x: g.pos[0], z: g.pos[1], r: 2 })),
  { x: LAYOUT.moneyThrower.pos[0], z: LAYOUT.moneyThrower.pos[1], r: 2 },
  { x: LAYOUT.fireworkGuy.pos[0], z: LAYOUT.fireworkGuy.pos[1], r: 2 },
  { x: 24, z: -2, r: 13 }, // keep the whole dance floor + carpet clear of trees
];
function nearAsset(x, z) {
  for (const c of CLEAR) { const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz < c.r * c.r) return true; }
  return false;
}
function blocked(x, z, pathMargin = 1.5) { return distToPath(x, z) < PATH_HALF + pathMargin || nearAsset(x, z); }

// =====================================================================
//  Rivers / lake (kept — the lake is the sacred reflecting pool)
// =====================================================================
function getRiverPoint(t) {
  const x = -20 + t * 25 + Math.sin(t * 4) * 8 + Math.cos(t * 2.5) * 5;
  const z = -70 + t * 75 + Math.sin(t * 3) * 6;
  return new THREE.Vector2(x, z);
}
function getRiverPoint2(t) {
  const x = 30 - t * 28 + Math.sin(t * 3.5 + 1) * 7;
  const z = -65 + t * 68 + Math.cos(t * 2.8 + 2) * 5;
  return new THREE.Vector2(x, z);
}
// Reuse one sampled river map for terrain carving and placement checks instead
// of recalculating hundreds of trigonometric points for every terrain vertex.
const RIVER_SAMPLES = Array.from({ length: 101 }, (_, i) => {
  const t = i / 100;
  return {
    a: getRiverPoint(t),
    b: getRiverPoint2(t),
    widthA: 2.0 + Math.sin(t * 6) * 0.5,
    widthB: 1.6 + Math.sin(t * 5 + 1) * 0.4,
  };
});
function isNearRiver(px, pz, threshold = 3.5) {
  for (const sample of RIVER_SAMPLES) {
    if ((px - sample.a.x) ** 2 + (pz - sample.a.y) ** 2 < threshold * threshold) return true;
    if ((px - sample.b.x) ** 2 + (pz - sample.b.y) ** 2 < threshold * threshold) return true;
  }
  return false;
}

function createTerrain() {
  const terrainSegments = IS_MOBILE ? 140 : 200;
  const geo = new THREE.PlaneGeometry(200, 200, terrainSegments, terrainSegments);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    // PlaneGeometry is authored in XY, then rotated onto the XZ ground plane.
    // That rotation maps local +Y to world -Z, so sample every terrain helper
    // with the final world-space Z. Using local Y here mirrored the landscape
    // relative to the carpet and all placed assets, letting hills swallow them.
    const worldZ = -pos.getY(i);
    let h = getTerrainHeight(x, worldZ);
    let riverDepth = 0;
    for (const sample of RIVER_SAMPLES) {
      const dist = Math.hypot(x - sample.a.x, worldZ - sample.a.y);
      if (dist < sample.widthA) riverDepth = Math.max(riverDepth, (1 - dist / sample.widthA) * 2.5);
      const dist2 = Math.hypot(x - sample.b.x, worldZ - sample.b.y);
      if (dist2 < sample.widthB) riverDepth = Math.max(riverDepth, (1 - dist2 / sample.widthB) * 2.2);
    }
    h -= riverDepth;
    pos.setZ(i, h);
    const col = new THREE.Color();
    if (riverDepth > 0.5) col.setHSL(0.08, 0.3, 0.25);
    else if (h < -1) col.setHSL(0.28, 0.5, 0.22);
    else if (h < 2) col.setHSL(0.3, 0.55, 0.28 + Math.random() * 0.04);
    else if (h < 5) col.setHSL(0.25, 0.45, 0.3 + Math.random() * 0.03);
    else col.setHSL(0.22, 0.35, 0.32 + Math.random() * 0.03);
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  geo.rotateX(-Math.PI / 2);
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.92, metalness: 0.0, envMapIntensity: 0.3,
  }));
  terrain.receiveShadow = true;
  scene.add(terrain);
}
createTerrain();

function createRiverStream(getPoint, segments, widthBase, widthVar) {
  const points = [];
  for (let t = 0; t <= 1; t += 1 / segments) points.push(getPoint(t));
  const vertices = [], indices = [], uvs = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const t = i / (points.length - 1);
    let dir;
    if (i < points.length - 1) { const n = points[i + 1]; dir = new THREE.Vector2(n.x - p.x, n.y - p.y).normalize(); }
    else { const pr = points[i - 1]; dir = new THREE.Vector2(p.x - pr.x, p.y - pr.y).normalize(); }
    const perp = new THREE.Vector2(-dir.y, dir.x);
    const w = widthBase + Math.sin(t * 6) * widthVar;
    const waterH = Math.min(
      getTerrainHeight(p.x + perp.x * w, p.y + perp.y * w),
      getTerrainHeight(p.x - perp.x * w, p.y - perp.y * w),
      getTerrainHeight(p.x, p.y)
    ) + 0.15;
    vertices.push(p.x + perp.x * w, waterH, p.y + perp.y * w, p.x - perp.x * w, waterH, p.y - perp.y * w);
    uvs.push(0, t * 8, 1, t * 8);
    if (i < points.length - 1) { const vi = i * 2; indices.push(vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0x1a6080, roughness: 0.05, metalness: 0.7, transparent: true, opacity: 0.7,
    envMapIntensity: 1.5, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  scene.add(mesh);
  return mesh;
}
createRiverStream(getRiverPoint, 80, 2.0, 0.5);
createRiverStream(getRiverPoint2, 80, 1.5, 0.4);

// Lake + reflective ring. polygonOffset pushes the flat water under the sloped
// shore so the terrain reads as a clean bank instead of z-fighting at the rim.
const water = new THREE.Mesh(new THREE.CircleGeometry(15.5, 72), new THREE.MeshStandardMaterial({
  color: 0x1a6888, roughness: 0.02, metalness: 0.8, transparent: true, opacity: 0.82, envMapIntensity: 2.0,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
}));
water.rotation.x = -Math.PI / 2;
water.position.set(0, 0.32, 0);
scene.add(water);
// darker shelf ring blends the shoreline
const lakeEdge = new THREE.Mesh(new THREE.RingGeometry(14.5, 17.5, 72), new THREE.MeshStandardMaterial({
  color: 0x0d4455, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.5,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
}));
lakeEdge.rotation.x = -Math.PI / 2;
lakeEdge.position.set(0, 0.26, 0);
scene.add(lakeEdge);

// Golden sun-strip reflection on the lake, aimed toward the mandap
const sunReflection = new THREE.Mesh(new THREE.PlaneGeometry(5, 22), new THREE.MeshBasicMaterial({
  color: 0xffcc66, transparent: true, opacity: 0.22, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
}));
sunReflection.rotation.x = -Math.PI / 2;
sunReflection.position.set(-3, 0.26, -6);
scene.add(sunReflection);

// =====================================================================
//  Vegetation (kept) — now skips the ceremonial path & asset footprints
// =====================================================================
function createConifer(x, z, scale = 1) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15 * scale, 0.35 * scale, 3.5 * scale, 8),
    new THREE.MeshStandardMaterial({ color: 0x4a2e12, roughness: 0.95 })
  );
  trunk.position.y = 1.75 * scale; trunk.castShadow = !IS_MOBILE; group.add(trunk);
  const leafColors = [0x1d5422, 0x2a6b2e, 0x1a4d20, 0x286630];
  for (let i = 0; i < 4; i++) {
    const leafGeo = new THREE.ConeGeometry((2.5 - i * 0.5) * scale, (2.2 - i * 0.3) * scale, 7 + Math.floor(Math.random() * 3));
    const lp = leafGeo.attributes.position;
    for (let j = 0; j < lp.count; j++) {
      lp.setX(j, lp.getX(j) + (Math.random() - 0.5) * 0.2 * scale);
      lp.setZ(j, lp.getZ(j) + (Math.random() - 0.5) * 0.2 * scale);
    }
    leafGeo.computeVertexNormals();
    const leaf = new THREE.Mesh(leafGeo, new THREE.MeshStandardMaterial({ color: leafColors[i % 4], roughness: 0.85 }));
    leaf.position.y = (3.2 + i * 1.1) * scale; leaf.rotation.y = Math.random() * Math.PI; leaf.castShadow = !IS_MOBILE;
    group.add(leaf);
  }
  group.position.set(x, getTerrainHeight(x, z), z);
  return group;
}
for (let i = 0; i < 80; i++) {
  const x = (Math.random() - 0.5) * 130, z = (Math.random() - 0.5) * 130;
  if (x * x + z * z < 350) continue;
  if (isNearRiver(x, z, 4) || blocked(x, z, 11)) continue;
  scene.add(createConifer(x, z, 0.6 + Math.random() * 0.9));
}

function createDeciduous(x, z, scale = 1) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12 * scale, 0.25 * scale, 4 * scale, 6),
    new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.9 })
  );
  trunk.position.y = 2 * scale; trunk.castShadow = !IS_MOBILE; group.add(trunk);
  const canopyGeo = new THREE.IcosahedronGeometry(2.2 * scale, 2);
  const cp = canopyGeo.attributes.position;
  for (let j = 0; j < cp.count; j++) {
    cp.setX(j, cp.getX(j) + (Math.random() - 0.5) * 0.4 * scale);
    cp.setY(j, cp.getY(j) + (Math.random() - 0.5) * 0.3 * scale);
    cp.setZ(j, cp.getZ(j) + (Math.random() - 0.5) * 0.4 * scale);
  }
  canopyGeo.computeVertexNormals();
  const canopy = new THREE.Mesh(canopyGeo, new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.25 + Math.random() * 0.1, 0.5, 0.25 + Math.random() * 0.1), roughness: 0.85,
  }));
  canopy.position.y = 4.5 * scale; canopy.castShadow = !IS_MOBILE; group.add(canopy);
  group.position.set(x, getTerrainHeight(x, z), z);
  return group;
}
for (let i = 0; i < 30; i++) {
  const x = (Math.random() - 0.5) * 110, z = (Math.random() - 0.5) * 110;
  if (x * x + z * z < 350) continue;
  if (isNearRiver(x, z, 4) || blocked(x, z, 11)) continue;
  scene.add(createDeciduous(x, z, 0.5 + Math.random() * 0.7));
}

function createRock(x, z, s) {
  const geo = new THREE.DodecahedronGeometry(s, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * s * 0.35);
    pos.setY(i, pos.getY(i) * (0.5 + Math.random() * 0.3) + (Math.random() - 0.5) * s * 0.2);
    pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * s * 0.35);
  }
  geo.computeVertexNormals();
  const shade = 0.35 + Math.random() * 0.2;
  const rock = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: new THREE.Color(shade, shade * 0.95, shade * 0.9), roughness: 0.95, metalness: 0.02,
  }));
  rock.position.set(x, getTerrainHeight(x, z) + s * 0.2, z);
  rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * 0.5);
  rock.castShadow = !IS_MOBILE;
  scene.add(rock);
}
for (let t = 0; t < 1; t += 0.05) {
  if (Math.random() > 0.6) continue;
  const rp = getRiverPoint(t);
  const off = (Math.random() > 0.5 ? 1 : -1) * (2.5 + Math.random() * 2);
  const rx = rp.x + off, rz = rp.y + (Math.random() - 0.5) * 2;
  if (blocked(rx, rz, 1)) continue;
  createRock(rx, rz, 0.4 + Math.random() * 0.8);
}
for (let i = 0; i < 26; i++) {
  const x = (Math.random() - 0.5) * 100, z = (Math.random() - 0.5) * 100;
  if (x * x + z * z < 250) continue;
  if (isNearRiver(x, z, 3) || blocked(x, z, 1)) continue;
  createRock(x, z, 0.4 + Math.random() * 1.2);
}

// Wildflowers (kept, warmer palette, off the path)
const flowerGeo = new THREE.SphereGeometry(0.12, 5, 5);
const flowerColors = [PAL.marigold, PAL.rose, 0xffdd44, PAL.saffron, PAL.jasmine, 0xff4466, 0xffaa22];
flowerColors.forEach((col) => {
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, emissive: col, emissiveIntensity: 0.06 });
  const per = 44;
  const inst = new THREE.InstancedMesh(flowerGeo, mat, per);
  const dummy = new THREE.Object3D();
  let idx = 0;
  for (let i = 0; i < per; i++) {
    const x = (Math.random() - 0.5) * 90, z = (Math.random() - 0.5) * 90;
    if (x * x + z * z < 250) continue;
    if (isNearRiver(x, z, 3) || blocked(x, z, 0.5)) continue;
    dummy.position.set(x, getTerrainHeight(x, z) + 0.25, z);
    dummy.scale.setScalar(0.5 + Math.random() * 0.8);
    dummy.updateMatrix();
    inst.setMatrixAt(idx++, dummy.matrix);
  }
  inst.count = idx;
  scene.add(inst);
});

// Grass tufts (kept, reduced, off the path)
const grassGeo = new THREE.PlaneGeometry(0.15, 0.6);
grassGeo.translate(0, 0.3, 0);
const grassCount = IS_MOBILE ? 500 : 850;
const grass = new THREE.InstancedMesh(grassGeo, new THREE.MeshStandardMaterial({
  color: 0x3a7a2e, roughness: 0.9, side: THREE.DoubleSide, alphaTest: 0.5,
}), grassCount);
const gd = new THREE.Object3D();
let gi = 0;
for (let i = 0; i < grassCount; i++) {
  const x = (Math.random() - 0.5) * 100, z = (Math.random() - 0.5) * 100;
  if (x * x + z * z < 300) continue;
  if (isNearRiver(x, z, 2.5) || blocked(x, z, 0.5)) continue;
  gd.position.set(x, getTerrainHeight(x, z), z);
  gd.rotation.y = Math.random() * Math.PI * 2;
  gd.scale.set(0.8 + Math.random() * 0.6, 0.6 + Math.random() * 1.0, 1);
  gd.updateMatrix();
  grass.setMatrixAt(gi++, gd.matrix);
}
grass.count = gi;
scene.add(grass);

// =====================================================================
//  Mountains / clouds / birds / butterflies (kept)
// =====================================================================
function createMountain(x, z, height, width) {
  const group = new THREE.Group();
  const geo = new THREE.ConeGeometry(width, height, 8);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * width * 0.18);
    pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * width * 0.18);
    if (pos.getY(i) < height * 0.3) pos.setY(i, pos.getY(i) + (Math.random() - 0.5) * height * 0.08);
  }
  geo.computeVertexNormals();
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const nH = (pos.getY(i) + height / 2) / height;
    const col = new THREE.Color();
    if (nH > 0.8) col.setHSL(0, 0, 0.85 + Math.random() * 0.1);
    else if (nH > 0.6) col.lerpColors(new THREE.Color(0x556b6e), new THREE.Color(0xddeeff), (nH - 0.6) / 0.2);
    else col.setHSL(0.28, 0.3, 0.25 + nH * 0.15);
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mtn = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  mtn.position.set(x, height / 2 - 5, z); mtn.castShadow = !IS_MOBILE; group.add(mtn);
  for (let i = 0; i < 2; i++) {
    const rGeo = new THREE.ConeGeometry(width * (0.5 + Math.random() * 0.3), height * (0.5 + Math.random() * 0.3), 6);
    const ridge = new THREE.Mesh(rGeo, new THREE.MeshStandardMaterial({ color: 0x4a5a5e, roughness: 0.95, flatShading: true }));
    ridge.position.set(x + (Math.random() - 0.5) * width * 0.8, height * (0.2 + Math.random() * 0.15) - 5, z + (Math.random() - 0.5) * width * 0.3);
    group.add(ridge);
  }
  scene.add(group);
}
createMountain(-55, -75, 45, 22); createMountain(-28, -85, 55, 28); createMountain(5, -90, 50, 25);
createMountain(35, -80, 42, 20); createMountain(60, -75, 48, 23); createMountain(-70, -80, 35, 18);
createMountain(80, -70, 38, 19);

function createCloud(x, y, z) {
  const group = new THREE.Group();
  const col = new THREE.Color().setHSL(0.07, 0.4, 0.75 + Math.random() * 0.2);
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 1, transparent: true, opacity: 0.75, emissive: 0xff6633, emissiveIntensity: 0.15 });
  for (let i = 0; i < 5 + Math.floor(Math.random() * 5); i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(1.5 + Math.random() * 3, 10, 8), mat);
    puff.position.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 4);
    puff.scale.y = 0.5 + Math.random() * 0.2; group.add(puff);
  }
  group.position.set(x, y, z);
  return group;
}
const clouds = [];
for (let i = 0; i < 6; i++) {
  const c = createCloud((Math.random() - 0.5) * 180, 24 + Math.random() * 18, -40 + (Math.random() - 0.5) * 80);
  c.userData = { baseY: c.position.y, driftSpeed: 0.36 * (i % 2 === 0 ? 1 : 0.7) };
  scene.add(c); clouds.push(c);
}

const birds = [];
for (let i = 0; i < 5; i++) {
  const bird = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, side: THREE.DoubleSide });
  const wL = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.15), mat); wL.position.x = -0.6; bird.add(wL);
  const wR = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.15), mat); wR.position.x = 0.6; bird.add(wR);
  bird.position.set(-40 + Math.random() * 30, 30 + Math.random() * 14, -50 + Math.random() * 30);
  bird.userData = {
    phase: Math.random() * Math.PI * 2,
    speed: 0.3 + Math.random() * 0.5,
    baseY: bird.position.y,
  };
  scene.add(bird); birds.push(bird);
}

const butterflies = [];
for (let i = 0; i < 6; i++) {
  const group = new THREE.Group();
  const wingCol = [PAL.marigold, 0xffdd44, PAL.rose, 0x00bcd4, PAL.gold][Math.floor(Math.random() * 5)];
  const mat = new THREE.MeshStandardMaterial({ color: wingCol, side: THREE.DoubleSide, roughness: 0.3, emissive: wingCol, emissiveIntensity: 0.12 });
  const wL = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), mat); wL.position.x = -0.25; group.add(wL);
  const wR = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), mat); wR.position.x = 0.25; group.add(wR);
  group.position.set(6 + (Math.random() - 0.5) * 40, 3 + Math.random() * 5, -6 + (Math.random() - 0.5) * 40);
  group.userData = {
    baseX: group.position.x,
    baseY: group.position.y,
    baseZ: group.position.z,
    phase: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random(),
  };
  scene.add(group); butterflies.push(group);
}

// =====================================================================
//  ================  ROYAL BARAAT LAYER  ================
// =====================================================================

// --- Ceremonial pathway (world-space geometry, added at origin) -------
const path = createCeremonialPath({
  points: LAYOUT.path.points,
  width: LAYOUT.path.width,
  getHeight: getTerrainHeight,
  lift: CARPET_LIFT,
});
scene.add(path);

// Rangoli medallions at the mandap entrance and the procession start
const rangoliEntrance = createRangoli(3.2);
const rangoliEntrancePos = alignWelcomePoint([-2, -30]);
rangoliEntrance.position.set(
  rangoliEntrancePos[0],
  getSurfaceHeight(rangoliEntrancePos[0], rangoliEntrancePos[1]) + 0.02,
  rangoliEntrancePos[1]
);
scene.add(rangoliEntrance);
const rangoliStart = createRangoli(2.4);
rangoliStart.position.set(14, getSurfaceHeight(14, 44) + 0.02, 44);
scene.add(rangoliStart);

// --- Mandap (with a stone foundation pad so it seats cleanly) ---------
const MANDAP = LAYOUT.mandap;
const mandapBaseY = sampleMaxSurfaceHeight(MANDAP.pos[0], MANDAP.pos[1], 3.7);
// Tall enough to always bury into the slope, so the plinth never floats
const pad = new THREE.Mesh(
  new THREE.BoxGeometry(7.35, 12, 7.35),
  new THREE.MeshStandardMaterial({ color: PAL.cream, roughness: 0.9, metalness: 0.02 })
);
pad.position.set(MANDAP.pos[0], mandapBaseY + 0.04 - 6, MANDAP.pos[1]);
pad.rotation.y = faceAngle(MANDAP.pos[0], MANDAP.pos[1], WELCOME_FACE[0], WELCOME_FACE[1]);
pad.receiveShadow = true;
scene.add(pad);
mount(createMandap(), MANDAP, { y: mandapBaseY });

// Hero glow inside the mandap (the sacred fire) + processional warm light
const mandapLight = new THREE.PointLight(0xff7b2e, IS_MOBILE ? 2.0 : 2.6, 28, 2.0);
mandapLight.position.set(MANDAP.pos[0], mandapBaseY + 2.2, MANDAP.pos[1]);
scene.add(mandapLight);
const processionLight = new THREE.PointLight(0xffb04a, 1.3, 20, 2.0);
processionLight.position.set(
  LAYOUT.horseGroom.pos[0],
  getSurfaceHeight(LAYOUT.horseGroom.pos[0], LAYOUT.horseGroom.pos[1]) + 3,
  LAYOUT.horseGroom.pos[1]
);
scene.add(processionLight);

// --- Toran gates over the path ---------------------------------------
LAYOUT.toranGates.forEach((g) => mount(createToranGate(), g, { footprint: 3.2 }));

// --- Lamp pillars lining the path ------------------------------------
LAMP_POS.forEach((p) => mount(createCarvedPillar(), { pos: p }, { footprint: 0.9 }));

// One centered floral arch frames the mandap approach without trapping the
// bride-side dancers inside its columns. Seat it at its own contact point so
// the slight uphill aisle grade cannot make both columns appear to float.
const floralArchSpec = alignWelcomeSpec({ pos: [-2, -25.5], faceToward: [-2, -20] });
mount(createFloralArch(), floralArchSpec, {
  y: getSurfaceHeight(floralArchSpec.pos[0], floralArchSpec.pos[1]) + PROP_CLEARANCE,
});

function registerProcession(wrap, opts) {
  processionActors.push({
    wrap,
    locomotion: wrap.userData.locomotion,
    offset: opts.offset || 0,
    lane: opts.lane || 0,
    finalDistance: opts.finalDistance,
    finalLane: opts.finalLane ?? opts.lane ?? 0,
    faceCenter: !!opts.faceCenter,
    bob: opts.bob || 0,
    pose: {},
    initialized: false,
  });
  return wrap;
}

// --- The couple, the mount, the elephant (standing on the raised carpet) ---
const hgY = sampleMaxSurfaceHeight(LAYOUT.horseGroom.pos[0], LAYOUT.horseGroom.pos[1], 1.6) + ACTOR_CLEARANCE;
const horseAsset = createHorseGroom();
const horseWrap = mount(horseAsset, LAYOUT.horseGroom, { y: hgY });
registerProcession(horseWrap, { finalDistance: 83, bob: 0.025 });
const brideAsset = createBride();
const brideWrap = mount(brideAsset, LAYOUT.bride, {
  y: getSurfaceHeight(LAYOUT.bride.pos[0], LAYOUT.bride.pos[1]) + ACTOR_CLEARANCE,
});
const brideAisleYaw = brideWrap.rotation.y;

// Keep the warm processional light physically attached to the moving groom.
horseWrap.add(processionLight);
processionLight.position.set(0, 3, 0);

// Elephant directly behind the groom, carrying a fitted "TEAM GROOM" standard.
const elY = sampleMaxSurfaceHeight(LAYOUT.elephant.pos[0], LAYOUT.elephant.pos[1], 3.9) + ACTOR_CLEARANCE;
const elephantAsset = createElephant();
const elephantWrap = mount(elephantAsset, LAYOUT.elephant, { y: elY });
registerProcession(elephantWrap, { offset: -8, finalDistance: 59, bob: 0.018 });
const elephantBanner = createTeamGroomBanner('TEAM GROOM', { poleHeight: 1.0 });
// Mounted over the gaddi: readable from front and back, exactly within the
// elephant's width, and guaranteed to follow every turn of the procession.
elephantBanner.group.position.set(0, 3.18, -0.55);
elephantAsset.bannerMount.add(elephantBanner.group);
updaters.push(elephantBanner.update);

// --- Attendants (each with a ceremonial item) ------------------------
const attendantSlots = [
  { offset: -1, lane: -2.4, finalDistance: 81.5, finalLane: -2.4 },
  { offset: -1, lane: 2.4, finalDistance: 81.5, finalLane: 2.4 },
  { offset: 4, lane: -2.8, finalDistance: 68, finalLane: -2.7, faceCenter: true },
  { offset: 4, lane: 0, finalDistance: 68, finalLane: 0, faceCenter: false },
  { offset: 4, lane: 2.8, finalDistance: 68, finalLane: 2.7, faceCenter: true },
  // Keep the elephant escorts a full body-length behind while passing under
  // torans; they fan back out beside it only during the final welcome pose.
  { offset: -15, lane: -2.8, finalDistance: 59, finalLane: -3.4 },
  { offset: -15, lane: 2.8, finalDistance: 59, finalLane: 3.4 },
];
const attendantWraps = LAYOUT.attendants.map((a, i) =>
  mount(createAttendant({ item: a.item, phase: i * 0.7 }), a)
);
attendantSlots.forEach((slot, i) => registerProcession(attendantWraps[i], slot));

// Two musicians playing right beside the groom
const groomMusicianWraps = LAYOUT.groomMusicians.map((m, i) =>
  mount(createAttendant({ item: m.item, phase: 3 + i }), m)
);
registerProcession(groomMusicianWraps[0], { offset: -3, lane: -2.2, finalDistance: 78.5, finalLane: -1.8, faceCenter: true });
registerProcession(groomMusicianWraps[1], { offset: -3, lane: 2.2, finalDistance: 78.5, finalLane: 1.8, faceCenter: true });

// --- Coordinated dancers (two rows facing the groom) -----------------
const dancerWraps = LAYOUT.dancers.map((d, i) =>
  mount(createDancer({ variant: d.variant, phase: i * 0.8 }), { pos: d.pos, faceToward: LAYOUT.horseGroom.pos })
);
const dancerSlots = [
  { offset: 7, lane: -3, finalDistance: 64, finalLane: -4.4 },
  { offset: 7, lane: 3, finalDistance: 64, finalLane: 4.4 },
  { offset: 12, lane: -3, finalDistance: 72, finalLane: -4.4 },
  { offset: 12, lane: 3, finalDistance: 72, finalLane: 4.4 },
  { offset: 15, lane: -3.7, finalDistance: 80.5, finalLane: -4.4 },
  { offset: 15, lane: 3.7, finalDistance: 80.5, finalLane: 4.4 },
];
dancerSlots.forEach((slot, i) => registerProcession(dancerWraps[i], { ...slot, faceCenter: true }));
// Two female dancers flanking the bride so she is not isolated
LAYOUT.brideDancers.forEach((d, i) => mount(createDancer({ variant: d.variant, phase: 1 + i }), d));

// --- Guests / onlookers lining the procession ------------------------
LAYOUT.guests.forEach((g, i) => mount(createGuest({ variant: g.variant, phase: i * 1.1 }), g));

// --- Money thrower (paise udana) beside the groom --------------------
const moneyGuestAsset = createGuest({ variant: 'throwing', phase: 0.5, gender: 'male' });
const moneyGuestWrap = mount(moneyGuestAsset, LAYOUT.moneyThrower);
registerProcession(moneyGuestWrap, { offset: -5, lane: -3.1, finalDistance: 85, finalLane: -4.6, faceCenter: true });
const moneyEffect = createMoneyFountain({ origin: [0, 1.6, 0.35], ground: 0.05, count: IS_MOBILE ? 26 : 44 });
const _moneyHandWorld = new THREE.Vector3();
const _moneyHandLocal = new THREE.Vector3();
moneyEffect.group.visible = false;
moneyGuestWrap.add(moneyEffect.group);
updaters.push((t, dt) => {
  if (!moneyEffect.group.visible) return;
  const effectAge = Math.max(0, t - arrivalCueAt);
  if (effectAge > 10.2) {
    moneyEffect.group.visible = false;
    moneyGuestAsset.setCelebrating(false);
    return;
  }
  moneyGuestAsset.throwHand.getWorldPosition(_moneyHandWorld);
  _moneyHandLocal.copy(_moneyHandWorld);
  moneyGuestWrap.worldToLocal(_moneyHandLocal);
  moneyEffect.setOrigin(_moneyHandLocal.x, _moneyHandLocal.y, _moneyHandLocal.z, 0.05);
  moneyEffect.update(effectAge, dt);
});

// --- Firework launcher near the groom --------------------------------
const fireworkGuestWrap = mount(createGuest({ variant: 'cheering', phase: 2.3, gender: 'male' }), LAYOUT.fireworkGuy);
registerProcession(fireworkGuestWrap, { offset: -5, lane: 3.1, finalDistance: 85, finalLane: 4.6, faceCenter: true });
const fireworkEffect = createFirework({ origin: [0, 1.6, 0], rise: 13, cycle: 3.4 });
fireworkEffect.group.visible = false;
fireworkGuestWrap.add(fireworkEffect.group);
updaters.push((t) => {
  if (!fireworkEffect.group.visible) return;
  const effectAge = Math.max(0, t - arrivalCueAt);
  if (effectAge > 9.4) {
    fireworkEffect.group.visible = false;
    return;
  }
  fireworkEffect.update(effectAge);
});

// --- Small decor near the mandap: kalash, diyas, lanterns, garland ----
const welcomeEntrance = alignWelcomePoint([-2, -30]);
const entranceY = getSurfaceHeight(welcomeEntrance[0], welcomeEntrance[1]);

// Two auspicious kalash flanking the entrance
[-3.4, 3.4].forEach((offset) => {
  mount(createKalash(), { pos: alignWelcomePoint([-2 + offset, -30.4]) });
});

// Diyas along the entrance step + around the rangoli
for (let i = 0; i < 9; i++) {
  mount(createDiya(), { pos: alignWelcomePoint([-6 + i, -29.6]) });
}
// Keep the welcome lamps on the aisle-facing half of the rangoli. The rear
// half would otherwise intersect the mandap plinth on this compact terrace.
for (let i = 0; i < 5; i++) {
  const ang = (i / 4) * Math.PI;
  mount(createDiya(), {
    pos: alignWelcomePoint([-2 + Math.cos(ang) * 3.0, -30 + Math.sin(ang) * 3.0]),
  });
}

// Petal trays near the bride / entrance
mount(createPetalTray(), { pos: alignWelcomePoint([-3.6, -29]) });
mount(createPetalTray(), { pos: alignWelcomePoint([-0.4, -29]) });
mount(createPetalTray(), { pos: alignWelcomePoint([-2, -27.6]) });

// Hanging lanterns: two at the mandap entrance, one beneath each toran apex
const lanternSpots = [
  ...[-2.6, 2.6].map((offset) => {
    const pos = alignWelcomePoint([-2 + offset, -30.2]);
    return { pos, y: getSurfaceHeight(pos[0], pos[1]) + 3.1 };
  }),
  ...LAYOUT.toranGates.map((g) => ({ pos: g.pos, y: getSurfaceHeight(g.pos[0], g.pos[1]) + 3.6 })),
];
lanternSpots.forEach((s) => mount(createLantern(), { pos: s.pos }, { y: s.y }));

// A marigold+jasmine garland swagged across the mandap entrance
const garland = createHangingGarland(5.2, 'mixed');
const garlandPos = alignWelcomePoint([-2, -30.2]);
garland.position.set(garlandPos[0], entranceY + 3.0, garlandPos[1]);
garland.rotation.y = WELCOME_YAW;
scene.add(garland);

// --- Atmosphere: floating petals + volumetric god-rays ----------------
const petalSystem = createPetalSystem({
  area: LAYOUT.petalArea,
  top: mandapBaseY + 16,
  getHeight: getSurfaceHeight,
});
mount(petalSystem, { pos: [0, 0] }, { y: 0 });

const rays = createVolumetricRays({ origin: [SUN_POS.x, SUN_POS.y, SUN_POS.z], color: PAL.flame, count: IS_MOBILE ? 6 : 8 });
scene.add(rays.group);
if (rays.update) updaters.push(rays.update);

// --- Two white swans floating on the pond ----------------------------
LAYOUT.swans.forEach((s) => {
  const swan = createSwan(s.phase);
  const w = new THREE.Group();
  w.position.set(s.pos[0], 0.34, s.pos[1]); // float at the water surface
  w.add(swan.group);
  scene.add(w);
  updaters.push(swan.update);
});

// --- Aerial banner plane circling the whole world --------------------
const plane = createPlaneBanner(COUPLE.bride + ' weds ' + COUPLE.groom, { radius: 55, height: 30, speed: 0.085 });
scene.add(plane.group);
updaters.push(plane.update);

// =====================================================================
//  Procession director — transforms only; no cloned people or new meshes
// =====================================================================
let processionAnchor = PROCESSION.anchorStart;
const _actorCenter = { x: 0, z: 0 };
let arrivalCelebrationWaves = 0;
function setProcessionPhase(next) {
  if (processionPhase === next) return;
  processionPhase = next;
  setAudioPhase(next);
}
function triggerArrival(t) {
  if (arrivalCueFired) return;
  arrivalCueFired = true;
  arrivalCueAt = t;
  arrivalCelebrationWaves = 0;
  moneyGuestAsset.setCelebrating(true);
  moneyEffect.group.visible = true;
  fireworkEffect.group.visible = true;
  petalSystem.burst(
    (horseWrap.position.x + brideWrap.position.x) * 0.5,
    (horseWrap.position.z + brideWrap.position.z) * 0.5,
    8
  );
  playArrivalCue();
  const moment = document.getElementById('arrivalMoment');
  if (moment) {
    moment.setAttribute('aria-hidden', 'false');
    moment.classList.add('show');
    setTimeout(() => {
      moment.classList.remove('show');
      moment.setAttribute('aria-hidden', 'true');
    }, 5200);
  }
}
function updateProcession(t, dt) {
  let travelEase = 0;
  if (t < PROCESSION.holdEnd) {
    processionAnchor = PROCESSION.anchorStart;
    arrivalProgress = 0;
    setProcessionPhase('opening');
  } else if (t < PROCESSION.travelEnd) {
    travelEase = ease01((t - PROCESSION.holdEnd) / (PROCESSION.travelEnd - PROCESSION.holdEnd));
    processionAnchor = THREE.MathUtils.lerp(PROCESSION.anchorStart, PROCESSION.anchorEnd, travelEase);
    arrivalProgress = 0;
    setProcessionPhase('procession');
  } else if (t < PROCESSION.arrivalEnd) {
    processionAnchor = PROCESSION.anchorEnd;
    arrivalProgress = ease01((t - PROCESSION.travelEnd) / (PROCESSION.arrivalEnd - PROCESSION.travelEnd));
    setProcessionPhase('arrival');
  } else {
    processionAnchor = PROCESSION.anchorEnd;
    arrivalProgress = 1;
    setProcessionPhase('celebration');
  }

  const moving = processionPhase === 'procession' || processionPhase === 'arrival';
  let elephantGateBow = 0;
  for (let i = 0; i < processionActors.length; i++) {
    const actor = processionActors[i];
    const previousX = actor.wrap.position.x;
    const previousZ = actor.wrap.position.z;
    const wasInitialized = actor.initialized;
    const distance = arrivalProgress > 0
      ? THREE.MathUtils.lerp(PROCESSION.anchorEnd + actor.offset, actor.finalDistance, arrivalProgress)
      : processionAnchor + actor.offset;
    const stagedLane = arrivalProgress > 0
      ? THREE.MathUtils.lerp(actor.lane, actor.finalLane, arrivalProgress)
      : actor.lane;
    const lane = stagedLane * gateLaneScale(distance);
    if (actor.wrap === elephantWrap) elephantGateBow = ease01(gateProximity(distance));
    const pose = samplePathPose(distance, lane, actor.pose);
    let targetYaw = pose.yaw;
    if (actor.faceCenter && arrivalProgress > 0.45) {
      samplePathCenter(distance, _actorCenter);
      const inwardYaw = Math.atan2(_actorCenter.x - pose.x, _actorCenter.z - pose.z);
      targetYaw = lerpAngle(targetYaw, inwardYaw, ease01((arrivalProgress - 0.45) / 0.55));
    }
    const marchEnergy = moving ? (1 - arrivalProgress) : 0;
    const upOnlyBob = actor.bob
      ? (Math.sin(t * (actor === processionActors[0] ? 5.8 : 3.8) + i * 0.7) * 0.5 + 0.5) * actor.bob * marchEnergy
      : 0;
    actor.wrap.position.set(pose.x, pose.y + upOnlyBob, pose.z);
    if (actor.locomotion) {
      // The stride advances from actual ground distance, so feet stop during
      // holds, accelerate with the procession, and settle cleanly on arrival.
      const ds = wasInitialized
        ? Math.min(Math.hypot(pose.x - previousX, pose.z - previousZ), 0.4)
        : 0;
      const speed = dt > 0.0001 ? ds / dt : 0;
      actor.locomotion.phase += ds * actor.locomotion.gaitScale;
      const target = THREE.MathUtils.clamp(speed / 1.1, 0, 1);
      const gaitEase = 1 - Math.exp(-8 * Math.max(dt, 0.001));
      actor.locomotion.amount = THREE.MathUtils.lerp(actor.locomotion.amount, target, gaitEase);
    }
    if (!actor.initialized) {
      actor.wrap.rotation.y = targetYaw;
      actor.initialized = true;
    } else {
      const turnEase = 1 - Math.exp(-10 * Math.max(dt, 0.001));
      actor.wrap.rotation.y = lerpAngle(actor.wrap.rotation.y, targetYaw, turnEase);
    }
  }

  // The existing standard lowers like a real ceremonial banner beneath each
  // cusped toran, then rises again. This clears the hanging lobes without adding
  // geometry or shrinking its readable resting pose on the elephant.
  elephantBanner.group.rotation.x = -elephantGateBow * 1.4;
  elephantBanner.group.position.y = 3.18 - elephantGateBow * 0.1;

  const brideTurn = ease01((arrivalProgress - 0.12) / 0.68);
  const liveGroomYaw = faceAngle(
    brideWrap.position.x,
    brideWrap.position.z,
    horseWrap.position.x,
    horseWrap.position.z
  );
  brideWrap.rotation.y = lerpAngle(brideAisleYaw, liveGroomYaw, brideTurn);
  brideAsset.setArrival(ease01((arrivalProgress - 0.48) / 0.42));
  if (!arrivalCueFired && arrivalProgress >= 0.72) triggerArrival(t);
}

// =====================================================================
//  Camera intro fly-in + UI reveal
// =====================================================================
const camFrom = new THREE.Vector3(...LAYOUT.camera.introFrom);
const camTarget = new THREE.Vector3(...LAYOUT.camera.target);
const INTRO_DUR = LAYOUT.camera.introDurationSec;
let firstFrame = true;
const _directFocus = new THREE.Vector3();
const _directCamera = new THREE.Vector3();
const _coupleFocus = new THREE.Vector3();
const _cameraPathPose = {};
const _cameraBefore = { x: 0, z: 0 };
const _cameraAfter = { x: 0, z: 0 };
const _followFromPosition = new THREE.Vector3();
const _followFromTarget = new THREE.Vector3();
let introInterrupted = false;
let followBlend = 1;

// One lightweight camera rig creates a complete cinematic sequence without
// adding cameras, render passes or scene assets. The final angle is the first
// angle plus one full turn, so the 26-second loop joins without a visible cut.
const FOLLOW_CYCLE_SEC = 26;
const CAMERA_SHOTS = [
  { at: 0, angle: -0.45, radius: 24, height: 14, elephant: 0 },
  { at: 0.18, angle: 0.95, radius: 11.5, height: 6.3, elephant: 0 },
  { at: 0.38, angle: 2.0, radius: 15, height: 8.5, elephant: 1 },
  { at: 0.60, angle: 2.65, radius: 14, height: 7.2, elephant: 0 },
  { at: 0.80, angle: 4.2, radius: 20, height: 12.5, elephant: 0 },
  { at: 1, angle: Math.PI * 2 - 0.45, radius: 24, height: 14, elephant: 0 },
];
const _cameraShot = { angle: 0, radius: 0, height: 0, elephant: 0 };
let followShotClock = 0;

function sampleCameraShot(progress, out) {
  let hi = 1;
  while (hi < CAMERA_SHOTS.length - 1 && progress > CAMERA_SHOTS[hi].at) hi++;
  const from = CAMERA_SHOTS[hi - 1];
  const to = CAMERA_SHOTS[hi];
  const mix = ease01((progress - from.at) / (to.at - from.at));
  out.angle = THREE.MathUtils.lerp(from.angle, to.angle, mix);
  out.radius = THREE.MathUtils.lerp(from.radius, to.radius, mix);
  out.height = THREE.MathUtils.lerp(from.height, to.height, mix);
  out.elephant = THREE.MathUtils.lerp(from.elephant, to.elephant, mix);
  return out;
}

// Full 360° orbit — explore from any angle. Pan enabled, tilt from overhead to
// just above the ground (never under it).
controls.enablePan = true;
controls.screenSpacePanning = false;
controls.minPolarAngle = 0.05;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.minDistance = 6;
controls.maxDistance = 150;
controls.autoRotateSpeed = 0.35;
// Idle-cinematic: after a few still seconds, a slow orbit resumes; any input stops it.
let interacting = false;
let idleTimer = 0;
const IDLE_DELAY = 4.0;
const followButton = document.getElementById('followBtn');
function releaseCameraFollow() {
  cameraFollowing = false;
  introInterrupted = true;
  controls.autoRotate = false;
  idleTimer = 0;
  followButton?.classList.add('show');
}
function resumeCameraFollow() {
  _followFromPosition.copy(camera.position);
  _followFromTarget.copy(controls.target);
  followBlend = 0;
  followShotClock = 0;
  introInterrupted = true;
  cameraFollowing = true;
  interacting = false;
  controls.autoRotate = false;
  idleTimer = 0;
  followButton?.classList.remove('show');
}
function updateDirectedCamera(t, dt) {
  const introActive = !introInterrupted && t < INTRO_DUR;
  if (!introActive) {
    // Clamp long background-tab frames so returning to the page cannot skip a
    // camera angle or snap midway through an orbit.
    followShotClock = (followShotClock + Math.min(Math.max(dt, 0), 0.05)) % FOLLOW_CYCLE_SEC;
  }
  sampleCameraShot(followShotClock / FOLLOW_CYCLE_SEC, _cameraShot);

  const arrivalShot = ease01((arrivalProgress - 0.08) / 0.82);
  const elephantShot = _cameraShot.elephant * (1 - arrivalShot);
  const lookAhead = THREE.MathUtils.lerp(4, 1.5, arrivalShot);
  // The elephant keyframe temporarily eases the target eight path units back.
  // Arrival progressively hands focus back to the couple exactly as before.
  const cameraPathDistance = THREE.MathUtils.lerp(processionAnchor + lookAhead, 84, arrivalShot)
    - elephantShot * 8;
  samplePathPose(cameraPathDistance, 0, _cameraPathPose);
  _directFocus.set(
    _cameraPathPose.x,
    _cameraPathPose.y + 2.35 + elephantShot * 1.2,
    _cameraPathPose.z
  );
  if (arrivalShot > 0) {
    const coupleX = (horseWrap.position.x + brideWrap.position.x) * 0.5;
    const coupleY = Math.max(horseWrap.position.y + 2, brideWrap.position.y + 1.4);
    const coupleZ = (horseWrap.position.z + brideWrap.position.z) * 0.5;
    _coupleFocus.set(coupleX, coupleY, coupleZ);
    _directFocus.lerp(_coupleFocus, arrivalShot);
  }
  // A wider derivative window rounds the path's corners for the camera. The
  // actors can turn promptly, while the viewer gets a steadier, human dolly.
  samplePathCenter(cameraPathDistance - 3, _cameraBefore);
  samplePathCenter(cameraPathDistance + 3, _cameraAfter);
  let tangentX = _cameraAfter.x - _cameraBefore.x;
  let tangentZ = _cameraAfter.z - _cameraBefore.z;
  const tangentLength = Math.hypot(tangentX, tangentZ) || 1;
  tangentX /= tangentLength;
  tangentZ /= tangentLength;
  const normalX = -tangentZ;
  const normalZ = tangentX;
  // Blend continuously between landscape and portrait framing so rotating a
  // phone never causes a sudden camera jump.
  const portraitMix = 1 - THREE.MathUtils.smoothstep(camera.aspect, 0.65, 0.95);
  const radius = _cameraShot.radius + portraitMix * 3.5;
  let sideOffset = Math.sin(_cameraShot.angle) * radius
    * THREE.MathUtils.lerp(1, 0.88, portraitMix);
  const backOffset = Math.cos(_cameraShot.angle) * radius;
  let heightOffset = _cameraShot.height + portraitMix * 2.2;
  // Very small, slow shoulder movement keeps the shot alive without looking
  // like procedural camera shake.
  sideOffset += Math.sin(t * 0.28) * THREE.MathUtils.lerp(0.16, 0.08, portraitMix);
  heightOffset += Math.sin(t * 0.22 + 1.1) * 0.07;
  _directCamera.set(
    _directFocus.x + normalX * sideOffset - tangentX * backOffset,
    _directFocus.y + heightOffset,
    _directFocus.z + normalZ * sideOffset - tangentZ * backOffset
  );
  // Keep close shots above rolling terrain without adding a raycast or physics
  // query. This is a scalar height lookup already used throughout the world.
  _directCamera.y = Math.max(
    _directCamera.y,
    getSurfaceHeight(_directCamera.x, _directCamera.z) + 2.4
  );

  if (introActive) {
    const e = ease01(t / INTRO_DUR);
    camera.position.lerpVectors(camFrom, _directCamera, e);
    controls.target.lerpVectors(camTarget, _directFocus, e);
  } else if (followBlend < 1) {
    followBlend = Math.min(1, followBlend + Math.max(dt, 0.001) / 1.45);
    const e = ease01(followBlend);
    camera.position.lerpVectors(_followFromPosition, _directCamera, e);
    controls.target.lerpVectors(_followFromTarget, _directFocus, e);
  } else {
    const frameDt = Math.max(dt, 0.001);
    const positionK = 1 - Math.exp(-1.8 * frameDt);
    const targetK = 1 - Math.exp(-3 * frameDt);
    camera.position.lerp(_directCamera, positionK);
    controls.target.lerp(_directFocus, targetK);
  }
  controls.autoRotate = false;
  controls.update();
}

// --- Free roam ---------------------------------------------------------
// WASD / arrows fly through the world. This moves the camera AND the orbit
// pivot together, so you're never stuck circling one fixed point in the middle.
const keys = Object.create(null);
const ROAM_CODES = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'ShiftLeft', 'ShiftRight',
]);
window.addEventListener('keydown', (e) => {
  if (!ROAM_CODES.has(e.code)) return;
  releaseCameraFollow();
  keys[e.code] = true;
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
window.addEventListener('keyup', (e) => { if (ROAM_CODES.has(e.code)) keys[e.code] = false; });

const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _move = new THREE.Vector3();
function updateRoam(dt) {
  _fwd.subVectors(controls.target, camera.position);
  _fwd.y = 0;
  if (_fwd.lengthSq() < 1e-6) return;
  _fwd.normalize();
  _right.set(-_fwd.z, 0, _fwd.x); // forward × up
  _move.set(0, 0, 0);
  if (keys['KeyW'] || keys['ArrowUp']) _move.add(_fwd);
  if (keys['KeyS'] || keys['ArrowDown']) _move.sub(_fwd);
  if (keys['KeyD'] || keys['ArrowRight']) _move.add(_right);
  if (keys['KeyA'] || keys['ArrowLeft']) _move.sub(_right);
  if (keys['KeyE'] || keys['Space']) _move.y += 1;
  if (keys['KeyQ']) _move.y -= 1;
  if (_move.lengthSq() === 0) return;
  const speed = (keys['ShiftLeft'] || keys['ShiftRight']) ? 34 : 13;
  _move.normalize().multiplyScalar(speed * dt);
  camera.position.add(_move);
  controls.target.add(_move);
  // never sink through the ground
  const floor = getSurfaceHeight(camera.position.x, camera.position.z) + 1.5;
  if (camera.position.y < floor) {
    const d = floor - camera.position.y;
    camera.position.y += d;
    controls.target.y += d;
  }
  controls.autoRotate = false;
  idleTimer = 0;
  if (elTitle) elTitle.classList.add('gone');
}

const elLoading = document.getElementById('loading');
const elTitle = document.getElementById('titlecard');
const elHint = document.getElementById('hint');
const elInteractionTip = document.getElementById('interactionTip');
const elInteractionTipText = document.getElementById('interactionTipText');
let interactionTipHideTimer = 0;
let firstOrbitTipShown = false;
let loaderSettled = false;
let portalAudioIntent = null;
let portalAudioTime = 0;
try {
  const legacyIntent = sessionStorage.getItem('wedding-world-audio-intent');
  const savedState = JSON.parse(sessionStorage.getItem('wedding-world-audio-state') || 'null');
  portalAudioIntent = savedState?.intent || legacyIntent;
  if (Number.isFinite(Number(savedState?.currentTime))) {
    const elapsed = Number.isFinite(Number(savedState?.capturedAt))
      ? Math.min(8, Math.max(0, (Date.now() - Number(savedState.capturedAt)) / 1000))
      : 0;
    portalAudioTime = Math.max(0, Number(savedState.currentTime) + elapsed);
  }
  sessionStorage.removeItem('wedding-world-audio-intent');
  sessionStorage.removeItem('wedding-world-audio-state');
} catch { /* storage is optional; the world still opens directly */ }

function hideWorldLoader() {
  if (loaderSettled) return;
  loaderSettled = true;
  if (elLoading) {
    elLoading.classList.add('hidden');
  }
}

function hideInteractionTip() {
  if (!elInteractionTip) return;
  if (interactionTipHideTimer) {
    clearTimeout(interactionTipHideTimer);
    interactionTipHideTimer = 0;
  }
  elInteractionTip.classList.remove('show');
  elInteractionTip.setAttribute('aria-hidden', 'true');
}

function showInteractionTip(message, duration = 3400) {
  if (!IS_MOBILE || !elInteractionTip || !elInteractionTipText || document.hidden) return;
  if (interactionTipHideTimer) clearTimeout(interactionTipHideTimer);
  elInteractionTipText.textContent = message;
  elInteractionTip.setAttribute('aria-hidden', 'false');
  elInteractionTip.classList.add('show');
  interactionTipHideTimer = window.setTimeout(hideInteractionTip, duration);
}

function scheduleMobileInteractionTips() {
  if (!IS_MOBILE) return;
  window.setTimeout(() => showInteractionTip('Drag one finger to look around', 3200), 7200);
  window.setTimeout(() => showInteractionTip('Pinch with two fingers to move closer', 3400), 14500);
}

controls.addEventListener('start', () => {
  interacting = true;
  releaseCameraFollow();
  if (elTitle) elTitle.classList.add('gone');
  if (elHint) elHint.classList.add('gone');
  hideInteractionTip();
});
controls.addEventListener('end', () => {
  interacting = false;
  idleTimer = 0;
  if (IS_MOBILE && !firstOrbitTipShown) {
    firstOrbitTipShown = true;
    window.setTimeout(() => {
      if (!cameraFollowing) {
        showInteractionTip('Tap Follow baraat to return to the cinematic', 3600);
      }
    }, 900);
  }
});

renderer.domElement.addEventListener('pointerdown', hideInteractionTip, { passive: true });
followButton?.addEventListener('click', () => {
  hideInteractionTip();
  resumeCameraFollow();
});
function clearNavigationState() {
  for (const code of ROAM_CODES) keys[code] = false;
}
window.addEventListener('blur', clearNavigationState);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  clearNavigationState();
  hideInteractionTip();
});

// =====================================================================
//  Piano-led ceremonial soundscape with lightweight synthesized wedding cues
// =====================================================================
const weddingSoundscape = createWeddingSoundscape({
  button: document.getElementById('soundBtn'),
  initialTrackTime: portalAudioTime,
});
/* The score starts by itself: attempt immediately (works when the browser
   honors it), and the soundscape's own unlock listeners catch the first
   natural gesture on stricter mobile browsers. Only an explicit mute from
   the invitation keeps the world silent. */
if (portalAudioIntent === 'muted') weddingSoundscape.stayMuted();
else weddingSoundscape.start();

function setAudioPhase(next, immediate = false) {
  weddingSoundscape.setPhase(next, immediate);
}
function playArrivalCue() {
  weddingSoundscape.playArrivalCue();
}
// =====================================================================
//  Animation loop
// =====================================================================
const clock = new THREE.Clock();
let sceneTime = 0;

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  sceneTime += dt;
  const t = sceneTime;

  // Ambient world motion (kept)
  water.material.color.setHSL(0.52, 0.55, 0.3 + Math.sin(t * 0.3) * 0.03);
  sunReflection.material.opacity = 0.16 + Math.sin(t * 2) * 0.07;
  sunReflection.scale.x = 1 + Math.sin(t * 1.5) * 0.2;
  clouds.forEach((c, i) => {
    c.position.x += c.userData.driftSpeed * dt;
    if (c.position.x > 100) c.position.x = -100;
    c.position.y = c.userData.baseY + Math.sin(t * 0.3 + i) * 0.24;
  });
  butterflies.forEach((b) => {
    const d = b.userData;
    b.position.x = d.baseX + Math.sin(t * d.speed + d.phase) * 1.25;
    b.position.z = d.baseZ + Math.cos(t * d.speed * 0.87 + d.phase) * 1.05;
    b.position.y = d.baseY + Math.sin(t * 2 + d.phase) * 0.5;
    b.rotation.y = t * d.speed;
    const f = Math.sin(t * 12 + d.phase) * 0.6;
    b.children[0].rotation.y = f; b.children[1].rotation.y = -f;
  });
  birds.forEach((bird) => {
    const bd = bird.userData;
    bird.position.x += bd.speed * 2 * dt;
    bird.position.y = bd.baseY + Math.sin(t * 1.5 + bd.phase) * 0.35;
    if (bird.position.x > 60) bird.position.x = -60;
    const wf = Math.sin(t * 4 + bd.phase) * 0.4;
    bird.children[0].rotation.z = wf; bird.children[1].rotation.z = -wf;
  });

  // Move every existing baraat member first, then let each asset apply its own
  // dance, instrument, breathing and fabric animation inside that wrapper.
  updateProcession(t, dt);

  // Firelight flicker plus a brief light/bloom crescendo at the welcome.
  const cueAge = t - arrivalCueAt;
  // Two follow-up showers reuse the same petal instances. This makes the
  // welcome feel layered and grand without adding geometry or draw calls.
  if (cueAge >= 1.65 && !(arrivalCelebrationWaves & 1)) {
    arrivalCelebrationWaves |= 1;
    petalSystem.burst(horseWrap.position.x, horseWrap.position.z, IS_MOBILE ? 5.2 : 6.4);
  }
  if (cueAge >= 3.85 && !(arrivalCelebrationWaves & 2)) {
    arrivalCelebrationWaves |= 2;
    petalSystem.burst(brideWrap.position.x, brideWrap.position.z, IS_MOBILE ? 4.8 : 5.8);
  }
  const arrivalEnvelope = cueAge >= 0 && cueAge < 6.4
    ? Math.sin(Math.PI * cueAge / 6.4)
    : 0;
  const arrivalPulse = arrivalEnvelope > 0
    ? arrivalEnvelope * (0.72 + Math.pow(Math.sin(cueAge * 7.5), 2) * 0.28)
    : 0;
  mandapLight.intensity = (IS_MOBILE ? 2.0 : 2.6)
    + Math.sin(t * 9) * 0.25 + Math.sin(t * 23) * 0.12 + arrivalPulse * (IS_MOBILE ? 2.25 : 2.8);
  processionLight.intensity = 1.3 + arrivalPulse * (IS_MOBILE ? 1.25 : 1.8);
  warmFill.intensity = 0.45 + arrivalPulse * 0.28;
  rimLight.intensity = 0.5 + arrivalPulse * 0.34;
  bloomPass.strength = 0.58 + arrivalPulse * (IS_MOBILE ? 0.24 : 0.46);

  // Baraat asset updaters
  for (let i = 0; i < updaters.length; i++) updaters[i](t, dt);

  // The cinematic follows by default; orbit/pinch gestures or desktop keyboard
  // movement take ownership. The small Follow button restores the directed view.
  if (cameraFollowing) {
    updateDirectedCamera(t, dt);
  } else {
    updateRoam(dt);
    if (!interacting) {
      idleTimer += dt;
      if (!IS_MOBILE && idleTimer > IDLE_DELAY) controls.autoRotate = true;
    }
    controls.update();
  }

  composer.render();

  if (firstFrame) {
    firstFrame = false;
    hideWorldLoader();
    // Let the title breathe, then fade it out
    setTimeout(() => { if (elTitle) elTitle.classList.add('gone'); }, (INTRO_DUR + 2) * 1000);
    if (IS_MOBILE) scheduleMobileInteractionTips();
    else setTimeout(() => { if (elHint) elHint.classList.add('gone'); }, 14000);
  }
}
renderer.setAnimationLoop(animate);

// =====================================================================
//  Resize
// =====================================================================
let resizeFrame = 0;
let renderedWidth = window.innerWidth;
let renderedHeight = window.innerHeight;
window.addEventListener('resize', () => {
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (width === renderedWidth && height === renderedHeight) return;
    renderedWidth = width;
    renderedHeight = height;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    composer.setSize(width, height);
    if (fxaaPass) {
      const dpr = renderer.getPixelRatio();
      fxaaPass.uniforms['resolution'].value.set(1 / (width * dpr), 1 / (height * dpr));
    }
  });
});
