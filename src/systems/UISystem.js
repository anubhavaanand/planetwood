import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { SHOP_CATALOG, getShopItemsBySlot, SHOP_SLOTS, findShopItem } from '../data/shop.js';

export class UISystem {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.bubbles = new Map();
    this.nameplates = new Map();
    this.onSendChat = null;
    this.onTriggerEmote = null;
    this.onTradeConfirm = null; // (peerId, offerItemIds, requestItemIds) => void
    this.onTradeCancel = null; // () => void
    this.blockedPlayers = new Set();
    this.interactPrompts = new Map();
    // Shop UI state
    this.shopContainer = null;
    this.shopVisible = false;
    this.progressionSys = null; // set externally (coins, level, onCoinsChange)
    this.avatarCustomization = null; // set externally (purchase/equip)
    // Daily reward UI state
    this.dailyRewardSys = null; // set externally (DailyRewardSystem)
    this.dailyRewardClaimBtn = null;
    this.dailyRewardVisible = false;
    this._setupChatInput();
    this._setupChatLog();
    this._setupEmotePanel();
    this._setupDailyRewardUI();
    this._setupShopUI();
    this._setupTradeUI();
  }

  _setupChatInput() {
    this.inputContainer = document.createElement('div');
    this.inputContainer.id = 'chat-input-container';
    Object.assign(this.inputContainer.style, {
      position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
      width: '320px', zIndex: '300', display: 'none',
      flexDirection: 'column', gap: '4px'
    });

    this.inputEl = document.createElement('input');
    this.inputEl.id = 'chat-input';
    this.inputEl.type = 'text';
    this.inputEl.maxLength = 200;
    this.inputEl.placeholder = 'Type a message...';
    this.inputEl.setAttribute('tabindex', '-1');
    Object.assign(this.inputEl.style, {
      width: '100%', padding: '10px 14px', borderRadius: '8px', border: 'none',
      background: '#3c484a', color: '#e8dccc', fontSize: '0.95rem',
      boxSizing: 'border-box'
    });
    this.inputEl.setAttribute('aria-label', 'Chat input');
    this.inputEl.setAttribute('aria-describedby', 'chat-input-hint');

    this.inputHint = document.createElement('div');
    this.inputHint.id = 'chat-input-hint';
    this.inputHint.textContent = 'Press Enter to send, Esc to cancel';
    Object.assign(this.inputHint.style, {
      fontSize: '0.75rem', color: '#9ab0b4', textAlign: 'center'
    });

    this.inputContainer.appendChild(this.inputEl);
    this.inputContainer.appendChild(this.inputHint);
    document.body.appendChild(this.inputContainer);

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.inputEl.value.trim()) {
        if (this.onSendChat) this.onSendChat(this.inputEl.value.trim());
        this.inputEl.value = '';
        this.hideInput();
      }
      if (e.key === 'Escape') {
        this.inputEl.value = '';
        this.hideInput();
      }
    });
  }

  _setupChatLog() {
    this.logEl = document.createElement('div');
    this.logEl.id = 'chat-log';
    this.logEl.setAttribute('tabindex', '0');
    this.logEl.setAttribute('aria-label', 'Chat log');
    Object.assign(this.logEl.style, {
      position: 'fixed', bottom: '70px', right: '16px',
      width: '280px', maxHeight: '200px', overflowY: 'auto',
      background: 'rgba(60,72,74,0.9)', borderRadius: '8px',
      padding: '8px', zIndex: '300',
      display: 'none',
    });
    this.logEl.setAttribute('role', 'log');
    this.logEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.logEl);
  }

  showInput() {
    this.inputContainer.style.display = 'flex';
    this.inputEl.setAttribute('tabindex', '0');
    this.inputEl.focus();
  }

  hideInput() {
    this.inputContainer.style.display = 'none';
    this.inputEl.setAttribute('tabindex', '-1');
    this.inputEl.blur();
  }

  get isInputOpen() {
    return this.inputContainer.style.display !== 'none';
  }

  addChatMessage(senderName, text, senderId = 'local') {
    if (this.blockedPlayers.has(senderId)) return;

    const entry = document.createElement('div');
    entry.className = 'chat-entry';
    entry.dataset.senderId = senderId;
    entry.style.cssText = 'margin-bottom:4px;font-size:0.8rem;color:#9ab0b4;word-wrap:break-word;display:flex;justify-content:space-between;align-items:center;';
    
    const textSpan = document.createElement('span');
    textSpan.innerHTML = `<strong style="color:#d9936a">${senderName}:</strong> ${this._escapeHtml(text)}`;
    entry.appendChild(textSpan);

    if (senderId !== 'local') {
      const blockBtn = document.createElement('button');
      blockBtn.textContent = 'Block';
      Object.assign(blockBtn.style, {
        background: 'transparent', border: 'none', color: '#ff6b6b',
        fontSize: '0.65rem', cursor: 'pointer', padding: '0 4px',
        fontFamily: 'system-ui, sans-serif'
      });
      blockBtn.addEventListener('click', () => {
        this.blockedPlayers.add(senderId);
        // Remove all entries by this sender from the log
        const entries = this.logEl.querySelectorAll(`.chat-entry[data-sender-id="${senderId}"]`);
        entries.forEach(el => el.remove());
        this.addNotification(`Blocked player: ${senderName}`);
      });
      blockBtn.setAttribute('tabindex', '0');
      blockBtn.setAttribute('aria-label', `Block ${senderName}`);
      blockBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.blockedPlayers.add(senderId);
          const entries = this.logEl.querySelectorAll(`.chat-entry[data-sender-id="${senderId}"]`);
          entries.forEach(el => el.remove());
          this.addNotification(`Blocked player: ${senderName}`);
        }
      });
      entry.appendChild(blockBtn);
    }

    this.logEl.appendChild(entry);
    this.logEl.scrollTop = this.logEl.scrollHeight;
    this.logEl.style.display = 'block';
    if (this.logEl.children.length > 50) {
      this.logEl.removeChild(this.logEl.firstChild);
    }
  }

  showChatBubble(avatar, text, duration = 5000) {
    if (this.blockedPlayers.has(avatar.id)) return;

    if (this.bubbles.has(avatar.id)) {
      const old = this.bubbles.get(avatar.id);
      avatar.group.remove(old.sprite);
      old.mat.dispose();
      old.texture.dispose();
      clearTimeout(old.timeoutId);
      this.bubbles.delete(avatar.id);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath();
    ctx.roundRect(4, 4, 248, 56, 12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    
    let displayText = text;
    if (text.length > 25) {
      displayText = text.substring(0, 22) + '...';
    }
    ctx.fillText(displayText, 128, 36);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.5, 0.625, 1);
    sprite.position.set(0, 2.7, 0);
    avatar.group.add(sprite);

    const timeoutId = setTimeout(() => {
      avatar.group.remove(sprite);
      mat.dispose();
      texture.dispose();
      this.bubbles.delete(avatar.id);
    }, duration);

    this.bubbles.set(avatar.id, { sprite, mat, texture, timeoutId });
  }

  addNotification(text, duration = 4000) {
    const el = document.createElement('div');
    el.textContent = text;
    Object.assign(el.style, {
      position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)',
      background: '#3c484a', color: '#e8dccc', padding: '10px 20px',
      borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center',
      zIndex: '200',
    });
    el.setAttribute('role', 'alert');
    document.body.appendChild(el);
    setTimeout(() => { document.body.removeChild(el); }, duration);
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  addNameplate(entity, text, isLocalPlayer = false) {
    const existing = this.nameplates.get(entity.id);
    if (existing) this.removeNameplate(entity);

    const div = document.createElement('div');
    div.className = 'nameplate';
    div.textContent = isLocalPlayer ? `${text} (You)` : text;
    div.style.cssText = `
      color: #fff;
      font-family: system-ui, sans-serif;
      font-size: 11px;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 4px;
      background: rgba(30, 40, 42, 0.85);
      white-space: nowrap;
      pointer-events: none;
      user-select: none;
      backdrop-filter: blur(4px);
      border: 1px solid rgba(217, 147, 106, 0.3);
      transform: translateY(-1.5em);
      text-align: center;
    `;

    const label = new CSS2DObject(div);
    label.position.set(0, 2.4, 0);
    entity.group.add(label);
    this.nameplates.set(entity.id, { label, div });
    return label;
  }

  removeNameplate(entity) {
    const entry = this.nameplates.get(entity.id);
    if (!entry) return;
    if (entity.group) {
      entity.group.remove(entry.label);
    } else if (entry.label.parent) {
      entry.label.parent.remove(entry.label);
    }
    entry.div.remove();
    this.nameplates.delete(entity.id);
  }

  updateNameplatePosition(entity) {
    const entry = this.nameplates.get(entity.id);
    if (!entry) return;
    entry.label.position.set(0, 2.4, 0);
  }

  addInteractPrompt(entity) {
    const existing = this.interactPrompts.get(entity.id);
    if (existing) return existing.label;

    const div = document.createElement('div');
    div.className = 'interact-prompt';
    div.textContent = 'E';
    div.setAttribute('aria-label', 'Interact');
    div.style.cssText = `
      color: #fff;
      font-family: 'Courier New', Courier, monospace;
      font-size: 16px;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 4px;
      background: rgba(30, 40, 42, 0.9);
      white-space: nowrap;
      pointer-events: none;
      user-select: none;
      backdrop-filter: blur(4px);
      border: 1px solid #fcd436;
      transform: translateY(-1.2em);
      text-align: center;
      display: none;
    `;

    const label = new CSS2DObject(div);
    label.position.set(0, 2.9, 0);
    entity.group.add(label);
    this.interactPrompts.set(entity.id, { label, div });
    return label;
  }

  removeInteractPrompt(entity) {
    const entry = this.interactPrompts.get(entity.id);
    if (!entry) return;
    if (entity.group) {
      entity.group.remove(entry.label);
    } else if (entry.label.parent) {
      entry.label.parent.remove(entry.label);
    }
    entry.div.remove();
    this.interactPrompts.delete(entity.id);
  }

  setInteractPromptVisible(entity, visible) {
    const entry = this.interactPrompts.get(entity.id);
    if (!entry) return;
    entry.div.style.display = visible ? 'block' : 'none';
  }

  _setupEmotePanel() {
    this.emoteContainer = document.createElement('div');
    this.emoteContainer.id = 'emote-container';
    Object.assign(this.emoteContainer.style, {
      position: 'fixed', bottom: '20px', right: '20px',
      display: 'flex', gap: '8px', zIndex: '300'
    });

    const emotes = [
      { name: 'Wave', type: 'wave', key: '1' },
      { name: 'Stretch', type: 'stretch', key: '2' },
      { name: 'Look', type: 'look', key: '3' }
    ];

    emotes.forEach(em => {
      const btn = document.createElement('button');
      btn.className = 'emote-btn';
      btn.textContent = `${em.name} (${em.key})`;
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('aria-label', `Send ${em.name} emote`);
      Object.assign(btn.style, {
        padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(217, 147, 106, 0.3)',
        background: 'rgba(60,72,74,0.9)', color: '#e8dccc', fontSize: '0.85rem',
        cursor: 'pointer', outline: 'none', transition: 'all 0.2s',
        fontFamily: 'system-ui, sans-serif', fontWeight: '500',
        backdropFilter: 'blur(4px)'
      });
      btn.addEventListener('click', () => {
        if (this.onTriggerEmote) this.onTriggerEmote(em.type);
      });

      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (this.onTriggerEmote) this.onTriggerEmote(em.type);
        }
      });

      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#d9936a';
        btn.style.color = '#1e282a';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'rgba(60,72,74,0.9)';
        btn.style.color = '#e8dccc';
      });

      this.emoteContainer.appendChild(btn);
    });

    document.body.appendChild(this.emoteContainer);

    this._onEmoteKeyDown = (e) => {
      if (this.isInputOpen) return;
      if (e.key === '1') this.onTriggerEmote?.('wave');
      if (e.key === '2') this.onTriggerEmote?.('stretch');
      if (e.key === '3') this.onTriggerEmote?.('look');
    };
    document.addEventListener('keydown', this._onEmoteKeyDown);
  }

  // ============================ Daily Reward UI ============================

  _setupDailyRewardUI() {
    const container = document.createElement('div');
    container.id = 'daily-reward-ui';
    Object.assign(container.style, {
      position: 'fixed', bottom: '20px', left: '20px',
      width: '280px', zIndex: '310', display: 'none',
      fontFamily: 'system-ui, sans-serif',
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      background: 'rgba(30,40,42,0.95)', border: '1px solid rgba(217, 147, 106, 0.5)',
      borderRadius: '12px', padding: '16px', boxSizing: 'border-box',
      backdropFilter: 'blur(8px)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: '10px',
    });

    const title = document.createElement('div');
    title.textContent = 'Daily Reward';
    Object.assign(title.style, {
      fontSize: '15px', fontWeight: '700', color: '#e8dccc',
      minWidth: '110px', textAlign: 'right',
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
      background: 'transparent', border: 'none', color: '#9ab0b4',
      fontSize: '18px', cursor: 'pointer', lineHeight: '1',
    });
    closeBtn.addEventListener('click', () => this.hideDailyReward());

    header.appendChild(title);
    header.appendChild(closeBtn);
    card.appendChild(header);

    const streakInfo = document.createElement('div');
    streakInfo.id = 'daily-streak-info';
    Object.assign(streakInfo.style, {
      fontSize: '13px', color: '#c8d4d8', marginBottom: '12px',
    });
    card.appendChild(streakInfo);

    const rewardInfo = document.createElement('div');
    rewardInfo.id = 'daily-reward-info';
    Object.assign(rewardInfo.style, {
      fontSize: '13px', color: '#fcd436', fontWeight: '700',
      marginBottom: '14px', minHeight: '20px',
    });
    card.appendChild(rewardInfo);

    const claimBtn = document.createElement('button');
    claimBtn.id = 'daily-claim-btn';
    claimBtn.textContent = 'Claim Daily Reward';
    claimBtn.setAttribute('aria-label', 'Claim daily login reward');
    Object.assign(claimBtn.style, {
      width: '100%', padding: '10px 14px', borderRadius: '8px', border: 'none',
      background: '#d9936a', color: '#1e282a', fontSize: '0.95rem',
      fontWeight: '700', cursor: 'pointer', outline: 'none',
    });
    claimBtn.addEventListener('click', () => {
      if (this.dailyRewardSys && this.dailyRewardSys.claimDailyReward) {
        const result = this.dailyRewardSys.claimDailyReward(this.dailyRewardProgressionSys);
        if (result) {
          const parts = [];
          if (result.coins > 0) parts.push(`${result.coins} coins`);
          if (result.xp > 0) parts.push(`${result.xp} XP`);
          if (result.specialItem) parts.push(`special item: ${result.specialItem}`);
          this.addNotification(
            `Daily reward claimed (streak ${result.streak}): ${parts.join(', ')}`
          );
          this._updateDailyRewardUI();
          this.hideDailyReward();
        } else {
          this.addNotification('Daily reward already claimed today.');
        }
      }
    });
    card.appendChild(claimBtn);

    container.appendChild(card);
    document.body.appendChild(container);
    this.dailyRewardClaimBtn = claimBtn;
    this._dailyRewardElements = { streakInfo, rewardInfo };
  }

  // ============================ Shop UI ============================

  _setupShopUI() {
    const container = document.createElement('div');
    container.id = 'shop-ui';
    Object.assign(container.style, {
      position: 'fixed', top: '16px', right: '16px',
      width: '340px', zIndex: '360', display: 'none',
      fontFamily: 'system-ui, sans-serif',
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      background: 'rgba(30,40,42,0.95)', border: '1px solid rgba(217,147,106,0.5)',
      borderRadius: '12px', padding: '16px', boxSizing: 'border-box',
      backdropFilter: 'blur(8px)',
    });

    // Header: title + balance + close
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: '14px',
    });

    const title = document.createElement('div');
    title.textContent = 'Avatar Shop';
    Object.assign(title.style, {
      fontSize: '16px', fontWeight: '700', color: '#e8dccc',
      letterSpacing: '0.05em',
    });

    const balanceBar = document.createElement('div');
    balanceBar.id = 'shop-balance';
    Object.assign(balanceBar.style, {
      fontSize: '13px', color: '#fcd436', fontWeight: '700',
      minWidth: '110px', textAlign: 'right',
    });

    const closeBtn2 = document.createElement('button');
    closeBtn2.textContent = '✕';
    Object.assign(closeBtn2.style, {
      background: 'transparent', border: 'none', color: '#9ab0b4',
      fontSize: '18px', cursor: 'pointer', lineHeight: '1',
    });
    closeBtn2.addEventListener('click', () => this.hideShop());

    header.appendChild(title);
    header.appendChild(balanceBar);
    header.appendChild(closeBtn2);
    card.appendChild(header);

    // Slots tabs
    const tabs = document.createElement('div');
    Object.assign(tabs.style, {
      display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap',
    });
    const slotButtons = {};
    SHOP_SLOTS.forEach((slot) => {
      const btn = document.createElement('button');
      btn.textContent = slot.charAt(0).toUpperCase() + slot.slice(1);
      Object.assign(btn.style, {
        padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(217,147,106,0.3)',
        background: 'rgba(60,72,74,0.6)', color: '#c8d4d8', fontSize: '12px',
        cursor: 'pointer', outline: 'none',
      });
      btn.addEventListener('click', () => {
        this._selectShopSlot(slot);
        Object.values(slotButtons).forEach((b) => {
          Object.assign(b.style, {
            background: 'rgba(60,72,74,0.6)', color: '#c8d4d8',
          });
        });
        Object.assign(btn.style, {
          background: '#d9936a', color: '#1e282a',
        });
      });
      slotButtons[slot] = btn;
      tabs.appendChild(btn);
    });
    card.appendChild(tabs);

    // Items grid
    const itemsGrid = document.createElement('div');
    itemsGrid.id = 'shop-items-grid';
    Object.assign(itemsGrid.style, {
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
      maxHeight: '420px', overflowY: 'auto',
    });
    card.appendChild(itemsGrid);

    container.appendChild(card);
    document.body.appendChild(container);
    this.shopContainer = container;
    this._shopElements = { balanceBar, itemsGrid, slotButtons };
    this._selectShopSlot('hair'); // default tab
  }

  /**
   * Bind the daily reward system to the UI. progressionSys is used to grant
   * coins/XP when claiming.
   */
  bindDailyReward(dailyRewardSys, progressionSys) {
    this.dailyRewardSys = dailyRewardSys;
    this.dailyRewardProgressionSys = progressionSys;
    this._updateDailyRewardUI();
  }

  _updateDailyRewardUI() {
    const sys = this.dailyRewardSys;
    if (!sys || !this._dailyRewardElements) return;

    const check = sys.checkDailyReward();
    const { streakInfo, rewardInfo } = this._dailyRewardElements;
    const btn = this.dailyRewardClaimBtn;

    streakInfo.textContent = check.available
      ? `Current streak: ${check.streak} day${check.streak !== 1 ? 's' : ''}`
      : `Streak: ${check.streak} day${check.streak !== 1 ? 's' : ''} (claimed today)`;

    if (check.available) {
      const parts = [];
      if (check.dayReward.coins > 0) parts.push(`${check.dayReward.coins} coins`);
      if (check.dayReward.xp > 0) parts.push(`${check.dayReward.xp} XP`);
      if (check.dayReward.specialItem) parts.push(`special item`);
      rewardInfo.textContent = `Today (day ${check.potentialStreak}): ${parts.join(', ')}`;
      btn.disabled = false;
      btn.textContent = 'Claim Daily Reward';
    } else {
      rewardInfo.textContent = 'Come back tomorrow for the next daily reward.';
      btn.disabled = true;
      btn.textContent = 'Claimed today';
    }
  }

  showDailyReward() {
    if (!this.dailyRewardSys) return;
    this.dailyRewardVisible = true;
    this._updateDailyRewardUI();
    const container = document.getElementById('daily-reward-ui');
    if (container) container.style.display = '';
  }

  hideDailyReward() {
    this.dailyRewardVisible = false;
    const container = document.getElementById('daily-reward-ui');
    if (container) container.style.display = 'none';
  }

  /**
   * Show a "Daily reward available!" notification. Call once on login when a
   * reward can be claimed.
   */
  notifyDailyRewardAvailable() {
    this.addNotification('Daily reward available!');
  }

  /**
   * Bind the shop to progression + avatar systems. Called from main.js once
   * both systems are constructed.
   */
  bindShop(progressionSys, avatarCustomization) {
    this.progressionSys = progressionSys;
    this.avatarCustomization = avatarCustomization;
    if (progressionSys && progressionSys.onCoinsChange) {
      const prev = progressionSys.onCoinsChange;
      progressionSys.onCoinsChange = (coins) => {
        if (prev) prev(coins);
        this._updateShopBalance();
        if (this.shopVisible) this._renderShopItems();
      };
    }
    this._updateShopBalance();
  }

  showShop() {
    if (!this.shopContainer) return;
    this.shopVisible = true;
    this.shopContainer.style.display = '';
    this._updateShopBalance();
    this._renderShopItems();
  }

  hideShop() {
    if (!this.shopContainer) return;
    this.shopVisible = false;
    this.shopContainer.style.display = 'none';
  }

  toggleShop() {
    if (this.shopVisible) this.hideShop(); else this.showShop();
  }

  _updateShopBalance() {
    const bar = this._shopElements?.balanceBar;
    if (!bar || !this.progressionSys) return;
    bar.textContent = `Lvl ${this.progressionSys.level}  •  ${this.progressionSys.coins} coins`;
  }

  _selectShopSlot(slot) {
    this._activeShopSlot = slot;
    if (this.shopVisible) this._renderShopItems();
  }

  _renderShopItems() {
    const grid = this._shopElements?.itemsGrid;
    if (!grid || !this._activeShopSlot) return;
    grid.innerHTML = '';
    const items = getShopItemsBySlot(this._activeShopSlot);
    const level = this.progressionSys?.level ?? 1;
    const coins = this.progressionSys?.coins ?? 0;
    const owned = (id) => this.avatarCustomization?.isOwned(id) ?? false;
    const slotUnlocked = (slot) => this.avatarCustomization?.isSlotUnlocked(slot) ?? true;

    items.forEach((item) => {
      const levelMet = level >= item.requiredLevel;
      const affordable = coins >= item.cost;
      const isOwned = owned(item.id);
      const slotLocked = !slotUnlocked(item.slot);
      const canBuy = levelMet && affordable && !isOwned && !slotLocked;

      const card = document.createElement('div');
      Object.assign(card.style, {
        background: 'rgba(60,72,74,0.5)', border: '1px solid rgba(217,147,106,0.25)',
        borderRadius: '8px', padding: '8px', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: '6px',
        opacity: isOwned ? 1 : (levelMet && affordable ? 1 : 0.55),
        cursor: canBuy ? 'pointer' : 'default',
      });

      const nameRow = document.createElement('div');
      Object.assign(nameRow.style, {
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      });
      const nameEl = document.createElement('div');
      nameEl.textContent = item.label;
      Object.assign(nameEl.style, {
        fontSize: '13px', fontWeight: '600', color: '#e8dccc',
      });
      const costEl = document.createElement('div');
      costEl.textContent = isOwned ? 'Owned' : `${item.cost} coins`;
      Object.assign(costEl.style, {
        fontSize: '12px', fontWeight: '700',
        color: isOwned ? '#8cc48c' : (affordable ? '#fcd436' : '#9ab0b4'),
      });
      nameRow.appendChild(nameEl);
      nameRow.appendChild(costEl);

      const reqEl = document.createElement('div');
      reqEl.textContent = `Level ${item.requiredLevel}${levelMet ? '' : ' — locked'}`;
      Object.assign(reqEl.style, {
        fontSize: '11px', color: levelMet ? '#c8d4d8' : '#ff6b6b',
      });

      const lockHintEl = document.createElement('div');
      if (slotLocked) {
        const req = this.avatarCustomization?.getSlotRequirements(item.slot);
        lockHintEl.textContent = `🔒 Reach ${req?.minTier ?? 'Friend'} tier to unlock ${item.slot}`;
        Object.assign(lockHintEl.style, {
          fontSize: '11px', color: '#ff6b6b', marginTop: '2px',
        });
      }

      const btn = document.createElement('button');
      const buttonLabel = slotLocked ? 'Reputation locked'
        : isOwned ? 'Equip' : (canBuy ? 'Buy' : 'Locked');
      btn.textContent = buttonLabel;
      Object.assign(btn.style, {
        padding: '6px 8px', borderRadius: '6px', border: 'none',
        fontSize: '12px', fontWeight: '700', cursor: canBuy ? 'pointer' : 'default',
        background: canBuy ? '#d9936a' : 'rgba(217,147,106,0.15)',
        color: canBuy ? '#1e282a' : '#9ab0b4',
        opacity: canBuy ? 1 : 0.6,
      });
      btn.disabled = !canBuy;

      btn.addEventListener('click', async () => {
        if (!canBuy) return;
        if (!this.progressionSys || !this.avatarCustomization) return;
        if (this.progressionSys.level < item.requiredLevel) {
          this.addNotification(`Level ${item.requiredLevel} required`);
          return;
        }
        if (this.progressionSys.coins < item.cost) {
          this.addNotification('Not enough coins');
          return;
        }
        this.progressionSys.coins -= item.cost;
        this.progressionSys.save();
        if (this.progressionSys.onCoinsChange) {
          this.progressionSys.onCoinsChange(this.progressionSys.coins);
        }
        const ok = await this.avatarCustomization.purchase(item.id);
        if (ok) {
          this.addNotification(`Purchased ${item.label}`);
          this._renderShopItems();
        } else {
          this.progressionSys.coins += item.cost;
          this.progressionSys.save();
          if (this.progressionSys.onCoinsChange) {
            this.progressionSys.onCoinsChange(this.progressionSys.coins);
          }
          this.addNotification('Purchase failed');
        }
      });

      card.appendChild(nameRow);
      card.appendChild(reqEl);
      card.appendChild(lockHintEl);
      card.appendChild(btn);
      grid.appendChild(card);
    });
  }

  cullNameplates(camera) {
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);

    const _pos = new THREE.Vector3();
    for (const [id, entry] of this.nameplates) {
      const label = entry.label;
      if (label.parent) {
        // CSS2DObjects have no geometry — test the parent's world position instead
        _pos.setFromMatrixPosition(label.parent.matrixWorld);
        const visible = frustum.containsPoint(_pos);
        entry.div.style.display = visible ? 'block' : 'none';
      }
    }
  }

  dispose() {
    if (this.inputContainer?.parentNode) this.inputContainer.parentNode.removeChild(this.inputContainer);
    if (this.logEl?.parentNode) this.logEl.parentNode.removeChild(this.logEl);
    if (this.emoteContainer?.parentNode) this.emoteContainer.parentNode.removeChild(this.emoteContainer);
    if (this._onEmoteKeyDown) document.removeEventListener('keydown', this._onEmoteKeyDown);
    for (const [id, entry] of this.nameplates) {
      if (entry.div?.parentNode) entry.div.parentNode.removeChild(entry.div);
    }
    this.nameplates.clear();
    for (const [id, entry] of this.interactPrompts) {
      if (entry.div?.parentNode) entry.div.parentNode.removeChild(entry.div);
    }
    this.interactPrompts.clear();
  }
}
