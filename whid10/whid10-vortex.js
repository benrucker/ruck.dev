// The You exhibit's pixelated vortex sphere, ported from
// app/you/{three/vortexShader.ts, three/createBiasedSphereGeometry.ts,
// components/VortexSphere.tsx, components/PixelatedSphereRenderPass.tsx,
// config/*.ts}. Three.js arrives through the import map in index.html.
import * as THREE from "three";

const SPHERE_RADIUS = 3;
const SPHERE_SEGMENTS = 64;
const SPHERE_SOUTH_POLE_BIAS = 2;
const DISPLACEMENT_SCALE = 0.1;
const SPHERE_BIAS_MIX_NEAR = SPHERE_RADIUS;
const SPHERE_BIAS_MIX_FAR = SPHERE_RADIUS * 4;
const FOG_NEAR = 1.0;
const FOG_FAR = 6.0;
const VORTEX_PIXEL_SIZE = 8;
const SPHERE_LAYER = 1;
const CAMERA = {
  far: 20,
  fov: 65,
  near: 0.01,
  position: [0, -2.45, 1],
  rotationX: THREE.MathUtils.degToRad(-13),
};

// The museum's intro fly-in (app/you/components/AnimatedIntroCamera.tsx),
// driven by scroll through the You section's .you-scroll track instead of
// the clock: pinned progress 0..1 maps linearly onto this timeline (ms):
//   0 – 2800     approach: a straight line from INTRO_CAMERA.position to
//                the sphere surface, hermiteEase(t, 0, 0.4), fov 40,
//                looking along the line at the sphere center.
//   2800         boundary: fog snaps INTRO_FOG_* → FOG_* (no lerp; see
//                hooks/useIntroOrchestration.ts).
//   2800 – 7000  descent: a straight line from the surface to
//                CAMERA.position, smoothStop(t, 1.5); the look direction
//                lerps from the descent direction to CAMERA's -13° pitch
//                and fov ramps 40 → 65 with the same easing.
//   7000 – 9400  first tarot card's entrance (config/cardAnimation.ts:
//                2400 ms, easeOutCubic; the next card staggers 500 ms).
//                The DOM card and copy take those two slots in whid10.css.
// The two lines meet at the surface with a sharp kink on purpose.
const INTRO_CAMERA = {
  // config/cameras.ts. The museum's canvas is created with this camera and
  // never restores CAMERA.far, so far stays 40 throughout.
  far: 40,
  fov: 40,
  near: 0.01,
  position: [0.0, 3.02, 20.281],
};
const INTRO_FOG_NEAR = 8.0; // config/vortex.ts
const INTRO_FOG_FAR = 40.0;
const APPROACH_DURATION_MS = 2800; // AnimatedIntroCamera.tsx
const DESCENT_DURATION_MS = 4200;
const APPROACH_V0 = 0; // hermite endpoint velocities
const APPROACH_V1 = 0.4;
const DESCENT_V0 = 1.5; // smoothStop start velocity
const START_LOOK_AT = [0, 0, 0];
const CARD_ENTRANCE_STAGGER_MS = 500; // config/cardAnimation.ts
const CARD_ENTRANCE_DURATION_MS = 2400;
const INTRO_DURATION_MS = APPROACH_DURATION_MS + DESCENT_DURATION_MS;
// What the pinned scroll spans: the intro, then the card and copy
// entrances. whid10.css's animation-range percentages are these ms over
// TIMELINE_MS.
const TIMELINE_MS = INTRO_DURATION_MS + CARD_ENTRANCE_STAGGER_MS + CARD_ENTRANCE_DURATION_MS;

// utils/hermiteEase.ts: cubic Hermite (0,0)→(1,1) with endpoint velocities.
function hermiteEase(t, v0, v1) {
  const t2 = t * t;
  const t3 = t2 * t;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h10 * v0 + h01 + h11 * v1;
}

// utils/smoothStop.ts: quartic ease with zero velocity and acceleration at t=1.
function smoothStop(t, v0) {
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  return (3 - v0) * t4 + (3 * v0 - 8) * t3 + (6 - 3 * v0) * t2 + v0 * t;
}

// AnimatedIntroCamera.tsx computeLookAt: the point one unit ahead of a
// camera posed by CAMERA (rotation applied as a YXZ Euler).
function computeLookAt(position, rotationX) {
  const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(rotationX, 0, 0, "YXZ"));
  return new THREE.Vector3(...position).add(forward);
}

const sharedGlsl = /* glsl */ `
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), u.x),
                 mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), u.x), u.y),
             mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), u.x),
                 mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), u.x), u.y), u.z);
}

#define OCTAVES 5
float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < OCTAVES; i++) {
    value += amplitude * noise(p);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

const float TIME_SCALE      = 0.7;
const float SPIN_SPEED      = -0.15;
const float POLE_EPSILON    = 0.15;
const float SPIRAL_PITCH    = 2.5;

const float NOISE_SCALE     = 4.0;
const float Q_TIME_SCALE    = 0.1;
const float R_WARP_STRENGTH = 2.0;
const vec3  R_OFFSET_X      = vec3(1.7, 9.2, 0.0);
const vec3  R_OFFSET_Y      = vec3(8.3, 2.8, 0.0);
const vec3  R_OFFSET_Z      = vec3(3.1, 5.4, 0.0);
const float R_TIME_X        = 0.05;
const float R_TIME_Y        = 0.026;
const float R_TIME_Z        = 0.23;

const vec3  COLOR_A         = vec3(0.2, 0.101961, 1.0);
const vec3  COLOR_B         = vec3(0.4, 0.1, 0.2);
const float COLOR_AB_POWER  = 4.0;
const vec3  COLOR_SHADOW    = vec3(0.18, 0.0, 0.3);
const vec3  COLOR_HIGHLIGHT = vec3(0.9, 0.6, 0.9);

const float DRAIN_DARK_RADIUS = 0.075;
const float DRAIN_DARK_FLOOR  = 1.5;

const float CURVE_MID       = 1.;
const float CURVE_LOW       = 2.;
`;

const vertexShader =
  sharedGlsl +
  `const float DISPLACEMENT_SCALE = ${DISPLACEMENT_SCALE.toFixed(4)};\n` +
  `const float SPHERE_RADIUS = ${SPHERE_RADIUS.toFixed(4)};\n` +
  `const float SPHERE_BIAS_MIX_NEAR = ${SPHERE_BIAS_MIX_NEAR.toFixed(4)};\n` +
  `const float SPHERE_BIAS_MIX_FAR = ${SPHERE_BIAS_MIX_FAR.toFixed(4)};\n` +
  /* glsl */ `
attribute vec3 aUniformPos;

varying vec3 vWorldPos;
varying vec3 vTexNormal;

uniform float iTime;

void main() {
  float camDist = length(cameraPosition);
  float biasMix = smoothstep(SPHERE_BIAS_MIX_FAR, SPHERE_BIAS_MIX_NEAR, camDist);
  vec3 sphereLocal =
    normalize(mix(aUniformPos, position, biasMix)) * SPHERE_RADIUS;

  vec3 worldPosition = (modelMatrix * vec4(sphereLocal, 1.0)).xyz;
  vec3 texNormal = -normalize(worldPosition);

  float aTime = iTime * TIME_SCALE;

  float r = length(texNormal.xz);
  float poleDist = acos(texNormal.y);

  float theta = atan(texNormal.z, texNormal.x);
  float logR  = log(r + POLE_EPSILON);
  float spiralTheta = theta + SPIRAL_PITCH * logR + aTime * SPIN_SPEED;

  vec2  spiralXZ  = r * vec2(cos(spiralTheta), sin(spiralTheta));
  vec3  spiralPos = vec3(spiralXZ.x, poleDist - iTime * 0.03, spiralXZ.y);

  vec3 st = spiralPos * NOISE_SCALE;

  vec3 q = vec3(0.0);
  q.x = fbm(st + Q_TIME_SCALE * aTime);
  q.y = fbm(st + vec3(1.0, 0.0, 0.0));
  q.z = fbm(st + vec3(0.0, 1.0, 0.0));

  vec3 rw = vec3(0.0);
  rw.x = fbm(st + R_WARP_STRENGTH * q + R_OFFSET_X + R_TIME_X * aTime);
  rw.y = fbm(st + R_WARP_STRENGTH * q + R_OFFSET_Y + R_TIME_Y * aTime);
  rw.z = fbm(st + R_WARP_STRENGTH * q + R_OFFSET_Z + R_TIME_Z * aTime);

  float f = fbm(st + rw);

  vec3 col = mix(COLOR_A, COLOR_B, clamp(f * f * COLOR_AB_POWER, 0.0, 1.0));
  col = mix(col, COLOR_SHADOW,    clamp(length(q),  0.0, 1.0));
  col = mix(col, COLOR_HIGHLIGHT, clamp(length(rw.x), 0.0, 1.0));

  float drainProximity = exp(-r * r / (DRAIN_DARK_RADIUS * DRAIN_DARK_RADIUS));
  float drainMask = smoothstep(0.0, DRAIN_DARK_FLOOR, f / drainProximity);
  col *= mix(1.0, drainMask, drainProximity);

  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float curve = lum * lum * lum + CURVE_MID * lum * lum + CURVE_LOW * lum;
  float brightness = lum * curve;

  vec3 worldDisplacedPos = worldPosition + texNormal * brightness * DISPLACEMENT_SCALE;

  vWorldPos = worldDisplacedPos;
  vTexNormal = texNormal;
  gl_Position = projectionMatrix * viewMatrix * vec4(worldDisplacedPos, 1.0);
}
`;

const fragmentShader =
  sharedGlsl +
  /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vTexNormal;

uniform float iTime;
uniform float uFogNear;
uniform float uFogFar;

const vec3  FOG_COLOR       = vec3(0.03, 0.01, 0.06);

void main() {
  vec3 texNormal = normalize(vTexNormal);

  float aTime = iTime * TIME_SCALE;

  float r = length(texNormal.xz);
  float poleDist = acos(texNormal.y);

  float theta = atan(texNormal.z, texNormal.x);
  float logR  = log(r + POLE_EPSILON);
  float spiralTheta = theta + SPIRAL_PITCH * logR + aTime * SPIN_SPEED;

  vec2  spiralXZ  = r * vec2(cos(spiralTheta), sin(spiralTheta));
  vec3  spiralPos = vec3(spiralXZ.x, poleDist - iTime * 0.03, spiralXZ.y);

  vec3 st = spiralPos * NOISE_SCALE;

  vec3 q = vec3(0.0);
  q.x = fbm(st + Q_TIME_SCALE * aTime);
  q.y = fbm(st + vec3(1.0, 0.0, 0.0));
  q.z = fbm(st + vec3(0.0, 1.0, 0.0));

  vec3 rw = vec3(0.0);
  rw.x = fbm(st + R_WARP_STRENGTH * q + R_OFFSET_X + R_TIME_X * aTime);
  rw.y = fbm(st + R_WARP_STRENGTH * q + R_OFFSET_Y + R_TIME_Y * aTime);
  rw.z = fbm(st + R_WARP_STRENGTH * q + R_OFFSET_Z + R_TIME_Z * aTime);

  float f = fbm(st + rw);

  vec3 col = mix(COLOR_A, COLOR_B, clamp(f * f * COLOR_AB_POWER, 0.0, 1.0));
  col = mix(col, COLOR_SHADOW,    clamp(length(q),  0.0, 1.0));
  col = mix(col, COLOR_HIGHLIGHT, clamp(length(rw.x), 0.0, 1.0));

  float drainProximity = exp(-r * r / (DRAIN_DARK_RADIUS * DRAIN_DARK_RADIUS));
  float drainMask = smoothstep(0.0, DRAIN_DARK_FLOOR, f / drainProximity);
  col *= mix(1.0, drainMask, drainProximity);

  float dist = length(cameraPosition - vWorldPos);
  float fogFactor = smoothstep(uFogNear, uFogFar, dist);
  col = mix(col, FOG_COLOR, fogFactor);

  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float curve = lum * lum * lum + CURVE_MID * lum * lum + CURVE_LOW * lum;
  col *= curve;
  gl_FragColor = vec4(col, 1.0);
}
`;

// Latitude rings clustered toward the south pole via t^(1/(1+bias)).
// `aUniformPos` carries the bias=0 counterpart for the camera-distance lerp.
function createBiasedSphereGeometry(radius, widthSegments, heightSegments, bias) {
  const w = Math.max(3, Math.floor(widthSegments));
  const h = Math.max(2, Math.floor(heightSegments));
  const geometry = new THREE.BufferGeometry();
  const indices = [];
  const vertices = [];
  const uniformVertices = [];
  const normals = [];
  const uvs = [];
  const rowStride = w + 1;
  const k = 1 / (1 + bias);

  for (let iy = 0; iy <= h; iy++) {
    const t = iy / h;
    const theta = t ** k * Math.PI;
    const thetaUniform = t * Math.PI;
    const sinThetaU = Math.sin(thetaUniform);
    const cosThetaU = Math.cos(thetaUniform);
    for (let ix = 0; ix <= w; ix++) {
      const u = ix / w;
      const phi = u * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      const cosPhi = Math.cos(phi);
      const sinPhi = Math.sin(phi);
      const nx = -cosPhi * sinTheta;
      const ny = cosTheta;
      const nz = sinPhi * sinTheta;
      vertices.push(radius * nx, radius * ny, radius * nz);
      uniformVertices.push(-cosPhi * sinThetaU * radius, cosThetaU * radius, sinPhi * sinThetaU * radius);
      normals.push(nx, ny, nz);
      uvs.push(u, 1 - theta / Math.PI);
    }
  }
  for (let iy = 0; iy < h; iy++) {
    for (let ix = 0; ix < w; ix++) {
      const a = iy * rowStride + (ix + 1);
      const b = iy * rowStride + ix;
      const c = (iy + 1) * rowStride + ix;
      const d = (iy + 1) * rowStride + (ix + 1);
      if (iy !== 0) indices.push(a, b, d);
      if (iy !== h - 1) indices.push(b, c, d);
    }
  }
  geometry.setIndex(indices);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("aUniformPos", new THREE.Float32BufferAttribute(uniformVertices, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  return geometry;
}

export function mountVortex(container) {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.createElement("canvas");
  container.prepend(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  // Posed every frame by applyElapsed below.
  const camera = new THREE.PerspectiveCamera(INTRO_CAMERA.fov, 1, INTRO_CAMERA.near, INTRO_CAMERA.far);

  const uniforms = {
    iTime: { value: 0 },
    uFogNear: { value: FOG_NEAR },
    uFogFar: { value: FOG_FAR },
  };
  const sphere = new THREE.Mesh(
    createBiasedSphereGeometry(SPHERE_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS, SPHERE_SOUTH_POLE_BIAS),
    new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, side: THREE.DoubleSide }),
  );
  sphere.layers.set(SPHERE_LAYER);
  scene.add(sphere);

  // Low-res target + nearest-filter blit: the silhouette tiles, not just
  // the shading (PixelatedSphereRenderPass).
  const renderTarget = new THREE.WebGLRenderTarget(2, 2, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: true,
    stencilBuffer: false,
    colorSpace: THREE.SRGBColorSpace,
  });
  renderTarget.texture.generateMipmaps = false;
  const quadScene = new THREE.Scene();
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  quadScene.add(
    new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: { uTexture: { value: renderTarget.texture } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: `uniform sampler2D uTexture; varying vec2 vUv; void main(){ gl_FragColor = texture2D(uTexture, vUv); }`,
        depthTest: false,
        depthWrite: false,
        transparent: false,
        blending: THREE.NoBlending,
      }),
    ),
  );

  // AnimatedIntroCamera.tsx's animState: two LineCurve3 segments, start →
  // sphere surface (along the line to the center) → CAMERA.position.
  const track = container.closest("[data-vortex-track]");
  const startVec = new THREE.Vector3(...INTRO_CAMERA.position);
  const endVec = new THREE.Vector3(...CAMERA.position);
  const center = new THREE.Vector3(...START_LOOK_AT);
  const approachDir = center.clone().sub(startVec).normalize();
  const entry = center.clone().addScaledVector(approachDir, -SPHERE_RADIUS);
  const approachLine = new THREE.LineCurve3(startVec, entry);
  const descentLine = new THREE.LineCurve3(entry, endVec);
  const finalForward = computeLookAt(CAMERA.position, CAMERA.rotationX).sub(endVec).normalize();
  // Strong -Y so the descent tilts the camera down toward the final pose
  // immediately, rather than staring forward at nothing.
  const downDirection = endVec.clone().sub(entry).normalize();
  const scratch = {
    forward: new THREE.Vector3(),
    lookAt: new THREE.Vector3(),
    position: new THREE.Vector3(),
  };

  // AnimatedIntroCamera.tsx's useFrame body, with `elapsed` (ms into the
  // museum's intro) supplied from scroll instead of performance.now(). The
  // fog snap from useIntroOrchestration's onBoundaryCrossed is folded in as
  // the branch itself, so it reverses when scrolling back up.
  const applyElapsed = (elapsed) => {
    if (elapsed < APPROACH_DURATION_MS) {
      const approachT = elapsed / APPROACH_DURATION_MS;
      const approachEased = hermiteEase(approachT, APPROACH_V0, APPROACH_V1);
      approachLine.getPoint(approachEased, scratch.position);
      scratch.forward.copy(approachDir);
      camera.fov = INTRO_CAMERA.fov;
      uniforms.uFogNear.value = INTRO_FOG_NEAR;
      uniforms.uFogFar.value = INTRO_FOG_FAR;
    } else {
      const descentT = Math.min(1, (elapsed - APPROACH_DURATION_MS) / DESCENT_DURATION_MS);
      const descentEased = smoothStop(descentT, DESCENT_V0);
      descentLine.getPoint(descentEased, scratch.position);
      scratch.forward.copy(downDirection).lerp(finalForward, descentEased).normalize();
      camera.fov = THREE.MathUtils.lerp(INTRO_CAMERA.fov, CAMERA.fov, descentEased);
      uniforms.uFogNear.value = FOG_NEAR;
      uniforms.uFogFar.value = FOG_FAR;
    }
    camera.position.copy(scratch.position);
    scratch.lookAt.copy(scratch.position).add(scratch.forward);
    camera.lookAt(scratch.lookAt);
    camera.updateProjectionMatrix();
  };

  // Progress through the track's pinned phase, 0..1 (0 = track top at the
  // viewport top, 1 = track bottom at the viewport bottom). A ViewTimeline
  // reports cover-range progress (track top entering at the bottom → track
  // bottom leaving at the top) without a layout read; the pinned phase is
  // the slice of that between offsets `viewport` and `track - stage`.
  // Without ViewTimeline (Safari at the time of writing) the same number
  // comes from the track's bounding rect. With reduced motion, or no track,
  // the scene rests at the end of the timeline (the museum's post-intro
  // framing).
  const metrics = { track: 0, stage: 0, viewport: 0 };
  const rectProgress = () => {
    const r = track.getBoundingClientRect();
    const span = r.height - container.clientHeight;
    return span > 0 ? -r.top / span : 1;
  };
  let readProgress = () => 1;
  if (track && !reduceMotion) {
    readProgress = rectProgress;
    if ("ViewTimeline" in window) {
      try {
        const timeline = new ViewTimeline({ subject: track, axis: "block" });
        readProgress = () => {
          const t = timeline.currentTime;
          const pct = t == null ? NaN : typeof t === "number" ? t : t.value;
          const span = metrics.track - metrics.stage;
          if (!Number.isFinite(pct) || span <= 0) return rectProgress();
          const cover = (pct / 100) * (metrics.track + metrics.viewport);
          return (cover - metrics.viewport) / span;
        };
      } catch {
        /* keep the rect math */
      }
    }
  }

  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const buffer = new THREE.Vector2();
    renderer.getDrawingBufferSize(buffer);
    renderTarget.setSize(
      Math.max(1, Math.floor(buffer.x / VORTEX_PIXEL_SIZE)),
      Math.max(1, Math.floor(buffer.y / VORTEX_PIXEL_SIZE)),
    );
    metrics.stage = h;
    metrics.track = track ? track.offsetHeight : 0;
    metrics.viewport = document.documentElement.clientHeight;
    // Paused (off-screen or reduced motion): setSize blanked the canvas,
    // so put one frame back.
    if (!running) draw();
  };

  const clock = new THREE.Clock();
  const draw = () => {
    uniforms.iTime.value = clock.getElapsedTime();
    applyElapsed(Math.min(1, Math.max(0, readProgress())) * TIMELINE_MS);
    camera.layers.set(SPHERE_LAYER);
    renderer.setRenderTarget(renderTarget);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.autoClear = false;
    renderer.clear(true, true, true);
    renderer.render(quadScene, quadCamera);
    renderer.clearDepth();
    camera.layers.set(0);
    renderer.render(scene, camera);
    renderer.autoClear = true;
  };

  let running = false;
  let raf = 0;
  const loop = () => {
    if (!running) return;
    draw();
    raf = requestAnimationFrame(loop);
  };

  new ResizeObserver(resize).observe(container);
  resize(); // draws the first frame too (running is still false)

  if (reduceMotion) return;
  new IntersectionObserver(
    (entries) => {
      running = entries.some((e) => e.isIntersecting);
      cancelAnimationFrame(raf);
      if (running) {
        clock.start();
        raf = requestAnimationFrame(loop);
      } else {
        clock.stop();
      }
    },
    { threshold: 0.05 },
  ).observe(container);
}

const stage = document.querySelector("[data-vortex]");
if (stage) {
  try {
    mountVortex(stage);
  } catch (err) {
    console.warn("vortex unavailable", err);
  }
}
