import * as THREE from 'three';

// NPC face palettes for the dialogue avatar (matches messenger's sketchy style).
const FACE_COLORS = {
  boss: '#c25959',
  'office-worker': '#66BDE6',
  caveman: '#f3c258',
  'young-lady': '#8cc48c',
  'factory-worker-a': '#de794e',
  'male-scientist': '#66BDE6',
  'female-scientist': '#c25959',
  oldwoman: '#8cc48c',
  mountainman: '#8cc48c',
  diver: '#66BDE6',
  musician: '#de794e',
  default: '#9ab0b4',
};

export class DialogueSystem {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    this.active = false;
    this.currentNpc = null;
    this.currentStep = null;
    this.textIndex = 0;
    this.showingChoices = false;
    this.choiceButtons = [];
    this.onNpcInteract = null; // (npc) => void, set by main to open dialogue
    this.onStepComplete = null; // (questId, stepId) => void
    this.onStepChoice = null; // (questId, nextStepId) => void, for branch selection

    this._buildUI();
    this.close();
  }

  _buildUI() {
    const container = document.createElement('div');
    container.id = 'dialogue-container';
    Object.assign(container.style, {
      position: 'fixed',
      bottom: '0', left: '0', width: '100%', height: '340px',
      zIndex: '250',
      pointerEvents: 'none',
      fontFamily: "'Courier New', Courier, monospace",
      display: 'none',
    });

    // messenger header pill
    const header = document.createElement('div');
    header.id = 'dialogue-header';
    header.textContent = 'messenger';
    Object.assign(header.style, {
      position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
      width: '260px', height: '48px',
      background: '#4a90d9', color: '#fff',
      borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '20px', fontWeight: '700', letterSpacing: '0.05em',
      boxShadow: '0 4px 0 rgba(0,0,0,0.25)',
      pointerEvents: 'auto',
    });

    // avatar
    const avatar = document.createElement('div');
    avatar.id = 'dialogue-avatar';
    Object.assign(avatar.style, {
      position: 'absolute', top: '86px', left: '24px', width: '80px', height: '80px',
      borderRadius: '10px', border: '3px solid #333', boxShadow: '0 4px 0 rgba(0,0,0,0.3)',
      pointerEvents: 'none',
    });
    const avatarFace = document.createElement('div');
    avatarFace.id = 'dialogue-avatar-face';
    Object.assign(avatarFace.style, {
      width: '100%', height: '100%', borderRadius: '7px', background: FACE_COLORS.default,
      overflow: 'hidden',
    });
    avatar.appendChild(avatarFace);

    // dialogue text box
    const box = document.createElement('div');
    box.id = 'dialogue-box';
    Object.assign(box.style, {
      position: 'absolute', top: '86px', left: '128px', right: '24px', height: '120px',
      background: '#fff', border: '3px solid #333', borderRadius: '6px',
      padding: '18px 20px', boxSizing: 'border-box',
      boxShadow: '0 6px 0 rgba(0,0,0,0.25)',
      pointerEvents: 'none',
    });
    const nameEl = document.createElement('div');
    nameEl.id = 'dialogue-name';
    Object.assign(nameEl.style, {
      marginBottom: '8px', fontSize: '13px', fontWeight: '700',
      color: '#333', letterSpacing: '0.05em',
    });
    const textEl = document.createElement('div');
    textEl.id = 'dialogue-text';
    Object.assign(textEl.style, {
      fontSize: '17px', lineHeight: '1.55', color: '#1a1a1a', whiteSpace: 'pre-wrap',
    });
    box.appendChild(nameEl);
    box.appendChild(textEl);

    // choices container (shown when step has choices)
    const choicesContainer = document.createElement('div');
    choicesContainer.id = 'dialogue-choices';
    Object.assign(choicesContainer.style, {
      position: 'absolute', bottom: '18px', left: '128px', right: '24px',
      display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none',
    });
    box.appendChild(choicesContainer);

    // continue button (hidden when showing choices)
    const cont = document.createElement('button');
    cont.id = 'dialogue-continue';
    cont.textContent = '▶';
    Object.assign(cont.style, {
      position: 'absolute', bottom: '18px', right: '24px',
      width: '56px', height: '56px',
      background: '#fcd436', border: '3px solid #333', borderRadius: '8px',
      fontSize: '24px', fontWeight: '700', color: '#1a1a1a',
      cursor: 'pointer', boxShadow: '0 4px 0 rgba(0,0,0,0.25)',
      pointerEvents: 'auto',
    });
    cont.addEventListener('click', () => this.advance());
    cont.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.advance(); }
    });
    cont.setAttribute('tabindex', '0');
    cont.setAttribute('aria-label', 'Continue dialogue');

    container.appendChild(header);
    container.appendChild(avatar);
    container.appendChild(box);
    container.appendChild(cont);
    document.body.appendChild(container);

    this.container = container;
    this.avatarFace = avatarFace;
    this.nameEl = nameEl;
    this.textEl = textEl;
    this.continueBtn = cont;
    this.choicesContainer = choicesContainer;
  }

  _clearChoices() {
    this.choiceButtons.forEach(btn => btn.remove());
    this.choiceButtons = [];
    this.showingChoices = false;
    this.continueBtn.style.display = '';
  }

  _showChoices(step) {
    this._clearChoices();
    this.showingChoices = true;
    this.continueBtn.style.display = 'none';

    step.choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.textContent = choice.label;
      Object.assign(btn.style, {
        width: '100%', padding: '10px 14px', borderRadius: '6px',
        background: '#e8e8e8', border: '2px solid #333', color: '#1a1a1a',
        fontSize: '15px', fontWeight: '600', cursor: 'pointer',
        textAlign: 'left', boxShadow: '0 3px 0 rgba(0,0,0,0.25)',
      });
      btn.addEventListener('click', () => this._selectChoice(choice));
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._selectChoice(choice); }
      });
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('aria-label', choice.label);
      this.choicesContainer.appendChild(btn);
      this.choiceButtons.push(btn);
    });
  }

  _selectChoice(choice) {
    this._clearChoices();
    if (choice.nextStep) {
      // Notify main to resolve the next step via QuestSystem.selectNextStep
      if (this.onStepChoice && this.currentNpc) {
        this.onStepChoice(this.currentNpc.questId, choice.nextStep);
        return;
      }
    }
    // Fallback — no handler or no next step — treat as step complete
    if (this.onStepComplete && this.currentNpc) {
      this.onStepComplete(this.currentNpc.questId, this.currentStep?.id || 'unknown');
    }
    this.close();
  }

  setNpcColors(npcType) {
    this.avatarFace.style.background = FACE_COLORS[npcType] || FACE_COLORS.default;
  }

  open(npc) {
    if (this.active) return;
    this.currentNpc = npc;
    this.currentStep = null;
    this.textIndex = 0;
    this.showingChoices = false;
    this.active = true;
    this.container.style.display = '';
    this.container.style.pointerEvents = 'auto';
    this._startStepForNpc();
  }

  close() {
    this.active = false;
    this.currentNpc = null;
    this.currentStep = null;
    this.textIndex = 0;
    this.showingChoices = false;
    this._clearChoices();
    this.container.style.display = 'none';
    this.container.style.pointerEvents = 'none';
  }

  advance() {
    if (!this.active) return;
    if (this.showingChoices) return; // must make a choice to proceed
    if (this.currentStep && this.textIndex < this.currentStep.texts.length - 1) {
      this.textIndex++;
      this._renderText();
      if (this.currentStep.choices && this.textIndex === this.currentStep.texts.length - 1) {
        this._showChoices(this.currentStep);
      }
      return;
    }
    // No choices — step finished
    if (this.currentStep && !this.currentStep.choices && this.onStepComplete) {
      this.onStepComplete(this.currentNpc.questId, this.currentStep.id);
    }
    this.close();
  }

  _startStepForNpc() {
    // find the current active step for this npc's quest
    const npc = this.currentNpc;
    if (!npc || !npc.questId) {
      this.close();
      return;
    }
    const step = npc.currentStep;
    if (!step) {
      this.close();
      return;
    }
    this.currentStep = step;
    this.textIndex = 0;
    this.setNpcColors(npc.npcType);
    this._renderText();
    if (step.choices) {
      this._showChoices(step);
    }
  }

  update(delta) {
    // no per-frame logic needed; kept for system interface parity
  }

  dispose() {
    if (this.container?.parentNode) this.container.parentNode.removeChild(this.container);
  }
}
