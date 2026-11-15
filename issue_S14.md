## File: src/systems/SceneSystem.js:167-173

### Trigger
`loadScene(url)` at line 167 loads a GLTF scene and adds it to the scene, then calls `materialSystem.init()` and `materialSystem.applyShadersToScene()`.

### Impact
`materialSystem.init()` is async but `applyShadersToScene()` is called **without awaiting** the init completion. The shaders (waterMaterial, grassMaterial) are created inside `init()` at lines 182 and 218, but `applyShadersToScene()` at line 249-263 tries to assign them to meshes.

If `init()` hasn't finished creating the shader materials, `applyShadersToScene()` will find `this.waterMaterial` and `this.grassMaterial` as `undefined` — **shaders never applied**.

### Root Cause
Missing `await`:
```javascript
async loadScene(url) {
  const gltf = await this.gltfLoader.loadAsync(url);
  this.scene.add(gltf.scene);
  await this.materialSystem.init();      // awaits init
  this.materialSystem.applyShadersToScene(); // but this is sync, materials may not be ready
  return gltf;
}
```

Actually, `init()` is async and awaited, so materials should be ready. But `init()` has a try/catch for KTX2 loader that swallows errors — if KTX2 fails, `init()` still completes and materials are created. The real issue is different:

Looking at `applyShadersToScene()` at line 249-263:
```javascript
applyShadersToScene() {
  this.scene.traverse((obj) => {
    if (!obj.isMesh) return;
    const mat = obj.material;
    if (!mat || !mat.name) return;
    const name = mat.name.toLowerCase();

    if (name.startsWith('m_water') || name.includes('waterfall') || name.includes('inlet')) {
      obj.material = this.waterMaterial;
    }
    if (name.includes('grass') || name.includes('leaves') || name.includes('terrain') && name.includes('grass')) {
      obj.material = this.grassMaterial;
    }
  });
}
```

The condition at line 259 has **operator precedence bug**:
```javascript
name.includes('terrain') && name.includes('grass')
```
This is parsed as:
```javascript
(name.includes('grass')) || (name.includes('leaves')) || (name.includes('terrain') && name.includes('grass'))
```
So terrain without "grass" in name won't get grass material. But the intent seems to be: "terrain that is grassy" or "grass/leaves". The bug is the missing parentheses.

### Suggested Fix
Add explicit parentheses:
```javascript
if (name.includes('grass') || name.includes('leaves') || (name.includes('terrain') && name.includes('grass'))) {
  obj.material = this.grassMaterial;
}
```

Or better, separate conditions:
```javascript
const isGrass = name.includes('grass') || name.includes('leaves');
const isGrassyTerrain = name.includes('terrain') && name.includes('grass');
if (isGrass || isGrassyTerrain) {
  obj.material = this.grassMaterial;
}
```

### Verdict
**Suggestion** — operator precedence bug in material assignment condition; grass shader may not apply to intended meshes.
