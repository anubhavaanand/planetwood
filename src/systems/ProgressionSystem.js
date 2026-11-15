// Reputation + XP + Currency progression system for Planetwood.
// Tracks per-NPC reputation, player level, XP, and coins earned from deliveries.

export const XP_PER_LEVEL = 100;
export const REPUTATION_TIERS = [
  { name: 'Stranger', min: 0 },
  { name: 'Acquaintance', min: 10 },
  { name: 'Friend', min: 25 },
  { name: 'Confidant', min: 50 },
  { name: 'Best Friend', min: 100 },
];

const STORAGE_KEY = 'planetwood.progression';
const STORAGE_VERSION = 1;

export class ProgressionSystem {
  constructor() {
    // Per-NPC reputation points
    this.reputation = new Map(); // npcType -> number
    // Player level and XP
    this.level = 1;
    this.xp = 0;
    this.xpToNext = XP_PER_LEVEL;
    // Currency
    this.coins = 0;
    // Delivery bag: items currently carried
    this.deliveryBag = []; // [{ itemId, npcType, displayName }]
    // Callbacks
    this.onReputationChange = null; // (npcType, rep, tier) => void
    this.onLevelUp = null; // (oldLevel, newLevel) => void
    this.onCoinsChange = null; // (coins) => void
    this.onDeliveryItemAdded = null; // (item) => void
    this.onDeliveryItemRemoved = null; // (itemId) => void
  }

  _defaultState() {
    return {
      reputation: {},
      level: 1,
      xp: 0,
      xpToNext: XP_PER_LEVEL,
      coins: 0,
    };
  }

  // Serialize progression state to localStorage.
  save() {
    if (typeof localStorage === 'undefined') return;
    try {
      const payload = {
        version: STORAGE_VERSION,
        reputation: Object.fromEntries(this.reputation),
        level: this.level,
        xp: this.xp,
        xpToNext: this.xpToNext,
        coins: this.coins,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // localStorage unavailable or quota exceeded — silently ignore
    }
  }

  // Deserialize persisted progression from localStorage and apply it to this
  // instance. Returns the loaded state (defaults when nothing is saved or the
  // saved format is unrecognized, e.g. after a schema migration).
  load() {
    let state = null;
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        state = raw ? JSON.parse(raw) : null;
      }
    } catch {
      state = null;
    }

    if (!state || state.version !== STORAGE_VERSION) {
      state = this._defaultState();
    }

    this.reputation = new Map(
      Object.entries(
        state.reputation && typeof state.reputation === 'object' ? state.reputation : {}
      )
    );
    this.level = typeof state.level === 'number' ? state.level : 1;
    this.xp = typeof state.xp === 'number' ? state.xp : 0;
    this.xpToNext = typeof state.xpToNext === 'number' ? state.xpToNext : XP_PER_LEVEL;
    this.coins = typeof state.coins === 'number' ? state.coins : 0;

    return state;
  }

  getReputation(npcType) {
    return this.reputation.get(npcType) || 0;
  }

  getTier(npcType) {
    const rep = this.getReputation(npcType);
    for (let i = REPUTATION_TIERS.length - 1; i >= 0; i--) {
      if (rep >= REPUTATION_TIERS[i].min) return REPUTATION_TIERS[i];
    }
    return REPUTATION_TIERS[0];
  }

  addReputation(npcType, amount) {
    const current = this.getReputation(npcType);
    const newRep = current + amount;
    this.reputation.set(npcType, newRep);
    const tier = this.getTier(npcType);
    if (this.onReputationChange) this.onReputationChange(npcType, newRep, tier);
    this.save();
    return tier;
  }

  addXP(amount) {
    this.xp += amount;
    let leveledUp = false;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = Math.floor(XP_PER_LEVEL * Math.pow(1.5, this.level - 1));
      leveledUp = true;
    }
    if (leveledUp && this.onLevelUp) {
      this.onLevelUp(this.level - (leveledUp ? 1 : 0), this.level);
    }
    this.save();
    return leveledUp;
  }

  addCoins(amount) {
    this.coins += amount;
    if (this.onCoinsChange) this.onCoinsChange(this.coins);
    this.save();
  }

  // Delivery bag operations
  addToBag(itemId, npcType, displayName) {
    const item = { itemId, npcType, displayName, receivedAt: Date.now() };
    this.deliveryBag.push(item);
    if (this.onDeliveryItemAdded) this.onDeliveryItemAdded(item);
    this.save();
    return item;
  }

  removeFromBag(itemId) {
    const idx = this.deliveryBag.findIndex(i => i.itemId === itemId);
    if (idx === -1) return null;
    const item = this.deliveryBag.splice(idx, 1)[0];
    if (this.onDeliveryItemRemoved) this.onDeliveryItemRemoved(itemId);
    this.save();
    return item;
  }

  hasItem(itemId) {
    return this.deliveryBag.some(i => i.itemId === itemId);
  }

  getBag() {
    return this.deliveryBag;
  }

  // Quest completion reward
  completeQuest(questId, npcType) {
    const rewardXP = 50;
    const rewardCoins = 25;
    const rewardRep = 10;

    this.addXP(rewardXP);
    this.addCoins(rewardCoins);
    const tier = this.addReputation(npcType, rewardRep);

    return {
      xp: rewardXP,
      coins: rewardCoins,
      reputation: rewardRep,
      npcType,
      tier,
      level: this.level,
      totalCoins: this.coins,
    };
  }
}
