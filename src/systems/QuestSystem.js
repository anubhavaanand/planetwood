import { QUESTS, QUEST_LABELS, QUEST_NPC_TYPES } from '../data/quests.js';

// Tracks messenger-style delivery quest progress. Drives the checklist UI and
// hands out the next dialogue step to the DialogueSystem.
export class QuestSystem {
  constructor(ui) {
    this.ui = ui; // QuestUI instance
    this.quests = new Map();
    this.activeNpcs = new Map(); // npcType -> NPC entity whose quest is active
    this._initQuestState();
  }

  _initQuestState() {
    for (const q of QUESTS) {
      this.quests.set(q.id, {
        id: q.id,
        description: q.description,
        color: q.color,
        currentStepIndex: 0,
        completed: false,
        steps: q.steps.map((s) => ({
          id: s.id,
          npc: s.npc,
          ordered: s.ordered,
          completed: false,
        })),
      });
    }
    this.ui.setQuests(this.quests);
  }

  // Call once NPCs are loaded; links quest steps to the in-world NPC entities.
  registerNpc(npc) {
    const type = npc.npcType;
    for (const [stepNpcType] of Object.entries(QUEST_NPC_TYPES)) {
      if (stepNpcType === type) {
        // find all quest steps pointing at this npc type
        for (const q of this.quests.values()) {
          for (const step of q.steps) {
            if (step.npc === type && !step.completed) {
              // mark first uncompleted step of each quest as "available" to this npc
              const existing = this.activeNpcs.get(type);
              if (!existing) {
                this.activeNpcs.set(type, npc);
                break;
              }
            }
          }
        }
      }
    }
  }

  // Attempt to start/advance dialogue with an NPC. Returns the dialogue step
  // (texts, extraData) or null if this NPC has nothing to say right now.
  interact(npc) {
    const type = npc.npcType;
    // find the quest + step this npc owns that is next-in-line
    for (const q of this.quests.values()) {
      if (q.completed) continue;
      const step = q.steps[q.currentStepIndex];
      if (!step || step.completed) continue;
      if (step.npc !== type) continue;

      // attach quest context to npc for the dialogue system
      npc.questId = q.id;
      npc.currentStep = step;
      npc.displayName = npc.displayName || step.npc;

      return {
        id: step.id,
        texts: step.texts,
        extraData: step.extraData,
        questId: q.id,
        npcType: step.npc,
      };
    }
    return null;
  }

  // Called by DialogueSystem when a step's dialogue finishes.
  completeStep(questId, stepId) {
    const q = this.quests.get(questId);
    if (!q || q.completed) return;
    const step = q.steps[q.currentStepIndex];
    if (!step || step.id !== stepId) return;

    step.completed = true;
    q.currentStepIndex++;

    // delivery item received? show receive toast handled by UI via extraData
    if (step.extraData?.receiveModel && this.ui.onItemReceived) {
      this.ui.onItemReceived(step.extraData);
    }

    if (q.currentStepIndex >= q.steps.length) {
      q.completed = true;
      if (this.ui.onQuestCompleted) this.ui.onQuestCompleted(q.id);
    }

    this.ui.setQuests(this.quests);
  }

  getProgress(questId) {
    const q = this.quests.get(questId);
    if (!q) return null;
    const done = q.steps.filter((s) => s.completed).length;
    return { total: q.steps.length, done, completed: q.completed };
  }

  getActiveStep(questId) {
    const q = this.quests.get(questId);
    if (!q || q.completed) return null;
    return q.steps[q.currentStepIndex] || null;
  }
}
