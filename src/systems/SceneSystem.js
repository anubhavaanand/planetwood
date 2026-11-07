import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { MaterialSystem } from './MaterialSystem.js';

export class SceneSystem {
  constructor(container) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 80, 150);

    // Performance stats tracking
    this._perfStats = {
      instancedMeshes: 0,
      instancedDrawCalls: 0,
      staticMeshes: 0,
      textureLoads: 0,
      textureBytes: 0,
      frameTimes: new Float32Array(60),
      frameTimeIdx: 0,
    };

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(60, 45, 70);

    // Performance tier detection for integrated GPUs (e.g., Intel Iris Plus)
    const isLowEnd = this._detectLowEndDevice();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(isLowEnd ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = isLowEnd ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = isLowEnd ? THREE.LinearToneMapping : THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this._isLowEnd = isLowEnd;
    container.appendChild(this.renderer.domElement);

    // Bloom post-processing for emissive VFX (waterfall, cables, etc.)
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloomRes = isLowEnd
      ? new THREE.Vector2(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2))
      : new THREE.Vector2(window.innerWidth, window.innerHeight);
    const bloomPass = new UnrealBloomPass(
      bloomRes,
      isLowEnd ? 0.8 : 1.5,   // strength
      isLowEnd ? 0.2 : 0.4,   // radius
      0.85                    // threshold
    );
    if (isLowEnd) bloomPass.enabled = false; // disable bloom on low-end devices
    this.composer.addPass(bloomPass);
    this.bloomPass = bloomPass;

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0px';
    this.labelRenderer.domElement.style.left = '0px';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(this.labelRenderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 5, 0);
    this.controls.maxPolarAngle = Math.PI / 2.2;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 100;
    this.controls.update();

    this._setupLights();
    this._setupResizeHandler();

    this.gltfLoader = new GLTFLoader();
    this.clock = new THREE.Clock();
    this.clock.start();

    this.materialSystem = new MaterialSystem(this.scene);

    // Texture cache + size limits for compressed glTF texture loading
    this._textureCache = new Map();
    this._maxTextureSize = 1024;

    this._fpsFrames = 0;
    this._fpsTime = 0;
    this._fpsLast = Date.now();
    this._setupFpsCounter();
  }

  _detectLowEndDevice() {
    // Heuristic for integrated/low-end GPUs (e.g., Intel Iris Plus, UHD)
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return true;
    const renderer = gl.getParameter(gl.RENDERER) || '';
    const vendor = gl.getParameter(gl.VENDOR) || '';
    const lowEndKeywords = ['iris plus', 'uhd', 'hd graphics', 'integrated', 'intel hd', 'intel(r) hd'];
    const combined = (renderer + ' ' + vendor).toLowerCase();
    if (lowEndKeywords.some(k => combined.includes(k))) return true;
    // Also treat low RAM devices as low-end
    if (navigator.deviceMemory && navigator.deviceMemory <= 4) return true;
    return false;
  }

  _setupFpsCounter() {
    this.fpsEl = document.createElement('div');
    Object.assign(this.fpsEl.style, {
      position: 'fixed', bottom: '8px', left: '8px',
      color: '#9ab0b4', fontSize: '12px', fontFamily: 'monospace',
      zIndex: '999', background: 'rgba(30,40,42,0.7)',
      padding: '4px 8px', borderRadius: '4px',       pointerEvents: 'none',
      display: 'none',
    });
    document.body.appendChild(this.fpsEl);
    this.fpsVisible = import.meta.env?.DEV;
    if (this.fpsVisible) this.fpsEl.style.display = 'block';

    window.addEventListener('keydown', (e) => {
      if (e.key === 'F3' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.fpsVisible = !this.fpsVisible;
        this.fpsEl.style.display = this.fpsVisible ? 'block' : 'none';
      }
    });
  }

  _setupLights() {
    const ambient = new THREE.AmbientLight(0x404060, 0.6);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xFFEECC, 1.8);
    sun.position.set(30, 40, 20);
    sun.castShadow = true;
    const shadowSize = this._isLowEnd ? 1024 : 2048;
    sun.shadow.mapSize.width = shadowSize;
    sun.shadow.mapSize.height = shadowSize;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x88BBFF, 0.5);
    fill.position.set(-20, 10, -20);
    this.scene.add(fill);

    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x3a7a3a, 0.8);
    this.scene.add(hemi);
  }

  _setupResizeHandler() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.composer.setSize(window.innerWidth, window.innerHeight);
      this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  async loadScene(url) {
    const gltf = await this.gltfLoader.loadAsync(url);
    this.scene.add(gltf.scene);
    await this.materialSystem.init();
    this.materialSystem.applyShadersToScene();
    return gltf;
  }

  optimizeStaticMeshes(root) {
    // Group by (geometry uuid, material uuid) so meshes with same geometry but
    // different materials are instanced together per material group.
    const groups = new Map();
    root.traverse((child) => {
      if (!child.isMesh || child.isSkinnedMesh) return;
      const geoKey = child.geometry.uuid;
      const matKey = child.material.uuid;
      const key = `${geoKey}|${matKey}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(child);
    });

    let instancedCount = 0;
    let savedDrawCalls = 0;

    for (const [key, meshes] of groups) {
      if (meshes.length < 2) continue;
      const [geoPart, matPart] = key.split('|');
      const geo = meshes[0].geometry;
      const mat = meshes[0].material;
      const instanced = new THREE.InstancedMesh(geo, mat, meshes.length);
      instanced.castShadow = meshes[0].castShadow;
      instanced.receiveShadow = meshes[0].receiveShadow;
      const dummy = new THREE.Object3D();
      meshes.forEach((mesh, i) => {
        mesh.getWorldPosition(dummy.position);
        mesh.getWorldQuaternion(dummy.quaternion);
        mesh.getWorldScale(dummy.scale);
        instanced.setMatrixAt(i, dummy.matrixWorld);
        if (instanced.instanceColor) {
          instanced.setColorAt(i, new THREE.Color(mesh.material.color));
        }
      });
      instanced.instanceMatrix.needsUpdate = true;
      if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;

      const parent = meshes[0].parent;
      for (const mesh of meshes) {
        if (mesh.parent) mesh.parent.remove(mesh);
        if (mesh.geometry.dispose && mesh.geometry !== geo) mesh.geometry.dispose();
        if (mesh.material.dispose && mesh.material !== mat) mesh.material.dispose();
      }
      parent.add(instanced);

      instancedCount++;
      savedDrawCalls += meshes.length - 1;
    }

    this._perfStats.instancedMeshes += instancedCount;
    this._perfStats.instancedDrawCalls += savedDrawCalls;

    if (instancedCount > 0 && import.meta.env?.DEV) {
      console.log(`[SceneSystem] InstancedMesh: merged ${instancedCount} groups, saved ~${savedDrawCalls} draw calls`);
    }
  }

  async loadAnimData(url) {
    const res = await fetch(url);
    return res.json();
  }

  /**
   * Load a texture with caching and optional size clamping to keep memory down.
   * Returns a cached texture if already loaded.
   */
  async loadTexture(url) {
    if (this._textureCache.has(url)) {
      return this._textureCache.get(url);
    }
    const loader = new THREE.TextureLoader();
    const texture = await new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });
    // Clamp oversized textures to reduce GPU memory
    if (texture.image) {
      const { width, height } = texture.image;
      if (width > this._maxTextureSize || height > this._maxTextureSize) {
        const scale = this._maxTextureSize / Math.max(width, height);
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(texture.image, 0, 0, canvas.width, canvas.height);
        texture.image = canvas;
        texture.needsUpdate = true;
      }
      this._perfStats.textureLoads++;
      this._perfStats.textureBytes += canvas ? canvas.width * canvas.height * 4 : 0;
    }
    this._textureCache.set(url, texture);
    return texture;
  }

  update() {
    this.controls.update();
    this.materialSystem.update(this.clock.getDelta());
  }

  render() {
    this.composer.render();
    this.labelRenderer.render(this.scene, this.camera);
  }

  updateFps() {
    const now = Date.now();
    const delta = now - this._fpsLast;
    this._fpsLast = now;
    this._fpsFrames++;
    this._fpsTime += delta;

    // Track per-frame times for averaging
    this._perfStats.frameTimes[this._perfStats.frameTimeIdx] = delta;
    this._perfStats.frameTimeIdx = (this._perfStats.frameTimeIdx + 1) % this._perfStats.frameTimes.length;

    if (this._fpsTime >= 1000) {
      const fps = Math.round((this._fpsFrames * 1000) / this._fpsTime);
      const info = this.renderer.info.render;
      const mem = this.renderer.info.memory;
      const calls = info.calls;
      const triangles = info.triangles;
      const textures = mem.textures;
      const geometries = mem.geometries;
      const avgFrameTime = this._perfStats.frameTimes.reduce((a, b) => a + b, 0) / this._perfStats.frameTimes.length;
      this.fpsEl.textContent = `${fps} FPS | ${calls} draw | ${triangles.toLocaleString()} tri | ${textures} tex | ${geometries} geo | ~${avgFrameTime.toFixed(1)}ms`;
      this._fpsFrames = 0;
      this._fpsTime = 0;
    }
  }

  getPerfStats() {
    return { ...this._perfStats };
  }

  dispose() {
    this.composer?.dispose();
    this.waterMaterial?.dispose();
    this.grassMaterial?.dispose();
    this.renderer.dispose();
    this._textureCache.clear();
  }
}
