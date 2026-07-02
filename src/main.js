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

const RELAY_URL = import.meta.env.VITE_RELAY_URL || 'ws://localhost:3001';
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
    sceneSys.optimizeStaticMeshes(gltf.scene);
    updateLoading('Planet loaded', 40);

    updateLoading('Loading animations...', 50);
    const animData = await sceneSys.loadAnimData('/decoded_animations.json');
    updateLoading('Animations loaded', 70);

    updateLoading('Creating player...', 80);
    let startPos = new THREE.Vector3(0, 2, 0);
    try {
      const saved = localStorage.getItem('planetwood_last_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        startPos.set(parsed.x, parsed.y, parsed.z);
      }
    } catch (e) {
      console.warn('Failed to load last position', e);
    }
    playerAvatar = new PlayerAvatar({ id: 'local', displayName: 'You', position: startPos });

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

    const animNames = ['idle', 'walk', 'run', 'afk1', 'afk2', 'afk3'];
    for (const name of animNames) {
      const entry = animSys.findAvatarAnim(animData, name);
      if (entry && playerAvatar.skeleton) {
        const { clip } = animSys.createSkinAnimation(entry, playerAvatar.skeleton);
        let animName = name;
        if (name === 'afk1') animName = 'wave';
        if (name === 'afk2') animName = 'stretch';
        if (name === 'afk3') animName = 'look';
        playerAvatar.addAnimation(animName, clip);
      }
    }
    playerAvatar.playAnimation('idle');

    sceneSys.scene.add(playerAvatar.group);
    updateLoading('Setting up controls...', 90);

    input = new PlayerInput(sceneSys.camera);
    chatSys = new ChatSystem();
    ui = new UISystem(sceneSys.scene, sceneSys.camera, sceneSys.renderer);

    ui.addNameplate(playerAvatar, 'You', true);

    let emoteTimeout = null;
    function triggerLocalEmote(type) {
      if (!playerAvatar) return;
      playerAvatar.playAnimation(type);
      if (multiplayer?.connected) {
        multiplayer.sendEmote(type);
      }
      if (emoteTimeout) clearTimeout(emoteTimeout);
      emoteTimeout = setTimeout(() => {
        if (playerAvatar.animationState === type) {
          playerAvatar.playAnimation('idle');
        }
      }, 4000);
    }

    ui.onTriggerEmote = triggerLocalEmote;

    ui.onSendChat = (text) => {
      if (!chatSys.canSend()) return;
      chatSys.addMessage({
        senderId: 'local', senderName: 'You', text,
        timestamp: Date.now(), senderPosition: playerAvatar.group.position.clone(),
      });
      ui.addChatMessage('You', text, 'local');
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
    const npcs = await npcSys.loadFromScene(gltf.scene);
    for (const npc of npcs) {
      ui.addNameplate(npc, npc.displayName);
    }

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
    const avatar = multiplayer.players.get(msg.senderId);
    if (!avatar) return;
    if (chatSys.isInRange(playerAvatar.group.position, avatar.group.position)) {
      chatSys.addMessage(msg);
      ui.addChatMessage(msg.senderName, msg.text, msg.senderId);
      ui.showChatBubble(avatar, msg.text);
    }
  };
  multiplayer.onPlayerJoined = (data) => {
    const avatar = multiplayer.players.get(data.id);
    if (avatar && ui) ui.addNameplate(avatar, data.displayName);
  };
  multiplayer.onPlayerLeft = (id) => {
    if (ui) ui.removeNameplate({ id });
  };
  multiplayer.onEmote = (peerId, type) => {
    const avatar = multiplayer.players.get(peerId);
    if (!avatar) return;
    if (chatSys.isInRange(playerAvatar.group.position, avatar.group.position)) {
      avatar.playAnimation(type);
      if (avatar.emoteTimeout) clearTimeout(avatar.emoteTimeout);
      avatar.emoteTimeout = setTimeout(() => {
        if (avatar.animationState === type) {
          avatar.playAnimation('idle');
        }
      }, 4000);
    }
  };
  multiplayer.onAwayStateChanged = (isAway) => {
    if (isAway) {
      ui.addNameplate(playerAvatar, 'You', true);
      ui.addNameplate(playerAvatar, 'You [Away]', true);
    } else {
      ui.addNameplate(playerAvatar, 'You', true);
    }
  };
  multiplayer.onPlayerAwayChanged = (peerId, isAway) => {
    const avatar = multiplayer.players.get(peerId);
    if (avatar) {
      const baseName = avatar.displayName;
      ui.addNameplate(avatar, isAway ? `${baseName} [Away]` : baseName);
    }
  };

  fallbackTimer = setTimeout(() => {
    if (multiplayer && !multiplayer.connected && ui) {
      multiplayer.disconnect();
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

        try {
          localStorage.setItem('planetwood_last_pos', JSON.stringify({
            x: playerAvatar.group.position.x,
            y: playerAvatar.group.position.y,
            z: playerAvatar.group.position.z
          }));
        } catch (e) {}
      } else {
        if (playerAvatar.animationState !== 'wave' &&
            playerAvatar.animationState !== 'stretch' &&
            playerAvatar.animationState !== 'look') {
          playerAvatar.playAnimation('idle');
        }
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
  if (ui) ui.cullNameplates(sceneSys.camera);
  sceneSys.updateFps(delta);
  sceneSys.render();
}

init();
