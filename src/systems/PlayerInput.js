import * as THREE from 'three';

export class PlayerInput {
  constructor(camera) {
    this.camera = camera;
    this.keys = {};
    this.moveDirection = new THREE.Vector3();
    this.movement = new THREE.Vector3();

    this._onKeyDown = (e) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      this.keys[e.code] = true;
    };
    this._onKeyUp = (e) => {
      this.keys[e.code] = false;
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  update(delta) {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
      this.keys = {};
      this.movement.set(0, 0, 0);
      return {
        movement: this.movement,
        keys: this.keys,
      };
    }

    const dir = this.moveDirection.set(0, 0, 0);
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    if (this.keys['KeyW'] || this.keys['ArrowUp']) dir.add(forward);
    if (this.keys['KeyS'] || this.keys['ArrowDown']) dir.sub(forward);
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) dir.sub(right);
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dir.add(right);

    if (dir.lengthSq() > 0) {
      dir.normalize();
      const speed = this.keys['ShiftLeft'] || this.keys['ShiftRight'] ? 12 : 6;
      this.movement.copy(dir).multiplyScalar(speed * delta);
    } else {
      this.movement.set(0, 0, 0);
    }

    return {
      movement: this.movement,
      keys: this.keys,
    };
  }

  isChatTriggered() {
    const triggered = this.keys['Enter'];
    if (triggered) this.keys['Enter'] = false;
    return triggered;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
