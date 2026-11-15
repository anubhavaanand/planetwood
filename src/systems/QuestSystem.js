import { QUESTS, QUEST_LABELS, QUEST_NPC_TYPES } from '../data/quests.js';
import { ProgressionSystem } from './ProgressionSystem.js';

// Tracks messenger-style delivery quest progress. Drives the checklist UI and
// hands out the next dialogue step to the DialogueSystem.
export class QuestSystem {
  constructor(ui, progressionSys) {
    this.ui = ui; // QuestUI instance
    this.progressionSys = progressionSys; // ProgressionSystem instance
    this.quests = new Map();
    this.activeNpcs = new Map(); // npcType -> NPC entity whose quest is active
    this.carriedQuests = new Map(); // modelId -> { stepId, questId } items the player carries
    this.onItemReceived = null;   // (extraData) => void, set by main -> DeliveryItemSystem.receiveItem
    this.onItemDelivered = null;  // (modelId) => void, set by main -> DeliveryItemSystem.deliverItem
    // Branch flags persist per quest: questId -> { branch: tag, ... } so later
    // steps/dialogue can reference which branch the player took.
    this.branchFlags = new Map();
    // Endgame (prestige) state: street quests completed in the current cycle.
    // quest-planet is a narrative bonus and does not count toward the threshold.
    this.questsCompletedThisCycle = 0;
    this.PRESTIGE_THRESHOLD = 5;
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
          branch: s.branch,
          texts: s.texts,
          branchTexts: s.branchTexts,
          choices: s.choices,
          extraData: s.extraData,
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

  // Resolve a next step after a player choice. Finds the step by id in the
  // given quest, sets it as the NPC's current step, and returns the step data
  // for the DialogueSystem to render. Also tracks which branch was taken,
  // applies branch-specific reputation rewards, and marks non-chosen branch
  // steps as completed so linear progression doesn't traverse them.
  selectNextStep(questId, nextStepId, branchTag) {
    const q = this.quests.get(questId);
    if (!q) return null;
    const step = q.steps.find(s => s.id === nextStepId);
    if (!step) return null;

    // Track which branch was taken (persistent flag for later steps/dialogue).
    if (branchTag) {
      const flags = this.branchFlags.get(questId) || {};
      flags.branch = branchTag;
      flags.branchStep = step.id;
      this.branchFlags.set(questId, flags);
    }

    // Handle item receipt/delivery for the choice step, since completeStep
    // is not called for steps with choices (DialogueSystem uses onStepChoice).
    const currentStep = q.steps[q.currentStepIndex];
    const modelJustReceived = currentStep?.extraData?.receiveModel;
    if (modelJustReceived && this.onItemReceived) {
      this.onItemReceived(currentStep.extraData, currentStep.id, questId);
      this.carriedQuests.set(modelJustReceived, { stepId: currentStep.id, questId });
    }
    if (this.onItemDelivered) {
      const toDeliver = [];
      for (const [modelId, entry] of this.carriedQuests.entries()) {
        if (entry.questId === questId && modelId !== modelJustReceived) {
          toDeliver.push(modelId);
        }
      }
      for (const modelId of toDeliver) {
        this.onItemDelivered(modelId, this.carriedQuests.get(modelId)?.stepId, questId);
        this.carriedQuests.delete(modelId);
      }
    }

    // Apply branch-specific reputation rewards for the boss quest choice.
    const branchRewards = {
      promote: { npcType: 'boss', amount: 25 },
      apologize: { npcType: 'office-worker', amount: 10 },
      silent: null,
    };
    const reward = branchRewards[branchTag];
    if (reward && this.progressionSys) {
      this.progressionSys.addReputation(reward.npcType, reward.amount);
    }

    // Mark steps on non-chosen branches as completed so the checklist and
    // linear progression don't traverse steps the player will never see.
    // A step is skipped if it is the target, the terminal step (reachable
    // from any branch), or belongs to the same branch as the choice.
    const targetIndex = q.steps.findIndex(s => s.id === nextStepId);
    if (targetIndex !== -1) {
      q.steps.forEach((s, i) => {
        const isSameBranch = s.branch && s.branch === branchTag;
        if (i !== targetIndex && i !== q.steps.length - 1 && !isSameBranch && !s.completed) {
          s.completed = true;
        }
      });
      q.currentStepIndex = targetIndex;
    }

    // Find the NPC associated with this step's npc type
    const npc = this.activeNpcs.get(step.npc);
    if (npc) {
      npc.currentStep = step;
      npc.questId = questId;
      npc.displayName = npc.displayName || step.npc;
    }

    return {
      id: step.id,
      texts: this.getStepTexts(questId, step),
      choices: step.choices,
      extraData: step.extraData,
      questId: q.id,
      npcType: step.npc,
      branchTag,
    };
  }

  // Query which branch was taken for a quest (e.g. 'promote', 'apologize',
  // 'silent'). Returns undefined if no branch has been recorded.
  getBranch(questId) {
    const flags = this.branchFlags.get(questId);
    return flags ? flags.branch : undefined;
  }

  // Return the dialogue texts to use for a step, applying any branch-specific
  // override defined on the step's branchTexts map based on the recorded branch
  // flag for the given quest. Falls back to step.texts when no override exists
  // for the active branch.
  getStepTexts(questId, step) {
    const branch = this.getBranch(questId);
    if (branch && step.branchTexts && step.branchTexts[branch]) {
      return step.branchTexts[branch];
    }
    return step.texts;
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
        texts: this.getStepTexts(q.id, step),
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

    const modelJustReceived = step.extraData?.receiveModel;

    // delivery item received on this step? hand it to the DeliveryItemSystem
    if (modelJustReceived && this.onItemReceived) {
      this.onItemReceived(step.extraData, step.id, q.id);
      this.carriedQuests.set(modelJustReceived, { stepId: step.id, questId: q.id });
    }

    // deliver any carried items belonging to this quest, except the one
    // just received above (it will be carried forward to its recipient step).
    if (this.onItemDelivered) {
      const toDeliver = [];
      for (const [modelId, entry] of this.carriedQuests.entries()) {
        if (entry.questId === q.id && modelId !== modelJustReceived) {
          toDeliver.push(modelId);
        }
      }
      for (const modelId of toDeliver) {
        this.onItemDelivered(modelId, this.carriedQuests.get(modelId)?.stepId, q.id);
        this.carriedQuests.delete(modelId);
      }
    }

    if (q.currentStepIndex >= q.steps.length) {
      q.completed = true;
      // Award progression rewards for completed quest
      const npcType = q.steps[q.steps.length - 1]?.npc || 'unknown';
      const reward = this.progressionSys.completeQuest(q.id, npcType);
      // Track endgame cycle progress (street quests only; quest-planet is narrative).
      if (q.id !== 'quest-planet') {
        this.incrementCompletedCycle();
      }
      if (this.ui.onQuestCompleted) {
        this.ui.onQuestCompleted(q.id, reward);
      }
    } else {
      // Skip any steps already marked completed (e.g. non-chosen branch steps
      // marked during selectNextStep) so linear progression doesn't get stuck.
      let nextIdx = q.currentStepIndex;
      while (nextIdx < q.steps.length && q.steps[nextIdx].completed) {
        nextIdx++;
      }
      if (nextIdx >= q.steps.length) {
        q.completed = true;
        const npcType = q.steps[q.steps.length - 1]?.npc || 'unknown';
        const reward = this.progressionSys.completeQuest(q.id, npcType);
        // Track endgame cycle progress (street quests only; quest-planet is narrative).
        if (q.id !== 'quest-planet') {
          this.incrementCompletedCycle();
        }
        if (this.ui.onQuestCompleted) {
          this.ui.onQuestCompleted(q.id, reward);
        }
      } else {
        q.currentStepIndex = nextIdx;
      }
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

  // --- Endgame (prestige) -------------------------------------------------

  // Returns how many street quests are completed in the current cycle, the
  // threshold for unlocking prestige, and whether prestige is available.
  getPrestigeStatus() {
    return {
      questsCompletedThisCycle: this.questsCompletedThisCycle,
      threshold: this.PRESTIGE_THRESHOLD,
      available: this.questsCompletedThisCycle >= this.PRESTIGE_THRESHOLD,
    };
  }

  // Called by ProgressionSystem.completeQuest after each street quest completion.
  // Increments the cycle counter and returns true when the prestige threshold
  // is reached (and prestige has not already been triggered this cycle).
  incrementCompletedCycle() {
    this.questsCompletedThisCycle++;
    return this.getPrestigeStatus().available;
  }

  // Prestige: reset every street quest (quest-planet excluded) so they can be
  // replayed. Player keeps level, coins, and reputation via ProgressionSystem.
  // Returns { ok, reason } or { ok: true, questsReset }.
  prestigeResetQuests() {
    if (this.questsCompletedThisCycle < this.PRESTIGE_THRESHOLD) {
      return {
        ok: false,
        reason: `Complete ${this.PRESTIGE_THRESHOLD} quests before prestiging (${this.questsCompletedThisCycle} done).`,
      };
    }

    let reset = 0;
    for (const [id, q] of this.quests) {
      // quest-planet is a one-off narrative quest — never reset it.
      if (id === 'quest-planet') continue;
      q.completed = false;
      q.currentStepIndex = 0;
      for (const step of q.steps) {
        step.completed = false;
      }
      reset++;
    }

    this.questsCompletedThisCycle = 0;
    this.ui.setQuests(this.quests);
    return { ok: true, questsReset: reset };
  }
}
