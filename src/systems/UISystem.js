import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

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
    // Daily reward UI state
    this.dailyRewardSys = null; // set externally (DailyRewardSystem)
    this.dailyRewardClaimBtn = null;
    this.dailyRewardVisible = false;
    // Trade UI state
    this.tradeContainer = null;
    this.tradeVisible = false;
    this._tradeElements = null;
    this._tradePeerId = null;
    this._tradeSelected = { offer: new Set(), request: new Set() };
    this._setupChatInput();
    this._setupChatLog();
    this._setupEmotePanel();
    this._setupDailyRewardUI();
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

  notifyDailyRewardAvailable() {
    this.addNotification('Daily reward available!');
  }

  // ============================ Trade UI ============================

  _setupTradeUI() {
    const container = document.createElement('div');
    container.id = 'trade-ui';
    Object.assign(container.style, {
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: '620px', zIndex: '450', display: 'none', flexDirection: 'column',
      gap: '12px', fontFamily: 'system-ui, sans-serif',
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      background: 'rgba(30,40,42,0.97)', border: '2px solid #d9936a',
      borderRadius: '12px', padding: '20px', boxSizing: 'border-box',
      backdropFilter: 'blur(10px)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: '16px',
    });

    const title = document.createElement('div');
    title.textContent = 'TRADE';
    Object.assign(title.style, {
      fontSize: '16px', fontWeight: '700', color: '#fcd436', letterSpacing: '0.05em',
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
      background: 'transparent', border: 'none', color: '#9ab0b4',
      fontSize: '18px', cursor: 'pointer', lineHeight: '1',
    });
    closeBtn.addEventListener('click', () => this.hideTrade());

    header.appendChild(title);
    header.appendChild(closeBtn);
    card.appendChild(header);

    const panels = document.createElement('div');
    Object.assign(panels.style, { display: 'flex', gap: '20px' });

    const localPanel = this._buildTradeSide('your items', 'offer');
    const remotePanel = this._buildTradeSide("their items", 'request');
    panels.appendChild(localPanel);
    panels.appendChild(remotePanel);
    card.appendChild(panels);

    const footer = document.createElement('div');
    Object.assign(footer.style, {
      display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px',
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, {
      padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(217,147,106,0.3)',
      background: 'rgba(60,72,74,0.6)', color: '#c8d4d8', fontSize: '0.9rem',
      cursor: 'pointer', outline: 'none',
    });
    cancelBtn.addEventListener('click', () => {
      this.hideTrade();
      if (this.onTradeCancel) this.onTradeCancel();
    });

    const confirmBtn = document.createElement('button');
    confirmBtn.id = 'trade-confirm-btn';
    confirmBtn.textContent = 'Confirm Trade';
    Object.assign(confirmBtn.style, {
      padding: '8px 20px', borderRadius: '6px', border: 'none',
      background: '#d9936a', color: '#1e282a', fontSize: '0.9rem',
      fontWeight: '700', cursor: 'pointer', outline: 'none', opacity: '0.5',
    });
    confirmBtn.disabled = true;
    confirmBtn.addEventListener('click', () => {
      if (this.onTradeConfirm) {
        this.onTradeConfirm(this._tradePeerId, this._tradeSelected.offer, this._tradeSelected.request);
      }
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);
    card.appendChild(footer);

    container.appendChild(card);
    document.body.appendChild(container);
    this.tradeContainer = container;
    this._tradeElements = { localList: localPanel.querySelector('.trade-side-list'),
      remoteList: remotePanel.querySelector('.trade-side-list'), confirmBtn };
    this._tradePeerId = null;
    this._tradeSelected = { offer: new Set(), request: new Set() };
  }

  _buildTradeSide(label, side) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, { display: 'flex', flexDirection: 'column', gap: '8px', flex: '1' });

    const title = document.createElement('div');
    title.textContent = label;
    Object.assign(title.style, { fontSize: '13px', fontWeight: '600', color: '#c8d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' });

    const list = document.createElement('div');
    list.className = 'trade-side-list';
    Object.assign(list.style, {
      display: 'flex', flexDirection: 'column', gap: '6px',
      maxHeight: '260px', overflowY: 'auto',
      background: 'rgba(60,72,74,0.4)', borderRadius: '8px', padding: '10px',
    });

    const empty = document.createElement('div');
    empty.textContent = '(none)';
    Object.assign(empty.style, { color: '#666', fontSize: '12px', fontStyle: 'italic', padding: '4px 0' });
    list.appendChild(empty);
    list._emptyEl = empty;

    wrapper.appendChild(title);
    wrapper.appendChild(list);
    return wrapper;
  }

  showTrade(peerId, peerName, localItemIds, remoteItemIds) {
    if (!this.tradeContainer) return;
    this._tradePeerId = peerId;
    this._tradeSelected = { offer: new Set(), request: new Set() };
    this.tradeContainer.style.display = 'flex';
    this._renderTradeSide(localItemIds, 'offer');
    this._renderTradeSide(remoteItemIds, 'request');
    this._updateTradeConfirm();
    this.addNotification(`Trade opened with ${peerName}. Select items to swap.`);
  }

  hideTrade() {
    if (!this.tradeContainer) return;
    this.tradeContainer.style.display = 'none';
    this._tradePeerId = null;
    this._tradeSelected = { offer: new Set(), request: new Set() };
  }

  _renderTradeSide(itemIds, side) {
    const list = side === 'offer' ? this._tradeElements.localList : this._tradeElements.remoteList;
    if (!list) return;
    list.innerHTML = '';
    if (itemIds.length === 0) {
      list.appendChild(list._emptyEl || (() => { const e = document.createElement('div'); e.textContent = '(none)'; Object.assign(e.style, { color: '#666', fontSize: '12px', fontStyle: 'italic', padding: '4px 0' }); return e; })());
      return;
    }
    const selected = side === 'offer' ? this._tradeSelected.offer : this._tradeSelected.request;
    itemIds.forEach(itemId => {
      const row = document.createElement('div');
      const isSelected = selected.has(itemId);
      Object.assign(row.style, {
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 8px', borderRadius: '6px',
        background: isSelected ? '#d9936a' : 'rgba(217,147,106,0.15)',
        border: isSelected ? '1px solid #d9936a' : '1px solid rgba(217,147,106,0.3)',
        cursor: 'pointer', fontSize: '12px', color: isSelected ? '#1e282a' : '#e8dccc',
      });
      row.textContent = itemId.split('/').pop().replace(/\.(drc|glb|obj)$/i, '');
      row.title = itemId;
      row.addEventListener('click', () => {
        if (isSelected) selected.delete(itemId); else selected.add(itemId);
        this._renderTradeSide(itemIds, side);
        this._updateTradeConfirm();
      });
      list.appendChild(row);
    });
  }

  _updateTradeConfirm() {
    const btn = this._tradeElements.confirmBtn;
    if (!btn) return;
    const hasOffer = this._tradeSelected.offer.size > 0;
    const hasRequest = this._tradeSelected.request.size > 0;
    btn.disabled = !(hasOffer && hasRequest);
    btn.style.opacity = btn.disabled ? '0.5' : '1';
  }

}
