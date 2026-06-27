import * as THREE from 'three';
import { NPC } from '../entities/NPC.js';

export class NPCSystem {
  constructor(scene, animationSystem, animData, meshLoader) {
    this.scene = scene;
    this.animationSystem = animationSystem;
    this.animData = animData;
    this.meshLoader = meshLoader;
    this.npcs = [];
  }

  async loadFromScene(gltfScene) {
    const npcData = this._extractNPCData(gltfScene);
    const meshes = await Promise.allSettled(
      npcData.map(data => this._createNPC(data))
    );
    for (const result of meshes) {
      if (result.status === 'fulfilled' && result.value) {
        const npc = result.value;
        this.scene.add(npc.group);
        this.npcs.push(npc);
      }
    }
    return this.npcs;
  }

  async _createNPC(data) {
    const npc = new NPC(data);
    const skinEntry = this.animationSystem.findSkinEntry(this.animData, data.npcType);
    if (!skinEntry) return npc;

    const { bones, skeleton } = this.animationSystem.createSkin(skinEntry);

    if (this.meshLoader) {
      const meshUrl = `/assets/npcs/${data.npcType}/${data.npcType}.drc`;
      try {
        const mesh = await this.meshLoader.createSkinnedMesh(meshUrl, skeleton);
        npc.setSkinnedMesh(mesh, skeleton);
      } catch (e) {
        this._fallbackMesh(npc, skeleton);
      }
    } else {
      this._fallbackMesh(npc, skeleton);
    }

    const animEntry = this.animationSystem.findAnimEntry(this.animData, data.npcType, 'idle');
    if (animEntry && npc.skeleton) {
      const { clip, mixer } = this.animationSystem.createSkinAnimation(animEntry, npc.skeleton);
      npc.addAnimation('idle', clip, mixer);
      npc.playAnimation('idle');
    }

    return npc;
  }

  _fallbackMesh(npc, skeleton) {
    const geo = new THREE.BoxGeometry(1, 2, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x88aa88, skinning: true });
    const mesh = new THREE.SkinnedMesh(geo, mat, skeleton);
    mesh.bind(skeleton);
    npc.setSkinnedMesh(mesh, skeleton);
  }

  _npcNameToType(name) {
    const map = {
      'NPC_office_worker': 'office-worker',
      'NPC_office_worker2': 'office-worker',
      'NPC_chef': 'chef',
      'NPC_caveman': 'caveman',
      'NPC_boss': 'boss',
      'NPC_flower_lady': 'young-lady',
      'NPC_scout': 'scout',
      'NPC_threekid': 'threekid',
      'NPC_factory_a': 'factory-worker-a',
      'NPC_factory_b': 'factory-worker-b',
      'NPC_alien': 'alien',
      'NPC_diver': 'diver',
      'NPC_factory_c': 'factory-worker-c',
      'NPC_female_scientist': 'female-scientist',
      'NPC_fox': 'fox',
      'NPC_male_scientist': 'male-scientist',
      'NPC_mountainman': 'mountainman',
      'NPC_musician': 'musician',
      'NPC_oldwoman': 'oldwoman',
      'NPC_owl': 'owl',
    };
    return map[name] || name.replace(/^NPC_/, '').replace(/_/g, '-');
  }

  _extractNPCData(gltfScene) {
    const data = [];
    gltfScene.traverse((child) => {
      if (child.userData?.npcType || child.name.startsWith('NPC_') || child.name.startsWith('npc_')) {
        const npcType = child.userData?.npcType || this._npcNameToType(child.name);
        data.push({
          id: child.name,
          npcType,
          displayName: child.userData?.displayName || npcType.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          position: child.position,
          rotation: child.quaternion,
          skinKey: child.userData?.skinKey,
          animKey: child.userData?.animKey,
        });
      }
    });
    return data;
  }

  update(delta) {
    for (const npc of this.npcs) {
      npc.update(delta);
    }
  }
}
