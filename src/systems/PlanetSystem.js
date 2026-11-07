import * as THREE from 'three';

// Builds the 3D planet surface scene that the player transitions to when
// crossing z > 160 down the street. Contains:
//   - A planet arch at z = 170 (the gateway the player walks through)
//   - A planet surface group centered at z ≈ 220 (the destination world)
export class PlanetSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this._buildArch();
    this._buildPlanetSurface();
  }

  _buildArch() {
    // Planet arch positioned at z = 170 — the gateway marking the transition.
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

    // A glowing accent on the arch to signal the transition point.
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

  _buildPlanetSurface() {
    // Planet surface centered at z ≈ 220, where the player arrives after the arch.
    const surfaceGroup = new THREE.Group();

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(120, 120);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x5a7a4a,
      roughness: 1.0,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 220);
    ground.receiveShadow = true;
    surfaceGroup.add(ground);

    // Some terrain variety: low hills
    const hillGeo = new THREE.SphereGeometry(8, 12, 12);
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x4d6a3d });
    const hillPositions = [
      { x: -30, z: 200 }, { x: 30, z: 240 }, { x: -20, z: 250 },
      { x: 25, z: 190 }, { x: -40, z: 220 },
    ];
    const hillDummy = new THREE.Object3D();
    const hillInstanced = new THREE.InstancedMesh(hillGeo, hillMat, hillPositions.length);
    hillPositions.forEach((p, i) => {
      hillDummy.position.set(p.x, 4, p.z);
      hillDummy.updateMatrix();
      hillInstanced.setMatrixAt(i, hillDummy.matrix);
    });
    hillInstanced.instanceMatrix.needsUpdate = true;
    hillInstanced.frustumCulled = true;
    surfaceGroup.add(hillInstanced);

    // Decorative trees on the planet surface
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 3, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a });
    const leafGeo = new THREE.SphereGeometry(1.5, 8, 8);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3a7a3a });

    const treePositions = [
      { x: -15, z: 180 }, { x: 15, z: 230 }, { x: -10, z: 260 },
      { x: 20, z: 210 }, { x: -25, z: 240 },
    ];
    const trunkDummy = new THREE.Object3D();
    const leafDummy = new THREE.Object3D();

    const trunkInstanced = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);
    const leafInstanced = new THREE.InstancedMesh(leafGeo, leafMat, treePositions.length);
    treePositions.forEach((p, i) => {
      trunkDummy.position.set(p.x, 1.5, p.z);
      trunkDummy.updateMatrix();
      trunkInstanced.setMatrixAt(i, trunkDummy.matrix);

      leafDummy.position.set(p.x, 4.2, p.z);
      leafDummy.updateMatrix();
      leafInstanced.setMatrixAt(i, leafDummy.matrix);
    });
    trunkInstanced.instanceMatrix.needsUpdate = true;
    trunkInstanced.frustumCulled = true;
    leafInstanced.instanceMatrix.needsUpdate = true;
    leafInstanced.frustumCulled = true;
    surfaceGroup.add(trunkInstanced);
    surfaceGroup.add(leafInstanced);

    surfaceGroup.position.set(0, 0, 0);
    this.surfaceGroup = surfaceGroup;
    this.group.add(surfaceGroup);
  }

  show() {
    this.group.visible = true;
  }

  hide() {
    this.group.visible = false;
  }
}
