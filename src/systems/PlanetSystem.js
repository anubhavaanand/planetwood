import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PLANET_DIR = '/assets/planets/present/';
const LOD_LEVELS = 10;

// Camera-to-planet-center distances for LOD switching (full_0 → full_9).
// full_0 is the highest-detail mesh; full_9 is the coarsest.
const LOD_DISTANCES = [45, 90, 135, 180, 225, 270, 315, 360, 405, Infinity];

// Instanced element counts.
const WATER_COUNT = 6;
const GRASS_COUNT = 120;
const TREE_COUNT = 24;
const BUTTERFLY_COUNT = 16;

// Planet surface anchor — matches the original z ≈ 220 surface placement.
const PLANET_Z = 220;

/**
 * Builds the 3D planet surface scene using actual planet models from
 * messenger.abeto. Contains:
 *   - A planet arch at z = 170 (the gateway the player walks through)
 *   - A planet surface group centered at z ≈ 220 (the destination world)
 *   - LOD-switched planet meshes (full_0 → full_9 based on camera distance)
 *   - A hitmesh for collision / raycasting
 *   - Instanced water, grass, trees, and butterflies
 */
export class PlanetSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.currentLod = -1;
    this.lodMeshes = [];
    this.hitmesh = null;
    this.waterInstanced = null;
    this.grassInstanced = null;
    this.treeInstanced = null;
    this.butterflyInstanced = null;
    this.archGroup = null;

    this._dracoLoader = new DRACOLoader();
    this._dracoLoader.setDecoderPath('/draco/');
    this._gltfLoader = new GLTFLoader();

    this._materials = new Map();

    this._buildArch();
  }

  /**
   * Async second-phase constructor. Loads all planet LOD models, hitmesh,
   * and instanced elements. Must be awaited before the player can reach
   * the planet (z > 160).
   */
  async init() {
    await this._loadPlanetModels();
    await this._loadHitmesh();
    await this._loadInstancedElements();
    this._updateLOD(0);
  }

  /* ------------------------------------------------------------------ */
  /* Arch — gateway at z = 170                                          */
  /* ------------------------------------------------------------------ */

  _buildArch() {
    const archGroup = new THREE.Group();

    const pillarGeo = new THREE.BoxGeometry(2, 6, 2);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x6b5b4b });
    const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
    leftPillar.position.set(-4, 3, 0);
    leftPillar.castShadow = true;
    leftPillar.receiveShadow = true;
    archGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
    rightPillar.position.set(4, 3, 0);
    rightPillar.castShadow = true;
    rightPillar.receiveShadow = true;
    archGroup.add(rightPillar);

    const beamGeo = new THREE.BoxGeometry(10, 1.5, 2);
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x6b5b4b });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, 6, 0);
    beam.castShadow = true;
    beam.receiveShadow = true;
    archGroup.add(beam);

    const glowGeo = new THREE.BoxGeometry(10, 0.5, 2);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x44aaff });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(0, 6, 1.01);
    archGroup.add(glow);

    archGroup.position.set(0, 0, 170);
    archGroup.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this.archGroup = archGroup;
    this.group.add(archGroup);
  }

  /* ------------------------------------------------------------------ */
  /* Planet LOD models                                                  */
  /* ------------------------------------------------------------------ */

  async _loadPlanetModels() {
    const promises = [];
    for (let i = 0; i < LOD_LEVELS; i++) {
      promises.push(this._loadLOD(i));
    }
    await Promise.all(promises);
  }

  async _loadLOD(index) {
    const url = PLANET_DIR + 'full_' + index + '.glb';
    const gltf = await this._gltfLoader.loadAsync(url);
    const sourceMesh = gltf.scene.children[0];

    const geometry = sourceMesh.geometry;
    const material = this._getPlanetMaterial();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, PLANET_Z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    mesh.visible = false;
    this.group.add(mesh);

    this.lodMeshes.push({
      mesh,
      distance: LOD_DISTANCES[index],
      index,
    });
  }

  _getPlanetMaterial() {
    if (!this._materials.has('planet')) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x5a7a4a,
        roughness: 0.8,
        metalness: 0.1,
      });
      this._materials.set('planet', mat);
    }
    return this._materials.get('planet');
  }

  /* ------------------------------------------------------------------ */
  /* Hitmesh — collision / raycasting                                   */
  /* ------------------------------------------------------------------ */

  async _loadHitmesh() {
    try {
      const gltf = await this._gltfLoader.loadAsync(PLANET_DIR + 'hitmesh_0.glb');
      const hitmeshGeo = gltf.scene.children[0].geometry;
      this.hitmesh = new THREE.Mesh(
        hitmeshGeo,
        new THREE.MeshBasicMaterial({ color: 0xff0000, visible: false })
      );
      this.hitmesh.position.set(0, 0, PLANET_Z);
      this.hitmesh.visible = false; // collision-only, not rendered
      this.hitmesh.frustumCulled = false;
      this.group.add(this.hitmesh);
    } catch (e) {
      console.warn('[PlanetSystem] Failed to load hitmesh:', e.message);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Instanced elements — water, grass, trees, butterflies              */
  /* ------------------------------------------------------------------ */

  async _loadInstancedElements() {
    await this._loadWater();
    await this._loadGrass();
    await this._loadTrees();
    await this._loadButterflies();
  }

  async _loadWater() {
    try {
      const gltf = await this._gltfLoader.loadAsync(PLANET_DIR + 'water.glb');
      const geometry = gltf.scene.children[0].geometry;
      const material = new THREE.MeshStandardMaterial({
        color: 0x44aaff,
        transparent: true,
        opacity: 0.7,
        roughness: 0.1,
        metalness: 0.8,
      });
      this.waterInstanced = new THREE.InstancedMesh(geometry, material, WATER_COUNT);
      this.waterInstanced.position.set(0, 0, PLANET_Z);
      this.waterInstanced.frustumCulled = true;

      const dummy = new THREE.Object3D();
      const waterPositions = [
        { x: -20, z: 190 }, { x: 20, z: 240 }, { x: -10, z: 260 },
        { x: 25, z: 190 }, { x: -30, z: 220 }, { x: 15, z: 250 },
      ];
      waterPositions.forEach((p, i) => {
        dummy.position.set(p.x, 0, p.z);
        dummy.updateMatrix();
        this.waterInstanced.setMatrixAt(i, dummy.matrix);
      });
      this.waterInstanced.instanceMatrix.needsUpdate = true;
      this.group.add(this.waterInstanced);
    } catch (e) {
      console.warn('[PlanetSystem] Failed to load water:', e.message);
    }
  }

  async _loadGrass() {
    try {
      const geometry = await this._loadDracoGeometry(PLANET_DIR + 'grass.drc');
      const material = new THREE.MeshStandardMaterial({
        color: 0x4d6a3d,
        roughness: 1.0,
        metalness: 0.0,
      });
      this.grassInstanced = new THREE.InstancedMesh(geometry, material, GRASS_COUNT);
      this.grassInstanced.position.set(0, 0, PLANET_Z);
      this.grassInstanced.frustumCulled = true;

      const dummy = new THREE.Object3D();
      for (let i = 0; i < GRASS_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 5 + Math.random() * 55;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        dummy.position.set(x, 0, z);
        dummy.scale.set(0.8 + Math.random() * 0.4, 1, 0.8 + Math.random() * 0.4);
        dummy.updateMatrix();
        this.grassInstanced.setMatrixAt(i, dummy.matrix);
      }
      this.grassInstanced.instanceMatrix.needsUpdate = true;
      this.group.add(this.grassInstanced);
    } catch (e) {
      console.warn('[PlanetSystem] Failed to load grass:', e.message);
    }
  }

  async _loadTrees() {
    try {
      const gltf = await this._gltfLoader.loadAsync(PLANET_DIR + 'tree-leaves_0.glb');
      const geometry = gltf.scene.children[0].geometry;
      const material = new THREE.MeshStandardMaterial({
        color: 0x3a7a3a,
        roughness: 0.9,
        metalness: 0.0,
      });
      this.treeInstanced = new THREE.InstancedMesh(geometry, material, TREE_COUNT);
      this.treeInstanced.position.set(0, 0, PLANET_Z);
      this.treeInstanced.frustumCulled = true;

      const dummy = new THREE.Object3D();
      const treePositions = [
        { x: -35, z: 175 }, { x: 35, z: 235 }, { x: -25, z: 260 },
        { x: 30, z: 185 }, { x: -45, z: 220 }, { x: 20, z: 270 },
        { x: -20, z: 285 }, { x: 40, z: 210 }, { x: -50, z: 195 },
        { x: 10, z: 295 }, { x: -30, z: 245 }, { x: 25, z: 200 },
        { x: -40, z: 255 }, { x: 15, z: 180 }, { x: -15, z: 275 },
        { x: 45, z: 240 }, { x: -55, z: 205 }, { x: 5, z: 280 },
        { x: -25, z: 190 }, { x: 30, z: 265 }, { x: -45, z: 230 },
        { x: 20, z: 175 }, { x: -35, z: 280 }, { x: 10, z: 205 },
      ];
      treePositions.forEach((p, i) => {
        dummy.position.set(p.x, 0, p.z);
        dummy.updateMatrix();
        this.treeInstanced.setMatrixAt(i, dummy.matrix);
      });
      this.treeInstanced.instanceMatrix.needsUpdate = true;
      this.group.add(this.treeInstanced);
    } catch (e) {
      console.warn('[PlanetSystem] Failed to load trees:', e.message);
    }
  }

  async _loadButterflies() {
    try {
      const geometry = await this._loadDracoGeometry(PLANET_DIR + 'butterflies.drc');
      const material = new THREE.MeshStandardMaterial({
        color: 0xffaa44,
        roughness: 0.5,
        metalness: 0.0,
      });
      this.butterflyInstanced = new THREE.InstancedMesh(geometry, material, BUTTERFLY_COUNT);
      this.butterflyInstanced.position.set(0, 0, PLANET_Z);
      this.butterflyInstanced.frustumCulled = true;

      const dummy = new THREE.Object3D();
      for (let i = 0; i < BUTTERFLY_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 10 + Math.random() * 50;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = 2 + Math.random() * 8;
        dummy.position.set(x, y, z);
        dummy.updateMatrix();
        this.butterflyInstanced.setMatrixAt(i, dummy.matrix);
      }
      this.butterflyInstanced.instanceMatrix.needsUpdate = true;
      this.group.add(this.butterflyInstanced);
    } catch (e) {
      console.warn('[PlanetSystem] Failed to load butterflies:', e.message);
    }
  }

  async _loadDracoGeometry(url) {
    return new Promise((resolve, reject) => {
      this._dracoLoader.load(url, resolve, undefined, reject);
    });
  }

  /* ------------------------------------------------------------------ */
  /* LOD switching                                                      */
  /* ------------------------------------------------------------------ */

  _updateLOD(distance) {
    let newLod = LOD_LEVELS - 1;
    for (let i = 0; i < LOD_LEVELS; i++) {
      if (distance < LOD_DISTANCES[i]) {
        newLod = i;
        break;
      }
    }
    if (newLod !== this.currentLod) {
      this.lodMeshes.forEach((lod, i) => {
        lod.mesh.visible = i === newLod;
      });
      this.currentLod = newLod;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Per-frame update                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Call once per frame while the planet scene is active. Updates LOD
   * based on camera distance to the planet center.
   */
  update(camera) {
    if (!this.group.visible) return;

    const planetCenter = new THREE.Vector3(0, 0, PLANET_Z);
    const distance = camera.position.distanceTo(planetCenter);
    this._updateLOD(distance);
  }

  /* ------------------------------------------------------------------ */
  /* Show / hide                                                        */
  /* ------------------------------------------------------------------ */

  show() {
    this.group.visible = true;
    if (this.currentLod >= 0 && this.currentLod < this.lodMeshes.length) {
      this.lodMeshes[this.currentLod].mesh.visible = true;
    }
    if (this.waterInstanced) this.waterInstanced.visible = true;
    if (this.grassInstanced) this.grassInstanced.visible = true;
    if (this.treeInstanced) this.treeInstanced.visible = true;
    if (this.butterflyInstanced) this.butterflyInstanced.visible = true;
  }

  hide() {
    this.group.visible = false;
    this.lodMeshes.forEach((lod) => {
      lod.mesh.visible = false;
    });
    if (this.waterInstanced) this.waterInstanced.visible = false;
    if (this.grassInstanced) this.grassInstanced.visible = false;
    if (this.treeInstanced) this.treeInstanced.visible = false;
    if (this.butterflyInstanced) this.butterflyInstanced.visible = false;
  }

  /* ------------------------------------------------------------------ */
  /* Disposal                                                           */
  /* ------------------------------------------------------------------ */

  dispose() {
    this.lodMeshes.forEach((lod) => {
      lod.mesh.geometry?.dispose();
      lod.mesh.material?.dispose();
    });
    if (this.hitmesh) {
      this.hitmesh.geometry.dispose();
      this.hitmesh.material.dispose();
    }
    [this.waterInstanced, this.grassInstanced, this.treeInstanced, this.butterflyInstanced].forEach((inst) => {
      if (inst) {
        inst.geometry.dispose();
        inst.material.dispose();
      }
    });
    this.archGroup.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        child.material.dispose();
      }
    });
  }
}
