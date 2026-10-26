import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('./draco/');
const gltfLoader = new GLTFLoader();

export class MeshLoader {
  constructor() {
    this.cache = new Map();
  }

  loadGeometry(url) {
    if (this.cache.has(url)) return this.cache.get(url);
    const promise = new Promise((resolve, reject) => {
      dracoLoader.load(url, resolve, undefined, reject);
    });
    this.cache.set(url, promise);
    return promise;
  }

  // DRC meshes carry vertex data but no skinIndex/skinWeight, and the matching
  // .glb files also lack them in this asset set. A SkinnedMesh cannot bind
  // without skinning attributes, so fall back to a plain Mesh — the NPC still
  // renders and positions correctly, just without skeletal deformation.
  async createSkinnedMesh(geoUrl, skeleton, material) {
    let glbUrl = geoUrl.replace(/\.drc$/, '.glb');
    if (glbUrl.includes('/npcs/')) {
      glbUrl = glbUrl.replace('/npcs/', '/npcs/present/');
    }

    let geo = null;
    try {
      const gltf = await gltfLoader.loadAsync(glbUrl);
      geo = gltf.scenes[0].children[0].geometry;
    } catch {
      try { geo = await this.loadGeometry(geoUrl); } catch { geo = null; }
    }

    const mat = material || new THREE.MeshStandardMaterial({ color: 0x88aa88, skinning: true, roughness: 0.7, metalness: 0.1 });
    if (!geo) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8), mat);
      mesh.frustumCulled = true;
      return mesh;
    }

    geo.computeVertexNormals();

    if (geo.attributes.skinIndex && geo.attributes.skinWeight) {
      const mesh = new THREE.SkinnedMesh(geo, mat, skeleton);
      mesh.bind(skeleton);
      mesh.frustumCulled = true;
      return mesh;
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = true;
    return mesh;
  }
}