import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export class UISystem {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.bubbles = new Map();
    this.onSendChat = null;
    this._setupChatInput();
    this._setupChatLog();
    this._setupHUD();

    this.nameplates = new Map();
    this.nameplateGroup = new THREE.Group();
    this.nameplateGroup.name = 'nameplates';
    this.scene.add(this.nameplateGroup);

    this._tempVec3 = new THREE.Vector3();
  }

  _setupChatInput() {
    this.inputEl = document.createElement('input');
    this.inputEl.id = 'chat-input';
    this.inputEl.type = 'text';
    this.inputEl.maxLength = 200;
    this.inputEl.placeholder = 'Type a message...';
    Object.assign(this.inputEl.style, {
      position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
      width: '320px', padding: '10px 14px', borderRadius: '8px', border: 'none',
      background: '#3c484a', color: '#e8dccc', fontSize: '0.95rem',
      outline: '2px solid transparent', zIndex: '300',
      display: 'none',
    });
    this.inputEl.setAttribute('aria-label', 'Chat input');
    document.body.appendChild(this.inputEl);

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

  _setupHUD() {
    this.hudEl = document.createElement('div');
    this.hudEl.id = 'hud-layer';
    Object.assign(this.hudEl.style, {
        position: 'fixed', top: '16px', left: '16px', right: '16px',
        display: 'flex', justifyContent: 'space-between',
        pointerEvents: 'none', zIndex: '150'
    });
    document.body.appendChild(this.hudEl);
  }

  createNameplate(player) {
    const div = document.createElement('div');
    div.className = 'nameplate';
    div.id = `nameplate-${player.id}`;
    Object.assign(div.style, {
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '4px 8px', borderRadius: '12px',
      background: 'rgba(60, 72, 74, 0.7)', backdropFilter: 'blur(4px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      whiteSpace: 'nowrap', userSelect: 'none',
      color: '#ffffff', fontSize: '0.8rem',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'auto'
    });

    const dot = document.createElement('div');
    dot.className = `status-dot ${player.isConnected ? 'online' : 'offline'}`;
    Object.assign(dot.style, {
      width: '8px', height: '8px', borderRadius: '50%',
      background: player.isConnected ? '#4e8c6d' : '#c0392b'
    });
    div.appendChild(dot);

    const name = document.createElement('span');
    name.className = 'player-name';
    name.textContent = player.displayName;
    div.appendChild(name);

    if (player.id === 'local') {
      const badge = document.createElement('span');
      badge.className = 'you-badge';
      badge.textContent = 'You';
      Object.assign(badge.style, {
        background: '#4e8c6d', fontSize: '10px', borderRadius: '10px', padding: '2px 6px'
      });
      div.appendChild(badge);
    }

    const label = new CSS2DObject(div);
    label.position.set(0, 2.2, 0); // Above avatar head
    label.renderOrder = 1; // Always on top of WebGL

    player.group.add(label);
    this.nameplates.set(player.id, label);
    return label;
  }

  showInput() {
    this.inputEl.style.display = 'block';
    this.inputEl.focus();
  }

  hideInput() {
    this.inputEl.style.display = 'none';
    this.inputEl.blur();
  }

  get isInputOpen() {
    return this.inputEl.style.display !== 'none';
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
    const div = document.createElement('div');
    div.className = 'chat-bubble';
    div.innerHTML = `<div style="font-weight:bold;color:#d9936a;margin-bottom:2px;font-size:0.75rem">${this._escapeHtml(avatar.displayName)}</div><div>${this._escapeHtml(text)}</div>`;
    Object.assign(div.style, {
        background: 'rgba(60, 72, 74, 0.9)', color: '#fff',
        padding: '8px 12px', borderRadius: '12px',
        fontSize: '0.9rem', maxWidth: '200px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        textAlign: 'center', wordWrap: 'break-word',
        transform: 'translate(-50%, -100%)', pointerEvents: 'none'
    });

    const bubble = new CSS2DObject(div);
    bubble.position.set(0, 3.2, 0); // higher than nameplate
    avatar.group.add(bubble);

    const bubbleId = avatar.id + '_' + Date.now();
    this.bubbles.set(bubbleId, { bubble, createdAt: Date.now(), duration });

    setTimeout(() => {
      avatar.group.remove(bubble);
      bubble.element.remove();
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

  update(camera) {
      // Basic depth sorting for nameplates
      const nameplatesArray = Array.from(this.nameplates.values());
      nameplatesArray.sort((a, b) => {
          const distA = camera.position.distanceToSquared(a.getWorldPosition(this._tempVec3));
          const distB = camera.position.distanceToSquared(b.getWorldPosition(this._tempVec3));
          return distB - distA; // Farthest first
      });

      nameplatesArray.forEach((np, i) => {
          np.element.style.zIndex = i;
      });
  }

  dispose() {
    if (this.inputEl?.parentNode) this.inputEl.parentNode.removeChild(this.inputEl);
    if (this.logEl?.parentNode) this.logEl.parentNode.removeChild(this.logEl);
    if (this.hudEl?.parentNode) this.hudEl.parentNode.removeChild(this.hudEl);
  }
}
