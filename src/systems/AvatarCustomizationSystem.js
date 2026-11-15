import * as THREE from 'three';
import { SHOP_CATALOG, findShopItem } from '../data/shop.js';

/**
 * AvatarCustomizationSystem
 *
 * Mix-and-match avatar accessories for the local player avatar.
 *
 * Accessories (hair, top, bottom, shoes) are loaded as plain meshes and
 * parented to the matching skeleton bone so they deform with the avatar
 * without needing skinIndex/skinWeight attributes (the asset set lacks them).
 *
 * Accessories are acquired through the coin shop (see src/data/shop.js).
 * Purchased items are tracked in `purchased` and can only be equipped when
 * owned (free cost-0 items are owned from the start). Customizations and
 * purchases persist to localStorage under key 'planetwood.avatar'.
 *
 * Bone map (from avatar-bones.drc, 22 bones):
 *   bone_0   hips      (root)
 *   bone_1-5  spine   -> head (bone_5)
 *   bone_6-9   right arm  -> hand (bone_9)
 *   bone_10-13 left arm   -> hand (bone_13)
 *   bone_14-17 right leg  -> foot (bone_17)
 *   bone_18-21 left leg   -> foot (bone_21)
 */
export class AvatarCustomizationSystem {
  /**
   * @param {import('../entities/PlayerAvatar.js').PlayerAvatar} avatar
   * @param {import('../systems/MeshLoader.js').MeshLoader} meshLoader
   * @param {import('../systems/AnimationSystem.js').AnimationSystem} animationSystem
   * @param {object} animData decoded animations JSON
   */
  constructor(avatar, meshLoader, animationSystem, animData) {
    this.avatar = avatar;
    this.meshLoader = meshLoader;
    this.animationSystem = animationSystem;
    this.animData = animData;

    // Equipped accessory per slot: { hair: 'hair3', top: 'top1', ... } or null
    this.equipped = { hair: null, top: null, bottom: null, shoes: null };
    // Purchased accessory ids (free cost-0 items are owned from the start).
    this.purchased = new Set();
    // Loaded accessory meshes currently attached to the avatar group
    this.accessoryMeshes = new Map(); // slot -> THREE.Mesh
    // Bone lookup by name, built once the skeleton exists
    this.boneByName = new Map();

    this.slotConfig = {
      hair:   { bone: 'bone_5',  files: 7,  prefix: 'hair' },
      top:    { bone: 'bone_0',  files: 9,  prefix: 'top' },
      bottom: { bone: 'bone_17', files: 7,  prefix: 'bottom' },
      shoes:  { bone: 'bone_21', files: 7,  prefix: 'shoes' },
    };

    this.baseUrl = './assets/avatar/accessories/';

    // Reputation-tier unlock requirements per slot.
    // minRep is the reputation points needed (with any NPC) to unlock the slot.
    this.slotUnlockRequirements = {
      hair:   { slot: 'hair',   minTier: 'Stranger',   minRep: 0 },
      top:    { slot: 'top',    minTier: 'Acquaintance', minRep: 10 },
      bottom: { slot: 'bottom', minTier: 'Friend',     minRep: 25 },
      shoes:  { slot: 'shoes',  minTier: 'Confidant',  minRep: 50 },
    };

    // Set externally (from main.js) once ProgressionSystem exists.
    this.progressionSys = null;
    // Callback: (slot, requirements) => void — UI shows a lock notification.
    this.onSlotLockRejected = null;
  }

  /**
   * Build the bone name -> bone map once the avatar has a skeleton.
   */
  _buildBoneMap() {
    this.boneByName.clear();
    const skeleton = this.avatar.skeleton;
    if (!skeleton) return;
    for (const bone of skeleton.bones) {
      this.boneByName.set(bone.name, bone);
    }
  }

  /**
   * Get the attachment bone for a slot, building the map lazily.
   * @returns {THREE.Bone|null}
   */
  _attachmentBone(slot) {
    if (this.boneByName.size === 0) this._buildBoneMap();
    const boneName = this.slotConfig[slot]?.bone;
    return boneName ? this.boneByName.get(boneName) || null : null;
  }

  /**
   * URL for an accessory file (prefers .glb, falls back to .drc).
   */
  _accessoryUrl(prefix, index) {
    const glb = `${this.baseUrl}${prefix}${index}.glb`;
    const drc = `${this.baseUrl}${prefix}${index}.drc`;
    return { glb, drc };
  }

  /**
   * Get the reputation-tier unlock requirement for a slot.
   * @returns {{slot:string, minTier:string, minRep:number}|null}
   */
  getSlotRequirements(slot) {
    return this.slotUnlockRequirements[slot] || null;
  }

  /**
   * Get unlock requirements for all slots.
   * @returns {{slot:string, minTier:string, minRep:number}[]}
   */
  getAllSlotRequirements() {
    return Object.values(this.slotUnlockRequirements);
  }

  /**
   * Check whether a slot is unlocked based on the player's reputation with any NPC.
   * A slot is unlocked when the player's highest per-NPC reputation meets or
   * exceeds the slot's minRep threshold.
   * @param {string} slot - 'hair' | 'top' | 'bottom' | 'shoes'
   * @returns {boolean}
   */
  isSlotUnlocked(slot) {
    const req = this.slotUnlockRequirements[slot];
    if (!req) return false;
    if (!this.progressionSys) return false; // no progression system wired — treat as locked
    let bestRep = 0;
    for (const rep of this.progressionSys.reputation.values()) {
      if (rep > bestRep) bestRep = rep;
    }
    return bestRep >= req.minRep;
  }

  /**
   * Equip an accessory for a slot. Removes any previously equipped item.
   * @param {string} slot - 'hair' | 'top' | 'bottom' | 'shoes'
   * @param {string|null} id - e.g. 'hair3' or null to unequip
   * @returns {Promise<boolean>}
   */
  async equip(slot, id) {
    if (!this.slotConfig[slot]) {
      console.warn('[AvatarCustomization] unknown slot', slot);
      return false;
    }

    // Unequipping (id === null) is always allowed.
    if (id !== null && !this.isSlotUnlocked(slot)) {
      const req = this.slotUnlockRequirements[slot];
      if (this.onSlotLockRejected) {
        this.onSlotLockRejected(slot, req);
      } else {
        console.warn(`[AvatarCustomization] slot ${slot} locked — need ${req.minTier} tier (${req.minRep} rep)`);
      }
      return false;
    }

    // Remove existing accessory mesh for this slot
    const existing = this.accessoryMeshes.get(slot);
    if (existing) {
      this.avatar.group.remove(existing);
      existing.traverse((c) => {
        if (c.isMesh) { c.geometry.dispose(); c.material.dispose(); }
      });
      this.accessoryMeshes.delete(slot);
    }

    this.equipped[slot] = id;
    if (!id) {
      this._save();
      return true;
    }

    const config = this.slotConfig[slot];
    const num = parseInt(id.replace(config.prefix, ''), 10);
    if (num < 1 || num > config.files) {
      console.warn('[AvatarCustomization] invalid accessory id', id, 'for slot', slot);
      return false;
    }

    const bone = this._attachmentBone(slot);
    if (!bone) {
      console.warn('[AvatarCustomization] no attachment bone for slot', slot);
      return false;
    }

    // Gate equipping on ownership: only owned accessories may be equipped.
    if (!this.isOwned(id)) {
      console.warn('[AvatarCustomization] accessory not owned', id);
      return false;
    }

    try {
      const mesh = await this._loadAccessoryMesh(slot, id);
      if (!mesh) return false;
      mesh.name = `${slot}-${id}`;
      mesh.frustumCulled = true;
      // Parent to the attachment bone so it moves/deforms with the avatar
      bone.add(mesh);
      this.accessoryMeshes.set(slot, mesh);
      this._save();
      return true;
    } catch (e) {
      console.error('[AvatarCustomization] failed to equip', id, e);
      return false;
    }
  }

  /**
   * Purchase an accessory. Deducts coins is handled by the caller
   * (ProgressionSystem). This system only records ownership and equips.
   * @param {string} id - accessory id, e.g. 'hair3'
   * @returns {Promise<boolean>} true if purchased/equipped successfully
   */
  async purchase(id) {
    const item = findShopItem(id);
    if (!item) {
      console.warn('[AvatarCustomization] unknown shop item', id);
      return false;
    }
    if (this.purchased.has(id)) {
      // Already owned — just equip it.
      return this.equip(item.slot, id);
    }
    this.purchased.add(id);
    this._save();
    return this.equip(item.slot, id);
  }

  /**
   * Check whether an accessory id is owned. Cost-0 / free items are owned
   * from the start; everything else must be in `purchased`.
   * @param {string|null} id
   * @returns {boolean}
   */
  isOwned(id) {
    if (!id) return true;
    const item = findShopItem(id);
    if (!item) return false;
    if (item.free || item.cost === 0) return true;
    return this.purchased.has(id);
  }

  /**
   * Load a single accessory mesh. Tries .glb first, then .drc fallback.
   */
  async _loadAccessoryMesh(slot, id) {
    const config = this.slotConfig[slot];
    const { glb, drc } = this._accessoryUrl(config.prefix, parseInt(id.replace(config.prefix, ''), 10));

    // Try GLTF/GLB first
    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(glb);
      const mesh = gltf.scene.children[0];
      if (mesh) {
        mesh.material = mesh.material || new THREE.MeshStandardMaterial({ color: 0xffffff });
        return mesh;
      }
    } catch (_e) {
      // fall through to DRC
    }

    // DRC fallback via MeshLoader (returns plain Mesh without skinning)
    try {
      return await this.meshLoader.createSkinnedMesh(drc, null);
    } catch (_e) {
      return null;
    }
  }

  /**
   * Get the currently equipped accessory id for a slot.
   */
  equippedId(slot) {
    return this.equipped[slot] || null;
  }

  /**
   * Apply a full customization object { hair, top, bottom, shoes }.
   */
  async apply(customization) {
    for (const slot of Object.keys(this.slotConfig)) {
      const id = customization[slot] || null;
      if (id !== this.equipped[slot]) {
        await this.equip(slot, id);
      }
    }
  }

  /**
   * Export the current customization as a plain object.
   */
  getCustomization() {
    return { ...this.equipped };
  }

  /**
   * Persist customization + purchases to localStorage.
   */
  _save() {
    try {
      const payload = {
        equipped: this.getCustomization(),
        purchased: Array.from(this.purchased),
      };
      localStorage.setItem('planetwood.avatar', JSON.stringify(payload));
    } catch (_e) {
      // localStorage may be unavailable/blocked — fail silently
    }
  }

  /**
   * Export customization + purchases as a plain object for save/load.
   */
  getState() {
    return { equipped: this.getCustomization(), purchased: Array.from(this.purchased) };
  }

  /**
   * Load customization + purchases from localStorage and apply them.
   * @returns {Promise<object>} the loaded customization (or defaults)
   */
  async load() {
    let saved = { equipped: {}, purchased: [] };
    try {
      const raw = localStorage.getItem('planetwood.avatar');
      if (raw) {
        const parsed = JSON.parse(raw);
        // Backwards compatibility: older saves stored just { hair, top, bottom, shoes }.
        saved.equipped = parsed.equipped || parsed;
        saved.purchased = parsed.purchased || [];
      }
    } catch (_e) {
      saved = { equipped: {}, purchased: [] };
    }
    this.purchased = new Set(saved.purchased);
    await this.apply(saved.equipped);
    return this.getCustomization();
  }
}
