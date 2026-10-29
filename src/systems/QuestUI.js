import * as THREE from 'three';

// Messenger-style overlay: checklist panel (opened from top-right menu) +
// side-button strip (music / appearance / emote) matching messenger's look.
export class QuestUI {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.quests = new Map();
    this.panelOpen = false;
    this.onItemReceived = null;
    this.onQuestCompleted = null;

    this._buildSidebar();
    this._buildChecklistPanel();
    this.hidePanel();
  }

  _buildSidebar() {
    const strip = document.createElement('div');
    strip.id = 'messenger-sidebar';
    Object.assign(strip.style, {
      position: 'fixed', top: '16px', right: '16px', zIndex: '260',
      pointerEvents: 'none',
    });

    const buttons = [
      { id: 'sidebar-menu', label: '☰', title: 'Checklist', onClick: () => this.togglePanel() },
      { id: 'sidebar-music', label: '♪', title: 'Music' },
      { id: 'sidebar-appearance', label: '👕', title: 'Appearance' },
      { id: 'sidebar-emote', label: '💩', title: 'Emote' },
    ];

    buttons.forEach((b) => {
      const btn = document.createElement('button');
      btn.id = b.id;
      btn.textContent = b.label;
      btn.title = b.title;
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('aria-label', b.title);
      Object.assign(btn.style, {
        position: 'relative',
        width: '52px', height: '52px',
        marginBottom: '10px',
        background: '#e8e8e8', border: '3px solid #333', borderRadius: '8px',
        fontSize: '22px', fontWeight: '700', color: '#1a1a1a',
        cursor: 'pointer', boxShadow: '0 4px 0 rgba(0,0,0,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'auto',
        userSelect: 'none',
      });
      btn.addEventListener('click', (e) => { e.stopPropagation(); b.onClick && b.onClick(); });
      strip.appendChild(btn);
    });

    document.body.appendChild(strip);
    this.sidebar = strip;
    this.menuBtn = strip.querySelector('#sidebar-menu');
  }

  _buildChecklistPanel() {
    const panel = document.createElement('div');
    panel.id = 'checklist-panel';
    Object.assign(panel.style, {
      position: 'fixed', top: '40px', right: '16px', width: '340px',
      background: '#fff', border: '3px solid #333', borderRadius: '10px',
      boxShadow: '0 8px 0 rgba(0,0,0,0.25)', zIndex: '270',
      fontFamily: "'Courier New', Courier, monospace",
      pointerEvents: 'auto',
      display: 'none',
    });

    const header = document.createElement('div');
    header.textContent = 'CHECKLIST:';
    Object.assign(header.style, {
      padding: '16px 16px 8px', fontSize: '15px', fontWeight: '700',
      color: '#1a1a1a', borderBottom: '1px solid #ccc',
    });

    const list = document.createElement('div');
    list.id = 'checklist-list';
    Object.assign(list.style, { padding: '10px 16px 16px', fontSize: '14px', lineHeight: '1.9' });

    const close = document.createElement('button');
    close.textContent = '×';
    Object.assign(close.style, {
      position: 'absolute', top: '10px', right: '12px',
      width: '28px', height: '28px', background: 'transparent', border: 'none',
      fontSize: '20px', cursor: 'pointer',
    });
    close.addEventListener('click', () => this.hidePanel());

    panel.appendChild(header);
    panel.appendChild(list);
    panel.appendChild(close);
    document.body.appendChild(panel);

    this.panel = panel;
    this.list = list;
  }

  setQuests(quests) {
    this.quests = quests;
    this._renderList();
  }

  _renderList() {
    this.list.innerHTML = '';
    for (const [id, q] of this.quests) {
      const done = q.steps.filter((s) => s.completed).length;
      const row = document.createElement('div');
      Object.assign(row.style, {
        marginBottom: '10px', paddingBottom: '8px',
        borderBottom: q.completed ? 'none' : '1px solid #eee',
      });

      const title = document.createElement('div');
      Object.assign(title.style, {
        color: q.completed ? '#999' : q.color || '#1a1a1a',
        fontWeight: '700', fontSize: '14px', marginBottom: '4px',
      });
      title.textContent = q.description;

      const progress = document.createElement('div');
      Object.assign(progress.style, {
        color: q.completed ? '#666' : '#333', fontSize: '13px',
      });
      progress.textContent = q.completed ? 'COMPLETED' : `${done} / ${q.steps.length}`;

      row.appendChild(title);
      row.appendChild(progress);
      this.list.appendChild(row);
    }
  }

  showPanel() {
    this.panelOpen = true;
    this.panel.style.display = '';
    this._renderList();
  }

  hidePanel() {
    this.panelOpen = false;
    this.panel.style.display = 'none';
  }

  togglePanel() {
    if (this.panelOpen) this.hidePanel(); else this.showPanel();
  }

  dispose() {
    if (this.sidebar?.parentNode) this.sidebar.parentNode.removeChild(this.sidebar);
    if (this.panel?.parentNode) this.panel.parentNode.removeChild(this.panel);
  }
}
