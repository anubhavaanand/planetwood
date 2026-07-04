import * as THREE from 'three';

export class AnimationSystem {
  constructor() {
    this._skeletonCache = new Map();
  }

  findSkinEntry(animData, npcType) {
    const key = Object.keys(animData).find(k =>
      k.includes(`/${npcType}-bones.drc`) || k === `${npcType}-bones.drc`
    );
    return key ? animData[key] : null;
  }

  findAnimEntry(animData, npcType, animName) {
    const key = Object.keys(animData).find(k =>
      k.includes(`/${npcType}-${animName}.drc`) || k === `${npcType}-${animName}.drc`
    );
    return key ? animData[key] : null;
  }

  findAvatarBones(animData) {
    const key = Object.keys(animData).find(k => k.includes('/avatar-bones.drc'));
    return key ? animData[key] : null;
  }

  findAvatarAnim(animData, animName) {
    const key = Object.keys(animData).find(k => k.includes(`/avatar-${animName}.drc`));
    return key ? animData[key] : null;
  }

  getCachedSkin(cacheKey) {
    return this._skeletonCache.get(cacheKey) || null;
  }

  createSkin(boneData, cacheKey) {
    if (cacheKey && this._skeletonCache.has(cacheKey)) {
      return this._skeletonCache.get(cacheKey);
    }

    const attr = boneData.attributes;
    const boneCount = boneData.vertices;
    const posArr = attr.position?.array;
    const quatArr = attr.quaternion?.array;
    const scaleArr = attr.scale?.array;
    const hierArr = attr.hierarchy?.array;

    const bones = [];
    for (let i = 0; i < boneCount; i++) {
      const bone = new THREE.Bone();
      bone.name = `bone_${i}`;

      if (posArr) {
        const idx = i * 3;
        bone.position.set(posArr[idx], posArr[idx + 1], posArr[idx + 2]);
      }
      if (quatArr) {
        const idx = i * 4;
        bone.quaternion.set(quatArr[idx], quatArr[idx + 1], quatArr[idx + 2], quatArr[idx + 3]);
      }
      if (scaleArr) {
        const idx = i * 3;
        bone.scale.set(scaleArr[idx], scaleArr[idx + 1], scaleArr[idx + 2]);
      }
      bones.push(bone);
    }

    if (hierArr) {
      for (let i = 0; i < boneCount; i++) {
        const parentIdx = hierArr[i];
        if (parentIdx > 0 && parentIdx - 1 < boneCount) {
          bones[parentIdx - 1].add(bones[i]);
        }
      }
    }

    const skeleton = new THREE.Skeleton(bones);
    const result = { bones, skeleton };
    if (cacheKey) this._skeletonCache.set(cacheKey, result);
    return result;
  }

  createSkinAnimation(animData, skeleton) {
    const attr = animData.attributes;
    const userData = animData.info?.userData;
    const boneCount = animData.info?.boneCount || Math.floor(animData.vertices / (userData?.frames || 1));
    const frameCount = userData?.frames || 1;
    const fps = userData?.fps || 30;

    const posArr = attr.position?.array;
    const quatArr = attr.quaternion?.array;
    const scaleArr = attr.scale?.array;

    const times = new Float32Array(frameCount);
    for (let i = 0; i < frameCount; i++) {
      times[i] = i / fps;
    }

    const tracks = [];
    for (let b = 0; b < boneCount; b++) {
      if (posArr) {
        const values = new Float32Array(frameCount * 3);
        for (let f = 0; f < frameCount; f++) {
          const src = (f * boneCount + b) * 3;
          values[f * 3] = posArr[src];
          values[f * 3 + 1] = posArr[src + 1];
          values[f * 3 + 2] = posArr[src + 2];
        }
        tracks.push(new THREE.VectorKeyframeTrack(`bone_${b}.position`, times, values));
      }
      if (quatArr) {
        const values = new Float32Array(frameCount * 4);
        for (let f = 0; f < frameCount; f++) {
          const src = (f * boneCount + b) * 4;
          values[f * 4] = quatArr[src];
          values[f * 4 + 1] = quatArr[src + 1];
          values[f * 4 + 2] = quatArr[src + 2];
          values[f * 4 + 3] = quatArr[src + 3];
        }
        tracks.push(new THREE.QuaternionKeyframeTrack(`bone_${b}.quaternion`, times, values));
      }
      if (scaleArr) {
        const values = new Float32Array(frameCount * 3);
        for (let f = 0; f < frameCount; f++) {
          const src = (f * boneCount + b) * 3;
          values[f * 3] = scaleArr[src];
          values[f * 3 + 1] = scaleArr[src + 1];
          values[f * 3 + 2] = scaleArr[src + 2];
        }
        tracks.push(new THREE.VectorKeyframeTrack(`bone_${b}.scale`, times, values));
      }
    }

    const clip = new THREE.AnimationClip('animation', -1, tracks);
    const mixer = new THREE.AnimationMixer(skeleton.bones[0]?.parent || skeleton.bones[0]);

    for (const bone of skeleton.bones) {
      mixer._root?.add(bone);
    }

    return { clip, mixer, frameCount, fps };
  }
}
