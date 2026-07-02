import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');

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

  createSkinnedMesh(geoUrl, skeleton, material) {
    return this.loadGeometry(geoUrl).then((geo) => {
      geo.computeVertexNormals();
      const mat = material || new THREE.MeshStandardMaterial({ color: 0x88aa88, skinning: true, roughness: 0.7, metalness: 0.1 });
      const mesh = new THREE.SkinnedMesh(geo, mat, skeleton);
      mesh.bind(skeleton);
      mesh.frustumCulled = false;
      return mesh;
    });
  }
}
