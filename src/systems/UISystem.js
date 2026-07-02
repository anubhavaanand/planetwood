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
    this.blockedPlayers = new Set();
    this._setupChatInput();
    this._setupChatLog();
    this._setupEmotePanel();
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
    this.inputEl.focus();
  }

  hideInput() {
    this.inputContainer.style.display = 'none';
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

    for (const [id, entry] of this.nameplates) {
      const label = entry.label;
      if (label.parent) {
        const visible = frustum.intersectsObject(label.parent);
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
  }
}
