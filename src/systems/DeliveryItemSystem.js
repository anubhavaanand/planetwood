import * as THREE from 'three';
import { debugWarn, debugError } from '../utils/debug.js';

// Delivery items carried by the player avatar. Models are loaded from the
// messenger.abeto delivery geometries (DRC/GLB) and rendered as a floating
// 3D object beside the avatar while carried. A delivery-bag UI panel lists
// everything currently carried.
//
// Quest flow:
//   - A step with extraData.receiveModel GRANTS the item (player receives it
//     from an NPC).
//   - The item is carried until the player completes the recipient's step,
//     at which point it is DELIVERED (removed from avatar + bag).
export class DeliveryItemSystem {
  constructor(scene, camera, renderer, playerAvatar, meshLoader) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.playerAvatar = playerAvatar;
    this.meshLoader = meshLoader;
    this.multiplayer = null;

    // Local player's carried items: modelId -> { mesh, modelId, stepId, questId, offset }
    this.carried = new Map();
    // Remote players' carried items: peerId -> Map<modelId, { mesh, modelId, offset, avatarGroup }>
    this.remoteCarried = new Map();
    this.bobTime = 0;

    // Friendly labels for the bag UI.
    this.labels = {
      note: 'Note',
      postcard: 'Postcard',
      clothes: 'Clean clothes',
      offering: 'Temple offering',
      letterwet: 'Wet letter',
      samplebox: 'Sample box',
    };

    this._buildBagUI();
  }

  // Wire up multiplayer so carried-item changes are broadcast to peers and
  // remote players' carried items are rendered locally.
  setMultiplayer(multiplayer) {
    this.multiplayer = multiplayer;
    if (multiplayer) {
      multiplayer.onRemoteCarriedItemsChange = (peerId, itemIds) => {
        this.setRemoteCarriedItems(peerId, itemIds);
      };
    }
  }

  // Called when a quest step grants an item (extraData.receiveModel). Loads
  // the model, attaches it to the avatar, and adds it to the bag UI.
  async receiveItem(modelId, stepId, questId) {
    if (!modelId) return;
    if (this.carried.has(modelId)) return;

    const mesh = await this._loadMesh(modelId);
    if (!mesh) return;

    mesh.name = 'delivery-' + modelId.split('/').pop().replace(/\.(drc|glb|obj)$/i, '');
    mesh.frustumCulled = false;

    // Scale the item down so it sits comfortably beside the avatar.
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 0.5 / maxDim;
      mesh.scale.set(scale, scale, scale);
    }

    // Float the item to the front-right of the avatar (chest height).
    const offset = new THREE.Vector3(0.5, 1.1, -0.4);
    mesh.position.copy(offset);

    this.playerAvatar.group.add(mesh);

    this.carried.set(modelId, { mesh, modelId, stepId, questId, offset });
    this._refreshBagUI();
    this._updatePanelVisibility();

    // Broadcast to peers so remote players can see this item.
    if (this.multiplayer) {
      this.multiplayer.setCarriedItems(this.carriedKeys());
    }
  }

  // Called when a carried item is delivered to its recipient. Removes it from
  // the avatar and the bag UI.
  deliverItem(modelId) {
    const entry = this.carried.get(modelId);
    if (!entry) return;
    if (entry.mesh && entry.mesh.parent) {
      entry.mesh.parent.remove(entry.mesh);
    }
    this.carried.delete(modelId);
    this._refreshBagUI();
    this._updatePanelVisibility();

    // Broadcast to peers so remote players see the item removed.
    if (this.multiplayer) {
      this.multiplayer.setCarriedItems(this.carriedKeys());
    }
  }

  // Return the list of carried modelIds for syncing over multiplayer.
  carriedKeys() {
    return Array.from(this.carried.keys());
  }

  // Deliver every carried item belonging to a quest, except one received on
  // the given step (so an item received and delivered in the same step isn't
  // immediately removed).
  deliverQuestItems(questId, exceptStepId) {
    for (const [modelId, entry] of this.carried.entries()) {
      if (entry.questId === questId && entry.stepId !== exceptStepId) {
        this.deliverItem(modelId);
      }
    }
  }

  // ---- Remote player carried items ----

  // Set the full carried-items list for a remote player. Adds new items and
  // removes ones no longer carried.
  setRemoteCarriedItems(peerId, itemIds) {
    const current = this.remoteCarried.get(peerId) || new Map();
    const next = new Map(itemIds.map(id => [id, null]));

    // Remove items no longer carried
    for (const [modelId] of current) {
      if (!next.has(modelId)) {
        this._removeRemoteCarriedItem(peerId, modelId);
      }
    }

    // Add new items
    for (const modelId of next.keys()) {
      if (!current.has(modelId)) {
        this._addRemoteCarriedItem(peerId, modelId);
      }
    }

    this.remoteCarried.set(peerId, next);
  }

  // Load and attach a carried-item mesh to a remote player's avatar group.
  _addRemoteCarriedItem(peerId, modelId) {
    const avatar = this.multiplayer?.players?.get(peerId);
    if (!avatar || !avatar.group) return;

    this._loadMesh(modelId).then(mesh => {
      if (!mesh) return;
      mesh.name = 'remote-delivery-' + modelId.split('/').pop().replace(/\.(drc|glb|obj)$/i, '');
      mesh.frustumCulled = false;

      const box = new THREE.Box3().setFromObject(mesh);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const scale = 0.5 / maxDim;
        mesh.scale.set(scale, scale, scale);
      }

      const offset = new THREE.Vector3(0.5, 1.1, -0.4);
      mesh.position.copy(offset);

      avatar.group.add(mesh);

      const entry = this.remoteCarried.get(peerId);
      if (entry) entry.set(modelId, { mesh, modelId, offset, avatarGroup: avatar.group });
    }).catch(() => {
      // Silent fail — remote item rendering is non-critical.
    });
  }

  // Remove a single carried-item mesh from a remote player's avatar.
  _removeRemoteCarriedItem(peerId, modelId) {
    const entry = this.remoteCarried.get(peerId);
    if (!entry) return;
    const item = entry.get(modelId);
    if (!item) return;
    if (item.mesh && item.mesh.parent) {
      item.mesh.parent.remove(item.mesh);
    }
    entry.delete(modelId);
  }

  // Clear all carried items for a remote player (e.g. on disconnect).
  clearRemoteCarriedItems(peerId) {
    const entry = this.remoteCarried.get(peerId);
    if (!entry) return;
    for (const [modelId, item] of entry) {
      if (item.mesh && item.mesh.parent) {
        item.mesh.parent.remove(item.mesh);
      }
    }
    entry.clear();
    this.remoteCarried.delete(peerId);
  }

  _buildBagUI() {
    const panel = document.createElement('div');
    panel.id = 'delivery-bag';
    Object.assign(panel.style, {
      position: 'fixed', bottom: '16px', left: '16px', width: '260px',
      background: '#fff', border: '3px solid #333', borderRadius: '10px',
      boxShadow: '0 8px 0 rgba(0,0,0,0.25)', zIndex: '270',
      fontFamily: "'Courier New', Courier, monospace",
      pointerEvents: 'auto', display: 'none',
    });

    const header = document.createElement('div');
    header.textContent = 'DELIVERY BAG';
    Object.assign(header.style, {
      padding: '12px 16px 8px', fontSize: '14px', fontWeight: '700',
      color: '#1a1a1a', borderBottom: '1px solid #ccc',
    });

    const list = document.createElement('div');
    list.id = 'delivery-bag-list';
    Object.assign(list.style, { padding: '10px 16px 16px', fontSize: '13px', lineHeight: '1.6' });

    const empty = document.createElement('div');
    empty.id = 'delivery-bag-empty';
    empty.textContent = '(empty)';
    Object.assign(empty.style, { color: '#999', fontSize: '12px', fontStyle: 'italic' });
    list.appendChild(empty);

    panel.appendChild(header);
    panel.appendChild(list);
    document.body.appendChild(panel);

    this.panel = panel;
    this.list = list;
    this.emptyEl = empty;
  }

  // Map a receiveModel value like 'deliveries/note.drc' to a loadable GLB URL
  // served from public/assets/. GLB is preferred; .drc falls back to DRACO.
  modelUrl(modelId) {
    if (!modelId) return null;
    const path = modelId.endsWith('.drc')
      ? modelId.replace(/\.drc$/, '.glb')
      : modelId;
    return './assets/' + path;
  }

  drcUrl(modelId) {
    if (!modelId) return null;
    return './assets/' + modelId;
  }

  // Load the mesh for a delivery model, preferring GLB and falling back to DRC.
  async _loadMesh(modelId) {
    const glbUrl = this.modelUrl(modelId);
    try {
      const gltf = await this.meshLoader.loadModel(glbUrl);
      let mesh = null;
      gltf.scene.traverse((child) => {
        if (!mesh && child.isMesh) mesh = child;
      });
      if (mesh) return mesh.clone();
      return gltf.scene.clone();
    } catch (e) {
      debugWarn
        ? debugWarn(`DeliveryItemSystem: GLB load failed for ${modelId}, trying DRC`, e)
        : console.warn(`DeliveryItemSystem: GLB load failed for ${modelId}`, e);
      try {
        const geo = await this.meshLoader.loadGeometry(this.drcUrl(modelId));
        const mat = new THREE.MeshStandardMaterial({
          color: 0xccaa88, roughness: 0.7, metalness: 0.1,
        });
        return new THREE.Mesh(geo, mat);
      } catch (e2) {
        debugError
          ? debugError(`DeliveryItemSystem: DRC load failed for ${modelId}`, e2)
          : console.error(`DeliveryItemSystem: DRC load failed for ${modelId}`, e2);
        return null;
      }
    }
  }

  _itemLabel(modelId) {
    const name = modelId.split('/').pop().replace(/\.(drc|glb|obj)$/i, '');
    return this.labels[name] || name;
  }

  _refreshBagUI() {
    this.list.innerHTML = '';
    if (this.carried.size === 0) {
      this.list.appendChild(this.emptyEl);
      this.emptyEl.style.display = '';
      return;
    }
    this.emptyEl.style.display = 'none';
    for (const [modelId, entry] of this.carried.entries()) {
      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: '6px', padding: '4px 6px',
        background: '#f5f5f5', borderRadius: '4px', fontSize: '12px',
      });
      const label = document.createElement('span');
      label.textContent = this._itemLabel(modelId);
      row.appendChild(label);
      this.list.appendChild(row);
    }
  }

  _updatePanelVisibility() {
    this.panel.style.display = this.carried.size ? '' : 'none';
  }

  // Per-frame bob + gentle rotation for each carried item so it feels alive.
  update(delta) {
    this.bobTime += delta;
    const bob = Math.sin(this.bobTime * 2.5) * 0.04;
    const tilt = Math.sin(this.bobTime) * 0.08;
    for (const entry of this.carried.values()) {
      if (!entry.mesh || !entry.mesh.parent) continue;
      entry.mesh.position.set(
        entry.offset.x,
        entry.offset.y + bob,
        entry.offset.z
      );
      entry.mesh.rotation.y = this.bobTime;
      entry.mesh.rotation.x = tilt;
    }
    // Animate remote players' carried items with the same bobbing effect.
    for (const entryMap of this.remoteCarried.values()) {
      for (const entry of entryMap.values()) {
        if (!entry.mesh || !entry.mesh.parent) continue;
        entry.mesh.position.set(
          entry.offset.x,
          entry.offset.y + bob,
          entry.offset.z
        );
        entry.mesh.rotation.y = this.bobTime;
        entry.mesh.rotation.x = tilt;
      }
    }
  }

  dispose() {
    if (this.panel?.parentNode) this.panel.parentNode.removeChild(this.panel);
    this.carried.clear();
    for (const entryMap of this.remoteCarried.values()) {
      for (const item of entryMap.values()) {
        if (item.mesh && item.mesh.parent) {
          item.mesh.parent.remove(item.mesh);
        }
      }
    }
    this.remoteCarried.clear();
  }
}
