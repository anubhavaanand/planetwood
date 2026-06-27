import * as THREE from 'three';

export class PlayerAvatar {
  constructor({ id, displayName, position, rotation }) {
    this.id = id;
    this.displayName = displayName || 'Player';
    this.animationState = 'idle';
    this.isConnected = true;
    this.lastSeenAt = Date.now();

    this.group = new THREE.Group();
    this.group.position.copy(position || new THREE.Vector3(0, 2, 0));
    if (rotation) {
      this.group.quaternion.copy(rotation);
    }

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

  addAnimation(name, clip, mixer) {
    this.mixer = mixer;
    const action = mixer.clipAction(clip);
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
    this.animationState = name;
  }

  update(delta) {
    if (this.mixer) {
      this.mixer.update(delta);
    }
  }

  get position() { return this.group.position; }
  set position(v) { this.group.position.copy(v); }

  get quaternion() { return this.group.quaternion; }
  set quaternion(v) { this.group.quaternion.copy(v); }
}
