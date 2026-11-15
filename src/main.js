import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
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
import { DeliveryItemSystem } from './systems/DeliveryItemSystem.js';
import { DialogueSystem } from './systems/DialogueSystem.js';
import { PlayerAvatar } from './entities/PlayerAvatar.js';
import { NPC } from './entities/NPC.js';
import { AvatarCustomizationSystem } from './systems/AvatarCustomizationSystem.js';
import { ProgressionSystem } from './systems/ProgressionSystem.js';
import { QUESTS } from './data/quests.js';

const RELAY_URL = import.meta.env.VITE_RELAY_URL || 'wss://localhost:3005';
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
let planetSysReady = false;

let playerAvatar = null;
let avatarCustomization = null;
let npcSys = null;
let input = null;
let multiplayer = null;
let chatSys = null;
let ui = null;
let questUI = null;
let deliveryItemSys = null;
let dialogueSys = null;
let questSys = null;
let fallbackTimer = null;
let progressionSys = null;

// State for the active trade flow (who we're trading with and what we selected).
let tradeState = null; // { peerId, peerName, role: 'initiator' | 'receiver', localItems, remoteItems }

// Game flow state: 'loading' | 'title' | 'intro' | 'tutorial' | 'playing'
let gameState = 'loading';

// Tutorial state — persisted so returning players skip or shorten it.
const TUTORIAL_STORAGE_KEY = 'planetwood.tutorialComplete';
let tutorialNpc = null; // the highlighted first NPC for the guaranteed interaction
let tutorialMarker = null; // visual indicator (CSS2DObject) above the tutorial NPC

// Tutorial dialogue — teaches movement, interaction, and delivery rewards.
const TUTORIAL_TEXTS = [
  "Welcome to Planetwood! I'm your first stop on the street.",
  "Move around with W A S D to find people who need deliveries.",
  "When you're close to someone, press E to talk to them.",
  "Deliveries earn you coins, XP, and reputation — check the checklist corner.",
  "That's all you need to know. Good luck, messenger!",
];
let tutorialTextIndex = 0;

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
  // Missing NPC types added (Issue #48)
  'alien': { x: -10, z: -95 },
  'chef': { x: 10, z: -75 },
  'fox': { x: -10, z: -50 },
  'owl': { x: 10, z: -25 },
  'scout': { x: 10, z: 30 },
  'threekid': { x: -10, z: 20 },
  'factory-worker-b': { x: -10, z: 130 },
  'factory-worker-c': { x: 10, z: 70 },
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

  updateLoading('Loading planet models...', 45);
  await planetSys.init();
  planetSysReady = true;
  updateLoading('Planet models loaded', 50);

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

    const animNames = ['idle', 'walk', 'run', 'sprint', 'air', 'afk1', 'afk2', 'afk3'];
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

    // Avatar customization system — mix-and-match accessories persisted to localStorage.
    avatarCustomization = new AvatarCustomizationSystem(playerAvatar, meshLoader, animSys, animData);
    avatarCustomization.progressionSys = progressionSys;
    await avatarCustomization.load();

    // When a player tries to equip a locked slot, show a notification naming the
    // NPC tier needed and the slot.
    avatarCustomization.onSlotLockRejected = (slot, req) => {
      ui.addNotification(`Reach ${req.minTier} tier with an NPC to unlock ${slot}`);
      srAnnounce(`Reach ${req.minTier} tier with an NPC to unlock ${slot}`, 'polite');
    };

    const customizationContainer = _setupCustomizationUI();

    sceneSys.scene.add(playerAvatar.group);
  }

  // Camera: fixed perspective following behind the messenger (2.5D street view).
  sceneSys.camera.position.set(0, 5, -8);
  sceneSys.camera.lookAt(0, 1.2, 2);
  sceneSys.controls.enabled = false; // disable orbit controls for street view

  input = new PlayerInput(sceneSys.camera);
  chatSys = new ChatSystem();
  ui = new UISystem(sceneSys.scene, sceneSys.camera, sceneSys.renderer);
  questUI = new QuestUI(sceneSys.scene, sceneSys.camera, sceneSys.renderer);
  deliveryItemSys = new DeliveryItemSystem(
    sceneSys.scene, sceneSys.camera, sceneSys.renderer,
    playerAvatar, meshLoader
  );
  dialogueSys = new DialogueSystem(sceneSys.scene, sceneSys.camera, sceneSys.renderer);
  progressionSys = new ProgressionSystem();
  progressionSys.load();
  questSys = new QuestSystem(questUI, progressionSys);

  // Wire quest receipt/delivery events to the delivery item system.
  questSys.onItemReceived = (extraData, stepId, questId) => {
    const modelId = extraData?.receiveModel;
    if (modelId && deliveryItemSys) {
      deliveryItemSys.receiveItem(modelId, stepId, questId);
      ui.addNotification(`Received: ${extraData.uiTitle || 'Item'}`);
      srAnnounce(`Received: ${extraData.uiTitle || 'Item'}`, 'polite');
      if (extraData.uiText) ui.addNotification(extraData.uiText);
    }
  };
  questSys.onItemDelivered = (modelId, stepId, questId) => {
    if (modelId && deliveryItemSys) {
      deliveryItemSys.deliverItem(modelId);
      ui.addNotification('Delivered.');
    }
  };

  // Bind shop UI to progression + avatar customization systems.
  ui.bindShop(progressionSys, avatarCustomization);

  // Multiplayer system — connects to the WebSocket relay for cross-player presence.
  multiplayer = new MultiplayerSystem(RELAY_URL, sceneSys.scene, animSys, animData, meshLoader);

  deliveryItemSys.setMultiplayer(multiplayer);

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
    srAnnounce(`${data.displayName || 'Player'} joined`, 'polite');
  };

  multiplayer.onPlayerLeft = (id) => {
    const avatar = multiplayer.players.get(id);
    if (avatar) {
      ui.removeNameplate(avatar);
    }
    const name = avatar ? avatar.displayName : 'Player';
    srAnnounce(`${name} left`, 'polite');
  };

  multiplayer.onChatMessage = (data) => {
    if (data.senderId === multiplayer.localID) return;
    ui.addChatMessage(data.senderName || 'Player', data.text, data.senderId);
    srAnnounce(`New message from ${data.senderName || 'Player'}: ${data.text}`, 'polite');
  };

  multiplayer.onEmote = (id, type) => {
    const avatar = multiplayer.players.get(id);
    if (avatar) {
      avatar.playAnimation(type === 'wave' ? 'wave' : type === 'stretch' ? 'stretch' : 'look');
      srAnnounce(`${avatar.displayName} performed ${type} emote`, 'polite');
      setTimeout(() => {
        if (avatar.animationState === type) {
          avatar.playAnimation('idle');
        }
      }, 4000);
    }
  };

  multiplayer.onNotification = (text) => {
    ui.addNotification(text);
    const urgent = text.includes('disconnected') || text.includes('disconnect');
    srAnnounce(text, urgent ? 'assertive' : 'polite');
  };

  dialogueSys.onStepComplete = (questId, stepId) => {
    if (questSys) questSys.completeStep(questId, stepId);
  };

  progressionSys.onLevelUp = (oldLevel, newLevel) => {
    ui.addNotification(`Level Up! You are now level ${newLevel}`);
    srAnnounce(`Level up! You are now level ${newLevel}`, 'polite');
  };

  progressionSys.onCoinsChange = (coins) => {
    // Could update a coin counter UI here
    debugLog(`Coins: ${coins}`);
  };

  progressionSys.onReputationChange = (npcType, rep, tier) => {
    ui.addNotification(`${npcType} reputation: ${tier.name} (${rep})`);
    srAnnounce(`${npcType} reputation: ${tier.name} (${rep})`, 'polite');
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

  questSys.onQuestCompleted = (questId) => {
    ui.addNotification('Quest completed!');
    srAnnounce('Quest completed!', 'polite');
  };

  ui.addNameplate(playerAvatar, 'You', true);

  let emoteTimeout = null;
  function triggerLocalEmote(type) {
    if (!playerAvatar) return;
    playerAvatar.playAnimation(type);
    srAnnounce(`You performed ${type} emote`, 'polite');
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

  // ============================ Appearance button (opens customization panel) ============================
  const appearanceBtn = document.createElement('button');
  appearanceBtn.textContent = 'Appearance';
  appearanceBtn.setAttribute('aria-label', 'Open avatar customization panel');
  Object.assign(appearanceBtn.style, {
    position: 'fixed', bottom: '20px', right: '170px',
    width: '140px', zIndex: '310', display: 'none',
    padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(217,147,106,0.3)',
    background: 'rgba(60,72,74,0.9)', color: '#e8dccc', fontSize: '0.9rem',
    cursor: 'pointer', outline: 'none', fontFamily: 'system-ui, sans-serif', fontWeight: '500',
    backdropFilter: 'blur(4px)',
  });
  appearanceBtn.addEventListener('click', () => {
    const isHidden = customizationContainer.style.display === 'none';
    customizationContainer.style.display = isHidden ? '' : 'none';
    appearanceBtn.textContent = isHidden ? 'Close Appearance' : 'Appearance';
  });
  document.body.appendChild(appearanceBtn);

  const _updateAppearanceButtonVisibility = () => {
    appearanceBtn.style.display = gameState === 'playing' ? '' : 'none';
    if (gameState !== 'playing') {
      customizationContainer.style.display = 'none';
      appearanceBtn.textContent = 'Appearance';
    }
  };
  ui._updateAppearanceButtonVisibility = _updateAppearanceButtonVisibility;

  // Shop button — opens/closes the avatar shop panel.
  const shopBtn = document.createElement('button');
  shopBtn.textContent = 'Shop';
  shopBtn.setAttribute('aria-label', 'Open avatar shop');
  Object.assign(shopBtn.style, {
    position: 'fixed', bottom: '20px', right: '20px',
    width: '140px', zIndex: '310', display: 'none',
    padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(217,147,106,0.3)',
    background: 'rgba(60,72,74,0.9)', color: '#e8dccc', fontSize: '0.9rem',
    cursor: 'pointer', outline: 'none', fontFamily: 'system-ui, sans-serif', fontWeight: '500',
    backdropFilter: 'blur(4px)',
  });
  shopBtn.addEventListener('click', () => {
    ui.toggleShop();
    shopBtn.textContent = ui.shopVisible ? 'Close Shop' : 'Shop';
  });
  document.body.appendChild(shopBtn);

  // Show the shop button once the game reaches playing state; expose toggle so
  // the shop panel can update the button text when opened/closed programmatically.
  const _updateShopButtonVisibility = () => {
    shopBtn.style.display = gameState === 'playing' ? '' : 'none';
    if (gameState !== 'playing') ui.hideShop();
  };
  ui._updateShopButtonVisibility = _updateShopButtonVisibility;

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

  ui.onTradeConfirm = (peerId, offerItemIds, requestItemIds) => {
    if (!tradeState) return;
    if (tradeState.role === 'initiator') {
      multiplayer.sendTrade(tradeState.peerId, 'offer', { offer: offerItemIds, request: requestItemIds });
      ui.addNotification('Trade offer sent.');
    } else {
      _executeTrade(tradeState.peerId, Array.from(offerItemIds), Array.from(requestItemIds));
      multiplayer.sendTrade(tradeState.peerId, 'accept', { offer: offerItemIds, request: requestItemIds });
      ui.addNotification('Trade accepted.');
    }
    ui.hideTrade();
    tradeState = null;
  };

  ui.onTradeCancel = () => {
    if (tradeState && tradeState.role === 'receiver') {
      multiplayer.sendTrade(tradeState.peerId, 'reject', {});
    }
    ui.hideTrade();
    tradeState = null;
  };

  multiplayer.onTradeMessage = (fromPeerId, tradeType, payload) => {
    const avatar = multiplayer.players.get(fromPeerId);
    const peerName = avatar ? avatar.displayName : 'Player';
    if (tradeType === 'offer') {
      ui.addNotification(`${peerName} wants to trade with you.`);
      const localItemIds = deliveryItemSys ? deliveryItemSys.carriedKeys() : [];
      const remoteOfferItems = payload.offer || [];
      ui.showTrade(fromPeerId, peerName, localItemIds, remoteOfferItems);
      tradeState = { peerId: fromPeerId, peerName, role: 'receiver', localItems: localItemIds, remoteItems: remoteOfferItems };
    } else if (tradeType === 'accept') {
      ui.addNotification(`${peerName} accepted the trade.`);
      _executeTrade(fromPeerId, payload.offer || [], payload.request || []);
      ui.hideTrade();
      tradeState = null;
    } else if (tradeType === 'reject') {
      ui.addNotification(`${peerName} rejected the trade.`);
      ui.hideTrade();
      tradeState = null;
    }
  };

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !ui.isInputOpen && !dialogueSys.active && gameState === 'playing') {
        e.preventDefault();
        ui.showInput();
      }
      const isInteractKey = e.code === 'KeyE' || e.key === 'e' || e.key === 'E';
      if (isInteractKey && (gameState === 'playing' || gameState === 'tutorial')) {
        e.preventDefault();
        if (dialogueSys.active) {
          if (gameState === 'tutorial') {
            // Advance tutorial text manually (tutorial dialogue bypasses QuestSystem steps).
            tutorialTextIndex++;
            if (tutorialTextIndex < TUTORIAL_TEXTS.length) {
              renderTutorialText();
            } else {
              dialogueSys.close();
              completeTutorial();
            }
            return;
          }
          dialogueSys.advance();
          return;
        }
        if (gameState === 'playing') {
          _tryInteract();
        }
        if (gameState === 'tutorial') {
          _tryInteractTutorial();
        }
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
    ui.addInteractPrompt(npc);
    if (questSys) questSys.registerNpc(npc);
  }

  // Planet-surface NPC — gives the z > 160 transition a narrative purpose.
  // Added to planetSys.group so it shows/hides with the planet scene;
  // added to npcSys.npcs so interact prompts and _tryInteract find it.
  const planetGuardian = await _createPlanetGuardianNPC(animSys, animData, meshLoader);
  if (planetGuardian) {
    planetSys.group.add(planetGuardian.group);
    npcSys.npcs.push(planetGuardian);
    ui.addNameplate(planetGuardian, planetGuardian.displayName);
    ui.addInteractPrompt(planetGuardian);
    if (questSys) questSys.registerNpc(planetGuardian);
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
  const tutorialAlreadyDone =
    typeof localStorage !== 'undefined' &&
    localStorage.getItem(TUTORIAL_STORAGE_KEY) === '1';

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

  const finishIntro = () => {
    box.remove();
    if (tutorialAlreadyDone) {
      gameState = 'playing';
      _updateAppearanceButtonVisibility();
    } else {
      gameState = 'tutorial';
      _updateAppearanceButtonVisibility();
      startTutorial();
    }
  };

  const advance = () => {
    introLineIndex++;
    if (introLineIndex < INTRO_LINES.length) {
      textEl.textContent = INTRO_LINES[introLineIndex];
    } else {
      finishIntro();
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

/**
 * Begins the guaranteed first-NPC tutorial. Finds the nearest NPC, highlights it
 * with a visual marker, forces its interact prompt to be visible, and starts the
 * tutorial dialogue. Movement is allowed during the tutorial so the player can
 * walk up to the highlighted NPC.
 */
function startTutorial() {
  if (!npcSys || npcSys.npcs.length === 0) {
    // No NPCs loaded yet — fall straight to playing.
    gameState = 'playing';
    return;
  }

  const playerPos = playerAvatar ? playerAvatar.group.position : new THREE.Vector3(0, 0, -90);
  let nearest = null;
  let nearestDist = Infinity;
  for (const npc of npcSys.npcs) {
    const d = npc.group.position.distanceTo(playerPos);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = npc;
    }
  }
  tutorialNpc = nearest;
  if (!tutorialNpc) {
    gameState = 'playing';
    return;
  }

  // Visual marker above the tutorial NPC so the player knows who to approach.
  tutorialMarker = document.createElement('div');
  tutorialMarker.textContent = 'TALK TO ME →';
  Object.assign(tutorialMarker.style, {
    color: '#fcd436',
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '14px',
    fontWeight: '700',
    padding: '4px 8px',
    borderRadius: '4px',
    background: 'rgba(30, 40, 42, 0.95)',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    pointerEvents: 'none',
    border: '2px solid #fcd436',
    backdropFilter: 'blur(4px)',
  });
  const markerLabel = new CSS2DObject(tutorialMarker);
  markerLabel.position.set(0, 3.6, 0);
  tutorialNpc.group.add(markerLabel);

  // Guarantee the floating E prompt is visible for this NPC.
  ui.setInteractPromptVisible(tutorialNpc, true);

  // Open tutorial dialogue immediately (player walks up, then presses E).
  openTutorialDialogue();
}

/**
 * Opens the in-game dialogue box with the tutorial text sequence.
 */
function openTutorialDialogue() {
  tutorialTextIndex = 0;
  dialogueSys.container.style.display = '';
  dialogueSys.container.style.pointerEvents = 'auto';
  dialogueSys.active = true;
  dialogueSys.currentNpc = tutorialNpc;
  dialogueSys.currentStep = null;
  dialogueSys.textIndex = 0;
  dialogueSys.showingChoices = false;
  dialogueSys._renderTutorialText = dialogueSys._renderTutorialText || renderTutorialText;
  renderTutorialText();
}

/**
 * Renders the current tutorial line into the dialogue box.
 */
function renderTutorialText() {
  const tutorialFaceColors = {
    'office-worker': '#66BDE6',
    boss: '#c25959',
    caveman: '#f3c258',
    'young-lady': '#8cc48c',
    default: '#9ab0b4',
  };
  dialogueSys.nameEl.textContent = tutorialNpc ? tutorialNpc.displayName : 'Guide';
  dialogueSys.avatarFace.style.background =
    tutorialFaceColors[tutorialNpc ? tutorialNpc.npcType : 'default'] ||
    tutorialFaceColors.default;
  dialogueSys.textEl.textContent = TUTORIAL_TEXTS[tutorialTextIndex];
  dialogueSys.continueBtn.style.display = '';
  dialogueSys._clearChoices();
}

/**
 * Completes the tutorial: removes the marker, persists completion, and enters
 * playing state. Subsequent visits skip the tutorial.
 */
function completeTutorial() {
  if (tutorialMarker && tutorialMarker.parentNode) {
    tutorialMarker.parentNode.removeChild(tutorialMarker);
  }
  tutorialMarker = null;
  tutorialNpc = null;
  dialogueSys.close();

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, '1');
    } catch {
      // localStorage unavailable — tutorial will show every visit.
    }
  }

  gameState = 'playing';
  ui.addNotification('Tutorial complete — happy delivering!');
  srAnnounce('Tutorial complete. Happy delivering!', 'polite');
  _updateAppearanceButtonVisibility();
}

/**
 * Creates the planet-surface guardian NPC. Uses the alien model as the
 * guardian's visual (no dedicated planet-guardian asset exists yet), skinned
 * to the alien skeleton with its idle animation. Placed at z ≈ 220 on the
 * planet surface by the caller.
 */
async function _createPlanetGuardianNPC(animSys, animData, meshLoader) {
  const npc = new NPC({
    id: 'planet-guardian',
    npcType: 'planet-guardian',
    displayName: 'Planet Guardian',
    position: new THREE.Vector3(0, 0, 220),
  });

  const skinEntry = animSys.findSkinEntry(animData, 'alien');
  if (!skinEntry) {
    // Fallback to a visible box so the NPC is never invisible.
    const geo = new THREE.BoxGeometry(1, 2, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x44aaff });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 0, 220);
    npc.setSkinnedMesh(mesh, null);
    return npc;
  }

  const { bones, skeleton } = animSys.createSkin(skinEntry, 'alien');

  if (meshLoader) {
    const meshUrl = './assets/npcs/present/alien/alien.drc';
    try {
      const mesh = await meshLoader.createSkinnedMesh(meshUrl, skeleton);
      npc.setSkinnedMesh(mesh, skeleton);
    } catch (e) {
      const geo = new THREE.BoxGeometry(1, 2, 1);
      const mat = new THREE.MeshStandardMaterial({ color: 0x44aaff });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, 0, 220);
      npc.setSkinnedMesh(mesh, null);
      return npc;
    }
  }

  const animEntry = animSys.findAnimEntry(animData, 'alien', 'idle');
  if (animEntry && npc.skeleton) {
    const { clip } = animSys.createSkinAnimation(animEntry, npc.skeleton, 'planet-guardian-idle');
    npc.addAnimation('idle', clip);
    npc.playAnimation('idle');
  }

  return npc;
}

function _tryInteract() {
  if (!playerAvatar || dialogueSys.active) return;
  const playerPos = playerAvatar.group.position;

  // Check for a remote player within trade range first (7 units).
  if (multiplayer && multiplayer.connected) {
    let nearestPlayer = null;
    let nearestPlayerDist = 7;
    for (const [peerId, avatar] of multiplayer.players) {
      const d = avatar.group.position.distanceTo(playerPos);
      if (d < nearestPlayerDist) {
        nearestPlayerDist = d;
        nearestPlayer = { id: peerId, avatar, dist: d };
      }
    }
    if (nearestPlayer) {
      _openTrade(nearestPlayer.id, nearestPlayer.avatar);
      return;
    }
  }

  if (!npcSys) return;
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

/**
 * Tutorial-specific interaction: only the highlighted tutorial NPC can be
 * interacted with, and it opens the tutorial dialogue sequence.
 */
function _tryInteractTutorial() {
  if (!playerAvatar || !tutorialNpc || dialogueSys.active) return;
  const playerPos = playerAvatar.group.position;
  const d = tutorialNpc.group.position.distanceTo(playerPos);
  if (d < 7) {
    openTutorialDialogue();
  } else {
    ui.addNotification("Walk closer to the highlighted NPC.");
  }
}

function updateLoading(text, percent) {
  if (loadingText) loadingText.textContent = text;
  if (loadingProgress) loadingProgress.style.width = percent + '%';
}

function srAnnounce(text, politeness = 'polite') {
  const el = document.getElementById('sr-announce');
  if (el) {
    el.setAttribute('aria-live', politeness);
    el.textContent = '';
    requestAnimationFrame(() => { el.textContent = text; });
  }
}

/**
 * Open the trade UI with a remote player. Fetches both players' carried item
 * modelIds and shows the trade panel.
 */
function _openTrade(peerId, avatar) {
  if (!deliveryItemSys || !multiplayer || !ui) return;
  const localItemIds = deliveryItemSys.carriedKeys();
  const remoteItemIds = multiplayer.getRemoteCarriedItems(peerId);
  ui.showTrade(peerId, avatar.displayName || 'Player', localItemIds, remoteItemIds);
  tradeState = { peerId, peerName: avatar.displayName || 'Player', role: 'initiator', localItems: localItemIds, remoteItems: remoteItemIds };
}

/**
 * Execute a trade between the local player and a remote peer.
 * offerItemIds: items the local player gives away
 * requestItemIds: items the local player receives
 */
function _executeTrade(peerId, offerItemIds, requestItemIds) {
  if (!deliveryItemSys || !multiplayer) return;
  // Local player gives offered items.
  for (const id of offerItemIds) {
    if (deliveryItemSys.carriedKeys().includes(id)) {
      deliveryItemSys.deliverItem(id);
    }
  }
  // Local player receives requested items.
  for (const id of requestItemIds) {
    deliveryItemSys.receiveItem(id, null, null);
  }
  // Broadcast updated carried-items list.
  if (multiplayer.connected) {
    multiplayer.setCarriedItems(deliveryItemSys.carriedKeys());
  }
}

function _setupCustomizationUI() {
  const container = document.createElement('div');
  container.id = 'avatar-customization';
  Object.assign(container.style, {
    position: 'fixed', top: '16px', left: '16px',
    width: '260px', zIndex: '350',
    fontFamily: 'system-ui, sans-serif',
  });

  const card = document.createElement('div');
  Object.assign(card.style, {
    background: 'rgba(30,40,42,0.9)', border: '1px solid rgba(217,147,106,0.4)',
    borderRadius: '10px', padding: '14px', boxSizing: 'border-box',
    backdropFilter: 'blur(6px)',
  });

  const title = document.createElement('div');
  title.textContent = 'Avatar';
  Object.assign(title.style, {
    fontSize: '15px', fontWeight: '700', color: '#e8dccc',
    marginBottom: '10px', textAlign: 'center', letterSpacing: '0.05em',
  });

  const slots = [
    { key: 'hair', label: 'Hair', prefix: 'hair', max: 7 },
    { key: 'top', label: 'Top', prefix: 'top', max: 9 },
    { key: 'bottom', label: 'Bottom', prefix: 'bottom', max: 7 },
    { key: 'shoes', label: 'Shoes', prefix: 'shoes', max: 7 },
  ];

  const selects = {};
  const lockIcons = {};
  const equippedIndicators = {};

  /**
   * Update the equipped indicator (✓) for a slot based on current selection.
   */
  function _updateEquippedIndicator(key) {
    const indicator = equippedIndicators[key];
    const select = selects[key];
    if (!indicator || !select) return;
    indicator.textContent = select.value ? '✓' : '';
  }

  /**
   * Refresh the lock state (icon + disabled select) of every customization slot
   * based on current reputation. Call after reputation changes.
   */
  function _refreshCustomizationLocks() {
    slots.forEach(({ key }) => {
      const unlocked = avatarCustomization.isSlotUnlocked(key);
      const req = avatarCustomization.getSlotRequirements(key);
      const select = selects[key];
      const lockIcon = lockIcons[key];
      if (!select || !lockIcon) return;

      if (unlocked) {
        select.disabled = false;
        lockIcon.textContent = '';
        Object.assign(select.style, {
          opacity: 1,
          background: 'rgba(60,72,74,0.6)',
          color: '#e8dccc',
        });
        lockIcon.title = '';
      } else {
        select.disabled = true;
        lockIcon.textContent = '🔒';
        Object.assign(select.style, {
          opacity: 0.5,
          background: 'rgba(60,72,74,0.3)',
          color: '#9ab0b4',
        });
        lockIcon.title = `Locked — reach ${req.minTier} tier (${req.minRep} reputation)`;
      }
      _updateEquippedIndicator(key);
    });
  }

  slots.forEach(({ key, label, prefix, max }) => {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex', alignItems: 'center', gap: '8px',
      marginBottom: '10px', flexWrap: 'wrap',
    });

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    Object.assign(labelEl.style, {
      color: '#c8d4d8', fontSize: '13px', minWidth: '52px', flexShrink: '0',
    });

    const select = document.createElement('select');
    select.id = `avatar-slot-${key}`;
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'None';
    select.appendChild(none);
    for (let i = 1; i <= max; i++) {
      const opt = document.createElement('option');
      opt.value = `${prefix}${i}`;
      opt.textContent = `${prefix}${i}`;
      select.appendChild(opt);
    }
    Object.assign(select.style, {
      flex: '1', minWidth: '120px', padding: '6px 8px', borderRadius: '6px',
      border: '1px solid rgba(217,147,106,0.4)', background: 'rgba(60,72,74,0.6)',
      color: '#e8dccc', fontSize: '13px', outline: 'none',
    });

    // Restore saved value
    const saved = avatarCustomization.equippedId(key);
    if (saved) select.value = saved;

    select.addEventListener('change', async () => {
      await avatarCustomization.equip(key, select.value || null);
      _updateEquippedIndicator(key);
      // announce only real changes
      if (select.value) ui.addNotification(`Equipped ${select.value}`);
    });

    selects[key] = select;
    const lockIcon = document.createElement('span');
    lockIcon.style.fontSize = '14px';
    lockIcons[key] = lockIcon;

    // Equipped indicator (✓ shown when this slot has an equipped item)
    const indicator = document.createElement('span');
    indicator.style.fontSize = '14px';
    indicator.style.marginLeft = '4px';
    indicator.style.minWidth = '16px';
    indicator.style.textAlign = 'center';
    equippedIndicators[key] = indicator;

    row.appendChild(labelEl);
    row.appendChild(lockIcon);
    row.appendChild(select);
    row.appendChild(indicator);
    card.appendChild(row);
  });

  // Reset button
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset to default';
  Object.assign(resetBtn.style, {
    marginTop: '6px', padding: '6px 12px', borderRadius: '6px', border: 'none',
    background: 'rgba(217,147,106,0.2)', color: '#d9936a', fontSize: '12px',
    cursor: 'pointer', width: '100%',
  });
  resetBtn.addEventListener('click', async () => {
    for (const [key, select] of Object.entries(selects)) {
      select.value = '';
      await avatarCustomization.equip(key, null);
    }
    ui.addNotification('Avatar reset');
  });
  card.appendChild(resetBtn);

  container.appendChild(title);
  container.appendChild(card);
  document.body.appendChild(container);

  // Expose so the avatar system can refresh selects if loaded asynchronously
  window._avatarCustomizationSelects = selects;

  // Set initial lock state + equipped indicators.
  _refreshCustomizationLocks();

  return container;
}

function animate() {
  requestAnimationFrame(animate);
  const delta = sceneSys.clock.getDelta();

  const playing = gameState === 'playing';
  const tutorialActive = gameState === 'tutorial';
  const canMove = playing || tutorialActive;
  const dialogueActive = dialogueSys && dialogueSys.active;

  if (input && canMove && !dialogueActive) {
    const result = input.update(delta);
    if (playerAvatar) {
      playerAvatar.group.position.add(result.movement);
      if (result.movement.lengthSq() > 0.0001) {
        const dir = result.movement.clone().normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
        playerAvatar.group.quaternion.slerp(quat, 0.1);
        const isSprinting = result.keys['ShiftLeft'] || result.keys['ShiftRight'];
        playerAvatar.playAnimation(isSprinting ? 'sprint' : 'walk');
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
  // Planet transition is gated behind playing state so the tutorial stays on the street.
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
      if (planetSysReady) planetSys.update(sceneSys.camera);
    } else {
      streetSys.updateCamera(sceneSys.camera, playerAvatar.group.position);
    }
  }

  if (multiplayer && playerAvatar && canMove) {
    multiplayer.setLocalState(
      playerAvatar.group.position,
      playerAvatar.group.quaternion,
      playerAvatar.animationState
    );
    multiplayer.update(delta);
  }

  if (npcSys && canMove) npcSys.update(delta);
  if (playerAvatar && canMove) playerAvatar.update(delta);
  if (deliveryItemSys && canMove) deliveryItemSys.update(delta);

  sceneSys.update();
  if (ui && canMove) ui.cullNameplates(sceneSys.camera);

  // Interact proximity prompt: show floating "E" when player is within 10 units
  // of an NPC; hide inside the 7-unit interaction radius or beyond 10 units.
  // During the tutorial, force the tutorial NPC's prompt to stay visible so the
  // first interaction is guaranteed discoverable.
  if (canMove && !dialogueActive && playerAvatar && npcSys) {
    const playerPos = playerAvatar.group.position;
    for (const npc of npcSys.npcs) {
      const d = npc.group.position.distanceTo(playerPos);
      let show = false;
      if (tutorialActive) {
        show = npc === tutorialNpc; // only the highlighted NPC shows its prompt
      } else {
        show = d < 10 && d >= 7;
      }
      ui.setInteractPromptVisible(npc, show);
    }
  }

  sceneSys.updateFps();
  sceneSys.render();
}

init();
