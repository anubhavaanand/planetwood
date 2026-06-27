import * as THREE from 'three';
import { SceneSystem } from './systems/SceneSystem.js';
import { AnimationSystem } from './systems/AnimationSystem.js';
import { MeshLoader } from './systems/MeshLoader.js';
import { PlayerInput } from './systems/PlayerInput.js';
import { NPCSystem } from './systems/NPCSystem.js';
import { MultiplayerSystem } from './systems/MultiplayerSystem.js';
import { ChatSystem } from './systems/ChatSystem.js';
import { UISystem } from './systems/UISystem.js';
import { PlayerAvatar } from './entities/PlayerAvatar.js';

const RELAY_URL = 'ws://localhost:3001';
const FALLBACK_TIMEOUT = 5000;

const loadingEl = document.getElementById('loading');
const loadingProgress = document.getElementById('loading-progress');
const loadingText = document.getElementById('loading-text');

const sceneSys = new SceneSystem(document.body);
const animSys = new AnimationSystem();
const meshLoader = new MeshLoader();
let playerAvatar = null;
let npcSys = null;
let input = null;
let multiplayer = null;
let chatSys = null;
let ui = null;
let fallbackTimer = null;

async function init() {
  try {
    updateLoading('Loading planet...', 10);
    const gltf = await sceneSys.loadScene('/scene.gltf');
    updateLoading('Planet loaded', 40);

    updateLoading('Loading animations...', 50);
    const animData = await sceneSys.loadAnimData('/decoded_animations.json');
    updateLoading('Animations loaded', 70);

    updateLoading('Creating player...', 80);
    playerAvatar = new PlayerAvatar({ id: 'local', displayName: 'You', position: new THREE.Vector3(0, 2, 0) });

    const avatarBones = animSys.findAvatarBones(animData);
    if (avatarBones) {
      const { bones, skeleton } = animSys.createSkin(avatarBones);
      const avatarMat = new THREE.MeshStandardMaterial({ color: 0x4488cc, skinning: true, roughness: 0.6, metalness: 0.1 });
      try {
        const avatarMesh = await meshLoader.createSkinnedMesh('/assets/avatar/avatar-idle.drc', skeleton, avatarMat);
        playerAvatar.setSkinnedMesh(avatarMesh, skeleton);
      } catch {
        const geo = new THREE.BoxGeometry(0.8, 1.8, 0.8);
        const mesh = new THREE.SkinnedMesh(geo, avatarMat, skeleton);
        mesh.bind(skeleton);
        playerAvatar.setSkinnedMesh(mesh, skeleton);
      }
    }

    const avatarIdle = animSys.findAvatarAnim(animData, 'idle');
    if (avatarIdle && playerAvatar.skeleton) {
      const { clip, mixer } = animSys.createSkinAnimation(avatarIdle, playerAvatar.skeleton);
      playerAvatar.addAnimation('idle', clip, mixer);
      playerAvatar.playAnimation('idle');
    }

    const avatarWalk = animSys.findAvatarAnim(animData, 'walk');
    if (avatarWalk && playerAvatar.skeleton) {
      const { clip, mixer } = animSys.createSkinAnimation(avatarWalk, playerAvatar.skeleton);
      playerAvatar.addAnimation('walk', clip, mixer);
    }

    sceneSys.scene.add(playerAvatar.group);
    updateLoading('Setting up controls...', 90);

    input = new PlayerInput(sceneSys.camera);
    chatSys = new ChatSystem();
    ui = new UISystem(sceneSys.scene, sceneSys.camera, sceneSys.renderer);

    ui.onSendChat = (text) => {
      chatSys.addMessage({
        senderId: 'local', senderName: 'You', text,
        timestamp: Date.now(), senderPosition: playerAvatar.group.position.clone(),
      });
      ui.addChatMessage('You', text);
      if (multiplayer?.connected) {
        multiplayer.sendChat(text);
      }
    };

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !ui.isInputOpen && loadingEl.style.display === 'none') {
        e.preventDefault();
        ui.showInput();
      }
    });

    updateLoading('Placing NPCs...', 95);
    npcSys = new NPCSystem(sceneSys.scene, animSys, animData, meshLoader);
    await npcSys.loadFromScene(gltf.scene);

    updateLoading('Connecting...', 98);
    _setupMultiplayer(animData);

    updateLoading('Ready!', 100);
    setTimeout(() => { loadingEl.style.display = 'none'; }, 400);
    animate();
  } catch (e) {
    loadingText.textContent = 'Error: ' + e.message;
    loadingProgress.style.width = '0%';
    console.error(e);
  }
}

function _setupMultiplayer(animData) {
  multiplayer = new MultiplayerSystem(RELAY_URL, sceneSys.scene, animSys, animData, meshLoader);
  multiplayer.onNotification = (msg) => ui?.addNotification(msg);
  multiplayer.onChatMessage = (msg) => {
    chatSys.addMessage(msg);
    ui.addChatMessage(msg.senderName, msg.text);
    const avatar = multiplayer.players.get(msg.senderId);
    if (avatar) ui.showChatBubble(avatar, msg.text);
  };

  fallbackTimer = setTimeout(() => {
    if (!multiplayer.connected && ui) {
      multiplayer = null;
      ui.addNotification('Multiplayer unavailable — exploring alone');
    }
  }, FALLBACK_TIMEOUT);

  multiplayer.connect();
}

function updateLoading(text, percent) {
  if (loadingText) loadingText.textContent = text;
  if (loadingProgress) loadingProgress.style.width = percent + '%';
}

function animate() {
  requestAnimationFrame(animate);
  const delta = sceneSys.clock.getDelta();

  if (input) {
    const result = input.update(delta);
    if (playerAvatar) {
      playerAvatar.group.position.add(result.movement);
      if (result.movement.lengthSq() > 0.001) {
        const dir = result.movement.clone().normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
        playerAvatar.group.quaternion.slerp(quat, 0.1);
        playerAvatar.playAnimation('walk');
      } else {
        playerAvatar.playAnimation('idle');
      }
    }
  }

  if (multiplayer && playerAvatar) {
    multiplayer.setLocalState(
      playerAvatar.group.position,
      playerAvatar.group.quaternion,
      playerAvatar.animationState
    );
    multiplayer.update(delta);
  }

  if (npcSys) npcSys.update(delta);
  if (playerAvatar) playerAvatar.update(delta);

  sceneSys.controls.target.lerp(playerAvatar?.group.position || new THREE.Vector3(0, 5, 0), 0.1);
  sceneSys.update();
  sceneSys.render();
}

init();
