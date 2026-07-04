import * as THREE from 'three';

export class NPC {
  constructor({ id, npcType, displayName, position, rotation }) {
    this.id = id;
    this.npcType = npcType || 'alien';
    this.displayName = displayName || 'NPC';
    this.position = position ? new THREE.Vector3().copy(position) : new THREE.Vector3(0, 0, 0);
    this.rotation = rotation ? new THREE.Quaternion().copy(rotation) : new THREE.Quaternion();
    this.animationClips = [];
    this.activeClip = 'idle';

    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.group.quaternion.copy(this.rotation);

    this.skinnedMesh = null;
    this.mixer = null;
    this.actions = {};
  }

  setSkinnedMesh(mesh, skeleton) {
    if (this.skinnedMesh) {
      this.group.remove(this.skinnedMesh);
    }
    this.skinnedMesh = mesh;
    this.skeleton = skeleton;
    this.group.add(mesh);
  }

  addAnimation(name, clip) {
    if (!this.mixer && this.skeleton) {
      this.mixer = new THREE.AnimationMixer(this.skeleton.bones[0]?.parent || this.skeleton.bones[0]);
    }
    this.animationClips.push(name);
    const action = this.mixer.clipAction(clip);
    this.actions[name] = action;
  }

  playAnimation(name, fadeTime = 0.2) {
    if (!this.actions[name]) return;
    for (const key in this.actions) {
      const action = this.actions[key];
      if (key === name) {
        action.reset().setEffectiveWeight(1).play();
      } else {
        action.setEffectiveWeight(0);
      }
    }
    this.activeClip = name;
  }

  update(delta) {
    if (this.mixer) {
      this.mixer.update(delta);
    }
  }
}
