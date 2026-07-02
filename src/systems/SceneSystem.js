import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

export class SceneSystem {
  constructor(container) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 80, 150);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(25, 25, 35);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

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

    this._fpsFrames = 0;
    this._fpsTime = 0;
    this._setupFpsCounter();
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
    if (import.meta.env?.DEV) {
      this.fpsEl.style.display = 'block';
    }
  }

  _setupLights() {
    const ambient = new THREE.AmbientLight(0x404060, 0.6);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xFFEECC, 1.8);
    sun.position.set(30, 40, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
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
      this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  async loadScene(url) {
    const gltf = await this.gltfLoader.loadAsync(url);
    this.scene.add(gltf.scene);
    return gltf;
  }

  optimizeStaticMeshes(root) {
    const groups = new Map();
    root.traverse((child) => {
      if (!child.isMesh || child.isSkinnedMesh) return;
      const key = child.geometry.uuid;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(child);
    });

    for (const [geoId, meshes] of groups) {
      if (meshes.length < 2) continue;
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
        instanced.setColorAt(i, new THREE.Color(mesh.material.color));
      });
      instanced.instanceMatrix.needsUpdate = true;
      if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;

      const parent = meshes[0].parent;
      for (const mesh of meshes) {
        if (mesh.parent) mesh.parent.remove(mesh);
        mesh.geometry.dispose();
        if (mesh.material !== mat && mesh.material.dispose) mesh.material.dispose();
      }
      parent.add(instanced);
    }
  }

  async loadAnimData(url) {
    const res = await fetch(url);
    return res.json();
  }

  update() {
    this.controls.update();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  updateFps(delta) {
    this._fpsFrames++;
    this._fpsTime += delta;
    if (this._fpsTime >= 1) {
      this.fpsEl.textContent = `${Math.round(this._fpsFrames / this._fpsTime)} FPS`;
      this._fpsFrames = 0;
      this._fpsTime = 0;
    }
  }

  dispose() {
    this.renderer.dispose();
  }
}
