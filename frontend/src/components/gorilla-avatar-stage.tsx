"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import type { Group, Material, Object3D } from "three";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

export type AvatarMode = "idle" | "listening" | "thinking" | "speaking";

type GorillaAvatarStageProps = {
  mode: AvatarMode;
};

type GLTFAsset = {
  animations: THREE.AnimationClip[];
  scene: Group;
};

type BoneKey = "head" | "jaw";

type ActionName = "gorillaidle" | "gorillarun" | "gorillastomp" | "gorillaattack";

const gorillaModelUrl = new URL("../../assets/models/gorilla.glb", import.meta.url).toString();
const jawOpenQuaternion = new THREE.Quaternion(0.0619, 0.0183, 0.7448, 0.6641).normalize();
const interactiveAnimationNames: ActionName[] = ["gorillastomp"];

export default function GorillaAvatarStage({ mode }: GorillaAvatarStageProps) {
  return (
    <Canvas
      camera={{ fov: 30, position: [0.35, 1.5, 10.9] }}
      dpr={[1, 1.6]}
      gl={{ alpha: true, antialias: true }}
    >
      <fog attach="fog" args={["#eef4ea", 9, 17]} />
      <ambientLight intensity={2.6} color="#fff8ef" />
      <hemisphereLight args={["#fff8ef", "#ceddcf", 2.4]} position={[0, 6, 0]} />
      <directionalLight castShadow color="#ffd8b5" intensity={3.1} position={[3.5, 8, 6]} />
      <spotLight
        angle={0.46}
        color="#ffb27b"
        intensity={28}
        penumbra={0.95}
        position={[-2.5, 4.6, 5.5]}
      />
      <pointLight color="#fff5e2" intensity={9} position={[0, 1.8, 4.2]} />
      <SceneBackdrop />
      <Suspense fallback={null}>
        <GorillaModel mode={mode} />
      </Suspense>
    </Canvas>
  );
}

function SceneBackdrop() {
  return (
    <group>
      <mesh position={[0, 0.45, -5.2]}>
        <circleGeometry args={[5.6, 64]} />
        <meshBasicMaterial color="#dce9db" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0.05, 0.62, -5]}>
        <circleGeometry args={[3.25, 64]} />
        <meshBasicMaterial color="#ffbf8a" transparent opacity={0.3} />
      </mesh>
      <mesh position={[0, -2.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[6.4, 64]} />
        <meshStandardMaterial
          color="#d7e4d5"
          emissive="#dce7da"
          roughness={0.98}
          metalness={0.03}
        />
      </mesh>
      <mesh position={[0, -2.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.7, 3.9, 64]} />
        <meshBasicMaterial color="#f6b27a" transparent opacity={0.24} />
      </mesh>
    </group>
  );
}

function GorillaModel({ mode }: GorillaAvatarStageProps) {
  const gltf = useLoader(GLTFLoader, gorillaModelUrl) as GLTFAsset;
  const wrapperRef = useRef<Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const activeInteractiveActionRef = useRef<THREE.AnimationAction | null>(null);
  const actionsRef = useRef<Partial<Record<ActionName, THREE.AnimationAction>>>({});
  const boneRefs = useRef<Record<BoneKey, Object3D | null>>({
    head: null,
    jaw: null,
  });
  const boneBaseRef = useRef<Partial<Record<BoneKey, THREE.Quaternion>>>({});

  const scene = useMemo(() => {
    const clonedScene = cloneSkeleton(gltf.scene) as Group;

    clonedScene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;

        const material = mesh.material as Material | Material[];
        if (Array.isArray(material)) {
          material.forEach(tuneMaterial);
        } else if (material) {
          tuneMaterial(material);
        }
      }
    });

    const bounds = new THREE.Box3().setFromObject(clonedScene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);

    const targetHeight = 0.35;
    const scaleFactor = targetHeight / Math.max(size.y, 0.001);
    clonedScene.scale.setScalar(scaleFactor);
    clonedScene.position.set(
      -center.x * scaleFactor,
      -bounds.min.y * scaleFactor,
      -center.z * scaleFactor,
    );

    return clonedScene;
  }, [gltf.scene]);

  const clips = useMemo(() => sanitizeAnimationClips(gltf.animations), [gltf.animations]);

  useEffect(() => {
    setBone(boneRefs, boneBaseRef, "jaw", scene.getObjectByName("Bone01_026") ?? null);
    setBone(boneRefs, boneBaseRef, "head", scene.getObjectByName("Bip01 Head_024") ?? null);
  }, [scene]);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(scene);
    const actions: Partial<Record<ActionName, THREE.AnimationAction>> = {};

    for (const clip of clips) {
      const name = clip.name as ActionName;
      const action = mixer.clipAction(clip);

      if (name === "gorillaidle") {
        action.enabled = true;
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.setEffectiveTimeScale(0.92);
        action.setEffectiveWeight(1);
        action.play();
      } else if (name === "gorillarun") {
        action.enabled = true;
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.setEffectiveTimeScale(0.48);
        action.setEffectiveWeight(0);
        action.play();
      } else {
        action.enabled = false;
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = false;
        action.setEffectiveTimeScale(name === "gorillaattack" ? 0.94 : 0.82);
        action.setEffectiveWeight(0);
      }

      actions[name] = action;
    }

    const handleFinished = (event: { action?: THREE.AnimationAction }) => {
      const finishedAction = event.action;
      if (!finishedAction || activeInteractiveActionRef.current !== finishedAction) {
        return;
      }

      finishedAction.stop();
      finishedAction.enabled = false;
      finishedAction.setEffectiveWeight(0);
      activeInteractiveActionRef.current = null;
    };

    mixer.addEventListener("finished", handleFinished as never);
    mixerRef.current = mixer;
    actionsRef.current = actions;

    return () => {
      mixer.removeEventListener("finished", handleFinished as never);
      mixer.stopAllAction();
      actionsRef.current = {};
      activeInteractiveActionRef.current = null;
      mixerRef.current = null;
    };
  }, [clips, scene]);

  useFrame((state, delta) => {
    mixerRef.current?.update(delta);

    const idleAction = actionsRef.current.gorillaidle;
    const speakingAction = actionsRef.current.gorillarun;
    const interactiveAction = activeInteractiveActionRef.current;
    const hasInteractiveAnimation = Boolean(interactiveAction);

    dampActionWeight(
      idleAction,
      hasInteractiveAnimation ? 0.18 : mode === "speaking" ? 0.36 : 1,
      delta,
      6.5,
    );
    dampActionWeight(
      speakingAction,
      !hasInteractiveAnimation && mode === "speaking" ? 0.96 : 0,
      delta,
      7.5,
    );

    const elapsed = state.clock.elapsedTime;
    const breathe = Math.sin(elapsed * 1.1) * 0.018;
    const thinkTilt = mode === "thinking" ? Math.sin(elapsed * 1.2) * 0.02 : 0;
    const speakBounce =
      mode === "speaking" ? Math.abs(Math.sin(elapsed * 3.1)) * 0.035 : 0;
    const speakHead = mode === "speaking" ? Math.sin(elapsed * 2.8) * 0.04 : 0;

    if (wrapperRef.current) {
      wrapperRef.current.position.x = THREE.MathUtils.lerp(
        wrapperRef.current.position.x,
        0.72,
        0.08,
      );
      wrapperRef.current.position.y = THREE.MathUtils.lerp(
        wrapperRef.current.position.y,
        -1.92 + breathe + speakBounce * 0.5,
        0.08,
      );
      wrapperRef.current.position.z = THREE.MathUtils.lerp(
        wrapperRef.current.position.z,
        0,
        0.08,
      );
      wrapperRef.current.rotation.x = THREE.MathUtils.lerp(
        wrapperRef.current.rotation.x,
        thinkTilt * 0.35,
        0.08,
      );
      wrapperRef.current.rotation.y = THREE.MathUtils.lerp(
        wrapperRef.current.rotation.y,
        0.24,
        0.08,
      );
      wrapperRef.current.rotation.z = THREE.MathUtils.lerp(
        wrapperRef.current.rotation.z,
        0,
        0.08,
      );
    }

    if (boneRefs.current.head && boneBaseRef.current.head) {
      applyBoneOffset(
        boneRefs.current.head,
        boneBaseRef.current.head,
        new THREE.Euler(speakHead * 0.18, speakHead * 0.4, 0, "XYZ"),
        0.16,
      );
    }

    if (boneRefs.current.jaw && boneBaseRef.current.jaw) {
      const openAmount =
        mode === "speaking"
          ? Math.min(1, 0.26 + Math.abs(Math.sin(elapsed * 7.8)) * 0.46)
          : 0;
      const targetQuaternion = boneBaseRef.current.jaw
        .clone()
        .slerp(jawOpenQuaternion, openAmount);
      boneRefs.current.jaw.quaternion.slerp(targetQuaternion, 0.22);
    }

    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, 0.35, delta * 1.4);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, 1.5, delta * 1.4);
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, 10.9, delta * 1.4);
    state.camera.lookAt(0.72, 0.46, 0);
  });

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();

    const availableActions = interactiveAnimationNames.filter((name) => actionsRef.current[name]);
    if (availableActions.length === 0) {
      return;
    }

    const nextName =
      availableActions[Math.floor(Math.random() * availableActions.length)] ?? null;
    const nextAction = nextName ? actionsRef.current[nextName] : null;
    if (!nextAction) {
      return;
    }

    if (activeInteractiveActionRef.current) {
      activeInteractiveActionRef.current.stop();
      activeInteractiveActionRef.current.enabled = false;
      activeInteractiveActionRef.current.setEffectiveWeight(0);
      activeInteractiveActionRef.current = null;
    }

    nextAction.reset();
    // eslint-disable-next-line react-hooks/immutability
    nextAction.enabled = true;
    nextAction.setLoop(THREE.LoopOnce, 1);
    nextAction.clampWhenFinished = false;
    nextAction.setEffectiveWeight(1);
    nextAction.play();
    activeInteractiveActionRef.current = nextAction;
  }

  return (
    <group ref={wrapperRef} position={[0.72, -1.92, 0]}>
      <mesh onPointerDown={handlePointerDown} position={[0, 1.48, 0.08]} renderOrder={-1}>
        <sphereGeometry args={[2.2, 18, 18]} />
        <meshBasicMaterial depthWrite={false} opacity={0} transparent />
      </mesh>
      <primitive object={scene} onPointerDown={handlePointerDown} />
    </group>
  );
}

function tuneMaterial(material: Material) {
  const standard = material as THREE.MeshStandardMaterial;

  if ("roughness" in standard) {
    standard.roughness = Math.min(1, standard.roughness + 0.08);
  }
  if ("metalness" in standard) {
    standard.metalness = Math.max(0, standard.metalness * 0.45);
  }
  if ("envMapIntensity" in standard) {
    standard.envMapIntensity = 0.8;
  }
}

function sanitizeAnimationClips(clips: THREE.AnimationClip[]) {
  return clips.map((clip) => {
    const clonedClip = clip.clone();
    clonedClip.tracks = clonedClip.tracks.filter((track) => {
      return (
        !track.name.includes("Bip01_00.position") &&
        !track.name.includes("Bip01_00.quaternion") &&
        !track.name.includes("Bip01 Pelvis_01.position")
      );
    });
    clonedClip.resetDuration();
    return clonedClip;
  });
}

function dampActionWeight(
  action: THREE.AnimationAction | undefined,
  targetWeight: number,
  delta: number,
  smoothTime: number,
) {
  if (!action) {
    return;
  }

  const nextWeight = THREE.MathUtils.damp(
    action.getEffectiveWeight(),
    targetWeight,
    smoothTime,
    delta,
  );

  if (targetWeight > 0 && !action.isRunning()) {
    action.play();
  }

  action.enabled = nextWeight > 0.001 || targetWeight > 0;
  action.setEffectiveWeight(nextWeight);

  if (!action.enabled && action.isRunning()) {
    action.stop();
  }
}

function setBone(
  boneRefs: React.MutableRefObject<Record<BoneKey, Object3D | null>>,
  boneBaseRef: React.MutableRefObject<Partial<Record<BoneKey, THREE.Quaternion>>>,
  key: BoneKey,
  bone: Object3D | null,
) {
  boneRefs.current[key] = bone;
  boneBaseRef.current[key] = bone?.quaternion.clone();
}

function applyBoneOffset(
  bone: Object3D | null,
  baseQuaternion: THREE.Quaternion | undefined,
  offset: THREE.Euler,
  blend: number,
) {
  if (!bone || !baseQuaternion) {
    return;
  }

  const targetQuaternion = baseQuaternion.clone().multiply(
    new THREE.Quaternion().setFromEuler(offset),
  );
  bone.quaternion.slerp(targetQuaternion, blend);
}
