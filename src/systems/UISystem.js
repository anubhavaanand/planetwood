import * as THREE from 'three';

export class UISystem {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.bubbles = new Map();
    this.onSendChat = null;
    this._setupChatInput();
    this._setupChatLog();
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

  dispose() {
    if (this.inputEl?.parentNode) this.inputEl.parentNode.removeChild(this.inputEl);
    if (this.logEl?.parentNode) this.logEl.parentNode.removeChild(this.logEl);
  }
}
