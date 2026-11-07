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
    return leveledUp;
  }

  addCoins(amount) {
    this.coins += amount;
    if (this.onCoinsChange) this.onCoinsChange(this.coins);
  }

  // Delivery bag operations
  addToBag(itemId, npcType, displayName) {
    const item = { itemId, npcType, displayName, receivedAt: Date.now() };
    this.deliveryBag.push(item);
    if (this.onDeliveryItemAdded) this.onDeliveryItemAdded(item);
    return item;
  }

  removeFromBag(itemId) {
    const idx = this.deliveryBag.findIndex(i => i.itemId === itemId);
    if (idx === -1) return null;
    const item = this.deliveryBag.splice(idx, 1)[0];
    if (this.onDeliveryItemRemoved) this.onDeliveryItemRemoved(itemId);
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
