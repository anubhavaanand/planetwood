import * as THREE from 'three';

/**
 * Material & shader system that enhances glTF-loaded materials
 * to match messenger.abeto.co's visual style: colored terrain,
 * emissive VFX, water shaders, grass, and NPC skin tones.
 */
export class MaterialSystem {
  constructor(scene) {
    this.scene = scene;
    this.textureLoader = new THREE.TextureLoader();
    this.ktxLoader = null; // lazy-load KTX2 if available
    this.materialOverrides = new Map();
    this.waterUniforms = null;
    this.grassUniforms = null;
  }

  async init() {
    // Try to load KTX2 loader for compressed textures
    try {
      const { KTX2Loader } = await import('three/addons/loaders/KTX2Loader.js');
      this.ktxLoader = new KTX2Loader();
      this.ktxLoader.setTranscoderPath('https://unpkg.com/three@0.185.0/examples/jsm/basis/');
      await this.ktxLoader.detectSupport(renderer => {
        this.ktxLoader = renderer;
      });
    } catch (e) {
      console.warn('[MaterialSystem] KTX2 loader unavailable, using fallback colors');
    }

    this._applyMaterialOverrides();
    this._setupWaterShader();
    this._setupGrassShader();
    this._setupEmissiveVFX();
  }

  /*──────────────────── color palette ────────────────────*/
  _terrainColor(name) {
    const n = name.toLowerCase();
    if (n.includes('sand') || n.includes('beach')) return new THREE.Color(0xd2b48c);
    if (n.includes('rock') || n.includes('stone') || n.includes('cliff')) return new THREE.Color(0x8b8b7a);
    if (n.includes('grass') || n.includes('ground') || n.includes('earth')) return new THREE.Color(0x5a8a4a);
    if (n.includes('snow') || n.includes('ice')) return new THREE.Color(0xe8f0f8);
    return new THREE.Color(0x6b8e5a);
  }

  _npcColor(name) {
    const n = name.toLowerCase();
    if (n.includes('alien')) return new THREE.Color(0x7a5c00);
    if (n.includes('chef')) return new THREE.Color(0xd4a373);
    if (n.includes('caveman')) return new THREE.Color(0x8d6e63);
    if (n.includes('boss')) return new THREE.Color(0x5d4037);
    if (n.includes('flower')) return new THREE.Color(0x8e44ad);
    if (n.includes('scout')) return new THREE.Color(0x4a90e2);
    if (n.includes('threekid')) return new THREE.Color(0xf5b041);
    if (n.includes('factory')) return new THREE.Color(0x7f8c8d);
    if (n.includes('female')) return new THREE.Color(0xd7bde2);
    if (n.includes('male')) return new THREE.Color(0x85c1e9);
    if (n.includes('diver')) return new THREE.Color(0x1a5276);
    if (n.includes('mountain')) return new THREE.Color(0x616a6b);
    if (n.includes('office')) return new THREE.Color(0x95a5a6);
    return new THREE.Color(0x95a5a6);
  }

  /*──────────────────── apply overrides ────────────────────*/
  _applyMaterialOverrides() {
    this.scene.traverse((obj) => {
      if (!obj.isMesh) return;
      const mat = obj.material;
      if (!mat || !mat.name) return;
      const name = mat.name.toLowerCase();

      // Skip if user already set a custom override
      if (this.materialOverrides.has(mat.uuid)) return;

      // Terrain
      if (name.startsWith('m_terrain') || name.includes('terrain')) {
        this._setupTerrainMat(mat, name);
        return;
      }
      // Water
      if (name.startsWith('m_water') || name.includes('water')) {
        this._setupWaterMat(mat, name);
        return;
      }
      // NPCs
      if (name.startsWith('mat_npc')) {
        this._setupNPCMat(mat, name);
        return;
      }
      // Cables / wires (emissive-ish)
      if (name.includes('cable') || name.includes('wire')) {
        mat.emissive = new THREE.Color(0x334455);
        mat.emissiveIntensity = 0.4;
        mat.roughness = 0.8;
        mat.metalness = 0.1;
        return;
      }
      // VFX / emissive
      if (name.includes('vfx') || name.includes('smoke') || name.includes('foam') || name.includes('splash')) {
        mat.emissive = new THREE.Color(0x4488ff);
        mat.emissiveIntensity = 0.8;
        mat.transparent = true;
        mat.opacity = 0.6;
        mat.depthWrite = false;
        return;
      }
      // Default: slight emissive for unlit look
      mat.emissive = new THREE.Color(0x111111);
      mat.emissiveIntensity = 0.2;
    });
  }

  _setupTerrainMat(mat, name) {
    mat.color = this._terrainColor(name);
    mat.roughness = 1.0;
    mat.metalness = 0.0;
    mat.emissive = new THREE.Color(0x050505);
    mat.emissiveIntensity = 0.15;
    mat.flatShading = true;
  }

  _setupWaterMat(mat, name) {
    mat.color = new THREE.Color(0x3a86ff);
    mat.roughness = 0.1;
    mat.metalness = 0.8;
    mat.emissive = new THREE.Color(0x001133);
    mat.emissiveIntensity = 0.2;
    mat.transparent = true;
    mat.opacity = 0.85;
    mat.envMapIntensity = 1.5;
  }

  _setupNPCMat(mat, name) {
    mat.color = this._npcColor(name);
    mat.roughness = 0.7;
    mat.metalness = 0.1;
    mat.emissive = new THREE.Color(0x080808);
    mat.emissiveIntensity = 0.1;
    mat.flatShading = true;
  }

  /*──────────────────── water shader ────────────────────*/
  _setupWaterShader() {
    this.waterUniforms = {
      time: { value: 0 },
      color: { value: new THREE.Color(0x3a86ff) },
    };

    const waterShader = {
      uniforms: this.waterUniforms,
      vertexShader: `
        uniform float time;
        varying vec2 vUv;
        varying float vElevation;
        void main(){
          vUv = uv;
          vec3 pos = position;
          pos.y += sin(pos.x * 0.5 + time) * 0.06;
          pos.y += cos(pos.z * 0.5 + time * 0.7) * 0.04;
          vElevation = pos.y * 0.5 + 0.5;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        varying vec2 vUv;
        varying float vElevation;
        void main(){
          float foam = smoothstep(0.45, 0.55, vElevation);
          vec3 deep = mix(color, vec3(0.05, 0.15, 0.35), 0.6);
          vec3 surf = mix(deep, color, vElevation);
          surf = mix(surf, vec3(1.0), foam * 0.5);
          gl_FragColor = vec4(surf, 0.85);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    };
    this.waterMaterial = new THREE.ShaderMaterial(waterShader);
  }

  /*──────────────────── grass shader ────────────────────*/
  _setupGrassShader() {
    this.grassUniforms = {
      time: { value: 0 },
      color: { value: new THREE.Color(0x5a8a4a) },
    };

    const grassShader = {
      uniforms: this.grassUniforms,
      vertexShader: `
        uniform float time;
        varying vec2 vUv;
        varying float vWind;
        void main(){
          vUv = uv;
          vWind = sin(position.x * 2.0 + time) * 0.05;
          vec3 pos = position;
          pos.x += vWind;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        varying vec2 vUv;
        varying float vWind;
        void main(){
          vec3 grass = mix(color, vec3(0.3, 0.5, 0.2), vUv.y * 0.4);
          gl_FragColor = vec4(grass, 1.0);
        }
      `,
      side: THREE.DoubleSide,
    };
    this.grassMaterial = new THREE.ShaderMaterial(grassShader);
  }

  /*──────────────────── emissive VFX ────────────────────*/
  _setupEmissiveVFX() {
    this.scene.traverse((obj) => {
      if (!obj.isMesh) return;
      const mat = obj.material;
      if (!mat || !mat.name) return;
      const name = mat.name.toLowerCase();
      if (name.includes('waterfall') || name.includes('inlet') || name.includes('splash')) {
        mat.emissive = new THREE.Color(0x66ccff);
        mat.emissiveIntensity = 1.2;
        mat.transparent = true;
        mat.opacity = 0.7;
        mat.depthWrite = false;
      }
      if (name.includes('cable')) {
        mat.emissive = new THREE.Color(0x224466);
        mat.emissiveIntensity = 0.6;
      }
    });
  }

  /*──────────────────── animation ────────────────────*/
  update(delta) {
    if (this.waterUniforms) this.waterUniforms.time.value += delta;
    if (this.grassUniforms) this.grassUniforms.time.value += delta;
  }

  /*──────────────────── replace terrain/water materials with shaders ────────────────────*/
  applyShadersToScene() {
    this.scene.traverse((obj) => {
      if (!obj.isMesh) return;
      const mat = obj.material;
      if (!mat || !mat.name) return;
      const name = mat.name.toLowerCase();

      if (name.startsWith('m_water') || name.includes('waterfall') || name.includes('inlet')) {
        obj.material = this.waterMaterial;
      }
      if (name.includes('grass') || name.includes('leaves') || name.includes('terrain') && name.includes('grass')) {
        obj.material = this.grassMaterial;
      }
    });
  }
}
