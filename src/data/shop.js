// Coin-sink shop catalog for Planetwood avatar accessories.
//
// Each entry describes one purchasable accessory:
//   id        - matches AvatarCustomizationSystem accessory id, e.g. 'hair3'
//   slot      - 'hair' | 'top' | 'bottom' | 'shoes'
//   cost      - coin price to purchase
//   requiredLevel - minimum player level to buy
//   label     - human-readable display name
//   free      - when true, the item is owned from the start (no purchase needed)
//
// Design notes:
// - Quest completions award 25 coins (ProgressionSystem.completeQuest), so the
//   cheapest purchasable items cost ~2 quests and top-tier items require many
//   deliveries — a deliberate coin sink to give earned coins a purpose.
// - Level gating gates long-term goals behind play time, not just coin grinding.
export const SHOP_CATALOG = [
  // ----- Hair (slotConfig: files 7, prefix 'hair') -----
  { id: 'hair1', slot: 'hair', cost: 0, requiredLevel: 1, label: 'Short Cut', free: true },
  { id: 'hair2', slot: 'hair', cost: 30, requiredLevel: 2, label: 'Messy Bun' },
  { id: 'hair3', slot: 'hair', cost: 50, requiredLevel: 2, label: 'Curly Mop' },
  { id: 'hair4', slot: 'hair', cost: 80, requiredLevel: 4, label: 'Side Part' },
  { id: 'hair5', slot: 'hair', cost: 120, requiredLevel: 5, label: 'Long Waves' },
  { id: 'hair6', slot: 'hair', cost: 180, requiredLevel: 7, label: 'Pixie Cut' },
  { id: 'hair7', slot: 'hair', cost: 250, requiredLevel: 9, label: 'Mohawk' },

  // ----- Top (slotConfig: files 9, prefix 'top') -----
  { id: 'top1', slot: 'top', cost: 0, requiredLevel: 1, label: 'Tee', free: true },
  { id: 'top2', slot: 'top', cost: 75, requiredLevel: 3, label: 'Polo' },
  { id: 'top3', slot: 'top', cost: 110, requiredLevel: 4, label: 'Hoodie' },
  { id: 'top4', slot: 'top', cost: 160, requiredLevel: 5, label: 'Blazer' },
  { id: 'top5', slot: 'top', cost: 220, requiredLevel: 6, label: 'Vest' },
  { id: 'top6', slot: 'top', cost: 300, requiredLevel: 8, label: 'Leather Jacket' },
  { id: 'top7', slot: 'top', cost: 400, requiredLevel: 10, label: 'Tuxedo' },
  { id: 'top8', slot: 'top', cost: 550, requiredLevel: 12, label: 'Cape' },
  { id: 'top9', slot: 'top', cost: 750, requiredLevel: 15, label: 'Robes' },

  // ----- Bottom (slotConfig: files 7, prefix 'bottom') -----
  { id: 'bottom1', slot: 'bottom', cost: 0, requiredLevel: 1, label: 'Pants', free: true },
  { id: 'bottom2', slot: 'bottom', cost: 40, requiredLevel: 2, label: 'Shorts' },
  { id: 'bottom3', slot: 'bottom', cost: 70, requiredLevel: 3, label: 'Jeans' },
  { id: 'bottom4', slot: 'bottom', cost: 100, requiredLevel: 4, label: 'Cargo Pants' },
  { id: 'bottom5', slot: 'bottom', cost: 150, requiredLevel: 6, label: 'Skirt' },
  { id: 'bottom6', slot: 'bottom', cost: 220, requiredLevel: 8, label: 'Trousers' },
  { id: 'bottom7', slot: 'bottom', cost: 320, requiredLevel: 10, label: 'Cape Skirt' },

  // ----- Shoes (slotConfig: files 7, prefix 'shoes') -----
  { id: 'shoes1', slot: 'shoes', cost: 0, requiredLevel: 1, label: 'Sneakers', free: true },
  { id: 'shoes2', slot: 'shoes', cost: 35, requiredLevel: 2, label: 'Boots' },
  { id: 'shoes3', slot: 'shoes', cost: 60, requiredLevel: 3, label: 'Loafers' },
  { id: 'shoes4', slot: 'shoes', cost: 90, requiredLevel: 4, label: 'High-tops' },
  { id: 'shoes5', slot: 'shoes', cost: 140, requiredLevel: 6, label: 'Heels' },
  { id: 'shoes6', slot: 'shoes', cost: 200, requiredLevel: 8, label: 'Work Boots' },
  { id: 'shoes7', slot: 'shoes', cost: 280, requiredLevel: 10, label: 'Gloves' },
];

/** Look up an accessory by id. Returns undefined when not found. */
export function findShopItem(id) {
  return SHOP_CATALOG.find((item) => item.id === id);
}

/** All shop items for a given slot. */
export function getShopItemsBySlot(slot) {
  return SHOP_CATALOG.filter((item) => item.slot === slot);
}

/** All slots represented in the catalog, in display order. */
export const SHOP_SLOTS = ['hair', 'top', 'bottom', 'shoes'];
