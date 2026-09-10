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
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
  camera.position.set(...CAMERA.position);
  camera.rotation.x = CAMERA.rotationX;

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
  };

  const clock = new THREE.Clock();
  const draw = () => {
    uniforms.iTime.value = clock.getElapsedTime();
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
  resize();
  draw();

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
