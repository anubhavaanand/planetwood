import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 80, 150);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(25, 25, 35);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 5, 0);
controls.maxPolarAngle = Math.PI / 2.2;
controls.minDistance = 5;
controls.maxDistance = 100;
controls.update();

// Lighting
const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xFFEECC, 1.8);
sunLight.position.set(30, 40, 20);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 80;
sunLight.shadow.camera.left = -50;
sunLight.shadow.camera.right = 50;
sunLight.shadow.camera.top = 50;
sunLight.shadow.camera.bottom = -50;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0x88BBFF, 0.5);
fillLight.position.set(-20, 10, -20);
scene.add(fillLight);

const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x3a7a3a, 0.8);
scene.add(hemiLight);

// Loading
const loader = document.getElementById('loading');
const gltfLoader = new GLTFLoader();
const clock = new THREE.Clock();

async function init() {
  try {
    const [gltf, animData] = await Promise.all([
      gltfLoader.loadAsync('/scene.gltf'),
      fetch('/decoded_animations.json').then(r => r.json()),
    ]);

    scene.add(gltf.scene);
    loader.style.display = 'none';
    console.log(`Loaded scene with ${gltf.scene.children.length} objects`);

    animate();
  } catch (e) {
    loader.textContent = 'Error: ' + e.message;
    console.error(e);
  }
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

init();
