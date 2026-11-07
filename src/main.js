import * as THREE from 'three';
import { SceneSystem } from './systems/SceneSystem.js';
import { AnimationSystem } from './systems/AnimationSystem.js';
import { MeshLoader } from './systems/MeshLoader.js';
import { PlayerInput } from './systems/PlayerInput.js';
import { StreetSystem } from './systems/StreetSystem.js';
import { PlanetSystem } from './systems/PlanetSystem.js';
import { NPCSystem } from './systems/NPCSystem.js';
import { MultiplayerSystem } from './systems/MultiplayerSystem.js';
import { debugWarn, debugError, debugLog } from './utils/debug.js';
import { ChatSystem } from './systems/ChatSystem.js';
import { UISystem } from './systems/UISystem.js';
import { QuestSystem } from './systems/QuestSystem.js';
import { QuestUI } from './systems/QuestUI.js';
import { DialogueSystem } from './systems/DialogueSystem.js';
import { PlayerAvatar } from './entities/PlayerAvatar.js';
import { ProgressionSystem } from './systems/ProgressionSystem.js';
import { QUESTS } from './data/quests.js';

const RELAY_URL = import.meta.env.VITE_RELAY_URL || 'ws://localhost:3005';
const FALLBACK_TIMEOUT = 5000;
const LOAD_TIMEOUT = 5000;

const loadingEl = document.getElementById('loading');
const loadingProgress = document.getElementById('loading-progress');
const loadingText = document.getElementById('loading-text');

const sceneSys = new SceneSystem(document.body);
const animSys = new AnimationSystem();
const meshLoader = new MeshLoader();
const streetSys = new StreetSystem(sceneSys.scene);
const planetSys = new PlanetSystem(sceneSys.scene);

let playerAvatar = null;
let npcSys = null;
let input = null;
let multiplayer = null;
let chatSys = null;
let ui = null;
let questUI = null;
let dialogueSys = null;
let questSys = null;
let fallbackTimer = null;
let progressionSys = null;

// Game flow state: 'loading' | 'title' | 'intro' | 'playing'
let gameState = 'loading';

// Whether the player is currently on the planet scene (z > 160) vs the street.
let inPlanetScene = false;

// Intro dialogue lines (matching the official game's opening).
const INTRO_LINES = [
  "LOOKS LIKE I SLEPT IN... I BETTER START TODAY'S DELIVERIES.",
  "I'VE GOT FIVE ON THE LIST. HOPEFULLY THEY'RE EASY TO FIND.",
  "First stop: the office worker near the fountain. She's waiting for a letter.",
  "Press E to talk. The checklist in the corner tracks every delivery.",
  "Five deliveries... and one of them isn't even mine.",
];
let introLineIndex = 0;

// Quest NPC positions along the street (x = lane side, z = distance down road).
// All z values must be within road bounds (-130 to +130).
const NPC_STREET_POS = {
  'office-worker': { x: -10, z: -70 },
  'boss': { x: -10, z: -30 },
  'caveman': { x: 10, z: 10 },
  'young-lady': { x: 10, z: 50 },
  'factory-worker-a': { x: -10, z: 110 },
  'male-scientist': { x: 10, z: 130 },
  'female-scientist': { x: -10, z: 120 },
  'oldwoman': { x: 10, z: 100 },
  'mountainman': { x: -10, z: 80 },
  'diver': { x: -10, z: -120 },
  'musician': { x: 10, z: -100 },
};

async function init() {
  const loadTimeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Loading timed out after 5 seconds')), LOAD_TIMEOUT)
  );
  try {
    await Promise.race([initCore(), loadTimeout]);
  } catch (e) {
    if (e.message.includes('timed out')) {
      updateLoading('Street loaded (slow connection)', 40);
      debugWarn('Load timeout exceeded, continuing with available data');
    } else {
      loadingText.textContent = 'Error: ' + e.message;
      loadingProgress.style.width = '0%';
      debugError(e);
    }
  }
}

async function initCore() {
  updateLoading('Loading street...', 10);
  const animData = await sceneSys.loadAnimData('./decoded_animations.json');
  updateLoading('Animations loaded', 40);

  // Load scene.gltf only to extract the NPC roster (their mesh/skeleton data).
  // The planet itself is NOT added to the scene — we render the street instead.
  updateLoading('Loading NPCs...', 55);
  const gltf = await sceneSys.gltfLoader.loadAsync('./scene.gltf');

  updateLoading('Creating messenger...', 60);
  const startPos = new THREE.Vector3(0, 0, -90);
  playerAvatar = new PlayerAvatar({ id: 'local', displayName: 'You', position: startPos });

  const avatarBones = animSys.findAvatarBones(animData);
  if (avatarBones) {
    const { bones, skeleton } = animSys.createSkin(avatarBones, 'avatar');
    const avatarMat = new THREE.MeshStandardMaterial({ color: 0x4488cc, skinning: true, roughness: 0.6, metalness: 0.1 });
    try {
      const avatarMesh = await meshLoader.createSkinnedMesh('./assets/avatar/accessories/base.glb', skeleton, avatarMat);
      playerAvatar.setSkinnedMesh(avatarMesh, skeleton);
    } catch {
      const avatarMesh = await meshLoader.createSkinnedMesh('./assets/avatar/avatar-idle.drc', skeleton, avatarMat);
      playerAvatar.setSkinnedMesh(avatarMesh, skeleton);
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
  }

  sceneSys.scene.add(playerAvatar.group);

  // Camera: fixed perspective following behind the messenger (2.5D street view).
  sceneSys.camera.position.set(0, 5, -8);
  sceneSys.camera.lookAt(0, 1.2, 2);
  sceneSys.controls.enabled = false; // disable orbit controls for street view

  input = new PlayerInput(sceneSys.camera);
  chatSys = new ChatSystem();
  ui = new UISystem(sceneSys.scene, sceneSys.camera, sceneSys.renderer);
  questUI = new QuestUI(sceneSys.scene, sceneSys.camera, sceneSys.renderer);
  dialogueSys = new DialogueSystem(sceneSys.scene, sceneSys.camera, sceneSys.renderer);
  progressionSys = new ProgressionSystem();
  questSys = new QuestSystem(questUI, progressionSys);

  // Multiplayer system — connects to the WebSocket relay for cross-player presence.
  multiplayer = new MultiplayerSystem(RELAY_URL, sceneSys.scene, animSys, animData, meshLoader);

  // Apply restored last-known position/rotation to the local avatar on rejoin.
  multiplayer.onRestoredPosition = ({ p, r }) => {
    if (!playerAvatar) return;
    if (p && Array.isArray(p) && p.length === 3) {
      playerAvatar.group.position.set(p[0], p[1], p[2]);
    }
    if (r && Array.isArray(r) && r.length === 4) {
      playerAvatar.group.quaternion.set(r[0], r[1], r[2], r[3]);
    }
  };

  multiplayer.connect();

  multiplayer.onPlayerJoined = (data) => {
    const avatar = multiplayer.players.get(data.id);
    if (avatar) {
      ui.addNameplate(avatar, data.displayName);
    }
  };

  multiplayer.onPlayerLeft = (id) => {
    const avatar = multiplayer.players.get(id);
    if (avatar) {
      ui.removeNameplate(avatar);
    }
  };

  multiplayer.onChatMessage = (data) => {
    if (data.senderId === multiplayer.localID) return;
    ui.addChatMessage(data.senderName || 'Player', data.text, data.senderId);
  };

  multiplayer.onEmote = (id, type) => {
    const avatar = multiplayer.players.get(id);
    if (avatar) {
      avatar.playAnimation(type === 'wave' ? 'wave' : type === 'stretch' ? 'stretch' : 'look');
      setTimeout(() => {
        if (avatar.animationState === type) {
          avatar.playAnimation('idle');
        }
      }, 4000);
    }
  };

  multiplayer.onNotification = (text) => {
    ui.addNotification(text);
  };

  dialogueSys.onStepComplete = (questId, stepId) => {
    if (questSys) questSys.completeStep(questId, stepId);
  };

  progressionSys.onLevelUp = (oldLevel, newLevel) => {
    ui.addNotification(`Level Up! You are now level ${newLevel}`);
  };

  progressionSys.onCoinsChange = (coins) => {
    // Could update a coin counter UI here
    debugLog(`Coins: ${coins}`);
  };

  progressionSys.onReputationChange = (npcType, rep, tier) => {
    ui.addNotification(`${npcType} reputation: ${tier.name} (${rep})`);
  };

  // Handle player choice branches in dialogue
  dialogueSys.onStepChoice = (questId, nextStepId) => {
    if (questSys) {
      const stepData = questSys.selectNextStep(questId, nextStepId);
      if (stepData) {
        // Re-open dialogue with the chosen step
        const npc = npcSys?.npcs.find(n => n.id === dialogueSys.currentNpc?.id);
        if (npc) {
          dialogueSys.open(npc);
        }
      }
    }
  };

  questUI.onItemReceived = (extraData) => {
    ui.addNotification(`Received: ${extraData.uiTitle || 'Item'}`);
    if (extraData.uiText) ui.addNotification(extraData.uiText);
  };
  questUI.onQuestCompleted = (questId) => {
    ui.addNotification('Quest completed!');
  };

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
      if (e.key === 'Enter' && !ui.isInputOpen && !dialogueSys.active && gameState === 'playing') {
        e.preventDefault();
        ui.showInput();
      }
      const isInteractKey = e.code === 'KeyE' || e.key === 'e' || e.key === 'E';
      if (isInteractKey && gameState === 'playing') {
        e.preventDefault();
        if (dialogueSys.active) {
          dialogueSys.advance();
          return;
        }
        _tryInteract();
      }
    });

  updateLoading('Placing NPCs...', 90);
  npcSys = new NPCSystem(sceneSys.scene, animSys, animData, meshLoader);
  const npcs = await npcSys.loadFromScene(gltf.scene);
  // Reposition NPCs along the street for the 2.5D messenger world.
  for (const npc of npcs) {
    const streetPos = NPC_STREET_POS[npc.npcType];
    if (streetPos) {
      npc.group.position.set(streetPos.x, 0, streetPos.z);
      npc.group.lookAt(streetPos.x, 0, streetPos.z + 1);
    }
    ui.addNameplate(npc, npc.displayName);
    if (questSys) questSys.registerNpc(npc);
  }

  updateLoading('Ready!', 100);
  setTimeout(() => { loadingEl.style.display = 'none'; showTitle(); }, 400);

  // Start with the street visible and the planet hidden; the transition
  // activates when the player crosses z > 160.
  streetSys.show();
  planetSys.hide();

  animate();
}

// scene.gltf is loaded only for its NPC mesh/skeleton data; the planet itself
// is not added to the scene — we render the street instead.

function showTitle() {
  gameState = 'title';
  const title = document.createElement('div');
  title.id = 'title-screen';
  Object.assign(title.style, {
    position: 'fixed', inset: '0', zIndex: '400',
    background: '#87ceeb', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Courier New', Courier, monospace",
  });

  const pill = document.createElement('div');
  pill.textContent = 'messenger';
  Object.assign(pill.style, {
    width: '260px', height: '48px',
    background: '#4a90d9', color: '#fff',
    borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '20px', fontWeight: '700', letterSpacing: '0.05em',
    marginBottom: '60px',
    boxShadow: '0 4px 0 rgba(0,0,0,0.25)',
  });

  const begin = document.createElement('button');
  begin.textContent = 'BEGIN';
  Object.assign(begin.style, {
    width: '120px', height: '44px',
    background: '#fcd436', border: '3px solid #333', borderRadius: '6px',
    fontSize: '18px', fontWeight: '700', color: '#1a1a1a',
    cursor: 'pointer', boxShadow: '0 4px 0 rgba(0,0,0,0.25)',
  });
  begin.addEventListener('click', () => {
    title.remove();
    gameState = 'intro';
    showIntro();
  });

  title.appendChild(pill);
  title.appendChild(begin);
  document.body.appendChild(title);
}

function showIntro() {
  const box = document.createElement('div');
  box.id = 'intro-box';
  Object.assign(box.style, {
    position: 'fixed', bottom: '60px', left: '50%', transform: 'translateX(-50%)',
    width: '560px', height: '130px',
    background: '#fff', border: '3px solid #333', borderRadius: '6px',
    padding: '20px', boxSizing: 'border-box', zIndex: '410',
    fontFamily: "'Courier New', Courier, monospace",
    display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px',
  });

  const nameEl = document.createElement('div');
  nameEl.textContent = 'messenger';
  Object.assign(nameEl.style, {
    fontSize: '13px', fontWeight: '700', color: '#333',
  });

  const textEl = document.createElement('div');
  textEl.id = 'intro-text';
  Object.assign(textEl.style, {
    fontSize: '17px', lineHeight: '1.5', color: '#1a1a1a', whiteSpace: 'pre-wrap',
  });
  textEl.textContent = INTRO_LINES[introLineIndex];

  const hint = document.createElement('div');
  hint.textContent = 'click / press E to continue';
  Object.assign(hint.style, {
    fontSize: '12px', color: '#666', marginTop: '6px', textAlign: 'right',
  });

  box.appendChild(nameEl);
  box.appendChild(textEl);
  box.appendChild(hint);
  document.body.appendChild(box);

  const advance = () => {
    introLineIndex++;
    if (introLineIndex < INTRO_LINES.length) {
      textEl.textContent = INTRO_LINES[introLineIndex];
    } else {
      box.remove();
      gameState = 'playing';
    }
  };

  const handler = (e) => {
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    advance();
  };
  // Defer so the BEGIN click that opened this screen doesn't immediately
  // advance the first line.
  setTimeout(() => {
    window.addEventListener('click', handler);
    window.addEventListener('keydown', handler);
  }, 0);
}

function _tryInteract() {
  if (!playerAvatar || !npcSys || dialogueSys.active) return;
  const playerPos = playerAvatar.group.position;
  let nearest = null;
  let nearestDist = 7; // Must walk up to NPC to interact
  for (const npc of npcSys.npcs) {
    const d = npc.group.position.distanceTo(playerPos);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = npc;
    }
  }
  if (!nearest) return;
  const step = questSys.interact(nearest);
  if (step) {
    dialogueSys.open(nearest);
  } else {
    ui.addNotification("There's nothing to say right now.");
  }
}

function updateLoading(text, percent) {
  if (loadingText) loadingText.textContent = text;
  if (loadingProgress) loadingProgress.style.width = percent + '%';
}

function srAnnounce(text) {
  const el = document.getElementById('sr-announce');
  if (el) {
    el.textContent = '';
    requestAnimationFrame(() => { el.textContent = text; });
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = sceneSys.clock.getDelta();

  const playing = gameState === 'playing';
  const dialogueActive = dialogueSys && dialogueSys.active;

  if (input && playing && !dialogueActive) {
    const result = input.update(delta);
    if (playerAvatar) {
      playerAvatar.group.position.add(result.movement);
      if (result.movement.lengthSq() > 0.0001) {
        const dir = result.movement.clone().normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
        playerAvatar.group.quaternion.slerp(quat, 0.1);
        playerAvatar.playAnimation('walk');
      } else {
        if (playerAvatar.animationState !== 'wave' &&
            playerAvatar.animationState !== 'stretch' &&
            playerAvatar.animationState !== 'look') {
          playerAvatar.playAnimation('idle');
        }
      }
    }
  }

  // Camera mode: 2.5D follow on the street, orbit controls on the planet.
  if (playing && playerAvatar) {
    const playerZ = playerAvatar.group.position.z;

    // Transition to planet scene when crossing z > 160.
    if (!inPlanetScene && playerZ > 160) {
      inPlanetScene = true;
      streetSys.hide();
      planetSys.show();
      // Switch to orbit controls for the planet view.
      sceneSys.controls.enabled = true;
      sceneSys.controls.target.set(playerAvatar.group.position.x, playerAvatar.group.position.y, playerZ);
      sceneSys.controls.minDistance = 3;
      sceneSys.controls.maxDistance = 40;
      sceneSys.controls.maxPolarAngle = Math.PI / 2;
    } else if (inPlanetScene && playerZ <= 160) {
      inPlanetScene = false;
      planetSys.hide();
      streetSys.show();
      // Switch back to fixed 2.5D follow camera.
      sceneSys.controls.enabled = false;
    }

    if (inPlanetScene) {
      // Orbit camera around the player on the planet surface.
      sceneSys.controls.target.set(playerAvatar.group.position.x, playerAvatar.group.position.y, playerZ);
      sceneSys.controls.update();
    } else {
      streetSys.updateCamera(sceneSys.camera, playerAvatar.group.position);
    }
  }

  if (multiplayer && playerAvatar && playing) {
    multiplayer.setLocalState(
      playerAvatar.group.position,
      playerAvatar.group.quaternion,
      playerAvatar.animationState
    );
    multiplayer.update(delta);
  }

  if (npcSys && playing) npcSys.update(delta);
  if (playerAvatar && playing) playerAvatar.update(delta);

  sceneSys.update();
  if (ui && playing) ui.cullNameplates(sceneSys.camera);
  sceneSys.updateFps();
  sceneSys.render();
}

init();
