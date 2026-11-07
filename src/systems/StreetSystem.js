import * as THREE from 'three';

// Builds the 2.5D messenger street scene: a perspective road receding into
// the distance, lined with green buildings, sidewalks, street lamps, trees
// and mailboxes — matching the official messenger.abeto.co world.
export class StreetSystem {
  constructor(scene) {
    this.scene = scene;
    this.roadWidth = 16;
    this.roadLength = 260;
    this._buildStreet();
  }

  _buildStreet() {
    // ---- Road ----
    const roadGeo = new THREE.PlaneGeometry(this.roadWidth, this.roadLength);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x4c5c62,
      roughness: 0.9,
      metalness: 0.05,
    });
    this.road = new THREE.Mesh(roadGeo, roadMat);
    this.road.rotation.x = -Math.PI / 2;
    this.road.position.set(0, 0.02, -this.roadLength / 2);
    this.road.receiveShadow = true;
    this.scene.add(this.road);

    // ---- Center dashed line (InstancedMesh) ----
    const dashGeo = new THREE.PlaneGeometry(0.5, 3);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const dashCount = 28;
    this.dashInstanced = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < dashCount; i++) {
      dummy.position.set(0, 0.05, -this.roadLength / 2 + 10 + i * 8);
      dummy.rotation.x = -Math.PI / 2;
      dummy.updateMatrix();
      this.dashInstanced.setMatrixAt(i, dummy.matrix);
    }
    this.dashInstanced.instanceMatrix.needsUpdate = true;
    this.dashInstanced.frustumCulled = true;
    this.scene.add(this.dashInstanced);

    // ---- Sidewalks ----
    const sidewalkWidth = 6;
    const sidewalkGeo = new THREE.PlaneGeometry(sidewalkWidth, this.roadLength);
    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0x8a9aa0,
      roughness: 0.9,
    });

    const leftWalk = new THREE.Mesh(sidewalkGeo, sidewalkMat);
    leftWalk.rotation.x = -Math.PI / 2;
    leftWalk.position.set(-(this.roadWidth / 2 + sidewalkWidth / 2), 0.03, -this.roadLength / 2);
    leftWalk.receiveShadow = true;
    this.scene.add(leftWalk);

    const rightWalk = new THREE.Mesh(sidewalkGeo, sidewalkMat);
    rightWalk.rotation.x = -Math.PI / 2;
    rightWalk.position.set(this.roadWidth / 2 + sidewalkWidth / 2, 0.03, -this.roadLength / 2);
    rightWalk.receiveShadow = true;
    this.scene.add(rightWalk);

    // ---- Buildings on both sides ----
    this._addBuildingRow(-(this.roadWidth / 2 + sidewalkWidth + 7));
    this._addBuildingRow(this.roadWidth / 2 + sidewalkWidth + 7);

    // ---- Street lamps (InstancedMesh) ----
    this._addStreetLamps();

    // ---- Trees (InstancedMesh) ----
    this._addTrees();

    // ---- Mailboxes on left building wall (InstancedMesh) ----
    this._addMailboxes();
  }

  _addBuildingRow(x) {
    const bWidth = 14;
    const bDepth = 44;
    const bHeight = 13;
    const startZ = -this.roadLength / 2 + 16;

    for (let z = startZ; z < this.roadLength / 2; z += bDepth) {
      const group = new THREE.Group();

      const blockGeo = new THREE.BoxGeometry(bWidth, bHeight, bDepth);
      const blockMat = new THREE.MeshStandardMaterial({ color: 0x709078 });
      const block = new THREE.Mesh(blockGeo, blockMat);
      block.position.y = bHeight / 2;
      block.castShadow = true;
      block.receiveShadow = true;
      group.add(block);

      const roofGeo = new THREE.BoxGeometry(bWidth + 2, 2.5, bDepth + 2);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a4a3e });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = bHeight + 1.2;
      roof.castShadow = true;
      group.add(roof);

      const winGeo = new THREE.BoxGeometry(1.6, 2.2, 0.1);
      const winMat = new THREE.MeshStandardMaterial({ color: 0x1a2a2e });
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 2; c++) {
          const win = new THREE.Mesh(winGeo, winMat);
          win.position.set(x > 0 ? bWidth / 2 + 0.06 : -bWidth / 2 - 0.06, bHeight / 2 - 2 + r * 4, c === 0 ? -bDepth / 3 : bDepth / 3);
          win.position.z += z - startZ;
          win.castShadow = true;
          group.add(win);
        }
      }

      const doorGeo = new THREE.BoxGeometry(2.2, 4, 0.1);
      const doorMat = new THREE.MeshStandardMaterial({ color: 0x2a3a2e });
      const door = new THREE.Mesh(doorGeo, doorMat);
      door.position.set(x > 0 ? bWidth / 2 + 0.06 : -bWidth / 2 - 0.06, bHeight / 2 - 5, 0);
      door.position.z += z - startZ;
      group.add(door);

      group.position.set(x, 0, z);
      this.scene.add(group);
    }
  }

  _addStreetLamps() {
    const lampGeo = new THREE.CylinderGeometry(0.12, 0.12, 7, 8);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x5a5a5a });
    const headGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.5, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a });

    const positions = [
      { x: -11, z: -90 }, { x: -11, z: -40 }, { x: -11, z: 10 }, { x: -11, z: 60 },
      { x: 11, z: -70 }, { x: 11, z: -20 }, { x: 11, z: 30 }, { x: 11, z: 80 },
    ];

    const count = positions.length;
    const dummy = new THREE.Object3D();

    // Pole instanced mesh
    this.lampPoleInstanced = new THREE.InstancedMesh(lampGeo, lampMat, count);
    positions.forEach((p, i) => {
      dummy.position.set(p.x, 3.5, p.z);
      dummy.updateMatrix();
      this.lampPoleInstanced.setMatrixAt(i, dummy.matrix);
    });
    this.lampPoleInstanced.instanceMatrix.needsUpdate = true;
    this.lampPoleInstanced.frustumCulled = true;
    this.scene.add(this.lampPoleInstanced);

    // Head instanced mesh
    this.lampHeadInstanced = new THREE.InstancedMesh(headGeo, headMat, count);
    positions.forEach((p, i) => {
      dummy.position.set(p.x, 7, p.z);
      dummy.updateMatrix();
      this.lampHeadInstanced.setMatrixAt(i, dummy.matrix);
    });
    this.lampHeadInstanced.instanceMatrix.needsUpdate = true;
    this.lampHeadInstanced.frustumCulled = true;
    this.scene.add(this.lampHeadInstanced);
  }

  _addTrees() {
    const leafGeo = new THREE.SphereGeometry(1.6, 8, 8);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3a7a3a });
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 3, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a });

    const positions = [
      { x: -14, z: -110 }, { x: -14, z: -60 }, { x: -14, z: -10 },
      { x: 14, z: -100 }, { x: 14, z: -50 }, { x: 14, z: 0 }, { x: 14, z: 50 },
    ];

    const count = positions.length;
    const dummy = new THREE.Object3D();

    // Trunk instanced mesh
    this.treeTrunkInstanced = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    positions.forEach((p, i) => {
      dummy.position.set(p.x, 1.5, p.z);
      dummy.updateMatrix();
      this.treeTrunkInstanced.setMatrixAt(i, dummy.matrix);
    });
    this.treeTrunkInstanced.instanceMatrix.needsUpdate = true;
    this.treeTrunkInstanced.frustumCulled = true;
    this.scene.add(this.treeTrunkInstanced);

    // Leaves instanced mesh
    this.treeLeafInstanced = new THREE.InstancedMesh(leafGeo, leafMat, count);
    positions.forEach((p, i) => {
      dummy.position.set(p.x, 4.2, p.z);
      dummy.updateMatrix();
      this.treeLeafInstanced.setMatrixAt(i, dummy.matrix);
    });
    this.treeLeafInstanced.instanceMatrix.needsUpdate = true;
    this.treeLeafInstanced.frustumCulled = true;
    this.scene.add(this.treeLeafInstanced);
  }

  _addMailboxes() {
    const boxGeo = new THREE.BoxGeometry(0.9, 1.1, 0.5);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2a });
    const flagGeo = new THREE.BoxGeometry(0.15, 0.35, 0.1);
    const flagMat = new THREE.MeshStandardMaterial({ color: 0xc25959 });

    const positions = [-10.5, -9.5];
    const zs = [-95, -65, -35, -5, 25, 55, 85];

    const count = positions.length * zs.length;
    const dummy = new THREE.Object3D();

    // Box instanced mesh
    this.mailboxBoxInstanced = new THREE.InstancedMesh(boxGeo, boxMat, count);
    let idx = 0;
    for (const bx of positions) {
      for (const z of zs) {
        dummy.position.set(bx, 0.55, z);
        dummy.updateMatrix();
        this.mailboxBoxInstanced.setMatrixAt(idx, dummy.matrix);
        idx++;
      }
    }
    this.mailboxBoxInstanced.instanceMatrix.needsUpdate = true;
    this.mailboxBoxInstanced.frustumCulled = true;
    this.scene.add(this.mailboxBoxInstanced);

    // Flag instanced mesh
    this.mailboxFlagInstanced = new THREE.InstancedMesh(flagGeo, flagMat, count);
    idx = 0;
    for (const bx of positions) {
      for (const z of zs) {
        dummy.position.set(bx + 0.35, 0.85, z);
        dummy.updateMatrix();
        this.mailboxFlagInstanced.setMatrixAt(idx, dummy.matrix);
        idx++;
      }
    }
    this.mailboxFlagInstanced.instanceMatrix.needsUpdate = true;
    this.mailboxFlagInstanced.frustumCulled = true;
    this.scene.add(this.mailboxFlagInstanced);
  }

  // Follow camera behind and above the character, looking down the street.
  updateCamera(camera, characterPos) {
    const offset = new THREE.Vector3(0, 5, -8);
    camera.position.copy(characterPos).add(offset);
    camera.lookAt(characterPos.x, characterPos.y + 1.2, characterPos.z + 6);
    camera.updateMatrixWorld();
  }
}
