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
    this._setupChatInput();
    this._setupChatLog();
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

  addChatMessage(senderName, text) {
    const entry = document.createElement('div');
    entry.style.cssText = 'margin-bottom:4px;font-size:0.8rem;color:#9ab0b4;word-wrap:break-word;';
    entry.innerHTML = `<strong style="color:#d9936a">${senderName}:</strong> ${this._escapeHtml(text)}`;
    this.logEl.appendChild(entry);
    this.logEl.scrollTop = this.logEl.scrollHeight;
    this.logEl.style.display = 'block';
    if (this.logEl.children.length > 50) {
      this.logEl.removeChild(this.logEl.firstChild);
    }
  }

  showChatBubble(avatar, text, duration = 5000) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.roundRect(4, 4, 248, 56, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 38);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2, 0.5, 1);
    sprite.position.set(0, 2.5, 0);
    avatar.group.add(sprite);

    const bubbleId = avatar.id + '_' + Date.now();
    this.bubbles.set(bubbleId, { sprite, createdAt: Date.now(), duration });

    setTimeout(() => {
      avatar.group.remove(sprite);
      mat.dispose();
      texture.dispose();
      this.bubbles.delete(bubbleId);
    }, duration);
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
    entity.group.remove(entry.label);
    entry.div.remove();
    this.nameplates.delete(entity.id);
  }

  updateNameplatePosition(entity) {
    const entry = this.nameplates.get(entity.id);
    if (!entry) return;
    entry.label.position.set(0, 2.4, 0);
  }

  dispose() {
    if (this.inputContainer?.parentNode) this.inputContainer.parentNode.removeChild(this.inputContainer);
    if (this.logEl?.parentNode) this.logEl.parentNode.removeChild(this.logEl);
    for (const [id, entry] of this.nameplates) {
      if (entry.div?.parentNode) entry.div.parentNode.removeChild(entry.div);
    }
    this.nameplates.clear();
  }
}
