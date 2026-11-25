import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Eye, EyeOff, Pause, Play, RotateCcw } from 'lucide-react';
import type { AccountSize, ChallengeMode } from '../utils/challenges';

export type VaultViewPreset = 'assembled' | 'exploded' | 'top';

interface LemonVault3DProps {
  accountSize: AccountSize;
  challengeMode: ChallengeMode;
}

// Pre-allocated scratch math objects (zero GC in render loop)
const _scratchMat4 = new THREE.Matrix4();
const _scratchPos = new THREE.Vector3();
const _scratchQuat = new THREE.Quaternion();
const _scratchScale = new THREE.Vector3();
const _scratchEuler = new THREE.Euler();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createLemonRindTextures(): {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  // Rich vertical gradient from sunlit lemon tip to warm gold equator
  const grad = cCtx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#D97706');
  grad.addColorStop(0.16, '#EAB308');
  grad.addColorStop(0.5, '#FACC15');
  grad.addColorStop(0.84, '#EAB308');
  grad.addColorStop(1, '#B45309');
  cCtx.fillStyle = grad;
  cCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Deterministic pseudo-random pores for authentic citrus oil gland dimples
  let seed = 4219;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 2400; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1.2 + rand() * 2.4;
    const depth = rand();

    // Subtle color speck
    cCtx.fillStyle =
      depth > 0.5 ? 'rgba(180, 83, 9, 0.25)' : 'rgba(254, 240, 138, 0.28)';
    cCtx.beginPath();
    cCtx.arc(x, y, r, 0, Math.PI * 2);
    cCtx.fill();

    // Bump pit
    const shade = Math.floor(70 + depth * 65);
    bCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
    bCtx.beginPath();
    bCtx.arc(x, y, r, 0, Math.PI * 2);
    bCtx.fill();
  }

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.ClampToEdgeWrapping;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;

  return { colorMap, bumpMap };
}

function createChallengeSlabTexture(title: string, subtitle: string): THREE.CanvasTexture {
  const w = 256;
  const h = 160;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#141A10';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, w - 12, h - 12);

  ctx.fillStyle = '#FACC15';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, w / 2, 74);

  ctx.fillStyle = '#E7E9DC';
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText(subtitle, w / 2, 114);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    10,
    size / 2,
    size / 2,
    size / 2
  );
  grad.addColorStop(0, 'rgba(20, 26, 16, 0.42)');
  grad.addColorStop(0.55, 'rgba(20, 26, 16, 0.14)');
  grad.addColorStop(1, 'rgba(20, 26, 16, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBrushedMetalTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#909090';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 2) {
    const v = 120 + Math.floor(Math.sin(y * 0.45) * 24 + (y % 5) * 6);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, size, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

function buildLemonProfilePoints(): THREE.Vector2[] {
  const points: THREE.Vector2[] = [];
  const steps = 36;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 (bottom) -> 1 (top)
    const angle = t * Math.PI;
    // Organic lemon silhouette with slightly tapered tips at both poles
    const baseRadius = Math.sin(angle);
    const tipTaper = Math.pow(baseRadius, 0.82);
    const nipple =
      (t < 0.08 ? Math.sin((t / 0.08) * Math.PI * 0.5) * 0.08 : 0) +
      (t > 0.92 ? Math.sin(((1 - t) / 0.08) * Math.PI * 0.5) * 0.1 : 0);
    const r = Math.max(0.001, tipTaper * 0.72 + nipple * 0.25);
    const y = (t - 0.5) * 1.95;
    points.push(new THREE.Vector2(r, y));
  }
  return points;
}

function buildLeafShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.24, 0.18, 0.34, 0.55, 0, 0.92);
  shape.bezierCurveTo(-0.34, 0.55, -0.24, 0.18, 0, 0);
  return shape;
}

function buildCitrusSliceGroup(
  rindMat: THREE.Material,
  pithMat: THREE.Material,
  pulpMat: THREE.Material
): THREE.Group {
  const slice = new THREE.Group();

  // Outer yellow rind torus/ring
  const rindGeo = new THREE.CylinderGeometry(0.68, 0.68, 0.12, 32, 1, true);
  const rindMesh = new THREE.Mesh(rindGeo, rindMat);
  rindMesh.castShadow = true;
  slice.add(rindMesh);

  // White pith disc
  const pithGeo = new THREE.CylinderGeometry(0.64, 0.64, 0.125, 32);
  const pithMesh = new THREE.Mesh(pithGeo, pithMat);
  slice.add(pithMesh);

  // 8 radial juicy pulp wedges
  const wedgeShape = new THREE.Shape();
  const wedgeAngle = (Math.PI * 2) / 8 - 0.11;
  wedgeShape.moveTo(0.07, 0);
  wedgeShape.lineTo(Math.cos(-wedgeAngle / 2) * 0.54, Math.sin(-wedgeAngle / 2) * 0.54);
  wedgeShape.absarc(0, 0, 0.54, -wedgeAngle / 2, wedgeAngle / 2, false);
  wedgeShape.lineTo(0.07, 0);

  const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, {
    depth: 0.135,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 2,
  });
  wedgeGeo.rotateX(Math.PI / 2);
  wedgeGeo.translate(0, 0.068, 0);

  for (let i = 0; i < 8; i++) {
    const wedge = new THREE.Mesh(wedgeGeo, pulpMat);
    wedge.rotation.y = (i * Math.PI * 2) / 8;
    slice.add(wedge);
  }

  return slice;
}

export function LemonVault3D({ accountSize, challengeMode }: LemonVault3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [viewPreset, setViewPreset] = useState<VaultViewPreset>('assembled');
  const [isPaused, setIsPaused] = useState(false);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  // Mutable ref synced from React props/state so WebGL mounts once
  const simStateRef = useRef({
    accountSize,
    challengeMode,
    viewPreset,
    isPaused,
    explodedCurrent: 0,
    tierScaleCurrent: 1,
    camTransitionActive: false,
    camTargetPos: new THREE.Vector3(3.4, 1.85, 4.35),
    camTargetLook: new THREE.Vector3(0, 0.05, 0),
  });

  useEffect(() => {
    simStateRef.current.accountSize = accountSize;
    simStateRef.current.challengeMode = challengeMode;
  }, [accountSize, challengeMode]);

  useEffect(() => {
    simStateRef.current.viewPreset = viewPreset;
    simStateRef.current.camTransitionActive = true;
    if (viewPreset === 'top') {
      simStateRef.current.camTargetPos.set(0.2, 5.2, 1.45);
      simStateRef.current.camTargetLook.set(0, 0, 0);
    } else if (viewPreset === 'exploded') {
      simStateRef.current.camTargetPos.set(4.1, 2.2, 4.9);
      simStateRef.current.camTargetLook.set(0, 0.1, 0);
    } else {
      simStateRef.current.camTargetPos.set(3.4, 1.85, 4.35);
      simStateRef.current.camTargetLook.set(0, 0.05, 0);
    }
  }, [viewPreset]);

  useEffect(() => {
    simStateRef.current.isPaused = isPaused;
  }, [isPaused]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = container.clientWidth || 640;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    const bgHex = 0x09090b;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.032);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.copy(simStateRef.current.camTargetPos);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setContextLost(true);
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    // Studio Environment Map (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minDistance = 3.1;
    controls.maxDistance = 8.2;
    controls.maxPolarAngle = Math.PI * 0.56;
    controls.minPolarAngle = Math.PI * 0.15;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.target.copy(simStateRef.current.camTargetLook);
    controls.addEventListener('start', () => {
      simStateRef.current.camTransitionActive = false;
    });

    // Warm/cool 3-point lighting rig
    const hemiLight = new THREE.HemisphereLight(0xeef7ff, 0xd4dec2, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5cc, 2.0);
    keyLight.position.set(4.5, 7.5, 4.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 20;
    const d = 4.2;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xfde047, 1.1);
    rimLight.position.set(-4.5, 3.2, -3.8);
    scene.add(rimLight);

    // Procedural Textures
    const { colorMap: lemonColorMap, bumpMap: lemonBumpMap } = createLemonRindTextures();
    const brushedMetalTex = createBrushedMetalTexture();
    const shadowTex = createContactShadowTexture();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    lemonColorMap.anisotropy = maxAniso;
    lemonBumpMap.anisotropy = maxAniso;

    const slabTextures: Record<ChallengeMode, THREE.CanvasTexture> = {
      'two-step': createChallengeSlabTexture('2-STEP', 'Static 10%'),
      'one-step': createChallengeSlabTexture('1-STEP', '10% Target'),
      instant: createChallengeSlabTexture('INSTANT', 'Day-1 Live'),
    };
    Object.values(slabTextures).forEach((t) => {
      t.anisotropy = maxAniso;
    });

    // Materials (calibrated roughness/metalness contrast)
    const lemonRindMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: lemonColorMap,
      bumpMap: lemonBumpMap,
      bumpScale: 0.036,
      roughness: 0.44,
      metalness: 0.02,
      clearcoat: 0.25,
      clearcoatRoughness: 0.35,
    });

    const leafMat = new THREE.MeshPhysicalMaterial({
      color: 0x15803d,
      roughness: 0.26,
      metalness: 0.05,
      clearcoat: 0.65,
      clearcoatRoughness: 0.22,
    });

    const stemMat = new THREE.MeshStandardMaterial({
      color: 0x4d5d2b,
      roughness: 0.78,
      metalness: 0.05,
    });

    const brushedGoldMat = new THREE.MeshPhysicalMaterial({
      color: 0xd97706,
      roughnessMap: brushedMetalTex,
      roughness: 0.24,
      metalness: 0.9,
      anisotropy: 0.75,
    });

    const emeraldRingMat = new THREE.MeshPhysicalMaterial({
      color: 0x15803d,
      roughness: 0.28,
      metalness: 0.72,
      clearcoat: 0.5,
    });

    const glassVaultMat = new THREE.MeshPhysicalMaterial({
      color: 0xfefce8,
      roughness: 0.08,
      metalness: 0.02,
      ior: 1.52,
      thickness: 0.85,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      transmission: isSoftwareGl ? 0 : 0.86,
      transparent: true,
      opacity: isSoftwareGl ? 0.14 : 1.0,
      depthWrite: false,
      attenuationColor: new THREE.Color(0xfef08a),
      attenuationDistance: 3.2,
    });

    const pithMat = new THREE.MeshStandardMaterial({
      color: 0xfef9c3,
      roughness: 0.68,
      metalness: 0.0,
    });

    const pulpMat = new THREE.MeshPhysicalMaterial({
      color: 0xfacc15,
      emissive: 0xca8a04,
      emissiveIntensity: 0.16,
      roughness: 0.18,
      metalness: 0.02,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
    });

    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.72,
      metalness: 0.18,
    });

    // Root Vault Group
    const vaultGroup = new THREE.Group();
    scene.add(vaultGroup);

    // 1. Studio Pedestal & Contact Shadow (grounded at y = -1.72)
    const pedestalGeo = new THREE.CylinderGeometry(2.15, 2.35, 0.16, 48);
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -1.72;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    const pedestalRimGeo = new THREE.TorusGeometry(2.14, 0.025, 12, 64);
    pedestalRimGeo.rotateX(Math.PI / 2);
    const pedestalRim = new THREE.Mesh(pedestalRimGeo, brushedGoldMat);
    pedestalRim.position.y = -1.635;
    scene.add(pedestalRim);

    const shadowPlaneGeo = new THREE.CircleGeometry(1.85, 32);
    shadowPlaneGeo.rotateX(-Math.PI / 2);
    const shadowPlaneMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    });
    const shadowDisc = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowDisc.position.y = -1.615;
    scene.add(shadowDisc);

    // 2. Central Sculpted Lemon Core Group (Whole Lemon + Calyx + Stem + 2 Leaves)
    const lemonCoreGroup = new THREE.Group();
    vaultGroup.add(lemonCoreGroup);

    const lemonGeo = new THREE.LatheGeometry(buildLemonProfilePoints(), 36);
    lemonGeo.computeVertexNormals();
    const lemonMesh = new THREE.Mesh(lemonGeo, lemonRindMat);
    lemonMesh.castShadow = true;
    lemonMesh.receiveShadow = true;
    lemonMesh.rotation.z = -0.14;
    lemonCoreGroup.add(lemonMesh);

    // Calyx & woody stem mounted on top pole
    const calyxGeo = new THREE.CylinderGeometry(0.11, 0.06, 0.08, 6);
    const calyx = new THREE.Mesh(calyxGeo, stemMat);
    calyx.position.set(0.14, 0.96, 0);
    calyx.rotation.z = -0.14;
    lemonCoreGroup.add(calyx);

    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.14, 0.98, 0),
      new THREE.Vector3(0.19, 1.16, 0.03),
      new THREE.Vector3(0.28, 1.28, 0.05),
    ]);
    const stemGeo = new THREE.TubeGeometry(stemCurve, 12, 0.032, 8, false);
    const stemMesh = new THREE.Mesh(stemGeo, stemMat);
    stemMesh.castShadow = true;
    lemonCoreGroup.add(stemMesh);

    const leafShape = buildLeafShape();
    const leafGeo = new THREE.ExtrudeGeometry(leafShape, {
      depth: 0.018,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.01,
      bevelSegments: 2,
    });

    const leaf1 = new THREE.Mesh(leafGeo, leafMat);
    leaf1.position.set(0.18, 1.07, 0.02);
    leaf1.rotation.set(0.55, 0.2, -0.82);
    leaf1.scale.set(0.78, 0.78, 0.78);
    leaf1.castShadow = true;
    lemonCoreGroup.add(leaf1);

    const leaf2 = new THREE.Mesh(leafGeo, leafMat);
    leaf2.position.set(0.14, 1.04, -0.02);
    leaf2.rotation.set(-0.48, -0.3, 0.92);
    leaf2.scale.set(0.56, 0.56, 0.56);
    leaf2.castShadow = true;
    lemonCoreGroup.add(leaf2);

    // 3. Counter-Rotating Precision Gimbal Rings (Transparency Ledger Rings)
    const outerGimbalGroup = new THREE.Group();
    vaultGroup.add(outerGimbalGroup);

    const ringGeo1 = new THREE.TorusGeometry(1.52, 0.036, 16, 64);
    const ring1 = new THREE.Mesh(ringGeo1, brushedGoldMat);
    ring1.castShadow = true;
    outerGimbalGroup.add(ring1);

    const innerGimbalGroup = new THREE.Group();
    vaultGroup.add(innerGimbalGroup);

    const ringGeo2 = new THREE.TorusGeometry(1.3, 0.026, 14, 64);
    const ring2 = new THREE.Mesh(ringGeo2, emeraldRingMat);
    ring2.rotation.x = Math.PI / 3;
    innerGimbalGroup.add(ring2);

    // 4. Transparent Glass Vault Hemispheres (Explode outward to show transparency!)
    const upperGlassDomeGeo = new THREE.SphereGeometry(
      1.18,
      32,
      20,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.46
    );
    const upperGlassDome = new THREE.Mesh(upperGlassDomeGeo, glassVaultMat);
    upperGlassDome.renderOrder = 5;
    vaultGroup.add(upperGlassDome);

    const lowerGlassDomeGeo = new THREE.SphereGeometry(
      1.18,
      32,
      20,
      0,
      Math.PI * 2,
      Math.PI * 0.54,
      Math.PI * 0.46
    );
    const lowerGlassDome = new THREE.Mesh(lowerGlassDomeGeo, glassVaultMat);
    lowerGlassDome.renderOrder = 5;
    vaultGroup.add(lowerGlassDome);

    // 5. Orbiting Citrus Slice Cross-Section
    const citrusSlice = buildCitrusSliceGroup(lemonRindMat, pithMat, pulpMat);
    citrusSlice.position.set(1.62, -0.35, 0.45);
    citrusSlice.rotation.set(0.55, 0.3, -0.4);
    citrusSlice.scale.setScalar(0.74);
    vaultGroup.add(citrusSlice);

    // 6. Three Orbiting Transparent Challenge Prism Cards (1-Step, 2-Step, Instant)
    const slabGeo = new THREE.BoxGeometry(0.68, 0.44, 0.036);
    const slabFaceGeo = new THREE.PlaneGeometry(0.62, 0.39);
    const challengeSlabs: THREE.Group[] = [];
    const slabModes: ChallengeMode[] = ['two-step', 'one-step', 'instant'];

    for (let i = 0; i < 3; i++) {
      const m = slabModes[i];
      const slabGroup = new THREE.Group();
      const glassPane = new THREE.Mesh(slabGeo, glassVaultMat);
      glassPane.renderOrder = 6;
      const labelMat = new THREE.MeshBasicMaterial({
        map: slabTextures[m],
        side: THREE.DoubleSide,
      });
      const labelFace = new THREE.Mesh(slabFaceGeo, labelMat);
      labelFace.position.z = 0.02;
      const labelBack = new THREE.Mesh(slabFaceGeo, labelMat);
      labelBack.position.z = -0.02;
      labelBack.rotation.y = Math.PI;
      slabGroup.add(glassPane, labelFace, labelBack);
      slabGroup.userData = { mode: m, baseAngle: (i * Math.PI * 2) / 3 };
      vaultGroup.add(slabGroup);
      challengeSlabs.push(slabGroup);
    }

    // 7. InstancedMesh Floating Capital Coins & Citrus Zest Droplets (24 instances)
    const coinCount = 24;
    const coinGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.024, 16);
    coinGeo.rotateX(Math.PI / 2);
    const coinsInstanced = new THREE.InstancedMesh(coinGeo, brushedGoldMat, coinCount);
    coinsInstanced.frustumCulled = false;

    const coinSeeds: {
      angle: number;
      radius: number;
      yBase: number;
      speed: number;
      scale: number;
      phase: number;
    }[] = [];

    for (let i = 0; i < coinCount; i++) {
      const t = i / coinCount;
      const scale = 0.72 + ((i * 7) % 5) * 0.12;
      coinSeeds.push({
        angle: t * Math.PI * 2,
        radius: 1.78 + (i % 3) * 0.32,
        yBase: -0.9 + ((i % 6) / 5) * 1.85,
        speed: 0.25 + (i % 4) * 0.09,
        scale,
        phase: i * 0.9,
      });
    }
    scene.add(coinsInstanced);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Resize listener
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop (paced via afterDraw on software WebGL)
    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let elapsed = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tierScaleLookup: Record<AccountSize, number> = {
      2500: 0.78,
      5000: 0.83,
      10000: 0.88,
      25000: 0.94,
      50000: 1.0,
      100000: 1.08,
      200000: 1.16,
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const delta = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      const s = simStateRef.current;
      if (!s.isPaused) {
        elapsed += delta;
      }

      // Smooth damped exploded transparency & tier scale
      const targetExploded = s.viewPreset === 'exploded' ? 1 : 0;
      s.explodedCurrent = THREE.MathUtils.damp(s.explodedCurrent, targetExploded, 5.5, delta);

      const targetScale = tierScaleLookup[s.accountSize] || 1.0;
      s.tierScaleCurrent = THREE.MathUtils.damp(s.tierScaleCurrent, targetScale, 5.0, delta);

      // Smooth camera preset transition (cancelled on OrbitControls start)
      if (s.camTransitionActive) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, s.camTargetPos.x, 4.5, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, s.camTargetPos.y, 4.5, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, s.camTargetPos.z, 4.5, delta);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, s.camTargetLook.x, 5.0, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, s.camTargetLook.y, 5.0, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, s.camTargetLook.z, 5.0, delta);
        if (camera.position.distanceTo(s.camTargetPos) < 0.03) {
          s.camTransitionActive = false;
        }
      }

      // Animate central lemon & vault
      lemonCoreGroup.rotation.y = elapsed * 0.45;
      lemonCoreGroup.position.y = Math.sin(elapsed * 1.4) * 0.06;
      lemonCoreGroup.scale.setScalar(s.tierScaleCurrent);

      upperGlassDome.position.y = s.explodedCurrent * 0.65;
      lowerGlassDome.position.y = -s.explodedCurrent * 0.65;
      upperGlassDome.rotation.y = -elapsed * 0.22;
      lowerGlassDome.rotation.y = elapsed * 0.22;

      outerGimbalGroup.rotation.y = elapsed * 0.32;
      outerGimbalGroup.rotation.x = Math.sin(elapsed * 0.5) * 0.18 + 0.35;
      outerGimbalGroup.scale.setScalar(1 + s.explodedCurrent * 0.18);

      innerGimbalGroup.rotation.z = -elapsed * 0.48;
      innerGimbalGroup.rotation.y = -elapsed * 0.25;
      innerGimbalGroup.scale.setScalar(1 + s.explodedCurrent * 0.1);

      // Orbiting citrus wedge
      const sliceOrbitAngle = elapsed * 0.55;
      const sliceR = 1.72 + s.explodedCurrent * 0.35;
      citrusSlice.position.set(
        Math.cos(sliceOrbitAngle) * sliceR,
        Math.sin(elapsed * 1.2) * 0.22 - 0.2,
        Math.sin(sliceOrbitAngle) * sliceR
      );
      citrusSlice.rotation.y = elapsed * 0.9;
      citrusSlice.rotation.x = 0.55 + Math.sin(elapsed * 0.8) * 0.2;

      // Orbiting challenge prism slabs
      for (let i = 0; i < challengeSlabs.length; i++) {
        const slab = challengeSlabs[i];
        const isActive = slab.userData.mode === s.challengeMode;
        const angle = slab.userData.baseAngle + elapsed * 0.28;
        const r = (isActive ? 2.08 : 1.88) + s.explodedCurrent * 0.28;
        slab.position.set(
          Math.cos(angle) * r,
          (isActive ? 0.36 : -0.1) + Math.sin(elapsed * 1.5 + i) * 0.1,
          Math.sin(angle) * r
        );
        slab.lookAt(0, slab.position.y, 0);
        const targetSlabScale = isActive ? 1.22 : 0.86;
        slab.scale.setScalar(
          THREE.MathUtils.damp(slab.scale.x, targetSlabScale, 6, delta)
        );
      }

      // Instanced coins update (zero GC)
      for (let i = 0; i < coinCount; i++) {
        const seed = coinSeeds[i];
        const a = seed.angle + elapsed * seed.speed;
        const r = seed.radius + s.explodedCurrent * 0.25;
        _scratchPos.set(
          Math.cos(a) * r,
          seed.yBase + Math.sin(elapsed * 1.6 + seed.phase) * 0.16,
          Math.sin(a) * r
        );
        _scratchEuler.set(
          elapsed * 0.9 + seed.phase,
          a + elapsed * 1.2,
          0
        );
        _scratchQuat.setFromEuler(_scratchEuler);
        _scratchScale.setScalar(seed.scale * (0.9 + s.tierScaleCurrent * 0.1));
        _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
        coinsInstanced.setMatrixAt(i, _scratchMat4);
      }
      coinsInstanced.instanceMatrix.needsUpdate = true;

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      renderer.render(scene, camera);
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      controls.dispose();
      envTarget.dispose();
      lemonColorMap.dispose();
      lemonBumpMap.dispose();
      brushedMetalTex.dispose();
      shadowTex.dispose();
      Object.values(slabTextures).forEach((t) => t.dispose());
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material?.dispose();
          }
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      className="relative w-full h-[320px] sm:h-[350px] lg:h-[370px] rounded-2xl border border-white/[0.08] bg-[#111113] overflow-hidden"
      data-vault-view={viewPreset}
      data-vault-tier={accountSize}
    >
      {/* Isolated WebGL mount container */}
      <div
        ref={mountRef}
        data-testid="lemon-vault-3d"
        className="w-full h-full"
        aria-label="Interactive 3D LemonFunding transparency vault"
      />

      {/* Graceful fallback if WebGL context is unavailable */}
      {contextLost && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#111113] p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-[#F7A600] border-2 border-white/20 mb-4" />
          <p className="font-display text-lg font-bold text-white">
            LemonFunding 3D Vault
          </p>
          <p className="text-sm text-zinc-400 mt-1 max-w-xs">
            Interactive 3D preview paused. Reload to restore WebGL rendering.
          </p>
        </div>
      )}

      {/* Minimal Top-Left Tier Readout */}
      <div className="pointer-events-none absolute top-4 left-4 bg-[#18181B]/90 backdrop-blur-md border border-white/[0.1] rounded-xl px-3.5 py-2 shadow-lg">
        <p className="text-[11px] font-medium text-zinc-400 tracking-wide">
          Active 3D Vault
        </p>
        <p className="font-mono-tabular text-sm font-semibold text-white">
          ${accountSize.toLocaleString('en-US')} ·{' '}
          {challengeMode === 'two-step'
            ? '2-Step'
            : challengeMode === 'one-step'
              ? '1-Step'
              : 'Instant'}
        </p>
      </div>

      {/* Collapsible Bottom Control Dock */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 max-w-[94%]">
        <button
          type="button"
          onClick={() => setControlsCollapsed((prev) => !prev)}
          aria-expanded={!controlsCollapsed}
          aria-label={controlsCollapsed ? 'Show 3D controls' : 'Hide 3D controls'}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#18181B]/90 border border-white/[0.1] text-zinc-200 text-[11px] font-medium hover:bg-[#27272A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {controlsCollapsed ? (
            <>
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Show 3D Controls</span>
            </>
          ) : (
            <>
              <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Hide 3D Controls</span>
            </>
          )}
        </button>

        {!controlsCollapsed && (
          <div
            role="toolbar"
            aria-label="3D Lemon Vault Controls"
            className="flex items-center gap-1.5 p-1.5 rounded-xl bg-[#111113]/95 border border-white/[0.12] shadow-lg overflow-x-auto max-w-full"
          >
            <button
              type="button"
              onClick={() => setViewPreset('assembled')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewPreset === 'assembled'
                  ? 'bg-white text-[#09090B]'
                  : 'text-zinc-300 hover:bg-white/10'
              }`}
            >
              Assembled
            </button>
            <button
              type="button"
              onClick={() => setViewPreset('exploded')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewPreset === 'exploded'
                  ? 'bg-white text-[#09090B]'
                  : 'text-zinc-300 hover:bg-white/10'
              }`}
            >
              Exploded View
            </button>
            <button
              type="button"
              onClick={() => setViewPreset('top')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewPreset === 'top'
                  ? 'bg-white text-[#09090B]'
                  : 'text-zinc-300 hover:bg-white/10'
              }`}
            >
              Top Slice
            </button>

            <span className="h-4 w-px bg-white/15 mx-0.5 shrink-0" aria-hidden="true" />

            <button
              type="button"
              onClick={() => setIsPaused((p) => !p)}
              aria-label={isPaused ? 'Resume 3D rotation' : 'Pause 3D rotation'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white/85 hover:bg-white/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Play</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Pause</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setViewPreset('assembled')}
              aria-label="Reset 3D camera"
              className="p-1.5 rounded-lg text-[#E7E9DC] hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
